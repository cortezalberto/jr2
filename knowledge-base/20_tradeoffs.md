# 20. Tradeoffs

## Introduccion

Todo sistema de software es el resultado de decisiones que implican renuncias. No existe la solucion perfecta; existe la solucion correcta para el contexto. Este documento expone los tradeoffs mas significativos de Integrador con honestidad tecnica: que se eligio, que se sacrifico, y cuales son los riesgos latentes de cada decision.

Mientras que el documento de Decisiones Tecnicas (19) explica el POR QUE de cada eleccion, este documento se enfoca en las CONSECUENCIAS: que ganamos, que perdimos, y donde podria dolernos en el futuro.

---

## 1. Monorepo vs Polyrepo

### Se eligio: Monorepo

Todos los componentes (Dashboard, pwaMenu, pwaWaiter, backend, ws_gateway) viven en un unico repositorio.

### Lo que se gano

- **Coordinacion de cambios**: Un cambio que afecta backend y frontend se hace en un solo PR. No hay que sincronizar versiones entre repos.
- **Documentacion centralizada**: Un solo CLAUDE.md, un solo knowledge-base, una sola fuente de verdad.
- **Refactoring cross-cutting**: Renombrar un endpoint requiere cambiar backend y frontends en un solo commit atomico.
- **Onboarding simplificado**: Un `git clone` y tenes todo el proyecto.

### Lo que se perdio

- **Deploy independiente**: No se puede deployar pwaMenu sin deployar todo lo demas.
- **CI/CD granular**: Un cambio en el README ejecuta pipelines de todo el proyecto.
- **Ownership claro**: En un polyrepo, cada equipo es dueno de su repo. En un monorepo, las responsabilidades se diluyen.

### Riesgo latente

A medida que el equipo crece, los merge conflicts aumentan exponencialmente. Si el equipo supera 5-6 desarrolladores trabajando simultaneamente, considerar migrar a polyrepo o al menos implementar CODEOWNERS.

---

## 2. Multi-Tenancy a Nivel de Aplicacion vs Base de Datos

### Se eligio: Nivel de aplicacion (tenant_id en cada query)

### Lo que se gano

- **Infraestructura simple**: Una sola base de datos, un solo pool de conexiones, un solo backup.
- **Costo operativo bajo**: No hay que provisionar bases de datos por tenant.
- **Queries cross-tenant** (para analytics del SaaS) son triviales.

### Lo que se perdio

- **Seguridad por defecto**: Si un desarrollador olvida filtrar por `tenant_id`, los datos de un restaurante se exponen a otro. No hay red de seguridad a nivel de base de datos.
- **Row-Level Security**: PostgreSQL ofrece RLS que podria garantizar aislamiento a nivel de DB. No se usa por complejidad con SQLAlchemy.
- **Performance predecible**: Un tenant con millones de registros impacta a todos los demas que comparten la misma base de datos.

### Riesgo latente

La fuga de datos entre tenants es el riesgo mas critico del sistema. Un solo query sin `tenant_id` expone datos ajenos. Mitigacion actual: los Repositories (`TenantRepository`, `BranchRepository`) agregan el filtro automaticamente. Pero queries manuales con `db.execute(select(...))` no tienen esta proteccion.

### Mitigacion futura recomendada

Implementar Row-Level Security en PostgreSQL como segunda capa de defensa, incluso si la aplicacion ya filtra por tenant_id.

---

## 3. Entrega de Eventos: Garantizada vs Best-Effort

### Se eligio: Hibrido (Outbox para criticos, Redis directo para no criticos)

### Lo que se gano

- **Confiabilidad donde importa**: Los eventos financieros (pagos, facturacion) nunca se pierden. La tabla outbox garantiza persistencia.
- **Velocidad donde importa**: Los eventos de carrito y estado de mesa se entregan en ~1ms via Redis directo.
- **Pragmatismo**: No se sobre-ingenieria para eventos que son tolerantes a perdida.

### Lo que se perdio

- **Simplicidad conceptual**: El equipo debe entender DOS patrones de eventos y saber cuando usar cada uno.
- **Consistencia**: Hay una tabla de referencia (en CLAUDE.md) que define que patron usa cada evento. Si un nuevo evento se clasifica mal, las consecuencias dependen de la direccion del error.

### Riesgo latente

| Clasificacion erronea | Consecuencia |
|----------------------|--------------|
| Evento critico tratado como best-effort | Perdida de datos financieros si Redis falla |
| Evento no critico tratado como outbox | Latencia innecesaria, tabla outbox crece |

### Criterio para clasificar eventos nuevos

Preguntarse: "Si este evento se pierde, hay consecuencia financiera o legal?" Si la respuesta es si, va por outbox. Si no, Redis directo.

---

## 4. Identidad de Clientes: Sesion vs Cuenta

### Se eligio: Sesion (table token, sin login para clientes)

### Lo que se gano

- **Friccion cero**: El cliente escanea un QR y empieza a pedir. No hay registro, no hay password, no hay verificacion de email. La barrera de entrada es la mas baja posible.
- **Privacidad por defecto**: No se recolectan datos personales sin consentimiento explicito.
- **Simplicidad tecnica**: Un HMAC token de 3 horas es mucho mas simple que un sistema completo de gestion de cuentas.

### Lo que se perdio

- **Historial de pedidos**: El cliente no puede ver que pidio en visitas anteriores. No hay "pedir lo mismo de siempre".
- **Marketing directo**: No hay email ni telefono para enviar promociones o pedir resenas.
- **Programa de fidelidad**: Sin identidad persistente, no hay forma de acumular puntos o beneficios.

### Riesgo latente

Cuando se implemente el programa de fidelidad (Phase 4 del roadmap), la migracion de sesiones anonimas a cuentas identificadas sera compleja. Hay que vincular `device_id` historicos con cuentas nuevas respetando GDPR.

### Roadmap de mitigacion

| Fase | Capacidad |
|------|-----------|
| Fase 1 (actual) | Device tracking anonimo via `device_id` |
| Fase 2 | Preferencias implicitas sincronizadas al device |
| Fase 3 | Analisis de comportamiento agregado (sin PII) |
| Fase 4 | Opt-in del cliente con consentimiento GDPR |

---

## 5. Gateway WebSocket Centralizado vs Distribuido

### Se eligio: Gateway centralizado unico

### Lo que se gano

- **Una conexion por cliente**: El frontend mantiene un solo WebSocket. No tiene que manejar reconexion a multiples servicios.
- **Enrutamiento centralizado**: La logica de "a quien va este evento" esta en un solo lugar. Facil de auditar y modificar.
- **Autenticacion unificada**: Un solo punto valida tokens (JWT y table tokens).

### Lo que se perdio

- **Single point of failure**: Si el Gateway cae, TODA la comunicacion en tiempo real se pierde. No hay fallback.
- **Escalado por tipo de evento**: No se puede escalar el procesamiento de eventos de cocina independientemente de los de carrito.
- **Blast radius**: Un bug en el manejo de eventos de carrito puede afectar notificaciones de cocina.

### Riesgo latente

Con 1000+ conexiones simultaneas en un solo restaurante grande, el Gateway puede convertirse en cuello de botella. El worker pool mitiga esto parcialmente, pero hay un limite fisico en una sola instancia.

### Mitigacion futura

Implementar sticky sessions con load balancer para correr multiples instancias del Gateway. Redis Streams ya permite esta arquitectura (multiples consumers en el mismo consumer group).

---

## 6. Offline-First en pwaWaiter

### Se eligio: Offline-first con cola de retry

### Lo que se gano

- **Continuidad operativa**: El mozo puede seguir tomando pedidos durante caidas momentaneas de WiFi. Las acciones se encolan y se envian cuando la conexion se restaura.
- **Experiencia predecible**: La app nunca muestra "Sin conexion, intente mas tarde". Simplemente encola y reintenta.

### Lo que se perdio

- **Complejidad de sincronizacion**: Cuando la conexion vuelve, las acciones encoladas pueden conflictuar con cambios que otros hicieron online.
- **Datos potencialmente stale**: Durante el periodo offline, el mozo ve datos que pueden ya no ser validos (una mesa que otro mozo ya cerro).
- **Ordering de eventos**: Las acciones encoladas se ejecutan en orden FIFO, pero el estado del servidor puede haber cambiado entre el momento de la accion y su ejecucion.

### Riesgo latente

Un mozo offline durante 5 minutos podria enviar un pedido a una mesa que ya cerro. El backend debe validar y rechazar gracefully, y el frontend debe manejar ese rechazo de forma comprensible.

### Mitigacion actual

El backend valida el estado de la sesion de mesa antes de aceptar acciones. Si la sesion ya no es valida, retorna un error especifico que el frontend traduce a un mensaje claro.

---

## 7. React 19 Bleeding Edge vs React 18 Estable

### Se eligio: React 19 con Compiler

### Lo que se gano

- **Performance automatica**: El compilador optimiza renders sin intervencion del desarrollador. Menos bugs de performance.
- **APIs modernas**: `useActionState`, `useOptimistic` simplifican patrones comunes.
- **Preparacion para el futuro**: No hay deuda tecnica de migracion acumulandose.

### Lo que se perdio

- **Estabilidad probada**: React 18 tiene anos de uso en produccion. React 19 tiene meses.
- **Soporte de ecosistema**: Algunas librerias pueden no funcionar correctamente con React 19 o el compilador.
- **Documentacion y tutoriales**: La mayoria del contenido educativo asume React 18.

### Riesgo latente

Si una libreria critica resulta incompatible con React 19 o el compilador, la unica opcion es: (a) esperar a que la actualicen, (b) hacer un fork, o (c) desactivar el compilador para esa parte del codigo.

---

## 8. PostgreSQL + pgvector vs Base de Datos Vectorial Dedicada

### Se eligio: pgvector como extension de PostgreSQL

### Lo que se gano

- **Una sola base de datos**: No hay otro servicio que administrar, monitorear o backupear.
- **SQL familiar**: Las consultas vectoriales se integran con JOINs, WHEREs y todo el poder de SQL.
- **Transaccionalidad**: Los embeddings participan en transacciones ACID junto con los datos de negocio.

### Lo que se perdio

- **Rendimiento a escala**: Bases de datos especializadas como Pinecone, Weaviate o Qdrant son significativamente mas rapidas para millones de vectores.
- **Funcionalidades avanzadas**: Busqueda hibrida (vectorial + keyword), re-ranking, clustering nativo.
- **Indices optimizados**: pgvector soporta IVFFlat y HNSW, pero las DBs especializadas tienen mas opciones de indexacion.

### Riesgo latente

Si las funcionalidades de IA escalan (busqueda semantica de productos, recomendaciones personalizadas, analisis de feedback), pgvector podria no alcanzar la performance necesaria. La migracion a una DB vectorial dedicada requeriria reestructurar toda la capa de embeddings.

### Umbral para migrar

Si la cantidad de vectores supera 1 millon o las consultas vectoriales exceden 50ms p99, evaluar migracion a DB especializada.

---

## 9. HttpOnly Cookies vs localStorage para Refresh Tokens

### Se eligio: HttpOnly Cookies

### Lo que se gano

- **Inmunidad a XSS**: JavaScript no puede leer cookies HttpOnly. Un ataque XSS no puede robar el refresh token.
- **Estandar de seguridad**: Es la recomendacion de OWASP para almacenamiento de tokens sensibles.
- **Envio automatico**: El navegador incluye la cookie automaticamente en cada request (con `credentials: 'include'`).

### Lo que se perdio

- **Vulnerabilidad a CSRF**: Las cookies se envian automaticamente, lo que habilita ataques Cross-Site Request Forgery. Mitigado con header `X-Requested-With`.
- **Complejidad de CORS**: `credentials: 'include'` requiere configuracion CORS explicita. No se puede usar wildcard (`*`) en `Access-Control-Allow-Origin`.
- **Depuracion mas dificil**: Las cookies HttpOnly no aparecen en `document.cookie` ni en la consola del navegador. Hay que usar DevTools > Application > Cookies.

### Riesgo latente

En produccion con multiples subdominios (admin.buensabor.com, menu.buensabor.com), la configuracion de cookies requiere `SameSite`, `Domain` y `Path` correctos. Una mala configuracion puede causar que las cookies no se envien o se envien a dominios incorrectos.

---

## 10. Dark Theme Unico vs Toggle de Temas

### Se eligio: Dark theme como unico tema

### Lo que se gano

- **CSS simplificado**: Un solo set de colores. No hay variables duplicadas, no hay `prefers-color-scheme` media queries.
- **Diseno consistente**: El equipo de diseno trabaja con una sola paleta. No hay que validar cada componente en dos modos.
- **Desarrollo mas rapido**: Cada componente se disena y testea una sola vez.

### Lo que se perdio

- **Preferencia del usuario**: Algunos usuarios prefieren modo claro, especialmente para uso prolongado o en ambientes muy iluminados.
- **Accesibilidad**: El contraste de texto en temas oscuros puede ser problematico para personas con ciertas condiciones visuales.
- **Legibilidad al aire libre**: Las pantallas con tema oscuro son mas dificiles de leer bajo luz solar directa.

### Riesgo latente

Si un restaurante con terraza al aire libre adopta el sistema, los mozos pueden tener dificultades para leer pwaWaiter bajo el sol. Esto no tiene solucion tecnica sin implementar un modo claro.

### Mitigacion futura

Si la demanda lo justifica, implementar CSS custom properties (variables) con toggle. La arquitectura con Tailwind CSS facilita esto, pero requiere revalidar todos los componentes.

---

## Matriz Resumen de Riesgos

| Tradeoff | Impacto si sale mal | Probabilidad | Severidad | Mitigacion |
|----------|---------------------|-------------|-----------|------------|
| Monorepo | Merge conflicts, deploy acoplado | Media (crece con equipo) | Media | CODEOWNERS, CI selectivo |
| App-level multi-tenancy | Fuga de datos entre tenants | Baja (repos filtran) | Critica | RLS como segunda capa |
| Hibrido outbox/Redis | Evento critico perdido | Baja | Alta | Tabla de clasificacion clara |
| Sesion sin cuenta | No hay fidelizacion | Segura (by design) | Media | Phase 4 del roadmap |
| Gateway centralizado | SPOF en tiempo real | Media | Alta | Sticky sessions + replicas |
| Offline-first pwaWaiter | Conflictos de sincronizacion | Media | Media | Validacion server-side |
| React 19 bleeding edge | Incompatibilidad de libreria | Baja-Media | Media | Fallback a desactivar compiler |
| pgvector vs DB especializada | Performance insuficiente para IA | Baja (escala actual) | Baja | Umbral definido para migrar |
| HttpOnly cookies | Problemas CORS multi-dominio | Media (en prod) | Media | Testing exhaustivo pre-deploy |
| Solo dark theme | Ilegibilidad al aire libre | Baja-Media | Baja | Implementar toggle si hay demanda |

---

## Conclusion

Ningun tradeoff es permanente. Cada decision puede reevaluarse cuando el contexto cambie: el equipo crezca, el volumen de datos aumente, o los requisitos de negocio evolucionen. Lo importante es que cada decision fue tomada conscientemente, documentada con sus riesgos, y con un plan de mitigacion identificado.

El peor tradeoff es el que se hace sin saberlo. Este documento existe para que eso no ocurra.
