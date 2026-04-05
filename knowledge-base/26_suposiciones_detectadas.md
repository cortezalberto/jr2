# 26. Suposiciones Detectadas

> Listado de suposiciones implicitas encontradas en el diseniio y la implementacion de Integrador / Buen Sabor. Estas suposiciones no estan documentadas como decisiones explicitas y podrian generar comportamientos inesperados si no son validadas.

---

## Que es una "suposicion detectada"

Una suposicion detectada es un comportamiento o restriccion del sistema que:
- No esta documentado como decision de diseniio explicita.
- Podria ser intencional o accidental.
- Tiene potencial de causar bugs o comportamientos inesperados.
- Requiere confirmacion del product owner o del equipo tecnico.

Cada suposicion incluye la evidencia encontrada, el riesgo asociado y una pregunta para validar.

---

## 1. Branch slugs son unicos globalmente entre tenants — CONFIRMADO

**Evidencia**: pwaMenu usa `VITE_BRANCH_SLUG` para identificar la sucursal sin incluir ningun contexto de tenant. El endpoint publico `/api/public/menu/{slug}` busca el menu por slug sin discriminar por tenant.

**Estado**: **CONFIRMADO** (2026-04-04). Los branch slugs son globalmente unicos en la base de datos. Esto es una decision intencional.

**Implicacion**: La restriccion de unicidad global debe estar enforced a nivel de base de datos (UNIQUE constraint en el campo slug de la tabla branch). Esto permite que los endpoints publicos funcionen sin contexto de tenant.

---

## 2. Los codigos de mesa NO son unicos entre sucursales (CONFIRMADO)

**Evidencia**: CLAUDE.md explicitamente indica: "Table codes are alphanumeric (e.g., 'INT-01') and NOT unique across branches — branch_slug is required."

**Estado**: Confirmado como decision intencional. El `branch_slug` se requiere para desambiguar.

**Implicacion**: Todo endpoint que reciba un codigo de mesa DEBE incluir el `branch_slug` o `branch_id`. Una busqueda por codigo de mesa sin contexto de branch dara resultados ambiguos.

---

## 3. Las asignaciones de mozos son diarias, no en tiempo real

**Evidencia**: El modelo `WaiterSectorAssignment` tiene un campo de fecha. La verificacion de acceso (`verify-branch-assignment`) comprueba que el mozo este asignado para la fecha de HOY.

**Suposicion**: La asignacion se hace una vez al dia (probablemente al inicio del turno) y no puede modificarse durante el servicio. Si un mozo se enferma a mitad del turno, el manager deberia poder reasignar.

**Riesgo**: Medio. Que pasa con las sesiones activas de mesas asignadas al mozo que se fue? Otro mozo las ve? Las notificaciones WebSocket dejan de llegar al mozo que fue desasignado?

**Pregunta para validar**: Se puede cambiar la asignacion de sector a mitad de turno? Que pasa con las mesas activas del mozo anterior?

---

## 4. Los clientes pueden seguir ordenando durante el estado PAYING — BUG CONFIRMADO

**Evidencia**: CLAUDE.md indica: "Customers can still order during PAYING". La sesion de mesa pasa de OPEN a PAYING cuando se solicita la cuenta, pero no se bloquea la creacion de nuevas rondas.

**Estado**: **BUG CONFIRMADO** (2026-04-04). El product owner confirmo que si pidieron la cuenta, NO deben poder seguir pidiendo. Esto debe corregirse.

**Correccion necesaria**:
- Backend: Bloquear creacion de nuevas rondas cuando `table_session.status == PAYING`.
- pwaMenu: Deshabilitar el boton de "Agregar al carrito" y "Proponer enviar pedido" cuando el estado de la sesion es PAYING.
- Actualizar CLAUDE.md para reflejar el comportamiento correcto.

**Riesgo**: Medio-Alto. Items agregados despues de solicitar la cuenta no estarian incluidos en el check, generando inconsistencias contables.

---

## 5. La sesion expira tras 8 horas de inactividad

**Evidencia**: pwaMenu CLAUDE.md indica que los datos cacheados tienen TTL de 8 horas basado en ultima actividad. Los tokens de mesa tienen duracion de 3 horas.

**Suposicion**: Si una mesa queda abierta sin actividad durante 8 horas (ej: un grupo que se olvida de cerrar la sesion), la sesion expira automaticamente.

**Riesgo**: Medio. Que pasa con checks no pagados cuando la sesion expira? Se pierde el historial de pedidos? Se libera la mesa automaticamente?

**Pregunta para validar**: Existe un mecanismo explicito de expiracion de sesion en el backend? Que pasa con los checks pendientes?

---

## 6. Los precios son siempre en Pesos Argentinos (ARS)

**Evidencia**: La integracion con Mercado Pago usa ARS. La funcion `formatCurrency` en los frontends formatea como moneda argentina. Los precios se almacenan en centavos (enteros) sin campo de moneda.

**Suposicion**: No hay soporte multi-moneda. Un restaurante en otro pais no podria usar el sistema sin modificar el codigo de formateo y la integracion de pagos.

**Riesgo**: Bajo (actualmente). Alto si se planea expansion internacional.

**Pregunta para validar**: El sistema esta disenado exclusivamente para el mercado argentino? Se planea soporte multi-moneda?

---

## 7. Cada usuario pertenece a exactamente un tenant

**Evidencia**: El JWT contiene un unico `tenant_id`. No hay tabla de relacion usuario-tenant (N:M). Los endpoints siempre operan en el contexto de un solo tenant.

**Suposicion**: Un usuario no puede pertenecer a multiples restaurantes simultaneamente. Un consultor gastronómico, una cadena de franquicias con management centralizado, o un empleado que trabaja en dos restaurantes distintos no pueden usar la misma cuenta.

**Riesgo**: Medio. Limita el modelo de negocio a restaurantes independientes. Las cadenas de franquicias necesitarian una cuenta por marca.

**Pregunta para validar**: Se necesita soporte para usuarios multi-tenant? Cual es el modelo para cadenas de restaurantes?

---

## 8. pgvector y Ollama estan parcialmente integrados — EXPERIMENTAL CONFIRMADO

**Evidencia**: El docker-compose usa la imagen `pgvector/pgvector:pg16` (PostgreSQL con extension de vectores). Existen variables de entorno para Ollama. En pwaMenu hay un componente `AIChat`. Sin embargo, no se encontro documentacion de que flujo de IA esta funcionando.

**Estado**: **EXPERIMENTAL CONFIRMADO** (2026-04-04). El product owner confirmo que la integracion AI/RAG es experimental. No esta en produccion ni es prioritaria.

**Implicacion**: No invertir esfuerzo en estabilizar o documentar esta feature hasta que se tome la decision de avanzar. Los recursos de Ollama (memoria) podrian omitirse en deploys de produccion para ahorrar costos.

---

## 9. El carrito compartido es local por dispositivo — CONFIRMADO INTENCIONAL

**Evidencia**: pwaMenu CLAUDE.md indica: "Shared Cart is Local-Only: WebSocket updates round status but cart stays per-device". Los eventos `CART_ITEM_ADDED`, `CART_ITEM_UPDATED`, `CART_ITEM_REMOVED` existen pero pwaMenu los maneja localmente.

**Estado**: **CONFIRMADO INTENCIONAL** (2026-04-04). El carrito es per-device por diseniio. Cada comensal gestiona su propio carrito. La consolidacion ocurre al enviar la ronda (group confirmation).

**Implicacion**: La UX debe comunicar claramente que cada comensal tiene su propio carrito y que los items se combinan al enviar. El mecanismo de "group confirmation" mitiga el riesgo de envios duplicados.

---

## 10. Soft delete para todas las entidades de negocio

**Evidencia**: CLAUDE.md establece: "All entities use soft delete (is_active = False) by default. Hard delete only for ephemeral records (e.g., cart items, expired sessions)."

**Suposicion**: Los items de carrito y las sesiones expiradas se eliminan fisicamente (hard delete). El resto de entidades se marca como inactivas. Pero la definicion de "efimero" podria no estar clara para todos los tipos de registro.

**Riesgo**: Bajo. Si los cart items se acumulan sin hard delete, la tabla podria crecer innecesariamente. Si se hace hard delete de algo que no es efimero, se pierde auditoria.

**Pregunta para validar**: Existe un job periodico de limpieza de registros efimeros? Que entidades exactamente usan hard delete?

---

## 11. Escala objetivo: 600 usuarios concurrentes — CONFIRMADO

**Evidencia**: Todos los servicios corren como instancia unica. No hay load balancer, no hay replicacion, no hay orquestacion. Las optimizaciones del WS Gateway (worker pool, sharded locks) estan orientadas a maximizar una sola instancia.

**Estado**: **CONFIRMADO** (2026-04-04). El target es 600 usuarios concurrentes. Esto esta DENTRO de la capacidad demostrada del WS Gateway (benchmarked para 400+ usuarios en ~160ms por broadcast).

**Implicacion**: Una sola instancia del WS Gateway deberia ser suficiente para el target actual (600 < 1000 max connections). Sin embargo, se recomienda:
- Load testing real para validar el claim de 600 usuarios
- Plan de contingencia si se supera el target (horizontal scaling via Redis Streams)
- Monitoreo de metricas de conexion para detectar acercamiento al limite

---

## 12. El sistema esta orientado al mercado argentino

**Evidencia**: Integracion con Mercado Pago (gateway de pago argentino). Moneda ARS. UI en espaniol rioplatense. Cumplimiento de regulacion EU 1169/2011 para alergenos (aplicable pero no especifica de Argentina).

**Suposicion**: Aunque la arquitectura es multi-tenant y multi-branch, el sistema asume un contexto argentino en cuanto a moneda, idioma de la interfaz administrativa y metodo de pago.

**Riesgo**: Bajo actualmente. Si se busca expansion internacional, se requiere: abstraccion de moneda, abstraccion de gateway de pago, i18n del Dashboard, y posiblemente adaptacion a regulaciones locales.

**Pregunta para validar**: El producto esta disenado exclusivamente para Argentina? Hay planes de internacionalizacion? Que mercados son prioritarios?

---

## Resumen de Validacion

| # | Suposicion | Estado | Riesgo | Necesita Respuesta |
|---|-----------|--------|--------|-------------------|
| 1 | Branch slug unico global | **CONFIRMADO** | N/A | No |
| 2 | Table code no unico por branch | **CONFIRMADO** | N/A | No |
| 3 | Asignacion diaria de mozos | Parcial | Medio | Si |
| 4 | Ordenar durante PAYING | **BUG CONFIRMADO** | Medio-Alto | No (corregir) |
| 5 | Session expira a 8h inactividad | Parcial | Medio | Si |
| 6 | Precios solo en ARS | Implicita | Bajo | Si (si expansion) |
| 7 | Usuario = 1 tenant | Implicita | Medio | Si |
| 8 | IA parcialmente integrada | **EXPERIMENTAL** | Bajo | No |
| 9 | Carrito local por device | **CONFIRMADO INTENCIONAL** | N/A | No |
| 10 | Soft delete universal | Documentada | Bajo | Si |
| 11 | Escala: 600 concurrentes | **CONFIRMADO** | Bajo | No |
| 12 | Mercado argentino | Implicita | Bajo | Si (si expansion) |

**Resumen de validacion (2026-04-04)**: 5 de 12 suposiciones confirmadas. 1 bug identificado (ordenar durante PAYING). 6 pendientes de validacion.

---

*Ultima actualizacion: Abril 2026*
