> Creado: 2026-04-04 | Actualizado: 2026-04-04 | Estado: vigente

# Cadena de Migraciones Alembic

Documentacion completa de la cadena de migraciones de base de datos del sistema Integrador.

---

## Estado Actual

```
Migraciones totales: 4
Ultima migracion: 004_delivery
Directorio: backend/alembic/versions/
```

---

## Cadena Completa

```
(sin migracion inicial) ← Schema base creado por SQLAlchemy create_all()
         │
         ▼
001_product_name (down_revision: None)
         │
         ▼
002_is_available (down_revision: 001_product_name)
         │
         ▼
003_reservation (down_revision: 002_is_available)
         │
         ▼
004_delivery (down_revision: 003_reservation)  ← HEAD actual
```

---

## Detalle de Cada Migracion

### 001_product_name

- **Archivo**: `backend/alembic/versions/001_add_product_name_to_round_item.py`
- **Revision ID**: `001_product_name`
- **Down revision**: `None` (primera migracion)
- **Operacion**: `ALTER TABLE round_item ADD COLUMN product_name TEXT NULL`
- **Proposito**: Snapshot del nombre del producto al momento del pedido. Si el producto cambia de nombre despues, los pedidos historicos mantienen el nombre original.
- **Tabla afectada**: `round_item`
- **Columna nueva**: `product_name` (Text, nullable)
- **Riesgo**: Ninguno. Campo nullable, registros existentes quedan con `NULL`.
- **Rollback**: `DROP COLUMN product_name` de `round_item`

### 002_is_available

- **Archivo**: `backend/alembic/versions/002_add_is_available_to_branch_product.py`
- **Revision ID**: `002_is_available`
- **Down revision**: `001_product_name`
- **Operaciones**:
  - `ALTER TABLE branch_product ADD COLUMN is_available BOOLEAN NOT NULL DEFAULT true`
  - `CREATE INDEX ix_branch_product_is_available ON branch_product (is_available)`
- **Proposito**: Permite a la cocina marcar productos como temporalmente no disponibles (ej. "se acabo el salmon"). Es diferente de `is_active` (decision administrativa permanente).
- **Tabla afectada**: `branch_product`
- **Columna nueva**: `is_available` (Boolean, default `true`, NOT NULL, indexada)
- **Riesgo**: Ninguno. Default `true` no cambia el comportamiento existente.
- **Rollback**: `DROP INDEX ix_branch_product_is_available`, `DROP COLUMN is_available`
- **Nota importante**: `is_available = false` → producto temporalmente agotado (cocina). `is_active = false` → producto eliminado del menu (admin, soft delete).

### 003_reservation

- **Archivo**: `backend/alembic/versions/003_create_reservation_table.py`
- **Revision ID**: `003_reservation`
- **Down revision**: `002_is_available`
- **Operacion**: `CREATE TABLE reservation` con 17 columnas + AuditMixin + 5 indices
- **Proposito**: Sistema de reservas de mesas para implementacion futura.
- **Tabla nueva**: `reservation`
- **Columnas**:
  - `id` (BigInteger, PK, autoincrement)
  - `tenant_id` (BigInteger, FK → app_tenant.id, NOT NULL)
  - `branch_id` (BigInteger, FK → branch.id, NOT NULL)
  - `customer_name` (Text, NOT NULL)
  - `customer_phone` (Text, nullable)
  - `customer_email` (Text, nullable)
  - `party_size` (Integer, NOT NULL)
  - `reservation_date` (Date, NOT NULL)
  - `reservation_time` (Time, NOT NULL)
  - `duration_minutes` (Integer, default 90, NOT NULL)
  - `table_id` (BigInteger, FK → app_table.id, nullable)
  - `status` (Text, default 'PENDING', NOT NULL)
  - `notes` (Text, nullable)
  - AuditMixin: `is_active`, `created_at`, `updated_at`, `deleted_at`, `created_by_id`, `created_by_email`, `updated_by_id`, `updated_by_email`, `deleted_by_id`, `deleted_by_email`
- **Indices**: `ix_reservation_branch_date`, `ix_reservation_tenant`, `ix_reservation_date`, `ix_reservation_status`, `ix_reservation_is_active`
- **Estados posibles**: PENDING, CONFIRMED, SEATED, COMPLETED, CANCELED, NO_SHOW
- **Riesgo**: Ninguno. Tabla nueva sin FK obligatorias activas.
- **Estado de implementacion**: Modelo existe (`backend/rest_api/models/reservation.py`), API y frontend pendientes.
- **Rollback**: `DROP TABLE reservation` (con indices)

### 004_delivery

- **Archivo**: `backend/alembic/versions/004_create_delivery_tables.py`
- **Revision ID**: `004_delivery`
- **Down revision**: `003_reservation`
- **Operacion**: `CREATE TABLE delivery_order` + `CREATE TABLE delivery_order_item`
- **Proposito**: Soporte para pedidos takeout (para llevar) y delivery (a domicilio), sin mesa fisica.
- **Tablas nuevas**:

**delivery_order** (20 columnas + AuditMixin):
  - `id` (BigInteger, PK, autoincrement)
  - `tenant_id` (BigInteger, FK → app_tenant.id, NOT NULL)
  - `branch_id` (BigInteger, FK → branch.id, NOT NULL)
  - `order_type` (Text, NOT NULL — valores: TAKEOUT, DELIVERY)
  - `customer_name` (Text, NOT NULL)
  - `customer_phone` (Text, NOT NULL)
  - `customer_email` (Text, nullable)
  - `delivery_address` (Text, nullable — solo para DELIVERY)
  - `delivery_instructions` (Text, nullable)
  - `delivery_lat` (Float, nullable)
  - `delivery_lng` (Float, nullable)
  - `estimated_ready_at` (DateTime TZ, nullable)
  - `estimated_delivery_at` (DateTime TZ, nullable)
  - `status` (Text, default 'RECEIVED', NOT NULL)
  - `total_cents` (Integer, default 0, NOT NULL)
  - `payment_method` (Text, nullable)
  - `is_paid` (Boolean, default false, NOT NULL)
  - `notes` (Text, nullable)
  - AuditMixin (10 columnas)

**delivery_order_item** (10 columnas + AuditMixin):
  - `id` (BigInteger, PK, autoincrement)
  - `tenant_id` (BigInteger, FK → app_tenant.id, NOT NULL)
  - `order_id` (BigInteger, FK → delivery_order.id, NOT NULL)
  - `product_id` (BigInteger, FK → product.id, NOT NULL)
  - `qty` (Integer, NOT NULL)
  - `unit_price_cents` (Integer, NOT NULL)
  - `product_name` (Text, nullable — snapshot)
  - `notes` (Text, nullable)
  - AuditMixin (10 columnas)

- **Indices**: `ix_delivery_order_tenant`, `ix_delivery_order_branch`, `ix_delivery_order_status`, `ix_delivery_order_branch_status`, `ix_delivery_order_is_active`, `ix_delivery_order_item_order`, `ix_delivery_order_item_is_active`
- **Estados posibles**: RECEIVED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED | PICKED_UP | CANCELED
- **Riesgo**: Ninguno. Tablas nuevas.
- **Estado de implementacion**: Modelos existen (`backend/rest_api/models/delivery.py`), API y frontend pendientes.
- **Rollback**: `DROP TABLE delivery_order_item`, `DROP TABLE delivery_order` (en ese orden por FK)

---

## Comandos de Operacion

### Aplicar todas las migraciones pendientes

```bash
cd backend && alembic upgrade head
```

### Rollback una migracion

```bash
cd backend && alembic downgrade -1
```

### Rollback a una revision especifica

```bash
cd backend && alembic downgrade 002_is_available
```

### Ver migracion actual

```bash
cd backend && alembic current
```

### Ver historial completo

```bash
cd backend && alembic history --verbose
```

### Generar nueva migracion

```bash
cd backend && alembic revision -m "descripcion_del_cambio"
```

---

## Nota Critica: Sin Migracion Inicial

**No existe una migracion "initial schema".** El schema base del sistema (todas las tablas core: `app_tenant`, `branch`, `category`, `subcategory`, `product`, `branch_product`, `app_table`, `branch_sector`, `table_session`, `diner`, `round`, `round_item`, `kitchen_ticket`, `app_check`, `charge`, `allocation`, `payment`, `service_call`, `user`, `user_branch_role`, `product_allergen`, `customer`, etc.) fue creado por `SQLAlchemy Base.metadata.create_all()` ANTES de que se configurara Alembic.

### Implicaciones

1. **En un entorno existente** (donde el schema base ya existe): Solo ejecutar `alembic upgrade head` para aplicar las 4 migraciones incrementales.

2. **En un entorno nuevo desde cero**: Se necesita este flujo:
   ```bash
   # 1. Crear schema base con SQLAlchemy
   cd backend && python -c "from shared.infrastructure.db import engine; from rest_api.models import Base; Base.metadata.create_all(engine)"

   # 2. Marcar que el schema ya esta en la revision actual (sin ejecutar migraciones)
   cd backend && alembic stamp head

   # 3. Futuras migraciones funcionan normalmente
   cd backend && alembic upgrade head  # (no-op si ya esta en head)
   ```

3. **Con Docker Compose**: El seed script (`devOps/seed/`) se encarga de crear el schema y datos iniciales. Despues se ejecuta `alembic upgrade head`.

### Riesgo de la Falta de Migracion Inicial

- Si alguien ejecuta `alembic upgrade head` en una base vacia, la migracion 001 fallara con `relation "round_item" does not exist`.
- La solucion correcta es documentar (como se hace aqui) que `create_all()` debe ejecutarse primero.
- Una alternativa futura seria generar una migracion initial con `alembic revision --autogenerate`, pero es complejo retroactivamente con 30+ tablas ya existentes.

---

## Convencion de Naming

| Elemento | Formato | Ejemplo |
|----------|---------|---------|
| Revision ID | `NNN_nombre_corto` | `001_product_name` |
| Archivo | `NNN_descripcion_larga.py` | `001_add_product_name_to_round_item.py` |
| Numeracion | Secuencial, 3 digitos | 001, 002, 003, 004 |
| Siguiente | `005_*` | (la proxima migracion) |
