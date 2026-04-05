# Vision General del Sistema

## Identidad

- **Nombre**: Integrador / Buen Sabor
- **Tipo**: Plataforma SaaS multi-tenant de gestion de restaurantes (monorepo)
- **Proposito**: Gestion integral de operaciones de restaurante de punta a punta: administracion, pedidos de clientes via QR, gestion de mesas en tiempo real para mozos, visualizacion de cocina

---

## Los 5 Componentes

### 1. Backend (FastAPI) - Puerto 8000

API REST construida con Clean Architecture y Domain Services. Capa de datos con SQLAlchemy 2.0 sobre PostgreSQL 16, cache y mensajeria con Redis 7.

- **Autenticacion dual**: JWT para staff (access 15 min, refresh 7 dias), tokens HMAC de mesa para comensales (3 horas de expiracion)
- **Patron de repositorios**: `TenantRepository` y `BranchRepository` con soft delete automatico y filtrado por tenant
- **Servicios de dominio**: `CategoryService`, `ProductService`, `RoundService`, `BillingService`, entre otros. Cada router delega la logica de negocio al servicio correspondiente
- **Seguridad**: CORS configurable, headers de seguridad (CSP, HSTS), validacion de Content-Type, rate limiting en endpoints de facturacion, proteccion SSRF en URLs de imagenes
- **Transactional Outbox**: Eventos criticos (pagos, facturas, rondas enviadas) se escriben atomicamente en la base de datos y se publican via procesador en segundo plano

### 2. WebSocket Gateway (FastAPI) - Puerto 8001

Sistema de eventos en tiempo real, separado del backend REST por diseno.

- **Patron de composicion**: `connection_manager.py` y `redis_subscriber.py` son orquestadores delgados que componen modulos de `core/` y `components/`
- **Canales**: `/ws/waiter`, `/ws/kitchen`, `/ws/diner`, `/ws/admin` - cada uno con su estrategia de autenticacion
- **Broadcast con Worker Pool**: 10 workers paralelos, ~160ms para 400 usuarios. Fallback a batch legacy (50 por lote)
- **Locks fragmentados por branch**: Concurrencia para 400+ usuarios simultaneos por branch
- **Circuit Breaker y Rate Limiting**: Proteccion contra fallas en cascada de Redis y abuso de conexiones
- **Redis Streams**: Consumer para eventos criticos con entrega at-least-once y DLQ (Dead Letter Queue) para mensajes fallidos
- **Heartbeat**: Ping cada 30s, timeout del servidor a los 60s. Codigos de cierre: 4001 (auth fallida), 4003 (prohibido), 4029 (rate limited)

### 3. Dashboard (React 19) - Puerto 5177

Panel de administracion para gestion multi-branch.

- **24 paginas lazy-loaded**: Carga diferida para mantener el bundle inicial liviano
- **16+ stores Zustand**: Cada entidad tiene su propio store con selectores estables y `useShallow` para listas filtradas
- **React Compiler**: `babel-plugin-react-compiler` para auto-memorizacion; no se necesita `useMemo`/`useCallback` manual
- **CRUD completo**: Categorias, subcategorias, productos, precios por branch, personal, sectores, mesas, alergenos, promociones, ingredientes, recetas
- **WebSocket en tiempo real**: Recibe eventos `ENTITY_CREATED`, `ENTITY_UPDATED`, `ENTITY_DELETED`, `CASCADE_DELETE` para mantener la UI sincronizada
- **Capacidad PWA**: Instalable como aplicacion de escritorio

### 4. pwaMenu (React 19) - Puerto 5176

PWA orientada al cliente. El flujo completo: escanear QR, unirse a la mesa, navegar el menu, carrito compartido, confirmacion grupal, pedido, division de cuenta, pago con Mercado Pago.

- **52 componentes, 24 hooks**: Arquitectura modular con separacion clara entre presentacion y logica
- **Trilinguee (es/en/pt)**: Todo texto visible al usuario usa `t()` via i18n. Cero strings hardcodeados
- **Carrito compartido**: Sincronizacion multi-dispositivo via WebSocket. Los items muestran quien los agrego (nombre/color del comensal)
- **Rondas con confirmacion grupal**: Un comensal propone, el grupo confirma, se envia la orden
- **Division de cuenta**: Partes iguales, por consumo, o personalizada
- **Filtros de alergenos**: Cumplimiento EU 1169/2011 con tipos de presencia y niveles de riesgo
- **Cache con TTL de 8 horas**: localStorage con expiracion para menu y sesion. Se limpia automaticamente al detectar datos obsoletos

### 5. pwaWaiter (React 19) - Puerto 5178

PWA para mozos con gestion de mesas en tiempo real.

- **Flujo pre-login**: Seleccion de branch antes de autenticarse → verificacion de asignacion diaria → grilla de mesas agrupadas por sector
- **Animaciones en tiempo real**: Rojo = llamado de servicio, amarillo = pedido nuevo, naranja = pedido listo, morado = cuenta solicitada
- **Comanda rapida**: Toma de pedidos para clientes sin telefono via endpoint compacto de menu (sin imagenes)
- **Offline-first**: Cola de reintentos para operaciones cuando la conexion es inestable
- **Gestion de pagos**: Registro de pagos en efectivo, tarjeta o transferencia

---

## Stack Tecnologico

### Frontend

| Tecnologia | Version | Uso |
|------------|---------|-----|
| React | 19.2 | Framework UI (los 3 frontends) |
| Vite | 7.2 | Bundler y dev server |
| TypeScript | 5.9 | Tipado estatico |
| Zustand | 5 | Estado global (selectores, nunca destructuring) |
| Tailwind CSS | 4 | Estilos utilitarios |
| Vitest | 4.0 (pwaWaiter: 3.2) | Testing |
| React Compiler | - | Auto-memorizacion via babel plugin |

### Backend

| Tecnologia | Version | Uso |
|------------|---------|-----|
| FastAPI | 0.115 | Framework web (REST + WebSocket) |
| SQLAlchemy | 2.0 | ORM con soporte async |
| PostgreSQL | 16 | Base de datos relacional |
| Redis | 7 | Cache, pub/sub, rate limiting, token blacklist |
| Pydantic | 2.x | Validacion de schemas |

### Infraestructura

| Tecnologia | Uso |
|------------|-----|
| Docker Compose | Orquestacion de servicios (db, redis, backend, ws_gateway, pgadmin) |
| DevContainer | Soporte para desarrollo en contenedores |

---

## Arquitectura Multi-Tenant

```
Tenant (Restaurante)
  +-- Catalogos a nivel tenant: CookingMethod, FlavorProfile, TextureProfile, CuisineType
  +-- IngredientGroup -> Ingredient -> SubIngredient
  +-- Branch (N)
        +-- Category (N) -> Subcategory (N) -> Product (N)
        +-- BranchSector (N) -> Table (N) -> TableSession -> Diner (N)
        +-- WaiterSectorAssignment (diaria)
        +-- Round -> RoundItem -> KitchenTicket
        +-- Check -> Charge -> Allocation (FIFO) <- Payment
        +-- ServiceCall
```

Cada query de datos esta filtrada por `tenant_id`. Los repositorios aplican este filtro automaticamente. Los precios son por branch (`BranchProduct` con precio en centavos).

---

## Metricas del Proyecto

| Metrica | Valor |
|---------|-------|
| Total de archivos | 866+ |
| Archivos Python | 237 |
| Archivos TypeScript | 152 |
| Archivos TSX | 142 |
| Componentes React (pwaMenu) | 52 |
| Custom Hooks (pwaMenu) | 24 |
| Paginas Dashboard | 24 |
| Stores Zustand (Dashboard) | 16+ |
| Puertos en uso | 5 (8000, 8001, 5176, 5177, 5178) |

---

## Madurez

El sistema se encuentra en estado **pre-produccion**. La arquitectura esta bien definida y los patrones son solidos, pero faltan elementos clave para produccion:

- **CI/CD**: No hay pipeline automatizado de integracion/despliegue
- **Escalado horizontal**: El diseno actual es single-instance; necesita work para multi-instancia
- **Estrategia de backup**: No hay backups automatizados de PostgreSQL
- **Monitoreo**: No hay sistema de observabilidad (metricas, alertas, tracing)
- **Pruebas E2E**: Faltan tests de integracion end-to-end

---

## Referencias

- [02 - Problema que Resuelve](./02_problema_que_resuelve.md)
- [03 - Propuesta de Valor](./03_propuesta_de_valor.md)
- [04 - Actores y Roles](./04_actores_y_roles.md)
