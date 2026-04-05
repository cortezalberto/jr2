# 30. Inconsistencias Detectadas entre Documentacion y Codigo

> Registro de todas las inconsistencias encontradas entre la documentacion del proyecto
> (CLAUDE.md, sub-project CLAUDE.md, README.md) y el comportamiento real del codigo.
>
> Ultima actualizacion: 2026-04-04

---

## Resumen

| # | Inconsistencia | Severidad | Estado |
|---|----------------|-----------|--------|
| 1 | "Customers can still order during PAYING" | CRITICA | CORREGIDO |
| 2 | "No test framework is configured" en pwaMenu | ALTA | CORREGIDO |
| 3 | SharedCart descrito como "multi-device sync" | MEDIA | CORREGIDO |
| 4 | VITE_API_URL inconsistente entre frontends | BAJA | DOCUMENTADA |
| 5 | SessionStatus.ACTIVE incluia PAYING | CRITICA | CORREGIDO |
| 6 | FSM duplicado en kitchen router | ALTA | CORREGIDO |
| 7 | RoundItem sin snapshot de nombre de producto | MEDIA | CORREGIDO |

---

## 1. "Customers can still order during PAYING" -- CORREGIDO (2026-04-04)

**Severidad:** CRITICA (afecta logica de negocio de facturacion)

**Que decia la documentacion:**
CLAUDE.md, seccion "Table Session Lifecycle":
> `OPEN` -> `PAYING` -> `CLOSED`. Customers can still order during PAYING.

**Que se descubrio:**
Esto era un **BUG**, no un feature. El Product Owner confirmo que NO se puede pedir durante el estado PAYING. Permitir pedidos durante PAYING genera inconsistencias en la facturacion: un check ya generado no incluiria los items nuevos.

**Archivos corregidos:**
- `backend/rest_api/services/domain/round_service.py` -- validacion que impide crear rondas si la sesion esta en PAYING
- `backend/shared/config/constants.py` -- se agrego `ORDERABLE = [OPEN]` para distinguir "sesion viva" de "puede pedir"
- `pwaMenu/src/stores/tableStore/store.ts` -- bloqueo de acciones de carrito en PAYING
- `pwaMenu/src/components/cart/SharedCart.tsx` -- UI bloqueada con mensaje explicativo
- `pwaMenu/src/components/menu/ProductDetailModal.tsx` -- boton "Agregar" deshabilitado en PAYING
- `pwaMenu/src/pages/Home.tsx` -- banner informativo cuando sesion esta en PAYING
- `pwaMenu/src/components/layout/BottomNav.tsx` -- badge visual en carrito bloqueado

**Correccion en documentacion:**
CLAUDE.md actualizado para reflejar que durante PAYING solo se puede ver el menu pero no agregar items.

---

## 2. "No test framework is configured" en pwaMenu -- CORREGIDO (2026-04-04)

**Severidad:** ALTA (documentacion contradice la realidad del proyecto)

**Que decia la documentacion:**
`pwaMenu/CLAUDE.md` indicaba que no habia framework de testing configurado.

**Que se descubrio:**
pwaMenu tiene **Vitest completamente configurado** con al menos 5 test suites funcionales:
- `pwaMenu/vitest.config.ts` -- configuracion de Vitest
- `pwaMenu/src/**/*.test.ts` -- archivos de test existentes
- `pwaMenu/package.json` -- scripts `test` y `test:run` configurados

**Comandos reales:**
```bash
cd pwaMenu && npm run test:run    # Ejecucion unica (CI)
cd pwaMenu && npm test            # Modo watch (desarrollo)
```

**Correccion en documentacion:**
- `pwaMenu/CLAUDE.md` actualizado con comandos de test reales
- CLAUDE.md raiz ya tenia los comandos correctos en la seccion "Run Tests"

---

## 3. SharedCart descrito como "multi-device cart sync" -- CORREGIDO (2026-04-04)

**Severidad:** MEDIA (genera expectativas incorrectas sobre la arquitectura)

**Que decia la documentacion:**
CLAUDE.md, seccion "Shared Cart (pwaMenu)":
> Multi-device cart sync via WebSocket. All diners' items combined in one round when submitted.

**Que se descubrio:**
El carrito es **per-device** (almacenado en localStorage/estado local), NO se sincroniza entre dispositivos via WebSocket. Lo que SI se sincroniza via WebSocket es:
- Estado de las rondas (PENDING -> CONFIRMED -> SUBMITTED -> etc.)
- Notificaciones cuando otros diners envian una ronda
- Estado de la sesion y la mesa

El "shared" del nombre `SharedCart` se refiere a que multiples diners en la misma mesa **comparten la vista de rondas enviadas**, no que el carrito se sincronize en tiempo real.

**Correccion en documentacion:**
CLAUDE.md actualizado para clarificar que el carrito es local por dispositivo y que WebSocket sincroniza rondas, no el carrito.

---

## 4. VITE_API_URL inconsistente entre frontends -- DOCUMENTADA, NO CORREGIDA

**Severidad:** BAJA (funciona correctamente, pero genera confusion en onboarding)

**Inconsistencia:**
```bash
# Dashboard/.env.example
VITE_API_URL=http://localhost:8000          # SIN /api

# pwaMenu/.env.example
VITE_API_URL=http://localhost:8000/api      # CON /api

# pwaWaiter/.env.example
VITE_API_URL=http://localhost:8000/api      # CON /api
```

**Por que existe:**
Dashboard construye las URLs de API de forma diferente internamente. Sus servicios agregan el prefijo `/api` en el codigo, mientras que pwaMenu y pwaWaiter esperan que la variable de entorno ya lo incluya.

**Impacto:**
- Desarrolladores nuevos que copian la configuracion de un frontend a otro obtienen errores 404
- El troubleshooting no es obvio porque el error es silencioso (404 en requests)

**Estado:**
Agregada como nota en la seccion "Common Issues" de CLAUDE.md. No se corrigio la inconsistencia en el codigo porque requeriria modificar los servicios API de uno de los frontends y actualizar todos los entornos desplegados.

**Recomendacion futura:**
Unificar la convencion. Preferible que TODOS usen `VITE_API_URL=http://localhost:8000` (sin `/api`) y que los servicios agreguen el prefijo internamente, que es el patron mas robusto.

---

## 5. SessionStatus.ACTIVE incluia PAYING -- CORREGIDO (2026-04-04)

**Severidad:** CRITICA (directamente relacionada con inconsistencia #1)

**Que existia en el codigo:**
```python
# backend/shared/config/constants.py (ANTES)
class SessionStatus:
    ACTIVE = [OPEN, PAYING]  # Usado para validar si una sesion permite operaciones
```

**Problema:**
`ACTIVE` se usaba indistintamente para dos propositos:
1. "La sesion existe y no esta cerrada" (para mostrar informacion, verificar acceso)
2. "Se pueden agregar items al carrito" (para validar creacion de rondas)

Al incluir PAYING en ACTIVE, el round_service permitia crear rondas durante PAYING.

**Correccion:**
```python
# backend/shared/config/constants.py (DESPUES)
class SessionStatus:
    ACTIVE = [OPEN, PAYING]      # Sesion viva (para consultas generales)
    ORDERABLE = [OPEN]           # Sesion que permite pedidos (para validacion de rondas)
```

**Archivos afectados:**
- `backend/shared/config/constants.py` -- nueva constante `ORDERABLE`
- `backend/rest_api/services/domain/round_service.py` -- usa `ORDERABLE` en vez de `ACTIVE` para validar creacion de rondas

---

## 6. FSM duplicado en kitchen router -- CORREGIDO (2026-04-04)

**Severidad:** ALTA (riesgo de divergencia entre dos fuentes de verdad)

**Que existia en el codigo:**
```python
# backend/rest_api/routers/kitchen/rounds.py (ANTES)
ALLOWED_TRANSITIONS = {
    "SUBMITTED": ["IN_KITCHEN"],
    "IN_KITCHEN": ["READY"],
    "READY": ["SERVED"],
}
# Diccionario inline que duplicaba la logica de constants.py
```

**Problema:**
El router de kitchen tenia su propia copia del mapa de transiciones que podia divergir de `ROUND_TRANSITIONS` en `constants.py`. Si alguien modificaba las transiciones permitidas en constants.py, el router de kitchen seguiria usando las suyas propias.

**Correccion:**
Se reemplazo el diccionario inline con la funcion centralizada:
```python
# backend/rest_api/routers/kitchen/rounds.py (DESPUES)
from shared.config.constants import validate_round_transition, ROUND_TRANSITION_ROLES
# Usa validate_round_transition() en vez de dict local
```

**Archivos afectados:**
- `backend/rest_api/routers/kitchen/rounds.py` -- eliminado dict inline, usa `validate_round_transition()`
- `backend/shared/config/constants.py` -- funcion `validate_round_transition()` como unica fuente de verdad

---

## 7. RoundItem sin snapshot de nombre de producto -- CORREGIDO (2026-04-04)

**Severidad:** MEDIA (afecta integridad de datos historicos)

**Que existia en el codigo:**
El modelo `RoundItem` capturaba `unit_price_cents` como snapshot al momento de crear el pedido, pero NO capturaba el nombre del producto. Si un producto se renombraba o eliminaba (soft delete) despues de un pedido, la informacion se perdia.

**Problema:**
- Tickets de cocina mostraban el nombre actual del producto, no el nombre al momento del pedido
- Productos eliminados (soft delete) aparecian como "Producto no encontrado" en pedidos historicos
- Reportes de ventas perdian precision historica

**Correccion:**
```python
# backend/rest_api/models/round.py (DESPUES)
class RoundItem(AuditMixin, Base):
    unit_price_cents = Column(Integer, nullable=False)    # Ya existia
    product_name = Column(String(255), nullable=True)     # NUEVO - snapshot del nombre
```

**Archivos afectados:**
- `backend/rest_api/models/round.py` -- campo `product_name` agregado (nullable para compatibilidad con datos existentes)
- `backend/rest_api/services/domain/round_service.py` -- captura `product_name` al crear RoundItem
- Migracion Alembic generada para agregar la columna

**Nota:** El campo es `nullable=True` porque los RoundItems existentes previos a la correccion no tienen el dato. Los nuevos siempre lo incluyen.

---

## Lecciones Aprendidas

1. **La documentacion debe ser fuente de verdad, no aspiracion.** Las inconsistencias #1 y #3 existieron porque la documentacion describia el comportamiento deseado, no el real.

2. **FSM deben tener una unica fuente de verdad.** La inconsistencia #6 demuestra el riesgo de duplicar logica de transiciones de estado.

3. **Snapshot Pattern debe ser explicito y completo.** La inconsistencia #7 muestra que capturar solo el precio pero no el nombre era un snapshot incompleto.

4. **Las variables de entorno deben seguir convenciones uniformes.** La inconsistencia #4 genera friccion innecesaria en el onboarding.

5. **Los tests existentes deben estar documentados.** La inconsistencia #2 podia haber llevado a que alguien configurara un framework de testing duplicado.
