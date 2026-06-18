# VÉRTICE — Integración del frontend (el paso que falta)

El prototipo `prototype/VERTICE Red Mesh.dc.html` contiene un **motor de visualización completo**
en una clase JS (canvas + cámara zoom/pan, layouts radial/árbol/orgánico, partículas, glow, pulsos,
selección, resaltado de linaje, búsqueda, panel de detalle, modal de compartir y animación de
altas). **Todo eso se conserva.** Lo único que cambia: de dónde vienen los datos.

## Qué portar (1:1)

Copia la lógica del prototipo a tu app como un módulo/clase de render (framework-agnóstico):
`MeshEngine` con el `<canvas>` y los métodos `_draw`, `_layout`, `_forceStep`, `worldToScreen`,
`screenToWorld`, `fitView`, `centerOn`, `select`, `_hit`, `_rad`, `nodeColor`, `ancestorsOf`,
`descSet`. En React monta el canvas en un `useRef` y crea el engine en `useEffect`.

## Qué reemplazar

### 1. `_gen()` (datos demo) → `loadGraph()` (datos vivos)

El prototipo construye `this.nodes` con un RNG sembrado. Sustitúyelo por la carga desde Supabase,
construyendo la **misma estructura de nodo** que el engine espera:

```ts
// nodo que el engine necesita: { id, parent, depth, children[], name, idCode, status, desc, x,y,tx,ty,vx,vy,visible,collapsed,born, isMe }
async function loadGraph(engine) {
  const { data } = await supabase
    .from('members')
    .select('id,parent_id,full_name,adhesion_code,status,depth,child_count,subtree_size')
    .order('depth');

  const idx = new Map();
  engine.nodes = data.map((m, i) => {
    const n = {
      uid: m.id, id: i, parentUid: m.parent_id, parent: -1,
      depth: m.depth, children: [], name: m.full_name, idCode: m.adhesion_code,
      status: m.status, desc: m.subtree_size,
      x:0,y:0,tx:0,ty:0,vx:0,vy:0, visible:true, collapsed:false, born:0,
    };
    idx.set(m.id, n); return n;
  });
  // enlazar índices padre→hijos (el engine usa índices numéricos)
  engine.nodes.forEach(n => {
    if (n.parentUid && idx.has(n.parentUid)) {
      const p = idx.get(n.parentUid);
      n.parent = p.id; p.children.push(n.id);
    }
  });
  // marcar al usuario logueado
  const meUid = (await supabase.from('members').select('id').eq('user_id', user.id).single()).data?.id;
  const me = engine.nodes.find(n => n.uid === meUid);
  if (me) { me.isMe = true; engine.meId = me.id; }

  engine._layout(true);
  engine.fitView(false);
}
```

> Mantén el `id` numérico interno (índice del array) porque los layouts y el hit-test lo usan; añade
> `uid` (el uuid real) para hablar con la API.

### 2. Timer de altas `_joinTick()` → evento Realtime

Borra el `setInterval`/timer de `_joinTick`. En su lugar, conecta el canal Realtime
(`api/API_CONTRACT.md §4`) a un método nuevo que reutiliza la animación de `_spawn`:

```ts
engine.onRemoteJoin = (row) => {
  const parent = engine.nodes.find(n => n.uid === row.parent_id);
  if (!parent) return;                 // padre fuera del subárbol cargado
  const n = {
    uid: row.id, id: engine.nodes.length, parent: parent.id, depth: row.depth,
    children: [], name: row.full_name, idCode: row.adhesion_code, status: 'nuevo',
    desc: 0, x: parent.x, y: parent.y, tx: parent.x, ty: parent.y, vx:0, vy:0,
    visible: true, collapsed: false, born: performance.now(),
  };
  parent.children.push(n.id); engine.nodes.push(n);
  let p = parent; while (p) { p.desc = (p.desc||0)+1; p = p.parent>=0 ? engine.nodes[p.parent] : null; }
  engine._layout(false);               // re-acomoda con animación (la birth-ring ya existe)
};
```

### 3. Búsqueda, selección, linaje → ya funcionan en cliente

Como cargas el grafo completo (para redes medianas), `search`, `select`, `ancestorsOf`,
`descSet` y el panel **siguen operando en memoria**. Para redes grandes (Fase 6) cambia
`ancestorsOf`/`descSet` por las RPC `ancestors_of`/`descendants_of`.

### 4. Modal de compartir → ID y link reales

```ts
const me = engine.nodes[engine.meId];
shareData = {
  idCode: me.idCode,                                   // adhesion_code real
  link: `https://red.tudominio.com/unirse/${me.idCode}`,
};
// botón copiar: navigator.clipboard.writeText(shareData.link)
```
Quita el botón "Simular nuevo adherido" (era demo). La alta real ocurre cuando alguien abre el link
y completa `join_with_code`.

### 5. Vista "La mía" (personal)

Igual que el prototipo: centra en `engine.meId` y resalta `ancestorsOf(me) ∪ descSet(me)`. Sin
cambios, solo que `meId` ahora viene del usuario autenticado.

## Tweaks del prototipo que pasan a config real

- `brandName`, `regionLabel`, `candidateName` → variables de entorno / tabla `settings`.
- `theme` → preferencia de UI (localStorage o columna en `profiles`).
- `networkSize` → ya no aplica (la red es real).

## Auth (Supabase) — mínimo

1. `/unirse/[code]`: `inviter_preview(code)` → muestra invitador → login/registro → `join_with_code(code, nombre)`.
2. App principal: requiere sesión; resuelve `me` por `user_id`.
3. La raíz (candidato) se crea por seed, no por invitación.

## Rendimiento (cuando crezca)

- **Culling**: el `_draw` ya descarta nodos fuera del viewport; mantenlo.
- **Carga por niveles**: en vez de `loadGraph()` completo, trae `depth <= k` + subárbol del nodo
  seleccionado, y haz lazy-load al expandir una rama (usa `descendants_of` con límite).
- **Conteos**: usa `subtree_size`/`child_count` de la DB (ya mantenidos por trigger); no recalcules.
