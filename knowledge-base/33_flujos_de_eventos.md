# 33. Flujos de Eventos

Documentacion de los 5 flujos criticos de eventos end-to-end del sistema, desde la accion del usuario hasta la actualizacion en tiempo real en todos los clientes afectados.

---

## Patrones de publicacion

El sistema utiliza dos patrones de publicacion de eventos segun la criticidad:

| Patron | Garantia | Uso | Latencia |
|--------|----------|-----|----------|
| **Outbox transaccional** | At-least-once (atomico con datos de negocio) | Eventos financieros y criticos | Mayor (~100-500ms adicionales) |
| **Direct Redis** | Best-effort (publicacion asincrona) | Eventos informativos, CRUD | Menor (~50-100ms) |

---

## Flujo 1: ROUND_PENDING — Comensal hace un pedido

**Trigger:** El comensal confirma su carrito en pwaMenu.

**Criticidad:** Alta — representa un pedido real con impacto financiero.

```
pwaMenu (cliente)
  └─ submitOrder()
      └─ dinerAPI.submitRound()
          └─ POST /api/diner/rounds/submit
              Header: X-Table-Token
              Body: { items: [{ product_id, quantity, notes }] }

Backend (rest_api)
  └─ round_router.submit_round()
      └─ round_service.submit_round()
          ├─ SELECT FOR UPDATE session         ← Lock para prevenir race conditions
          ├─ INSERT Round (status = PENDING)
          ├─ INSERT RoundItems                 ← price_cents snapshot del momento
          ├─ DELETE CartItems                  ← Limpia carrito del comensal
          └─ safe_commit()                     ← Atomico: todo o nada
      └─ Background task: publish_round_event()
          └─ Redis Stream: ROUND_PENDING

WebSocket Gateway (ws_gateway)
  └─ redis_subscriber recibe evento
      └─ validate evento
          └─ process_event_batch()
              └─ EventRouter.route_event(ROUND_PENDING)
                  ├─ send_to_admins(branch_id)      → Dashboard WS
                  ├─ send_to_waiters_only(branch_id) → pwaWaiter WS (TODOS los mozos)
                  ├─ NO cocina                       ← Kitchen no ve PENDING
                  └─ NO comensales                   ← Diners ya saben, ellos lo enviaron

Clientes receptores
  ├─ Dashboard: tabla de pedidos actualizada
  └─ pwaWaiter: TableCard muestra pulso amarillo, contador de pendientes +1
```

**Nota:** ROUND_PENDING se envia a TODOS los mozos del branch (no filtrado por sector) porque el sistema necesita que cualquier mozo disponible pueda confirmar.

---

## Flujo 2: SERVICE_CALL_CREATED — Comensal llama al mozo

**Trigger:** El comensal presiona el boton "Llamar mozo" en pwaMenu.

**Criticidad:** Alta — usa Outbox Pattern para garantia de entrega.

```
pwaMenu (cliente)
  └─ CallWaiterModal
      └─ dinerAPI.createServiceCall()
          └─ POST /api/diner/service-call
              Header: X-Table-Token
              Body: { type: "CALL_WAITER" }

Backend (rest_api)
  └─ service_call_router.create()
      └─ service_call_service.create()
          ├─ INSERT ServiceCall (status = OPEN)
          ├─ write_service_call_outbox_event()  ← OUTBOX PATTERN (atomico con INSERT)
          └─ safe_commit()                      ← Evento garantizado en DB
  └─ Outbox Processor (background worker)
      └─ SELECT outbox_events WHERE processed = false
          └─ Publica SERVICE_CALL_CREATED en Redis Stream
              └─ UPDATE outbox_event SET processed = true

WebSocket Gateway (ws_gateway)
  └─ redis_subscriber recibe evento
      └─ EventRouter.route_event(SERVICE_CALL_CREATED)
          ├─ send_to_sector(sector_id)    → Mozos asignados al sector de la mesa
          ├─ send_to_admins(branch_id)    → Dashboard WS
          ├─ NO cocina
          └─ NO comensales

Clientes receptores
  ├─ Dashboard: notificacion de llamada de servicio
  └─ pwaWaiter: animacion roja parpadeante + sonido de alerta en la mesa correspondiente
```

**Nota:** Este flujo usa filtrado por sector — solo los mozos asignados al sector de la mesa reciben la notificacion. ADMIN y MANAGER reciben todas las notificaciones independientemente del sector.

---

## Flujo 3: CHECK_REQUESTED — Comensal pide la cuenta

**Trigger:** El comensal toca "Pedir cuenta" en el BottomNav de pwaMenu.

**Criticidad:** Critica — involucra datos financieros, usa Outbox Pattern.

```
pwaMenu (cliente)
  └─ BottomNav → boton "Cuenta"
      └─ closeTable()
          └─ billingAPI.requestCheck()
              └─ POST /api/billing/check/request
                  Header: X-Table-Token

Backend (rest_api)
  └─ billing_router.request_check()
      └─ billing_service.request_check()
          ├─ Verificar session.status == OPEN
          ├─ Calcular total de todas las rondas (SUBMITTED+)
          ├─ INSERT Check (status = REQUESTED)  ← tabla: app_check
          ├─ INSERT Charges por cada item
          ├─ UPDATE Table.status = PAYING
          ├─ UPDATE Session.status = PAYING
          ├─ write_billing_outbox_event(CHECK_REQUESTED)  ← OUTBOX
          └─ safe_commit()                                ← Todo atomico
  └─ Outbox Processor
      └─ Publica CHECK_REQUESTED en Redis Stream

WebSocket Gateway (ws_gateway)
  └─ EventRouter.route_event(CHECK_REQUESTED)
      ├─ send_to_admins(branch_id)         → Dashboard WS
      ├─ send_to_waiters_only(branch_id)   → pwaWaiter WS
      └─ send_to_session(session_id)       → pwaMenu (todos los comensales de la mesa)

Clientes receptores
  ├─ Dashboard: mesa cambia a estado "Pagando"
  ├─ pwaWaiter: TableCard muestra pulso purpura, indica cuenta solicitada
  └─ pwaMenu: comensales ven el total, metodos de pago disponibles
```

**Nota:** Los comensales pueden seguir ordenando durante el estado PAYING. La cuenta se recalcula si hay nuevas rondas.

---

## Flujo 4: TABLE_SESSION_STARTED — Escaneo de QR

**Trigger:** Un cliente escanea el codigo QR de la mesa con su celular.

**Criticidad:** Media — usa Direct Redis (no Outbox) por ser informativo.

```
pwaMenu (cliente)
  └─ QR scan → URL con codigo de mesa
      └─ JoinTable page
          └─ joinTable()
              └─ sessionAPI.createOrGetSession()
                  └─ POST /api/tables/code/{code}/session
                      Sin auth (endpoint publico con branch_slug)
                      Body: { branch_slug: "sucursal-centro" }

Backend (rest_api)
  └─ table_router.create_or_get_session()
      └─ table_service.get_or_create_session()
          ├─ SELECT FOR UPDATE table            ← Lock para evitar sesiones duplicadas
          ├─ IF no session activa:
          │   ├─ INSERT TableSession (status = OPEN)
          │   └─ UPDATE Table.status = ACTIVE
          ├─ Generar table_token (JWT con table_id, session_id, branch_id)
          └─ safe_commit()
      └─ publish_table_event(TABLE_SESSION_STARTED)  ← DIRECT REDIS
          └─ Redis Stream inmediato (sin outbox)

WebSocket Gateway (ws_gateway)
  └─ EventRouter.route_event(TABLE_SESSION_STARTED)
      ├─ send_to_waiters_only(branch_id)   → TODOS los mozos del branch
      ├─ send_to_admins(branch_id)         → Dashboard WS
      ├─ NO cocina
      └─ NO comensales (el que escaneo recibe respuesta HTTP directa)

Clientes receptores
  ├─ Dashboard: mesa cambia a estado "Activa"
  └─ pwaWaiter: animacion azul parpadeante, mesa aparece como ocupada
```

**Nota:** El codigo de mesa NO es unico entre sucursales — el `branch_slug` es obligatorio para identificar la mesa correcta.

---

## Flujo 5: ENTITY_UPDATED — Admin actualiza un producto

**Trigger:** Un administrador modifica un producto desde el Dashboard.

**Criticidad:** Baja — evento informativo, usa Direct Async.

```
Dashboard (cliente)
  └─ ProductEditor form (React 19 useActionState)
      └─ productStore.update()
          └─ productAPI.update(productId, formData)
              └─ PATCH /api/admin/products/{id}
                  Header: Authorization: Bearer {JWT}
                  Body: { name, description, price_cents, allergen_ids, branch_prices }

Backend (rest_api)
  └─ admin_router.update_product()
      └─ ProductService.update_full()
          ├─ PermissionContext(user).require_management()
          ├─ UPDATE Product (campos basicos)
          ├─ UPSERT BranchProduct (precios por sucursal)
          ├─ SYNC ProductAllergen (agregar/quitar)
          └─ safe_commit()
      └─ publish_entity_updated()  ← DIRECT ASYNC (sin outbox, sin background task)
          └─ Redis Stream inmediato

WebSocket Gateway (ws_gateway)
  └─ EventRouter.route_event(ENTITY_UPDATED)
      ├─ send_to_admins(branch_id)   → Dashboard WS UNICAMENTE
      ├─ NO mozos                    ← ADMIN_ONLY_EVENTS
      ├─ NO cocina
      └─ NO comensales

Clientes receptores
  └─ Dashboard: invalidar cache local, refetch del producto actualizado
      └─ Otros tabs/admins ven el cambio en tiempo real
```

**Nota:** Los eventos ENTITY_* (CREATED, UPDATED, DELETED) son exclusivos del Dashboard. Los mozos, cocina y comensales no reciben estos eventos — consumen datos actualizados via polling o al cargar la pagina.

---

## Tabla resumen

| Flujo | Evento | Patron | Canal Redis | Destinatarios | Filtro por sector |
|-------|--------|--------|-------------|---------------|-------------------|
| 1. Pedido | `ROUND_PENDING` | Background task | Stream | Admins + TODOS los Mozos | No (branch-wide) |
| 2. Llamada mozo | `SERVICE_CALL_CREATED` | Outbox | Stream | Admins + Mozos del sector | SI |
| 3. Pedir cuenta | `CHECK_REQUESTED` | Outbox | Stream | Admins + Mozos + Comensales | No |
| 4. Escaneo QR | `TABLE_SESSION_STARTED` | Direct Redis | Stream | Admins + TODOS los Mozos | No (branch-wide) |
| 5. CRUD admin | `ENTITY_UPDATED` | Direct Async | Stream | Admins UNICAMENTE | No |

---

## Matriz completa de routing de eventos

Para referencia, la tabla completa de que roles reciben cada tipo de evento:

| Evento | Admin | Kitchen | Waiters | Diners | Sector filter |
|--------|-------|---------|---------|--------|---------------|
| `ROUND_PENDING` | Si | No | Si (todos) | No | No |
| `ROUND_CONFIRMED` | Si | No | Si | No | No |
| `ROUND_SUBMITTED` | Si | Si | Si | No | No |
| `ROUND_IN_KITCHEN` | Si | Si | Si | Si | No |
| `ROUND_READY` | Si | Si | Si | Si | No |
| `ROUND_SERVED` | Si | Si | Si | Si | No |
| `ROUND_CANCELED` | Si | No | Si | Si | No |
| `CART_ITEM_ADDED` | No | No | No | Si | N/A |
| `CART_ITEM_UPDATED` | No | No | No | Si | N/A |
| `CART_ITEM_REMOVED` | No | No | No | Si | N/A |
| `CART_CLEARED` | No | No | No | Si | N/A |
| `SERVICE_CALL_CREATED` | Si | No | Si (sector) | No | SI |
| `SERVICE_CALL_ACKED` | Si | No | Si (sector) | No | SI |
| `SERVICE_CALL_CLOSED` | Si | No | Si (sector) | No | SI |
| `CHECK_REQUESTED` | Si | No | Si | Si | No |
| `CHECK_PAID` | Si | No | Si | Si | No |
| `PAYMENT_APPROVED` | Si | No | Si | Si | No |
| `PAYMENT_REJECTED` | Si | No | Si | Si | No |
| `TABLE_SESSION_STARTED` | Si | No | Si (todos) | No | No |
| `TABLE_CLEARED` | Si | No | Si (todos) | No | No |
| `TABLE_STATUS_CHANGED` | Si | No | Si (todos) | No | No |
| `ENTITY_CREATED` | Si | No | No | No | No |
| `ENTITY_UPDATED` | Si | No | No | No | No |
| `ENTITY_DELETED` | Si | No | No | No | No |
| `CASCADE_DELETE` | Si | No | No | No | No |

---

## Garantias de entrega por patron

### Outbox transaccional

1. Evento se escribe en tabla `outbox_events` en la misma transaccion que los datos de negocio
2. Background processor lee eventos no procesados periodicamente
3. Publica en Redis Stream
4. Marca evento como procesado
5. Si Redis falla, el evento permanece en DB y se reintenta
6. **Garantia:** At-least-once delivery (puede duplicar, nunca pierde)

### Direct Redis (Background task / Async)

1. Evento se publica directamente en Redis Stream despues del commit
2. Si Redis falla en ese momento, el evento se pierde
3. **Garantia:** Best-effort (puede perder en fallas de Redis)

### Redis Streams (ws_gateway)

1. Consumer group lee eventos del stream
2. Si el procesamiento falla, el evento va a DLQ (Dead Letter Queue)
3. Reintentos configurables antes de descarte
4. **Garantia:** At-least-once dentro del gateway (puede duplicar al reconectar)
