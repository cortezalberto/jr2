# 11. Arquitectura General del Sistema

## Visión de Alto Nivel

Integrador / Buen Sabor es un sistema distribuido compuesto por **4 aplicaciones frontend**, **2 servicios backend** y **2 bases de datos**. Todos los componentes se orquestan mediante Docker Compose para desarrollo y despliegue.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTES                              │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Dashboard   │   pwaMenu    │  pwaWaiter   │  Kitchen       │
│  :5177       │   :5176      │   :5178      │  Display       │
│  React 19    │   React 19   │   React 19   │  React 19      │
│  Zustand     │   Zustand    │   Zustand    │  Zustand       │
│  JWT Auth    │  TableToken  │   JWT Auth   │  JWT Auth      │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬─────────┘
       │ HTTP          │ HTTP          │ HTTP         │ HTTP
       │ WS            │ WS            │ WS           │ WS
┌──────┴───────────────┴───────────────┴─────────────┴────────┐
│                   SERVICIOS BACKEND                          │
├────────────────────────────┬────────────────────────────────┤
│   REST API (FastAPI)       │   WebSocket Gateway (FastAPI)  │
│   Puerto 8000              │   Puerto 8001                  │
│                            │                                │
│   Routers (delgados)       │   4 Endpoints:                 │
│   → Domain Services        │   /ws/waiter (JWT)             │
│   → Repositories           │   /ws/kitchen (JWT)            │
│   → Models                 │   /ws/admin (JWT)              │
│                            │   /ws/diner (TableToken)       │
│   Clean Architecture       │                                │
│   Sistema de Permisos      │   Composition Pattern          │
│   Rate Limiting            │   Strategy Auth                │
│   Outbox Pattern           │   Sharded Locks                │
│                            │   Worker Pool (10 workers)     │
│                            │   Circuit Breaker              │
└──────────┬─────────────────┴──────────┬─────────────────────┘
           │                            │
    ┌──────┴──────┐             ┌───────┴───────┐
    │ PostgreSQL  │             │    Redis 7    │
    │ 16+pgvector │             │   Puerto 6380 │
    │ Puerto 5432 │             │               │
    │             │             │  Pub/Sub      │
    │  18 modelos │             │  Blacklist    │
    │  Tabla Outbox│            │  Rate limits  │
    │  Audit log  │             │  Sesión cache │
    └─────────────┘             │  Cola eventos │
                                └───────────────┘
```

---

## Capas de Arquitectura (Backend)

El backend sigue los principios de **Clean Architecture**, separando responsabilidades en capas bien definidas:

```
ROUTERS (controladores HTTP delgados)
    → DOMAIN SERVICES (lógica de negocio en rest_api/services/domain/)
        → REPOSITORIES (acceso a datos via TenantRepository, BranchRepository)
            → MODELS (SQLAlchemy 2.0 en rest_api/models/)
```

### Principio Fundamental: Routers Delgados

Los routers **nunca** contienen lógica de negocio. Su responsabilidad se limita a:

1. Recibir la request HTTP
2. Extraer el contexto del usuario (JWT)
3. Delegar al Domain Service correspondiente
4. Retornar la respuesta

```python
# Ejemplo correcto: Router delgado
@router.get("/categories")
def list_categories(db: Session = Depends(get_db), user: dict = Depends(current_user)):
    ctx = PermissionContext(user)
    service = CategoryService(db)
    return service.list_by_branch(ctx.tenant_id, branch_id)
```

### Domain Services

Son el corazón de la lógica de negocio. Cada servicio encapsula las operaciones de un dominio específico.

**Servicios disponibles (14+):**

| Servicio | Dominio |
|----------|---------|
| `CategoryService` | Categorías del menú |
| `SubcategoryService` | Subcategorías |
| `BranchService` | Sucursales |
| `SectorService` | Sectores de salón |
| `TableService` | Mesas |
| `ProductService` | Productos/platos |
| `AllergenService` | Alérgenos |
| `StaffService` | Personal |
| `PromotionService` | Promociones |
| `RoundService` | Rondas de pedidos |
| `BillingService` | Facturación y pagos |
| `DinerService` | Comensales |
| `ServiceCallService` | Llamadas de servicio |
| `TicketService` | Tickets de cocina |

**Clases base:**

- `BaseCRUDService[Model, Output]`: CRUD genérico con validación y hooks
- `BranchScopedService[Model, Output]`: Extiende BaseCRUD con filtrado por sucursal

> **IMPORTANTE:** `CRUDFactory` está **DEPRECADO**. Toda funcionalidad nueva debe implementarse usando Domain Services.

### Repositories

Abstracción sobre SQLAlchemy que provee acceso a datos con filtrado automático:

- `TenantRepository`: Filtra automáticamente por `tenant_id` e `is_active`
- `BranchRepository`: Filtra por `branch_id`, `tenant_id` e `is_active`

---

## Módulo Compartido (backend/shared/)

El módulo `shared/` contiene código transversal utilizado tanto por la REST API como por el WebSocket Gateway:

| Submódulo | Contenido | Responsabilidad |
|-----------|-----------|-----------------|
| `config/settings.py` | Pydantic Settings | Configuración centralizada desde `.env` |
| `config/constants.py` | Roles, RoundStatus, etc. | Constantes del dominio |
| `config/logging.py` | Logging config | Logger centralizado |
| `infrastructure/db.py` | get_db, safe_commit, SessionLocal | Conexión y transacciones de BD |
| `infrastructure/events.py` | Redis pool, publish_event | Bus de eventos Redis |
| `security/auth.py` | JWT, table token verification | Autenticación y tokens |
| `utils/exceptions.py` | NotFoundError, ForbiddenError, etc. | Excepciones centralizadas con auto-logging |
| `utils/admin_schemas.py` | Pydantic output schemas | Serialización de respuestas |
| `utils/validators.py` | validate_image_url, etc. | Validación de entrada |

---

## Arquitectura del WebSocket Gateway

El Gateway WebSocket es un servicio independiente que maneja todas las conexiones en tiempo real. Está diseñado con **Composition Pattern**: componentes pequeños y especializados orquestados por un manager central.

### ConnectionManager (Fachada Orquestadora)

Compone 5 módulos especializados:

| Módulo | Responsabilidad |
|--------|-----------------|
| `ConnectionLifecycle` | Aceptar/desconectar con ordenamiento de locks |
| `ConnectionBroadcaster` | Worker pool (10 workers), batch fallback (50 por lote) |
| `ConnectionCleanup` | Limpieza de conexiones stale (60s), muertas y locks |
| `ConnectionIndex` | Índices multidimensionales (usuario, sucursal, sector, sesión) |
| `ConnectionStats` | Agregación de métricas |

### RedisSubscriber

Suscriptor Pub/Sub con protecciones:

- **Circuit Breaker**: Protege operaciones Redis (CLOSED → OPEN tras 5 fallos → HALF_OPEN a 30s → CLOSED)
- **Validación de eventos**: Schema validation antes de procesar
- **Procesamiento por lotes**: Agrupa mensajes para eficiencia

### EventRouter

Enruta eventos al destino correcto según tipo y rol:

- `KITCHEN_EVENTS`: Solo conexiones de cocina
- `SESSION_EVENTS`: Comensales de la sesión específica
- `ADMIN_ONLY_EVENTS`: Solo administradores
- `BRANCH_WIDE_WAITER_EVENTS`: Todos los mozos de la sucursal

**Filtrado por sector:** Los eventos con `sector_id` se envían solo a mozos asignados a ese sector. ADMIN y MANAGER siempre reciben todos los eventos de la sucursal.

### Estrategias de Autenticación

Patrón Strategy para autenticación flexible:

| Estrategia | Uso | Revalidación |
|------------|-----|--------------|
| `JWTAuthStrategy` | Staff (mozo, cocina, admin) | Cada 5 minutos |
| `TableTokenAuthStrategy` | Comensales | Cada 30 minutos |
| `CompositeAuthStrategy` | Intenta JWT primero, luego TableToken | Según tipo |
| `NullAuthStrategy` | Testing | Sin validación |

### Límites de Conexión

- Máximo 3 conexiones por usuario
- Máximo 1000 conexiones totales
- Heartbeat: ping cada 30s, timeout pong 60s
- Códigos de cierre: 4001 (auth fallido), 4003 (prohibido), 4029 (rate limited)

---

## Patrones de Entrega de Eventos

El sistema utiliza dos patrones de entrega según la criticidad del evento:

### Outbox Pattern (Entrega Garantizada)

Para eventos financieros y críticos donde la pérdida de un evento es inaceptable:

```python
from rest_api.services.events.outbox_service import write_billing_outbox_event

# El evento se escribe atómicamente con los datos de negocio
write_billing_outbox_event(db=db, tenant_id=t, event_type=CHECK_REQUESTED, ...)
db.commit()  # Atómico con los datos de negocio
```

Un procesador en background lee la tabla outbox y publica a Redis. Garantiza **at-least-once delivery**.

### Direct Redis (Baja Latencia)

Para eventos donde la velocidad importa más que la garantía absoluta:

```python
from shared.infrastructure.events import publish_event
await publish_event(channel, event_data)
```

Entrega **best-effort** con latencia mínima.

| Patrón | Eventos |
|--------|---------|
| **Outbox** (no debe perderse) | CHECK_REQUESTED, CHECK_PAID, PAYMENT_*, ROUND_SUBMITTED, ROUND_READY, SERVICE_CALL_CREATED |
| **Direct Redis** (baja latencia) | ROUND_CONFIRMED, ROUND_IN_KITCHEN, ROUND_SERVED, CART_*, TABLE_*, ENTITY_* |

---

## Arquitectura Frontend

Las tres aplicaciones frontend comparten una base tecnológica común:

### Stack Compartido

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React | 19.2 | UI library |
| Vite | 7.2 | Bundler y dev server |
| TypeScript | 5.9 | Type safety |
| Zustand | Última | State management |
| Tailwind CSS | 4 | Estilos utilitarios |
| React Compiler | babel-plugin | Auto-memoización |

### Patrones Obligatorios

**Zustand - Selectores (NUNCA destructurar):**

```typescript
// CORRECTO: Siempre usar selectores
const items = useStore(selectItems)
const addItem = useStore((s) => s.addItem)

// INCORRECTO: Nunca destructurar (causa loops infinitos de re-render)
// const { items } = useStore()
```

**Referencias estables para arrays vacíos:**

```typescript
const EMPTY_ARRAY: number[] = []
export const selectBranchIds = (s: State) => s.user?.branch_ids ?? EMPTY_ARRAY
```

**useShallow para arrays filtrados/computados:**

```typescript
import { useShallow } from 'zustand/react/shallow'
const activeItems = useStore(useShallow(state => state.items.filter(i => i.active)))
```

### Características Comunes

- **Lazy loading**: Páginas cargadas con `React.lazy()` + `Suspense`
- **WebSocket**: Servicio singleton con reconexión (backoff exponencial + jitter)
- **Tema**: Acento naranja (#f97316), soporte dark mode
- **PWA**: Service workers con Workbox (CacheFirst para assets, NetworkFirst para APIs)

---

## Infraestructura

### Docker Compose

El archivo `devOps/docker-compose.yml` orquesta todos los servicios:

| Servicio | Imagen/Build | Puerto |
|----------|-------------|--------|
| `db` | PostgreSQL 16 + pgvector | 5432 |
| `redis` | Redis 7 Alpine | 6380 |
| `backend` | Build desde `backend/` | 8000 |
| `ws_gateway` | Build desde raíz | 8001 |
| `pgadmin` | pgAdmin 4 | 5050 |

### Puertos del Sistema

| Puerto | Servicio | Protocolo |
|--------|----------|-----------|
| 5176 | pwaMenu | HTTP |
| 5177 | Dashboard | HTTP |
| 5178 | pwaWaiter | HTTP |
| 8000 | REST API | HTTP |
| 8001 | WebSocket Gateway | WS |
| 5432 | PostgreSQL | TCP |
| 6380 | Redis | TCP |
| 5050 | pgAdmin | HTTP |

---

## Flujo de Comunicación

### Request HTTP Típica

```
Cliente → REST API (8000) → Router → PermissionContext → Domain Service → Repository → PostgreSQL
                                                              ↓
                                                        publish_event → Redis Pub/Sub
                                                              ↓
                                                    WS Gateway (8001) → EventRouter → Clientes WS
```

### Evento Crítico (Outbox)

```
Cliente → REST API → Domain Service → [Datos + Outbox Event] → db.commit() (atómico)
                                                                      ↓
                                              Background Processor → Redis Pub/Sub
                                                                      ↓
                                                            WS Gateway → Clientes
```

### Conexión WebSocket

```
Cliente → WS Gateway (8001) → AuthStrategy (JWT/TableToken)
                                    ↓ (autenticado)
                              ConnectionManager.connect()
                                    ↓
                              ConnectionIndex (registrar por branch/sector/session)
                                    ↓
                              Heartbeat loop (ping cada 30s)
                                    ↓ (evento llega via Redis)
                              EventRouter → BroadcastRouter → WorkerPool → Cliente
```
