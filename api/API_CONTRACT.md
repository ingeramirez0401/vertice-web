# VÉRTICE — Contrato de API y datos

El frontend habla con Supabase de dos formas: **`supabase-js`** directo (lecturas protegidas por
RLS + suscripción Realtime) y **API routes de Next** para lo que conviene cachear en Redis.

---

## 1. Lecturas directas con `supabase-js` (RLS: `authenticated`)

```ts
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Grafo (para redes < ~3–5k nodos: trae todo y arma el árbol en cliente)
const { data: members } = await supabase
  .from('members')
  .select('id,parent_id,adhesion_code,full_name,status,depth,child_count,subtree_size,created_at')
  .order('depth', { ascending: true });

// Linaje ancestral de un nodo (usa la ruta ltree vía RPC o vista expuesta)
const { data: ancestors } = await supabase.rpc('ancestors_of', { p_id: nodeId });

// Hijos directos
const { data: children } = await supabase
  .from('members').select('*').eq('parent_id', nodeId).order('created_at');

// El miembro del usuario logueado ("La mía" + compartir)
const { data: me } = await supabase
  .from('members').select('*').eq('user_id', user.id).single();
```

> Para ancestros/descendientes con `ltree`, expón funciones SQL `ancestors_of(p_id)` y
> `descendants_of(p_id)` (mismas consultas comentadas al final de `02_functions_rls.sql`) y llámalas
> con `supabase.rpc(...)`. Así el frontend no necesita conocer `ltree`.

---

## 2. Adhesión (alta con un solo padre)

**Landing pública** `/unirse/[code]`:

```ts
// 1) Preview del invitador (sin login)
const { data } = await supabase.rpc('inviter_preview', { p_code: code });
// → { full_name, role, subtree_size, depth }

// 2) Tras login/registro (Supabase Auth), confirmar adhesión:
const { data: child, error } = await supabase.rpc('join_with_code', {
  p_code: code,
  p_name: nombreDelUsuario,
});
// error si: no hay sesión | código inválido | el usuario ya pertenece a la red
```

`join_with_code` es atómica y `security definer`: valida, evita doble padre y genera el
`adhesion_code` del nuevo miembro. Devuelve el registro `members` recién creado.

---

## 3. API routes de Next (cacheadas en Redis)

### `GET /api/stats`
HUD del lienzo (miembros, profundidad, ramas, nuevos hoy). Cache 60 s.

```ts
// app/api/stats/route.ts
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL!);

export async function GET() {
  const cached = await redis.get('vertice:stats');
  if (cached) return Response.json(JSON.parse(cached));

  const { data } = await supabaseAdmin.from('network_stats').select('*').single();
  await redis.set('vertice:stats', JSON.stringify(data), 'EX', 60);
  return Response.json(data);
}
// → { total_members, max_depth, ramas, nuevos_hoy }
```

### `GET /api/export?format=csv|json`  *(equipo de campaña)*
Volcado de la red para análisis. Protégelo por rol/clave de servicio.

```ts
const { data } = await supabaseAdmin
  .from('members')
  .select('adhesion_code,full_name,role:depth,status,depth,parent_id,child_count,subtree_size,created_at');
// serializa a CSV o JSON
```

---

## 4. Eventos en tiempo real (altas en vivo)

```ts
const channel = supabase
  .channel('members-stream')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'members' },
    (payload) => {
      // payload.new = nuevo miembro → dispara la animación de "nuevo hijo"
      graph.onRemoteJoin(payload.new);   // ver frontend/INTEGRATION.md
    })
  .subscribe();
```

Opcional: además publica en **Redis pub/sub** (`PUBLISH vertice:joins ...`) si quieres alimentar
otros servicios (dashboards, bots de WhatsApp del comando de campaña, etc.).

---

## 5. Modelo de datos (resumen)

| Campo | Tipo | Nota |
|-------|------|------|
| `id` | uuid | PK |
| `user_id` | uuid unique | 1 auth.user = 1 member |
| `parent_id` | uuid | NULL solo en la raíz; **un solo padre** |
| `adhesion_code` | text unique | el ID que se comparte (`VTX-XXXX`) |
| `full_name` | text | |
| `status` | enum | `activo` / `nuevo` / `inactivo` |
| `path` | ltree | ruta materializada (ancestros/descendientes) |
| `depth` | int | nivel; `role` se deriva de aquí |
| `child_count` | int | hijos directos (mantenido por trigger) |
| `subtree_size` | int | descendientes totales = "su red" |
| `created_at` | timestamptz | para "nuevos hoy" y antigüedad |
