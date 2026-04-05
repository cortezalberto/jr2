# Casos de Uso

Este documento especifica los casos de uso principales del sistema **Integrador / Buen Sabor** con precondiciones, postcondiciones, flujos alternativos y reglas de negocio.

---

## UC-01: Cliente Se Une a una Mesa

### Descripción
Un comensal escanea el código QR de una mesa y se une a la sesión activa o inicia una nueva.

### Actores
- **Principal**: Comensal (sin autenticación previa).

### Precondiciones
1. La mesa existe en el sistema y está asociada a una sucursal activa.
2. El código QR contiene el código de mesa y el `branch_slug`.
3. El WebSocket Gateway está operativo en el puerto 8001.

### Flujo Principal
1. El comensal escanea el código QR.
2. La aplicación se abre y muestra la página de ingreso.
3. El comensal ingresa el código de mesa (alfanumérico, ej: "INT-01").
4. Opcionalmente ingresa su nombre.
5. El sistema consulta `GET /api/tables/code/{code}/session` con el `branch_slug`.
6. Se une a la sesión existente o se crea una nueva.
7. Se ejecuta `POST /api/diner/register` con `device_id`.
8. El sistema emite un `table_token` (HMAC, vigencia 3 horas).
9. Se establece conexión WebSocket al endpoint `/ws/diner`.
10. El comensal ve la página principal con el menú.

### Flujos Alternativos

**FA-1: La mesa ya tiene sesión activa**
- En el paso 6, si ya existe una sesión activa para esa mesa, el comensal se une a la sesión existente.
- El comensal se agrega como un nuevo diner en la sesión.
- Los demás comensales reciben notificación del nuevo integrante.
- El carrito compartido se sincroniza con los ítems ya existentes.

**FA-2: La sesión expiró por inactividad (8 horas)**
- En el paso 6, si la última sesión tiene más de 8 horas de inactividad, se considera expirada.
- Se crea una nueva sesión automáticamente.
- Los datos de la sesión anterior se archivan.

**FA-3: Código de mesa inválido**
- En el paso 5, si el código no corresponde a ninguna mesa de la sucursal, el backend retorna error.
- Se muestra mensaje: "Mesa no encontrada. Verificá el código e intentá de nuevo."
- El comensal puede reintentar con otro código.

**FA-4: Sucursal inactiva**
- Si la sucursal asociada al `branch_slug` no está activa, se muestra un error informativo.
- No se permite iniciar sesión.

### Postcondiciones
1. El comensal está registrado como diner en la sesión de la mesa.
2. Se emitió un `table_token` válido almacenado en localStorage.
3. La conexión WebSocket está activa y recibiendo eventos.
4. El `device_id` está asociado al customer para fidelización.

### Reglas de Negocio
- Los códigos de mesa NO son únicos globalmente; se requiere `branch_slug` para desambiguar.
- El `table_token` usa HMAC para autenticación, diferente del JWT del staff.
- El TTL de la sesión es de 8 horas basado en última actividad, no en creación.

---

## UC-02: Pedido Compartido con Carrito (Shared Cart)

### Descripción
Múltiples comensales en una mesa agregan ítems a un carrito compartido y coordinan el envío del pedido.

### Actores
- **Principal**: Comensal con sesión activa.
- **Secundarios**: Otros comensales de la misma mesa.

### Precondiciones
1. El comensal tiene un `table_token` válido.
2. La conexión WebSocket está activa.
3. El menú de la sucursal está disponible.

### Flujo Principal
1. El comensal navega el menú y selecciona un producto.
2. Se abre el modal de detalle del producto.
3. El comensal selecciona la cantidad y toca "Agregar".
4. El ítem se agrega al carrito con UI optimista (aparece inmediatamente).
5. Se emite evento `CART_ITEM_ADDED` por WebSocket a todos los comensales.
6. Los demás comensales ven el ítem con nombre y color del agregador.
7. Un comensal toca "Proponer enviar pedido".
8. Se muestra el `RoundConfirmationPanel` a todos los comensales.
9. Cada comensal confirma tocando "Estoy listo".
10. Cuando todos confirman, se espera 1,5 segundos.
11. El pedido se envía automáticamente: `POST /api/diner/rounds/submit`.
12. Se crea la ronda con estado `ROUND_PENDING`.
13. El carrito se limpia.

### Flujos Alternativos

**FA-1: No todos los comensales confirman dentro de 5 minutos**
- En el paso 9, si el timer de 5 minutos expira sin confirmación total, la propuesta caduca.
- Se notifica a todos los comensales que la propuesta expiró.
- El carrito permanece intacto.
- Cualquier comensal puede volver a proponer.

**FA-2: El proponente cancela la propuesta**
- En cualquier momento entre los pasos 7 y 10, el proponente puede cancelar.
- Se notifica a todos los comensales.
- El `RoundConfirmationPanel` se cierra.
- El carrito permanece intacto.

**FA-3: Error de red al enviar el pedido**
- En el paso 11, si falla la conexión, se ejecuta rollback optimista.
- El carrito se restaura al estado previo.
- Se muestra mensaje de error con opción de reintentar.

**FA-4: Un comensal modifica el carrito durante la confirmación**
- Los ítems del carrito se bloquean durante la fase de confirmación.
- Para modificar, se debe cancelar la propuesta primero.

### Postcondiciones
1. La ronda se creó con estado `ROUND_PENDING` en el backend.
2. Todos los ítems del carrito están asociados a la ronda.
3. El carrito compartido está vacío.
4. El mozo del sector recibió notificación de nuevo pedido.

### Reglas de Negocio
- Solo un comensal puede proponer enviar a la vez.
- La confirmación requiere unanimidad de todos los comensales activos.
- El delay de 1,5 segundos permite cancelaciones de último momento.
- Los ítems muestran a qué comensal pertenecen (nombre + color asignado).

---

## UC-03: Mozo Confirma Pedido

### Descripción
El mozo revisa y confirma un pedido pendiente de los comensales.

### Actores
- **Principal**: Mozo (rol `WAITER`).
- **Secundario**: Comensal (recibe actualización de estado).

### Precondiciones
1. La ronda está en estado `PENDING`.
2. El mozo está autenticado y asignado al sector de la mesa.
3. La conexión WebSocket del mozo está activa.

### Flujo Principal
1. La grilla de mesas muestra pulso amarillo en la mesa con pedido pendiente.
2. El mozo toca la mesa para abrir el `TableDetailModal`.
3. Ve los ítems del pedido con detalle (producto, cantidad, comensal).
4. Confirma el pedido → `confirmRound(roundId)`.
5. Estado de la ronda: `PENDING` → `CONFIRMED`.
6. Evento `ROUND_CONFIRMED` emitido por WebSocket.

### Flujos Alternativos

**FA-1: El mozo elimina un ítem de la ronda**
- En el paso 3, el mozo puede eliminar ítems individuales.
- El ítem se quita de la ronda.
- Si quedan ítems, la ronda continúa normalmente.

**FA-2: El mozo elimina todos los ítems**
- Si se eliminan todos los ítems, la ronda se auto-elimina.
- Evento `ROUND_CANCELED` emitido.
- La mesa vuelve al estado previo.

**FA-3: El mozo no está asignado al sector**
- Los eventos con `sector_id` solo llegan a mozos asignados.
- Si el mozo no tiene asignación al sector, no verá la notificación.
- Un `ADMIN` o `MANAGER` siempre puede intervenir.

### Postcondiciones
1. La ronda está en estado `CONFIRMED`.
2. El pedido queda listo para ser enviado a cocina por un `ADMIN` o `MANAGER`.

### Reglas de Negocio
- Solo usuarios con rol `WAITER`, `ADMIN` o `MANAGER` pueden confirmar pedidos.
- La cocina NO ve pedidos hasta que alcancen el estado `SUBMITTED`.
- El enrutamiento por sector optimiza la carga de notificaciones.

---

## UC-04: Cocina Procesa un Pedido

### Descripción
La cocina recibe un pedido confirmado, lo prepara y lo marca como listo.

### Actores
- **Principal**: Personal de cocina (rol `KITCHEN`).
- **Secundarios**: Mozo y comensales (reciben actualizaciones).

### Precondiciones
1. La ronda está en estado `SUBMITTED` (enviada a cocina por admin/manager).
2. El personal de cocina está conectado al WebSocket `/ws/kitchen`.

### Flujo Principal
1. Evento `ROUND_SUBMITTED` llega por WebSocket.
2. Un nuevo ticket aparece en la pantalla de cocina.
3. El ticket muestra: mesa, ítems, cantidades, notas.
4. La cocina comienza la preparación → marca `IN_KITCHEN`.
5. Evento `ROUND_IN_KITCHEN` se envía a admin, mozos y comensales.
6. La cocina finaliza → marca `READY`.
7. Evento `ROUND_READY` se envía a todos los interesados.

### Flujos Alternativos

**FA-1: Ítem no disponible**
- Funcionalidad pendiente de implementación (feature futuro).
- Actualmente la cocina no puede marcar ítems individuales como no disponibles.
- Workaround: comunicación directa con el mozo para informar al comensal.

**FA-2: Pedido cancelado antes de preparación**
- Si la ronda es cancelada mientras está en `SUBMITTED`, la cocina recibe `ROUND_CANCELED`.
- El ticket desaparece de la pantalla.

### Postcondiciones
1. La ronda está en estado `READY`.
2. El mozo fue notificado (parpadeo naranja en su grilla).
3. El comensal fue notificado en la app (UI actualizada).
4. El ticket de cocina (`KitchenTicket`) queda registrado.

### Reglas de Negocio
- La cocina solo ve pedidos a partir del estado `SUBMITTED`.
- Los estados `PENDING` y `CONFIRMED` son invisibles para la cocina.
- El flujo de estados es estrictamente secuencial: `SUBMITTED` → `IN_KITCHEN` → `READY`.

---

## UC-05: División y Pago de Cuenta

### Descripción
Los comensales o el mozo solicitan la cuenta, eligen un método de división y procesan el pago.

### Actores
- **Principal**: Comensal o Mozo.
- **Secundarios**: Sistema de Mercado Pago (para pagos digitales).

### Precondiciones
1. La sesión tiene al menos una ronda con ítems servidos.
2. No existe una cuenta activa previa sin pagar.

### Flujo Principal
1. Se solicita la cuenta (comensal desde pwaMenu o mozo desde pwaWaiter).
2. `POST /api/billing/check/request` crea el registro Check.
3. Evento `CHECK_REQUESTED` emitido vía Outbox Pattern.
4. Se calcula el total con todos los ítems de rondas servidas.
5. Se elige método de división.
6. Se procesa el pago según método seleccionado.
7. Cuando el total está cubierto → `CHECK_PAID`.

### Métodos de División

**Partes iguales**
- Total de la cuenta / cantidad de comensales.
- Cada comensal paga el mismo monto.
- Redondeo: el último comensal absorbe la diferencia por centavos.

**Por consumo**
- Se agrupan los ítems por comensal (basado en quién agregó cada ítem al carrito).
- Cada comensal paga exactamente lo que pidió.
- Los ítems compartidos se dividen entre quienes participaron.

**Personalizado**
- Se permite ingresar montos manuales por comensal.
- Validación: la suma de montos debe cubrir el total de la cuenta.
- Permite que un comensal pague por otros.

### Flujos Alternativos

**FA-1: Pago parcial**
- Si un comensal paga su parte pero otros no, se registra como pago parcial.
- El registro Payment se asocia al Check vía Allocation (FIFO).
- Se mantiene el saldo pendiente hasta completar.

**FA-2: Pago con Mercado Pago**
- Se crea preferencia: `POST /api/billing/mercadopago/preference`.
- Redirect al checkout de Mercado Pago.
- El cliente completa el pago.
- Callback al backend registra el resultado.
- `PAYMENT_APPROVED` o `PAYMENT_REJECTED` vía Outbox.

**FA-3: Pago manual (efectivo, tarjeta, transferencia)**
- El mozo registra: `POST /api/waiter/payments/manual`.
- Indica método y monto.
- Se genera el registro de pago inmediatamente.

**FA-4: Los clientes siguen pidiendo durante el proceso de pago**
- El estado de la sesión es `PAYING`, pero los comensales pueden seguir ordenando.
- Los nuevos ítems se agregan a la cuenta existente.
- El total se recalcula.

### Postcondiciones
1. El Check tiene estado pagado.
2. Los pagos están registrados con método y monto.
3. El modelo Allocation vincula cada pago con los cargos (FIFO).
4. El mozo puede cerrar la mesa.

### Reglas de Negocio
- Eventos de billing usan Outbox Pattern (garantía de entrega, no se pueden perder).
- Los precios se calculan en centavos para evitar errores de punto flotante.
- El modelo de datos sigue: Check → Charge → Allocation ← Payment.
- Rate limiting en endpoints de billing: 5-20 requests/minuto.

---

## UC-06: Comanda Rápida (Pedido Asistido por Mozo)

### Descripción
El mozo toma un pedido para clientes que no tienen celular o prefieren no usar la app.

### Actores
- **Principal**: Mozo (rol `WAITER`).
- **Secundario**: Comensal (sin interacción digital).

### Precondiciones
1. El mozo está autenticado y asignado a la sucursal.
2. Existe al menos una mesa disponible (libre o activa).

### Flujo Principal
1. El mozo accede a la pestaña "Autogestión" en la app.
2. Selecciona una mesa del dropdown.
3. Si la mesa está LIBRE: ingresa cantidad de comensales.
4. `activateTable()` crea sesión con estado `OPEN`.
5. Se muestra menú compacto: `GET /api/waiter/branches/{id}/menu`.
6. El mozo navega categorías y agrega productos con cantidad.
7. Revisa el carrito en el panel derecho.
8. Envía el pedido → `submitRound()`.
9. La ronda se crea con estado `ROUND_PENDING`.
10. El mozo confirma inmediatamente → `ROUND_CONFIRMED`.

### Flujos Alternativos

**FA-1: Mesa LIBRE seleccionada**
- Se requiere ingresar la cantidad de comensales.
- `POST /api/waiter/tables/{id}/activate` crea la sesión.
- La mesa pasa de LIBRE a OCUPADA.
- Se procede al paso 2 del menú compacto.

**FA-2: Mesa ACTIVA seleccionada**
- La sesión existente se reutiliza.
- Los nuevos ítems se agregan como una nueva ronda.
- No se requiere activación.

**FA-3: Mozo modifica cantidades antes de enviar**
- En el panel de carrito, el mozo puede ajustar cantidades o eliminar ítems.
- Los cambios son locales hasta que se envía el pedido.

### Postcondiciones
1. La sesión de mesa está activa con los comensales registrados.
2. La ronda está creada con estado `CONFIRMED` (confirmada por el mozo).
3. El menú compacto fue servido sin imágenes para agilidad.

### Reglas de Negocio
- El menú compacto no incluye imágenes para optimizar velocidad.
- El mozo puede confirmar su propio pedido inmediatamente.
- No se requiere confirmación grupal (es responsabilidad del mozo).
- Endpoint específico: `GET /api/waiter/branches/{id}/menu`.

---

## UC-07: Llamada de Servicio

### Descripción
Un comensal solicita atención del mozo a través de la aplicación.

### Actores
- **Principal**: Comensal.
- **Secundario**: Mozo asignado al sector.

### Precondiciones
1. El comensal tiene sesión activa y `table_token` válido.
2. Existe un mozo asignado al sector de la mesa.
3. Las conexiones WebSocket están activas.

### Flujo Principal
1. El comensal toca el botón de llamar al mozo.
2. Se crea la solicitud de servicio en el backend.
3. Evento `SERVICE_CALL_CREATED` emitido vía Outbox Pattern.
4. El mozo ve parpadeo rojo en la mesa (máxima prioridad visual).
5. El mozo toca la mesa → ve la llamada en el modal.
6. Toca "Reconocer" → `SERVICE_CALL_ACKED`.
7. Atiende al cliente en la mesa.
8. Toca "Resolver" → `SERVICE_CALL_CLOSED`.

### Flujos Alternativos

**FA-1: Múltiples llamadas de la misma mesa**
- Cada llamada se registra individualmente.
- El modal de la mesa muestra todas las llamadas activas.
- La animación de parpadeo rojo persiste mientras haya al menos una sin resolver.

**FA-2: Ningún mozo asignado al sector**
- El evento llega a ADMIN y MANAGER (siempre reciben todos los eventos).
- Pueden reasignar o atender directamente.

**FA-3: Mozo reconoce pero no resuelve**
- La llamada queda en estado "reconocida" pero no cerrada.
- No genera nueva animación, pero sigue visible en el modal de la mesa.

### Postcondiciones
1. La llamada de servicio está cerrada (`SERVICE_CALL_CLOSED`).
2. El historial de la llamada queda registrado en la sesión.
3. La animación de la mesa se detiene (si no hay otras llamadas activas).

### Reglas de Negocio
- Los eventos de servicio usan Outbox Pattern (garantía de entrega).
- El enrutamiento por sector asegura que solo los mozos relevantes sean notificados.
- ADMIN y MANAGER siempre reciben todas las notificaciones de la sucursal.

---

## UC-08: Gestión Multi-Sucursal de Precios

### Descripción
El administrador configura precios diferenciados por sucursal para un mismo producto.

### Actores
- **Principal**: Administrador (rol `ADMIN`).

### Precondiciones
1. El producto existe en el sistema.
2. Existen múltiples sucursales configuradas.
3. El usuario tiene rol `ADMIN`.

### Flujo Principal
1. El admin navega a la gestión de productos.
2. Selecciona un producto.
3. Activa `use_branch_prices = true`.
4. Se habilita la tabla de precios por sucursal.
5. Para cada sucursal configura:
   - Precio en centavos (ej: 12550 = $125,50).
   - Estado activo/inactivo (`is_active` en `BranchProduct`).
6. Guarda los cambios.
7. Los registros `BranchProduct` se crean o actualizan.

### Flujos Alternativos

**FA-1: Precio base único (use_branch_prices = false)**
- El producto usa un solo precio base para todas las sucursales.
- No se crean registros `BranchProduct` individuales.
- Todas las sucursales donde el producto está habilitado muestran el mismo precio.

**FA-2: Producto desactivado en una sucursal**
- Si `BranchProduct.is_active = false`, el producto no aparece en el menú de esa sucursal.
- El producto sigue activo en las demás sucursales.

**FA-3: Pricing masivo (bulk)**
- El admin exporta los precios actuales.
- Modifica en lote (spreadsheet o JSON).
- Importa los cambios actualizados.
- Validación masiva de centavos y estados.

### Postcondiciones
1. Los registros `BranchProduct` reflejan los precios por sucursal.
2. El menú público de cada sucursal muestra el precio correcto.
3. Los precios están almacenados en centavos (evita errores de punto flotante).

### Reglas de Negocio
- Los precios SIEMPRE se almacenan en centavos enteros.
- La conversión a pesos se hace solo en el frontend: `cents / 100`.
- La conversión inversa usa `Math.round(price * 100)` para evitar errores.
- Relación M:N: `Product` ←→ `BranchProduct` (con precio y estado por sucursal).

---

## UC-09: Filtrado por Alérgenos

### Descripción
Un comensal configura filtros de alérgenos para ver solo productos seguros en el menú.

### Actores
- **Principal**: Comensal.

### Precondiciones
1. El menú de la sucursal está cargado.
2. Los productos tienen alérgenos configurados con tipo de presencia.

### Flujo Principal
1. El comensal abre los filtros avanzados del menú.
2. Selecciona los alérgenos que debe evitar (ej: gluten, lactosa, maní).
3. Elige el modo de filtrado.
4. El menú se filtra y muestra solo productos seguros.
5. Los productos filtrados desaparecen de todas las vistas.

### Modos de Filtrado

**Modo Estricto**
- Oculta productos que "contienen" (`contains`) el alérgeno seleccionado.
- Muestra productos que "pueden contener" (`may_contain`) con advertencia visual.
- Muestra productos "libres de" (`free_from`).

**Modo Muy Estricto**
- Oculta productos que "contienen" (`contains`) el alérgeno.
- Oculta productos que "pueden contener" (`may_contain`) el alérgeno.
- Solo muestra productos "libres de" (`free_from`) o sin relación con el alérgeno.

### Flujos Alternativos

**FA-1: Reacciones cruzadas**
- Al seleccionar un alérgeno, el sistema advierte sobre alérgenos con reacción cruzada.
- Ejemplo: seleccionar "Látex" advierte automáticamente sobre kiwi y banana.
- El comensal puede optar por incluir o excluir los alérgenos cruzados.

**FA-2: Filtros combinados**
- El comensal puede combinar múltiples filtros:
  - Alérgenos + opciones dietéticas (vegetariano, vegano, sin gluten, keto).
  - Alérgenos + método de cocción.
- Los filtros se aplican de forma acumulativa (AND lógico).

**FA-3: Ningún producto cumple los filtros**
- Se muestra mensaje informativo.
- Se sugiere reducir la cantidad de filtros activos.

### Postcondiciones
1. El menú muestra solo productos que cumplen con los criterios de seguridad.
2. Los filtros persisten durante la sesión del comensal.
3. Los productos eliminados no aparecen en búsqueda ni navegación.

### Reglas de Negocio
- Cumplimiento normativa EU 1169/2011 para declaración de alérgenos.
- Tres niveles de presencia: `contains`, `may_contain`, `free_from`.
- Cuatro niveles de severidad: `mild`, `moderate`, `severe`, `life_threatening`.
- El sistema de reacciones cruzadas es informativo (advertencia, no bloqueo automático).

---

## UC-10: Verificación de Asignación del Mozo

### Descripción
El sistema verifica que un mozo esté asignado a una sucursal específica para el día actual antes de permitir el acceso.

### Actores
- **Principal**: Mozo (rol `WAITER`).
- **Secundario**: Administrador (gestiona asignaciones).

### Precondiciones
1. El mozo tiene credenciales válidas.
2. Existe al menos una sucursal activa.
3. El administrador ha configurado asignaciones de sector para el día.

### Flujo Principal
1. El mozo abre la aplicación → selecciona sucursal de la lista pública.
2. Ingresa credenciales → login exitoso.
3. El sistema ejecuta `GET /api/waiter/verify-branch-assignment?branch_id={id}`.
4. Se verifica que exista un registro `WaiterSectorAssignment` para:
   - El usuario actual.
   - La sucursal seleccionada.
   - La fecha de HOY.
5. Verificación exitosa → acceso al `MainPage` con grilla de mesas.

### Flujos Alternativos

**FA-1: Mozo no asignado hoy a esa sucursal**
- En el paso 4, no se encuentra asignación para hoy.
- Se muestra pantalla "Acceso Denegado".
- El mozo puede:
  - Seleccionar otra sucursal donde sí esté asignado.
  - Contactar al administrador para que actualice la asignación.

**FA-2: Asignación cambia durante el turno**
- Si el administrador modifica la asignación mientras el mozo trabaja, se requiere re-verificación.
- El mozo puede necesitar cerrar y reabrir la app.

**FA-3: Mozo asignado a múltiples sectores**
- Un mozo puede estar asignado a más de un sector en la misma sucursal.
- Recibirá eventos WebSocket de todos sus sectores asignados.
- La grilla muestra todas las mesas de sus sectores.

**FA-4: Sin asignaciones configuradas para hoy**
- Si el administrador no creó asignaciones para el día, ningún mozo puede acceder.
- Se muestra "Acceso Denegado" a todos.
- Requiere intervención del administrador.

### Postcondiciones
1. El mozo tiene acceso al `MainPage` de la sucursal verificada.
2. Los eventos WebSocket se filtran por los sectores asignados al mozo.
3. La verificación es válida solo para el día actual.

### Reglas de Negocio
- La asignación es diaria: se debe configurar cada día de trabajo.
- Un mozo puede trabajar en diferentes sucursales en diferentes días.
- Los roles `ADMIN` y `MANAGER` no requieren asignación de sector (ven todo).
- El endpoint de verificación es específico para el rol `WAITER`.

---

## Matriz de Trazabilidad

| Caso de Uso | Componente Principal | Endpoints Involucrados | Eventos WebSocket |
|-------------|---------------------|----------------------|-------------------|
| UC-01 | pwaMenu | `/api/tables/code/{code}/session`, `/api/diner/register` | -- |
| UC-02 | pwaMenu | `/api/diner/rounds/submit` | `CART_*`, `ROUND_PENDING` |
| UC-03 | pwaWaiter | `/api/waiter/rounds/{id}/confirm` | `ROUND_CONFIRMED` |
| UC-04 | Dashboard/Kitchen | -- | `ROUND_SUBMITTED`, `ROUND_IN_KITCHEN`, `ROUND_READY` |
| UC-05 | pwaMenu, pwaWaiter | `/api/billing/*`, `/api/waiter/payments/manual` | `CHECK_REQUESTED`, `CHECK_PAID`, `PAYMENT_*` |
| UC-06 | pwaWaiter | `/api/waiter/tables/{id}/activate`, `/api/waiter/sessions/{id}/rounds` | `ROUND_PENDING`, `TABLE_SESSION_STARTED` |
| UC-07 | pwaMenu, pwaWaiter | `/api/diner/service-call` | `SERVICE_CALL_CREATED`, `SERVICE_CALL_ACKED`, `SERVICE_CALL_CLOSED` |
| UC-08 | Dashboard | `/api/admin/products`, `/api/admin/branch-products` | `ENTITY_UPDATED` |
| UC-09 | pwaMenu | `/api/public/menu/{slug}` | -- |
| UC-10 | pwaWaiter | `/api/public/branches`, `/api/waiter/verify-branch-assignment` | -- |
