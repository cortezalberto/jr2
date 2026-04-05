# 10. Estado y Transiciones

Este documento describe todas las maquinas de estado del sistema Integrador / Buen Sabor. Cada entidad con ciclo de vida tiene sus estados, transiciones validas, restricciones por rol y eventos asociados.

---

## 1. Estado de Ronda (Round Status)

La maquina de estados mas compleja del sistema. Gobierna el flujo completo de un pedido desde que el comensal lo solicita hasta que se sirve en la mesa.

### Diagrama de estados

```
                                    +----------+
                                    | CANCELED |
                                    +----------+
                                         ^
                                         | (desde cualquier estado)
                                         |
+--------+    +-----------+    +-----------+    +------------+    +-------+    +--------+
| PENDING | -> | CONFIRMED | -> | SUBMITTED | -> | IN_KITCHEN | -> | READY | -> | SERVED |
+--------+    +-----------+    +-----------+    +------------+    +-------+    +--------+
```

### Descripcion de cada estado

| Estado | Descripcion | Visible para |
|--------|-------------|-------------|
| **PENDING** | El comensal envio el pedido desde pwaMenu. Esperando confirmacion del mozo. | Mozos, Admin |
| **CONFIRMED** | El mozo verifico el pedido en la mesa. Aun no enviado a cocina. | Mozos, Admin |
| **SUBMITTED** | Administrador o gerente envio el pedido a cocina. Primer estado visible para cocina. | Cocina, Mozos, Admin |
| **IN_KITCHEN** | La cocina acuso recibo y comenzo la preparacion. | Cocina, Mozos, Admin, Comensales |
| **IN_KITCHEN** | La cocina acuso recibo y comenzo la preparacion. | Cocina, Mozos, Admin, Comensales |
| **READY** | La cocina termino la preparacion. Listo para servir. | Cocina, Mozos, Admin, Comensales |
| **SERVED** | El mozo entrego los platos en la mesa. Estado final. | Todos |
| **CANCELED** | Pedido cancelado. Puede ocurrir desde cualquier estado. | Todos |

### Restricciones por rol en cada transicion

| Desde | Hacia | Roles permitidos | Contexto |
|-------|-------|-------------------|----------|
| (nuevo) | PENDING | Comensal (pwaMenu) | El comensal confirma su carrito |
| PENDING | CONFIRMED | WAITER, MANAGER, ADMIN | El mozo verifica el pedido en la mesa |
| CONFIRMED | SUBMITTED | MANAGER, ADMIN | Gestion envia a cocina |
| SUBMITTED | IN_KITCHEN | KITCHEN, MANAGER, ADMIN | La cocina acusa recibo |
| IN_KITCHEN | READY | KITCHEN, MANAGER, ADMIN | La cocina termina la preparacion |
| READY | SERVED | WAITER, KITCHEN, MANAGER, ADMIN | Se sirve en la mesa |
| Cualquiera | CANCELED | MANAGER, ADMIN | Cancelacion por gestion |

> **Regla critica**: Un WAITER no puede enviar pedidos a cocina (CONFIRMED -> SUBMITTED). Esto requiere nivel MANAGER o ADMIN.

> **Regla critica**: La cocina nunca ve estados PENDING ni CONFIRMED. Solo a partir de SUBMITTED el pedido aparece en la pantalla de cocina.

### Eventos WebSocket por transicion

| Transicion | Evento | Destinatarios |
|------------|--------|---------------|
| -> PENDING | `ROUND_PENDING` | Admin, Mozos (de la sucursal) |
| -> CONFIRMED | `ROUND_CONFIRMED` | Admin, Mozos |
| -> SUBMITTED | `ROUND_SUBMITTED` | Admin, Cocina, Mozos |
| -> IN_KITCHEN | `ROUND_IN_KITCHEN` | Admin, Cocina, Mozos, Comensales |
| -> READY | `ROUND_READY` | Admin, Cocina, Mozos, Comensales |
| -> SERVED | `ROUND_SERVED` | Admin, Cocina, Mozos, Comensales |
| -> CANCELED | `ROUND_CANCELED` | Todos los suscriptores |

### Filtrado por sector

Los eventos que incluyen `sector_id` se envian unicamente a los mozos asignados a ese sector. Los roles ADMIN y MANAGER siempre reciben todos los eventos de la sucursal, independientemente del sector.

---

## 2. Estado de Sesion de Mesa (Table Session Status)

### Diagrama de estados

```
(sin sesion) ----> OPEN ----> PAYING ----> CLOSED
                    ^                        |
                    |                        |
                    +--- mesa liberada <-----+
```

### Descripcion de cada estado

| Estado | Descripcion | Comensales pueden pedir? | Acciones disponibles |
|--------|-------------|--------------------------|---------------------|
| **(sin sesion)** | La mesa no tiene sesion activa. Esta libre. | No | Activar mesa (QR scan o mozo) |
| **OPEN** | Sesion activa. Comensales pueden unirse y ordenar. | **Si** | Agregar comensales, crear rondas, pedir servicio |
| **PAYING** | Cuenta solicitada. Proceso de pago en curso. | **No** | Registrar pagos unicamente |
| **CLOSED** | Sesion finalizada. Mesa liberada para nuevos comensales. | No | Ninguna (historico) |

> **Regla de negocio confirmada (2026-04-04)**: Una vez solicitada la cuenta (estado PAYING), los comensales **NO pueden crear nuevas rondas**. Esta regla fue confirmada por el product owner. El codigo actual tiene un BUG que permite ordenar durante PAYING — debe corregirse. Ver `26_suposiciones_detectadas.md` seccion 4.

### Transiciones

| Desde | Hacia | Disparador |
|-------|-------|------------|
| (sin sesion) | OPEN | QR scan por comensal o activacion manual por mozo |
| OPEN | PAYING | Solicitud de cuenta (comensal o mozo) |
| PAYING | CLOSED | Todos los cargos cubiertos por pagos |
| CLOSED | (sin sesion) | Mozo cierra la mesa, limpieza automatica |

### Eventos WebSocket

| Transicion | Evento |
|------------|--------|
| -> OPEN | `TABLE_SESSION_STARTED` |
| -> PAYING | `CHECK_REQUESTED` |
| -> CLOSED | `CHECK_PAID`, `TABLE_CLEARED` |
| Cambio de estado | `TABLE_STATUS_CHANGED` |

---

## 3. Estado de Mesa en Frontend (pwaWaiter)

El frontend de mozos maneja un estado visual de la mesa que se deriva de la sesion y otros factores.

### Diagrama de estados

```
+------+        +--------+        +--------+
| FREE | -----> | ACTIVE | -----> | PAYING |
+------+        +--------+        +--------+
   ^               |                  |
   |               v                  |
   |        +--------------+          |
   |        | OUT_OF_SERVICE|         |
   |        +--------------+          |
   |                                  |
   +----------------------------------+
```

### Colores y significado visual

| Estado | Color | Significado |
|--------|-------|-------------|
| **FREE** | Verde | Mesa disponible, sin sesion activa |
| **ACTIVE** | Rojo | Mesa ocupada, sesion en curso |
| **PAYING** | Violeta | Cuenta solicitada, esperando pago |
| **OUT_OF_SERVICE** | Gris | Mesa fuera de servicio (reservada, mantenimiento) |

### Agrupacion por sector

En pwaWaiter, las mesas se agrupan visualmente por sector (`BranchSector`). El mozo solo ve los sectores que tiene asignados para el dia actual.

---

## 4. Estado de Llamada de Servicio (Service Call Status)

### Diagrama de estados

```
+---------+        +-------+        +--------+
| CREATED | -----> | ACKED | -----> | CLOSED |
+---------+        +-------+        +--------+
```

### Descripcion de cada estado

| Estado | Descripcion | Efecto visual en pwaWaiter |
|--------|-------------|---------------------------|
| **CREATED** | El comensal solicito atencion. | Parpadeo rojo en la mesa del mozo |
| **ACKED** | El mozo acuso recibo de la llamada. | El parpadeo se detiene |
| **CLOSED** | La atencion fue completada. | La llamada desaparece de la lista activa |

### Eventos WebSocket

| Transicion | Evento | Patron de entrega |
|------------|--------|-------------------|
| -> CREATED | `SERVICE_CALL_CREATED` | **Outbox** (critico) |
| -> ACKED | `SERVICE_CALL_ACKED` | Direct Redis |
| -> CLOSED | `SERVICE_CALL_CLOSED` | Direct Redis |

> La creacion de la llamada usa Outbox porque es critico que el mozo la reciba. Si se pierde, el comensal queda desatendido.

---

## 5. Estado de Ticket de Cocina (Kitchen Ticket Status)

### Diagrama de estados

```
+-----------+        +-------------+        +-------+        +-----------+
| (creado)  | -----> | IN_PROGRESS | -----> | READY | -----> | DELIVERED |
+-----------+        +-------------+        +-------+        +-----------+
```

### Descripcion

| Estado | Descripcion |
|--------|-------------|
| **(creado)** | Ticket generado cuando la ronda pasa a SUBMITTED |
| **IN_PROGRESS** | La cocina esta preparando los items del ticket |
| **READY** | Todos los items estan listos para servir |
| **DELIVERED** | Los items fueron entregados a la mesa |

> El ticket de cocina agrupa los items de una ronda para la vista de cocina. Es una representacion de trabajo, no una entidad de negocio independiente.

---

## 6. Estado de Pago (Payment Status)

### Diagrama de estados

```
+---------+
| PENDING |
+---------+
     |
     +----> APPROVED
     |
     +----> REJECTED
     |
     +----> FAILED
```

### Descripcion

| Estado | Descripcion | Evento WebSocket |
|--------|-------------|-----------------|
| **PENDING** | Pago registrado, esperando confirmacion | - |
| **APPROVED** | Pago confirmado exitosamente | `PAYMENT_APPROVED` (Outbox) |
| **REJECTED** | Pago rechazado (fondos insuficientes, etc.) | `PAYMENT_REJECTED` (Outbox) |
| **FAILED** | Error tecnico en el procesamiento | - |

### Metodos de pago soportados

- Efectivo
- Tarjeta
- Transferencia bancaria

> El mozo registra pagos manuales via `POST /api/waiter/payments/manual`.

---

## 7. Estado de Cuenta (Check Status)

### Diagrama de estados

```
+------------+        +------+
| REQUESTED  | -----> | PAID |
+------------+        +------+
```

### Descripcion

| Estado | Descripcion | Evento WebSocket |
|--------|-------------|-----------------|
| **REQUESTED** | El comensal o mozo solicito la cuenta | `CHECK_REQUESTED` (Outbox) |
| **PAID** | Todos los cargos cubiertos por pagos (FIFO allocation) | `CHECK_PAID` (Outbox) |

### Sistema de asignacion FIFO

Los pagos se asignan a los cargos en orden cronologico a traves de la tabla `allocation`:

1. Se crea un `charge` por cada item/comensal.
2. Cuando se recibe un `payment`, se asigna a los cargos pendientes mas antiguos primero.
3. Un pago puede cubrir multiples cargos parcialmente.
4. Un cargo puede ser cubierto por multiples pagos.
5. Cuando la suma de `allocation.amount_cents` cubre todos los `charge.amount_cents`, el check pasa a PAID.

---

## 8. Ciclo de Vida del Carrito (pwaMenu)

### Diagrama de estados

```
(agregar producto)        (modificar cantidad)        (eliminar / qty=0)
       |                         |                          |
       v                         v                          v
  +---------+             +-----------+               +---------+
  |  ACTIVE | ----------> |  ACTIVE   | ------------> | DELETED |
  +---------+             | (updated) |               +---------+
                          +-----------+
```

### Comportamiento

- El carrito es **local** (almacenado en el dispositivo del comensal).
- La sincronizacion via WebSocket es para el **estado de la ronda**, no del carrito individual.
- Al confirmar el carrito, los items se combinan en una ronda con los items de otros comensales.

### Eventos WebSocket del carrito compartido

| Evento | Descripcion |
|--------|-------------|
| `CART_ITEM_ADDED` | Un comensal agrego un item al carrito compartido |
| `CART_ITEM_UPDATED` | Un comensal modifico cantidad/notas |
| `CART_ITEM_REMOVED` | Un comensal elimino un item |
| `CART_CLEARED` | Se limpio todo el carrito |

> Estos eventos se envian via Direct Redis (no Outbox) porque la perdida de un evento de carrito no tiene impacto financiero.

---

## 9. Estado de Conexion WebSocket

### Diagrama de estados

```
+---------------+        +------------+        +-----------+
| DISCONNECTED  | -----> | CONNECTING | -----> | CONNECTED |
+---------------+        +------------+        +-----------+
       ^                      |                      |
       |                      v                      v
       |              +-------------+        +----------------+
       |              | AUTH_FAILED |        | DISCONNECTING  |
       |              +-------------+        +----------------+
       |                      |                      |
       |                      v                      v
       |             +-----------------+     +---------------+
       |             | NON_RECOVERABLE |     | RECONNECTING  |
       |             +-----------------+     +---------------+
       |                                           |
       +-------------------------------------------+
              (tras agotar intentos o exito)
```

### Estrategia de reconexion

| Parametro | Valor |
|-----------|-------|
| Backoff inicial | 1 segundo |
| Multiplicador | x2 (exponencial) |
| Maximo backoff | 30 segundos |
| Intentos maximos | 50 |
| Jitter | +/- 30% |

### Formula de backoff

```
delay = min(initial * 2^attempt, max_delay) * (1 + random(-0.3, 0.3))
```

Ejemplo de secuencia: 1s, 2s, 4s, 8s, 16s, 30s, 30s, 30s...

### Codigos de cierre no recuperables

| Codigo | Nombre | Significado |
|--------|--------|-------------|
| 4001 | AUTH_FAILED | Token invalido o expirado. Requiere re-login. |
| 4003 | FORBIDDEN | Sin permisos para el endpoint. |
| 4029 | RATE_LIMITED | Demasiadas conexiones/mensajes. |

Cuando se recibe un codigo no recuperable, el cliente **no intenta reconectarse**. Se muestra un mensaje al usuario y se redirige al login si corresponde.

### Heartbeat

| Parametro | Valor |
|-----------|-------|
| Intervalo de ping | 30 segundos |
| Timeout del servidor | 60 segundos |
| Formato | `{"type": "ping"}` -> `{"type": "pong"}` |

Si el servidor no recibe un ping en 60 segundos, cierra la conexion. El cliente detecta la desconexion y entra en el flujo de reconexion.

---

## 10. Circuit Breaker (WS Gateway)

El Gateway WebSocket implementa un Circuit Breaker para protegerse contra fallos en cascada cuando Redis u otros servicios externos fallan.

### Diagrama de estados

```
+--------+     5 fallos     +------+     30 seg     +-----------+
| CLOSED | --------------> | OPEN | -------------> | HALF_OPEN |
+--------+                 +------+                +-----------+
    ^                                                   |
    |                                                   |
    +-------------- exito ------------------------------|
    |                                                   |
    |                          fallo                    |
    |                            |                      |
    |                            v                      |
    |                         +------+                  |
    |                         | OPEN | <----------------+
    |                         +------+
    +--- (reinicio de contadores) ---+
```

### Parametros

| Parametro | Valor | Descripcion |
|-----------|-------|-------------|
| Umbral de fallos | 5 | Cantidad de fallos consecutivos para abrir el circuito |
| Tiempo de espera | 30 segundos | Tiempo en estado OPEN antes de probar HALF_OPEN |
| Exitos para cerrar | 1 | Cantidad de exitos en HALF_OPEN para volver a CLOSED |

### Comportamiento por estado

| Estado | Comportamiento |
|--------|----------------|
| **CLOSED** | Operacion normal. Se cuentan fallos consecutivos. |
| **OPEN** | Todas las operaciones fallan inmediatamente (fail fast). No se contacta el servicio externo. |
| **HALF_OPEN** | Se permite una operacion de prueba. Si tiene exito, vuelve a CLOSED. Si falla, vuelve a OPEN. |

---

## 11. Ciclo de Vida del Token

### Diagrama de estados

```
+---------+        +-------+     14 min     +------------+        +-------+
| (login) | -----> | VALID | ------------> | REFRESHING | -----> | VALID |
+---------+        +-------+               +------------+        | (new) |
                      |                         |                +-------+
                      | 15 min                  | fallo x3
                      v                         v
                  +---------+             +-------------+
                  | EXPIRED |             | AUTO_LOGOUT |
                  +---------+             +-------------+
```

### Parametros de renovacion

| Parametro | Valor |
|-----------|-------|
| Duracion del access token | 15 minutos |
| Momento de renovacion proactiva | 14 minutos (1 min antes de vencer) |
| Jitter en renovacion | +/- 2 minutos |
| Reintentos maximos | 3 |
| Duracion del refresh token | 7 dias |

### Flujo detallado

1. **Login**: el usuario se autentica. Se emite un access token (15 min) y un refresh token (7 dias, cookie HttpOnly).
2. **Uso normal**: cada request incluye el access token en `Authorization: Bearer {token}`.
3. **Renovacion proactiva**: a los ~14 minutos, el frontend solicita un nuevo access token usando el refresh token.
4. **Jitter**: el momento exacto de renovacion varia +/- 2 minutos para evitar que todos los clientes renueven al mismo tiempo (thundering herd).
5. **Exito**: se recibe un nuevo access token. El ciclo se reinicia.
6. **Fallo**: si la renovacion falla, se reintenta hasta 3 veces. Si agota los reintentos, se ejecuta auto-logout.

### Sincronizacion multi-tab

El frontend usa `BroadcastChannel` para coordinar la renovacion entre multiples tabs del navegador:

- Solo una tab ejecuta la renovacion.
- Las demas tabs reciben el nuevo token via el canal de broadcast.
- Esto evita N renovaciones simultaneas cuando hay N tabs abiertas.

### Blacklist y fail-closed

- Cuando un token se revoca (logout, cambio de contrasena), se agrega a una blacklist en Redis.
- Patron **fail-closed**: si Redis no esta disponible, se rechazan **todos** los tokens por seguridad.
- La blacklist tiene TTL igual a la duracion maxima del token (evita crecimiento indefinido).

### Prevencion del loop infinito de logout

```
Token vencido -> 401 -> onTokenExpired -> logout() -> 401 -> onTokenExpired -> ...
```

Para prevenirlo, `authAPI.logout()` deshabilita el retry en 401 pasando `false` como tercer argumento a `fetchAPI`. Esto corta el ciclo: si el logout devuelve 401, simplemente se completa el logout local sin reintentar.

---

## 12. Resumen de Patrones de Entrega de Eventos

Los diferentes estados y transiciones del sistema generan eventos que se entregan por dos mecanismos distintos, segun su criticidad:

### Eventos via Transactional Outbox (criticos, no se pueden perder)

| Evento | Maquina de estado |
|--------|-------------------|
| `ROUND_SUBMITTED` | Round Status |
| `ROUND_READY` | Round Status |
| `CHECK_REQUESTED` | Check Status |
| `CHECK_PAID` | Check Status |
| `PAYMENT_APPROVED` | Payment Status |
| `PAYMENT_REJECTED` | Payment Status |
| `SERVICE_CALL_CREATED` | Service Call Status |

### Eventos via Direct Redis (no criticos, menor latencia)

| Evento | Maquina de estado |
|--------|-------------------|
| `ROUND_CONFIRMED` | Round Status |
| `ROUND_IN_KITCHEN` | Round Status |
| `ROUND_SERVED` | Round Status |
| `ROUND_CANCELED` | Round Status |
| `CART_ITEM_*` | Cart Lifecycle |
| `TABLE_SESSION_STARTED` | Table Session Status |
| `TABLE_CLEARED` | Table Session Status |
| `TABLE_STATUS_CHANGED` | Table Session Status |
| `ENTITY_CREATED/UPDATED/DELETED` | Admin CRUD |
| `CASCADE_DELETE` | Soft Delete |
| `SERVICE_CALL_ACKED/CLOSED` | Service Call Status |

---

## 13. Tabla de Referencia Rapida

| Entidad | Estados | Estado final | Cancelable? |
|---------|---------|-------------|-------------|
| Round | PENDING, CONFIRMED, SUBMITTED, IN_KITCHEN, READY, SERVED, CANCELED | SERVED o CANCELED | Si (MANAGER+) |
| Table Session | OPEN, PAYING, CLOSED | CLOSED | No (se cierra) |
| Service Call | CREATED, ACKED, CLOSED | CLOSED | No |
| Kitchen Ticket | (creado), IN_PROGRESS, READY, DELIVERED | DELIVERED | No |
| Payment | PENDING, APPROVED, REJECTED, FAILED | APPROVED, REJECTED o FAILED | No |
| Check | REQUESTED, PAID | PAID | No |
| WebSocket | DISCONNECTED, CONNECTING, CONNECTED, DISCONNECTING, RECONNECTING, AUTH_FAILED, NON_RECOVERABLE | DISCONNECTED o NON_RECOVERABLE | No |
| Circuit Breaker | CLOSED, OPEN, HALF_OPEN | CLOSED (recuperado) | No |
| Token | VALID, REFRESHING, EXPIRED, AUTO_LOGOUT | EXPIRED o AUTO_LOGOUT | No |
