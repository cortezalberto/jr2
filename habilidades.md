# Habilidades Recomendadas — skills.sh

> Análisis cruzado entre el stack del proyecto **Integrador** y el catálogo de [skills.sh](https://skills.sh).
> Fecha: 2025-04-05

---

## Stack Detectado

| Capa | Tecnologías |
|------|-------------|
| **Frontend** | React 19.2, TypeScript 5.9, Vite 7.2, Zustand 5.0, Tailwind CSS 4.1 |
| **Backend** | FastAPI 0.115, SQLAlchemy 2.0, PostgreSQL 16, Redis 7, Alembic |
| **Testing** | Vitest 4.0 (unit), Playwright 1.50 (E2E), pytest 8.3 (backend) |
| **Infra** | Docker, GitHub Actions CI, nginx LB, Redis Sentinel |
| **Patterns** | Clean Architecture, Outbox Pattern, RBAC, Soft Delete, WebSocket Gateway |

---

## Tier 1 — Imprescindibles (Impacto directo en calidad)

Estas skills atacan exactamente lo que este proyecto necesita.

### Testing & Verificación

| Skill | Publisher | Installs | Por qué la necesitás |
|-------|-----------|----------|----------------------|
| `vitest` | antfu/skills | 10.4K | **Usás Vitest en los 3 frontends.** Patrones avanzados, mocking, coverage strategies. Match directo. |
| `playwright-best-practices` | currents-dev | 17.7K | **Tenés Playwright en `e2e/`.** Best practices para tests estables, selectores, paralelismo. |
| `test-driven-development` | obra/superpowers | 37.1K | Workflow TDD estructurado. Con 3 frontends + backend, TDD evita regresiones en cascada. |
| `verification-before-completion` | obra/superpowers | 28.7K | Verificación antes de dar por terminado. Crítico en un sistema con billing, auth y WebSocket. |
| `python-testing-patterns` | wshobson/agents | 10.7K | **Usás pytest.** Patrones para fixtures, async testing, mocking de DB/Redis. |
| `webapp-testing` | anthropics/skills | 35.8K | Testing de web apps (oficial Anthropic). Cubre frontend + integración. |

**Comando de instalación:**
```bash
npx skills add antfu/skills:vitest
npx skills add currents-dev/playwright-best-practices
npx skills add obra/superpowers:test-driven-development
npx skills add obra/superpowers:verification-before-completion
npx skills add wshobson/agents:python-testing-patterns
npx skills add anthropics/skills:webapp-testing
```

### Code Quality & Review

| Skill | Publisher | Installs | Por qué la necesitás |
|-------|-----------|----------|----------------------|
| `code-review-excellence` | wshobson/agents | 9.8K | Con 34 páginas en Dashboard y 3 PWAs, los code reviews tienen que ser sistemáticos. |
| `requesting-code-review` | obra/superpowers | 35.5K | Cómo pedir reviews efectivos. Complementa `code-review-excellence`. |
| `receiving-code-review` | obra/superpowers | 28.5K | Cómo procesar feedback de reviews. Cierra el ciclo. |
| `systematic-debugging` | obra/superpowers | 44.2K | Debugging metódico. Con WebSocket + Outbox + 4 servicios, necesitás método, no intuición. |

```bash
npx skills add wshobson/agents:code-review-excellence
npx skills add obra/superpowers:requesting-code-review
npx skills add obra/superpowers:receiving-code-review
npx skills add obra/superpowers:systematic-debugging
```

---

## Tier 2 — Altamente Recomendadas (Fortalecen arquitectura y seguridad)

### Arquitectura & Backend

| Skill | Publisher | Installs | Por qué la necesitás |
|-------|-----------|----------|----------------------|
| `fastapi-templates` | wshobson/agents | 9.6K | **Usás FastAPI.** Templates y patrones para routers, services, middleware. Match directo. |
| `postgresql-optimization` | github/awesome-copilot | 8.9K | **PostgreSQL 16 con pgvector.** Optimización de queries, índices, EXPLAIN ANALYZE. |
| `postgresql-table-design` | wshobson/agents | 9.8K | Diseño de tablas. Con 11 migraciones y modelos complejos (multi-tenant), esto es oro. |
| `api-design-principles` | wshobson/agents | 13.2K | Principios de diseño de API. Tenés ~40 endpoints, consistencia es clave. |
| `architecture-patterns` | wshobson/agents | 10.2K | Patrones de arquitectura. Ya usás Clean Architecture, esto refuerza y expande. |
| `typescript-advanced-types` | wshobson/agents | 19.0K | **TypeScript 5.9 strict.** Tipos avanzados para stores, API responses, discriminated unions. |

```bash
npx skills add wshobson/agents:fastapi-templates
npx skills add github/awesome-copilot:postgresql-optimization
npx skills add wshobson/agents:postgresql-table-design
npx skills add wshobson/agents:api-design-principles
npx skills add wshobson/agents:architecture-patterns
npx skills add wshobson/agents:typescript-advanced-types
```

### Seguridad

| Skill | Publisher | Installs | Por qué la necesitás |
|-------|-----------|----------|----------------------|
| `security-best-practices` | supercent-io | 14.1K | Tenés JWT, HMAC tokens, RBAC, billing. La seguridad no es opcional. |
| `audit-website` | squirrelscan | 39.8K | Auditoría de seguridad web. 3 frontends públicos = 3 superficies de ataque. |
| `better-auth-best-practices` | better-auth | 29.9K | Best practices de auth. Con refresh tokens, table tokens y WebSocket auth, esto es relevante. |

```bash
npx skills add supercent-io/skills-template:security-best-practices
npx skills add squirrelscan/audit-website
npx skills add better-auth/better-auth-best-practices
```

---

## Tier 3 — Recomendadas (Mejoran workflow y frontend)

### Frontend & UI

| Skill | Publisher | Installs | Por qué la necesitás |
|-------|-----------|----------|----------------------|
| `tailwind-design-system` | wshobson/agents | 25.7K | **Usás Tailwind CSS 4.1 en los 3 frontends.** Design system consistente. |
| `web-accessibility` | supercent-io | 12.7K | 3 PWAs público-facing. Accesibilidad no es lujo, es requisito. |
| `responsive-design` | supercent-io | 11.2K | PWAs mobile-first. Responsive tiene que ser sólido. |
| `polish` | pbakaus/impeccable | 34.6K | Pulir UI. Para cuando la funcionalidad está y necesitás el detalle fino. |
| `harden` | pbakaus/impeccable | 32.4K | Hardening de UI para edge cases. Con cart compartido y real-time, hay muchos edge cases. |

```bash
npx skills add wshobson/agents:tailwind-design-system
npx skills add supercent-io/skills-template:web-accessibility
npx skills add supercent-io/skills-template:responsive-design
npx skills add pbakaus/impeccable:polish
npx skills add pbakaus/impeccable:harden
```

### Developer Workflow

| Skill | Publisher | Installs | Por qué la necesitás |
|-------|-----------|----------|----------------------|
| `writing-plans` | obra/superpowers | 43.1K | Planificación estructurada. Con un monorepo de este tamaño, improvisar es suicidio. |
| `executing-plans` | obra/superpowers | 35.1K | Ejecución de planes. Complemento directo de `writing-plans`. |
| `using-git-worktrees` | obra/superpowers | 26.8K | Git worktrees. Para trabajar en múltiples features del monorepo en paralelo. |
| `dispatching-parallel-agents` | obra/superpowers | 26.6K | Agentes en paralelo. Con 4 sub-proyectos, paralelizar es eficiencia pura. |
| `git-commit` | github/awesome-copilot | 19.1K | Commits consistentes. Conventional commits en un proyecto con 34+ páginas. |
| `multi-stage-dockerfile` | github/awesome-copilot | 9.0K | **Usás Docker.** Multi-stage builds para optimizar imágenes de producción. |

```bash
npx skills add obra/superpowers:writing-plans
npx skills add obra/superpowers:executing-plans
npx skills add obra/superpowers:using-git-worktrees
npx skills add obra/superpowers:dispatching-parallel-agents
npx skills add github/awesome-copilot:git-commit
npx skills add github/awesome-copilot:multi-stage-dockerfile
```

---

## Tier 4 — Opcionales (Útiles según el momento)

| Skill | Publisher | Installs | Cuándo usarla |
|-------|-----------|----------|---------------|
| `e2e-testing-patterns` | wshobson/agents | 9.0K | Cuando expandas la suite de Playwright |
| `playwright-generate-test` | github/awesome-copilot | 8.7K | Para generar tests E2E automáticamente |
| `python-performance-optimization` | wshobson/agents | 13.1K | Cuando necesites optimizar endpoints lentos |
| `performance-optimization` | supercent-io | 11.5K | Optimización general de performance |
| `api-documentation` | supercent-io | 11.7K | Cuando documentes la API públicamente |
| `database-schema-design` | supercent-io | 12.1K | Antes de crear nuevas migraciones |
| `refactor` | github/awesome-copilot | 11.3K | En ciclos de refactoring planificados |
| `code-refactoring` | supercent-io | 11.9K | Complemento de `refactor` |
| `deployment-automation` | supercent-io | 11.2K | Cuando automatices el deploy a producción |
| `brainstorming` | obra/superpowers | 79.9K | Para sesiones de diseño de features nuevas |

```bash
# Instalar según necesidad
npx skills add wshobson/agents:e2e-testing-patterns
npx skills add github/awesome-copilot:playwright-generate-test
npx skills add wshobson/agents:python-performance-optimization
npx skills add supercent-io/skills-template:performance-optimization
npx skills add supercent-io/skills-template:api-documentation
npx skills add supercent-io/skills-template:database-schema-design
npx skills add github/awesome-copilot:refactor
npx skills add supercent-io/skills-template:code-refactoring
npx skills add supercent-io/skills-template:deployment-automation
npx skills add obra/superpowers:brainstorming
```

---

## Skills Descartadas (y por qué)

| Skill | Razón de descarte |
|-------|-------------------|
| Azure / AWS skills | No usás cloud providers managed. Docker local + VPS. |
| Next.js / Nuxt / Vue skills | No aplica. Stack es React puro con Vite, no frameworks SSR. |
| React Native / Expo | No tenés apps nativas. Son PWAs web. |
| Shadcn UI | No usás Shadcn. UI es custom con Tailwind. |
| Supabase / Convex / Neon | No aplica. Usás PostgreSQL directo con SQLAlchemy. |
| Marketing / SEO skills | No es un proyecto de marketing. Es un sistema de gestión. |
| AI image/video generation | No aplica al dominio del proyecto. |
| Google Workspace / Lark | No aplica. No hay integración con productivity suites. |
| Vercel deploy | No desplegás en Vercel. Docker + nginx. |
| Node.js backend patterns | Backend es Python (FastAPI), no Node. |

---

## Resumen Ejecutivo

| Tier | Skills | Foco |
|------|--------|------|
| **Tier 1** (10 skills) | Testing + Code Review + Debugging | Calidad directa del código |
| **Tier 2** (9 skills) | Arquitectura + DB + Seguridad | Solidez del sistema |
| **Tier 3** (11 skills) | Frontend + Workflow | Productividad y UX |
| **Tier 4** (10 skills) | Según necesidad | Herramientas puntuales |
| **Total recomendadas** | **40 skills** de 400+ disponibles | 10% del catálogo |

### Script de instalación rápida (Tier 1 + Tier 2)

```bash
# Tier 1 — Imprescindibles
npx skills add antfu/skills:vitest
npx skills add currents-dev/playwright-best-practices
npx skills add obra/superpowers:test-driven-development
npx skills add obra/superpowers:verification-before-completion
npx skills add wshobson/agents:python-testing-patterns
npx skills add anthropics/skills:webapp-testing
npx skills add wshobson/agents:code-review-excellence
npx skills add obra/superpowers:requesting-code-review
npx skills add obra/superpowers:receiving-code-review
npx skills add obra/superpowers:systematic-debugging

# Tier 2 — Altamente Recomendadas
npx skills add wshobson/agents:fastapi-templates
npx skills add github/awesome-copilot:postgresql-optimization
npx skills add wshobson/agents:postgresql-table-design
npx skills add wshobson/agents:api-design-principles
npx skills add wshobson/agents:architecture-patterns
npx skills add wshobson/agents:typescript-advanced-types
npx skills add supercent-io/skills-template:security-best-practices
npx skills add squirrelscan/audit-website
npx skills add better-auth/better-auth-best-practices
```
