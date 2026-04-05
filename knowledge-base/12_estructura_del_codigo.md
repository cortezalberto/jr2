# 12. Estructura del Código

## Vista General del Monorepo

El proyecto Integrador / Buen Sabor es un **monorepo** que contiene 4 aplicaciones frontend, 1 API REST, 1 Gateway WebSocket y la infraestructura de despliegue. Cada componente es independiente pero comparte convenciones y un módulo `shared/` en el backend.

```
Jr-main/
├── backend/                          # Backend Python (REST API)
├── ws_gateway/                       # WebSocket Gateway (en raíz del proyecto)
├── Dashboard/                        # Panel de Administración (React 19)
├── pwaMenu/                          # PWA del Cliente/Comensal (React 19)
├── pwaWaiter/                        # PWA del Mozo (React 19)
├── devOps/                           # Infraestructura Docker
├── .devcontainer/                    # VSCode DevContainer
├── knowledge-base/                   # Documentación del sistema
├── CLAUDE.md                         # Guía raíz del proyecto
├── README.md                         # README general
├── proyehisto0.md                    # Backlog de historias de usuario (21KB)
├── proyehisto1.md                    # Backlog de gaps (11KB)
├── prompt00.md                       # Prompts de implementación (44KB)
└── [25+ documentos de arquitectura]  # Documentación técnica variada
```

---

## Backend (backend/)

El backend implementa Clean Architecture con FastAPI, PostgreSQL y Redis.

```
backend/
├── rest_api/                         # Aplicación REST API
│   ├── main.py                       # App FastAPI, middlewares, CORS
│   ├── seed.py                       # Datos semilla para la BD (41KB)
│   ├── core/                         # Núcleo de la aplicación (startup, etc.)
│   │
│   ├── models/                       # Modelos SQLAlchemy 2.0 (18 archivos)
│   │   ├── tenant.py                 # Tenant (restaurante), Branch (sucursal)
│   │   ├── menu.py                   # Category, Subcategory, Product
│   │   ├── allergen.py               # Allergen, ProductAllergen, CrossReaction
│   │   ├── table.py                  # Table, TableSession, Diner
│   │   ├── round.py                  # Round, RoundItem
│   │   ├── kitchen.py                # KitchenTicket, KitchenTicketItem
│   │   ├── billing.py                # Check (app_check), Charge, Allocation, Payment
│   │   ├── user.py                   # User, UserBranchRole
│   │   ├── sector.py                 # BranchSector, WaiterSectorAssignment
│   │   ├── promotion.py              # Promotion, PromotionBranch, PromotionItem
│   │   ├── recipe.py                 # Recipe, Ingredient, SubIngredient
│   │   ├── outbox.py                 # OutboxEvent (transactional outbox)
│   │   ├── audit.py                  # AuditLog, AuditMixin
│   │   ├── customer.py               # Customer (loyalty)
│   │   ├── service_call.py           # ServiceCall
│   │   └── __init__.py               # Re-exporta todos los modelos
│   │
│   ├── routers/                      # Controladores HTTP (delgados)
│   │   ├── auth.py                   # /api/auth/* (login, refresh, logout, me)
│   │   ├── admin.py                  # /api/admin/* (CRUD administrativo)
│   │   ├── waiter.py                 # /api/waiter/* (operaciones del mozo)
│   │   ├── diner.py                  # /api/diner/* (operaciones del comensal)
│   │   ├── kitchen.py                # /api/kitchen/* (operaciones de cocina)
│   │   ├── billing.py                # /api/billing/* (pagos y facturación)
│   │   ├── public.py                 # /api/public/* (sin autenticación)
│   │   ├── recipes.py                # /api/recipes/* (recetas)
│   │   └── customer.py               # /api/customer/* (fidelización)
│   │
│   ├── services/                     # Capa de servicios
│   │   ├── domain/                   # Servicios de dominio (lógica de negocio)
│   │   │   ├── __init__.py           # Re-exporta todos los servicios
│   │   │   ├── category_service.py   # CRUD de categorías
│   │   │   ├── subcategory_service.py
│   │   │   ├── branch_service.py     # Gestión de sucursales
│   │   │   ├── sector_service.py     # Sectores del salón
│   │   │   ├── table_service.py      # Gestión de mesas
│   │   │   ├── product_service.py    # Productos y precios
│   │   │   ├── allergen_service.py   # Alérgenos
│   │   │   ├── staff_service.py      # Personal y roles
│   │   │   ├── promotion_service.py  # Promociones
│   │   │   ├── round_service.py      # Rondas de pedidos
│   │   │   ├── billing_service.py    # Facturación y pagos
│   │   │   ├── diner_service.py      # Comensales
│   │   │   ├── service_call_service.py # Llamadas de servicio
│   │   │   └── ticket_service.py     # Tickets de cocina
│   │   │
│   │   ├── crud/                     # Patrón Repository
│   │   │   ├── repository.py         # TenantRepository, BranchRepository
│   │   │   └── soft_delete.py        # cascade_soft_delete()
│   │   │
│   │   ├── events/                   # Servicios de eventos
│   │   │   └── outbox_service.py     # write_billing_outbox_event()
│   │   │
│   │   ├── permissions.py            # PermissionContext (Strategy Pattern)
│   │   └── base_service.py           # BaseCRUDService, BranchScopedService
│   │
│   └── repositories/                 # Repositorios adicionales
│
├── shared/                           # Módulo compartido (REST API + WS Gateway)
│   ├── config/
│   │   ├── settings.py               # Pydantic Settings (lectura de .env)
│   │   ├── constants.py              # Roles, RoundStatus, MANAGEMENT_ROLES
│   │   └── logging.py               # Configuración de logging centralizado
│   ├── infrastructure/
│   │   ├── db.py                     # get_db(), safe_commit(), SessionLocal
│   │   └── events.py                 # get_redis_pool(), publish_event()
│   ├── security/
│   │   └── auth.py                   # current_user_context(), verify_jwt()
│   └── utils/
│       ├── exceptions.py             # NotFoundError, ForbiddenError, ValidationError
│       ├── admin_schemas.py          # Schemas Pydantic de salida
│       └── validators.py             # validate_image_url(), escape_like_pattern()
│
├── tests/                            # Tests del backend (19 archivos)
│   ├── test_auth.py                  # Tests de autenticación
│   ├── test_billing.py               # Tests de facturación
│   ├── test_rounds.py                # Tests de rondas
│   ├── conftest.py                   # Fixtures compartidos
│   └── ...
│
├── Dockerfile                        # Imagen Docker del backend
├── requirements.txt                  # Dependencias Python
├── pytest.ini                        # Configuración de pytest
├── cli.py                            # Utilidades CLI
└── .env.example                      # Variables de entorno de ejemplo
```

---

## WebSocket Gateway (ws_gateway/)

El Gateway WebSocket vive en la **raíz del proyecto** (no dentro de `backend/`), pero comparte el módulo `shared/` del backend. Requiere `PYTHONPATH=backend` para importar correctamente.

```
ws_gateway/
├── main.py                           # App FastAPI, 4 endpoints WebSocket
├── connection_manager.py             # Fachada orquestadora (composición)
├── redis_subscriber.py               # Suscriptor Redis Pub/Sub + Circuit Breaker
│
├── core/                             # Módulos internos del manager
│   ├── connection/                   # Gestión de conexiones
│   │   ├── lifecycle.py              # ConnectionLifecycle (accept/disconnect)
│   │   ├── broadcaster.py            # ConnectionBroadcaster (worker pool)
│   │   ├── cleanup.py                # ConnectionCleanup (stale, dead, locks)
│   │   ├── index.py                  # ConnectionIndex (índices multidimensionales)
│   │   └── stats.py                  # ConnectionStats (métricas)
│   └── subscriber/                   # Procesamiento de mensajes
│       ├── processor.py              # Procesador de mensajes Redis
│       ├── validator.py              # Validación de eventos
│       └── drop_tracker.py           # Tracking de mensajes descartados
│
├── components/                       # Componentes modulares
│   ├── auth/
│   │   └── strategies.py             # JWT, TableToken, Composite, Null auth
│   ├── broadcast/
│   │   └── router.py                 # BroadcastRouter (estrategias de difusión)
│   ├── connection/
│   │   ├── index.py                  # Índice de conexiones
│   │   ├── locks.py                  # Sharded locks por sucursal
│   │   ├── heartbeat.py              # Heartbeat manager
│   │   └── rate_limiter.py           # Rate limiter por conexión
│   ├── endpoints/
│   │   └── handlers.py               # Handlers: Waiter, Kitchen, Admin, Diner
│   ├── events/
│   │   └── router.py                 # EventRouter (routing por tipo y rol)
│   ├── resilience/
│   │   ├── circuit_breaker.py        # CircuitBreaker (CLOSED→OPEN→HALF_OPEN)
│   │   └── retry.py                  # Retry con backoff
│   ├── metrics/
│   │   ├── prometheus.py             # Métricas Prometheus
│   │   └── collector.py              # Colector de métricas
│   ├── data/
│   │   └── sector_repository.py      # SectorRepository con cache (5 min TTL)
│   └── redis/
│       └── lua_scripts.py            # Scripts Lua para operaciones atómicas
│
├── README.md                         # Documentación del gateway
└── arquiws_gateway.md                # Documento de arquitectura detallado
```

---

## Dashboard (Dashboard/)

Panel de administración para gestión multi-sucursal. 24 páginas, 16+ stores Zustand.

```
Dashboard/
├── src/
│   ├── App.tsx                       # Router principal, 24 páginas lazy
│   ├── main.tsx                      # Entry point, PWA, WebVitals
│   │
│   ├── pages/                        # 24 páginas del panel
│   │   ├── DashboardPage.tsx         # Vista principal con métricas
│   │   ├── CategoriesPage.tsx        # CRUD de categorías
│   │   ├── ProductsPage.tsx          # CRUD de productos
│   │   ├── TablesPage.tsx            # Gestión de mesas
│   │   ├── BranchesPage.tsx          # Gestión de sucursales
│   │   ├── StaffPage.tsx             # Gestión de personal
│   │   ├── SectorsPage.tsx           # Sectores del salón
│   │   ├── AllergensPage.tsx         # Alérgenos
│   │   ├── PromotionsPage.tsx        # Promociones
│   │   ├── OrdersPage.tsx            # Pedidos en tiempo real
│   │   ├── KitchenPage.tsx           # Vista de cocina
│   │   ├── BillingPage.tsx           # Facturación
│   │   └── ...                       # Recetas, ingredientes, etc.
│   │
│   ├── components/
│   │   ├── layout/                   # Layout, Sidebar, Header
│   │   ├── auth/                     # ProtectedRoute (guard de rutas)
│   │   ├── ui/                       # Componentes reutilizables
│   │   │   ├── Modal.tsx             # Modal genérico
│   │   │   ├── Button.tsx            # Botón con variantes
│   │   │   ├── Input.tsx             # Input con validación
│   │   │   ├── DataTable.tsx         # Tabla de datos con paginación
│   │   │   ├── ConfirmDialog.tsx     # Diálogo de confirmación
│   │   │   └── ...
│   │   └── tables/                   # Componentes específicos de mesas
│   │       ├── SectorModal.tsx       # Modal de sectores
│   │       ├── SessionDetailModal.tsx # Detalle de sesión
│   │       └── BulkTableModal.tsx    # Creación masiva de mesas
│   │
│   ├── stores/                       # 16+ stores Zustand
│   │   ├── authStore.ts              # Autenticación y sesión
│   │   ├── branchStore.ts            # Sucursales y selección activa
│   │   ├── categoryStore.ts          # Categorías
│   │   ├── productStore.ts           # Productos
│   │   ├── tableStore.ts             # Mesas y sesiones
│   │   ├── staffStore.ts             # Personal
│   │   ├── orderStore.ts             # Pedidos
│   │   ├── billingStore.ts           # Facturación
│   │   └── ...                       # Sectores, alérgenos, promociones, etc.
│   │
│   ├── hooks/                        # Custom hooks
│   │   ├── useFormModal.ts           # Modal + form state en un solo hook
│   │   ├── useConfirmDialog.ts       # Confirmación de acciones destructivas
│   │   ├── usePagination.ts          # Paginación
│   │   └── ...
│   │
│   ├── services/
│   │   ├── api.ts                    # Cliente REST con retry y 401 handling
│   │   └── websocket.ts             # Servicio WebSocket admin (610+ líneas)
│   │
│   ├── types/                        # Interfaces TypeScript
│   ├── utils/                        # Validación, logger, sanitización
│   └── config/
│       └── env.ts                    # Configuración de entorno
│
├── CLAUDE.md                         # Guía específica del Dashboard
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## pwaMenu (pwaMenu/)

PWA del cliente/comensal. Menú compartido, carrito colaborativo, i18n (es/en/pt), 52 componentes.

```
pwaMenu/
├── src/
│   ├── App.tsx                       # Router (Home, CloseTable, PaymentResult)
│   │
│   ├── pages/                        # Páginas principales
│   │   ├── Home.tsx                  # Página principal del menú
│   │   ├── CloseTable.tsx            # Cierre de mesa y pago
│   │   └── PaymentResult.tsx         # Resultado de pago (MP callback)
│   │
│   ├── components/ (52 archivos)
│   │   ├── Header.tsx                # Cabecera con info de sesión
│   │   ├── BottomNav.tsx             # Navegación inferior móvil
│   │   ├── HamburgerMenu.tsx         # Menú lateral
│   │   ├── CategoryTabs.tsx          # Pestañas de categorías
│   │   ├── ProductCard.tsx           # Tarjeta de producto (lazy)
│   │   ├── ProductDetailModal.tsx    # Detalle de producto (lazy)
│   │   ├── SharedCart.tsx            # Carrito compartido (lazy)
│   │   ├── cart/                     # Subcomponentes del carrito
│   │   │   ├── CartItem.tsx
│   │   │   ├── CartSummary.tsx
│   │   │   └── CartActions.tsx
│   │   ├── JoinTable/               # Unirse a mesa
│   │   │   ├── JoinTableFlow.tsx
│   │   │   ├── QRScanner.tsx
│   │   │   └── NameInput.tsx
│   │   ├── QRSimulator.tsx           # Simulador QR para desarrollo
│   │   ├── close-table/ (11 componentes)
│   │   │   ├── CloseTableFlow.tsx
│   │   │   ├── BillSummary.tsx
│   │   │   ├── PaymentMethodSelector.tsx
│   │   │   ├── SplitBillOptions.tsx
│   │   │   └── ...
│   │   ├── AIChat/                   # Chat con IA (lazy)
│   │   │   ├── AIChatModal.tsx
│   │   │   └── AIChatMessages.tsx
│   │   └── ui/                       # Componentes base
│   │       ├── Modal.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── ...
│   │
│   ├── stores/
│   │   ├── tableStore/               # Store modular de mesa
│   │   │   ├── store.ts              # Definición principal del store
│   │   │   ├── types.ts              # Tipos TypeScript
│   │   │   ├── selectors.ts          # Selectores optimizados
│   │   │   └── helpers.ts            # Funciones auxiliares
│   │   ├── menuStore.ts              # Datos del menú
│   │   └── serviceCallStore.ts       # Llamadas de servicio
│   │
│   ├── hooks/ (24 custom hooks)
│   │   ├── useTableSession.ts        # Gestión de sesión
│   │   ├── useCart.ts                 # Operaciones del carrito
│   │   ├── useMenu.ts                # Carga y filtrado del menú
│   │   ├── useWebSocket.ts           # Conexión WS del comensal
│   │   └── ...
│   │
│   ├── services/
│   │   ├── api.ts                    # Cliente REST con deduplicación
│   │   ├── websocket.ts              # Servicio WS del comensal
│   │   └── mercadoPago.ts            # Integración Mercado Pago
│   │
│   ├── i18n/                         # Internacionalización
│   │   ├── es.json                   # Español
│   │   ├── en.json                   # Inglés
│   │   └── pt.json                   # Portugués
│   │
│   ├── types/                        # Interfaces TypeScript
│   ├── constants/                    # Constantes
│   ├── utils/                        # Utilidades
│   └── test/                         # Tests
│
├── CLAUDE.md                         # Guía específica de pwaMenu
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## pwaWaiter (pwaWaiter/)

PWA del mozo. Gestión de mesas en tiempo real con agrupación por sector, soporte offline.

```
pwaWaiter/
├── src/
│   ├── App.tsx                       # Flujo de autenticación (pre-login → login → main)
│   │
│   ├── pages/
│   │   ├── MainPage.tsx              # Vista principal con mesas por sector
│   │   ├── LoginPage.tsx             # Login del mozo
│   │   ├── PreLoginBranchSelect.tsx  # Selección de sucursal PRE-login
│   │   ├── AccessDeniedPage.tsx      # Acceso denegado (sin asignación)
│   │   └── ...
│   │
│   ├── components/
│   │   ├── TableCard.tsx             # Tarjeta de mesa con estado visual
│   │   ├── TableDetailModal.tsx      # Detalle de mesa (sesión, pedidos)
│   │   ├── AutogestionModal.tsx      # Autogestión del mozo
│   │   ├── ComandaTab.tsx            # Tab de comanda rápida
│   │   ├── StatusBadge.tsx           # Badge de estado (OPEN/PAYING/CLOSED)
│   │   ├── FiscalInvoiceModal.tsx    # Modal de facturación fiscal
│   │   ├── PWAManager.tsx            # Gestión de instalación PWA
│   │   ├── OfflineBanner.tsx         # Banner de modo offline
│   │   ├── ConnectionBanner.tsx      # Estado de conexión WS
│   │   └── ui/                       # Componentes base
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── ConfirmDialog.tsx
│   │
│   ├── stores/
│   │   ├── authStore.ts              # Autenticación + pre-login branch
│   │   ├── tablesStore.ts            # Mesas y sesiones (por sector)
│   │   └── retryQueueStore.ts        # Cola de reintentos offline
│   │
│   ├── services/
│   │   ├── api.ts                    # Cliente REST
│   │   ├── websocket.ts              # Servicio WS del mozo
│   │   └── offline.ts                # Servicio de persistencia offline
│   │
│   ├── utils/
│   │   ├── constants.ts              # Constantes
│   │   ├── format.ts                 # Formateo de datos
│   │   └── logger.ts                 # Logger centralizado
│   │
│   └── test/                         # Tests
│
├── CLAUDE.md                         # Guía específica de pwaWaiter
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## DevOps e Infraestructura

```
devOps/
├── docker-compose.yml                # Compose principal (todos los servicios)
├── grafana/                          # Dashboards de monitoreo Grafana
├── reset_tables.sql                  # Script SQL para limpiar datos de mesas
├── start.sh                          # Script de inicio (Linux/Mac)
├── start.ps1                         # Script de inicio (Windows PowerShell)
└── README.md                         # Documentación de infraestructura

.devcontainer/                        # Configuración de VSCode DevContainer
├── Dockerfile                        # Imagen del contenedor de desarrollo
├── docker-compose.dev.yml            # Compose para desarrollo
├── post-create.sh                    # Script post-creación del contenedor
└── post-start.sh                     # Script post-inicio del contenedor
```

---

## Convenciones de Nombres

| Contexto | Convención | Ejemplo |
|----------|------------|---------|
| Frontend variables/funciones | camelCase | `branchId`, `handleSubmit()` |
| Backend variables/funciones | snake_case | `branch_id`, `handle_submit()` |
| Modelos SQLAlchemy | PascalCase | `BranchSector`, `RoundItem` |
| Componentes React | PascalCase | `ProductCard.tsx`, `SharedCart.tsx` |
| Stores Zustand | camelCase + "Store" | `authStore.ts`, `tableStore.ts` |
| Servicios de dominio | PascalCase + "Service" | `CategoryService`, `BillingService` |
| Routers FastAPI | snake_case | `auth.py`, `billing.py` |
| Tests backend | test_ prefix | `test_auth.py`, `test_billing.py` |
| Tests frontend | .test.ts suffix | `branchStore.test.ts` |
| Variables de entorno | UPPER_SNAKE_CASE | `JWT_SECRET`, `VITE_API_URL` |
