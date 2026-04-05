# 22. Deuda Tecnica

> Inventario priorizado de deuda tecnica identificada en Integrador / Buen Sabor, con impacto estimado, estrategia de resolucion y esfuerzo aproximado.

---

## Prioridad ALTA

Estas deudas afectan la estabilidad, mantenibilidad o seguridad del sistema y deberian abordarse antes de ir a produccion.

---

### 1. CRUDFactory esta deprecado pero sigue en uso

**Descripcion**: El patron `CRUDFactory` fue reemplazado por Domain Services (`BaseCRUDService`, `BranchScopedService`) como arquitectura recomendada. Sin embargo, codigo existente todavia usa CRUDFactory directamente desde los routers, mezclando logica de negocio en la capa de controladores.

**Impacto**:
- Dos patrones de acceso a datos coexisten, generando confusion para nuevos desarrolladores.
- Los routers que usan CRUDFactory violan Clean Architecture al acoplar HTTP con logica de datos.
- Los Domain Services ofrecen hooks (`_validate_create`, `_after_delete`, permisos centralizados) que CRUDFactory no soporta.

**Estrategia de resolucion**:
1. Identificar todos los routers que usan CRUDFactory directamente.
2. Para cada uno, crear el Domain Service correspondiente.
3. Migrar el router para que delegue al servicio.
4. Verificar que los tests pasen.
5. Repetir hasta eliminar todas las referencias a CRUDFactory.

**Esfuerzo**: Medio. Cada migracion es aislada y puede hacerse incrementalmente. ~1-2 horas por entidad.

---

### 2. Sin archivos de migracion de base de datos

**Descripcion**: Alembic esta mencionado como herramienta de migraciones en la documentacion, pero no se encontraron archivos de migracion (`versions/`) en el repositorio. El esquema actual de la base de datos no tiene historial versionado.

**Impacto**:
- Los cambios de esquema no son reproducibles ni reversibles.
- No hay forma de llevar una base de datos de una version a otra de manera controlada.
- Coordinar cambios de esquema entre multiples desarrolladores es propenso a conflictos.
- En produccion, un cambio de esquema incorrecto no tiene rollback.

**Estrategia de resolucion**:
1. Inicializar Alembic con `alembic init`.
2. Generar la migracion inicial con `alembic revision --autogenerate` contra el esquema actual.
3. Verificar que la migracion generada refleja el esquema real.
4. Establecer convencion: todo cambio de modelo requiere migracion asociada.
5. Agregar `alembic upgrade head` al proceso de deploy.

**Esfuerzo**: Medio. La inicializacion es rapida (~2h), pero la revision de la migracion inicial requiere cuidado.

---

### 3. Paginas placeholder en el Dashboard

**Descripcion**: Multiples paginas del Dashboard existen como rutas pero no estan implementadas:
- **Kitchen Display**: Vista de tickets de cocina con gestion de estados.
- **Estadisticas (Ventas)**: Graficos de revenue, productos populares, horarios pico.
- **Estadisticas (Historial)**: Historial por sucursal y por cliente.
- **Exclusiones de Producto**: Gestion de exclusiones/personalizaciones.
- **Ordenes**: Vista consolidada de ordenes activas.

**Impacto**:
- Funcionalidad prometida en la navegacion que no existe al hacer click.
- Roles como KITCHEN y MANAGER no tienen herramientas completas para su trabajo diario.
- La ausencia de estadisticas impide la toma de decisiones basada en datos.

**Estrategia de resolucion**: Implementar cada pagina como feature independiente, priorizando Kitchen Display (critica para operacion) y luego Estadisticas (critica para gestion).

**Esfuerzo**: Alto. Cada pagina es un feature completo (store, componentes, integracion API). ~1-2 semanas por pagina.

---

### 4. Sin pipeline de CI/CD

**Descripcion**: No existe ninguna forma de automatizacion para testing, linting, build o deployment. Todo se hace manualmente.

**Impacto**:
- Codigo con errores de TypeScript puede llegar a produccion.
- Tests que fallan no bloquean el merge.
- Cada deploy es un proceso manual propenso a errores.
- No hay visibilidad del estado de salud del codigo.

**Estrategia de resolucion**:
1. Crear workflow de GitHub Actions con jobs para:
   - Lint (ESLint en cada frontend, flake8/ruff en backend)
   - Type check (`tsc --noEmit` en cada frontend, mypy en backend)
   - Unit tests (Vitest en frontends, pytest en backend)
   - Build (verificar que los frontends compilen)
2. Configurar branch protection: PR requiere CI verde para merge.
3. Agregar job de deploy (staging primero, produccion con aprobacion manual).

**Esfuerzo**: Medio. ~1-2 dias para CI basico, ~1 semana para CD completo.

---

### 5. Gaps en cobertura de tests

**Descripcion**: El backend tiene ~19 archivos de test pero no hay reporte de cobertura visible. Los frontends tienen tests de stores (Zustand) pero los componentes React no estan testeados. No hay tests E2E.

**Impacto**:
- Regresiones en componentes visuales solo se detectan manualmente.
- Flujos criticos de negocio (login -> pedido -> pago -> cierre) no tienen validacion automatizada de punta a punta.
- Sin metricas de cobertura, no se sabe que tan expuesto esta el sistema.

**Estrategia de resolucion**:
1. Configurar reporte de cobertura en CI (Vitest `--coverage`, pytest-cov).
2. Establecer umbral minimo de cobertura (ej: 70% lineas para nuevo codigo).
3. Agregar tests de componentes criticos con Testing Library.
4. Implementar suite E2E con Playwright para flujos principales.

**Esfuerzo**: Alto. Es un esfuerzo continuo. Setup inicial ~1 semana, mantenimiento permanente.

---

## Prioridad MEDIA

Estas deudas afectan la experiencia de desarrollo o generan inconsistencias, pero no bloquean la operacion del sistema.

---

### 6. Inconsistencia en VITE_API_URL

**Descripcion**: Dashboard configura `VITE_API_URL=http://localhost:8000` (sin `/api`), mientras que pwaMenu y pwaWaiter usan `VITE_API_URL=http://localhost:8000/api` (con `/api`). Los archivos `api.ts` de cada frontend manejan la diferencia internamente.

**Impacto**:
- Confusion para desarrolladores al configurar entornos.
- Errores 404 dificiles de diagnosticar cuando se copia configuracion entre proyectos.
- Inconsistencia que indica falta de convencion compartida.

**Estrategia de resolucion**: Estandarizar todos los frontends al mismo patron (preferiblemente con `/api`) y ajustar las funciones `fetchAPI` correspondientemente.

**Esfuerzo**: Bajo. ~1-2 horas incluyendo testing.

---

### 7. JWT_SECRET hardcodeado en docker-compose de desarrollo

**Descripcion**: El archivo `docker-compose.yml` de desarrollo incluye un `JWT_SECRET` directamente en el archivo. Si este compose se usa accidentalmente en un entorno no-dev, la seguridad queda comprometida.

**Impacto**:
- Riesgo de seguridad si el docker-compose se despliega tal cual en produccion.
- El secret esta en control de versiones (visible en el repo).

**Estrategia de resolucion**:
1. Mover secretos a un archivo `.env` no versionado (ya existe `.env.example` como template).
2. En docker-compose, referenciar `${JWT_SECRET}` sin valor por defecto.
3. Documentar que `.env` debe crearse manualmente a partir de `.env.example`.

**Esfuerzo**: Bajo. ~30 minutos.

---

### 8. Sin TypeScript strict mode en algunas areas

**Descripcion**: Aunque TypeScript esta configurado en los tres frontends, no todas las areas tienen `strict: true` o sus sub-flags activadas. Esto permite `any` implicitos, nulls no chequeados y otros problemas de tipado.

**Impacto**:
- Bugs de tipado que TypeScript deberia detectar pasan desapercibidos.
- Menor confianza en los tipos, reduciendo el valor de usar TypeScript.

**Estrategia de resolucion**: Activar `strict: true` progresivamente, comenzando por archivos nuevos y migrando los existentes. Usar `// @ts-expect-error` temporalmente donde sea necesario.

**Esfuerzo**: Medio. La activacion es rapida, la correccion de errores puede ser extensa.

---

### 9. Mapeo legacy de codigos de error (pwaMenu)

**Descripcion**: pwaMenu mantiene una capa de compatibilidad hacia atras para codigos de error del backend. Esto agrega complejidad al manejo de errores con mapeos que podrian no ser necesarios.

**Impacto**:
- Codigo adicional que debe mantenerse sin valor claro.
- Potencial confusion sobre cual es el formato "correcto" de errores.

**Estrategia de resolucion**: Verificar que todos los endpoints usen el formato nuevo de errores y eliminar la capa de compatibilidad.

**Esfuerzo**: Bajo. ~2-3 horas.

---

### 10. Multiples implementaciones de cliente WebSocket

**Descripcion**: Dashboard, pwaMenu y pwaWaiter tienen cada uno su propio `websocket.ts` (~500-600 lineas cada uno). Los tres implementan la misma logica base: conexion, reconexion exponencial, heartbeat ping/pong, suscripcion a eventos y manejo de errores. Las diferencias son minimas (tipo de autenticacion, eventos que escuchan).

**Impacto**:
- Bug fixes deben replicarse en tres lugares.
- Mejoras (ej: event catch-up) deben implementarse tres veces.
- Riesgo de divergencia entre implementaciones.

**Estrategia de resolucion**: Extraer la logica comun a un paquete npm compartido (`@integrador/ws-client`). Cada frontend extiende/configura el cliente base.

**Esfuerzo**: Medio. ~1 semana incluyendo refactor y tests.

---

## Prioridad BAJA

Estas deudas son mejoras de calidad de vida para el equipo o refactors que pueden esperar.

---

### 11. Sin libreria de componentes compartida entre frontends

**Descripcion**: Componentes como Button, Input, Modal, Toast, ConfirmDialog estan duplicados en los tres frontends. Cada uno tiene su propia implementacion con estilos similares pero no identicos.

**Impacto**:
- Inconsistencia visual entre las tres aplicaciones.
- Cambios de estilo o comportamiento deben hacerse en tres lugares.
- Mayor superficie de bugs.

**Estrategia de resolucion**: Crear un paquete compartido con los componentes base usando Turborepo o Nx para gestionar el monorepo. Requiere decision de tooling significativa.

**Esfuerzo**: Alto. ~2-3 semanas para setup de monorepo + migracion de componentes.

---

### 12. Mas de 25 documentos de arquitectura en la raiz

**Descripcion**: El directorio raiz contiene numerosos archivos Markdown de arquitectura, planificacion, prompts e historias de usuario. No hay organizacion clara, algunos pueden estar desactualizados y es dificil encontrar la fuente canonica de informacion.

**Impacto**:
- Developers no saben cual documento es el correcto o actual.
- Informacion contradictoria entre documentos.
- Onboarding lento por exceso de material desordenado.

**Estrategia de resolucion**: Consolidar en el directorio `knowledge-base/` (este esfuerzo). Archivar documentos obsoletos. Establecer CLAUDE.md como fuente canonica de referencia rapida.

**Esfuerzo**: Medio. Este proceso de documentacion es parte de la solucion.

---

### 13. Seed data en un solo archivo de 41KB

**Descripcion**: Los datos de seed para desarrollo estan en un unico archivo grande. No hay separacion por entidad, no hay orden de dependencias explicito, no hay forma de hacer seeding parcial.

**Impacto**:
- Dificil de mantener y modificar.
- No se puede seedear solo una entidad para testing.
- Cambios en una entidad pueden romper el seed completo.

**Estrategia de resolucion**: Dividir en archivos por entidad (`seed_tenants.py`, `seed_categories.py`, etc.) con un orquestador que respete dependencias.

**Esfuerzo**: Bajo. ~4-6 horas.

---

## Matriz de Priorizacion

| # | Deuda | Prioridad | Esfuerzo | Impacto en Produccion | Recomendacion |
|---|-------|-----------|----------|----------------------|---------------|
| 4 | Sin CI/CD | Alta | Medio | Critico | Hacer primero |
| 2 | Sin migraciones DB | Alta | Medio | Critico | Hacer primero |
| 7 | JWT_SECRET hardcoded | Media | Bajo | Alto (seguridad) | Quick win |
| 6 | VITE_API_URL inconsistente | Media | Bajo | Bajo | Quick win |
| 1 | CRUDFactory deprecado | Alta | Medio | Medio | Incremental |
| 5 | Gaps en tests | Alta | Alto | Alto | Continuo |
| 3 | Paginas placeholder | Alta | Alto | Alto (funcionalidad) | Por feature |
| 10 | WS client duplicado | Media | Medio | Medio | Pre-scaling |
| 9 | Error codes legacy | Media | Bajo | Bajo | Quick win |
| 8 | TS strict mode | Media | Medio | Bajo | Incremental |
| 13 | Seed monolitico | Baja | Bajo | Nulo | Cuando convenga |
| 12 | Docs desordenados | Baja | Medio | Nulo | En progreso |
| 11 | Sin UI components lib | Baja | Alto | Bajo | Largo plazo |

---

## Indicadores de Progreso

Para trackear la reduccion de deuda tecnica, se sugieren estos indicadores:

- **Cobertura de tests**: Target 70% lineas en codigo nuevo.
- **CRUDFactory calls**: Contar llamadas directas a CRUDFactory desde routers (target: 0).
- **CI pipeline status**: Verde/rojo en cada PR.
- **Migraciones pendientes**: Diferencia entre modelos y schema real (target: 0).
- **Paginas placeholder**: Cantidad de rutas sin implementacion (target: 0).

---

*Ultima actualizacion: Abril 2026*
