# 24. Roadmap Sugerido

> Plan de evolucion del sistema Integrador / Buen Sabor organizado en fases progresivas, desde las bases necesarias para produccion hasta funcionalidades avanzadas con inteligencia artificial.

---

## Principios del Roadmap

1. **Estabilidad antes que funcionalidad**: No tiene sentido agregar features sobre cimientos fragiles.
2. **Valor incremental**: Cada fase entrega valor independiente. No hay dependencia total entre fases.
3. **Produccion como meta intermedia**: La Fase 2 es el umbral minimo para un despliegue en produccion confiable.
4. **Escalabilidad progresiva**: Escalar cuando los datos lo justifiquen, no antes.

---

## Fase 0: Cimientos (Inmediata)

> **Objetivo**: Establecer las bases minimas de ingenieria de software que faltan. Sin esto, todo lo que se construya encima esta en riesgo.

**Duracion estimada**: 1-2 semanas

### Tareas

- [ ] **CI/CD con GitHub Actions**
  - Jobs: lint (ESLint + ruff), type-check (`tsc --noEmit` + mypy), test (Vitest + pytest), build.
  - Branch protection: PR requiere CI verde.
  - Notificacion a Slack/Discord ante fallas.
  - *Razon*: Es la primera linea de defensa contra regresiones. Todo lo demas depende de esto.

- [ ] **Inicializar Alembic correctamente**
  - Generar migracion inicial del esquema actual.
  - Verificar que `alembic upgrade head` en base limpia reproduce el esquema.
  - Establecer convencion: todo cambio de modelo incluye migracion.
  - *Razon*: Sin migraciones versionadas, los cambios de esquema son irreproducibles e irreversibles.

- [ ] **Backups automatizados de base de datos**
  - `pg_dump` diario con retencion de 30 dias.
  - Storage externo (S3, GCS, o como minimo un volumen separado).
  - Script de restore documentado y testeado.
  - *Razon*: La perdida de datos en produccion es irrecuperable sin esto.

- [ ] **Estandarizar VITE_API_URL**
  - Unificar los tres frontends al mismo patron (con `/api`).
  - Actualizar `.env.example` de cada proyecto.
  - *Razon*: Quick win que elimina una fuente constante de confusion.

- [ ] **Eliminar JWT_SECRET de docker-compose**
  - Mover a `.env` no versionado.
  - docker-compose referencia `${JWT_SECRET}` sin default.
  - *Razon*: Cerrar vulnerabilidad de seguridad evidente.

- [ ] **Setup de framework E2E**
  - Instalar Playwright.
  - Escribir al menos 1 test E2E del flujo critico: login -> crear pedido -> enviar a cocina.
  - *Razon*: Establecer la infraestructura para tests E2E, aunque la cobertura se expanda despues.

---

## Fase 1: Completar el Core

> **Objetivo**: Implementar las funcionalidades que ya estan prometidas en la UI pero no funcionan. El sistema debe hacer lo que dice que hace.

**Duracion estimada**: 4-6 semanas

### Tareas

- [ ] **Kitchen Display Page (Dashboard)**
  - Vista de tickets de cocina con estados (SUBMITTED -> IN_KITCHEN -> READY).
  - Drag-and-drop o botones para cambiar estado.
  - Prioridad visual por tiempo de espera.
  - Sonido de notificacion al recibir ticket nuevo.
  - *Razon*: El rol KITCHEN no tiene herramientas para trabajar. Es critico para la operacion.

- [ ] **Paginas de Estadisticas (Dashboard)**
  - **Ventas**: Revenue por dia/semana/mes, productos mas vendidos, ticket promedio.
  - **Historial por sucursal**: Comparativas entre branches, horarios pico, mesas mas rotadas.
  - **Historial por cliente**: Frecuencia de visita, preferencias (requiere Loyalty Phase 2 data).
  - Graficos con Chart.js o Recharts.
  - *Razon*: La gerencia necesita datos para tomar decisiones de negocio.

- [ ] **Pagina de Exclusiones de Producto**
  - CRUD para definir exclusiones por producto (ingredientes que se pueden quitar).
  - Conexion con el flujo de pedidos para que el comensal pueda personalizar.
  - *Razon*: Funcionalidad prometida en la navegacion que no existe.

- [ ] **Producto no disponible (out of stock)**
  - La cocina puede marcar un producto como "no disponible" en tiempo real.
  - El menu en pwaMenu muestra el producto como agotado (no se puede agregar al carrito).
  - WebSocket event `PRODUCT_UNAVAILABLE` propagado a todos los diners del branch.
  - Restauracion manual o automatica al inicio del siguiente dia.
  - *Razon*: Evita que clientes ordenen productos que no pueden prepararse, reduciendo frustracion.

- [ ] **Customer Loyalty Fases 3-4**
  - **Fase 3**: Reconocimiento de cliente recurrente (basado en device fingerprint + historial).
  - **Fase 4**: Opt-in con consentimiento GDPR. El cliente vincula su identidad al historial.
  - Mostrar preferencias previas, sugerencias basadas en historial.
  - *Razon*: Los datos de Fases 1-2 ya se recolectan. Sin las fases 3-4, ese dato no genera valor.

---

## Fase 2: Produccion

> **Objetivo**: El sistema esta listo para ser usado por un restaurante real con confianza en su estabilidad y seguridad.

**Duracion estimada**: 3-4 semanas

### Tareas

- [ ] **TLS/HTTPS**
  - Certificados via Let's Encrypt con renovacion automatica.
  - Nginx como reverse proxy con terminacion TLS.
  - WebSocket sobre WSS.
  - HSTS headers activados.
  - *Razon*: Requisito minimo de seguridad para produccion. Credenciales y datos financieros en texto plano es inaceptable.

- [ ] **Agregacion y centralizacion de logs**
  - Opcion liviana: Grafana Loki + Promtail.
  - Opcion gestionada: Datadog, Papertrail, o Logtail.
  - Todos los servicios envian logs con tenant_id, request_id, user_id como campos estructurados.
  - Alertas configuradas para errores criticos (5xx, auth failures, Redis timeout).
  - *Razon*: Sin logs centralizados, diagnosticar problemas en produccion es practicamente imposible.

- [ ] **Dashboards de monitoreo**
  - Prometheus + Grafana (parcialmente existente).
  - Metricas clave: requests/s, latencia p95, conexiones WS activas, Redis memory, DB connections.
  - Alertas de umbral (CPU > 80%, memoria > 90%, WS connections > 800).
  - *Razon*: Visibilidad operativa es prerequisito para operar un servicio confiable.

- [ ] **Load testing**
  - Herramienta: k6 o Locust.
  - Escenarios: 50, 100, 200, 400 conexiones WS simultaneas.
  - Medir: latencia de broadcast, tiempo de respuesta API, throughput de ordenes.
  - Establecer baselines y limites reales del sistema.
  - *Razon*: Las afirmaciones de rendimiento deben estar respaldadas por datos reales.

- [ ] **Estrategia de rotacion de secrets**
  - Documentar procedimiento para rotar JWT_SECRET sin downtime.
  - Soporte para multiples secrets activos durante la ventana de rotacion.
  - *Razon*: Necesario para responder a incidentes de seguridad.

- [ ] **Documentacion de despliegue en produccion**
  - Guia paso a paso: desde servidor limpio hasta sistema operativo.
  - Checklist de seguridad (TLS, secrets, CORS, headers).
  - Runbook de operaciones (restart, rollback, backup/restore, escalado).
  - *Razon*: El conocimiento de despliegue no puede existir solo en la cabeza de una persona.

---

## Fase 3: Escalabilidad

> **Objetivo**: Preparar el sistema para crecer mas alla de una instalacion individual. Multiples sucursales, multiples restaurantes, mayor concurrencia.

**Duracion estimada**: 4-6 semanas

### Tareas

- [ ] **WS Gateway horizontal**
  - Multiples instancias detras de un load balancer (sticky sessions por branch).
  - Redis Streams para propagar eventos entre instancias.
  - Graceful shutdown: drenar conexiones antes de apagar una instancia.
  - *Razon*: Eliminar el punto unico de falla mas critico del sistema.

- [ ] **Read replicas para PostgreSQL**
  - Replica de lectura para queries de estadisticas y reportes.
  - Separar pool de conexiones: escritura a primary, lectura a replica.
  - *Razon*: Los reportes y estadisticas (Fase 1) pueden generar queries pesados que degraden la operacion transaccional.

- [ ] **Redis Sentinel o Cluster**
  - Alta disponibilidad con failover automatico.
  - Separar funciones: cache, eventos y auth en instancias/slots separados.
  - *Razon*: Redis es componente critico para multiples subsistemas. Su caida es una falla en cascada.

- [ ] **CDN para assets estaticos**
  - Frontends servidos desde CDN (CloudFront, Cloudflare).
  - Imagenes de productos via CDN con transformaciones (resize, WebP).
  - *Razon*: Reducir carga en el servidor de aplicacion y mejorar tiempos de carga para el usuario final.

- [ ] **Event catch-up en reconexion WebSocket**
  - Sequence numbers en cada evento.
  - Al reconectar, el cliente informa el ultimo evento recibido.
  - El servidor envia los eventos faltantes desde el buffer.
  - *Razon*: Garantizar que ningun evento critico se pierda durante cambios de red.

---

## Fase 4: Mejoras de Producto

> **Objetivo**: Expandir las capacidades del sistema con funcionalidades que aumenten el valor para restaurantes y comensales.

**Duracion estimada**: Continua, features independientes

### Tareas

- [ ] **Push notifications (Web Push via VAPID)**
  - Service worker para recibir notificaciones en segundo plano.
  - Notificaciones para mozos (nuevo pedido, llamada de servicio), cocina (nuevo ticket), comensales (pedido listo).
  - Configuracion de preferencias de notificacion por usuario.
  - *Razon*: La limitacion mas visible del sistema actual. Los usuarios esperan notificaciones en una PWA.

- [ ] **Toggle de tema claro/oscuro**
  - Capa de abstraccion CSS con variables de tema.
  - Respetar `prefers-color-scheme` del sistema.
  - Persistir preferencia en localStorage.
  - *Razon*: Mejora de accesibilidad y usabilidad en distintas condiciones de iluminacion.

- [ ] **Libreria de componentes compartida**
  - Setup de Turborepo o Nx para monorepo.
  - Paquete `@integrador/ui` con Button, Input, Modal, Toast, ConfirmDialog.
  - Paquete `@integrador/ws-client` con cliente WebSocket comun.
  - *Razon*: Eliminar duplicacion entre los tres frontends.

- [ ] **Historial de pedidos para clientes**
  - El cliente con cuenta puede ver sus pedidos anteriores (cross-session).
  - "Repetir pedido" con un toque.
  - *Razon*: Mejora la experiencia de clientes recurrentes y fomenta la lealtad.

- [ ] **Priorizacion de pedidos en cocina**
  - Algoritmo de prioridad basado en tiempo de espera, tamanio del pedido y tipo de producto.
  - Vista de cocina con colores de urgencia.
  - Estimacion de tiempo de preparacion.
  - *Razon*: Optimiza el flujo de cocina en momentos de alta demanda.

- [ ] **Soporte para delivery/takeout**
  - Nuevos tipos de sesion ademas de dine-in.
  - Flujo de pedido sin mesa.
  - Integracion con servicios de delivery o logistica propia.
  - *Razon*: Expandir el modelo de negocio mas alla del consumo en local.

- [ ] **Dashboard multilenguaje**
  - i18n para el Dashboard (actualmente solo en espaniol).
  - Reusar la infraestructura de i18n de pwaMenu (i18next, es/en/pt).
  - *Razon*: Necesario si el sistema se expande a mercados no hispanoparlantes.

- [ ] **Abstraccion de gateway de pago**
  - Strategy pattern para soportar multiples proveedores (Mercado Pago, Stripe, PayPal).
  - Configuracion por tenant de que gateway usar.
  - *Razon*: Reducir dependencia de un unico proveedor y habilitar expansion internacional.

---

## Fase 5: Inteligencia

> **Objetivo**: Aprovechar los datos acumulados para generar valor con inteligencia artificial y analitica avanzada.

**Duracion estimada**: Continua, experimental

### Tareas

- [ ] **Recomendaciones de menu con IA**
  - Aprovechar la infraestructura existente (Ollama, pgvector).
  - Embeddings de productos basados en ingredientes, tipo de cocina, perfil de sabor.
  - Recomendaciones personalizadas basadas en historial del comensal.
  - "Te podria gustar..." en pwaMenu.
  - *Razon*: La infraestructura de IA ya existe parcialmente. Falta la integracion con el flujo de usuario.

- [ ] **Prediccion de demanda**
  - Modelo predictivo basado en historico de ventas, dia de la semana, clima, eventos.
  - Alertas de stock: "Maniana es viernes, preparar 40% mas de X".
  - Sugerencia de personal: "Para el sabado, se recomienda 3 mozos en lugar de 2".
  - *Razon*: Optimizacion operativa basada en datos.

- [ ] **Deteccion automatica de alergenos**
  - Dado que el sistema ya tiene ingredientes y sub-ingredientes, inferir alergenos automaticamente a partir de la composicion.
  - Verificacion humana obligatoria antes de publicar.
  - *Razon*: Reduce error humano en la declaracion de alergenos (regulacion EU 1169/2011).

- [ ] **Precios dinamicos sugeridos**
  - Analisis de elasticidad de demanda por producto.
  - Sugerencias de ajuste de precio (no automatico, requiere aprobacion).
  - Promociones automaticas para productos con baja rotacion.
  - *Razon*: Maximizacion de revenue basada en datos.

- [ ] **Analitica de comportamiento de clientes**
  - Dashboards de segmentacion: frecuencia, ticket promedio, preferencias.
  - Cohortes de clientes (nuevos, recurrentes, perdidos).
  - Identificacion de patrones: "Clientes que piden X tambien piden Y".
  - *Razon*: Conocer al cliente permite tomar mejores decisiones de menu y marketing.

---

## Resumen Visual

```
Fase 0 ─── Fase 1 ─── Fase 2 ───┬── Fase 3
(Cimientos) (Core)    (Produccion)│  (Escalabilidad)
  1-2 sem    4-6 sem    3-4 sem   │    4-6 sem
                                  │
                                  ├── Fase 4
                                  │  (Mejoras de Producto)
                                  │    Continua
                                  │
                                  └── Fase 5
                                     (Inteligencia)
                                       Continua
```

**Nota**: Las Fases 3, 4 y 5 pueden ejecutarse en paralelo despues de la Fase 2 si hay equipo suficiente. La Fase 2 es el gateway obligatorio hacia produccion.

---

## Criterios de Exito por Fase

| Fase | Criterio |
|------|----------|
| 0 | CI verde en cada PR. Backup diario verificado. Migracion inicial aplicable. |
| 1 | Todas las paginas placeholder reemplazadas por funcionalidad real. |
| 2 | Sistema operando con TLS, monitoreo, alertas y documentacion de operaciones. |
| 3 | WS Gateway con 2+ instancias. Load test verde para 500+ conexiones. |
| 4 | Al menos 3 features de Fase 4 en produccion. |
| 5 | Al menos 1 modelo de IA integrado y generando valor medible. |

---

*Ultima actualizacion: Abril 2026*
