# VÉRTICE — Plan de implementación a producción

Red mesh privada de adhesión política: un nodo origen (el candidato) del que se ramifican
infinitos simpatizantes. **Cada persona tiene un solo padre; un padre, muchos hijos.** El
objetivo del producto es medir la profundidad y el alcance real de la campaña, y permitir que
cualquier miembro comparta su *ID de adhesión* para que quien lo use quede enlazado como su hijo.

> Este paquete convierte el **prototipo HTML** (`prototype/VERTICE Red Mesh.dc.html`) en una
> aplicación 100% operable sobre tu stack: **Supabase / Postgres + Redis + Docker (Traefik +
> Portainer)**. El prototipo es la **referencia de diseño e interacción de alta fidelidad** y el
> motor visual (canvas) es reutilizable casi sin cambios. Lo único que hay que sustituir son los
> *datos demo* por *datos vivos*.

---

## 0. Arquitectura objetivo

```
                          Internet (HTTPS)
                                │
                        ┌───────▼────────┐
                        │    Traefik     │  router + TLS (Let's Encrypt)
                        │ (red-publica)  │
                        └───────┬────────┘
                                │ Host(`red.tudominio.com`)
                   ┌────────────▼─────────────┐
                   │     vertice-web (Next)   │  SSR + API routes + canvas
                   │  contenedor Docker :3000 │
                   └───┬───────────────┬──────┘
                       │               │
        Supabase JS /  │               │  ioredis
        Realtime WS    │               │
              ┌────────▼─────┐   ┌──────▼──────┐
              │   Supabase   │   │   Redis 7   │  caché de stats + conteos
              │  (Postgres,  │   │ (allkeys-lru│  + pub/sub de "nuevas altas"
              │  Auth, RLS,  │   └─────────────┘
              │  Realtime)   │
              └──────────────┘
```

**Decisiones clave**

| Tema | Decisión | Por qué |
|------|----------|---------|
| Frontend | **Next.js (App Router)** en modo `standalone`, un solo contenedor | Co-ubica la landing de invitación `/unirse/[code]`, el lienzo, Auth y las API routes; build reproducible para Docker. *(Alternativa válida: SPA Vite + Nginx si no quieres SSR.)* |
| Árbol infinito | **Postgres + extensión `ltree`** (materialized path) | Ancestros y descendientes en una sola consulta indexada (GiST), sin recursión costosa. Profundidad = `nlevel(path)`. |
| Conteos (red total / hijos) | Columnas `subtree_size` y `child_count` mantenidas por **trigger** + caché en Redis | Evita recalcular el subárbol en cada lectura. La alta de un miembro incrementa a todos sus ancestros en un solo `UPDATE ... WHERE path @> nuevo.path`. |
| Altas en vivo | **Supabase Realtime** (replicación lógica de la tabla `members`) | El frontend se suscribe a los `INSERT` y dispara la animación de "nuevo hijo uniéndose" que ya existe en el prototipo. |
| Auth + adhesión | **Supabase Auth** + función RPC `join_with_code()` `security definer` | Garantiza un solo padre por usuario y genera el código de adhesión del nuevo miembro de forma atómica. |
| Despliegue | **docker-compose** como *Stack* en Portainer, expuesto por Traefik | Tu flujo actual; sin pasos manuales en el servidor. |

---

## 1. Fases de implementación

### Fase 1 — Base de datos (carpeta `db/`)
1. Ejecuta `db/01_schema.sql` en el editor SQL de Supabase (crea extensiones, tipo enum, tabla `members`, índices y triggers de `path`/conteos).
2. Ejecuta `db/02_functions_rls.sql` (generador de código, RPC `join_with_code`, RLS, vista de stats y publicación Realtime).
3. Verifica con `db/03_seed.sql` (inserta el candidato raíz `VTX-0001` y, opcionalmente, datos de prueba).

### Fase 2 — Auth y flujo de adhesión
- Activa **Email/OTP** (o el proveedor que uses) en Supabase Auth.
- Ruta pública `/unirse/[code]`: muestra quién invita (lookup por `adhesion_code`), pide nombre + login/registro, y al confirmar llama a `rpc('join_with_code', { p_code })`.
- Regla de negocio dura: **un `auth.user` = un `member`** (constraint `unique(user_id)`). Si ya pertenece, la RPC lanza error.

### Fase 3 — Capa de datos / API (ver `api/API_CONTRACT.md`)
- Lecturas del grafo directo con `supabase-js` (protegidas por RLS).
- `GET /api/stats` cacheado en Redis (60 s) para los contadores del HUD.
- Suscripción Realtime a `members` para las altas en vivo.

### Fase 4 — Integrar el motor visual (ver `frontend/INTEGRATION.md`) ← **el paso que falta**
- El lienzo, los layouts (radial/árbol/orgánico), zoom/pan, selección, linaje, búsqueda y panel **se conservan tal cual**.
- Se reemplaza el generador `_gen()` por `loadGraph()` (datos de Supabase) y `_spawn()` se dispara desde el evento Realtime en lugar de un timer.
- La "vista La mía" y el modal de compartir usan el `member` del usuario logueado y su `adhesion_code` real.

### Fase 5 — Despliegue (carpeta `deploy/`)
- `Dockerfile` (Next standalone) + `docker-compose.yml` (web + redis, labels Traefik).
- Sube el stack en Portainer, define las variables de `.env`, apunta tu DNS a Traefik.

### Fase 6 — Rendimiento y escala
- **Culling por viewport** y **carga por niveles** cuando la red supere ~3–5k nodos (no traer todo el árbol de golpe: cargar el subárbol visible + lazy-load al expandir).
- `subtree_size`/`child_count` ya evitan recomputar; Redis cachea stats y los conteos calientes.
- Índice GiST sobre `path` para ancestros/descendientes en O(log n).

---

## 2. El "paso faltante", en concreto

Todo lo visual ya está. Para quedar **100% operable** solo se conectan 3 cosas:

1. **`join_with_code()`** (en `db/02_functions_rls.sql`) — convierte un ID compartido en una alta real con un único padre.
2. **`loadGraph()` + suscripción Realtime** (en `frontend/INTEGRATION.md`) — alimenta el canvas con datos vivos y anima las altas reales.
3. **El stack Docker** (en `deploy/`) — publica la app en tu dominio detrás de Traefik.

---

## 3. Checklist de "Definition of Done"

- [ ] `members` creada con `ltree`, triggers de `path`/`depth`/conteos y RLS activa.
- [ ] Candidato raíz sembrado (`VTX-0001`) y visible en el lienzo.
- [ ] Registro vía `/unirse/[code]` crea un miembro con el padre correcto y código propio.
- [ ] Un usuario no puede tener dos padres (constraint probado).
- [ ] El HUD (miembros, profundidad, ramas, nuevos) se llena desde `GET /api/stats`.
- [ ] Una alta real aparece en el lienzo de todos los clientes conectados (Realtime).
- [ ] Búsqueda, selección, linaje ancestral y panel funcionan con datos reales.
- [ ] Compartir copia el `adhesion_code` y el link real del usuario logueado.
- [ ] App publicada en `https://red.tudominio.com` con TLS por Traefik.
- [ ] Export de datos (CSV/JSON) disponible para el equipo de campaña.

---

## 4. Estructura de este paquete

```
design_handoff_vertice/
├── README.md                  ← este plan
├── prototype/
│   ├── VERTICE Red Mesh.dc.html   referencia de diseño/interacción (alta fidelidad)
│   └── support.js                 runtime del prototipo (no se despliega)
├── db/
│   ├── 01_schema.sql              tabla, ltree, triggers de path y conteos
│   ├── 02_functions_rls.sql       gen_adhesion_code, join_with_code, RLS, stats, Realtime
│   └── 03_seed.sql                candidato raíz + datos de prueba opcionales
├── api/
│   └── API_CONTRACT.md            endpoints, RPC, payloads, eventos Realtime
├── frontend/
│   └── INTEGRATION.md             cómo cambiar datos demo por datos vivos en el canvas
└── deploy/
    ├── Dockerfile                 Next.js standalone
    ├── docker-compose.yml         web + redis + labels Traefik (stack Portainer)
    └── .env.example               variables de entorno
```

> **Nota de fidelidad:** los archivos de `prototype/` son **referencia de diseño en HTML**, no
> código de producción para copiar literal. La tarea es **recrear ese diseño y comportamiento**
> dentro de tu app Next.js usando los patrones del repo, reutilizando el motor de canvas tal como
> se indica en `frontend/INTEGRATION.md`.
