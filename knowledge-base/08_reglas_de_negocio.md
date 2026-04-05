# 08. Reglas de Negocio

Este documento describe todas las reglas de negocio que rigen el comportamiento del sistema Integrador / Buen Sabor. Cada regla tiene impacto directo en la implementación y debe ser respetada tanto en backend como en frontend.

---

## 1. Aislamiento Multi-Tenant

El sistema opera bajo un modelo **multi-tenant estricto**, donde cada restaurante (tenant) tiene sus datos completamente aislados.

### Principio fundamental

> Ninguna consulta, ningún evento, ninguna operación puede cruzar la frontera de un tenant. Si un dato no pertenece al tenant del usuario autenticado, no existe.

### Alcance de los datos por tenant

| Nivel | Entidades | Descripcion |
|-------|-----------|-------------|
| **Tenant** | CookingMethod, FlavorProfile, TextureProfile, CuisineType, IngredientGroup, Ingredient, SubIngredient, Allergen, Recipe | Catalogos compartidos entre todas las sucursales del restaurante |
| **Branch** | Category, Subcategory, Product, BranchProduct, BranchSector, Table, TableSession, Diner, Round, RoundItem, KitchenTicket, Check, Charge, Payment, Allocation, ServiceCall, Promotion (via junction) | Datos operativos de cada sucursal |

### Reglas de aislamiento

1. **Toda entidad posee un `tenant_id`** que se valida en cada operacion CRUD.
2. **Los usuarios tienen un array `branch_ids` en el JWT**. Solo pueden acceder a las sucursales asignadas.
3. **Los eventos WebSocket se filtran por `tenant_id`** en cada punto de broadcast. Un evento de la sucursal A jamas llega a la sucursal B de otro tenant.
4. **Las consultas de repositorio** (`TenantRepository`, `BranchRepository`) filtran automaticamente por `tenant_id`. Las consultas raw deben incluir el filtro manualmente.
5. **Las URLs publicas** (menu, branches) usan el `slug` de la sucursal, no el ID numerico, para evitar enumeracion.

### Ejemplo de validacion en servicio

```python
ctx = PermissionContext(user)
ctx.require_branch_access(branch_id)  # Verifica que branch_id este en user["branch_ids"]
# Si no pertenece, lanza ForbiddenError
```

---

## 2. Reglas de Precios

### Almacenamiento en centavos

Todos los precios se almacenan como **enteros en centavos** para evitar errores de punto flotante.

| Concepto | Ejemplo |
|----------|---------|
| Precio en pesos | $125.50 |
| Valor en base de datos | 12550 (centavos) |
| Conversion frontend | `displayPrice = backendCents / 100` |
| Conversion backend | `backendCents = Math.round(price * 100)` |

### Precio base vs. precio por sucursal

Cada producto puede tener:

- **Precio base** (`product.price`): precio por defecto aplicado a todas las sucursales.
- **Precio por sucursal** (`branch_product.price_cents`): precio especifico para una sucursal, habilitado por el flag `use_branch_prices`.

| Flag `use_branch_prices` | Comportamiento |
|--------------------------|----------------|
| `false` | Se usa `product.price` para todas las sucursales |
| `true` | Se usa `branch_product.price_cents` para cada sucursal |

### Visibilidad por sucursal

El registro `BranchProduct` tiene un campo `is_active`:

- `is_active = true`: el producto se vende en esa sucursal.
- `is_active = false`: el producto **no aparece** en el menu de esa sucursal.
- Sin registro `BranchProduct`: el producto tampoco aparece.

### Precios en promociones

Las promociones tienen su propio `price` en centavos. Este precio reemplaza la suma individual de los productos incluidos (`promotion_item`).

---

## 3. Ciclo de Vida de las Rondas (Round Lifecycle)

Las rondas son la unidad central del flujo de pedidos. Cada ronda agrupa items pedidos por los comensales de una mesa.

### Maquina de estados

```
PENDING --> CONFIRMED --> SUBMITTED --> IN_KITCHEN --> READY --> SERVED
                                                                  |
                                          CANCELED <-- (desde cualquier estado)
```

### Restricciones por rol

| Transicion | Roles permitidos |
|------------|-----------------|
| (nuevo) -> PENDING | Comensal (pwaMenu) |
| PENDING -> CONFIRMED | WAITER, MANAGER, ADMIN |
| CONFIRMED -> SUBMITTED | MANAGER, ADMIN |
| SUBMITTED -> IN_KITCHEN | KITCHEN, MANAGER, ADMIN |
| IN_KITCHEN -> READY | KITCHEN, MANAGER, ADMIN |
| READY -> SERVED | WAITER, KITCHEN, MANAGER, ADMIN |
| Cualquiera -> CANCELED | MANAGER, ADMIN |

### Visibilidad por rol

| Estado | Dashboard (Admin) | Cocina | Mozos | Comensales |
|--------|-------------------|--------|-------|------------|
| PENDING | Si | **No** | Si | No |
| CONFIRMED | Si | **No** | Si | No |
| SUBMITTED | Si | **Si** | Si | No |
| IN_KITCHEN | Si | Si | Si | Si |
| READY | Si | Si | Si | Si |
| SERVED | Si | Si | Si | Si |

> **Regla critica**: La cocina **nunca** ve pedidos en estado PENDING o CONFIRMED. Solo a partir de SUBMITTED el pedido aparece en la vista de cocina.

### Eventos WebSocket por transicion

Cada transicion emite un evento especifico: `ROUND_PENDING`, `ROUND_CONFIRMED`, `ROUND_SUBMITTED`, `ROUND_IN_KITCHEN`, `ROUND_READY`, `ROUND_SERVED`, `ROUND_CANCELED`.

### Filtrado por sector

Los eventos con `sector_id` se envian unicamente a los mozos asignados a ese sector. Los roles ADMIN y MANAGER reciben todos los eventos de la sucursal.

---

## 4. Reglas de Sesion de Mesa

### Ciclo de vida

```
(sin sesion) --> OPEN --> PAYING --> CLOSED
```

| Estado | Descripcion | Pueden pedir? |
|--------|-------------|---------------|
| OPEN | Sesion activa, comensales ordenando | Si |
| PAYING | Cuenta solicitada, proceso de pago | **No** |
| CLOSED | Sesion finalizada, mesa liberada | No |

> **Regla de negocio confirmada (2026-04-04)**: Una vez que se solicita la cuenta (estado PAYING), los comensales **NO pueden crear nuevas rondas**. El backend debe rechazar la creacion de rondas cuando `table_session.status == PAYING`. Los frontends deben deshabilitar la opcion de agregar al carrito y enviar pedidos.
>
> **NOTA**: El codigo actual (CLAUDE.md) indica que se permite ordenar durante PAYING. Esto es un **BUG confirmado** que debe corregirse. Ver `knowledge-base/26_suposiciones_detectadas.md` seccion 4.

### Codigos de mesa

- Los codigos son alfanumericos (ejemplo: `INT-01`, `BAR-03`).
- Los codigos **NO son unicos** entre sucursales. Dos sucursales pueden tener una mesa `INT-01`.
- Por lo tanto, siempre se requiere el `branch_slug` para identificar una mesa de forma unica.

### TTL de sesion (pwaMenu)

- La cache local de pwaMenu tiene un TTL de **8 horas** desde la ultima actividad, no desde la creacion.
- Al cargar la app, se verifica si los datos almacenados estan vencidos y se limpian automaticamente.
- Datos con TTL: menu cacheado, datos de sesion.

---

## 5. Convencion de Soft Delete

### Principio

> Nada se borra fisicamente. Todo se desactiva.

### Reglas

1. **Todas las entidades** usan soft delete: `is_active = False`.
2. **Hard delete solo** para registros efimeros: items del carrito (`cart_item`), sesiones expiradas.
3. **Toda consulta** debe filtrar por `is_active.is_(True)`:
   - Los repositorios (`TenantRepository`, `BranchRepository`) lo hacen automaticamente.
   - Las consultas raw **deben incluirlo manualmente**.
4. **Cascade soft delete**: `cascade_soft_delete(db, entity, user_id, user_email)` desactiva la entidad y todos sus dependientes recursivamente.
5. **Auditoria**: cada soft delete registra `deleted_at`, `deleted_by_id` y `deleted_by_email`.
6. **Evento WebSocket**: cada cascade soft delete emite un evento `CASCADE_DELETE` con el conteo de entidades afectadas.

### Comparacion de booleanos en SQLAlchemy

```python
# CORRECTO
.where(Model.is_active.is_(True))

# INCORRECTO (comportamiento impredecible)
.where(Model.is_active == True)
```

---

## 6. Reglas de Alergenos

### Cumplimiento normativo

El sistema cumple con la **regulacion EU 1169/2011** sobre informacion alimentaria.

### Clasificacion

| Campo | Valores posibles | Descripcion |
|-------|------------------|-------------|
| `is_mandatory` | true/false | Indica si es un alergeno de declaracion obligatoria segun EU 1169/2011 |
| `presence_type` | `contains`, `may_contain`, `free_from` | Nivel de presencia en el producto |
| `risk_level` | `mild`, `moderate`, `severe`, `life_threatening` | Severidad de la reaccion |

### Reacciones cruzadas

El sistema rastrea reacciones cruzadas entre alergenos. Por ejemplo:
- Latex -> kiwi, banana, aguacate
- Marisco -> acaro del polvo

Esto permite alertar al comensal sobre riesgos indirectos.

### Modos de filtrado (pwaMenu)

| Modo | Comportamiento |
|------|----------------|
| **Estricto** | Oculta productos con `contains` |
| **Muy estricto** | Oculta productos con `contains` Y `may_contain` |

El comensal selecciona sus alergenos y el modo de filtrado. Los productos se filtran en tiempo real en el menu.

---

## 7. Control de Acceso Basado en Roles (RBAC)

### Matriz de permisos

| Rol | Crear | Editar | Eliminar |
|-----|-------|--------|----------|
| ADMIN | Todo | Todo | Todo |
| MANAGER | Staff, Mesas, Alergenos, Promociones (solo sus sucursales) | Igual | Nada |
| KITCHEN | Nada | Nada | Nada |
| WAITER | Nada | Nada | Nada |

### Relacion Usuario-Sucursal-Rol

- Un usuario puede tener **multiples roles en multiples sucursales** via `UserBranchRole`.
- El JWT contiene `branch_ids` (array) y `roles` (array).
- La validacion de permisos usa `PermissionContext`:

```python
ctx = PermissionContext(user)
ctx.require_management()           # Solo ADMIN o MANAGER
ctx.require_branch_access(branch_id)  # Verifica acceso a la sucursal
```

### Roles de gestion

Los roles `ADMIN` y `MANAGER` se agrupan bajo la constante `MANAGEMENT_ROLES`. Varias operaciones requieren pertenecer a este grupo.

---

## 8. Asignacion de Mozos

### Flujo pre-login (pwaWaiter)

1. El mozo selecciona la sucursal **antes de loguearse**: `GET /api/public/branches` (sin autenticacion).
2. Login con credenciales.
3. Verificacion: `GET /api/waiter/verify-branch-assignment?branch_id=X`.
4. Si no esta asignado **para el dia de hoy**: pantalla "Acceso Denegado".

### Asignacion por sector

- Los mozos se asignan a **sectores especificos** dentro de una sucursal via `WaiterSectorAssignment`.
- La asignacion es **diaria** (campo `date`).
- Cache de sectores con TTL de **5 minutos**, con refresco dinamico via comando WebSocket.

### Impacto en eventos

Los eventos WebSocket con `sector_id` solo se envian a los mozos asignados a ese sector. Esto evita que un mozo reciba notificaciones de mesas que no le corresponden.

---

## 9. Reglas de Entrega de Eventos

### Dos patrones de entrega

| Patron | Uso | Garantia |
|--------|-----|----------|
| **Transactional Outbox** | Eventos criticos (financieros, pedidos a cocina) | At-least-once delivery |
| **Direct Redis Pub/Sub** | Eventos no criticos (carrito, estado de mesa, CRUD admin) | Best-effort |

### Eventos via Outbox (no se pueden perder)

- `CHECK_REQUESTED`, `CHECK_PAID`
- `PAYMENT_APPROVED`, `PAYMENT_REJECTED`
- `ROUND_SUBMITTED`, `ROUND_READY`
- `SERVICE_CALL_CREATED`

El evento se escribe en la tabla `outbox_event` **atomicamente** en la misma transaccion que la operacion de negocio:

```python
write_billing_outbox_event(db=db, tenant_id=t, event_type=CHECK_REQUESTED, ...)
db.commit()  # Atomico con los datos de negocio
```

Un procesador en background lee los eventos pendientes y los publica a Redis Streams.

### Eventos via Direct Redis (menor latencia)

- `ROUND_CONFIRMED`, `ROUND_IN_KITCHEN`, `ROUND_SERVED`
- `CART_ITEM_ADDED`, `CART_ITEM_UPDATED`, `CART_ITEM_REMOVED`, `CART_CLEARED`
- `TABLE_SESSION_STARTED`, `TABLE_CLEARED`, `TABLE_STATUS_CHANGED`
- `ENTITY_CREATED`, `ENTITY_UPDATED`, `ENTITY_DELETED`, `CASCADE_DELETE`

---

## 10. Reglas de Tokens y Autenticacion

### Tipos de token

| Token | Duracion | Almacenamiento | Uso |
|-------|----------|----------------|-----|
| Access Token (JWT) | 15 minutos | Memoria (frontend) | Dashboard, pwaWaiter |
| Refresh Token | 7 dias | Cookie HttpOnly | Renovacion de access token |
| Table Token (HMAC) | 3 horas | Header `X-Table-Token` | pwaMenu (comensales) |

### Estrategia de renovacion

- **Renovacion proactiva**: el frontend renueva el access token a los **14 minutos** (1 minuto antes de vencer).
- **Jitter**: se agrega un desfasaje aleatorio de +/- 2 minutos para evitar thundering herd.
- **Reintentos**: maximo 3 intentos de renovacion antes de auto-logout.
- **Sincronizacion multi-tab**: via `BroadcastChannel` para evitar multiples renovaciones simultaneas.

### Blacklist de tokens

- Los tokens revocados se almacenan en **Redis**.
- Patron **fail-closed**: si Redis esta caido, se rechazan todos los tokens (seguridad sobre disponibilidad).

### Prevencion de loop infinito en logout

En `api.ts`, `authAPI.logout()` debe deshabilitar el retry en 401. De lo contrario: token vencido -> 401 -> onTokenExpired -> logout() -> 401 -> loop infinito. Se pasa `false` como tercer argumento a `fetchAPI`.

---

## 11. Reglas de Promociones

### Estructura

| Campo | Descripcion |
|-------|-------------|
| `name` | Nombre de la promocion |
| `price` | Precio en centavos (reemplaza suma individual) |
| `start_date` / `start_time` | Inicio de vigencia |
| `end_date` / `end_time` | Fin de vigencia |
| `promotion_type_id` | Tipo de promocion (catalogo tenant-scoped) |

### Alcance

- Una promocion puede aplicar a **multiples sucursales** via la tabla `promotion_branch`.
- Contiene **items de promocion** (`promotion_item`) que referencian productos individuales.

### Vigencia temporal

La promocion solo es valida dentro del rango `[start_date + start_time, end_date + end_time]`. Fuera de ese rango no aparece en el menu.

---

## 12. Reglas de Idioma e Internacionalizacion

### Convencion general

| Contexto | Idioma |
|----------|--------|
| Interfaz de usuario (UI) | Espanol |
| Comentarios en codigo | Ingles |
| Nombres de variables y funciones | Ingles (camelCase frontend, snake_case backend) |

### pwaMenu: Internacionalizacion completa

- **Todos** los textos visibles al usuario deben usar la funcion `t()`.
- Cero strings hardcodeados.
- Idiomas soportados: **es** (base), **en**, **pt**.
- Fallback: si falta una traduccion en `en` o `pt`, se muestra en `es`.

### Dashboard y pwaWaiter

Actualmente solo en espanol. No usan i18n.

---

## 13. Reglas de Gobernanza (IA-Native)

El proyecto usa gobernanza con Policy Tickets que definen niveles de autonomia para modificaciones:

| Nivel | Dominios | Que puede hacer la IA |
|-------|----------|----------------------|
| **CRITICO** | Auth, Billing, Alergenos, Staff | Solo analisis, sin cambios en codigo de produccion |
| **ALTO** | Productos, WebSocket, Rate Limiting | Proponer cambios, esperar revision humana |
| **MEDIO** | Ordenes, Cocina, Mozo, Mesas, Customer | Implementar con checkpoints |
| **BAJO** | Categorias, Sectores, Recetas, Ingredientes, Promociones | Autonomia total si los tests pasan |
