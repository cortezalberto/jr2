# 25. Oportunidades de Mejora

> Mejoras identificadas que no son deuda tecnica ni bugs, sino oportunidades para elevar la calidad, rendimiento y experiencia del sistema Integrador / Buen Sabor.

---

## Arquitectura

### 1. Libreria compartida de cliente WebSocket

**Situacion actual**: Dashboard, pwaMenu y pwaWaiter tienen cada uno su propio archivo `websocket.ts` de 500-600 lineas. Los tres implementan la misma logica base: conexion con retry exponencial, heartbeat ping/pong, suscripcion a eventos por tipo, manejo de cierre y reconexion.

**Oportunidad**: Extraer la logica comun en un paquete npm compartido (`@integrador/ws-client`). Cada frontend configura: URL de conexion, tipo de autenticacion (JWT vs Table Token) y handlers de eventos.

**Beneficio**:
- Bug fixes y mejoras se aplican una sola vez.
- Funcionalidades nuevas (event catch-up, buffer offline) se implementan centralmente.
- Reduccion de ~1500 lineas de codigo duplicado.

**Complejidad**: Media. Requiere definir la interfaz publica del cliente, manejar las diferencias de autenticacion y configurar el build del paquete.

---

### 2. Libreria compartida de componentes UI

**Situacion actual**: Componentes como Button, Input, Modal, Toast, ConfirmDialog, LoadingSpinner y ConfirmationModal estan implementados independientemente en cada frontend. Los estilos son similares (Tailwind, tema oscuro, acento naranja) pero no identicos.

**Oportunidad**: Crear un paquete `@integrador/ui` con los componentes base, consumido por los tres frontends. Esto requiere tooling de monorepo (Turborepo, Nx o workspaces de npm/pnpm).

**Beneficio**:
- Consistencia visual garantizada entre las tres aplicaciones.
- Cambios de diseniio (ej: rediseniio de botones) se hacen una vez.
- Nuevos componentes estan disponibles inmediatamente para todos los frontends.

**Complejidad**: Alta. El setup de monorepo es un cambio significativo en la estructura del proyecto. Requiere configuracion de build, versionado y posiblemente migracion de package manager.

---

### 3. Generacion automatica de tipos del API

**Situacion actual**: Los tipos TypeScript del frontend se definen manualmente basandose en las respuestas del backend. Si el backend cambia un campo, el frontend no se entera hasta runtime.

**Oportunidad**: FastAPI genera automaticamente una especificacion OpenAPI (`/docs`, `/openapi.json`). Usando herramientas como `openapi-typescript` o `openapi-typescript-codegen`, se pueden generar automaticamente los tipos e incluso los clientes HTTP del frontend.

**Beneficio**:
- Tipos siempre sincronizados con el backend.
- Cambios de API se detectan en compile time, no en runtime.
- Reduccion de boilerplate en los archivos `api.ts` de cada frontend.

**Complejidad**: Media. La generacion es directa, pero integrarla al workflow de desarrollo (regenerar al cambiar el backend) requiere automatizacion.

---

### 4. Row-Level Security en PostgreSQL

**Situacion actual**: El aislamiento multi-tenant es a nivel de aplicacion. Cada query incluye `tenant_id` como filtro, pero la base de datos no impide que una query mal escrita acceda a datos de otro tenant.

**Oportunidad**: PostgreSQL soporta Row-Level Security (RLS), que permite definir politicas a nivel de tabla: "un usuario solo puede ver filas donde tenant_id = current_setting('app.tenant_id')". Esto es defensa en profundidad.

**Beneficio**:
- Incluso si un endpoint olvida filtrar por tenant, la base de datos lo impide.
- Capa adicional de seguridad sin cambiar la logica de aplicacion.
- Cumple con mejores practicas de seguridad multi-tenant.

**Complejidad**: Media. Requiere configurar RLS policies para cada tabla, establecer el `tenant_id` en la sesion de base de datos al inicio de cada request, y verificar que no rompa queries existentes.

---

### 5. Event Sourcing para facturacion

**Situacion actual**: La facturacion usa el patron Transactional Outbox para garantizar entrega de eventos. Los eventos se escriben atomicamente con los datos de negocio y luego se publican por un procesador de fondo.

**Oportunidad**: Evolucionar hacia Event Sourcing completo para el dominio de facturacion. En lugar de almacenar solo el estado actual de un check/pago, almacenar la secuencia completa de eventos que lo produjeron.

**Beneficio**:
- Audit trail completo e inmutable de toda operacion financiera.
- Capacidad de "replay": reconstruir el estado de cualquier check en cualquier momento.
- "Time travel": ver el estado de la facturacion como era hace 10 minutos.
- Base para funcionalidades futuras como disputas, devoluciones parciales y conciliacion.

**Complejidad**: Alta. Event sourcing es un cambio de paradigma significativo. Requiere disenar los eventos, el event store, las proyecciones y el mecanismo de replay. Se recomienda solo para el dominio de facturacion, no para todo el sistema.

---

## Rendimiento

### 6. Server-Sent Events para CRUD de admin

**Situacion actual**: Los eventos de CRUD del Dashboard (ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED) se transmiten via WebSocket, que es bidireccional. Sin embargo, estos eventos son estrictamente unidireccionales: el servidor notifica al cliente, el cliente nunca envia eventos CRUD al servidor por WebSocket.

**Oportunidad**: Usar Server-Sent Events (SSE) para notificaciones de admin CRUD. SSE es mas simple que WebSocket para flujos unidireccionales: no requiere handshake de upgrade, funciona sobre HTTP estandar, y tiene reconexion automatica nativa en el browser.

**Beneficio**:
- Menor complejidad de infraestructura para eventos admin.
- Reconexion automatica sin implementacion custom.
- Compatible con cualquier proxy HTTP sin configuracion especial.

**Complejidad**: Baja-Media. El backend ya tiene FastAPI que soporta SSE nativamente con `StreamingResponse`. El cambio principal es en el frontend del Dashboard.

**Nota**: Esto NO reemplaza WebSocket para flujos bidireccionales como el carrito de pwaMenu o los eventos de cocina. Es complementario.

---

### 7. Carga diferida de archivos de traduccion

**Situacion actual**: pwaMenu carga los archivos de los tres idiomas (espaniol, ingles, portugues) al inicio, independientemente del idioma seleccionado por el usuario.

**Oportunidad**: Cargar solo el idioma activo al inicio y cargar los demas bajo demanda cuando el usuario cambie de idioma. i18next soporta esto nativamente con `i18next-http-backend`.

**Beneficio**:
- Reduccion del bundle inicial en ~66% para traducciones.
- Primer load mas rapido, especialmente en redes moviles lentas.

**Complejidad**: Baja. i18next tiene soporte nativo. El cambio es principalmente de configuracion.

---

### 8. Pipeline de optimizacion de imagenes

**Situacion actual**: Las imagenes de productos se almacenan y sirven sin procesamiento. No hay resize, no hay compresion, no hay conversion a formatos modernos (WebP, AVIF). La validacion `validate_image_url` verifica seguridad (SSRF) pero no calidad.

**Oportunidad**: Implementar un pipeline de procesamiento de imagenes:
- Upload → resize a multiples tamanios (thumbnail, card, full) → convertir a WebP → almacenar en CDN.
- Servir con `<picture>` y `srcset` para responsive images.

**Beneficio**:
- Reduccion drastica del ancho de banda (WebP es ~30% mas pequenio que JPEG).
- Tiempos de carga del menu mucho mas rapidos.
- Mejor experiencia en dispositivos moviles con pantallas pequenias.

**Complejidad**: Media. Requiere servicio de procesamiento (sharp en Node, Pillow en Python, o servicio externo como Cloudinary/imgproxy). El frontend necesita adaptarse para usar los multiples tamanios.

---

### 9. Cache de Redis para el menu publico

**Situacion actual**: pwaMenu cachea el menu en localStorage con TTL de 5 minutos. Cada request va directo a la base de datos via el endpoint publico `/api/public/menu/{slug}`.

**Oportunidad**: Agregar una capa de cache en Redis en el backend para el menu publico. El menu cambia con poca frecuencia (cuando el admin edita productos o precios), por lo que un cache con invalidacion por evento es ideal.

**Beneficio**:
- Reduccion de queries a PostgreSQL para el endpoint mas consultado.
- Tiempo de respuesta del orden de milisegundos (Redis) vs decenas de milisegundos (PostgreSQL con joins).
- Escalabilidad: un menu cacheado puede servir cientos de requests concurrentes sin tocar la DB.

**Complejidad**: Baja-Media. El cache es directo. La invalidacion requiere escuchar eventos de cambio de producto/categoria/precio y limpiar el cache correspondiente.

---

## Experiencia de Desarrollo

### 10. Tooling de monorepo

**Situacion actual**: Los tres frontends son proyectos independientes. No hay coordinacion de builds, no hay cache de compilacion compartido, no hay forma de ejecutar "lint en todos los frontends" con un solo comando.

**Oportunidad**: Adoptar Turborepo, Nx o pnpm workspaces para gestionar el monorepo. Esto habilita: builds paralelos con cache, comandos cross-project (`turbo lint`), dependencias compartidas y paquetes internos.

**Beneficio**:
- Comandos unificados: `turbo test`, `turbo lint`, `turbo build`.
- Cache de compilacion: si no cambio el codigo de pwaMenu, no se re-compila.
- Prerequisito para la libreria de componentes compartida (#2).

**Complejidad**: Media-Alta. La migracion requiere reestructurar `package.json`, mover dependencias comunes, configurar el task runner y posiblemente cambiar de npm a pnpm.

---

### 11. Storybook para componentes

**Situacion actual**: No hay documentacion visual de componentes. Para entender como se ve un Button con sus variantes, hay que correr la aplicacion y navegar hasta una pagina que lo use.

**Oportunidad**: Implementar Storybook para documentar componentes aislados. Cada componente tiene stories que muestran sus variantes, estados y props.

**Beneficio**:
- Onboarding visual para nuevos developers.
- Desarrollo de componentes aislado del estado de la aplicacion.
- Deteccion de regresiones visuales con snapshots.
- Documentacion viva que siempre esta actualizada.

**Complejidad**: Baja-Media. Storybook se instala facilmente en proyectos React/Vite. La inversion es en escribir las stories.

---

### 12. Portal de documentacion de API

**Situacion actual**: FastAPI genera automaticamente documentacion OpenAPI accesible en `/docs` (Swagger UI) y `/redoc`. Sin embargo, esto solo esta disponible cuando el backend esta corriendo localmente.

**Oportunidad**: Publicar la documentacion de API en un portal estatico (usando Redoc, Stoplight, o generando HTML estatico desde el spec OpenAPI). Disponible sin necesidad de correr el backend.

**Beneficio**:
- Frontend developers pueden consultar la API sin correr el backend.
- Referencia permanente para integraciones externas.
- Versionado de la API documentado.

**Complejidad**: Baja. Exportar el OpenAPI spec y publicarlo como pagina estatica es trivial.

---

### 13. CLI para seed de datos

**Situacion actual**: Los datos de seed estan en un unico archivo grande (~41KB). Para seedear la base de datos se ejecuta este archivo completo. No hay forma de seedear solo una entidad o un subconjunto.

**Oportunidad**: Crear un CLI (`python manage.py seed --entity=categories --branch=1`) que permita seed granular. Cada entidad tiene su propio archivo de seed con dependencias declaradas.

**Beneficio**:
- Seed parcial para testing de features especificas.
- Datos de seed como documentacion ejecutable del modelo de datos.
- Facil de extender cuando se agrega una nueva entidad.

**Complejidad**: Baja. Click o Typer para el CLI, archivos separados por entidad con un orquestador de dependencias.

---

## Producto

### 14. Sistema de reservas

**Situacion actual**: Las mesas funcionan exclusivamente por walk-in. No hay forma de reservar una mesa con anticipacion. Las sesiones se crean cuando el comensal escanea el QR o el mozo activa la mesa.

**Oportunidad**: Agregar un modulo de reservas que permita a los clientes reservar mesa online para una fecha y hora especifica.

**Beneficio**:
- Mejor planificacion del servicio para el restaurante.
- Experiencia premium para el cliente.
- Datos predictivos de demanda.
- Diferenciador competitivo respecto a sistemas de gestion mas basicos.

**Complejidad**: Alta. Requiere nuevo modelo de datos (Reservation), logica de disponibilidad, notificaciones (confirmacion, recordatorio), y posiblemente un frontend publico para reservas.

---

### 15. Soporte para takeout y delivery

**Situacion actual**: El sistema esta disenado exclusivamente para servicio en local (dine-in). Las sesiones estan atadas a mesas fisicas.

**Oportunidad**: Agregar tipos de sesion adicionales: takeout (para llevar) y delivery (envio a domicilio). Un pedido takeout no requiere mesa. Un pedido delivery requiere direccion y logistica.

**Beneficio**:
- Expandir el modelo de negocio del restaurante.
- Aprovechar la infraestructura de menu y pedidos existente.
- Aumentar el revenue sin aumentar la capacidad de mesas.

**Complejidad**: Alta. Requiere refactorizar la relacion Session-Table (sesion sin mesa), agregar flujos de pago anticipado, y potencialmente integrarse con servicios de delivery.

---

### 16. Optimizacion del Kitchen Display

**Situacion actual**: La vista de cocina es un placeholder. Cuando se implemente (Fase 1 del roadmap), la oportunidad es hacerla optimizada desde el inicio.

**Oportunidad**: Diseniar el Kitchen Display con:
- Ordenamiento por prioridad (tiempo de espera, tipo de plato, mesa VIP).
- Estimacion de tiempo de preparacion por producto.
- Agrupacion inteligente (preparar todas las ensaladas juntas aunque sean de mesas distintas).
- Seniales de "empezar a cocinar" basadas en timing de entrega simultanea.

**Beneficio**:
- Cocina mas eficiente con menos estres.
- Mejor coordinacion de tiempos de entrega.
- Reduccion de tiempos de espera para los clientes.

**Complejidad**: Media. La logica de priorizacion puede ser simple inicialmente y sofisticarse con el tiempo.

---

### 17. Dashboard de analitica

**Situacion actual**: Los datos existen (ventas, productos, clientes, horarios) pero no hay visualizacion ni analisis.

**Oportunidad**: Construir un dashboard de analitica con:
- Revenue diario/semanal/mensual con tendencias.
- Top 10 productos por revenue y por cantidad.
- Horarios pico con heatmap por dia y hora.
- Ticket promedio por mesa, por sucursal, por mozo.
- Tasa de rotacion de mesas.
- Productos con baja rotacion (candidatos a descontinuar).

**Beneficio**:
- Decisiones de negocio basadas en datos, no en intuicion.
- Identificacion de oportunidades (horarios muertos -> promociones).
- KPIs medibles para evaluar el impacto de cambios en el menu.

**Complejidad**: Media. Las queries de agregacion son directas. La visualizacion con Recharts o Chart.js es estandar. La complejidad esta en definir los KPIs correctos con el product owner.

---

### 18. Sistema de feedback post-comida

**Situacion actual**: No hay mecanismo para que el cliente deje feedback despues de comer. No hay datos de satisfaccion.

**Oportunidad**: Al cerrar la sesion o al pagar, ofrecer al comensal una pantalla de feedback rapido:
- Rating general (1-5 estrellas).
- Rating por producto consumido.
- Comentario opcional.
- NPS (Net Promoter Score) periodico.

**Beneficio**:
- Datos de satisfaccion para mejorar el servicio.
- Identificacion de productos problematicos.
- Input directo del cliente para decisiones de menu.
- Posibilidad de responder a feedback negativo en tiempo real.

**Complejidad**: Baja-Media. El flujo es simple. La complejidad esta en incentivar al usuario a completar el feedback sin ser invasivo.

---

## Matriz de Impacto vs Esfuerzo

```
                    ESFUERZO
              Bajo      Medio      Alto
         ┌──────────┬──────────┬──────────┐
  Alto   │  7,9,12  │  1,3,8   │  2,14,15 │
         ├──────────┼──────────┼──────────┤
I Medio  │   13     │  4,6,10  │   5,10   │
M        ├──────────┼──────────┼──────────┤
P Bajo   │          │   11     │          │
         └──────────┴──────────┴──────────┘
```

**Quick wins** (alto impacto, bajo esfuerzo): #7 lazy translations, #9 Redis cache menu, #12 API docs portal.

**Inversiones estrategicas** (alto impacto, alto esfuerzo): #2 UI library, #14 reservas, #15 takeout/delivery.

---

*Ultima actualizacion: Abril 2026*
