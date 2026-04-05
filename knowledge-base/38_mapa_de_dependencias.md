> Creado: 2026-04-04 | Actualizado: 2026-04-04 | Estado: vigente

# Mapa de Dependencias entre Features

Grafo completo de dependencias entre todas las features del sistema. Para cada feature se documenta: de que depende, quien la usa, y que pasa si se rompe.

---

## Autenticacion (base de todo)

```
JWT Auth
  ├─ depende de: Redis (blacklist de tokens), PostgreSQL (tabla users), bcrypt
  ├─ lo usan: TODOS los endpoints autenticados (Dashboard, pwaWaiter, Kitchen, Admin)
  ├─ refresh: Access token 15min, refresh token 7 dias (HttpOnly cookie)
  └─ si se rompe: TODO el sistema queda inaccesible excepto endpoints publicos
                   (/api/public/menu, /api/public/branches)

Table Token Auth (HMAC)
  ├─ depende de: Redis, TABLE_TOKEN_SECRET, branch_slug + table_code
  ├─ lo usan: pwaMenu (todas las operaciones de comensal), /ws/diner WebSocket
  ├─ duracion: 3 horas
  └─ si se rompe: Comensales no pueden pedir, ver carrito, ni recibir eventos en tiempo real
```

---

## Catalogo

```
Restaurant (Tenant)
  ├─ depende de: PostgreSQL (tabla app_tenant)
  ├─ lo usan: TODAS las entidades (todo tiene tenant_id)
  └─ si se borra: Cascada total — todo el restaurante desaparece

Branch (Sucursal)
  ├─ depende de: Tenant
  ├─ lo usan: Category, Table, Sector, BranchProduct, TableSession, Staff assignments
  └─ si se borra: Todo el contenido de la sucursal se desactiva (soft delete cascade)

Category → Subcategory → Product
  ├─ depende de: Branch (Category.branch_id)
  ├─ lo usan: Public Menu, Round Submission (price snapshot), Kitchen Display
  ├─ relacion: Category 1:N Subcategory 1:N Product
  └─ si se borra Category: cascade soft delete desactiva subcategorias y productos

BranchProduct (precios por sucursal)
  ├─ depende de: Product, Branch
  ├─ lo usan: Public Menu (precio visible), Round (snapshot de precio), Billing (calculo total)
  ├─ campos clave: price_cents, is_available, is_active
  └─ si cambio precios: Pedidos historicos NO se afectan (snapshot en round_item)

Allergen (Alergenos)
  ├─ depende de: Tenant
  ├─ lo usan: Product (M:N via ProductAllergen con presence_type + risk_level)
  └─ si se borra: Se desvincula de productos (soft delete)

Product Availability
  ├─ depende de: BranchProduct.is_available (migracion 002), Kitchen Router
  ├─ lo usan: Public Menu (deberia filtrar), pwaMenu (deberia mostrar badge)
  ├─ diferencia: is_available (temporal, cocina) vs is_active (permanente, admin)
  └─ si se activa: Producto deberia desaparecer del menu en tiempo real via WS
```

---

## Flujo de Pedidos

```
Table Session (Sesion de Mesa)
  ├─ depende de: Table, Branch, Sector
  ├─ lo usan: Round Submission, Billing, Service Calls, Diner Registration
  ├─ estados: OPEN → PAYING → CLOSED
  ├─ activacion: QR scan (comensal) o /api/waiter/tables/{id}/activate (mozo)
  └─ si se rompe: NADIE puede pedir — es el corazon del flujo

Diner (Comensal)
  ├─ depende de: TableSession (session_id), Customer (customer_id, opcional)
  ├─ lo usan: Cart (quien agrego cada item), Round (quien pidio que)
  └─ si se rompe: No se puede identificar quien pidio que en el carrito compartido

Shared Cart (Carrito Compartido)
  ├─ depende de: TableSession (OPEN), Diner, Product Catalog
  ├─ lo usan: Round Submission (consolida items de todos los comensales)
  ├─ sync: WebSocket events (CART_ITEM_ADDED, CART_ITEM_UPDATED, CART_ITEM_REMOVED)
  └─ si se rompe: Comensales pueden pedir pero no ven items de otros

Round Submission (Envio de Ronda)
  ├─ depende de: TableSession (OPEN), Product Catalog, Diner, Cart
  ├─ lo usan: Kitchen Display, Statistics, Billing (calculo de total)
  ├─ snapshot: product_name y unit_price_cents se copian al round_item
  ├─ flujo: PENDING → CONFIRMED → SUBMITTED → IN_KITCHEN → READY → SERVED
  │         (Diner)   (Waiter)    (Admin/Mgr)  (Kitchen)   (Kitchen) (Staff)
  └─ si se rompe: Los pedidos no llegan a cocina

Kitchen Display
  ├─ depende de: Round status flow, KitchenTicket model, WebSocket events
  ├─ lo usan: (standalone — consume eventos, no los produce)
  ├─ ve solo: Rounds con status >= SUBMITTED (no ve PENDING ni CONFIRMED)
  ├─ eventos: ROUND_SUBMITTED, ROUND_IN_KITCHEN, ROUND_READY, ROUND_SERVED
  └─ si se rompe: Cocina no ve pedidos (fallback: lista manual via API)

Kitchen Tickets
  ├─ depende de: Round, Product, Branch
  ├─ lo usan: Kitchen Display (visualizacion), Printer (futuro)
  └─ si se rompe: Cocina pierde visibilidad de items individuales por ronda

Service Calls (Llamadas de Servicio)
  ├─ depende de: TableSession, Diner, Sector (para routing a mozo correcto)
  ├─ lo usan: pwaWaiter (notificaciones), Dashboard (monitoreo)
  ├─ flujo: CREATED → ACKED → CLOSED
  ├─ outbox: SERVICE_CALL_CREATED usa outbox pattern (garantia de entrega)
  └─ si se rompe: Comensal no puede llamar al mozo (debe hacer seña manual)

Comanda Rapida
  ├─ depende de: Waiter auth, TableSession, Product Catalog (menu compacto sin imagenes)
  ├─ endpoint: GET /api/waiter/branches/{id}/menu
  ├─ lo usan: pwaWaiter (pedido rapido para clientes sin celular)
  └─ si se rompe: Mozo debe tomar pedido en papel y cargarlo despues
```

---

## Facturacion

```
Check / Billing (Cuenta)
  ├─ depende de: TableSession, Round (para calcular total), Payment model
  ├─ tabla: app_check (evita palabra reservada SQL "check")
  ├─ lo usan: Mercado Pago, Manual Payment, Table Close
  ├─ outbox: CHECK_REQUESTED, CHECK_PAID usan outbox pattern
  ├─ FIFO: Charges → Allocations ← Payments (asignacion en orden)
  └─ si se rompe: No se puede cobrar — bloquea el cierre de mesas

Bill Splitting (Division de Cuenta)
  ├─ depende de: Check model, Diner (saber que pidio cada uno)
  ├─ lo usan: pwaMenu (cada comensal ve su parte)
  └─ si se rompe: Todos pagan el total o dividen manual

Mercado Pago
  ├─ depende de: Check model, PaymentGateway ABC, circuit breaker, webhook endpoint
  ├─ lo usan: pwaMenu (redirect a MP), Backend (webhook callback)
  ├─ outbox: PAYMENT_APPROVED, PAYMENT_REJECTED usan outbox pattern
  └─ si MP cae: Webhook retry queue + manual payment como fallback

Manual Payment (Pago Manual)
  ├─ depende de: Check model, Waiter auth
  ├─ endpoint: POST /api/waiter/payments/manual
  ├─ lo usan: pwaWaiter (registrar pago en efectivo/tarjeta/transferencia)
  └─ si se rompe: Mozo no puede registrar cobros — mesas quedan abiertas

Table Close (Cierre de Mesa)
  ├─ depende de: Check (debe estar pagado), TableSession, Waiter auth
  ├─ endpoint: POST /api/waiter/tables/{id}/close
  ├─ lo usan: pwaWaiter (liberar mesa para proximos comensales)
  └─ si se rompe: Mesas quedan "ocupadas" indefinidamente
```

---

## Features Nuevas

```
Reservations (Reservas)
  ├─ depende de: Branch (FK requerido), Table (FK opcional)
  ├─ modelo: reservation (17 cols + AuditMixin, migracion 003)
  ├─ lo usarian: Dashboard (gestion de reservas), pwaMenu (reserva online futura)
  ├─ estados: PENDING → CONFIRMED → SEATED → COMPLETED | CANCELED | NO_SHOW
  └─ bloqueado por: Nada (falta implementar router + service + frontend)

Takeout / Delivery (Para llevar / Delivery)
  ├─ depende de: Product Catalog (items), Branch, Payment
  ├─ modelos: delivery_order (20 cols), delivery_order_item (10 cols), migracion 004
  ├─ lo usarian: pwaMenu (nuevo flujo sin mesa), Kitchen Display (tickets delivery)
  ├─ estados: RECEIVED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED | PICKED_UP | CANCELED
  └─ bloqueado por: Nada (falta implementar router + service + frontend)

Push Notifications
  ├─ depende de: WebSocket Gateway (trigger), Service Worker (entrega), VAPID keys
  ├─ endpoints: POST /api/waiter/notifications/subscribe (backend existe)
  ├─ lo usarian: pwaWaiter (notificacion cuando app esta en background)
  └─ bloqueado por: Integracion (nadie llama subscribe, store es in-memory)

Payment Gateway Abstraction
  ├─ depende de: Billing flow (COMPLETA)
  ├─ ABC: backend/rest_api/services/payments/gateway.py
  ├─ impl: backend/rest_api/services/payments/mercadopago_gateway.py
  ├─ lo usarian: Billing router (actualmente usa codigo inline de MP)
  └─ bloqueado por: Refactor del billing router para usar la abstraccion
```

---

## Infraestructura

```
WebSocket Gateway
  ├─ depende de: Redis (pub/sub + streams), JWT/TableToken auth
  ├─ lo usan: TODAS las features real-time
  │   ├─ Rounds (status flow completo)
  │   ├─ Cart sync (CART_ITEM_*)
  │   ├─ Service Calls (CREATED, ACKED, CLOSED)
  │   ├─ Billing (CHECK_*, PAYMENT_*)
  │   ├─ Tables (SESSION_STARTED, TABLE_CLEARED, STATUS_CHANGED)
  │   └─ Admin CRUD (ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED)
  ├─ sector filtering: Eventos con sector_id solo van a mozos asignados
  └─ si se rompe: Sistema funciona pero SIN real-time (polling manual)

Event Catch-up
  ├─ depende de: Redis sorted sets, WebSocket Gateway, /ws/catchup endpoint
  ├─ lo usan: pwaWaiter (auto-replay on reconnect)
  ├─ no lo usan: Dashboard, pwaMenu (pierden eventos en desconexion)
  └─ si se rompe: Mozos pierden eventos durante desconexion WiFi

Redis
  ├─ depende de: Docker / servicio externo (puerto 6380)
  ├─ lo usan:
  │   ├─ JWT blacklist (fail-closed: si Redis cae, tokens invalidos pasan)
  │   ├─ WebSocket pub/sub (canales por branch)
  │   ├─ Event catch-up (sorted sets)
  │   ├─ Rate limiting (billing endpoints)
  │   └─ Outbox processor (consumer streams)
  └─ si se rompe: Real-time muere, auth degrada, rate limiting se desactiva

PostgreSQL
  ├─ depende de: Docker / servicio externo (puerto 5432)
  ├─ lo usan: TODAS las features (unica fuente de verdad)
  └─ si se rompe: TODO el sistema cae (sin fallback)

CI/CD (GitHub Actions)
  ├─ depende de: GitHub, Docker Hub (para imagenes)
  ├─ workflows: ci.yml (lint+tests), docker-build.yml (build imagenes)
  └─ si se rompe: Merges sin validacion automatica (manual review)

Alembic Migrations
  ├─ depende de: PostgreSQL, schema base (creado por create_all)
  ├─ cadena: 001 → 002 → 003 → 004
  ├─ lo usan: Deploy (upgrade automatico)
  └─ si se rompe: Schema desincronizado — requiere intervencion manual
```

---

## Diagrama de Impacto (que rompe que)

```
PostgreSQL ──────────────────────────── CRITICO (todo depende de esto)
    │
Redis ───────────────────────────────── ALTO (real-time + auth + rate limiting)
    │
JWT Auth ────────────────────────────── ALTO (Dashboard + pwaWaiter + Kitchen)
Table Token Auth ────────────────────── ALTO (pwaMenu completo)
    │
WebSocket Gateway ───────────────────── MEDIO (real-time, no afecta CRUD)
    │
TableSession ────────────────────────── ALTO (flujo de pedidos completo)
    │
├── Round Submission ─────────────────── ALTO (pedidos)
│   ├── Kitchen Display ──────────────── MEDIO (visibilidad cocina)
│   └── Billing ──────────────────────── ALTO (cobros)
│       ├── Mercado Pago ─────────────── MEDIO (fallback: pago manual)
│       └── Table Close ──────────────── MEDIO (mesas quedan abiertas)
│
├── Shared Cart ──────────────────────── MEDIO (sync entre comensales)
└── Service Calls ────────────────────── BAJO (conveniencia, no bloquea pedidos)
```
