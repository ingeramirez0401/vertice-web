# VÉRTICE — Plan de conversión a herramienta de campaña

> Documento de estrategia y alcance. De *red de adhesión viral* (métrica de vanidad)
> a *máquina electoral verificable* (herramienta de decisión).
> Contexto: candidatura a **Gobernación** (Colombia: Registraduría/CNE, municipios,
> puestos y mesas de votación, testigos electorales, E-14).

---

## 1. Resumen ejecutivo

Hoy VÉRTICE muestra una red creciendo en tiempo real y gamifica el reclutamiento.
Para el candidato eso es **momentum y percepción**, pero todavía no responde sus tres
miedos reales:

1. *¿Esto son votos REALES?* → no hay cédula ni verificación.
2. *¿DÓNDE están esos votos?* → la malla es abstracta; él piensa en municipios y mesas.
3. *¿Me mienten mis líderes?* → no hay metas ni cumplimiento (el "líder fantasma").

**Fase 1 (Inteligencia Electoral)** es el mínimo que transforma "qué lindo" en "lo
necesito": captura datos reales, georreferencia la red sobre el territorio, verifica, y
le da al candidato un **tablero de votos verificados por municipio**.

---

## 2. Estado actual — qué hay (línea base)

**Producto**
- Red mesh viral: un padre / muchos hijos, alta por link `/unirse/[code]`.
- Visualización canvas en tiempo real (radial / árbol / orgánico), pinch-zoom, móvil nativo.
- Perfil gamificado: niveles, logros, retos, share (WhatsApp/Telegram).
- Realtime de altas (Supabase channel sobre `vtx_members`).

**Datos (`db/01..03`)**
- `vtx_members`: `id, user_id, parent_id, adhesion_code, full_name, role, status,
  region, path (ltree), depth, child_count, subtree_size, created_at`.
- Árbol con `ltree` (path materializado), triggers que mantienen `depth`,
  `child_count`, `subtree_size`.
- RPCs: `vtx_join_with_code`, `vtx_inviter_preview`, `vtx_role_for_depth`,
  `vtx_ancestors_of`, `vtx_descendants_of`.
- Rol derivado de `depth`: Candidato → Coordinador General → Líder Zonal → Líder de
  Barrio → Promotor → Simpatizante.
- Seed: candidato raíz `Alejandro Marín` + ~200 miembros de prueba aleatorios.

**Lo que falta para vender:** todo lo electoral. La red no sabe quién es real, dónde
vota, ni qué prometió cada líder.

---

## 3. Tesis de conversión

| Miedo del candidato | Hoy | Fase que lo resuelve |
|---|---|---|
| ¿Son votos reales? | Un nodo = un correo | **F1** verificación + cédula |
| ¿Dónde están? | Malla abstracta | **F1** georreferenciación |
| ¿Me mienten? | Sin metas | **F2** metas vs. cumplimiento |
| ¿Y el día de elecciones? | Nada | **F3** operación Día E |

---

## 4. Roadmap por fases

- **F0 — El Tejido** *(hecho)*: viralidad, gamificación, visualización.
- **F1 — De adhesión a votos** *(ESTE MVP)*: datos reales, georreferenciación,
  verificación, tablero del candidato.
- **F2 — La estructura que rinde cuentas**: metas/cuotas por líder, semáforo de
  cumplimiento, roles de campaña, ranking con propósito.
- **F3 — Día E**: testigos por mesa, afluencia en vivo, conteo rápido / E-14, alertas.
- **F4 — Comunicación**: mensajería masiva segmentada (WhatsApp), activación dirigida.
- **F5 — Confianza y cumplimiento**: habeas data (Ley 1581), topes/ley de garantías,
  auditoría y exportes.
- **Transversal — Analítica predictiva**: proyección, escenarios, brecha por cerrar.

---

## 5. FASE 1 — MVP · detalle de implementación

Objetivo del MVP: que en un demo de 3 minutos el candidato pase de *"red bonita"* a
*"esto me dice cuántos votos verificados tengo y en qué municipios"*.

### 5.1 Cambios de base de datos

**A) Extender `vtx_members`** (nuevas columnas, todas nullables para no romper lo actual):

| Columna | Tipo | Propósito |
|---|---|---|
| `cedula` | `text unique` | Documento de identidad → verificación + dedup |
| `phone` | `text` | Celular → WhatsApp / GOTV (F4) |
| `municipio_codigo` | `text` | Código DANE del municipio (FK lógica a `vtx_municipios`) |
| `municipio` | `text` | Nombre denormalizado (conveniencia de lectura) |
| `puesto_codigo` | `text` | Puesto de votación |
| `puesto_nombre` | `text` | Nombre del puesto |
| `mesa` | `text` | Mesa (opcional en MVP, clave en F3) |
| `verified` | `boolean default false` | Estado de verificación |
| `verified_at` | `timestamptz` | Cuándo se verificó |

**B) Tabla de referencia `vtx_municipios`** (catálogo del departamento):

```
codigo text primary key,      -- DANE
nombre text not null,
lat numeric, lng numeric,     -- centroide para el mapa de burbujas
potencial_votos int,          -- censo electoral del municipio
created_at timestamptz default now()
```

*(Opcional F1.1: `vtx_puestos` para nivel puesto. En MVP agregamos a municipio.)*

**C) RPC de alta extendida** — `vtx_join_with_code` pasa a aceptar los datos electorales:

```
vtx_join_with_code(
  p_code text, p_name text,
  p_cedula text, p_phone text,
  p_municipio_codigo text, p_puesto_codigo text, p_puesto_nombre text
)
```
- Valida formato de cédula (numérica, longitud) y **unicidad** (dedup → si la cédula ya
  existe, error "ya registrado").
- Denormaliza `municipio` desde `vtx_municipios`.
- `verified = false` al ingresar (la verificación es un paso aparte).

**C.2) RPC de alta asistida (captador)** — `vtx_quick_add` (`security definer`):

```
vtx_quick_add(
  p_name text, p_cedula text, p_phone text,
  p_municipio_codigo text, p_puesto_codigo text, p_puesto_nombre text
)
```
- Inserta el nuevo miembro con `parent_id = nodo del captador` (resuelto desde
  `auth.uid()`), `user_id = NULL` (la persona puede crear cuenta después y vincularse).
- Misma validación/dedup de cédula que `vtx_join_with_code`.
- Habilita: (1) **demo en vivo fluido** —el candidato dicta datos, se suma en segundos—,
  y (2) **función real**: captadores registrando simpatizantes puerta a puerta.
- UI: botón "Captar / Sumar simpatizante" en `/red` que abre un formulario corto.

**D) Verificación (MVP honesto):** `verified` se marca por:
1. formato de cédula válido + 2. unicidad + 3. confirmación (manual/admin o por
   celular). *La integración con padrón electoral/Registraduría queda para fase
   posterior; en el demo se explica como "verificación de identidad por etapas".*

**E) Vistas / RPCs de inteligencia:**

```
vtx_coverage_by_municipio  -- por municipio: miembros, verificados,
                           --   proyección, potencial, % cobertura
vtx_dashboard_stats        -- KPIs candidato: total, verificados, % verificación,
                           --   municipios cubiertos, proyección total
```
- **Proyección de votos (MVP):** `verificados` (modelo simple). Se documenta que en F2
  se pondera por estado/nivel/histórico.

### 5.2 Cambios de frontend

**Alta `/unirse/[code]` (`JoinClient.tsx`)**
- Añadir campos al registro: **cédula**, **celular**, **municipio** (select desde
  `vtx_municipios`), **puesto** (texto o select). Enviar a la RPC extendida.
- Mensaje de error claro si la cédula ya está registrada.

**`/red` (`MeshCanvas.tsx`) — nuevo modo "Inteligencia"**
- Toggle o panel: **Cobertura territorial** → barras por municipio
  (miembros / verificados / % del potencial).
- **Tablero del candidato** (KPIs): total, verificados, % verificación, municipios
  cubiertos, **proyección de votos**.
- **Mapa de burbujas**: sobre el canvas, posicionar municipios por `lat/lng` con tamaño
  ∝ miembros (MVP barato y vistoso). *Choropleth real con GeoJSON = F1.1.*
- Color opcional de nodos por municipio ("modo cobertura").

**`ProfileModal.tsx`**
- Mostrar municipio del usuario + **badge "Verificado"**.

### 5.3 Estrategia de datos — borrar la de ejemplo y sembrar la nueva

Tres scripts (se ejecutan cuando des el OK):

1. **`db/90_backup.sql`** — respaldo antes de tocar nada:
   `create table vtx_members_backup as select * from vtx_members;`
   (+ instrucción `\copy` a CSV para descargar copia externa).
2. **`db/91_wipe.sql`** — limpieza: `truncate vtx_members restart identity cascade;`
   (no toca `auth.users`; los miembros seed tienen `user_id` NULL).
3. **`db/04_schema_fase1.sql`** — los cambios de 5.1 (ALTER + tablas ref + RPC + vistas).
4. **`db/05_seed_electoral.sql`** — **nuevo dataset orientado a lo electoral**:
   - 1 candidato raíz.
   - Estructura territorial realista: **coordinadores por municipio →
     líderes de puesto → promotores → simpatizantes**, repartidos en los municipios del
     departamento objetivo.
   - Cada miembro con **cédula (formato válido), celular, municipio, puesto**.
   - Distribución de `verified` ~70–80% para que el tablero se vea creíble.
   - Volumen objetivo: **~800–1.500 miembros** (demo con peso, no 200).
   - `potencial_votos` por municipio para que el % de cobertura tenga sentido.

### 5.4 Orden de ejecución (cuando apruebes)

1. `90_backup.sql` → respaldo.
2. `04_schema_fase1.sql` → nuevo esquema (no destructivo).
3. `91_wipe.sql` → borrar datos viejos.
4. `05_seed_electoral.sql` → sembrar dataset electoral.
5. Frontend: alta con datos electorales → tablero/cobertura → ProfileModal verificado.
6. Deploy (push → GitHub Actions).

---

## 6. Lo que NO entra en el MVP (expectativas)

- Integración real con padrón/Registraduría (verificación automática).
- Choropleth GeoJSON del departamento (va mapa de burbujas).
- Metas por líder y semáforo (eso es **F2**).
- Operación Día E, mensajería masiva, módulo de cumplimiento legal.

---

## 7. Decisiones — confirmadas

| Decisión | Resolución |
|---|---|
| **Departamento** | **Norte de Santander** (Colombia) |
| **Verificación** | Simulada "verificado por celular" → seed marca **~75%** verificados |
| **Mapa** | **Burbujas sobre el canvas** (municipios por lat/lng, tamaño ∝ miembros) |
| **Volumen del seed** | **~1.500 miembros** |
| **Candidato raíz** | **Silvano Serrano** |
| **Alta asistida (captador)** | ⏳ *recomendado* — registrar simpatizantes bajo el propio nodo sin que creen cuenta (demo fluido + función real de campaña) |

### Catálogo de municipios para `vtx_municipios` (demo)

Área Metropolitana de Cúcuta (concentración del voto) + centros regionales clave.

| codigo (DANE) | nombre | lat | lng | potencial_votos |
|---|---|---|---|---|
| 54001 | Cúcuta | 7.8939 | -72.5078 | 560000 |
| 54874 | Villa del Rosario | 7.8333 | -72.4667 | 70000 |
| 54405 | Los Patios | 7.8333 | -72.5000 | 62000 |
| 54261 | El Zulia | 7.9333 | -72.6000 | 18000 |
| 54673 | San Cayetano | 7.8667 | -72.6250 | 4500 |
| 54553 | Puerto Santander | 8.3622 | -72.4083 | 10000 |
| 54498 | Ocaña | 8.2375 | -73.3561 | 75000 |
| 54518 | Pamplona | 7.3758 | -72.6483 | 45000 |
| 54810 | Tibú | 8.6403 | -72.7361 | 38000 |
| 54720 | Sardinata | 8.0833 | -72.8000 | 22000 |
| 54003 | Ábrego | 8.0875 | -73.2206 | 28000 |
| 54172 | Chinácota | 7.6056 | -72.6000 | 16000 |

Potencial total catálogo ≈ **948.500** votos. La distribución del seed concentra la red
en el Área Metropolitana (Cúcuta + 5 municipios) y reparte el resto en los centros
regionales, replicando la geografía electoral real del departamento.

> Listo para ejecutar §5.4. Falta solo confirmar el **nombre del candidato raíz**
> (o se queda el placeholder).
