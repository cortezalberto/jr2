# 23. Evaluacion de Riesgos

> Analisis de riesgos tecnico y operativo del sistema Integrador / Buen Sabor, clasificado por severidad con probabilidad de ocurrencia, impacto y estrategias de mitigacion.

---

## Riesgos CRITICOS

Riesgos que, de materializarse, podrian causar indisponibilidad total del sistema o perdida de datos irrecuperable.

---

### 1. Punto Unico de Falla: WebSocket Gateway

**Descripcion**: El WS Gateway corre como instancia unica. Si el proceso cae, se reinicia o el servidor se apaga, TODA la funcionalidad en tiempo real se detiene simultaneamente: notificaciones a mozos, tickets de cocina, sincronizacion de carritos y actualizaciones de estado de mesas.

**Probabilidad**: Media. Un solo proceso en Node.js/Python puede fallar por memory leaks, excepciones no capturadas, o actualizaciones del SO.

**Impacto**: Critico. El restaurante pierde la capacidad de operar digitalmente. Los mozos no reciben pedidos, la cocina no ve tickets, los comensales no pueden confirmar rondas. El servicio se degrada a operacion manual con papel.

**Mitigaciones existentes**:
- Health checks que permiten deteccion rapida de caida.
- Circuit breaker para Redis que evita cascadas.
- Docker restart policy para recuperacion automatica.

**Mitigaciones necesarias**:
- Escalado horizontal con al menos 2 instancias detras de un load balancer.
- Sticky sessions o Redis Pub/Sub para sincronizar estado entre instancias.
- Degradacion elegante en frontends: mostrar banner "modo offline" y usar polling como fallback.
- Alertas automaticas (PagerDuty, Slack webhook) ante caida del servicio.

---

### 2. Fuga de Datos entre Tenants

**Descripcion**: El sistema es multi-tenant pero la separacion es a nivel de aplicacion unicamente. Cada query debe incluir `tenant_id` como filtro. Si un endpoint o query omite este filtro, los datos de un tenant podrian ser visibles para otro.

**Probabilidad**: Baja. El patron `PermissionContext` y los repositories filtran por tenant de manera consistente. Pero "baja" no es "cero" — un nuevo endpoint desarrollado sin cuidado podria omitir el filtro.

**Impacto**: Critico. Exposicion de menus, precios, datos de clientes y facturacion de un restaurante a otro. Implicaciones legales y de confianza devastadoras.

**Mitigaciones existentes**:
- `PermissionContext` centraliza la verificacion de tenant y branch.
- `TenantRepository` y `BranchRepository` incluyen `tenant_id` automaticamente.
- Domain Services heredan filtrado de sus clases base.

**Mitigaciones necesarias**:
- Tests automatizados que verifiquen aislamiento de tenant (crear datos en tenant A, verificar que no aparezcan en queries de tenant B).
- Row-Level Security (RLS) en PostgreSQL como defensa en profundidad.
- Revision obligatoria de seguridad en PRs que toquen queries o endpoints.
- Logging de acceso con `tenant_id` para deteccion de anomalias.

---

### 3. Sin Backup ni Recuperacion

**Descripcion**: No existe procedimiento automatizado ni documentado de backup y restore de la base de datos PostgreSQL. No hay snapshots periodicos, no hay exportacion a almacenamiento externo, no hay plan de recuperacion ante desastres (DRP).

**Probabilidad**: La probabilidad de necesitar un backup depende del entorno. En desarrollo es baja. En produccion es practicamente una certeza a lo largo del tiempo (falla de hardware, error humano, corrupcion).

**Impacto**: Critico. Perdida total e irrecuperable de datos: menus, precios, configuracion de sucursales, historial de ventas, datos de clientes.

**Mitigaciones existentes**: Ninguna.

**Mitigaciones necesarias**:
- `pg_dump` automatizado (diario como minimo, cada hora ideal) con almacenamiento en S3/GCS.
- Write-Ahead Log (WAL) archiving para point-in-time recovery (PITR).
- Procedimiento de restore documentado y testeado periodicamente.
- Definir RPO (Recovery Point Objective) y RTO (Recovery Time Objective) con el product owner.
- Monitoreo de que los backups se ejecutan correctamente.

---

## Riesgos ALTOS

Riesgos que causarian degradacion significativa del servicio o exposicion de seguridad.

---

### 4. Compromiso del JWT Secret

**Descripcion**: Si el `JWT_SECRET` es descubierto (leak en logs, en repositorio, acceso al servidor), un atacante puede generar tokens JWT validos para cualquier usuario, incluyendo ADMIN.

**Probabilidad**: Baja. El secret esta en variable de entorno, no en codigo. Pero el docker-compose de desarrollo lo incluye en texto plano.

**Impacto**: Alto. Compromiso total de autenticacion. El atacante puede: acceder como admin, modificar precios, borrar datos, acceder a datos de todos los tenants.

**Mitigaciones existentes**:
- Token blacklist en Redis para revocar tokens comprometidos.
- Tokens de acceso con expiracion corta (15 minutos).
- Refresh tokens en HttpOnly cookies (no accesibles via JavaScript).

**Mitigaciones necesarias**:
- Estrategia de rotacion de secrets (cambiar JWT_SECRET sin invalidar todos los tokens activos).
- Mover secrets a un gestor (AWS Secrets Manager, HashiCorp Vault, doppler).
- Eliminar JWT_SECRET hardcodeado del docker-compose de desarrollo.
- Monitoreo de patrones de autenticacion anomalos.

---

### 5. Falla en Cascada de Redis

**Descripcion**: Redis es un componente critico que sirve multiples funciones: token blacklist, publicacion de eventos WebSocket, rate limiting y cache. Si Redis cae, multiples subsistemas fallan simultaneamente.

**Probabilidad**: Media. Redis es single instance. Puede fallar por memoria insuficiente, disco lleno o falla de red.

**Impacto**: Alto, con comportamiento variado:
- **Token blacklist falla (fail-closed)**: TODOS los tokens son rechazados. Nadie puede autenticarse.
- **Eventos WebSocket se detienen**: Tiempo real deja de funcionar.
- **Rate limiting se detiene**: Endpoints quedan sin proteccion contra abuso.

**Mitigaciones existentes**:
- Circuit breaker en el WS Gateway para Redis.
- Patron fail-closed en token blacklist (seguro pero disruptivo).

**Mitigaciones necesarias**:
- Redis Sentinel para alta disponibilidad con failover automatico.
- O Redis Cluster para distribucion de carga.
- Estrategia de fallback para auth: si Redis no responde, verificar solo la firma JWT (fail-open temporal con logging intensivo).
- Separar Redis en instancias por funcion (cache vs. eventos vs. auth) para evitar que una falla afecte todo.

---

### 6. Errores de Despliegue por Falta de CI/CD

**Descripcion**: Cada despliegue es un proceso manual. No hay validacion automatica de que los tests pasen, el build sea exitoso, las migraciones esten aplicadas o la configuracion sea correcta antes de subir a produccion.

**Probabilidad**: Alta. Cada despliegue manual es una oportunidad de error humano.

**Impacto**: Alto. Codigo roto en produccion afecta a todos los usuarios. Rollback es manual y lento. No hay staging environment para validar.

**Mitigaciones existentes**: Ninguna formal.

**Mitigaciones necesarias**:
- Pipeline de CI con GitHub Actions (lint, typecheck, test, build).
- Branch protection: merge requiere CI verde.
- Ambiente de staging identico a produccion.
- Deploy automatizado con rollback automatico ante falla de health check.

---

### 7. Perdida de Eventos en Tiempo Real durante Reconexion

**Descripcion**: Cuando un cliente WebSocket pierde conexion (cambio de WiFi a datos moviles, intermitencia de red), los eventos emitidos durante la ventana de desconexion se pierden. No hay mecanismo de catch-up ni buffer de eventos para reconexion.

**Probabilidad**: Media. En un entorno de restaurante, los dispositivos moviles cambian de red frecuentemente (WiFi del local, zonas con mala cobertura).

**Impacto**: Alto. Un mozo puede perder una llamada de servicio (un cliente esperando). La cocina puede perder un pedido (demora en preparacion). Un comensal puede no enterarse de que su pedido esta listo.

**Mitigaciones existentes**:
- Cola de reintentos en pwaWaiter para eventos salientes.
- Refresh periodico de datos de mesa cada 60 segundos.
- Reconexion automatica con backoff exponencial.

**Mitigaciones necesarias**:
- Sequence numbers en eventos para detectar gaps.
- Endpoint de catch-up: al reconectar, el cliente envia el ultimo event_id recibido y obtiene los faltantes.
- O Redis Streams con consumer groups para entrega garantizada.
- Notificaciones sonoras/vibracion para eventos criticos como fallback de atencion.

---

## Riesgos MEDIOS

Riesgos que causarian degradacion parcial o limitaciones operativas.

---

### 8. Techo de Escalabilidad

**Descripcion**: La arquitectura de instancia unica (WS Gateway, backend, Redis) tiene un limite natural de conexiones concurrentes. Las estimaciones sugieren ~500-1000 conexiones WebSocket por instancia.

**Probabilidad**: Depende del crecimiento. Para un restaurante individual, es improbable. Para un tenant con 10+ sucursales operando simultaneamente, es plausible.

**Impacto**: Medio. Degradacion de rendimiento (latencia creciente, eventos retrasados) antes del fallo total.

**Mitigaciones existentes**:
- Worker pool con 10 workers paralelos para broadcast.
- Sharded locks por branch para reducir contention.
- Optimizaciones de broadcast (~160ms para 400 usuarios, no verificado bajo carga real).

**Mitigaciones necesarias**:
- Load testing para establecer limites reales (no teoricos).
- Plan de escalado horizontal documentado.
- Metricas de conexiones activas con alertas de umbral.

---

### 9. Dependencia de Mercado Pago

**Descripcion**: La unica integracion de pago digital es Mercado Pago. Si MP experimenta una caida o cambia su API, no hay alternativa automatica.

**Probabilidad**: Baja. Mercado Pago tiene alta disponibilidad. Pero las caidas ocasionales son inevitables en cualquier servicio externo.

**Impacto**: Medio. Los pagos digitales dejan de funcionar. El restaurante puede continuar con pagos en efectivo/tarjeta manual (ya soportado en el sistema como "pago manual").

**Mitigaciones existentes**:
- Registro de pagos manuales (efectivo, tarjeta, transferencia) como alternativa.
- El flujo de facturacion no depende exclusivamente de MP.

**Mitigaciones necesarias**:
- Abstraccion de payment gateway (Strategy pattern) para soportar multiples proveedores.
- Monitoreo del estado de la API de MP con fallback automatico a modo manual.
- Notificacion al staff cuando MP esta caido.

---

### 10. Friccion de Desarrollo en Windows

**Descripcion**: El entorno de desarrollo principal es Windows, lo que genera problemas recurrentes: `StatReload` de uvicorn falla, `PYTHONPATH` requiere sintaxis de PowerShell, separadores de ruta, `uvicorn` no esta en PATH.

**Probabilidad**: Alta. Todos los desarrolladores en Windows experimentan estos problemas.

**Impacto**: Medio. Tiempo perdido en setup y debugging de entorno. Frustration del equipo. Posibles bugs sutiles por diferencias de OS.

**Mitigaciones existentes**:
- DevContainer configurado como alternativa.
- Workarounds documentados en CLAUDE.md.
- `watchfiles` como alternativa a `StatReload`.

**Mitigaciones necesarias**:
- Guia de setup paso a paso especifica para Windows.
- Scripts de inicializacion que detecten el OS y configuren automaticamente.
- Considerar WSL2 como entorno recomendado para desarrollo backend.

---

## Matriz de Riesgos

```
                    IMPACTO
              Bajo    Medio    Alto    Critico
         ┌─────────┬─────────┬─────────┬─────────┐
  Alta   │         │   10    │    6    │         │
         ├─────────┼─────────┼─────────┼─────────┤
P Media  │         │    8    │   5,7   │   1     │
R        ├─────────┼─────────┼─────────┼─────────┤
O Baja   │         │    9    │    4    │   2,3   │
B        ├─────────┼─────────┼─────────┼─────────┤
         │         │         │         │         │
         └─────────┴─────────┴─────────┴─────────┘
```

---

## Plan de Accion por Prioridad

| Prioridad | Riesgo | Accion Inmediata |
|-----------|--------|------------------|
| 1 | Sin Backup (#3) | Configurar `pg_dump` automatizado + storage externo |
| 2 | Sin CI/CD (#6) | GitHub Actions basico (lint, test, build) |
| 3 | JWT Secret (#4) | Eliminar del docker-compose, usar `.env` |
| 4 | Tenant Isolation (#2) | Tests automatizados de aislamiento |
| 5 | WS Gateway SPOF (#1) | Health checks + alertas + plan de scaling |
| 6 | Redis Cascade (#5) | Evaluar Redis Sentinel |
| 7 | Event Loss (#7) | Implementar sequence numbers |
| 8 | Windows Friction (#10) | Guia de WSL2 + scripts de setup |
| 9 | Scaling (#8) | Load testing para establecer baseline |
| 10 | MP Dependency (#9) | Abstraccion de payment gateway |

---

*Ultima actualizacion: Abril 2026*
