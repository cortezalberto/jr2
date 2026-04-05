# 13. Componentes Clave del Sistema

Este documento detalla los componentes más importantes del sistema, explicando su propósito, responsabilidades, patrones utilizados y dependencias.

---

## Componentes del Backend

### 1. PermissionContext

**Ubicación:** `rest_api/services/permissions.py`

**Propósito:** Centralizar la verificación de permisos en una única abstracción reutilizable.

**Patrón:** Strategy Pattern - encapsula la lógica de autorización según el rol del usuario.

**Responsabilidades:**
- Extraer contexto del usuario desde claims JWT (`sub`, `tenant_id`, `branch_ids`, `roles`)
- Verificar roles requeridos para cada operación
- Validar acceso a sucursales específicas
- Lanzar excepciones estandarizadas cuando se viola un permiso

**Métodos principales:**

| Método | Descripción | Excepción si falla |
|--------|-------------|-------------------|
| `require_management()` | Exige rol ADMIN o MANAGER | `ForbiddenError` |
| `require_branch_access(branch_id)` | Verifica que el usuario tiene acceso a esa sucursal | `ForbiddenError` |
| `require_role(role)` | Exige un rol específico | `ForbiddenError` |
| `require_any_role(roles)` | Exige al menos uno de los roles listados | `ForbiddenError` |

**Uso típico:**
```python
@router.post("/categories")
def create_category(data: CategoryInput, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    ctx = PermissionContext(user)
    ctx.require_management()  # Solo ADMIN o MANAGER
    ctx.require_branch_access(data.branch_id)  # Debe tener acceso a la sucursal
    service = CategoryService(db)
    return service.create(data.dict(), ctx.tenant_id)
```

**Dependencias:** `shared/security/auth.py` (JWT claims), `shared/utils/exceptions.py`

---

### 2. Domain Services

**Ubicación:** `rest_api/services/domain/`

**Propósito:** Contener TODA la lógica de negocio del sistema, manteniendo los routers delgados.

**Patrón:** Template Method - las clases base definen el flujo, las subclases implementan hooks específicos.

**Clases base:**

#### BaseCRUDService[Model, Output]

Provee operaciones CRUD genéricas con validación y hooks:

```python
class BaseCRUDService(Generic[Model, Output]):
    def create(self, data: dict, tenant_id: int) -> Output
    def update(self, entity_id: int, data: dict, tenant_id: int) -> Output
    def delete(self, entity_id: int, tenant_id: int, user_id: int, user_email: str) -> dict
    def get_by_id(self, entity_id: int, tenant_id: int) -> Output
    def list_all(self, tenant_id: int, limit: int = 50, offset: int = 0) -> list[Output]

    # Hooks para override
    def _validate_create(self, data: dict, tenant_id: int) -> None: ...
    def _validate_update(self, data: dict, entity: Model, tenant_id: int) -> None: ...
    def _after_create(self, entity: Model, user_id: int, user_email: str) -> None: ...
    def _after_update(self, entity: Model, user_id: int, user_email: str) -> None: ...
    def _after_delete(self, entity_info: dict, user_id: int, user_email: str) -> None: ...
```

#### BranchScopedService[Model, Output]

Extiende BaseCRUD con filtrado automático por sucursal:

```python
class BranchScopedService(BaseCRUDService[Model, Output]):
    def list_by_branch(self, tenant_id: int, branch_id: int, ...) -> list[Output]
    def get_by_branch(self, entity_id: int, tenant_id: int, branch_id: int) -> Output
```

**Ejemplo de creación de un nuevo servicio:**

```python
# rest_api/services/domain/my_entity_service.py
from rest_api.services.base_service import BranchScopedService

class MyEntityService(BranchScopedService[MyEntity, MyEntityOutput]):
    def __init__(self, db: Session):
        super().__init__(
            db=db,
            model=MyEntity,
            output_schema=MyEntityOutput,
            entity_name="Mi Entidad"
        )

    def _validate_create(self, data: dict, tenant_id: int) -> None:
        # Validaciones de negocio específicas
        if not data.get("name"):
            raise ValidationError("El nombre es obligatorio")

    def _after_delete(self, entity_info: dict, user_id: int, user_email: str) -> None:
        # Acciones post-eliminación (ej: emitir evento WS)
        pass
```

**Servicios disponibles (14+):**

| Servicio | Modelo principal | Base | Responsabilidades clave |
|----------|-----------------|------|------------------------|
| `CategoryService` | Category | BranchScoped | CRUD categorías, validar unicidad por sucursal |
| `SubcategoryService` | Subcategory | BranchScoped | CRUD subcategorías, validar categoría padre |
| `BranchService` | Branch | BaseCRUD | CRUD sucursales, generar slugs únicos |
| `SectorService` | BranchSector | BranchScoped | CRUD sectores, validar sin mesas huérfanas |
| `TableService` | Table | BranchScoped | CRUD mesas, generación de códigos, creación masiva |
| `ProductService` | Product | BranchScoped | CRUD productos, precios en centavos, imágenes |
| `AllergenService` | Allergen | BaseCRUD | CRUD alérgenos, reacciones cruzadas |
| `StaffService` | User | BaseCRUD | Gestión de personal, asignación de roles por sucursal |
| `PromotionService` | Promotion | BranchScoped | CRUD promociones, vigencia, descuentos |
| `RoundService` | Round | Específico | Ciclo de vida de rondas, validación de transiciones |
| `BillingService` | Check | Específico | Facturación, cargos, pagos, FIFO allocation |
| `DinerService` | Diner | Específico | Registro de comensales, tracking por dispositivo |
| `ServiceCallService` | ServiceCall | BranchScoped | Llamadas mozo, ACK, cierre |
| `TicketService` | KitchenTicket | Específico | Tickets de cocina, agrupación por producto |

---

### 3. Outbox Service

**Ubicación:** `rest_api/services/events/outbox_service.py`

**Propósito:** Garantizar la entrega de eventos críticos (financieros, operativos) mediante el patrón Transactional Outbox.

**Patrón:** Transactional Outbox - el evento se persiste en la misma transacción que los datos de negocio, y un procesador asíncrono lo publica después.

**Por qué existe:** En un sistema distribuido, publicar directamente a Redis después de un commit puede fallar (crash entre commit y publish), perdiendo el evento. Con outbox, la atomicidad está garantizada por la transacción de BD.

**Función principal:**

```python
write_billing_outbox_event(
    db=db,
    tenant_id=tenant_id,
    event_type="CHECK_REQUESTED",
    payload={...},
    branch_id=branch_id
)
db.commit()  # Evento + datos de negocio en UNA transacción
```

**Flujo completo:**

1. El Domain Service llama a `write_billing_outbox_event()`
2. Se inserta un registro en la tabla `outbox_events` con status `PENDING`
3. `db.commit()` persiste datos + evento atómicamente
4. Un procesador background lee eventos PENDING
5. Publica a Redis Pub/Sub
6. Marca el evento como `PUBLISHED`
7. El WS Gateway recibe y distribuye

**Eventos que usan outbox:**
- `CHECK_REQUESTED`, `CHECK_PAID`
- `PAYMENT_APPROVED`, `PAYMENT_REJECTED`
- `ROUND_SUBMITTED`, `ROUND_READY`
- `SERVICE_CALL_CREATED`

---

### 4. Safe Commit

**Ubicación:** `shared/infrastructure/db.py`

**Propósito:** Prevenir pérdida silenciosa de datos por transacciones no comiteadas.

```python
def safe_commit(db: Session) -> None:
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
```

**Por qué es importante:** Sin `safe_commit`, una excepción durante `db.commit()` puede dejar la sesión en estado inconsistente. El rollback automático garantiza que la conexión vuelve a un estado limpio.

---

### 5. Cascade Soft Delete

**Ubicación:** `rest_api/services/crud/soft_delete.py`

**Propósito:** Implementar eliminación lógica en cascada, manteniendo integridad referencial sin borrar datos.

**Convención del sistema:** Todas las entidades usan soft delete (`is_active = False`). Hard delete solo para registros efímeros (items de carrito, sesiones expiradas).

```python
affected = cascade_soft_delete(db, product, user_id, user_email)
# affected = {"Product": 1, "BranchProduct": 3, "ProductAllergen": 2}
```

**Comportamiento:**
1. Marca la entidad principal como `is_active = False`
2. Busca todas las entidades dependientes (relaciones definidas en el modelo)
3. Las marca como `is_active = False` recursivamente
4. Registra quién y cuándo realizó la eliminación
5. Retorna un diccionario con conteos de entidades afectadas
6. Emite evento `CASCADE_DELETE` vía WebSocket para que los clientes actualicen su UI

**Advertencia:** Las queries raw (sin usar Repository) DEBEN incluir `.where(Model.is_active.is_(True))` manualmente. Los repositories lo hacen automáticamente.

---

## Componentes del WebSocket Gateway

### 6. ConnectionManager (Fachada)

**Ubicación:** `ws_gateway/connection_manager.py`

**Propósito:** Orquestar la gestión de conexiones WebSocket como una fachada que compone módulos especializados.

**Patrón:** Facade + Composition - delega a 5 módulos internos en lugar de implementar todo en una clase monolítica.

**Módulos compuestos:**

| Módulo | Clase | Responsabilidad |
|--------|-------|-----------------|
| Lifecycle | `ConnectionLifecycle` | Accept/disconnect con lock ordering para prevenir deadlocks |
| Broadcaster | `ConnectionBroadcaster` | Worker pool de 10 workers para broadcast eficiente |
| Cleanup | `ConnectionCleanup` | Limpieza periódica de conexiones stale (60s), muertas y locks |
| Index | `ConnectionIndex` | Índices multidimensionales: por usuario, sucursal, sector, sesión |
| Stats | `ConnectionStats` | Agregación de métricas (conexiones activas, mensajes/seg, latencia) |

**Límites de conexión:**
- 3 conexiones máximo por usuario (multi-tab)
- 1000 conexiones totales por instancia del gateway
- Exceder el límite retorna close code 4029

---

### 7. ConnectionBroadcaster

**Ubicación:** `ws_gateway/core/connection/broadcaster.py`

**Propósito:** Enviar mensajes eficientemente a múltiples conexiones WebSocket en paralelo.

**Patrón:** Worker Pool con fallback a batch processing.

**Modo principal - Worker Pool:**
- 10 workers paralelos procesan una cola de 5000 mensajes
- Cada worker toma un mensaje y lo envía a la conexión destino
- Performance: 400 usuarios en aproximadamente 160ms

**Modo fallback - Batch Processing:**
- Se activa si el worker pool falla o se satura
- Agrupa conexiones en lotes de 50
- Usa `asyncio.gather()` para envío paralelo dentro del lote

**Manejo de errores:**
- Conexiones que fallan al recibir se marcan para limpieza
- No bloquea el broadcast de otros usuarios
- Métricas de mensajes enviados, fallidos y descartados

---

### 8. EventRouter

**Ubicación:** `ws_gateway/components/events/router.py`

**Propósito:** Determinar qué conexiones deben recibir cada evento basándose en el tipo de evento y el rol del usuario.

**Categorías de eventos:**

| Categoría | Destino | Eventos |
|-----------|---------|---------|
| `KITCHEN_EVENTS` | Solo conexiones `/ws/kitchen` | ROUND_SUBMITTED, ROUND_IN_KITCHEN, ROUND_READY |
| `SESSION_EVENTS` | Comensales de la sesión específica | CART_*, ROUND_IN_KITCHEN+, CHECK_* |
| `ADMIN_ONLY_EVENTS` | Solo conexiones `/ws/admin` | ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED |
| `BRANCH_WIDE_WAITER_EVENTS` | Todos los mozos de la sucursal | ROUND_PENDING, TABLE_SESSION_STARTED |
| `SECTOR_EVENTS` | Mozos del sector específico | SERVICE_CALL_CREATED, TABLE_STATUS_CHANGED |

**Filtrado por sector:**
- Eventos con `sector_id` se envían solo a mozos asignados a ese sector
- ADMIN y MANAGER siempre reciben todos los eventos de su sucursal, independientemente del sector

**Tabla de routing de rondas:**

| Evento | Admin | Cocina | Mozos | Comensales |
|--------|-------|--------|-------|------------|
| `ROUND_PENDING` | Si | No | Si (toda la sucursal) | No |
| `ROUND_CONFIRMED` | Si | No | Si | No |
| `ROUND_SUBMITTED` | Si | Si | Si | No |
| `ROUND_IN_KITCHEN` | Si | Si | Si | Si |
| `ROUND_READY` | Si | Si | Si | Si |
| `ROUND_SERVED` | Si | Si | Si | Si |
| `ROUND_CANCELED` | Si | Si | Si | Si |

---

### 9. CircuitBreaker

**Ubicación:** `ws_gateway/components/resilience/circuit_breaker.py`

**Propósito:** Proteger el sistema contra fallos en cascada cuando Redis deja de responder.

**Patrón:** Circuit Breaker con tres estados.

**Estados y transiciones:**

```
CLOSED (normal)
  │ 5 fallos consecutivos
  ▼
OPEN (rechaza operaciones)
  │ 30 segundos
  ▼
HALF_OPEN (prueba con 1 operación)
  │ éxito → CLOSED
  │ fallo → OPEN
```

**Implementación:**
- Thread-safe mediante `threading.Lock`
- Configurable: umbral de fallos, timeout de recuperación
- Métricas: total de rechazos, transiciones de estado

**Uso:**
```python
breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=30)

async def redis_operation():
    if not breaker.can_execute():
        return None  # Circuito abierto, no intentar
    try:
        result = await redis.get(key)
        breaker.record_success()
        return result
    except Exception:
        breaker.record_failure()
        raise
```

---

### 10. Auth Strategies

**Ubicación:** `ws_gateway/components/auth/strategies.py`

**Propósito:** Autenticar conexiones WebSocket de manera flexible según el tipo de cliente.

**Patrón:** Strategy Pattern - diferentes estrategias de autenticación intercambiables.

| Estrategia | Cliente | Token | Revalidación |
|------------|---------|-------|--------------|
| `JWTAuthStrategy` | Dashboard, pwaWaiter, Kitchen | JWT en query param | Cada 5 minutos |
| `TableTokenAuthStrategy` | pwaMenu (comensales) | HMAC table token en query param | Cada 30 minutos |
| `CompositeAuthStrategy` | Endpoints mixtos | Intenta JWT, luego TableToken | Según tipo detectado |
| `NullAuthStrategy` | Testing | Ninguno | Sin validación |

**Flujo de autenticación WebSocket:**
1. Cliente conecta a `/ws/{role}?token=xxx`
2. El handler selecciona la estrategia según el endpoint
3. La estrategia valida el token y extrae claims
4. Si es válido, se crea la conexión
5. Periódicamente se revalida el token (en background)
6. Si la revalidación falla, se cierra con código 4001

---

## Componentes Frontend

### 11. Zustand Stores

**Ubicación:** `*/src/stores/` en cada frontend

**Propósito:** Gestionar el estado global de cada aplicación de forma predecible y eficiente.

**Patrón obligatorio - Selectores:**

```typescript
// CORRECTO: Selector individual
const items = useStore(selectItems)
const addItem = useStore((s) => s.addItem)

// CORRECTO: Referencia estable para arrays vacíos
const EMPTY_ARRAY: number[] = []
export const selectBranchIds = (s: State) =>
  s.user?.branch_ids ?? EMPTY_ARRAY

// CORRECTO: useShallow para arrays filtrados
import { useShallow } from 'zustand/react/shallow'
const activeItems = useStore(
  useShallow(state => state.items.filter(i => i.active))
)

// INCORRECTO: Destructurar (causa loops infinitos)
// const { items, addItem } = useStore()
```

**Por qué NO destructurar:** Zustand retorna un nuevo objeto en cada render si se lee el store completo. Al destructurar, React detecta "nuevo objeto" en cada render, causando un loop infinito de re-renders.

**Stores por aplicación:**

| App | Stores principales | Total |
|-----|-------------------|-------|
| Dashboard | authStore, branchStore, categoryStore, productStore, tableStore, staffStore, orderStore, billingStore | 16+ |
| pwaMenu | tableStore (modular), menuStore, serviceCallStore | 3 |
| pwaWaiter | authStore, tablesStore, retryQueueStore | 3 |

---

### 12. useFormModal Hook

**Ubicación:** `Dashboard/src/hooks/useFormModal.ts`

**Propósito:** Unificar el estado de modal + formulario en un solo hook reutilizable, eliminando código repetitivo en páginas CRUD.

**Problema que resuelve:**

Antes, cada página CRUD necesitaba 3+ useState separados:
```typescript
// ANTES: Repetitivo en cada página
const [isModalOpen, setIsModalOpen] = useState(false)
const [editingItem, setEditingItem] = useState(null)
const [formData, setFormData] = useState({})
```

**Solución:**
```typescript
// DESPUÉS: Un solo hook
const { isOpen, editingItem, formData, openCreate, openEdit, close, setField } = useFormModal()

// Abrir para crear
<Button onClick={openCreate}>Nuevo</Button>

// Abrir para editar
<Button onClick={() => openEdit(item)}>Editar</Button>
```

**Beneficios:**
- Elimina duplicación en las 24 páginas del Dashboard
- Manejo consistente de estado open/close/editing
- Resetea formData automáticamente al cerrar

---

### 13. WebSocket Services

**Ubicación:** `*/src/services/websocket.ts` en cada frontend

**Propósito:** Gestionar conexiones WebSocket con reconexión automática, heartbeat y manejo de eventos.

**Implementación:** Singleton por aplicación (una instancia global).

| App | Instancia | Endpoint |
|-----|-----------|----------|
| Dashboard | `dashboardWS` | `/ws/admin?token=JWT` |
| pwaMenu | `dinerWS` | `/ws/diner?table_token=TOKEN` |
| pwaWaiter | `wsService` | `/ws/waiter?token=JWT` |

**Reconexión automática:**
- Backoff exponencial: 1s → 2s → 4s → 8s → 16s → 30s (máximo)
- Jitter: variación aleatoria de +/-30% para evitar thundering herd
- Máximo 50 intentos antes de desistir
- Códigos no recuperables (NO reconecta): 4001 (auth failed), 4003 (forbidden), 4029 (rate limited)

**Heartbeat:**
- Cliente envía `{"type":"ping"}` cada 30 segundos
- Servidor responde `{"type":"pong"}`
- Si no hay pong en 10 segundos, se considera la conexión muerta
- Se inicia reconexión automática

**Patrón de suscripción (useRef para evitar acumulación):**

```typescript
// CORRECTO: Suscribirse una vez con ref
const handleEventRef = useRef(handleEvent)
useEffect(() => { handleEventRef.current = handleEvent })
useEffect(() => {
  const unsubscribe = ws.on('*', (e) => handleEventRef.current(e))
  return unsubscribe
}, [])  // Deps vacías - suscribirse UNA vez

// INCORRECTO: Sin ref (acumula listeners en cada re-render)
// useEffect(() => { ws.on('*', handleEvent) }, [handleEvent])
```

---

### 14. API Layer

**Ubicación:** `*/src/services/api.ts` en cada frontend

**Propósito:** Cliente HTTP centralizado con manejo de autenticación, reintentos y errores.

**Función principal: `fetchAPI<T>`**

```typescript
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit,
  retryOn401?: boolean  // default: true
): Promise<T>
```

**Características:**
- Timeout configurable (default 30s)
- `credentials: 'include'` para enviar cookies HttpOnly (refresh token)
- Auto-retry en 401: refresca el token y reintenta la request original
- Headers automáticos: `Content-Type: application/json`, `Authorization: Bearer {token}`

**Prevención de loop infinito en logout:**

```typescript
// CRITICO: logout DEBE deshabilitar retry en 401
authAPI.logout = () => fetchAPI('/auth/logout', { method: 'POST' }, false)
//                                                                    ^^^^^
// Sin esto: token expirado → 401 → onTokenExpired → logout() → 401 → loop infinito
```

**Request deduplication (solo pwaMenu):**

```typescript
// Previene requests duplicadas al mismo endpoint
const pendingRequests = new Map<string, Promise<any>>()

async function deduplicatedFetch<T>(endpoint: string): Promise<T> {
  if (pendingRequests.has(endpoint)) {
    return pendingRequests.get(endpoint)!
  }
  const promise = fetchAPI<T>(endpoint)
  pendingRequests.set(endpoint, promise)
  promise.finally(() => pendingRequests.delete(endpoint))
  return promise
}
```

**Clases de error:**
- `ApiError`: Error genérico de API (status, message, details)
- `AuthError`: Error de autenticación (401, 403)
- `ValidationError`: Error de validación del servidor (422)

---

### 15. Table Store (pwaMenu)

**Ubicación:** `pwaMenu/src/stores/tableStore/`

**Propósito:** Gestionar todo el estado de la sesión de mesa del comensal: sesión, carrito, rondas, pagos.

**Arquitectura modular:**

| Archivo | Contenido |
|---------|-----------|
| `store.ts` | Definición principal del store con 75+ acciones/getters |
| `types.ts` | Interfaces TypeScript (Session, Diner, CartItem, Round, etc.) |
| `selectors.ts` | Selectores optimizados para cada vista |
| `helpers.ts` | Funciones puras auxiliares (cálculos, transformaciones) |

**Responsabilidades:**
- Gestión de sesión de mesa (join, leave, status)
- Carrito compartido (add, update, remove items)
- Sincronización multi-dispositivo vía WebSocket (CART_ITEM_ADDED, etc.)
- Rondas de pedidos (submit, track status)
- Pagos del comensal (request check, payment status)
- Persistencia en localStorage con TTL de 8 horas

**Sincronización multi-tab:**
- Escucha eventos `storage` del navegador
- Cuando otra tab modifica el store, se sincroniza automáticamente
- Previene conflictos de estado entre tabs del mismo comensal

**Cache con expiración:**
```typescript
// Los datos se cachean en localStorage con TTL de 8 horas
// Al cargar, se verifica la expiración y se limpian datos stale
const CACHE_TTL_MS = 8 * 60 * 60 * 1000 // 8 horas

function isExpired(timestamp: number): boolean {
  return Date.now() - timestamp > CACHE_TTL_MS
}
```

---

## Diagrama de Dependencias entre Componentes

```
                    ┌─────────────────┐
                    │  PermissionCtx  │
                    └────────┬────────┘
                             │ usa
                    ┌────────▼────────┐
                    │ Domain Services │
                    └───┬────────┬────┘
                        │        │
              ┌─────────▼─┐  ┌──▼──────────┐
              │ Repository │  │ OutboxService│
              └─────┬──────┘  └──────┬───────┘
                    │                │
              ┌─────▼──────┐  ┌──────▼───────┐
              │ SQLAlchemy  │  │ Redis PubSub │
              │  Models     │  └──────┬───────┘
              └─────┬──────┘         │
                    │          ┌─────▼──────────┐
              ┌─────▼──────┐  │  WS Gateway    │
              │ PostgreSQL  │  │  EventRouter   │
              └────────────┘  │  Broadcaster   │
                              │  Auth Strategy │
                              └───────┬────────┘
                                      │
                              ┌───────▼────────┐
                              │ Frontend Stores│
                              │ WS Services    │
                              │ API Layer      │
                              └────────────────┘
```
