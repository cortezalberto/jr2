# 29. Patrones Planificados vs Implementados

> Analisis de brecha entre los patrones definidos en la planificacion ([`patronesAusar.md`](../patronesAusar.md))
> y lo que realmente se implemento en el proyecto, documentado en [`UsadoPatrones.md`](../UsadoPatrones.md).
>
> Ultima actualizacion: 2026-04-04

---

## Tabla de Estado General

| Patron | Planificado | Implementado | Documentado en UsadoPatrones.md | Estado |
|--------|:-----------:|:------------:|:-------------------------------:|--------|
| Repository Pattern | SI | SI | SI | Completo |
| Unit of Work | SI | PARCIAL | NO | Gap en documentacion |
| Service Layer | SI | SI | NO | Gap en documentacion |
| Snapshot Pattern | SI | SI | NO | Gap en documentacion |
| Soft Delete | SI | SI | SI | Completo |
| Audit Trail Append-Only | SI | SI | NO | Gap en documentacion |
| State Machine (FSM) | SI | SI | NO | Gap en documentacion |
| Idempotent Payments | SI | SI | NO | Gap en documentacion |
| Feature-Sliced Design | SI | NO | NO | No implementado |
| Custom Hooks | SI | SI | SI | Completo |
| Optimistic Updates | SI | SI | SI | Completo |
| Webhook / IPN | SI | SI | NO | Gap en documentacion |

**Resumen:** 12 patrones planificados, 11 implementados, 4 completamente documentados, 7 con gap en documentacion, 1 no implementado.

---

## Patrones Completos (Planificado + Implementado + Documentado)

### Repository Pattern
- **Estado:** Completo
- **Ubicacion:** `backend/rest_api/services/crud/repository.py`
- **Detalle:** Jerarquia `BaseRepository` -> `TenantRepository` -> `BranchRepository` con aislamiento multi-tenant automatico. Incluye `SpecificationRepository` para queries componibles.

### Soft Delete
- **Estado:** Completo
- **Ubicacion:** `backend/rest_api/models/base.py` (AuditMixin), `backend/rest_api/services/crud/soft_delete.py` (cascade)
- **Detalle:** `AuditMixin` con `is_active`, `deleted_at`, `deleted_by_id`, `deleted_by_email`. Cascade soft delete para relaciones padre-hijo con emision de evento `CASCADE_DELETE`.

### Custom Hooks
- **Estado:** Completo
- **Ubicacion:** 45+ hooks distribuidos en Dashboard, pwaMenu y pwaWaiter
- **Detalle:** Documentados como patrones F6-F13 en UsadoPatrones.md. Incluyen hooks de UI (useFormModal, useConfirmDialog), datos (usePagination, useOptimisticMutation), accesibilidad (useFocusTrap, useKeyboardShortcuts) y React 19 (useOptimisticCart, useActionState).

### Optimistic Updates
- **Estado:** Completo
- **Ubicacion:** `Dashboard/src/hooks/useOptimisticMutation.ts`, `pwaMenu/src/hooks/useOptimisticCart.ts`
- **Detalle:** Dashboard usa hook generico con rollback. pwaMenu usa `useOptimistic` de React 19 para el carrito.

---

## Patrones con Gap en Documentacion

Estos patrones estan implementados en el codigo pero no fueron incluidos en `UsadoPatrones.md`. Se descubrieron durante el analisis exhaustivo del codebase posterior a la documentacion inicial.

### Unit of Work (Implementacion Parcial)

- **Planificacion original:** Gestionar transacciones atomicas con UoW explicito. El Service opera dentro del contexto UoW sin gestionar la sesion directamente.
- **Implementacion real:** Implicito via SQLAlchemy Session + `safe_commit()`. No existe una clase `UnitOfWork` explicita; la sesion de SQLAlchemy cumple ese rol.
- **Archivos:**
  - `backend/shared/infrastructure/db.py` -- `safe_commit(db)` con rollback automatico en error
  - `backend/shared/infrastructure/db.py` -- `get_db()` como dependency injection de sesion
  - `backend/rest_api/services/events/outbox_service.py` -- escritura atomica de evento + datos de negocio
- **Por que no se documento:** Se considero parte del patron de Dependency Injection (patron #8), no como patron separado. En la practica, SQLAlchemy Session ES el Unit of Work, pero de forma implicita.
- **Recomendacion:** Documentar como variante implicita. Si el proyecto escala a multiples fuentes de datos, considerar un UoW explicito.

### Service Layer

- **Planificacion original:** Logica de negocio centralizada, stateless. Consume el UoW. Independiente del framework.
- **Implementacion real:** 14+ servicios de dominio stateless con jerarquia de herencia:
  - `BaseCRUDService[Model, Output]` -- operaciones CRUD genericas
  - `BranchScopedService[Model, Output]` -- CRUD con scope de sucursal
  - Servicios especializados: `CategoryService`, `SubcategoryService`, `BranchService`, `SectorService`, `TableService`, `ProductService`, `AllergenService`, `StaffService`, `PromotionService`, `RoundService`, `BillingService`, `DinerService`, `ServiceCallService`, `TicketService`
- **Archivos:**
  - `backend/rest_api/services/base_service.py` -- clases base
  - `backend/rest_api/services/domain/` -- todos los servicios de dominio
  - `backend/rest_api/services/domain/__init__.py` -- exportaciones centralizadas
- **Por que no se documento:** El Service Layer se documento parcialmente como parte del patron Template Method (patron #1). La jerarquia de servicios y el conteo de 14+ servicios no se reflejaron como patron independiente.
- **Recomendacion:** Agregar seccion dedicada en UsadoPatrones.md explicando la jerarquia `BaseService` -> `BaseCRUDService` -> `BranchScopedService`.

### Snapshot Pattern

- **Planificacion original:** Precios y nombres de producto inmutables al crear el pedido. Garantiza integridad historica.
- **Implementacion real:** `RoundItem` captura `unit_price_cents` y `product_name` al momento de crear el pedido. Estos valores son inmutables una vez guardados, incluso si el producto se modifica o elimina despues.
- **Archivos:**
  - `backend/rest_api/models/round.py` -- modelo `RoundItem` con campos `unit_price_cents` y `product_name`
  - `backend/rest_api/services/domain/round_service.py` -- logica de captura al crear items
  - Migracion Alembic para agregar `product_name` (2026-04-04)
- **Por que no se documento:** El campo `unit_price_cents` existia desde el inicio pero no se reconocio como patron Snapshot. El campo `product_name` se agrego posteriormente como correccion (ver `30_inconsistencias_detectadas.md`, item #7).
- **Recomendacion:** Documentar como patron critico para integridad de datos historicos. Considerar agregar mas campos snapshot si el negocio lo requiere (ej: imagen del producto).

### Audit Trail Append-Only

- **Planificacion original:** Solo INSERT, nunca UPDATE/DELETE en tablas de auditoria. Trazabilidad completa.
- **Implementacion real:** Dos mecanismos append-only:
  1. `AuditLog` -- registro de acciones administrativas (creacion, edicion, eliminacion)
  2. `OutboxEvent` -- registro inmutable de eventos de dominio con estados de procesamiento
- **Archivos:**
  - `backend/rest_api/models/audit.py` -- modelo `AuditLog`
  - `backend/rest_api/models/outbox.py` -- modelo `OutboxEvent`
  - `backend/rest_api/services/events/outbox_service.py` -- escritura de eventos
- **Por que no se documento:** Se documento el Transactional Outbox (patron #7) pero no se menciono la propiedad append-only como patron de diseno separado. El `AuditLog` no se detallo.
- **Recomendacion:** Agregar seccion que explique la politica append-only y por que es critica para compliance y debugging.

### State Machine (FSM)

- **Planificacion original:** Transiciones del pedido validadas contra el mapa de transiciones permitidas.
- **Implementacion real:** FSM con validacion de transiciones Y restriccion por rol:
  ```python
  ROUND_TRANSITIONS = {
      RoundStatus.PENDING: [RoundStatus.CONFIRMED, RoundStatus.CANCELED],
      RoundStatus.CONFIRMED: [RoundStatus.SUBMITTED, RoundStatus.CANCELED],
      RoundStatus.SUBMITTED: [RoundStatus.IN_KITCHEN],
      RoundStatus.IN_KITCHEN: [RoundStatus.READY],
      RoundStatus.READY: [RoundStatus.SERVED],
  }
  ROUND_TRANSITION_ROLES = {
      (RoundStatus.PENDING, RoundStatus.CONFIRMED): [Roles.WAITER, Roles.MANAGER, Roles.ADMIN],
      (RoundStatus.CONFIRMED, RoundStatus.SUBMITTED): [Roles.MANAGER, Roles.ADMIN],
      # ...
  }
  ```
- **Archivos:**
  - `backend/shared/config/constants.py` -- `ROUND_TRANSITIONS`, `ROUND_TRANSITION_ROLES`, `validate_round_transition()`
  - `backend/rest_api/services/domain/round_service.py` -- uso de validacion
  - `backend/rest_api/routers/kitchen/rounds.py` -- corregido para usar `validate_round_transition()` (antes tenia FSM duplicado inline)
- **Por que no se documento:** Las constantes existian en `constants.py` pero el patron no se reconocio formalmente. La funcion `validate_round_transition()` se creo como correccion posterior.
- **Recomendacion:** Patron critico para la integridad del flujo de pedidos. Documentar con diagrama de estados.

### Idempotent Payments

- **Planificacion original:** UUID como `idempotency_key` para evitar cobros duplicados por reintentos.
- **Implementacion real:** Multiples capas de proteccion:
  1. `idempotency_key` con constraint UNIQUE en tabla de pagos
  2. Deduplicacion a nivel de servicio (verifica existencia antes de procesar)
  3. `SELECT FOR UPDATE` para prevenir race conditions entre requests concurrentes
- **Archivos:**
  - `backend/rest_api/models/billing.py` -- campo `idempotency_key` con unique constraint
  - `backend/rest_api/services/domain/billing_service.py` -- logica de deduplicacion y lock
  - `backend/rest_api/routers/billing/` -- endpoints protegidos con rate limiting
- **Por que no se documento:** Se implemento como parte de la logica de billing sin reconocerlo como patron de diseno independiente. La combinacion de unique constraint + deduplicacion + SELECT FOR UPDATE es mas sofisticada que lo planificado.
- **Recomendacion:** Documentar las tres capas de proteccion como ejemplo de defense-in-depth.

### Webhook / IPN (MercadoPago)

- **Planificacion original:** MercadoPago notifica de forma asincrona el resultado del pago. Evita polling constante.
- **Implementacion real:** Endpoint webhook con verificacion de firma HMAC, retry queue y circuit breaker:
  1. `POST /api/mercadopago/webhook` -- recibe notificaciones
  2. Verificacion de firma HMAC del header de MercadoPago
  3. Retry queue para reintentos en caso de fallo de procesamiento
  4. Circuit breaker para proteger contra cascadas de fallo
- **Archivos:**
  - `backend/rest_api/routers/billing/mercadopago.py` -- endpoint webhook
  - `backend/rest_api/services/domain/billing_service.py` -- procesamiento de notificacion
- **Por que no se documento:** Se considero integracion de terceros, no patron de diseno. Sin embargo, la combinacion de HMAC + retry + circuit breaker es un patron arquitectonico significativo.
- **Recomendacion:** Documentar como patron compuesto de integracion con servicios externos.

---

## Patron No Implementado

### Feature-Sliced Design

- **Planificacion original:** Organizacion por features con limites de importacion claros. Cada feature es autocontenida.
- **Estado actual:** Los tres frontends usan organizacion por tipo (type-based), no por feature:
  ```
  src/
    components/    # Todos los componentes
    hooks/         # Todos los hooks
    stores/        # Todos los stores
    services/      # Todos los servicios
    utils/         # Todas las utilidades
    pages/         # Todas las paginas
  ```
- **Como se veria implementado:**
  ```
  src/
    features/
      cart/
        components/   CartItem.tsx, CartSummary.tsx
        hooks/        useCart.ts, useOptimisticCart.ts
        stores/       cartStore.ts
        api/          cartApi.ts
        index.ts      # Public API de la feature
      menu/
        components/   ProductCard.tsx, CategoryList.tsx
        hooks/        useMenu.ts
        stores/       menuStore.ts
        api/          menuApi.ts
        index.ts
      session/
        ...
    shared/           # Utilidades compartidas entre features
  ```
- **Por que no se implemento:**
  1. **Tamano del proyecto:** Cada frontend tiene 15-30 componentes. La organizacion por tipo es suficiente y mas simple de navegar a esta escala.
  2. **Costo de migracion:** Reorganizar los imports de los 3 frontends seria un esfuerzo considerable sin beneficio inmediato.
  3. **Convencion del equipo:** La estructura actual es familiar y funciona bien con los patrones de Zustand stores centralizados.
- **Recomendacion:** Si alguna de las aplicaciones crece significativamente (50+ componentes), **pwaMenu es la candidata mas natural** para adoptar Feature-Sliced Design por tener los dominios mas claros (menu, carrito, sesion, pedidos, cliente). Dashboard tambien se beneficiaria eventualmente por la diversidad de features CRUD.

---

## Patrones Emergentes (No Planificados pero Implementados)

Ademas de los 12 patrones planificados, el proyecto implemento **45 patrones adicionales** que emergieron durante el desarrollo. Estos estan completamente documentados en [`UsadoPatrones.md`](../UsadoPatrones.md) e incluyen:

- **Backend:** Template Method, Specification, Mixin, Transactional Outbox, Middleware Chain, Exception Hierarchy, Singleton, Connection Pool (8 adicionales)
- **WebSocket Gateway:** 11 patrones completos (Strategy Auth, Circuit Breaker, Rate Limiter, Sharded Locks, etc.)
- **Frontend:** 34 patrones de estado, hooks, comunicacion, seguridad, offline y rendimiento

Esto demuestra que la planificacion inicial cubrio los patrones de dominio criticos, pero la implementacion requirio una cantidad significativa de patrones de infraestructura, resiliencia y rendimiento que no fueron anticipados.
