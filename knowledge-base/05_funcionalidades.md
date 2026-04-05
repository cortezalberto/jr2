# Catálogo de Funcionalidades

Este documento describe de forma exhaustiva todas las funcionalidades del sistema **Integrador / Buen Sabor**, organizadas por componente.

---

## 1. Dashboard (Panel de Administración - Puerto 5177)

El Dashboard es la interfaz de gestión centralizada para administradores y gerentes. Permite controlar todos los aspectos operativos del restaurante de forma multi-sucursal.

### 1.1 Gestión de Restaurante

- Configuración global del tenant: nombre, logo, banner, color temático (naranja `#f97316` por defecto).
- Cada tenant puede administrar múltiples sucursales desde un único panel.
- Importación y exportación de configuración en formato JSON.

### 1.2 Gestión de Sucursales (Branches)

- CRUD completo de sucursales con horarios de apertura y cierre.
- Dirección física con datos de localización.
- Cada sucursal opera de forma independiente con sus propias categorías, precios, mesas y personal.
- Slug único por sucursal para acceso público al menú (`/api/public/menu/{slug}`).

### 1.3 Gestión de Categorías

- Las categorías están acotadas por sucursal (branch-scoped).
- Soporte de ordenamiento personalizado para controlar la presentación en el menú.
- Operaciones CRUD completas con validación de unicidad dentro de la sucursal.

### 1.4 Gestión de Subcategorías

- Anidadas dentro de categorías.
- Herencia del alcance de sucursal desde la categoría padre.
- Ordenamiento independiente dentro de cada categoría.

### 1.5 Gestión de Productos

Editor completo de productos con las siguientes capacidades:

- **Información básica**: nombre, descripción, imagen (URL validada contra SSRF).
- **Alérgenos**: sistema de tres niveles por producto:
  - `contains` (contiene): el producto contiene el alérgeno.
  - `may_contain` (puede contener): riesgo de contaminación cruzada.
  - `free_from` (libre de): certificado libre del alérgeno.
- **Precios por sucursal**: cuando `use_branch_prices=true`, cada sucursal define su precio en centavos mediante registros `BranchProduct`. Cuando es `false`, se usa un precio base único.
- **Imágenes**: URL de imagen con validación de seguridad (bloqueo de IPs internas y metadata de cloud).
- **Flags especiales**:
  - `is_featured`: producto destacado.
  - `is_popular`: producto popular.
- **Badges y sellos**: etiquetas visuales asociadas al producto.
- **Receta asociada**: vínculo con el sistema de recetas para la cocina.

### 1.6 Gestión de Precios

- Precio almacenado en centavos (ej: $125,50 = 12550).
- Pricing masivo con capacidad de importación y exportación.
- Precios diferenciados por sucursal a través de `BranchProduct`.
- Activación/desactivación de productos por sucursal (`is_active` en `BranchProduct`).

### 1.7 Gestión de Alérgenos

- Catálogo global de alérgenos con cumplimiento de la normativa **EU 1169/2011**.
- Niveles de severidad: `mild` (leve), `moderate` (moderado), `severe` (severo), `life_threatening` (potencialmente mortal).
- Sistema de reacciones cruzadas (ej: látex advierte sobre kiwi y banana).
- Asociación M:N entre productos y alérgenos con tipo de presencia y nivel de riesgo.

### 1.8 Gestión de Badges y Sellos

- Badges: etiquetas visuales para destacar productos (ej: "Nuevo", "Más vendido").
- Sellos: certificaciones o marcas de calidad asociadas a productos.
- Asignación flexible a múltiples productos.

### 1.9 Gestión de Promociones

- Combos y promociones basadas en tiempo con programación de fecha y hora.
- Soporte multi-sucursal: una promoción puede aplicar a varias sucursales simultáneamente.
- Tipos de promoción configurables.
- Validación de vigencia temporal (fecha de inicio y fin, horarios activos).

### 1.10 Gestión de Mesas

- Interfaz de grilla (grid) visual para administrar mesas.
- Workflow de 5 estados:
  1. **Libre** (verde): mesa disponible.
  2. **Ocupada** (rojo): mesa con comensales activos.
  3. **Solicitó pedido** (amarillo): mesa con pedido pendiente de confirmación.
  4. **Pedido cumplido** (naranja): pedido listo y entregado.
  5. **Cuenta solicitada** (violeta): comensales pidieron la cuenta.
- Códigos alfanuméricos de mesa (ej: "INT-01"). Los códigos NO son únicos entre sucursales; se requiere el `branch_slug` para desambiguar.
- Asociación mesa-sector para organización espacial.

### 1.11 Gestión de Personal (Staff)

- CRUD de usuarios con asignación de roles por sucursal.
- Roles predefinidos: `ADMIN`, `MANAGER`, `KITCHEN`, `WAITER`.
- Relación M:N entre usuarios y sucursales a través de `UserBranchRole`.
- Un usuario puede tener diferentes roles en diferentes sucursales.

### 1.12 Gestión de Roles

- Roles predefinidos con permisos diferenciados según RBAC:
  - **ADMIN**: acceso total (crear, editar, eliminar todo).
  - **MANAGER**: gestión de personal, mesas, alérgenos y promociones en sus sucursales asignadas.
  - **KITCHEN**: solo lectura/actualización de estados de cocina.
  - **WAITER**: solo operaciones de servicio en sala.

### 1.13 Gestión de Sectores

- Sectores dentro de cada sucursal (ej: Interior, Terraza, Barra, VIP).
- Asignación diaria de mozos a sectores (`WaiterSectorAssignment`).
- Los eventos WebSocket con `sector_id` se enrutan solo a los mozos asignados a ese sector.

### 1.14 Gestión de Recetas e Ingredientes

- Recetas de cocina asociadas a productos.
- Grupos de ingredientes (`IngredientGroup`) para organización.
- Ingredientes con sub-ingredientes (`SubIngredient`).
- Todos los catálogos de cocina están acotados por tenant: `CookingMethod`, `FlavorProfile`, `TextureProfile`, `CuisineType`.

### 1.15 Historial de Pedidos

- Pedidos archivados por sucursal.
- Historial por cliente (asociado al sistema de fidelización).
- Consulta de sesiones cerradas con detalle de rondas, ítems y pagos.

### 1.16 Vista de Cocina (Kitchen Display)

- Vista específica para el personal de cocina (actualmente placeholder).
- Diseñada para mostrar tickets de pedidos en tiempo real.

### 1.17 Estadísticas

- Estadísticas de ventas por sucursal (placeholder).
- Historial por cliente (placeholder).
- Diseñado para integración futura con dashboards analíticos.

### 1.18 Configuración

- Configuración general de la aplicación.
- Importación y exportación de datos en formato JSON.

### 1.19 Actualizaciones en Tiempo Real

- Conexión WebSocket al endpoint `/ws/admin`.
- Eventos de sincronización CRUD: `ENTITY_CREATED`, `ENTITY_UPDATED`, `ENTITY_DELETED`.
- Notificaciones de eliminación en cascada (`CASCADE_DELETE`) con preview de entidades afectadas.
- Sincronización multi-pestaña vía `BroadcastChannel`.

---

## 2. pwaMenu (PWA del Cliente - Puerto 5176)

Aplicación PWA orientada al comensal. Permite explorar el menú, realizar pedidos colaborativos y gestionar el pago desde el celular.

### 2.1 Ingreso por QR

- El cliente escanea un código QR ubicado en la mesa.
- Ingresa el número de mesa (alfanumérico, ej: "INT-01") y opcionalmente su nombre.
- Se une a la sesión activa de la mesa o se crea una nueva si no existe.
- Se emite un `table_token` (HMAC) con vigencia de 3 horas para autenticar al comensal.

### 2.2 Navegación del Menú

- Estructura jerárquica: Categorías > Subcategorías > Productos.
- Cada producto muestra imagen, precio (convertido de centavos a pesos), descripción y badges.
- Menú cacheado por 5 minutos para reducir llamadas al backend.
- Datos en localStorage con TTL de 8 horas basado en última actividad.

### 2.3 Filtrado Avanzado

- **Filtros de alérgenos**:
  - Modo estricto: oculta productos que "contienen" el alérgeno.
  - Modo muy estricto: oculta productos que "contienen" o "pueden contener" el alérgeno.
  - Reacciones cruzadas: seleccionar látex advierte automáticamente sobre kiwi/banana.
- **Opciones dietéticas**: vegetariano, vegano, sin gluten, keto, entre otros.
- **Filtros por método de cocción**: a la parrilla, al horno, frito, etc.

### 2.4 Búsqueda

- Barra de búsqueda con debounce de 300ms para evitar llamadas excesivas.
- Búsqueda sobre nombre y descripción de productos.

### 2.5 Carrito Compartido (Shared Cart)

- Carrito sincronizado en tiempo real entre todos los comensales de la mesa.
- Cada ítem muestra quién lo agregó mediante color y nombre del comensal.
- Eventos WebSocket: `CART_ITEM_ADDED`, `CART_ITEM_UPDATED`, `CART_ITEM_REMOVED`, `CART_CLEARED`.
- Sincronización multi-pestaña mediante eventos de `localStorage`.

### 2.6 Confirmación Grupal de Pedido

1. Un comensal propone enviar el pedido ("Proponer enviar pedido").
2. Se muestra el `RoundConfirmationPanel` a todos los comensales de la mesa.
3. Cada comensal confirma tocando "Estoy listo".
4. Cuando todos confirman, se espera 1,5 segundos y se envía automáticamente.
5. Si no todos confirman en 5 minutos, la propuesta expira.
6. El proponente puede cancelar la propuesta en cualquier momento.

### 2.7 Seguimiento de Pedidos

- Seguimiento en tiempo real del estado de cada ronda vía WebSocket.
- Estados visibles para el comensal: `IN_KITCHEN` (en cocina), `READY` (listo), `SERVED` (servido).
- Los estados `PENDING`, `CONFIRMED` y `SUBMITTED` son internos (el comensal no los ve directamente).

### 2.8 Llamadas de Servicio (Service Calls)

- El comensal puede llamar al mozo desde la app.
- Solicitar servicios específicos (ej: más servilletas, consulta).
- El mozo recibe notificación en tiempo real con animación de parpadeo rojo.

### 2.9 Solicitud de Cuenta

- Acceso desde el `BottomNav` > "Cuenta" > página `CloseTable`.
- Métodos de división:
  - **Partes iguales**: total dividido por cantidad de comensales.
  - **Por consumo**: cada comensal paga lo que pidió.
  - **Personalizado**: montos manuales.
- Selección de método de pago antes de procesar.

### 2.10 Integración con Mercado Pago

- Soporte para entornos sandbox y producción.
- Flujo: crear preferencia de pago > redirigir a Mercado Pago > procesar > callback a `/payment/result`.
- Eventos `PAYMENT_APPROVED` / `PAYMENT_REJECTED` vía Outbox Pattern para garantía de entrega.

### 2.11 Chat con IA

- Recomendaciones impulsadas por inteligencia artificial.
- Carga diferida (lazy loaded) para no impactar el rendimiento inicial.

### 2.12 Capacidades PWA

- Soporte offline mediante Service Worker.
- Prompt de instalación para agregar al home screen.
- Caching de recursos estáticos y datos del menú.

### 2.13 Internacionalización (i18n)

- Idiomas soportados: Español (base), Inglés, Portugués.
- Cadena de fallback: idioma seleccionado > español > clave literal.
- TODA cadena visible al usuario debe usar `t()` -- cero strings hardcodeados.

### 2.14 Fidelización de Clientes (Customer Loyalty)

Sistema en 4 fases:
1. **Fase 1**: Tracking por dispositivo (`device_id`).
2. **Fase 2**: Sincronización de preferencias implícitas.
3. **Fase 3**: Reconocimiento del cliente recurrente.
4. **Fase 4**: Opt-in del cliente con consentimiento GDPR.

### 2.15 Sincronización Multi-Pestaña

- Eventos de `localStorage` sincronizan el carrito entre pestañas del mismo navegador.
- Cambios en una pestaña se reflejan inmediatamente en las demás.

### 2.16 TTL de Sesión de 8 Horas

- La sesión expira tras 8 horas de inactividad (basado en última actividad, no en creación).
- Al expirar, se limpian datos del `localStorage` y se redirige al ingreso.

---

## 3. pwaWaiter (PWA del Mozo - Puerto 5178)

Aplicación PWA diseñada para mozos. Ofrece gestión de mesas en tiempo real con agrupación por sector y toma de pedidos.

### 3.1 Selección de Sucursal Pre-Login

- Antes de autenticarse, el mozo selecciona la sucursal donde trabajará.
- Se consulta `GET /api/public/branches` (sin autenticación).
- Esta selección determina el contexto de trabajo para toda la sesión.

### 3.2 Verificación de Asignación

- Tras el login, se verifica que el mozo esté asignado a la sucursal seleccionada para el día de HOY.
- `GET /api/waiter/verify-branch-assignment?branch_id={id}`.
- Si no está asignado, se muestra "Acceso Denegado" y debe seleccionar otra sucursal.

### 3.3 Grilla de Mesas

- Mesas agrupadas por sector (Interior, Terraza, etc.).
- Estados visuales con colores:
  - **Verde**: libre.
  - **Rojo**: ocupada.
  - **Violeta**: cuenta solicitada.
  - **Gris**: fuera de servicio.
- **Animaciones en tiempo real**:
  - Parpadeo rojo: llamada de servicio (URGENTE).
  - Pulso amarillo: nuevo pedido pendiente de confirmación.
  - Parpadeo naranja: pedido listo + otras rondas aún en cocina.
  - Parpadeo azul: cambio de estado de mesa.
  - Pulso violeta: cuenta solicitada.

### 3.4 Modal de Detalle de Mesa

- Información completa de la sesión activa.
- Rondas filtradas por estado: pendientes, listas, servidas.
- Resolución de llamadas de servicio.
- Acciones contextuales según estado de la mesa.

### 3.5 Comanda Rápida (Autogestión)

Modal de dos pasos para que el mozo tome pedidos de clientes sin celular:

**Paso 1: Selección de mesa**
- Mesa LIBRE: ingresa cantidad de comensales > `activateTable()` crea la sesión.
- Mesa ACTIVA: usa la sesión existente.

**Paso 2: Menú compacto**
- Menú sin imágenes vía `GET /api/waiter/branches/{id}/menu`.
- Panel izquierdo: navegación por categorías y productos.
- Agregar ítems al carrito con cantidad.
- Panel derecho: revisión del carrito, modificación de cantidades.
- Enviar > `submitRound()` > ronda en estado `PENDING`.

### 3.6 Gestión de Rondas

- Confirmar pedidos pendientes (`PENDING` > `CONFIRMED`).
- Marcar rondas como servidas (`READY` > `SERVED`).
- Eliminar ítems individuales de una ronda.
- Si se eliminan todos los ítems, la ronda se auto-elimina.

### 3.7 Manejo de Llamadas de Servicio

- Workflow de dos pasos: Reconocer (acknowledge) > Resolver (close).
- Notificación visual con parpadeo rojo en la grilla de mesas.
- Cada llamada se trackea individualmente.

### 3.8 Facturación y Pagos

- Solicitar cuenta para una mesa.
- Registrar pagos manuales:
  - Efectivo.
  - Tarjeta.
  - Transferencia.
- Cerrar mesa tras el pago completo.

### 3.9 Factura Fiscal

- Generación de PDF de factura mediante `html2canvas` + `jspdf`.
- Formato de comprobante con detalle de ítems, subtotales y total.

### 3.10 Cola Offline

- Las acciones fallidas se encolan para reintento automático cuando se recupera la conectividad.
- Almacenamiento en `IndexedDB` y `localStorage`.
- Banner de estado de conexión visible en la interfaz.

### 3.11 Capacidades PWA

- Prompt de instalación.
- Banner offline cuando se pierde conectividad.
- Banner de estado de conexión en tiempo real.

---

## 4. Backend (API REST - Puerto 8000)

API REST construida con FastAPI, PostgreSQL y Redis. Implementa Clean Architecture con Domain Services.

### 4.1 Autenticación

- Login con email y contraseña > JWT (access token 15min + refresh token 7 días en HttpOnly cookie).
- Refresh proactivo cada 14 minutos desde los frontends.
- Logout con blacklist del token en Redis.
- Patrón fail-closed: si Redis no está disponible, se rechaza el token.

### 4.2 API Pública (Sin Autenticación)

- `GET /api/public/menu/{slug}`: menú completo de una sucursal.
- `GET /api/public/branches`: listado de sucursales (usado por pwaWaiter pre-login).

### 4.3 API de Administración

- CRUD para todas las entidades con paginación (`?limit=50&offset=0` por defecto).
- Protegido por JWT + validación de roles según RBAC.
- Eventos WebSocket emitidos tras cada operación CRUD.

### 4.4 API del Mozo

- `POST /api/waiter/tables/{id}/activate`: activar mesa (crear sesión).
- `POST /api/waiter/sessions/{id}/rounds`: enviar ronda para clientes sin celular.
- `POST /api/waiter/sessions/{id}/check`: solicitar cuenta.
- `POST /api/waiter/payments/manual`: registrar pago manual.
- `POST /api/waiter/tables/{id}/close`: cerrar mesa.
- `GET /api/waiter/branches/{id}/menu`: menú compacto sin imágenes.
- `GET /api/waiter/verify-branch-assignment`: verificar asignación diaria.

### 4.5 API del Comensal

- `POST /api/diner/register`: registrar comensal con `device_id`.
- `POST /api/diner/rounds/submit`: enviar ronda.
- Autenticación vía header `X-Table-Token`.

### 4.6 API de Cocina

- Actualización de estados de rondas.
- Gestión de tickets de cocina (`KitchenTicket`).
- Protegido por JWT + rol `KITCHEN`.

### 4.7 API de Facturación (Billing)

- Solicitud de cuenta.
- Creación de preferencia de Mercado Pago.
- Registro de pagos.
- Rate limiting: 5-20 requests/minuto según endpoint.
- Eventos críticos vía Outbox Pattern.

### 4.8 API de Recetas

- CRUD de recetas.
- Protegido por JWT + roles `KITCHEN`, `MANAGER` o `ADMIN`.

### 4.9 Soft Delete

- Todas las entidades usan `is_active=false` en lugar de eliminación física.
- Hard delete solo para registros efímeros (ítems de carrito, sesiones expiradas).
- `cascade_soft_delete()` desactiva la entidad y todos sus dependientes.
- Evento `CASCADE_DELETE` vía WebSocket con detalle de entidades afectadas.

### 4.10 Sistema de Permisos

- `PermissionContext`: extrae contexto del JWT (user_id, tenant_id, branch_ids, roles).
- Métodos de validación: `require_management()`, `require_branch_access(branch_id)`.
- Errores centralizados: `ForbiddenError`, `NotFoundError`, `ValidationError` con logging automático.

### 4.11 Rate Limiting

- Login: 5 intentos por minuto.
- Endpoints de billing: 5-20 por minuto según criticidad.
- Protección contra abuso y ataques de fuerza bruta.

---

## 5. WebSocket Gateway (Puerto 8001)

Gateway dedicado para comunicación en tiempo real, independiente de la API REST.

### 5.1 Endpoints

| Endpoint | Autenticación | Descripción |
|----------|---------------|-------------|
| `/ws/waiter?token=JWT` | JWT | Notificaciones para mozos (filtradas por sector) |
| `/ws/kitchen?token=JWT` | JWT | Notificaciones para cocina |
| `/ws/diner?table_token=X` | Table Token | Actualizaciones para comensales |
| `/ws/admin?token=JWT` | JWT | Notificaciones para administración |

### 5.2 Tipos de Eventos

Más de 30 tipos de eventos organizados por dominio:

**Rondas (Round lifecycle)**:
`ROUND_PENDING`, `ROUND_CONFIRMED`, `ROUND_SUBMITTED`, `ROUND_IN_KITCHEN`, `ROUND_READY`, `ROUND_SERVED`, `ROUND_CANCELED`

**Carrito (Cart sync)**:
`CART_ITEM_ADDED`, `CART_ITEM_UPDATED`, `CART_ITEM_REMOVED`, `CART_CLEARED`

**Servicio**:
`SERVICE_CALL_CREATED`, `SERVICE_CALL_ACKED`, `SERVICE_CALL_CLOSED`

**Facturación**:
`CHECK_REQUESTED`, `CHECK_PAID`, `PAYMENT_APPROVED`, `PAYMENT_REJECTED`

**Mesas**:
`TABLE_SESSION_STARTED`, `TABLE_CLEARED`, `TABLE_STATUS_CHANGED`

**Administración**:
`ENTITY_CREATED`, `ENTITY_UPDATED`, `ENTITY_DELETED`, `CASCADE_DELETE`

### 5.3 Enrutamiento por Sector

- Los eventos con `sector_id` se envían solo a los mozos asignados a ese sector.
- Los roles `ADMIN` y `MANAGER` reciben TODOS los eventos de la sucursal.
- Este enrutamiento evita sobrecargar a mozos con información de sectores ajenos.

### 5.4 Garantía de Entrega (Outbox Pattern)

| Patrón | Eventos | Característica |
|--------|---------|----------------|
| **Outbox** (no se puede perder) | `CHECK_REQUESTED/PAID`, `PAYMENT_*`, `ROUND_SUBMITTED/READY`, `SERVICE_CALL_CREATED` | Escritura atómica en DB, publicación por procesador de fondo |
| **Redis directo** (baja latencia) | `ROUND_CONFIRMED/IN_KITCHEN/SERVED`, `CART_*`, `TABLE_*`, `ENTITY_*` | Publicación inmediata, menor latencia |

### 5.5 Heartbeat

- El cliente envía `{"type":"ping"}` cada 30 segundos.
- El servidor responde `{"type":"pong"}`.
- Timeout de 60 segundos para conexiones sin actividad.
- Códigos de cierre: `4001` (auth fallida), `4003` (prohibido), `4029` (rate limited).

### 5.6 Rate Limiting

- 20 mensajes por segundo por conexión.
- Exceder el límite resulta en cierre con código `4029`.

### 5.7 Circuit Breaker

- Se activa tras 5 fallos consecutivos.
- Estado abierto por 30 segundos antes de intentar recuperación.
- Protege contra cascadas de errores en Redis u otros servicios externos.

### 5.8 Arquitectura Interna

- Composición y patrones de diseño (Strategy, Router).
- Autenticación via Strategy Pattern: `JWTAuthStrategy` para staff, `TableTokenAuthStrategy` para comensales.
- Locks fragmentados por sucursal para alta concurrencia (400+ usuarios).
- Worker pool de broadcast: 10 workers paralelos (~160ms para 400 usuarios) con fallback legacy de batches de 50.
- Redis Streams consumer para eventos críticos (at-least-once delivery, DLQ para mensajes fallidos).
