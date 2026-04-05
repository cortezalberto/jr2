# 19. Decisiones Tecnicas

## Introduccion

Cada decision arquitectonica en Integrador fue tomada con un proposito especifico. Este documento registra las decisiones mas importantes, el razonamiento detras de cada una, las alternativas que se evaluaron y los tradeoffs aceptados. Sirve como referencia para entender POR QUE el sistema es como es, no solo COMO funciona.

---

## 1. FastAPI sobre Django y Flask

### Contexto

Se necesitaba un framework backend en Python que soportara operaciones asincronas de forma nativa, especialmente para el Gateway WebSocket y las conexiones Redis.

### Decision

FastAPI como framework web principal.

### Razonamiento

- **Async nativo**: FastAPI corre sobre Starlette (ASGI), lo que permite `async/await` sin hacks ni librerias adicionales. Esto es critico para el WebSocket Gateway que maneja cientos de conexiones simultaneas.
- **Documentacion automatica**: OpenAPI/Swagger se genera automaticamente a partir de los type hints de Python y los schemas Pydantic. No hay documentacion que mantener manualmente.
- **Pydantic integrado**: La validacion de datos de entrada y salida es declarativa. Los schemas sirven simultaneamente como validacion, documentacion y serializacion.
- **Rendimiento**: FastAPI es uno de los frameworks Python mas rapidos, comparable a Node.js y Go para operaciones I/O-bound.

### Alternativas Evaluadas

| Framework | Por que se descarto |
|-----------|-------------------|
| Django | Demasiado opinionado. ORM propio (no SQLAlchemy). Admin panel innecesario para APIs REST puras. Soporte async incompleto en la version evaluada. |
| Flask | Sincrono por defecto. Sin validacion de tipos nativa. Sin documentacion automatica. Requiere muchas extensiones para igualar FastAPI. |
| Express (Node.js) | Se prefirio mantener un solo lenguaje en backend (Python). SQLAlchemy es superior a los ORMs de Node.js para consultas complejas. |

### Tradeoffs Aceptados

- Ecosistema mas chico que Django (menos paquetes, menos tutoriales).
- No tiene panel de administracion built-in (se construyo el Dashboard custom).
- Comunidad mas joven, menos respuestas en StackOverflow para problemas especificos.

---

## 2. Gateway WebSocket Separado

### Contexto

El sistema requiere comunicacion en tiempo real para multiples funcionalidades: sincronizacion de carrito compartido, notificaciones de cocina, actualizaciones de estado de mesas y pedidos.

### Decision

Servicio WebSocket independiente (puerto 8001) separado de la API REST (puerto 8000).

### Razonamiento

- **Separacion de concerns**: La API REST maneja request-response, el Gateway maneja conexiones persistentes. Son patrones fundamentalmente distintos.
- **Escalado independiente**: El Gateway puede necesitar mas recursos cuando hay muchos comensales conectados simultaneamente, sin afectar la API REST.
- **Optimizaciones especializadas**: El Gateway implementa worker pool broadcast (10 workers, ~160ms para 400 usuarios), sharded locks por sucursal, y circuit breaker para Redis. Estas optimizaciones solo tienen sentido en el contexto de conexiones persistentes.
- **Codigo compartido**: Los modulos comunes viven en `backend/shared/` y son importados por ambos servicios via `PYTHONPATH`.

### Alternativas Evaluadas

| Enfoque | Por que se descarto |
|---------|-------------------|
| WebSocket en el mismo servidor FastAPI | Acoplamiento. Un deploy afecta ambos. No se puede escalar independientemente. |
| Socket.io | Demasiado pesado. Abstracciones innecesarias (rooms, namespaces). WebSocket nativo es suficiente. |
| Server-Sent Events (SSE) | Unidireccional. El carrito compartido necesita comunicacion bidireccional. |

### Tradeoffs Aceptados

- Un servicio mas para desplegar y monitorear.
- Necesidad de `PYTHONPATH` para compartir codigo entre servicios.
- Dos puntos de autenticacion (ambos validan tokens, pero de forma independiente).

---

## 3. React 19 con React Compiler

### Contexto

Los tres frontends necesitaban un framework de UI reactivo, performante y con buen ecosistema.

### Decision

React 19.2 con `babel-plugin-react-compiler` habilitado en los tres frontends.

### Razonamiento

- **Auto-memorizacion**: El compilador de React elimina la necesidad de `React.memo`, `useMemo` y `useCallback` manuales. Esto reduce bugs de rendimiento causados por memorizacion olvidada o incorrecta.
- **Nuevas APIs**: `useActionState` y `useOptimistic` simplifican el manejo de formularios y actualizaciones optimistas (critico para la experiencia de comanda rapida).
- **Futuro del ecosistema**: React 19 es el futuro. Adoptarlo temprano evita una migracion dolorosa mas adelante.

### Alternativas Evaluadas

| Framework | Por que se descarto |
|-----------|-------------------|
| React 18 (estable) | Sin compilador, sin nuevas APIs. Migracion inevitable a futuro. |
| Vue 3 | Ecosistema mas chico. Menos candidatos para contratar en el mercado. |
| Angular | Demasiado opinionado para un equipo chico. Bundle size mayor. Curva de aprendizaje mas pronunciada. |
| Svelte | Ecosistema inmaduro para aplicaciones empresariales. Menos librerias de componentes. |

### Tradeoffs Aceptados

- Bleeding edge: menos soporte de la comunidad para problemas especificos.
- El compilador tiene limitaciones (no puede optimizar hooks condicionales).
- Algunos paquetes del ecosistema pueden no ser compatibles con React 19.

---

## 4. Zustand sobre Redux

### Contexto

Los tres frontends necesitan state management para manejar datos de sesion, carrito, mesas, pedidos y autenticacion.

### Decision

Zustand 5.0 como libreria de state management en todos los frontends.

### Razonamiento

- **Simplicidad radical**: Un store de Zustand es un hook. No hay actions, reducers, middleware, ni ceremony. El boilerplate es 10 veces menor que Redux.
- **Tamano**: 2KB vs 40KB+ de Redux Toolkit. En PWAs donde el bundle size importa, esta diferencia es significativa.
- **Patron de selectores**: Los selectores de Zustand previenen re-renders innecesarios de forma natural. Combinado con `useShallow`, el rendimiento es optimo.
- **Compatibilidad con React 19**: Zustand funciona perfectamente con el compilador de React sin adaptaciones.

### Alternativas Evaluadas

| Libreria | Por que se descarto |
|----------|-------------------|
| Redux Toolkit | Demasiado boilerplate para este proyecto. Actions, reducers, slices, middleware. Overkill para equipos chicos. |
| Jotai | Atomico, interesante, pero fragmenta el estado en demasiadas piezas. Zustand permite stores coherentes por dominio. |
| React Context | No tiene optimizacion de selectores. Cualquier cambio re-renderiza todos los consumidores. Inaceptable para performance. |
| Signals (Preact) | No es nativo de React. Requiere workarounds y tiene futuro incierto en el ecosistema React. |

### Tradeoffs Aceptados

- Menos devtools que Redux (no hay time-travel debugging).
- Menos middleware disponible (no hay saga, thunk como paquetes separados).
- Requiere disciplina con selectores: nunca destructurar el store directamente (causa loops infinitos de re-render).

---

## 5. Transactional Outbox para Eventos Criticos

### Contexto

Los eventos financieros (facturacion, pagos) no pueden perderse bajo ninguna circunstancia. Un pago registrado en la base de datos pero no notificado al mozo causa inconsistencias criticas.

### Decision

Patron Transactional Outbox para eventos criticos (CHECK_REQUESTED, CHECK_PAID, PAYMENT_*, ROUND_SUBMITTED, ROUND_READY, SERVICE_CALL_CREATED).

### Razonamiento

- **Atomicidad garantizada**: El evento se escribe en la misma transaccion que los datos de negocio. Si la transaccion falla, ambos se revierten. Si la transaccion commitea, el evento existe garantizado.
- **Desacople temporal**: Un procesador en background lee la tabla outbox y publica a Redis. Si Redis esta caido, los eventos se acumulan y se publican cuando vuelva.
- **Auditoria**: La tabla outbox sirve como log de auditoria de eventos financieros.

### Alternativas Evaluadas

| Enfoque | Por que se descarto |
|---------|-------------------|
| Publicar directo a Redis despues del commit | Si Redis falla entre el commit y la publicacion, el evento se pierde silenciosamente. Inaceptable para pagos. |
| Event sourcing completo | Complejidad desproporcionada para el tamano del proyecto. Requiere CQRS, proyecciones, snapshots. |
| Kafka/RabbitMQ | Infraestructura adicional. Redis es suficiente como broker para este volumen. |

### Tradeoffs Aceptados

- Tabla adicional en la base de datos (outbox).
- Procesador en background necesario para drenar la cola.
- Latencia ligeramente mayor que publicacion directa a Redis.

---

## 6. Redis Directo para Eventos No Criticos

### Contexto

Muchos eventos (actualizacion de carrito, cambio de estado de mesa, CRUD de entidades) no requieren garantia de entrega. La baja latencia es mas importante.

### Decision

Publicacion directa a Redis para eventos no criticos (CART_*, TABLE_*, ENTITY_*, ROUND_CONFIRMED, ROUND_IN_KITCHEN, ROUND_SERVED).

### Razonamiento

- **Latencia minima**: La publicacion directa a Redis agrega ~1ms vs ~50ms del outbox.
- **Simplicidad**: Un `publish_event()` en una linea, sin tablas adicionales ni procesadores.
- **Aceptable perder**: Si un evento de carrito se pierde, el comensal simplemente no ve la actualizacion en tiempo real. Puede refrescar la pagina.

### Tradeoffs Aceptados

- Si Redis cae momentaneamente, estos eventos se pierden.
- El equipo debe saber claramente que patron usar para cada tipo de evento nuevo (ver tabla en CLAUDE.md).

---

## 7. Dual Auth: JWT + HMAC Table Tokens

### Contexto

El sistema tiene dos tipos de usuarios fundamentalmente distintos: staff (mozos, cocina, admin) que necesitan cuentas persistentes, y clientes que escanean un QR y quieren acceso inmediato sin registro.

### Decision

JWT con refresh token para staff. HMAC table tokens para clientes.

### Razonamiento

- **Staff (JWT)**: Necesitan sesiones persistentes, roles, permisos. JWT + refresh token en HttpOnly cookie es el estandar de la industria.
- **Clientes (Table Token)**: Zero-friction. Escanean un QR, obtienen un token de mesa de 3 horas. Sin login, sin registro, sin passwords.
- **Separacion clara**: El header `Authorization: Bearer` es para staff. El header `X-Table-Token` es para clientes. No hay ambiguedad.

### Tradeoffs Aceptados

- Dos estrategias de autenticacion para mantener y testear.
- Los table tokens son menos seguros (pueden compartirse).
- El WebSocket Gateway necesita validar ambos tipos de token.

---

## 8. Soft Delete en Todas las Entidades

### Contexto

Los datos de un restaurante tienen valor historico. Una categoria eliminada puede tener productos asociados que aparecen en pedidos pasados. Un mozo desactivado puede tener turnos historicos.

### Decision

Soft delete (`is_active = False`) como mecanismo por defecto. Hard delete solo para registros efimeros (items del carrito, sesiones expiradas).

### Razonamiento

- **Integridad referencial**: Los pedidos historicos pueden referenciar productos o categorias que ya no estan activos.
- **Auditoria**: Siempre se puede saber que existio y quien lo desactivo.
- **Recuperacion**: Un error humano (eliminar una categoria con 50 productos) se revierte cambiando un flag, no restaurando un backup.

### Tradeoffs Aceptados

- TODAS las consultas deben filtrar por `is_active = True`. Olvidarse de este filtro expone datos "eliminados".
- La base de datos crece continuamente (los registros nunca se eliminan fisicamente).
- `cascade_soft_delete` es necesario para desactivar dependencias en cascada, agregando complejidad.

---

## 9. Multi-Tenancy desde el Dia Uno

### Contexto

El modelo de negocio es SaaS: multiples restaurantes (tenants) usan la misma instancia del sistema.

### Decision

Multi-tenancy a nivel de aplicacion con `tenant_id` en todas las tablas de negocio.

### Razonamiento

- **Costo de retrofit**: Agregar multi-tenancy a un sistema existente es una de las migraciones mas costosas en software. Hacerlo desde el inicio es ordenes de magnitud mas barato.
- **Infraestructura simple**: Todos los tenants comparten la misma base de datos y servicios. No hay que gestionar bases de datos por tenant.
- **Escalabilidad lineal**: Agregar un nuevo restaurante es crear un registro en la tabla `tenant`.

### Tradeoffs Aceptados

- Cada query debe incluir `tenant_id`. Olvidarse expone datos de otros tenants (fuga de datos critica).
- No se usa Row-Level Security de PostgreSQL (seria mas seguro pero mas complejo de mantener con SQLAlchemy).
- Testing mas complejo: cada test debe crear datos dentro de un tenant especifico.

---

## 10. PWA sobre Aplicaciones Nativas

### Contexto

Los clientes (pwaMenu) y mozos (pwaWaiter) necesitan acceder al sistema desde sus celulares.

### Decision

Progressive Web Apps (PWA) para todos los frontends orientados a mobile.

### Razonamiento

- **Sin app stores**: No hay proceso de revision de Apple/Google. Las actualizaciones son instantaneas.
- **Cross-platform**: Un mismo codigo para iOS, Android y desktop.
- **Offline-capable**: Los Service Workers permiten funcionalidad offline (critico para pwaWaiter en zonas con WiFi inestable).
- **Costo de desarrollo**: Un equipo en lugar de tres (web + iOS + Android).
- **Instalacion opcional**: Los usuarios pueden "instalar" la PWA en su home screen sin pasar por un store.

### Tradeoffs Aceptados

- Push notifications limitadas (especialmente en iOS donde el soporte de PWA es historicamente inferior).
- Sin acceso a APIs nativas avanzadas (NFC, Bluetooth, sensores especificos).
- Limitaciones de iOS: Safari no soporta todas las APIs de Service Worker.

---

## 11. Worker Pool Broadcast (WebSocket Gateway)

### Contexto

Enviar un mensaje WebSocket a 400 usuarios conectados simultaneamente de forma secuencial tomaba ~4 segundos. Inaceptable para notificaciones en tiempo real.

### Decision

Worker pool de 10 workers para broadcast paralelo.

### Razonamiento

- **Reduccion de latencia**: De ~4 segundos a ~160ms para 400 usuarios. Mejora de 25x.
- **No bloquea el event loop**: Los workers procesan envios en paralelo mientras el event loop sigue aceptando conexiones.
- **Backpressure natural**: Si los workers estan ocupados, los mensajes se encolan. No se pierden.

### Tradeoffs Aceptados

- Codigo mas complejo que un loop secuencial.
- Gestion de colas y workers agrega puntos de falla.
- Si un worker falla, los mensajes de su lote se reencolan (latencia adicional).

---

## 12. Sharded Locks (WebSocket Gateway)

### Contexto

Un lock global para manejar conexiones WebSocket causaba 90% de contencion cuando muchos usuarios se conectaban o desconectaban simultaneamente.

### Decision

Locks granulares por sucursal y por usuario (sharded locks).

### Razonamiento

- **Reduccion de contencion**: Las operaciones en la sucursal A no bloquean a la sucursal B. Las operaciones del usuario 1 no bloquean al usuario 2.
- **Escalabilidad**: La contencion se mantiene constante independientemente del numero total de conexiones.

### Tradeoffs Aceptados

- Mas memoria para mantener mapas de locks.
- Requiere disciplina en el orden de adquisicion de locks para prevenir deadlocks.
- Debugging mas complejo cuando hay problemas de concurrencia.

---

## 13. Circuit Breaker para Redis

### Contexto

Si Redis cae, el WebSocket Gateway no debe colapsar. Debe degradar funcionalidad gracefully.

### Decision

Patron circuit breaker con tres estados: CLOSED (normal), OPEN (Redis caido, fail-fast), HALF-OPEN (probando recuperacion).

### Razonamiento

- **Resiliencia**: El Gateway sigue aceptando conexiones WebSocket aunque Redis este caido. Las funcionalidades que dependen de Redis se degradan, pero el servicio no colapsa.
- **Fail-fast**: En estado OPEN, las operaciones Redis fallan inmediatamente sin esperar timeout. Esto protege el event loop.
- **Auto-recuperacion**: Despues de 30 segundos en estado OPEN, pasa a HALF-OPEN y prueba una operacion. Si funciona, vuelve a CLOSED.

### Tradeoffs Aceptados

- Eventos se pierden durante el estado OPEN (30 segundos de ventana).
- Complejidad adicional en el codigo del Gateway.
- El delay de recuperacion (30 segundos) es un compromiso entre velocidad y estabilidad.

---

## 14. Enrutamiento de Eventos por Sector

### Contexto

Un restaurante con 10 sectores y 20 mozos no necesita que cada mozo reciba eventos de todos los sectores. Solo de los que tiene asignados ese dia.

### Decision

Filtrado de eventos WebSocket por `sector_id` basado en las asignaciones diarias del mozo.

### Razonamiento

- **Reduccion de ruido**: El mozo solo ve notificaciones de sus mesas, no de todo el restaurante.
- **Ahorro de ancho de banda**: Menos mensajes por conexion, especialmente en restaurantes grandes.
- **Excepciones logicas**: ADMIN y MANAGER siempre reciben todos los eventos de la sucursal (necesitan vision global).

### Tradeoffs Aceptados

- Cache de asignaciones necesario (TTL de 5 minutos) para no consultar la base de datos en cada evento.
- Reasignacion dinamica durante el turno requiere un comando WebSocket especifico para actualizar la cache.

---

## 15. Precios en Centavos

### Contexto

Los precios de productos deben almacenarse y calcularse sin errores de redondeo.

### Decision

Todos los precios se almacenan como enteros en centavos (e.g., $125.50 = 12550).

### Razonamiento

- **Precision**: La aritmetica de enteros es exacta. No hay problemas de punto flotante como `0.1 + 0.2 = 0.30000000000000004`.
- **Estandar de la industria**: Stripe, MercadoPago y la mayoria de sistemas financieros usan centavos internamente.
- **Simplicidad en calculos**: Suma, resta y multiplicacion de enteros no generan errores de redondeo.

### Tradeoffs Aceptados

- Cada frontend debe convertir centavos a display (`cents / 100`) y viceversa (`Math.round(price * 100)`).
- Es facil introducir bugs si alguien olvida la conversion (mostrar $12550 en lugar de $125.50).

---

## 16. Stores Modulares en Zustand (pwaMenu)

### Contexto

El store principal de pwaMenu crecio a 800+ lineas, mezclando tipos, logica, selectores y helpers.

### Decision

Dividir cada store en archivos separados: `store.ts`, `types.ts`, `selectors.ts`, `helpers.ts`.

### Razonamiento

- **Mantenibilidad**: Cada archivo tiene una responsabilidad clara. Los tipos no se mezclan con la logica.
- **Testabilidad**: Los selectores y helpers son funciones puras que se testean aisladamente.
- **Navegacion**: Es mas facil encontrar un selector especifico en `selectors.ts` que buscarlo en un archivo de 800 lineas.

### Tradeoffs Aceptados

- Mas archivos para navegar (4 archivos por store vs 1).
- Import paths mas largos.
- Requiere convencion de equipo para mantener la estructura.

---

## 17. Refresh Proactivo de Tokens

### Contexto

El access token JWT tiene 15 minutos de vida. Un refresh reactivo (despues de recibir un 401) causa una experiencia degradada: el usuario ve un error momentaneo.

### Decision

Refresh proactivo a los 14 minutos (1 minuto antes de la expiracion).

### Razonamiento

- **Experiencia invisible**: El usuario nunca percibe el refresh. No hay errores, no hay retries visibles.
- **Reduccion de 401s**: La unica razon para un 401 deberia ser un token genuinamente invalido (blacklisted), no uno expirado.
- **Resiliencia**: Si el refresh falla, aun queda 1 minuto de token valido para reintentar.

### Tradeoffs Aceptados

- Requests de refresh adicionales (cada 14 minutos por sesion activa).
- Necesidad de jitter (variacion aleatoria) para evitar thundering herd cuando muchos clientes refrescan al mismo tiempo.
- El timer de refresh se pierde si el usuario cierra y reabre la pestana (se resuelve verificando expiracion al montar).

---

## 18. Confirmacion Grupal para Pedidos (pwaMenu)

### Contexto

En el carrito compartido, multiples comensales agregan items simultaneamente. Si cualquiera puede enviar el pedido, un comensal puede accidentalmente enviar un pedido incompleto.

### Decision

Flujo de confirmacion grupal: un comensal propone enviar, los demas tienen 5 minutos para confirmar o rechazar.

### Razonamiento

- **Prevencion de errores**: Nadie envia el pedido de otro sin su consentimiento.
- **Transparencia**: Todos ven que se propuso enviar y pueden agregar items de ultimo momento.
- **Timeout**: Si no se confirma en 5 minutos, la propuesta expira automaticamente. No bloquea el flujo.

### Tradeoffs Aceptados

- Friccion adicional en el flujo de pedido (un paso mas antes de enviar).
- Latencia: el pedido tarda mas en llegar a cocina (espera de confirmaciones).
- Complejidad de UI: manejar estados de propuesta, confirmacion y expiracion en tiempo real.
