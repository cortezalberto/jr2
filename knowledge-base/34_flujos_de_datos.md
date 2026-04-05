# 34. Flujos de Datos

Documentacion detallada de como los datos fluyen desde la interfaz de usuario hasta el backend, la base de datos, y de vuelta al cliente. Incluye conversiones de tipos, transformaciones y patrones de comunicacion.

---

## Flujo de datos: Creacion de Producto

Flujo completo desde el formulario del Dashboard hasta la persistencia y notificacion.

### UI → API

```
Dashboard (React 19)
  └─ ProductEditor (componente de formulario)
      └─ useActionState() maneja submit
          └─ productStore.addProduct(formData)
              ├─ Conversion de precio: inputPesos * 100 → price_cents (int)
              ├─ Conversion de IDs: string → parseInt(id, 10)
              └─ productAPI.create(payload)
                  └─ fetchAPI('POST', '/api/admin/products', {
                        name: "Milanesa napolitana",
                        description: "Con jamon y queso",
                        price_cents: 12550,           // $125.50 en centavos
                        category_id: 3,
                        subcategory_id: 7,
                        image_url: "https://...",
                        allergen_ids: [1, 4],          // Gluten, Lacteos
                        branch_prices: [
                          { branch_id: 1, price_cents: 12550, is_active: true },
                          { branch_id: 2, price_cents: 13000, is_active: true }
                        ]
                      })
                  Headers: {
                    Authorization: "Bearer {JWT}",
                    Content-Type: "application/json",
                    X-Request-ID: "uuid-v4"
                  }
```

### API → Backend

```
Backend (FastAPI)
  └─ admin_router.create_product()
      └─ Dependencias inyectadas:
          ├─ db: Session = Depends(get_db)
          └─ user: dict = Depends(current_user)
      └─ PermissionContext(user).require_management()
      └─ ProductService(db).create(data, tenant_id)
          └─ _validate_create():
              ├─ Verificar nombre unico por tenant
              ├─ validate_image_url(url) → bloquear SSRF
              └─ Verificar category_id y subcategory_id existen
          └─ Operaciones DB:
              ├─ INSERT INTO product (name, description, price_cents, ...)
              │   VALUES ('Milanesa napolitana', '...', 12550, ...)
              ├─ INSERT INTO branch_product (product_id, branch_id, price_cents, is_active)
              │   VALUES (42, 1, 12550, true), (42, 2, 13000, true)
              └─ INSERT INTO product_allergen (product_id, allergen_id, presence_type)
                  VALUES (42, 1, 'CONTAINS'), (42, 4, 'CONTAINS')
          └─ safe_commit()  ← rollback automatico si falla
          └─ _after_create():
              └─ publish_entity_created(entity='product', id=42)
```

### Backend → UI (respuesta)

```
Backend retorna ProductOutput (Pydantic schema):
  {
    "id": 42,                          // BigInteger
    "name": "Milanesa napolitana",
    "description": "Con jamon y queso",
    "price_cents": 12550,
    "category_id": 3,
    "subcategory_id": 7,
    "image_url": "https://...",
    "is_active": true,
    "allergens": [
      { "id": 1, "name": "Gluten", "presence_type": "CONTAINS" },
      { "id": 4, "name": "Lacteos", "presence_type": "CONTAINS" }
    ],
    "branch_prices": [
      { "branch_id": 1, "price_cents": 12550, "is_active": true },
      { "branch_id": 2, "price_cents": 13000, "is_active": true }
    ]
  }

Dashboard recibe respuesta:
  └─ productStore actualiza estado local
      ├─ id: String(42) = "42"        // Backend number → Frontend string
      └─ displayPrice: 12550 / 100 = "$125.50"
  └─ WebSocket recibe ENTITY_CREATED
      └─ Otros tabs/admins actualizan en tiempo real
```

---

## Conversiones de tipos: Frontend ↔ Backend

### Precios (centavos ↔ pesos)

La conversion de precios es una de las transformaciones mas criticas del sistema. Un error aqui genera discrepancias financieras.

```
BACKEND (almacenamiento y logica)
  └─ Tipo: INTEGER (centavos)
  └─ Ejemplo: 12550 (representa $125.50)
  └─ Razon: evitar errores de punto flotante en operaciones financieras

API (transporte JSON)
  └─ Campo: price_cents
  └─ Tipo: number
  └─ Ejemplo: { "price_cents": 12550 }

FRONTEND (presentacion)
  └─ Tipo: number (pesos, float)
  └─ Conversion: backendCents / 100
  └─ Ejemplo: 12550 / 100 = 125.50 → formateado como "$125.50"

FRONTEND → BACKEND (envio)
  └─ Conversion: Math.round(inputPesos * 100)
  └─ Ejemplo: Math.round(125.50 * 100) = 12550
  └─ IMPORTANTE: Math.round() previene errores como 125.50 * 100 = 12549.999...
```

### IDs (BigInteger ↔ string)

```
BACKEND (PostgreSQL)
  └─ Tipo: BigInteger (autoincremental)
  └─ Ejemplo: 42

API (transporte JSON)
  └─ Tipo: number
  └─ Ejemplo: { "id": 42 }

FRONTEND (estado y componentes)
  └─ Tipo: string
  └─ Conversion: String(backendId)
  └─ Ejemplo: "42"
  └─ Razon: consistencia con crypto.randomUUID() para IDs locales temporales

FRONTEND → BACKEND (envio)
  └─ Conversion: parseInt(frontendId, 10)
  └─ Ejemplo: parseInt("42", 10) = 42
```

### Estado de sesion (UPPERCASE ↔ lowercase)

```
BACKEND (enum)
  └─ Valores: "OPEN" | "PAYING" | "CLOSED"

API (transporte)
  └─ { "status": "PAYING" }

FRONTEND (estado local)
  └─ Valores: 'active' | 'paying' | 'closed'
  └─ Conversion:
      switch(response.status) {
        case 'OPEN':   return 'active'
        case 'PAYING': return 'paying'
        case 'CLOSED': return 'closed'
      }
```

### Roles (backend ↔ frontend)

```
BACKEND (constantes)
  └─ Roles.ADMIN = "ADMIN"
  └─ Roles.MANAGER = "MANAGER"
  └─ Roles.WAITER = "WAITER"
  └─ Roles.KITCHEN = "KITCHEN"

JWT payload
  └─ { "roles": ["ADMIN"], "branch_ids": [1, 2] }

FRONTEND (estado)
  └─ Mismos valores uppercase
  └─ Sin conversion necesaria
```

---

## Flujo de datos: Autenticacion (Login)

```
Frontend (cualquier app)
  └─ LoginForm
      └─ POST /api/auth/login
          Body: { email: "admin@demo.com", password: "admin123" }
          Headers: { Content-Type: "application/json" }

Backend
  └─ auth_router.login()
      ├─ Buscar usuario por email
      ├─ Verificar bcrypt hash del password
      ├─ Generar access_token (JWT, 15 min)
      │   Payload: { sub: "1", tenant_id: 1, branch_ids: [1,2], roles: ["ADMIN"] }
      ├─ Generar refresh_token (JWT, 7 dias)
      └─ Response:
          Body: { access_token: "eyJ...", user: { id: 1, email: "...", roles: [...] } }
          Set-Cookie: refresh_token=eyJ...; HttpOnly; Secure; SameSite=Lax; Path=/api/auth

Frontend recibe
  └─ authStore.setAuth(response)
      ├─ Guardar access_token en memoria (NO localStorage)
      ├─ refresh_token en HttpOnly cookie (automatico)
      └─ Iniciar timer de refresh proactivo (cada 14 min)
```

---

## Flujo de datos: Sesion de mesa (QR → Token)

```
pwaMenu
  └─ Usuario escanea QR → URL: https://app.com/mesa/INT-01?branch=sucursal-centro
      └─ JoinTable page extrae parametros
          └─ POST /api/tables/code/INT-01/session
              Body: { branch_slug: "sucursal-centro", diner_name: "Carlos" }

Backend
  └─ table_service.get_or_create_session()
      ├─ Buscar table por code + branch_slug
      ├─ Crear o recuperar TableSession
      ├─ Crear Diner (nombre, device_id)
      └─ Generar table_token:
          JWT payload: {
            table_id: 5,
            session_id: 12,
            branch_id: 1,
            diner_id: 8,
            tenant_id: 1,
            exp: now + 3h
          }

pwaMenu recibe
  └─ sessionStore.setSession()
      ├─ Guardar table_token en localStorage (TTL 8h check)
      ├─ Guardar datos de sesion en estado Zustand
      └─ Conectar WebSocket: /ws/diner?table_token={token}
```

---

## Flujo de datos: Carrito compartido

El carrito es sincronizado en tiempo real entre todos los comensales de una mesa.

```
Comensal A agrega item
  └─ pwaMenu: cartStore.addItem({ product_id: 42, quantity: 2, notes: "Sin sal" })
      └─ POST /api/diner/cart/items
          Header: X-Table-Token
          Body: { product_id: 42, quantity: 2, notes: "Sin sal" }

Backend
  └─ INSERT CartItem (session_id, diner_id, product_id, quantity, notes)
  └─ Publicar CART_ITEM_ADDED via Redis (direct)
      Payload: {
        session_id: 12,
        diner_id: 8,
        diner_name: "Carlos",
        diner_color: "#3B82F6",
        item: { product_id: 42, name: "Milanesa", quantity: 2, price_cents: 12550 }
      }

WebSocket Gateway
  └─ EventRouter → send_to_session(session_id: 12)
      └─ SOLO comensales de esa mesa (NO mozos, NO cocina, NO admin)

Comensal B (otro dispositivo, misma mesa)
  └─ Recibe CART_ITEM_ADDED via WebSocket
      └─ cartStore actualiza estado local
          └─ UI muestra: "Carlos agrego 2x Milanesa" con color azul del comensal
```

---

## Flujo de datos: Consulta de menu publico

Flujo sin autenticacion, optimizado para carga rapida.

```
pwaMenu
  └─ MenuPage carga
      ├─ Verificar cache localStorage (TTL 8 horas)
      │   └─ Si cache valido y no expirado → usar datos locales (sin request)
      └─ Si cache invalido o expirado:
          └─ GET /api/public/menu/{slug}
              Sin headers de auth
              Response: {
                branch: { name, slug, address },
                categories: [
                  {
                    id: 3,
                    name: "Platos principales",
                    subcategories: [
                      {
                        id: 7,
                        name: "Carnes",
                        products: [
                          {
                            id: 42,
                            name: "Milanesa napolitana",
                            price_cents: 12550,
                            image_url: "https://...",
                            allergens: [{ id: 1, icon: "gluten", name: "Gluten" }]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }

pwaMenu recibe
  └─ menuStore.setMenu(response)
      ├─ Guardar en estado Zustand (runtime)
      ├─ Guardar en localStorage con timestamp (cache 8h)
      └─ Precios: price_cents / 100 para display
```

---

## Diagrama de capas de datos

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  Estado Zustand ← selectors ← componentes               │
│  Tipos: string IDs, float precios, lowercase status      │
├─────────────────────────────────────────────────────────┤
│                    API LAYER (fetch)                      │
│  fetchAPI() → headers auth → JSON body                   │
│  Conversion: parseInt(id), Math.round(price * 100)       │
├─────────────────────────────────────────────────────────┤
│                    BACKEND (FastAPI)                      │
│  Routers (thin) → Domain Services → Repositories         │
│  Pydantic schemas: validacion y serializacion             │
│  Tipos: int IDs, int centavos, UPPERCASE enums            │
├─────────────────────────────────────────────────────────┤
│                    DATABASE (PostgreSQL)                  │
│  BigInteger IDs, Integer price_cents                     │
│  Boolean is_active (soft delete)                         │
│  JSONB para metadata flexible                            │
├─────────────────────────────────────────────────────────┤
│                    CACHE (Redis)                          │
│  Token blacklist (TTL = token expiry)                    │
│  Event streams (pub/sub para WebSocket)                  │
│  Session cache (opcional, para performance)               │
└─────────────────────────────────────────────────────────┘
```

---

## Resumen de transformaciones por capa

| Dato | PostgreSQL | Backend (Python) | API (JSON) | Frontend (TS) | UI (display) |
|------|-----------|------------------|------------|---------------|--------------|
| ID | `BIGINT` | `int` | `number` | `string` | `"42"` |
| Precio | `INTEGER` (cents) | `int` (cents) | `number` (cents) | `number` (pesos) | `"$125.50"` |
| Estado sesion | `VARCHAR` | `str` UPPER | `string` UPPER | `string` lower | `"Pagando"` |
| Booleano | `BOOLEAN` | `bool` | `boolean` | `boolean` | Icono/color |
| Fecha | `TIMESTAMP` | `datetime` | `string` ISO | `Date` | `"hace 5 min"` |
| Email | `VARCHAR(255)` | `str` | `string` | `string` | `"admin@..."` |
| Imagen | `TEXT` (URL) | `str` (validada) | `string` | `string` | `<img src>` |
