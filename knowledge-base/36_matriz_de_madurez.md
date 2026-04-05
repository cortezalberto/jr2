> Creado: 2026-04-04 | Actualizado: 2026-04-04 | Estado: vigente

# Matriz de Madurez de Features

Clasificacion de madurez de cada feature del sistema Integrador.

## Niveles de madurez

| Nivel | Significado |
|-------|-------------|
| **COMPLETA** | Modelo + API + Frontend + Tests + Docs. Feature lista para produccion. |
| **FUNCIONAL** | Feature operativa pero le faltan capas (tests, docs, i18n, o integracion parcial). |
| **PARCIAL** | Algunas capas implementadas, pero la feature no es utilizable end-to-end. |
| **SCAFFOLD** | Estructura basica creada (archivos, config, modelos), pero sin logica funcional. |
| **PLANIFICADA** | Solo documentacion o README. Sin codigo funcional. |

---

## Core CRUD

| Feature | Modelo | API | Frontend | Tests | Docs | i18n | Madurez |
|---------|:------:|:---:|:--------:|:-----:|:----:|:----:|---------|
| Login / JWT Auth | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Table Token Auth | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Branch (Sucursal) | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Category (Categoria) | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Subcategory (Subcategoria) | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Product (Producto) | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Allergen (Alergeno) | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Promotion (Promocion) | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Table (Mesa) | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Sector | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Staff (Personal) | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Role (Rol) | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Restaurant Settings | SI | SI | SI | SI | SI | - | **COMPLETA** |

## Flujo de Pedidos

| Feature | Modelo | API | Frontend | Tests | Docs | i18n | Madurez |
|---------|:------:|:---:|:--------:|:-----:|:----:|:----:|---------|
| QR / Unirse a Mesa | SI | SI | SI | SI | SI | SI | **COMPLETA** |
| Carrito Compartido | SI | SI | SI | SI | SI | SI | **COMPLETA** |
| Confirmacion Grupal | SI | SI | SI | SI | SI | SI | **COMPLETA** |
| Round Submission (comensal) | SI | SI | SI | SI | SI | SI | **COMPLETA** |
| Round Confirmation (mozo) | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Round to Kitchen | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Kitchen Tickets | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Service Calls (Llamadas) | SI | SI | SI | SI | SI | SI | **COMPLETA** |
| Comanda Rapida (mozo) | SI | SI | SI | SI | SI | - | **COMPLETA** |

## Facturacion

| Feature | Modelo | API | Frontend | Tests | Docs | i18n | Madurez |
|---------|:------:|:---:|:--------:|:-----:|:----:|:----:|---------|
| Solicitud de Cuenta (Check) | SI | SI | SI | SI | SI | SI | **COMPLETA** |
| Division de Cuenta (Bill Split) | SI | SI | SI | SI | SI | SI | **COMPLETA** |
| Mercado Pago | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Pago Manual (efectivo/tarjeta) | SI | SI | SI | SI | SI | - | **COMPLETA** |
| Cierre de Mesa | SI | SI | SI | SI | SI | - | **COMPLETA** |

## Cocina y Operaciones

| Feature | Modelo | API | Frontend | Tests | Docs | i18n | Madurez |
|---------|:------:|:---:|:--------:|:-----:|:----:|:----:|---------|
| Kitchen Display | SI | SI | SI | NO | NO | NO | **FUNCIONAL** |
| Estadisticas / Reportes | SI | SI | SI | NO | NO | NO | **FUNCIONAL** |
| Disponibilidad de Producto | SI | SI | NO | NO | NO | NO | **PARCIAL** |

## Infraestructura

| Feature | Modelo | API | Frontend | Tests | Docs | i18n | Madurez |
|---------|:------:|:---:|:--------:|:-----:|:----:|:----:|---------|
| CI/CD (GitHub Actions) | - | - | - | SI | NO | - | **FUNCIONAL** |
| Alembic Migrations | SI | - | - | NO | NO | - | **FUNCIONAL** |
| Backup / Restore | - | SI | - | NO | NO | - | **FUNCIONAL** |
| Horizontal Scaling (WS Gateway) | - | SI | - | NO | SI | - | **FUNCIONAL** |
| E2E Tests (Playwright) | - | - | - | PARCIAL | NO | - | **SCAFFOLD** |
| Seed Data Modular | SI | - | - | NO | NO | - | **FUNCIONAL** |
| OpenAPI Codegen | - | SI | NO | NO | NO | - | **SCAFFOLD** |
| Dashboard i18n | - | - | PARCIAL | NO | NO | PARCIAL | **SCAFFOLD** |
| Shared WS Client | - | - | NO | NO | NO | - | **SCAFFOLD** |
| Shared UI Components | - | - | NO | NO | SI | - | **PLANIFICADA** |

## Features Nuevas

| Feature | Modelo | API | Frontend | Tests | Docs | i18n | Madurez |
|---------|:------:|:---:|:--------:|:-----:|:----:|:----:|---------|
| Push Notifications | PARCIAL | SI | PARCIAL | NO | NO | NO | **PARCIAL** |
| Light / Dark Mode | - | - | SI | NO | NO | - | **FUNCIONAL** |
| Reservations | SI | NO | NO | NO | NO | NO | **SCAFFOLD** |
| Takeout / Delivery | SI | NO | NO | NO | SI | NO | **SCAFFOLD** |
| Payment Gateway Abstraction | SI | PARCIAL | - | NO | NO | - | **FUNCIONAL** |

## Real-time

| Feature | Modelo | API | Frontend | Tests | Docs | i18n | Madurez |
|---------|:------:|:---:|:--------:|:-----:|:----:|:----:|---------|
| Event Catch-up (reconexion) | SI | SI | PARCIAL | NO | NO | - | **FUNCIONAL** |
| WebSocket Gateway | SI | SI | SI | SI | SI | - | **COMPLETA** |

---

## Resumen

| Madurez | Cantidad | Porcentaje |
|---------|:--------:|:----------:|
| **COMPLETA** | 27 | 60% |
| **FUNCIONAL** | 8 | 18% |
| **PARCIAL** | 2 | 4% |
| **SCAFFOLD** | 6 | 13% |
| **PLANIFICADA** | 1 | 2% |
| **Total** | **44** | **100%** |

### Observaciones

- El **core del negocio** (CRUD + pedidos + facturacion) esta completamente maduro (27 features COMPLETAS).
- Las features **FUNCIONAL** son operativas pero necesitan tests y documentacion para ser production-ready.
- Los **SCAFFOLD** son inversiones de tiempo minimo que establecieron la base para trabajo futuro.
- La unica feature **PLANIFICADA** (Shared UI Components) es una optimizacion, no un bloqueante.
