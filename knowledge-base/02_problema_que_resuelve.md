# Problema que Resuelve

## Contexto

La industria gastronomica, especialmente en cadenas de restaurantes, opera con herramientas fragmentadas y procesos manuales que generan friccion en cada punto de la experiencia: desde que el cliente se sienta hasta que paga. Integrador / Buen Sabor nace para unificar toda esta cadena en una sola plataforma.

---

## Los 10 Problemas

### 1. Operaciones fragmentadas

**Situacion actual**: Los restaurantes usan un sistema para el menu, otro para los pedidos, otro para la facturacion, planillas para el personal, y WhatsApp para coordinar con cocina. Cada sistema tiene su propia base de datos, su propia interfaz, y su propia logica.

**Solucion**: Una plataforma unica que integra menu, pedidos, cocina, facturacion, personal y gestion de mesas. Todo comparte la misma base de datos, los mismos eventos en tiempo real, y la misma autenticacion.

---

### 2. Pedidos en papel

**Situacion actual**: El cliente espera al mozo, el mozo anota en papel (o memoriza), camina hasta la cocina, y entrega la comanda. Errores de transcripcion, demoras, y clientes frustrados esperando.

**Solucion**: El cliente escanea un codigo QR en la mesa, navega el menu desde su telefono, agrega items al carrito, y envia el pedido directamente. No necesita descargar una app (es una PWA). No necesita crear una cuenta (autenticacion por token de mesa).

---

### 3. Demoras en la comunicacion con cocina

**Situacion actual**: La cadena es: comensal dicta → mozo anota → mozo camina → cocina lee papel. Cada eslabon introduce latencia y posibilidad de error.

**Solucion**: Flujo digital con confirmacion en cada etapa:

```
Comensal propone (PENDING)
  -> Mozo confirma (CONFIRMED)
    -> Manager/Admin envia (SUBMITTED)
      -> Cocina recibe al instante via WebSocket (IN_KITCHEN)
        -> Cocina marca listo (READY)
          -> Staff marca servido (SERVED)
```

La cocina solo ve pedidos en estado SUBMITTED o posterior. No ve pedidos pendientes ni sin confirmar, lo que elimina el ruido.

---

### 4. Complejidad multi-branch

**Situacion actual**: Las cadenas de restaurantes necesitan manejar precios distintos por sucursal, personal asignado a branches especificos, sectores diferentes por local, y menus que varian por ubicacion. Esto se suele resolver con planillas Excel o copias separadas del sistema.

**Solucion**: Arquitectura multi-tenant nativa:

- **Tenant** = Restaurante (ej: "Buen Sabor")
- **Branch** = Sucursal (ej: "Buen Sabor Mendoza Centro", "Buen Sabor Godoy Cruz")
- **BranchProduct** = Precio especifico por sucursal (en centavos)
- **UserBranchRole** = Relacion M:N entre usuario y branch con rol especifico
- **WaiterSectorAssignment** = Asignacion diaria de mozo a sector

Cada query filtra por `tenant_id` automaticamente. Un admin puede gestionar todas las sucursales; un mozo solo ve su sector asignado del dia.

---

### 5. Friccion en el pago

**Situacion actual**: Pedir la cuenta es un proceso tedioso. El mozo trae la cuenta, el grupo debate como dividir, alguien tiene que sumar, pedir cambio, esperar. En grupos grandes es un caos.

**Solucion**: Tres modos de division de cuenta:

1. **Partes iguales**: El total se divide entre todos los comensales
2. **Por consumo**: Cada comensal paga exactamente lo que pidio
3. **Personalizada**: Asignacion manual de items a personas

Integracion con Mercado Pago para pagos digitales. El mozo tambien puede registrar pagos en efectivo, tarjeta o transferencia desde pwaWaiter.

El sistema usa el patron FIFO para asignar pagos a cargos: `Check -> Charge -> Allocation <- Payment`.

---

### 6. Falta de visibilidad en tiempo real

**Situacion actual**: El mozo no sabe que la mesa 7 necesita atencion hasta que el cliente lo llama a gritos. No sabe que el plato de la mesa 3 esta listo hasta que va a cocina a preguntar.

**Solucion**: Grilla de mesas en pwaWaiter con animaciones en tiempo real via WebSocket:

| Color | Significado |
|-------|-------------|
| Rojo (pulsante) | Llamado de servicio - atencion inmediata |
| Amarillo | Pedido nuevo esperando confirmacion |
| Naranja | Pedido listo para servir |
| Morado | Cuenta solicitada |
| Verde | Mesa disponible |

Los eventos se enrutan por sector: el mozo solo recibe notificaciones de las mesas de su sector asignado. Los ADMIN y MANAGER reciben todo.

---

### 7. Barreras idiomaticas

**Situacion actual**: Zonas turisticas (Mendoza, Buenos Aires, Patagonia) reciben visitantes que no hablan espanol. Menus en un solo idioma limitan la experiencia.

**Solucion**: pwaMenu soporta tres idiomas completos:

- **Espanol** (es) - idioma base
- **Ingles** (en) - para turistas de habla inglesa
- **Portugues** (pt) - para turistas brasilenios

Toda la interfaz usa `t()` via i18n. Cero strings hardcodeados. El idioma se detecta automaticamente o se selecciona manualmente.

---

### 8. Coordinacion de personal

**Situacion actual**: "Quien atiende la mesa 12?" es una pregunta comun. Los mozos se pisan, las mesas quedan desatendidas, y no hay claridad sobre responsabilidades.

**Solucion**: Sistema de sectores con asignacion diaria:

1. El branch se divide en **BranchSectors** (ej: "Terraza", "Salon principal", "VIP")
2. Cada sector contiene N mesas
3. Cada dia se crea un **WaiterSectorAssignment** que asigna mozos a sectores
4. Los eventos de WebSocket se enrutan por `sector_id`: el mozo solo recibe eventos de sus mesas
5. El mozo debe verificar su asignacion al iniciar sesion (si no esta asignado hoy, ve "Acceso Denegado")

---

### 9. Cumplimiento de alergenos

**Situacion actual**: La informacion de alergenos esta en un cuadernillo que nadie lee, o el mozo "cree que no tiene gluten". Error potencialmente fatal.

**Solucion**: Sistema completo de alergenos alineado con la regulacion EU 1169/2011:

- **14 alergenos obligatorios** registrados por producto
- **Tipo de presencia**: `CONTAINS` (contiene), `MAY_CONTAIN` (puede contener), `FREE_FROM` (libre de)
- **Nivel de riesgo**: Configurable por alergeno
- **Reacciones cruzadas**: Alertas automaticas cuando un ingrediente puede tener contaminacion cruzada
- **Filtros en pwaMenu**: El cliente puede filtrar el menu por sus alergias y ver claramente que puede comer

---

### 10. Fidelizacion de clientes

**Situacion actual**: Los restaurantes no tienen idea de quien vuelve, que pide, ni como premiar la fidelidad. Los programas de puntos son costosos y requieren apps dedicadas.

**Solucion**: Enfoque progresivo en 4 fases:

| Fase | Descripcion | Estado |
|------|-------------|--------|
| 1 | Tracking por dispositivo (cookie/fingerprint) | Implementado |
| 2 | Preferencias implicitas sincronizadas (que pide, frecuencia) | En progreso |
| 3 | Reconocimiento ("Bienvenido de nuevo, tu usual es X") | Planificado |
| 4 | Opt-in del cliente con consentimiento GDPR | Planificado |

El modelo de datos ya soporta `Customer <-> Diner (1:N)` via `customer_id` con tracking por dispositivo.

---

## Mercado Objetivo

- **Pais**: Argentina
- **Moneda**: Pesos argentinos (ARS), almacenados en centavos (ej: $125.50 = 12550)
- **Procesador de pago**: Mercado Pago
- **Idioma principal**: Espanol rioplatense
- **Perfil de restaurante**: Cadenas con multiples sucursales que necesitan gestion centralizada
- **Contexto tecnologico**: Redes moviles inestables (de ahi el diseno offline-first de pwaWaiter)

---

## Referencias

- [01 - Vision General](./01_vision_general.md)
- [03 - Propuesta de Valor](./03_propuesta_de_valor.md)
- [04 - Actores y Roles](./04_actores_y_roles.md)
