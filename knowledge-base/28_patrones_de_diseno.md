# 28. Patrones de Diseno -- Resumen de Referencia Rapida

> Resumen de los **57 patrones de diseno** encontrados en el proyecto Integrador / Buen Sabor.
> Para documentacion completa con codigo, proposito y ejemplos de uso, ver [`UsadoPatrones.md`](../UsadoPatrones.md).
>
> Ultima actualizacion: 2026-04-04

---

## Backend (12 patrones)

| # | Patron | Tipo GoF/Moderno | Componente | Archivo(s) Clave |
|---|--------|------------------|------------|-------------------|
| 1 | Template Method | Comportamiento (GoF) | REST API | `rest_api/services/base_service.py` |
| 2 | Repository | Datos (DDD) | REST API | `rest_api/services/crud/repository.py` |
| 3 | Specification | Datos (DDD) | REST API | `rest_api/services/crud/repository.py` (lineas 434-620) |
| 4 | Strategy (Permisos) | Comportamiento (GoF) | REST API | `rest_api/services/permissions/strategies.py` |
| 5 | Mixin (AuditMixin) | Estructural (Python) | REST API | `rest_api/services/permissions/strategies.py` (lineas 117-157) |
| 6 | Soft Delete | Datos (Dominio) | REST API | `rest_api/models/base.py`, `rest_api/services/crud/soft_delete.py` |
| 7 | Transactional Outbox | Datos/Mensajeria | REST API | `rest_api/services/events/outbox_service.py` |
| 8 | Dependency Injection | Arquitectonico | REST API | `shared/infrastructure/db.py` |
| 9 | Middleware Chain | Comportamiento (GoF) | REST API | `rest_api/main.py`, `rest_api/core/middlewares.py` |
| 10 | Exception Hierarchy | Comportamiento | Shared | `shared/utils/exceptions.py` |
| 11 | Singleton (Settings) | Creacional (GoF) | Shared | `shared/config/settings.py` |
| 23 | Connection Pool | Recursos | Shared | `shared/infrastructure/db.py` |

---

## WebSocket Gateway (11 patrones)

| # | Patron | Tipo GoF/Moderno | Componente | Archivo(s) Clave |
|---|--------|------------------|------------|-------------------|
| 12 | Strategy (Auth) | Comportamiento (GoF) | ws_gateway | `ws_gateway/components/auth/strategies.py` |
| 13 | Circuit Breaker | Resiliencia | ws_gateway | `ws_gateway/components/resilience/circuit_breaker.py` |
| 14 | Sliding Window Rate Limiter | Concurrencia | ws_gateway | `ws_gateway/components/connection/rate_limiter.py` |
| 15 | Multi-Dimensional Index | Estructura de Datos | ws_gateway | `ws_gateway/components/connection/index.py` |
| 16 | Sharded Locks | Concurrencia | ws_gateway | `ws_gateway/components/connection/locks.py` |
| 17 | Heartbeat Tracker | Monitoreo | ws_gateway | `ws_gateway/components/connection/heartbeat.py` |
| 18 | Template Method (Endpoints) | Comportamiento (GoF) | ws_gateway | `ws_gateway/components/endpoints/base.py` |
| 19 | Event Router | Comunicacion | ws_gateway | `ws_gateway/components/events/router.py` |
| 20 | Worker Pool | Concurrencia | ws_gateway | `ws_gateway/core/connection/broadcaster.py` |
| 21 | Drop Rate Tracker | Monitoreo | ws_gateway | `ws_gateway/core/subscriber/drop_tracker.py` |
| 22 | Retry with Exponential Backoff | Resiliencia | ws_gateway | `ws_gateway/components/resilience/retry.py` |

---

## Frontend -- Dashboard + pwaMenu + pwaWaiter (34 patrones)

### Estado (5)

| # | Patron | Tipo | Componente | Archivo(s) Clave |
|---|--------|------|------------|-------------------|
| F1 | Zustand Selectors + EMPTY_ARRAY | Estado / Rendimiento | Todos | `Dashboard/src/stores/authStore.ts`, `pwaMenu/src/stores/tableStore/selectors.ts` |
| F2 | Zustand Persist + Migration | Estado / Persistencia | pwaMenu, pwaWaiter | `pwaMenu/src/stores/tableStore/persist.ts` |
| F3 | useShallow | Estado / Rendimiento | Todos | Selectores con arrays filtrados |
| F4 | useMemo Derived State | Estado / Rendimiento | Todos | Componentes con estado derivado |
| F5 | BroadcastChannel | Estado / Sincronizacion | Dashboard | `Dashboard/src/stores/authStore.ts` |

### Hooks Personalizados (8)

| # | Patron | Tipo | Componente | Archivo(s) Clave |
|---|--------|------|------------|-------------------|
| F6 | useFormModal | Hooks / UI | Dashboard | `Dashboard/src/hooks/useFormModal.ts` |
| F7 | useConfirmDialog | Hooks / UI | Dashboard | `Dashboard/src/hooks/useConfirmDialog.ts` |
| F8 | usePagination | Hooks / Datos | Dashboard | `Dashboard/src/hooks/usePagination.ts` |
| F9 | useOptimisticMutation | Hooks / Datos | Dashboard | `Dashboard/src/hooks/useOptimisticMutation.ts` |
| F10 | useFocusTrap | Hooks / Accesibilidad | Dashboard | `Dashboard/src/hooks/useFocusTrap.ts` |
| F11 | useKeyboardShortcuts | Hooks / Accesibilidad | Dashboard | `Dashboard/src/hooks/useKeyboardShortcuts.ts` |
| F12 | useOptimisticCart (React 19) | Hooks / React 19 | pwaMenu | `pwaMenu/src/hooks/useOptimisticCart.ts` |
| F13 | useSystemTheme | Hooks / UI | pwaMenu | `pwaMenu/src/hooks/useSystemTheme.ts` |

### Comunicacion (8)

| # | Patron | Tipo | Componente | Archivo(s) Clave |
|---|--------|------|------------|-------------------|
| F14 | Token Refresh Mutex | Seguridad / Comunicacion | Dashboard, pwaWaiter | `Dashboard/src/services/api.ts` |
| F15 | 401 Retry | Comunicacion / Resiliencia | Dashboard, pwaWaiter | `Dashboard/src/services/api.ts` |
| F16 | AbortController Timeout | Comunicacion | Todos | `*/src/services/api.ts` |
| F17 | Request Deduplication | Comunicacion / Rendimiento | Dashboard | `Dashboard/src/services/api.ts` |
| F18 | SSRF Prevention | Seguridad | Backend + Frontend | `shared/utils/validators.py` |
| F19 | WebSocket Singleton + Reconnect | Comunicacion | pwaMenu, pwaWaiter | `pwaMenu/src/services/websocket.ts`, `pwaWaiter/src/services/websocket.ts` |
| F20 | Observer (Event Subscription) | Comunicacion | pwaMenu, pwaWaiter | `*/src/services/websocket.ts` |
| F30 | Proactive Token Refresh | Seguridad | Dashboard, pwaWaiter | `Dashboard/src/services/api.ts` |

### Seguridad (2)

| # | Patron | Tipo | Componente | Archivo(s) Clave |
|---|--------|------|------------|-------------------|
| F31 | HttpOnly Cookie | Seguridad | Dashboard, pwaWaiter | `Dashboard/src/services/api.ts` (credentials: 'include') |
| F21 | Throttle | Rendimiento / Seguridad | pwaMenu, pwaWaiter | `*/src/services/websocket.ts` |

### Offline / PWA (2)

| # | Patron | Tipo | Componente | Archivo(s) Clave |
|---|--------|------|------------|-------------------|
| F22 | Retry Queue (pwaWaiter) | Offline / Resiliencia | pwaWaiter | `pwaWaiter/src/services/retryQueue.ts` |
| F23 | IndexedDB Queue (pwaMenu) | Offline / Persistencia | pwaMenu | `pwaMenu/src/services/offlineQueue.ts` |

### Componentes y Formularios (5)

| # | Patron | Tipo | Componente | Archivo(s) Clave |
|---|--------|------|------------|-------------------|
| F24 | useActionState (React 19) | Formularios / React 19 | pwaMenu | `pwaMenu/src/hooks/useActionState.ts` |
| F25 | Centralized Validation | Validacion | Todos | `*/src/utils/validation.ts` |
| F26 | i18n Validation Keys | i18n / Validacion | pwaMenu | `pwaMenu/src/utils/validation.ts` |
| F29 | i18n Fallback Chain | i18n | pwaMenu | `pwaMenu/src/i18n/` |
| F32 | Type Conversion Layer | Datos | Todos | `*/src/utils/typeConversion.ts` o inline en stores |

### Error Handling (2)

| # | Patron | Tipo | Componente | Archivo(s) Clave |
|---|--------|------|------------|-------------------|
| F27 | Structured Logger | Logging | Todos | `*/src/utils/logger.ts` |
| F28 | Unified Error Classes | Errores / i18n | pwaMenu | `pwaMenu/src/utils/errors.ts` |

### Rendimiento (2)

| # | Patron | Tipo | Componente | Archivo(s) Clave |
|---|--------|------|------------|-------------------|
| F33 | Bounded Maps Cleanup | Rendimiento / Memoria | pwaWaiter | `pwaWaiter/src/services/websocket.ts` |
| F34 | Empty Set Cleanup | Rendimiento / Memoria | ws_gateway + Frontend | `ws_gateway/components/connection/index.py`, WebSocket observers |

---

## Resumen Estadistico

| Capa | Cantidad | Categorias Principales |
|------|----------|------------------------|
| Backend (REST API + Shared) | 12 | Datos, Comportamiento, Arquitectonico |
| WebSocket Gateway | 11 | Resiliencia, Concurrencia, Comunicacion |
| Frontend (3 apps) | 34 | Estado, Hooks, Comunicacion, Seguridad, Offline |
| **Total** | **57** | |

> **Nota:** Todos los archivos referenciados usan rutas relativas desde `backend/` o la raiz del proyecto.
> Para detalles completos de implementacion, codigo y proposito de cada patron, consultar [`UsadoPatrones.md`](../UsadoPatrones.md).
