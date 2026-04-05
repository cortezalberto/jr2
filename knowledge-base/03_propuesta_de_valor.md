# Propuesta de Valor

## Resumen

Integrador / Buen Sabor ofrece una plataforma unificada que conecta a todos los actores de un restaurante (administradores, mozos, cocina y clientes) en tiempo real, eliminando la friccion entre pedidos, preparacion y pago. A diferencia de soluciones parciales que resuelven un solo eslabon, este sistema abarca toda la cadena operativa desde una unica arquitectura multi-tenant.

---

## Valor por Actor

### Para Duenios y Administradores de Restaurantes

**Un solo dashboard para todo.**

El Dashboard centraliza la gestion de todas las sucursales en una interfaz con 24 paginas lazy-loaded:

- **Gestion de menu**: Categorias, subcategorias, productos con imagenes, descripciones, y precios diferenciados por sucursal
- **Personal**: Alta de usuarios con roles (ADMIN, MANAGER, KITCHEN, WAITER), asignacion a branches, rotacion de sectores
- **Mesas y sectores**: Configuracion de la planta del local, codigos QR por mesa, sectores logicos para distribucion de mozos
- **Alergenos**: Carga por producto con tipo de presencia (contiene/puede contener/libre de) y nivel de riesgo
- **Promociones**: Creacion y gestion de ofertas por branch
- **Ingredientes y recetas**: Gestion jerarquica (grupo → ingrediente → sub-ingrediente) con metodos de coccion, perfiles de sabor y textura
- **Visibilidad en tiempo real**: Eventos WebSocket notifican creacion, actualizacion y eliminacion de entidades al instante. Sin necesidad de refrescar la pagina

**Propuesta**: Reemplazar 5+ herramientas fragmentadas por una sola plataforma. Un admin con acceso a internet gestiona todo, desde cualquier dispositivo.

---

### Para Clientes / Comensales

**Escanea, pedi, paga. Sin app, sin cuenta, sin esperar.**

El flujo completo del cliente en pwaMenu:

1. **Escanear QR** en la mesa → se abre la PWA en el navegador (no requiere descarga)
2. **Unirse a la sesion** de mesa → recibe un token HMAC de 3 horas (sin login ni registro)
3. **Navegar el menu** en su idioma (es/en/pt) → filtrar por alergenos, dieta, o categoria
4. **Agregar al carrito compartido** → todos en la mesa ven los items en tiempo real, con nombre y color de quien agrego cada item
5. **Confirmacion grupal** → un comensal propone la ronda, el grupo confirma antes de enviar (previene pedidos accidentales)
6. **Seguimiento en tiempo real** → ve cuando el pedido esta en cocina, cuando esta listo, cuando se sirve
7. **Solicitar la cuenta** → el estado de la mesa pasa a PAYING (pero puede seguir pidiendo)
8. **Dividir la cuenta** → partes iguales, por consumo, o personalizada
9. **Pagar con Mercado Pago** → pago digital sin efectivo

**Propuesta**: Experiencia de pedido autonoma, social (carrito compartido), sin fricciones y sin barreras idiomaticas. El cliente tiene control total sin depender del mozo.

---

### Para Mozos

**Sabe exactamente que pasa en cada mesa, en todo momento.**

El flujo del mozo en pwaWaiter:

1. **Seleccion de branch** antes de loguearse (endpoint publico, sin auth)
2. **Login + verificacion de asignacion** → debe estar asignado al branch HOY, sino ve "Acceso Denegado"
3. **Grilla de mesas por sector** → solo ve las mesas de los sectores asignados
4. **Animaciones en tiempo real**:
   - Rojo pulsante = llamado de servicio (atencion inmediata)
   - Amarillo = pedido nuevo esperando confirmacion
   - Naranja = pedido listo para servir
   - Morado = cuenta solicitada
5. **Confirmar pedidos** → cambia PENDING a CONFIRMED
6. **Comanda rapida** → toma pedidos para clientes sin telefono via menu compacto (sin imagenes, carga rapida)
7. **Gestionar pagos** → registra pagos en efectivo, tarjeta o transferencia
8. **Cerrar mesa** → libera la mesa despues del pago

**Propuesta**: Eliminar las caminatas innecesarias. El mozo sabe que hacer y donde ir sin tener que recorrer todo el salon. La cola de reintentos offline garantiza que ninguna operacion se pierda por una red inestable.

---

### Para Cocina

**Solo lo que necesitas, cuando lo necesitas.**

La cocina solo ve pedidos en estado SUBMITTED o posterior. No ve rondas pendientes (PENDING) ni confirmadas (CONFIRMED) — eso es ruido que no le compete.

- **Kitchen tickets**: Cada ronda genera tickets de cocina con detalle de items, cantidades y observaciones
- **Flujo de estados**: `IN_KITCHEN` → `READY` → `SERVED`
- **Notificaciones WebSocket**: Nuevos pedidos llegan en tiempo real sin polling
- **Sin distracciones**: Eventos de carrito, llamados de servicio y gestion de mesas no llegan al canal de cocina

**Propuesta**: Interfaz limpia y enfocada. La cocina se concentra en cocinar, no en descifrar comandas ilegibles ni en filtrar pedidos que todavia no estan confirmados.

---

## Diferenciadores Tecnicos

### 1. Carrito compartido con confirmacion grupal

No es simplemente "cada uno pide lo suyo". Los items de todos los comensales se combinan en una sola ronda. Antes de enviar, el grupo debe confirmar. Esto previene:
- Pedidos duplicados accidentales
- Un comensal enviando sin que los demas esten listos
- Confusion sobre quien pidio que

La sincronizacion es via WebSocket en tiempo real: eventos `CART_ITEM_ADDED`, `CART_ITEM_UPDATED`, `CART_ITEM_REMOVED`, `CART_CLEARED`.

### 2. Enrutamiento de eventos por sector

Los eventos WebSocket no se transmiten a todos los mozos del branch. Se filtran por `sector_id`:

- Un mozo asignado al sector "Terraza" solo recibe eventos de mesas en la terraza
- ADMIN y MANAGER siempre reciben todos los eventos del branch
- Esto reduce el ruido y mejora el rendimiento con muchos mozos conectados

### 3. Transactional Outbox para eventos criticos

Los eventos financieros y operacionales criticos usan el patron Outbox:

| Patron | Eventos | Garantia |
|--------|---------|----------|
| **Outbox** (no se puede perder) | CHECK_REQUESTED/PAID, PAYMENT_*, ROUND_SUBMITTED/READY, SERVICE_CALL_CREATED | El evento se escribe atomicamente con los datos de negocio en la BD, luego se publica |
| **Redis directo** (baja latencia) | ROUND_CONFIRMED/IN_KITCHEN/SERVED, CART_*, TABLE_*, ENTITY_* | Publicacion directa, menor latencia |

Si Redis falla momentaneamente, los eventos Outbox se reprocesaran. Los eventos directos pueden perderse pero son menos criticos.

### 4. Multi-tenant desde el diseno

No es un sistema single-tenant al que se le "agrego" multi-tenancy. Desde el modelo de datos hasta los repositorios, todo filtra por `tenant_id`. Los `TenantRepository` y `BranchRepository` aplican este filtro automaticamente. Un tenant nunca puede ver datos de otro tenant.

### 5. Progressive Web Apps (sin app stores)

Los tres frontends son PWAs:
- No requieren descarga desde Play Store o App Store
- Se instalan desde el navegador con un tap
- Funcionan offline (especialmente pwaWaiter con su cola de reintentos)
- Se actualizan automaticamente sin que el usuario haga nada

### 6. Diseno offline-first

pwaWaiter esta disenado para redes moviles inestables (contexto argentino):
- Cola de reintentos para operaciones fallidas
- Cache local de datos criticos
- Reconciliacion automatica cuando se recupera la conexion

---

## Matriz de Valor vs. Soluciones Tradicionales

| Aspecto | Sistema Tradicional | Integrador / Buen Sabor |
|---------|-------------------|------------------------|
| Pedidos | Papel o verbal | Digital desde el celular del cliente |
| Menu | Impreso, un idioma | Digital, 3 idiomas, filtros de alergenos |
| Comunicacion con cocina | Caminar con la comanda | WebSocket en tiempo real |
| Visibilidad de mesas | Caminar y mirar | Grilla animada con estados por color |
| Pago | Esperar cuenta, calcular division | Division automatica + Mercado Pago |
| Gestion multi-branch | Sistemas separados por local | Dashboard centralizado multi-tenant |
| Fidelizacion | Tarjeta de sellos | Tracking automatico progresivo |
| Instalacion de app | App store | PWA, sin descarga |
| Red inestable | Operacion interrumpida | Offline-first con reintentos |

---

## Referencias

- [01 - Vision General](./01_vision_general.md)
- [02 - Problema que Resuelve](./02_problema_que_resuelve.md)
- [04 - Actores y Roles](./04_actores_y_roles.md)
