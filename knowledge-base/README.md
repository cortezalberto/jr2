# Knowledge Base — Integrador / Buen Sabor

> Sistema de gestión de restaurantes multi-tenant. Esta base de conocimiento permite reconstruir, escalar o migrar el sistema **sin acceso al código fuente**.

**Generada:** 2026-04-04  
**Archivos:** 44 documentos | ~650 KB  
**Version:** v3 (madurez de features, dependencias, DX, extensibilidad, i18n)  
**Cobertura:** Backend, WebSocket Gateway, Dashboard, pwaMenu, pwaWaiter, DevOps

---

## Índice

### Núcleo del Producto
| # | Archivo | Descripción |
|---|---------|-------------|
| 01 | [Visión General](01_vision_general.md) | Qué es el sistema, stack, componentes, métricas |
| 02 | [Problema que Resuelve](02_problema_que_resuelve.md) | Los 10 problemas de negocio que ataca |
| 03 | [Propuesta de Valor](03_propuesta_de_valor.md) | Valor para cada actor, diferenciadores |
| 04 | [Actores y Roles](04_actores_y_roles.md) | RBAC, autenticación, permisos por rol |

### Funcionalidad
| # | Archivo | Descripción |
|---|---------|-------------|
| 05 | [Funcionalidades](05_funcionalidades.md) | Catálogo completo de features por componente |
| 06 | [Flujos de Usuario](06_flujos_de_usuario.md) | 9 flujos end-to-end documentados paso a paso |
| 07 | [Casos de Uso](07_casos_de_uso.md) | 10 casos de uso formales con alternativas |

### Lógica del Sistema
| # | Archivo | Descripción |
|---|---------|-------------|
| 08 | [Reglas de Negocio](08_reglas_de_negocio.md) | Multi-tenant, precios, RBAC, tokens, eventos |
| 09 | [Modelo de Datos](09_modelo_de_datos.md) | 34+ tablas, relaciones, convenciones |
| 10 | [Estado y Transiciones](10_estado_y_transiciones.md) | 11 máquinas de estado (rounds, sesiones, pagos, etc.) |

### Arquitectura Técnica
| # | Archivo | Descripción |
|---|---------|-------------|
| 11 | [Arquitectura General](11_arquitectura_general.md) | Topología, capas, patrones de comunicación |
| 12 | [Estructura del Código](12_estructura_del_codigo.md) | Árbol completo del proyecto con descripciones |
| 13 | [Componentes Clave](13_componentes_clave.md) | 15 componentes críticos documentados en profundidad |
| 14 | [API Endpoints](14_api_endpoints.md) | Todos los endpoints REST + WebSocket |
| 15 | [Integraciones](15_integraciones.md) | Mercado Pago, Redis, PostgreSQL, Ollama, PWA |

### Infraestructura
| # | Archivo | Descripción |
|---|---------|-------------|
| 16 | [Configuración y Entornos](16_configuracion_y_entornos.md) | Variables de entorno, configs por componente |
| 17 | [Dependencias](17_dependencias.md) | Todas las dependencias con versiones y propósito |
| 18 | [Despliegue](18_despliegue.md) | Docker, DevContainer, producción, health checks |

### Decisiones
| # | Archivo | Descripción |
|---|---------|-------------|
| 19 | [Decisiones Técnicas](19_decisiones_tecnicas.md) | 18 decisiones arquitectónicas con razonamiento |
| 20 | [Tradeoffs](20_tradeoffs.md) | 10 compromisos clave con análisis de riesgo |

### Estado Actual
| # | Archivo | Descripción |
|---|---------|-------------|
| 21 | [Limitaciones](21_limitaciones.md) | 13 funcionales + 13 técnicas |
| 22 | [Deuda Técnica](22_deuda_tecnica.md) | 13 items priorizados (HIGH/MEDIUM/LOW) |
| 23 | [Riesgos](23_riesgos.md) | 10 riesgos (CRITICAL/HIGH/MEDIUM) con mitigación |

### Evolución
| # | Archivo | Descripción |
|---|---------|-------------|
| 24 | [Roadmap Sugerido](24_roadmap_sugerido.md) | 5 fases desde fundaciones hasta inteligencia |
| 25 | [Oportunidades de Mejora](25_oportunidades_de_mejora.md) | 18 mejoras en arquitectura, performance, DX, producto |

### Análisis Crítico
| # | Archivo | Descripción |
|---|---------|-------------|
| 26 | [Suposiciones Detectadas](26_suposiciones_detectadas.md) | 12 suposiciones implícitas con evidencia y riesgo |
| 27 | [Preguntas Abiertas](27_preguntas_abiertas.md) | 24 preguntas que necesitan respuesta del negocio |

### Patrones y Calidad (v2)
| # | Archivo | Descripción |
|---|---------|-------------|
| 28 | [Patrones de Diseño](28_patrones_de_diseno.md) | 57 patrones con evidencia de código (referencia rápida) |
| 29 | [Planificados vs Implementados](29_patrones_planificados_vs_implementados.md) | 12 planificados: 4 completos, 7 gaps en doc, 1 no implementado |
| 30 | [Inconsistencias Detectadas](30_inconsistencias_detectadas.md) | 7 inconsistencias docs-vs-código (6 corregidas, 1 documentada) |

### Seguridad (v2)
| # | Archivo | Descripción |
|---|---------|-------------|
| 31 | [Modelo de Seguridad](31_modelo_de_seguridad.md) | Auth, RBAC, rate limiting, SSRF, headers, secrets |
| 32 | [Superficie de Ataque](32_superficie_de_ataque.md) | 161 endpoints, 4 WS, inputs, gaps identificados |

### Flujos End-to-End (v2)
| # | Archivo | Descripción |
|---|---------|-------------|
| 33 | [Flujos de Eventos](33_flujos_de_eventos.md) | 5 flujos críticos trazados desde UI hasta último consumidor |
| 34 | [Flujos de Datos](34_flujos_de_datos.md) | Conversiones de tipos, flujo UI → API → DB → UI |

### Métricas (v2)
| # | Archivo | Descripción |
|---|---------|-------------|
| 35 | [Métricas del Proyecto](35_metricas_del_proyecto.md) | 130K LOC, 649 archivos, 161 endpoints, 55 modelos |

### Madurez de Features (v3)
| # | Archivo | Descripción |
|---|---------|-------------|
| 36 | [Matriz de Madurez](36_matriz_de_madurez.md) | 44 features: 27 completas, 8 funcionales, 2 parciales, 6 scaffolds |
| 37 | [Features Parciales](37_features_parciales.md) | 17 features incompletas con qué falta y esfuerzo estimado |

### Dependencias entre Features (v3)
| # | Archivo | Descripción |
|---|---------|-------------|
| 38 | [Mapa de Dependencias](38_mapa_de_dependencias.md) | Si toco X, qué se rompe. Grafo por dominio |
| 39 | [Cadena de Migraciones](39_cadena_de_migraciones.md) | 4 migraciones Alembic: orden, dependencias, riesgos |

### Developer Experience (v3)
| # | Archivo | Descripción |
|---|---------|-------------|
| 40 | [Onboarding Developer](40_onboarding_developer.md) | Sistema corriendo en 5-15 min desde cero |
| 41 | [Tooling Inventario](41_tooling_inventario.md) | Scripts, CLI, seed, codegen, backup, E2E |
| 42 | [Trampas Conocidas](42_trampas_conocidas.md) | 22 gotchas: config, Windows, tipos, Zustand, seguridad |

### Extensibilidad (v3)
| # | Archivo | Descripción |
|---|---------|-------------|
| 43 | [Capas de Abstracción](43_capas_de_abstraccion.md) | 8 interfaces/ABCs: PaymentGateway, Auth Strategy, etc. |
| 44 | [Internacionalización](44_internacionalizacion.md) | pwaMenu 100%, Dashboard scaffold, pwaWaiter sin i18n |

---

## Cómo Usar Esta Base de Conocimiento

| Objetivo | Empezar por |
|----------|-------------|
| **Entender el sistema** | 01 → 02 → 03 → 04 |
| **Onboarding técnico** | 11 → 12 → 13 → 14 → 16 |
| **Implementar feature** | 05 → 06 → 08 → 09 → 10 → 33 |
| **Evaluar el sistema** | 21 → 22 → 23 → 26 → 27 → 30 |
| **Auditar seguridad** | 31 → 32 → 15 |
| **Entender eventos real-time** | 33 → 34 → 14 |
| **Planificar evolución** | 24 → 25 → 20 → 19 → 35 |
| **Revisar patrones** | 28 → 29 → 30 |
| **Onboarding de dev nuevo** | 40 → 42 → 41 |
| **Priorizar trabajo** | 36 → 37 → 38 |
| **Extender el sistema** | 43 → 44 → 19 |
| **Reconstruir desde cero** | Leer en orden 01 → 44 |

---

## Stack Tecnológico (Resumen)

| Capa | Tecnología |
|------|------------|
| **Frontend** | React 19.2 + TypeScript 5.9 + Vite 7.2 + Zustand 5 + Tailwind 4 |
| **Backend** | FastAPI 0.115 + SQLAlchemy 2.0 + Pydantic 2.10 |
| **Base de Datos** | PostgreSQL 16 + pgvector |
| **Cache/Events** | Redis 7 (Pub/Sub, blacklist, rate limiting) |
| **Real-time** | WebSocket Gateway (FastAPI, 400+ usuarios concurrentes) |
| **Pagos** | Mercado Pago (ARS) |
| **AI** | Ollama (qwen2.5:7b + nomic-embed-text) |
| **Infra** | Docker Compose, DevContainer |
