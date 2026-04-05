# 21. Limitaciones Actuales del Sistema

> Inventario exhaustivo de las limitaciones funcionales y tecnicas conocidas de Integrador / Buen Sabor al momento de esta documentacion.

---

## Limitaciones Funcionales

### 1. Sin modo claro (light mode)

El tema oscuro (dark theme) esta hardcodeado en los tres frontends. No existe un toggle de tema ni soporte para `prefers-color-scheme`. Los colores estan definidos directamente en las hojas de estilo y clases de Tailwind sin capa de abstraccion por tema.

**Impacto**: Usuarios que prefieren modo claro o que trabajan bajo iluminacion directa (cocinas, terrazas) no tienen alternativa.

---

### 2. Sin notificaciones push

Los archivos `manifest.json` de las PWAs incluyen la declaracion necesaria para push notifications, pero la implementacion del lado del servidor (VAPID keys, service worker push handler, backend push service) no existe. Los eventos llegan unicamente via WebSocket mientras la aplicacion esta activa en primer plano.

**Impacto**: Mozos y cocina deben mantener la app abierta permanentemente. Si el navegador queda en segundo plano, pierden eventos criticos como llamadas de servicio o pedidos listos.

---

### 3. Sin autenticacion offline

El login requiere conexion a internet para validar credenciales contra el backend. No hay cache de tokens ni mecanismo de autenticacion local. Si el servidor no responde, el usuario no puede ingresar.

**Impacto**: En escenarios de conectividad intermitente (locales con mala senal WiFi), el personal no puede iniciar sesion hasta recuperar conexion.

---

### 4. Vista de cocina es placeholder

La pagina de Cocina en el Dashboard (`/kitchen`) existe como ruta pero no esta completamente implementada. El flujo real de cocina (visualizar tickets, cambiar estados, priorizar pedidos) no esta operativo desde el Dashboard. La cocina recibe eventos por WebSocket pero no tiene una interfaz dedicada completa.

**Impacto**: El rol KITCHEN no tiene herramientas visuales adecuadas para gestionar la produccion.

---

### 5. Paginas de estadisticas son placeholders

Las paginas de Ventas, Historial por sucursal e Historial por cliente existen como rutas en el Dashboard pero no son funcionales. No hay queries de agregacion, graficos ni exportacion de datos.

**Impacto**: La gerencia no puede analizar rendimiento, productos mas vendidos, horarios pico ni tendencias. Toda decision de negocio se hace sin datos cuantitativos del sistema.

---

### 6. Pagina de Configuracion basica

Settings solo ofrece importacion/exportacion de datos via JSON. No hay configuracion de preferencias de usuario, parametros del restaurante, umbrales de alerta ni personalizacion del sistema.

**Impacto**: Cualquier cambio de configuracion requiere intervencion tecnica directa.

---

### 7. Pagina de Exclusiones de Producto es placeholder

La ruta existe pero la funcionalidad no esta implementada. No se pueden definir exclusiones (ingredientes que un producto no debe llevar) desde la interfaz.

**Impacto**: Personalizacion de productos por parte del cliente no esta disponible desde la UI.

---

### 8. Sin undo/redo

Las operaciones de eliminacion son inmediatas. Si bien el sistema usa soft delete (el registro se marca como `is_active = False` y puede recuperarse a nivel de base de datos), no hay mecanismo en la UI para deshacer una accion.

**Impacto**: Un error del usuario (borrar una categoria, desactivar un producto) requiere intervencion manual en la base de datos o recrear el recurso.

---

### 9. Sin edicion colaborativa en tiempo real

Las actualizaciones son optimistas (optimistic updates): el frontend actualiza la UI inmediatamente y espera confirmacion del backend. No hay mecanismo de resolucion de conflictos (CRDT, OT) para edicion simultanea del mismo recurso por multiples usuarios.

**Impacto**: Si dos administradores editan el mismo producto simultaneamente, el ultimo en guardar sobrescribe los cambios del primero sin advertencia.

---

### 10. Sin UI de auditoria

Los campos de auditoria existen en la base de datos (`created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`) y se pueblan correctamente, pero no hay interfaz para consultarlos. No se puede ver quien creo, modifico o elimino un recurso.

**Impacto**: Ante incidentes (precios alterados, productos eliminados), no hay forma de investigar desde la aplicacion. Requiere consulta directa a la base de datos.

---

### 11. Lealtad de clientes solo en Fase 1-2

El sistema de fidelizacion implementa seguimiento por dispositivo (Fase 1) y preferencias implicitas (Fase 2). Las fases de reconocimiento de cliente recurrente (Fase 3) y opt-in con consentimiento GDPR (Fase 4) no estan implementadas.

**Impacto**: No se puede identificar a un cliente recurrente ni ofrecerle experiencias personalizadas. El valor del dato recolectado esta subutilizado.

---

### 12. Sin marcado de producto no disponible

La cocina no puede marcar un producto como "agotado" o "sin stock" en tiempo real. Si un ingrediente se termina, no hay forma de comunicarlo al sistema para que deje de mostrarse en el menu o muestre una advertencia.

**Impacto**: Clientes pueden ordenar productos que la cocina no puede preparar, generando frustracion y demoras.

---

### 13. Sin notificaciones para comensales

El diner (comensal) recibe eventos por WebSocket (actualizaciones de ronda, estados del pedido) pero no hay notificaciones visuales destacadas ni sonoras. Si el comensal no esta mirando la pantalla, no se entera de que su pedido esta listo.

**Impacto**: La experiencia del comensal depende de que este activamente mirando la app.

---

## Limitaciones Tecnicas

### 1. Despliegue de instancia unica

No hay estrategia de escalado horizontal. El WS Gateway, el backend REST y Redis corren como instancias unicas. No hay load balancer, no hay replicacion de servicios, no hay orquestacion (Kubernetes, ECS, etc.).

**Impacto**: El sistema tiene un techo de concurrencia definido por los recursos de una sola maquina. Cualquier caida de un servicio detiene esa funcionalidad completamente.

---

### 2. Sin CI/CD

No existen pipelines de integracion continua ni despliegue continuo. No hay GitHub Actions, GitLab CI, Jenkins ni ninguna herramienta de automatizacion. Cada despliegue es manual.

**Impacto**: Alto riesgo de errores humanos en despliegue. No hay validacion automatica de que los tests pasen, el linting sea correcto o el build sea exitoso antes de subir a produccion.

---

### 3. Sin migraciones de base de datos visibles

Alembic esta mencionado como herramienta de migraciones pero no se encontraron archivos de migracion en el repositorio. No hay historial versionado de cambios al esquema.

**Impacto**: Los cambios al esquema de base de datos no son reproducibles, auditables ni reversibles. Coordinar cambios entre desarrolladores es propenso a errores.

---

### 4. Sin backups automatizados

No existe procedimiento documentado ni automatizado de backup y restore. No hay snapshots de base de datos, no hay exportacion periodica, no hay plan de recuperacion ante desastres.

**Impacto**: Una falla de disco, una corrupcion de datos o un error humano (`DROP TABLE`) resulta en perdida total de datos sin posibilidad de recuperacion.

---

### 5. Sin TLS en desarrollo

El entorno de desarrollo usa HTTP y WS (sin cifrado). La configuracion de TLS para produccion no esta documentada ni implementada.

**Impacto**: En desarrollo, las credenciales viajan en texto plano. En produccion, se requiere configuracion manual de certificados y reverse proxy.

---

### 6. Sin agregacion de logs

Los logs van a stdout unicamente. No hay integracion con ELK Stack, Splunk, Datadog, Grafana Loki ni ninguna plataforma de observabilidad.

**Impacto**: Diagnosticar problemas en produccion requiere acceso SSH al servidor y revision manual de logs. No hay alertas, no hay busqueda historica, no hay correlacion entre servicios.

---

### 7. Problemas especificos de Windows

El entorno de desarrollo principal es Windows, lo que genera fricciones:

- `StatReload` de uvicorn puede fallar, requiriendo `watchfiles` como workaround.
- `uvicorn` no esta en PATH; debe usarse `python -m uvicorn`.
- `PYTHONPATH` requiere sintaxis de PowerShell (`$env:PYTHONPATH`).
- Separadores de ruta pueden causar problemas en scripts.

**Impacto**: Developers nuevos pierden tiempo significativo configurando el entorno. El DevContainer mitiga parcialmente pero no elimina el problema.

---

### 8. Reconexion de WebSocket no es atomica

Durante la ventana de reconexion (cuando un cliente WebSocket pierde conexion y se reconecta), los eventos emitidos en ese intervalo se pierden. No hay mecanismo de "catch-up" que entregue eventos perdidos tras la reconexion.

**Impacto**: Un mozo que cambia de red WiFi a datos moviles podria perder una llamada de servicio o la notificacion de un pedido listo.

---

### 9. Restricciones del React Compiler

Los tres frontends usan `babel-plugin-react-compiler`, que impone reglas estrictas: no hooks condicionales, no efectos secundarios en render, refs con tratamiento especial. Esto puede entrar en conflicto con ciertos patrones de librerias de terceros.

**Impacto**: Algunas librerias del ecosistema React pueden no ser compatibles sin ajustes. El debugging de problemas de rendimiento cambia respecto al modelo mental tradicional de React.

---

### 10. Sin rate limiting por tipo de evento en WebSocket

El broadcast global del WS Gateway tiene un limite de 10 eventos por segundo, pero no hay limitacion por tipo de evento. Un flujo intenso de eventos `CART_ITEM_UPDATED` podria saturar el canal en detrimento de eventos criticos como `ROUND_SUBMITTED`.

**Impacto**: En escenarios de alta carga (multiples mesas ordenando simultaneamente), eventos criticos podrian experimentar latencia.

---

### 11. Inconsistencia en VITE_API_URL

Dashboard configura `VITE_API_URL` sin el sufijo `/api`, mientras que pwaMenu y pwaWaiter lo incluyen. Esto genera confusion para desarrolladores y es una fuente potencial de bugs al configurar nuevos entornos.

**Impacto**: Friccion en el onboarding de desarrolladores y riesgo de errores 404 en nuevas configuraciones.

---

### 12. Sin tests end-to-end

Existen tests unitarios (Vitest para frontends, pytest para backend) pero no hay tests E2E con Playwright, Cypress u otra herramienta. Los flujos criticos (login -> crear pedido -> pagar -> cerrar mesa) no estan validados de forma automatizada.

**Impacto**: Regresiones en flujos de usuario completos solo se detectan manualmente. Alto riesgo de romper flujos criticos sin darse cuenta.

---

### 13. Sin load testing

Las afirmaciones de rendimiento (160ms para broadcast a 400 usuarios, worker pool con 10 workers paralelos) no estan respaldadas por tests de carga automatizados. No hay scripts de k6, Artillery, Locust ni herramientas similares.

**Impacto**: No hay certeza de que el sistema soporte la carga esperada en produccion. Los numeros citados son teoricos o de pruebas manuales no reproducibles.

---

## Resumen por Severidad

| Severidad | Cantidad | Ejemplos Clave |
|-----------|----------|----------------|
| **Critica** | 3 | Sin backups, instancia unica WS Gateway, sin CI/CD |
| **Alta** | 6 | Sin migraciones, sin E2E tests, sin notificaciones push, cocina placeholder |
| **Media** | 8 | Sin modo claro, sin undo, sin auditoria UI, CORS inconsistente |
| **Baja** | 6 | Settings basico, exclusiones placeholder, React Compiler restricciones |

---

*Ultima actualizacion: Abril 2026*
