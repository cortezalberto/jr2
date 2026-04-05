# 27. Preguntas Abiertas

> Preguntas que requieren respuesta del product owner, tech lead o stakeholders para tomar decisiones informadas sobre la evolucion de Integrador / Buen Sabor.

> **Formato**: Cada pregunta incluye contexto (por que surge), opciones posibles y el impacto de no responderla.

---

## Contexto de Negocio

### 1. Cual es el tamanio del mercado objetivo?

**Contexto**: La arquitectura multi-tenant permite multiples restaurantes, y cada tenant puede tener multiples sucursales. Sin embargo, no hay documentacion sobre cuantos restaurantes o sucursales se esperan como objetivo.

**Opciones**:
- a) Un solo restaurante con multiples sucursales (producto interno).
- b) Decenas de restaurantes (startup SaaS regional).
- c) Cientos+ de restaurantes (plataforma a escala).

**Impacto de no responder**: Sin esta definicion, las decisiones de escalabilidad, infraestructura y pricing son especulativas. Se podria sobredimensionar (gastar de mas) o subdimensionar (colapsar bajo carga).

---

### 2. ~~Cual es la carga concurrente esperada por sucursal y por tenant?~~ — RESPONDIDA

**Respuesta (2026-04-04)**: 600 usuarios concurrentes. Esto esta dentro de la capacidad del WS Gateway (max 1000 connections, benchmarked para 400+). Una sola instancia deberia ser suficiente, pero se recomienda load testing para validar.

---

### 3. Se planea expansion internacional?

**Contexto**: El sistema usa Mercado Pago (Argentina), ARS como moneda, espaniol rioplatense en la UI administrativa. pwaMenu tiene i18n (es/en/pt) pero el Dashboard no.

**Opciones**:
- a) No, el sistema es solo para Argentina.
- b) Si, expansion a LATAM (requiere multi-moneda, gateway de pago regional).
- c) Si, expansion global (requiere i18n completo, regulaciones por pais, multiples gateways).

**Impacto de no responder**: Si la expansion es inminente pero no se prepara la arquitectura, el refactor sera costoso. Si no se planea expansion, invertir en abstracciones de moneda/gateway es esfuerzo desperdiciado.

---

### 4. Cual es el modelo de revenue?

**Contexto**: No hay documentacion sobre como monetiza el sistema. Esto afecta decisiones tecnicas (metering, billing, feature gating).

**Opciones**:
- a) Suscripcion mensual por sucursal.
- b) Fee por transaccion (porcentaje de cada pago).
- c) Modelo freemium (funcionalidad basica gratis, premium pago).
- d) Producto interno (no se monetiza directamente).

**Impacto de no responder**: Sin modelo de revenue, no se puede priorizar correctamente. Features de billing, metering y reportes dependen de este modelo.

---

### 5. Cual es la relacion con la marca "Buen Sabor"?

**Contexto**: El sistema se referencia como "Integrador" y como "Buen Sabor" en distintos documentos. No queda claro si "Buen Sabor" es un tenant (un restaurante que usa el sistema), el nombre del producto, o una marca paraguas.

**Opciones**:
- a) "Buen Sabor" es un tenant de ejemplo/demo.
- b) "Buen Sabor" es el nombre del producto.
- c) "Integrador" es la plataforma, "Buen Sabor" es el primer (o unico) cliente.

**Impacto de no responder**: Confusion en naming, branding y documentacion. Afecta como se presenta el producto a nuevos tenants.

---

## Decisiones de Producto

### 6. ~~Deberian los clientes poder ordenar durante el estado PAYING?~~ — RESPONDIDA (BUG)

**Respuesta (2026-04-04)**: **NO**. Si pidieron la cuenta, no pueden seguir pidiendo. Esto es un BUG confirmado que debe corregirse en backend (bloquear creacion de rondas cuando status=PAYING) y frontend (deshabilitar UI de pedido).

---

### 7. Que pasa con checks no pagados cuando la sesion expira?

**Contexto**: Las sesiones tienen un TTL de inactividad. Si una mesa queda abierta sin actividad, eventualmente expira. Pero si hay un check pendiente de pago, no esta claro que ocurre.

**Opciones**:
- a) El check se cancela automaticamente (perdida para el restaurante).
- b) El check queda pendiente hasta cierre manual (el manager debe resolverlo).
- c) Se genera una alerta para el mozo/manager antes de la expiracion.

**Impacto de no responder**: Potencial perdida de revenue o acumulacion de sesiones "zombies" con checks impagos.

---

### 8. Pueden cambiar las asignaciones de mozos a mitad de turno?

**Contexto**: Las asignaciones de sector son diarias (`WaiterSectorAssignment` con fecha). La verificacion comprueba la fecha de hoy.

**Opciones**:
- a) No, la asignacion es fija para todo el dia.
- b) Si, el manager puede reasignar en cualquier momento.
- c) Si, pero las mesas activas del mozo anterior se transfieren automaticamente.

**Impacto de no responder**: Si un mozo se enferma a mitad del turno, podria no haber mecanismo para que otro tome sus mesas.

---

### 9. Deberia existir la funcionalidad de "producto no disponible"?

**Contexto**: La cocina no puede marcar un producto como agotado en tiempo real. Si un ingrediente se acaba, el producto sigue apareciendo en el menu.

**Opciones**:
- a) Si, la cocina marca productos como no disponibles (se ocultan o muestran como "agotado").
- b) No, el mozo informa verbalmente y rechaza la ronda si incluye ese producto.
- c) Si, pero solo el manager puede marcar productos (no la cocina).

**Impacto de no responder**: Clientes ordenan productos que no pueden prepararse, generando frustracion, demoras y mala experiencia.

---

### 10. ~~Cual es el estado de la integracion de IA (Ollama/pgvector)?~~ — RESPONDIDA

**Respuesta (2026-04-04)**: Es **experimental**. No esta en produccion ni es prioritario. Ollama puede omitirse en deploys de produccion para ahorrar recursos.

---

### 11. ~~El carrito deberia sincronizarse en tiempo real entre dispositivos?~~ — RESPONDIDA

**Respuesta (2026-04-04)**: **No**. El carrito compartido es per-device por diseniio. Cada comensal gestiona su propio carrito y se consolida al enviar la ronda via group confirmation.

---

### 12. Cual es la prioridad: Kitchen Display o Estadisticas?

**Contexto**: Ambas son paginas placeholder que necesitan implementacion. Los recursos son limitados.

**Opciones**:
- a) Kitchen Display primero (es critico para la operacion diaria de la cocina).
- b) Estadisticas primero (la gerencia necesita datos para decisiones de negocio).
- c) Ambas en paralelo (si hay equipo suficiente).

**Impacto de no responder**: Sin priorizacion, ambas se implementan parcialmente o ninguna se completa.

---

## Decisiones Tecnicas

### 13. Deberian configurarse migraciones con Alembic?

**Contexto**: Alembic esta mencionado pero no hay archivos de migracion. No se sabe si se usaron y se eliminaron, si nunca se configuraron, o si hay otra estrategia.

**Opciones**:
- a) Si, inicializar Alembic y generar migracion del esquema actual.
- b) No, se usa `create_all()` de SQLAlchemy y cambios manuales.
- c) Otra herramienta (Flyway, custom scripts).

**Impacto de no responder**: Cada cambio de esquema es un riesgo. Sin migraciones, no hay rollback de esquema ni historial auditable.

---

### 14. Cual es el entorno de despliegue objetivo?

**Contexto**: Docker existe para desarrollo pero no hay documentacion de produccion. No se sabe si el target es VPS, Kubernetes, ECS, Railway, Fly.io u otro.

**Opciones**:
- a) VPS simple con Docker Compose (economico, simple).
- b) Kubernetes (escalable, complejo).
- c) PaaS/Cloud Run/ECS (gestionado, costo medio).
- d) No definido aun.

**Impacto de no responder**: La configuracion de CI/CD, monitoreo, logs y escalabilidad dependen del entorno de despliegue. Sin definicion, se trabaja a ciegas.

---

### 15. Se necesita escalado horizontal en los proximos 6-12 meses?

**Contexto**: La arquitectura es single-instance. Agregar escalado horizontal es un esfuerzo significativo (load balancer, estado compartido, coordinacion entre instancias).

**Opciones**:
- a) No, una instancia es suficiente para el volumen esperado.
- b) Si, en los proximos 6 meses (empezar a preparar ahora).
- c) Si, en 12+ meses (planificar pero no implementar aun).

**Impacto de no responder**: Si se necesita pronto y no se prepara, el sistema colapsara bajo carga. Si no se necesita y se implementa, es esfuerzo desperdiciado.

---

### 16. Deberian existir backups automatizados? Cual es el RPO/RTO?

**Contexto**: No hay backups. RPO (Recovery Point Objective) define cuantos datos se pueden perder. RTO (Recovery Time Objective) define cuanto tiempo puede estar caido el sistema.

**Opciones**:
- a) RPO: 24h (backup diario). RTO: 4h (restore manual).
- b) RPO: 1h (backup horario). RTO: 30min (restore semi-automatizado).
- c) RPO: 0 (replicas en tiempo real). RTO: < 5min (failover automatico).

**Impacto de no responder**: Sin RPO/RTO definidos, no se puede dimensionar la solucion de backup. Una falla en produccion sin backup es perdida total.

---

### 17. Existen requisitos de compliance mas alla de EU 1169/2011?

**Contexto**: El sistema implementa gestion de alergenos siguiendo la regulacion EU 1169/2011. No se sabe si hay otros requisitos (proteccion de datos personales, facturacion electronica, regulaciones gastronomicas locales).

**Opciones**:
- a) Solo EU 1169/2011 para alergenos.
- b) Ley de Proteccion de Datos Personales (Argentina: Ley 25.326).
- c) Facturacion electronica (AFIP).
- d) Habilitaciones bromatologicas digitales.

**Impacto de no responder**: Incumplimiento regulatorio puede resultar en multas o imposibilidad de operar legalmente.

---

### 18. El JWT_SECRET deberia moverse a un secrets manager?

**Contexto**: Actualmente esta en variables de entorno. En el docker-compose de desarrollo esta hardcodeado.

**Opciones**:
- a) Variables de entorno es suficiente (con `.env` no versionado).
- b) Secrets manager (AWS Secrets Manager, HashiCorp Vault, Doppler).
- c) Archivo de secrets de Docker Swarm/Kubernetes.

**Impacto de no responder**: El riesgo de seguridad se mantiene. El nivel de proteccion depende del entorno de despliegue (#14).

---

### 19. Es suficiente Prometheus + Grafana, o se prefiere un servicio gestionado?

**Contexto**: Existe configuracion parcial de Prometheus + Grafana. Alternativas gestionadas (Datadog, New Relic, Grafana Cloud) requieren menos mantenimiento pero tienen costo.

**Opciones**:
- a) Self-hosted Prometheus + Grafana (gratis, requiere mantenimiento).
- b) Grafana Cloud tier gratuito (suficiente para volumen bajo).
- c) Servicio gestionado completo (Datadog, New Relic — costo mensual).

**Impacto de no responder**: Sin monitoreo definido, se opera a ciegas en produccion. Elegir la herramienta incorrecta genera retrabajo.

---

## Decisiones de Arquitectura Pendientes

### 20. Deberian unificarse los tres clientes WebSocket?

**Contexto**: Dashboard, pwaMenu y pwaWaiter tienen implementaciones independientes de ~500-600 lineas con la misma logica base.

**Opciones**:
- a) Si, extraer a paquete compartido (`@integrador/ws-client`).
- b) No, las diferencias justifican implementaciones separadas.
- c) Parcial: extraer solo la logica de conexion/heartbeat, mantener handlers separados.

**Impacto de no responder**: La deuda tecnica se acumula. Cada fix o mejora se triplica.

---

### 21. Deberian los frontends compartir una libreria de componentes?

**Contexto**: Componentes como Button, Input, Modal estan duplicados en los tres frontends con variaciones menores.

**Opciones**:
- a) Si, crear paquete compartido con Turborepo.
- b) No, la duplicacion es manejable dado el tamanio de los equipos.
- c) Parcial: compartir solo estilos (Tailwind config) y no componentes.

**Impacto de no responder**: La inconsistencia visual aumenta con cada nueva feature. Los fix de UI se triplican.

---

### 22. Deberian generarse automaticamente los tipos del API?

**Contexto**: FastAPI genera OpenAPI spec. Herramientas como `openapi-typescript` pueden generar tipos TypeScript automaticamente.

**Opciones**:
- a) Si, auto-generar tipos y clientes HTTP.
- b) No, los tipos manuales dan mas control.
- c) Solo tipos, no clientes HTTP.

**Impacto de no responder**: Desincronizacion entre backend y frontend que solo se detecta en runtime.

---

### 23. El modelo de gobernanza (CRITICO/ALTO/MEDIO/BAJO) se aplica realmente?

**Contexto**: CLAUDE.md define niveles de autonomia para cambios por dominio (CRITICO para Auth/Billing, BAJO para Categories). No se sabe si esto se usa en la practica.

**Opciones**:
- a) Si, se aplica en code reviews y PRs.
- b) No, es aspiracional y no se enforce.
- c) Se usa como guia, no como regla estricta.

**Impacto de no responder**: Si no se aplica, cambios criticos en Auth o Billing podrian pasar sin revision adecuada.

---

### 24. Que hacer con los 25+ documentos de arquitectura en la raiz?

**Contexto**: El directorio raiz contiene numerosos archivos Markdown de arquitectura, planificacion, prompts e historias de usuario. Algunos podrian estar desactualizados.

**Opciones**:
- a) Consolidar en `knowledge-base/` (este esfuerzo) y archivar los originales.
- b) Mantener ambos (knowledge-base como resumen, originales como referencia).
- c) Eliminar los originales una vez consolidados.

**Impacto de no responder**: Confusión sobre cual es la fuente de verdad. Riesgo de usar informacion desactualizada.

---

## Priorizacion Sugerida

Las preguntas mas urgentes (bloquean decisiones tecnicas inmediatas):

| Prioridad | Pregunta | Bloquea |
|-----------|----------|---------|
| 1 | #14 Entorno de despliegue | CI/CD, monitoring, scaling |
| 2 | #16 RPO/RTO | Estrategia de backups |
| 3 | #1-2 Tamanio y carga | Dimensionamiento de infra |
| 4 | #13 Alembic | Workflow de desarrollo |
| 5 | #12 Kitchen vs Stats | Prioridad de desarrollo |
| 6 | #6 Ordenar en PAYING | Flujo de facturacion |
| 7 | #15 Escalado horizontal | Arquitectura WS Gateway |

Las preguntas estrategicas (definen la direccion del producto):

| Prioridad | Pregunta | Define |
|-----------|----------|--------|
| 1 | #3 Expansion internacional | Arquitectura de moneda, pagos, i18n |
| 2 | #4 Modelo de revenue | Feature gating, billing, pricing |
| 3 | #5 Relacion con "Buen Sabor" | Branding, multi-tenancy strategy |

---

*Ultima actualizacion: Abril 2026*
