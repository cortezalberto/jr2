# Flujos de Usuario

Este documento describe en detalle todos los flujos de usuario del sistema **Integrador / Buen Sabor**, desde la perspectiva de cada actor.

---

## Flujo 1: Cliente Realiza Pedido vía QR (pwaMenu)

Este es el flujo principal del sistema desde la perspectiva del comensal.

### Precondiciones
- La mesa existe y tiene un código QR válido.
- La sucursal está activa.
- El WebSocket Gateway está operativo en el puerto 8001.

### Flujo Paso a Paso

```
 1. El cliente escanea el código QR en la mesa del restaurante.
 2. El navegador abre la PWA → se muestra la página JoinTable.
 3. El cliente ingresa:
    - Número de mesa (alfanumérico, ej: "INT-01").
    - Nombre (opcional, para identificarse en el carrito compartido).
 4. joinTable() se ejecuta:
    → GET /api/tables/code/{code}/session (con branch_slug)
    → Si existe sesión activa, se une a ella.
    → Si no existe, se crea una nueva sesión.
    → Se almacena el table_token en localStorage.
 5. POST /api/diner/register
    - Se envía device_id para tracking de fidelización (Fase 1).
    - Se registra al comensal en la sesión con nombre y color asignado.
 6. Conexión WebSocket establecida:
    → ws://host:8001/ws/diner?table_token=X
    → Heartbeat cada 30 segundos.
 7. Se renderiza la página Home:
    → GET /api/public/menu/{branch_slug} (cacheado 5 minutos).
    → Se muestran categorías, subcategorías y productos.
 8. El cliente navega el menú:
    → Categorías → Subcategorías → Lista de productos.
    → Cada producto muestra imagen, precio, descripción y badges.
 9. Opcionalmente, el cliente aplica filtros:
    → Alérgenos (modo estricto o muy estricto).
    → Opciones dietéticas (vegetariano, vegano, sin gluten, keto).
    → Método de cocción (parrilla, horno, frito).
10. El cliente toca un producto → se abre ProductDetailModal:
    → Selecciona cantidad.
    → Toca "Agregar".
11. UI optimista: el ítem aparece inmediatamente en el SharedCart.
    → Evento CART_ITEM_ADDED enviado por WebSocket a todos los comensales.
    → El ítem muestra nombre y color del comensal que lo agregó.
12. Cuando el cliente decide ordenar, toca "Proponer enviar pedido".
13. Se muestra RoundConfirmationPanel a todos los comensales de la mesa.
    → Cada comensal ve la lista completa de ítems del carrito.
    → Se inicia timer de 5 minutos.
14. Cada comensal toca "Estoy listo" para confirmar.
15. Cuando TODOS los comensales confirman:
    → Delay de 1,5 segundos (para permitir cancelación de último momento).
    → Submit automático.
16. POST /api/diner/rounds/submit ejecutado:
    → Se crea la ronda con estado ROUND_PENDING.
    → El carrito se limpia.
17. El mozo ve notificación (pulso amarillo en grilla de mesas):
    → Confirma el pedido → estado cambia a ROUND_CONFIRMED.
18. El administrador/gerente envía a cocina:
    → Estado cambia a ROUND_SUBMITTED.
    → Cocina recibe el ticket.
19. La cocina comienza preparación:
    → Estado cambia a ROUND_IN_KITCHEN.
    → Evento WebSocket llega al comensal → UI se actualiza.
20. La cocina finaliza:
    → Estado cambia a ROUND_READY.
    → Evento WebSocket al mozo (parpadeo naranja) y al comensal.
21. El mozo entrega el pedido:
    → Estado cambia a ROUND_SERVED.
    → Evento WebSocket al comensal → pedido marcado como servido.
22. El cliente puede repetir los pasos 8-21 para nuevas rondas.
23. Cuando desea pagar:
    → BottomNav → "Cuenta" → página CloseTable.
24. Selecciona método de división y método de pago:
    - División: partes iguales | por consumo | personalizado.
    - Pago: Mercado Pago | efectivo | tarjeta | transferencia.
25. Si elige Mercado Pago:
    → Se crea preferencia de pago en el backend.
    → Redirect a Mercado Pago.
    → El cliente completa el pago.
    → Redirect de vuelta a /payment/result.
26. Evento CHECK_PAID vía WebSocket (Outbox Pattern):
    → La sesión se marca como pagada.
27. El cliente toca "Dejar mesa":
    → Se limpia la sesión de localStorage.
    → Se desconecta el WebSocket.
    → Redirect a la página de QRSimulator / ingreso.
```

### Manejo de Errores
- **Error de red al enviar pedido**: rollback optimista, se restaura el carrito.
- **Timeout de confirmación grupal (5 min)**: la propuesta expira, se notifica a todos.
- **Sesión expirada (8h inactividad)**: se redirige al ingreso con mensaje informativo.
- **Mesa inexistente**: mensaje de error con sugerencia de verificar el código.

---

## Flujo 2: Jornada Diaria del Mozo (pwaWaiter)

### Precondiciones
- El mozo tiene credenciales válidas.
- Existe asignación de sector para el día actual.
- La sucursal está activa.

### Flujo Paso a Paso

```
 1. El mozo abre la aplicación → PreLoginBranchSelectPage.
 2. GET /api/public/branches (sin autenticación):
    → Se muestra lista de sucursales disponibles.
    → El mozo selecciona su sucursal de trabajo.
 3. Login con email y contraseña:
    → POST /api/auth/login → JWT (access + refresh tokens).
 4. verifyBranchAssignment() ejecutado:
    → GET /api/waiter/verify-branch-assignment?branch_id={id}
    → Verifica que el mozo esté asignado a esa sucursal HOY.
    → Si no está asignado → pantalla "Acceso Denegado".
 5. Si está verificado → MainPage con 2 pestañas principales.
 6. Pestaña "Comensales": grilla de mesas agrupadas por sector.
    → Las mesas se organizan visualmente por sector (Interior, Terraza, etc.).
    → Cada mesa muestra su estado con color y código.
 7. Las mesas muestran animaciones en tiempo real según eventos:
    - PARPADEO ROJO: llamada de servicio → PRIORIDAD URGENTE.
    - PULSO AMARILLO: nuevo pedido pendiente de confirmación.
    - PARPADEO NARANJA: pedido listo + otras rondas aún en cocina.
    - PARPADEO AZUL: cambio de estado de mesa.
    - PULSO VIOLETA: cuenta solicitada.
 8. El mozo toca una mesa → se abre TableDetailModal:
    → Información de la sesión (comensales, hora de inicio, duración).
    → Rondas filtradas por estado (pendientes / listas / servidas).
    → Llamadas de servicio activas.
 9. Para pedidos pendientes (pulso amarillo):
    → El mozo revisa los ítems del pedido.
    → Toca "Confirmar" → confirmRound(roundId).
    → Estado: PENDING → CONFIRMED.
    → Puede eliminar ítems individuales si es necesario.
10. Cuando llega una llamada de servicio (parpadeo rojo):
    → El mozo toca la mesa → ve la llamada en el modal.
    → Toca "Reconocer" (acknowledge) → se detiene la animación.
    → Atiende al cliente.
    → Toca "Resolver" → SERVICE_CALL_CLOSED.
11. Cuando un pedido está listo (parpadeo naranja):
    → El mozo retira el pedido de cocina.
    → Entrega al cliente.
    → Marca como servido → ROUND_SERVED.
12. Cuando el cliente pide la cuenta (pulso violeta):
    → El mozo abre el detalle de la mesa.
    → Revisa el total y los ítems consumidos.
    → Procesa el pago según método:
      a. Efectivo: registra pago manual con monto recibido y vuelto.
      b. Tarjeta: registra pago manual.
      c. Transferencia: registra pago manual.
      d. Mercado Pago: el cliente gestiona desde su celular.
13. Tras pago completo:
    → El mozo cierra la mesa → POST /api/waiter/tables/{id}/close.
    → La sesión se archiva.
    → La mesa vuelve a estado "libre" (verde).
    → Evento TABLE_CLEARED enviado por WebSocket.
```

### Flujo de Refresh de Token
- Cada 14 minutos se ejecuta refresh proactivo del JWT.
- Si el refresh falla, se redirige al login.
- El refresh token está en una HttpOnly cookie (7 días de vigencia).

---

## Flujo 3: Comanda Rápida (Mozo Toma Pedido para Cliente sin Celular)

### Precondiciones
- El mozo está autenticado y asignado a la sucursal.
- Existe al menos una mesa libre o activa.

### Flujo Paso a Paso

```
 1. El mozo toca la pestaña "Autogestión" en MainPage.
 2. Se abre el modal de Comanda Rápida (dos pasos).

    === PASO 1: Selección de mesa ===
 3. Se muestra un dropdown con las mesas disponibles.
 4. El mozo selecciona una mesa:
    a. Si la mesa está LIBRE:
       → Ingresa cantidad de comensales.
       → activateTable() → POST /api/waiter/tables/{id}/activate.
       → Se crea una nueva sesión con los comensales indicados.
       → Estado de mesa: LIBRE → OCUPADA.
    b. Si la mesa está ACTIVA (ya tiene sesión):
       → Se usa la sesión existente.
       → Se pueden agregar ítems a rondas posteriores.

    === PASO 2: Menú compacto y armado del pedido ===
 5. Panel izquierdo: menú compacto sin imágenes.
    → GET /api/waiter/branches/{id}/menu
    → Solo muestra nombre, precio y categoría.
    → Optimizado para velocidad de selección.
 6. El mozo navega: Categorías → Productos.
 7. Toca un producto → selecciona cantidad → "Agregar al pedido".
 8. Panel derecho: carrito con los ítems seleccionados.
    → Muestra nombre, cantidad, precio unitario y subtotal.
    → Permite modificar cantidades o eliminar ítems.
 9. El mozo revisa el pedido completo.
10. Toca "Enviar pedido":
    → submitRound() ejecutado.
    → POST /api/waiter/sessions/{id}/rounds.
    → Ronda creada con estado ROUND_PENDING.
11. El mozo confirma inmediatamente:
    → PENDING → CONFIRMED.
    → El pedido queda listo para ser enviado a cocina.
```

### Diferencias con Pedido por QR
- No requiere que el cliente tenga celular.
- El menú es compacto (sin imágenes) para agilidad.
- No hay confirmación grupal (el mozo decide solo).
- El mozo puede confirmar la ronda inmediatamente.

---

## Flujo 4: Administrador Gestiona el Restaurante (Dashboard)

### Precondiciones
- El usuario tiene rol `ADMIN` o `MANAGER`.
- Credenciales válidas.

### Flujo Paso a Paso

```
 1. Login con email y contraseña → JWT emitido.
    → Access token: 15 minutos.
    → Refresh token: 7 días (HttpOnly cookie).
 2. Dashboard carga → conexión WebSocket al endpoint /ws/admin.
 3. El admin selecciona la sucursal de trabajo.
 4. Sidebar de navegación muestra las secciones disponibles:
    → Categorías, Subcategorías, Productos, Personal, Mesas,
       Sectores, Alérgenos, Promociones, Recetas, etc.

    === Ejemplo: Crear producto ===
 5. Navega a "Productos" → lista con paginación (?limit=50&offset=0).
 6. Toca "Nuevo producto" → se abre modal de formulario (useFormModal).
 7. Completa el formulario:
    → Nombre, descripción, imagen URL.
    → Categoría y subcategoría.
    → Alérgenos (contains / may_contain / free_from).
    → Precio base o precios por sucursal.
    → Flags: destacado, popular.
    → Badges y sellos.
    → Receta asociada.
 8. Guarda → POST /api/admin/products.
 9. Evento ENTITY_CREATED emitido por WebSocket.
10. La lista se actualiza en tiempo real en todas las pestañas
    y sesiones conectadas.

    === Ejemplo: Eliminar categoría ===
11. Selecciona una categoría con subcategorías y productos.
12. Toca "Eliminar" → se muestra preview de cascada:
    → "Se desactivarán: 3 subcategorías, 15 productos".
13. Confirma → cascade_soft_delete() ejecutado.
14. Evento CASCADE_DELETE emitido con detalle de afectados.
15. Todas las entidades dependientes marcadas is_active=false.

    === Sincronización ===
16. Si otro admin crea/edita/elimina una entidad:
    → Evento WebSocket recibido automáticamente.
    → La UI se actualiza sin recargar la página.
17. Sincronización multi-pestaña vía BroadcastChannel.
18. Token se refresca proactivamente cada 14 minutos.
```

### Permisos por Rol
| Acción | ADMIN | MANAGER |
|--------|-------|---------|
| Crear entidades | Todas | Staff, Mesas, Alérgenos, Promociones (sus sucursales) |
| Editar entidades | Todas | Mismas que crear |
| Eliminar entidades | Todas | Ninguna |

---

## Flujo 5: Workflow de Cocina

### Precondiciones
- El usuario tiene rol `KITCHEN`.
- Está conectado al WebSocket `/ws/kitchen`.

### Flujo Paso a Paso

```
 1. El personal de cocina inicia sesión.
 2. Se establece conexión WebSocket: /ws/kitchen?token=JWT.
 3. IMPORTANTE: La cocina NO ve pedidos en estado PENDING o CONFIRMED.
    → Solo recibe eventos a partir de SUBMITTED.

    === Ciclo de un pedido ===
 4. Un pedido es enviado a cocina (ROUND_SUBMITTED por admin/manager):
    → Evento ROUND_SUBMITTED llega por WebSocket.
    → Un nuevo ticket aparece en la pantalla de cocina.
    → El ticket muestra: mesa, ítems, cantidades, notas especiales.
 5. La cocina comienza la preparación:
    → Marca el pedido como "en progreso".
    → Estado: SUBMITTED → IN_KITCHEN.
    → Evento ROUND_IN_KITCHEN enviado a:
      - Admin (Dashboard).
      - Mozos asignados al sector.
      - Comensales de la mesa (pueden ver que su pedido está en cocina).
 6. La cocina finaliza la preparación:
    → Marca el pedido como "listo".
    → Estado: IN_KITCHEN → READY.
    → Evento ROUND_READY enviado a:
      - Mozo (parpadeo naranja en grilla de mesas).
      - Comensal (notificación en la app).
      - Admin (Dashboard).
 7. El mozo retira el pedido y lo entrega:
    → Marca como servido → ROUND_SERVED.
    → Evento ROUND_SERVED cierra el ciclo del pedido.
```

### Flujo Completo de Estados de Ronda
```
PENDING ──────→ CONFIRMED ──────→ SUBMITTED ──────→ IN_KITCHEN ──────→ READY ──────→ SERVED
(Comensal)      (Mozo)            (Admin/Manager)   (Cocina)          (Cocina)      (Staff)
                                  ↑                                                    
                                  │ Cocina recibe                                     
                                  │ el pedido aquí                                    
```

---

## Flujo 6: Facturación y Pago

### Precondiciones
- La sesión tiene al menos una ronda completada.
- Los ítems están registrados en el sistema.

### Flujo Paso a Paso

```
 1. El comensal o el mozo solicita la cuenta:
    → Comensal: desde BottomNav → "Cuenta" → CloseTable.
    → Mozo: desde TableDetailModal → "Solicitar cuenta".
 2. POST /api/billing/check/request ejecutado:
    → Se crea un registro Check (tabla app_check) con todos los ítems agregados.
    → Evento CHECK_REQUESTED emitido vía Outbox Pattern (garantía de entrega).
    → El mozo ve pulso violeta en la grilla de mesas.
 3. Se genera el detalle de la cuenta:
    → Todos los ítems de todas las rondas servidas se agregan.
    → Check → Charge (cada ítem) → Allocation (FIFO) ← Payment.
 4. Se calcula la división según método elegido:
    a. Partes iguales: Total / cantidad de comensales.
    b. Por consumo: cada comensal paga los ítems que pidió.
    c. Personalizado: montos manuales ingresados por el mozo/comensal.

    === Pago con Mercado Pago ===
 5. Se crea preferencia de pago:
    → POST /api/billing/mercadopago/preference.
    → Se genera URL de pago con callback.
 6. El cliente es redirigido a Mercado Pago.
 7. El cliente completa el pago en la plataforma de MP.
 8. MP ejecuta callback al backend:
    → Se registra el pago.
    → Evento PAYMENT_APPROVED vía Outbox Pattern.
    → El pago parcial se registra como Payment → Allocation (FIFO a Charges).

    === Pago manual (efectivo/tarjeta/transferencia) ===
 5b. El mozo registra el pago:
    → POST /api/waiter/payments/manual.
    → Indica: método (cash/card/transfer), monto.
    → Se registra el pago.

 9. Cuando el total está cubierto:
    → Evento CHECK_PAID emitido vía Outbox Pattern.
    → La sesión se marca como completamente pagada.
10. El mozo cierra la mesa:
    → POST /api/waiter/tables/{id}/close.
    → Evento TABLE_CLEARED emitido.
    → La sesión se archiva en el historial de pedidos.
    → La mesa vuelve a estado LIBRE.
11. Opcionalmente: generación de factura fiscal en PDF
    (pwaWaiter vía html2canvas + jspdf).
```

### Modelo de Datos de Facturación
```
Check (app_check)
  └── Charge (un cargo por cada ítem)
        └── Allocation (asignación FIFO)
              ← Payment (pago parcial o total)
```

---

## Flujo 7: Gestión de Llamadas de Servicio

### Precondiciones
- El comensal tiene una sesión activa.
- El mozo está asignado al sector de la mesa.

### Flujo Paso a Paso

```
 1. El comensal necesita atención:
    → En pwaMenu, toca el botón de "Llamar mozo" / servicio.
 2. POST /api/diner/service-call creado:
    → Evento SERVICE_CALL_CREATED emitido (Outbox Pattern).
 3. El mozo recibe la notificación:
    → La mesa muestra PARPADEO ROJO en la grilla (máxima prioridad visual).
    → El evento incluye sector_id → solo llega a mozos del sector.
    → ADMIN y MANAGER siempre reciben todos los eventos.
 4. El mozo toca la mesa → TableDetailModal:
    → Ve la llamada de servicio con timestamp y descripción.
 5. El mozo toca "Reconocer" (acknowledge):
    → Evento SERVICE_CALL_ACKED.
    → Se detiene la animación de parpadeo rojo.
    → El comensal ve que su llamada fue reconocida.
 6. El mozo atiende al cliente en la mesa.
 7. El mozo toca "Resolver":
    → Evento SERVICE_CALL_CLOSED.
    → La llamada desaparece del panel de la mesa.
    → Se registra en el historial de la sesión.
```

### Manejo de Múltiples Llamadas
- Cada llamada de servicio se trackea individualmente.
- Si hay múltiples llamadas de la misma mesa, se muestran todas en el modal.
- La animación de parpadeo rojo persiste mientras haya al menos una llamada sin resolver.

---

## Flujo 8: Fidelización de Clientes

### Fases del Sistema

```
=== FASE 1: Tracking por Dispositivo (Actual) ===
 1. Al registrarse como comensal: POST /api/diner/register.
 2. Se envía device_id (generado en el dispositivo).
 3. Se crea relación Customer ←→ Diner (1:N via customer_id).
 4. El sistema asocia pedidos al dispositivo.
 5. Permite identificar clientes recurrentes sin pedir datos personales.

=== FASE 2: Preferencias Implícitas (Planificada) ===
 6. El sistema analiza pedidos históricos del dispositivo.
 7. Genera perfil de preferencias: categorías favoritas, alérgenos, etc.
 8. Las preferencias se sincronizan entre sesiones.

=== FASE 3: Reconocimiento (Planificada) ===
 9. El sistema reconoce al cliente cuando vuelve.
10. Puede personalizar la experiencia: "Bienvenido de nuevo".
11. Sugerencias basadas en historial.

=== FASE 4: Opt-in con Consentimiento GDPR (Planificada) ===
12. El cliente puede optar por crear un perfil explícito.
13. Consentimiento GDPR para almacenamiento de datos personales.
14. Beneficios de fidelización: descuentos, promociones personalizadas.
```

---

## Flujo 9: Configuración Multi-Sucursal de Precios

### Flujo Paso a Paso

```
 1. Admin navega a gestión de productos.
 2. Selecciona un producto existente o crea uno nuevo.
 3. En el editor de producto:
    a. use_branch_prices = false (por defecto):
       → Precio base único para todas las sucursales.
       → Se establece un solo precio en centavos.
    b. use_branch_prices = true:
       → Se habilita la tabla de precios por sucursal.
       → Cada sucursal puede tener un precio diferente.
       → Cada BranchProduct tiene su propio is_active:
         - true: el producto se vende en esa sucursal.
         - false: el producto NO está disponible en esa sucursal.
 4. Para pricing masivo:
    → Exportar precios actuales.
    → Modificar en bulk.
    → Importar los cambios.
 5. Los precios se almacenan en centavos (ej: $125,50 = 12550).
 6. Los frontends convierten: backendCents / 100 = displayPrice.
```
