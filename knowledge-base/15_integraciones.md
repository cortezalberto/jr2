# 15. Integraciones Externas

Este documento describe todas las integraciones externas del sistema, sus configuraciones, flujos de datos y consideraciones de seguridad.

---

## 1. Mercado Pago (Procesamiento de Pagos)

### Descripción General

Mercado Pago es el procesador de pagos online del sistema. Permite a los comensales pagar su cuenta directamente desde la PWA del menú (pwaMenu) sin interacción del mozo.

### Componentes Involucrados

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| Backend | `rest_api/routers/billing.py` | Crear preferencias de pago, recibir webhooks |
| Backend | `rest_api/services/domain/billing_service.py` | Lógica de negocio de facturación |
| Frontend | `pwaMenu/src/services/mercadoPago.ts` | Integración del SDK de MP |
| Frontend | `pwaMenu/src/pages/PaymentResult.tsx` | Página de resultado post-pago |

### Librería

- **Backend:** `mercadopago` 2.11.0 (SDK oficial de Python)
- **Frontend:** Redirección a checkout de Mercado Pago (no SDK frontend embebido)

### Variables de Entorno

```bash
# Backend (.env)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...    # Token de acceso (producción)
# o
MERCADOPAGO_ACCESS_TOKEN=TEST-...        # Token de acceso (sandbox)

# Frontend (pwaMenu/.env)
VITE_MP_PUBLIC_KEY=APP_USR-...           # Clave pública (producción)
# o
VITE_MP_PUBLIC_KEY=TEST-...              # Clave pública (sandbox)
```

**Detección de modo sandbox:** Si `VITE_MP_PUBLIC_KEY` comienza con `"TEST-"`, el sistema opera en modo sandbox automáticamente.

### Flujo de Pago Completo

```
1. Comensal solicita la cuenta
   pwaMenu → POST /api/billing/check/request
   Backend → Crea Check con Charges → Emite CHECK_REQUESTED (outbox)

2. Comensal elige pagar con Mercado Pago
   pwaMenu → POST /api/billing/payment/preference
   Backend → Crea preferencia via SDK MP → Retorna preference_id + init_point

3. Redirección al checkout de MP
   pwaMenu → window.location.href = init_point (URL de checkout MP)
   Comensal → Completa el pago en MP

4. Retorno post-pago
   MP → Redirige a /payment/success | /payment/failure | /payment/pending
   pwaMenu → PaymentResult.tsx muestra el resultado

5. Notificación asíncrona (webhook)
   MP → POST /api/billing/payment/webhook (IPN notification)
   Backend → Verifica firma → Actualiza Payment → Emite PAYMENT_APPROVED/REJECTED (outbox)
   
6. Si el pago cubre la totalidad
   Backend → Marca Check como PAID → Emite CHECK_PAID (outbox)
```

### URLs de Retorno

| Resultado | URL |
|-----------|-----|
| Éxito | `{FRONTEND_URL}/payment/success?payment_id=...` |
| Fallo | `{FRONTEND_URL}/payment/failure?payment_id=...` |
| Pendiente | `{FRONTEND_URL}/payment/pending?payment_id=...` |

### Moneda y Formato

- **Moneda:** ARS (Pesos Argentinos)
- **Formato interno:** Centavos (enteros). Ej: $125.50 = `12550`
- **Formato para MP:** Pesos (float). Se convierte: `12550 / 100 = 125.50`

### Modelo FIFO de Asignación

Los pagos se asignan a los cargos (charges) usando el patrón FIFO (First In, First Out):

```
Check (cuenta total: $5000)
├── Charge 1: Entrada ($1500) ← Payment 1 ($2000) cubre esto + parte del siguiente
├── Charge 2: Principal ($2500) ← Payment 1 ($500 restante) + Payment 2 ($2000)
└── Charge 3: Postre ($1000) ← Payment 2 ($500 restante) + Payment 3 ($500)
```

### Seguridad

- El webhook de MP NO requiere autenticación JWT (es llamado por servidores de MP)
- Se verifica la firma HMAC del webhook para autenticidad
- Rate limiting en endpoints de pago: 5 requests/minuto por usuario
- Los montos se calculan en el backend; el frontend nunca envía el monto a cobrar

---

## 2. Redis (Bus de Eventos + Cache)

### Descripción General

Redis actúa como el sistema nervioso central del sistema, facilitando la comunicación en tiempo real entre la REST API y el WebSocket Gateway, además de proveer caching y rate limiting.

### Configuración

| Parámetro | Valor | Razón |
|-----------|-------|-------|
| Versión | Redis 7 Alpine | Ligero, con Redis Streams |
| Puerto | 6380 | No-estándar para evitar conflictos con instalaciones locales |
| Persistencia | AOF (Append Only File) | Durabilidad sin sacrificar performance |
| Memoria máxima | 256MB | Suficiente para evento bus + cache |
| Política de evicción | `allkeys-lru` | Evicta claves menos usadas al alcanzar el límite |

### Pools de Conexión

| Pool | Tipo | Máximo | Uso |
|------|------|--------|-----|
| Async pool | `aioredis` | 50 conexiones | REST API (publish), WS Gateway (subscribe) |
| Sync pool | `redis-py` | 20 conexiones | Operaciones síncronas (rate limiting) |

### Usos Detallados

#### 2.1 Pub/Sub (Comunicación entre Servicios)

```
REST API → publish_event(channel, data) → Redis Pub/Sub → WS Gateway → Clientes
```

- **Canales:** Organizados por `branch:{branch_id}` y `session:{session_id}`
- **Formato:** JSON serializado con tipo de evento y payload
- **Garantía:** Best-effort para eventos directos, at-least-once para outbox

#### 2.2 Token Blacklist

```python
# Al hacer logout, el token se agrega a la blacklist
redis.setex(f"blacklist:{token_jti}", ttl=TOKEN_REMAINING_TTL, value="1")

# Al validar un token, se verifica que NO esté en blacklist
is_blacklisted = redis.exists(f"blacklist:{token_jti}")
```

**Patrón fail-closed:** Si Redis no está disponible, se RECHAZAN los tokens (no se asume que son válidos). Esto previene que un token revocado se use durante una caída de Redis.

#### 2.3 Rate Limiting

Implementado con scripts Lua para atomicidad:

```lua
-- Ventana deslizante de rate limiting
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < limit then
    redis.call('ZADD', key, now, now .. math.random())
    redis.call('EXPIRE', key, window)
    return 1  -- Permitido
end
return 0  -- Rate limited
```

**Endpoints con rate limiting:**
- Login: 10 intentos por minuto por IP
- Billing: 5-20 requests por minuto por usuario
- WebSocket messages: 100 mensajes por minuto por conexión

#### 2.4 Session Cache

- Cache de sesiones activas para consultas frecuentes
- TTL configurable por tipo de dato
- Invalidación automática al cambiar estado

#### 2.5 Sector Assignment Cache

```python
# Cache de asignaciones de sector (5 minutos TTL)
cache_key = f"sector_assignments:{branch_id}:{date}"
# Evita consultas repetidas a PostgreSQL para routing de eventos
```

#### 2.6 Cola de Eventos (Redis Streams)

Para eventos críticos, se usa Redis Streams como cola:

- Consumer groups para procesamiento distribuido
- At-least-once delivery
- Dead Letter Queue (DLQ) para mensajes que fallan 3+ veces
- Acknowledgement manual tras procesamiento exitoso

---

## 3. PostgreSQL + pgvector

### Descripción General

PostgreSQL es la base de datos principal del sistema. La extensión pgvector habilita búsqueda por similitud vectorial para las funcionalidades de IA.

### Configuración

| Parámetro | Valor |
|-----------|-------|
| Versión | PostgreSQL 16 |
| Extensión | pgvector |
| Puerto | 5432 |
| Pool | SQLAlchemy 2.0 (sync) |
| Driver | psycopg (async-capable) |

### Estructura de Datos

El sistema tiene **18+ modelos** organizados en dominios:

| Dominio | Modelos | Tabla notable |
|---------|---------|---------------|
| Tenancy | Tenant, Branch | - |
| Menú | Category, Subcategory, Product, BranchProduct | - |
| Alérgenos | Allergen, ProductAllergen, CrossReaction | - |
| Mesas | Table, TableSession, Diner | - |
| Pedidos | Round, RoundItem | - |
| Cocina | KitchenTicket, KitchenTicketItem | - |
| Facturación | Check, Charge, Allocation, Payment | `app_check` (evita palabra reservada SQL) |
| Usuarios | User, UserBranchRole | - |
| Sectores | BranchSector, WaiterSectorAssignment | - |
| Promociones | Promotion, PromotionBranch, PromotionItem | - |
| Recetas | Recipe, Ingredient, SubIngredient | - |
| Eventos | OutboxEvent | - |
| Auditoría | AuditLog | - |
| Fidelización | Customer | - |
| Servicio | ServiceCall | - |

### Convención de Soft Delete

Todas las entidades usan `is_active = False` para eliminación lógica:

```python
# Queries raw DEBEN incluir el filtro
.where(Model.is_active.is_(True))

# Repositories lo hacen automáticamente
repo = TenantRepository(Product, db)
products = repo.find_all(tenant_id=1)  # Ya filtra por is_active
```

### pgvector (Embeddings para IA)

```sql
-- Columna de embeddings
ALTER TABLE products ADD COLUMN embedding vector(768);

-- Índice para búsqueda por similitud
CREATE INDEX ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Búsqueda por similitud
SELECT * FROM products
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

### Herramienta de Administración

- **pgAdmin 4** disponible en puerto 5050
- Acceso configurado en `docker-compose.yml`

---

## 4. Ollama (IA / RAG Local)

### Descripción General

Ollama provee un LLM local para funcionalidades de inteligencia artificial en pwaMenu, como recomendaciones personalizadas y chat asistido.

### Modelos Utilizados

| Modelo | Propósito | Tamaño |
|--------|-----------|--------|
| `qwen2.5:7b` | Modelo de chat (generación de texto) | ~4.7GB |
| `nomic-embed-text` | Modelo de embeddings (vectorización) | ~274MB |

### Variables de Entorno

```bash
# Backend (.env)
OLLAMA_URL=http://localhost:11434    # URL del servidor Ollama
EMBED_MODEL=nomic-embed-text         # Modelo para embeddings
CHAT_MODEL=qwen2.5:7b               # Modelo para conversación
```

### Flujo RAG (Retrieval-Augmented Generation)

```
1. Indexación (background/startup)
   Productos → nomic-embed-text → Embeddings → pgvector

2. Query del comensal
   "Quiero algo picante sin gluten"
   → nomic-embed-text → Query embedding
   → pgvector (búsqueda por similitud coseno)
   → Top-K productos relevantes

3. Generación de respuesta
   Contexto (productos relevantes) + Pregunta del usuario
   → qwen2.5:7b → Respuesta natural con recomendaciones
```

### Componente Frontend

- `pwaMenu/src/components/AIChat/`: Modal de chat con IA (lazy loaded)
- Solo se carga cuando el usuario interactúa con el botón de IA
- Streaming de respuestas para mejor UX

### Consideraciones

- Ollama corre localmente (no requiere API keys externas)
- Requiere GPU para performance aceptable en producción
- En desarrollo, funciona con CPU pero más lento
- El servicio es opcional: si Ollama no está disponible, las funcionalidades de IA se deshabilitan gracefully

---

## 5. Google Fonts

### Descripción General

Fuentes tipográficas servidas desde CDN de Google, utilizadas en todas las aplicaciones frontend.

### Implementación

```html
<!-- En index.html de cada frontend -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Cache por Service Worker

Las fuentes se cachean por el service worker (PWA) con estrategia CacheFirst:

- **Primera carga:** Se descarga del CDN de Google
- **Cargas subsiguientes:** Se sirve desde cache local
- **TTL:** 1 año (las URLs de Google Fonts incluyen hash de contenido)
- **Beneficio:** Funciona offline después de la primera carga

---

## 6. Web Vitals (Monitoreo de Performance)

### Descripción General

Librería de Google para medir métricas reales de rendimiento del usuario (Real User Metrics - RUM).

### Configuración

- **Librería:** `web-vitals` 5.1.0
- **Activación:** Solo en modo desarrollo (`import.meta.env.DEV`)
- **Ubicación:** `*/src/main.tsx` en cada frontend

### Métricas Medidas

| Métrica | Nombre Completo | Qué Mide | Umbral Bueno |
|---------|----------------|-----------|--------------|
| CLS | Cumulative Layout Shift | Estabilidad visual | < 0.1 |
| FID | First Input Delay | Interactividad | < 100ms |
| FCP | First Contentful Paint | Primera pintura con contenido | < 1.8s |
| LCP | Largest Contentful Paint | Carga del contenido principal | < 2.5s |
| TTFB | Time to First Byte | Tiempo de respuesta del servidor | < 800ms |

### Uso

```typescript
// main.tsx
import { reportWebVitals } from './utils/webVitals'

if (import.meta.env.DEV) {
  reportWebVitals(console.log)
}
```

### Relevancia para PWA

Estas métricas son especialmente importantes para las PWAs (pwaMenu, pwaWaiter) donde la experiencia móvil es crítica. Un mal CLS puede causar toques accidentales, y un LCP lento genera abandono.

---

## 7. Service Workers (PWA)

### Descripción General

Las tres aplicaciones frontend son Progressive Web Apps (PWAs) con capacidad offline, instalación nativa y actualizaciones automáticas.

### Herramientas

- **Plugin:** `vite-plugin-pwa` (integración con Vite)
- **Runtime:** Workbox (librería de Google para service workers)

### Estrategias de Cache

| Recurso | Estrategia | TTL | Razón |
|---------|------------|-----|-------|
| Imágenes | CacheFirst | 30 días | Cambian raramente, priorizar velocidad |
| Fuentes (Google Fonts) | CacheFirst | 1 año | Inmutables por hash en URL |
| JavaScript/CSS | StaleWhileRevalidate | - | Servir rápido, actualizar en background |
| API calls | NetworkFirst | - | Datos frescos prioritarios, cache como fallback |
| App shell (HTML) | NetworkFirst | - | Siempre intentar la versión más nueva |

### Configuración Típica

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10
            }
          }
        ]
      }
    })
  ]
})
```

### Actualización Automática

- El service worker verifica actualizaciones cada **1 hora**
- Tipo de registro: `autoUpdate` (se actualiza sin intervención del usuario)
- Al detectar una nueva versión: descarga en background → activa en próxima navegación

### Soporte Offline

| App | Nivel de Soporte Offline |
|-----|-------------------------|
| pwaMenu | Menú cacheado (8h TTL), carrito local, reconexión automática |
| pwaWaiter | Cola de reintentos (retryQueueStore), banner offline, acciones encoladas |
| Dashboard | Limitado (datos en stores persisten, pero operaciones requieren red) |

### pwaWaiter - Cola de Reintentos Offline

```typescript
// retryQueueStore.ts
// Cuando no hay conexión, las acciones se encolan
retryQueue.enqueue({
  action: 'UPDATE_ROUND_STATUS',
  payload: { roundId: 123, status: 'CONFIRMED' },
  timestamp: Date.now()
})

// Al recuperar conexión, se procesan en orden FIFO
retryQueue.processAll()
```

### Componentes PWA en pwaWaiter

| Componente | Propósito |
|------------|-----------|
| `PWAManager.tsx` | Gestión de instalación (prompt "Agregar a pantalla de inicio") |
| `OfflineBanner.tsx` | Banner visual cuando no hay conexión a internet |
| `ConnectionBanner.tsx` | Estado de la conexión WebSocket (conectado/reconectando) |

---

## Diagrama de Integraciones

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   pwaMenu    │     │  pwaWaiter   │     │  Dashboard   │
│              │     │              │     │              │
│ Service Worker│    │ Service Worker│    │ Service Worker│
│ Web Vitals   │     │ Web Vitals   │     │ Web Vitals   │
│ Google Fonts │     │ Google Fonts │     │ Google Fonts │
│ MP Redirect  │     │              │     │              │
│ AI Chat      │     │              │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │ HTTP/WS            │ HTTP/WS            │ HTTP/WS
       │                    │                    │
┌──────┴────────────────────┴────────────────────┴───────┐
│                    REST API + WS Gateway                 │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ MP SDK      │  │ Ollama      │  │ Outbox          │ │
│  │ (pagos)     │  │ (IA/RAG)    │  │ (eventos)       │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
└─────────┼────────────────┼───────────────────┼──────────┘
          │                │                   │
  ┌───────▼──────┐  ┌─────▼──────┐    ┌───────▼──────┐
  │ Mercado Pago │  │   Ollama   │    │    Redis 7   │
  │  (externo)   │  │  (local)   │    │  (Pub/Sub,   │
  │              │  │  qwen2.5   │    │   Cache,     │
  │  Sandbox /   │  │  nomic-    │    │   Blacklist, │
  │  Producción  │  │  embed     │    │   Streams)   │
  └──────────────┘  └────────────┘    └──────────────┘
                                             │
                                      ┌──────▼──────┐
                                      │ PostgreSQL  │
                                      │ 16+pgvector │
                                      │             │
                                      │ 18 modelos  │
                                      │ Embeddings  │
                                      │ Outbox tbl  │
                                      └─────────────┘
```

---

## Resumen de Variables de Entorno por Integración

| Integración | Variable | Ubicación | Ejemplo |
|-------------|----------|-----------|---------|
| Mercado Pago | `MERCADOPAGO_ACCESS_TOKEN` | backend/.env | `APP_USR-...` o `TEST-...` |
| Mercado Pago | `VITE_MP_PUBLIC_KEY` | pwaMenu/.env | `APP_USR-...` o `TEST-...` |
| Redis | `REDIS_URL` | backend/.env | `redis://localhost:6380/0` |
| PostgreSQL | `DATABASE_URL` | backend/.env | `postgresql://user:pass@localhost:5432/db` |
| Ollama | `OLLAMA_URL` | backend/.env | `http://localhost:11434` |
| Ollama | `EMBED_MODEL` | backend/.env | `nomic-embed-text` |
| Ollama | `CHAT_MODEL` | backend/.env | `qwen2.5:7b` |
| JWT | `JWT_SECRET` | backend/.env | `<32+ caracteres aleatorios>` |
| Table Token | `TABLE_TOKEN_SECRET` | backend/.env | `<32+ caracteres aleatorios>` |
| CORS | `ALLOWED_ORIGINS` | backend/.env | `https://tudominio.com` |
| General | `DEBUG` | backend/.env | `false` (producción) |
| General | `ENVIRONMENT` | backend/.env | `production` |
| Cookies | `COOKIE_SECURE` | backend/.env | `true` (producción) |
