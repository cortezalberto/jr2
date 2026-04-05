> Creado: 2026-04-04 | Actualizado: 2026-04-04 | Estado: vigente

# Features con Madurez Inferior a COMPLETA

Detalle de cada feature que aun no alcanza madurez COMPLETA, incluyendo que existe, que falta, esfuerzo estimado y dependencias.

---

## FUNCIONAL (operativas pero incompletas)

### 1. Kitchen Display

- **Que existe**:
  - Modelo: `KitchenTicket` en `backend/rest_api/models/`
  - API: Endpoints en `backend/rest_api/routers/kitchen/`
  - Frontend: `Dashboard/src/pages/Kitchen.tsx`
  - WebSocket: Eventos `ROUND_SUBMITTED`, `ROUND_IN_KITCHEN`, `ROUND_READY`, `ROUND_SERVED`
- **Que falta**:
  - Tests dedicados para la pagina Kitchen.tsx y los endpoints de cocina
  - i18n (todo el texto esta hardcodeado en espanol)
  - Documentacion en knowledge-base
- **Esfuerzo estimado**: 2-3 dias
- **Dependencias**: Round status flow (COMPLETA), WebSocket Gateway (COMPLETA)
- **Bloqueado por**: Nada

### 2. Estadisticas / Reportes

- **Que existe**:
  - API: `backend/rest_api/routers/admin/reports.py` (pedidos por hora, ventas)
  - Frontend: `Dashboard/src/pages/Reports.tsx`, `Dashboard/src/pages/Sales.tsx`
  - Graficos basicos funcionando
- **Que falta**:
  - Queries mas completos (por categoria, por mozo, por dia de semana, etc.)
  - Mas tipos de graficos y metricas
  - Tests para el router de reportes y los componentes de graficos
  - Documentacion
- **Esfuerzo estimado**: 1-2 semanas (depende del alcance de metricas deseado)
- **Dependencias**: Round model (COMPLETA), Payment model (COMPLETA)
- **Bloqueado por**: Nada (se puede expandir incrementalmente)

### 3. Disponibilidad de Producto

- **Que existe**:
  - Modelo: Campo `is_available` en `BranchProduct` (migracion 002)
  - API: Endpoint para toggle de disponibilidad en kitchen router
  - WebSocket: Evento de cambio de disponibilidad
- **Que falta**:
  - Integracion en Dashboard admin (UI para marcar productos como no disponibles)
  - pwaMenu no muestra badge "Agotado" en productos no disponibles
  - Tests
  - Documentacion
- **Esfuerzo estimado**: 3-4 dias
- **Dependencias**: Product Catalog (COMPLETA), BranchProduct (COMPLETA)
- **Bloqueado por**: Nada

### 4. Light / Dark Mode

- **Que existe**:
  - Dashboard: CSS variables + toggle en `Dashboard/src/components/layout/Sidebar.tsx`
  - Utilidad: `Dashboard/src/utils/theme.ts`
  - pwaWaiter: Variables CSS base en `pwaWaiter/src/index.css`
- **Que falta**:
  - Toggle en pwaMenu (sin implementar)
  - Toggle en pwaWaiter (variables existen pero sin UI de cambio)
  - Tests para la logica de toggle
- **Esfuerzo estimado**: 2-3 dias
- **Dependencias**: Ninguna
- **Bloqueado por**: Nada

### 5. Payment Gateway Abstraction

- **Que existe**:
  - ABC: `backend/rest_api/services/payments/gateway.py` (PaymentGateway, PaymentResult, PaymentPreference)
  - Implementacion: `backend/rest_api/services/payments/mercadopago_gateway.py` (MercadoPagoGateway)
  - Init: `backend/rest_api/services/payments/__init__.py`
- **Que falta**:
  - Wiring: El billing router todavia usa codigo inline de Mercado Pago en vez de la abstraccion
  - Segunda implementacion (ej. StripeGateway) para validar que la abstraccion funciona
  - Tests para la ABC y la implementacion
- **Esfuerzo estimado**: 3-5 dias (refactor del router + tests)
- **Dependencias**: Billing flow (COMPLETA)
- **Bloqueado por**: Nada (es refactor interno)

### 6. Event Catch-up (reconexion)

- **Que existe**:
  - Backend: `backend/shared/infrastructure/events/catchup.py` (Redis sorted set)
  - Endpoint: `/ws/catchup` en `ws_gateway/main.py`
  - Frontend: pwaWaiter auto-replay on reconnect en `pwaWaiter/src/services/websocket.ts`
- **Que falta**:
  - Dashboard no implementa catch-up (pierde eventos en desconexion)
  - pwaMenu no implementa catch-up
  - Tests para el mecanismo de catch-up
  - Documentacion
- **Esfuerzo estimado**: 3-4 dias
- **Dependencias**: WebSocket Gateway (COMPLETA), Redis (infraestructura)
- **Bloqueado por**: Nada

### 7. CI/CD (GitHub Actions)

- **Que existe**:
  - `.github/workflows/ci.yml` (lint + tests)
  - `.github/workflows/docker-build.yml` (build de imagenes)
- **Que falta**:
  - Workflow de deployment (staging/produccion)
  - Coverage reports integrados en PR
  - E2E tests en CI pipeline
- **Esfuerzo estimado**: 3-5 dias
- **Dependencias**: E2E Tests (SCAFFOLD)
- **Bloqueado por**: Definicion de infraestructura de deploy

### 8. Alembic Migrations

- **Que existe**:
  - 4 migraciones encadenadas: 001 → 002 → 003 → 004
  - Configuracion Alembic funcional
- **Que falta**:
  - Migracion "initial schema" (el schema base fue creado por `create_all()` antes de Alembic)
  - Tests de migracion (upgrade + downgrade)
- **Esfuerzo estimado**: 1-2 dias
- **Dependencias**: Ninguna
- **Bloqueado por**: Nada (pero generar initial migration retroactivamente es delicado)

---

## PARCIAL (capas implementadas pero no end-to-end)

### 9. Push Notifications

- **Que existe**:
  - Backend: `backend/rest_api/routers/waiter/notifications.py` (endpoints subscribe/unsubscribe)
  - Service Worker: Registrado en pwaWaiter
  - Config: `VITE_VAPID_PUBLIC_KEY` en `.env.example` de pwaWaiter
  - Nota: El store de subscripciones es in-memory (dict), no persistido
- **Que falta**:
  - Integracion real: nadie llama a los endpoints de subscribe desde el frontend
  - Triggers: Los eventos WebSocket no disparan push notifications como fallback
  - Persistencia: Migrar de dict in-memory a Redis o PostgreSQL
  - Tests
- **Esfuerzo estimado**: 1 semana
- **Dependencias**: WebSocket Gateway (COMPLETA), Service Worker (existe)
- **Bloqueado por**: Nada

### 10. Disponibilidad de Producto (frontend)

- **Que existe**:
  - El endpoint funciona y devuelve `is_available` en la respuesta del menu publico
- **Que falta**:
  - pwaMenu no muestra badge "Agotado" ni deshabilita el boton de agregar al carrito
  - pwaMenu no escucha el evento WS de cambio de disponibilidad para actualizar en tiempo real
- **Esfuerzo estimado**: 1-2 dias
- **Dependencias**: Disponibilidad de Producto backend (FUNCIONAL)
- **Bloqueado por**: Nada

> Nota: Este item es parte de la feature #3 (Disponibilidad de Producto). Se separa para mayor claridad sobre el gap especifico del frontend.

---

## SCAFFOLD (estructura basica sin logica funcional)

### 11. E2E Tests (Playwright)

- **Que existe**:
  - Config: `e2e/playwright.config.ts`, `e2e/package.json`
  - Specs: `e2e/tests/dashboard/login.spec.ts`, `e2e/tests/pwa-menu/join-table.spec.ts`, `e2e/tests/pwa-waiter/branch-select.spec.ts`
- **Que falta**:
  - Test de flujo de pedido completo (QR → carrito → round → cocina → servido)
  - Test de flujo de pago (check → pago → cierre)
  - Test de flujo de cocina (ticket → preparacion → listo)
  - Integracion con CI/CD
  - Fixtures y helpers de test
- **Esfuerzo estimado**: 2-3 semanas
- **Dependencias**: Docker Compose (FUNCIONAL), Seed Data (FUNCIONAL)
- **Bloqueado por**: Nada

### 12. Dashboard i18n

- **Que existe**:
  - Setup: `Dashboard/src/i18n/index.ts` (configuracion i18next)
  - Locales: `Dashboard/src/i18n/locales/es.json`, `Dashboard/src/i18n/locales/en.json`
  - Uso parcial: Sidebar y algunas keys comunes traducidas
- **Que falta**:
  - Adopcion en paginas: La mayoria de las 25+ paginas tiene texto hardcodeado en espanol
  - Extraer todos los strings a los archivos de locale
  - Agregar portugues (como pwaMenu)
- **Esfuerzo estimado**: 1-2 semanas (trabajo mecanico pero extenso)
- **Dependencias**: Ninguna
- **Bloqueado por**: Nada (es esfuerzo puro, no complejidad)

### 13. Shared WS Client

- **Que existe**:
  - Archivo: `shared/websocket-client.ts`
- **Que falta**:
  - Adopcion: Dashboard, pwaMenu y pwaWaiter usan cada uno su propio `websocket.ts`
  - Refactor de los 3 clientes para usar el shared
  - Tests del cliente compartido
- **Esfuerzo estimado**: 3-5 dias
- **Dependencias**: Ninguna
- **Bloqueado por**: Riesgo de regresion (cada frontend tiene quirks propios en su WS client)

### 14. Reservations (Reservas)

- **Que existe**:
  - Modelo: `backend/rest_api/models/reservation.py`
  - Migracion: `003_create_reservation_table.py` (17 columnas + AuditMixin, indices)
  - Export: Incluido en `backend/rest_api/models/__init__.py`
- **Que falta**:
  - Router (endpoints CRUD)
  - Domain Service (ReservationService)
  - Frontend: Pagina de gestion en Dashboard
  - Frontend: Flujo de reserva online en pwaMenu (futuro)
  - Tests
  - i18n
- **Esfuerzo estimado**: 1-2 semanas
- **Dependencias**: Branch (COMPLETA), Table (COMPLETA, FK opcional)
- **Bloqueado por**: Nada

### 15. Takeout / Delivery

- **Que existe**:
  - Modelos: `backend/rest_api/models/delivery.py` (DeliveryOrder + DeliveryOrderItem)
  - Migracion: `004_create_delivery_tables.py` (delivery_order: 20 cols, delivery_order_item: 10 cols)
  - Documento de arquitectura existente
  - Export: Incluido en `backend/rest_api/models/__init__.py`
- **Que falta**:
  - Router (endpoints CRUD + status flow)
  - Domain Service (DeliveryService)
  - Frontend: Pagina de gestion en Dashboard
  - Frontend: Nuevo flujo en pwaMenu (sin mesa fisica)
  - Integracion con Kitchen Display (tickets de delivery)
  - Tests
  - i18n
- **Esfuerzo estimado**: 3-4 semanas
- **Dependencias**: Product Catalog (COMPLETA), Payment (COMPLETA), Kitchen Display (FUNCIONAL)
- **Bloqueado por**: Nada (pero es la feature nueva mas grande)

### 16. OpenAPI Codegen

- **Que existe**:
  - Script: `scripts/generate-types.sh` (usa `openapi-typescript` contra el backend corriendo)
- **Que falta**:
  - Integracion en CI (generar tipos y commitear o validar que estan actualizados)
  - Archivos generados no estan commiteados (se generan bajo demanda)
  - Adopcion: Los frontends no importan de `types/api-generated.ts`
- **Esfuerzo estimado**: 2-3 dias
- **Dependencias**: CI/CD (FUNCIONAL)
- **Bloqueado por**: Nada

---

## PLANIFICADA (solo documentacion)

### 17. Shared UI Components

- **Que existe**:
  - README: `shared/ui/README.md` (describe la idea y estructura propuesta)
- **Que falta**:
  - Todo: No hay componentes, ni package.json, ni build config
  - Identificar componentes duplicados entre Dashboard, pwaMenu, pwaWaiter
  - Implementar como paquete compartido (ej. con Vite library mode)
- **Esfuerzo estimado**: 2-3 semanas (setup + migrar componentes comunes)
- **Dependencias**: Ninguna
- **Bloqueado por**: Nada (decision de cuando vale la pena la inversion)

---

## Resumen de Esfuerzo Total Estimado

| Prioridad | Features | Esfuerzo |
|-----------|----------|----------|
| Quick wins (< 3 dias) | Dark Mode toggle, Disponibilidad frontend badge | ~4 dias |
| Mediano (1-2 semanas) | Kitchen tests, Event catch-up, Reservations, CI deploy | ~5 semanas |
| Grande (2+ semanas) | E2E Tests, Dashboard i18n, Takeout/Delivery, Shared UI | ~10 semanas |
