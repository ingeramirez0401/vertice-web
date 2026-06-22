# VÉRTICE — Plan Fase 2: Operación Electoral

> Objetivo: convertir la red visualizada en una herramienta de operación real de campaña.
> Candidato: Gobernación Norte de Santander.
> Stack: Next.js 14 · Supabase · Redis · Docker Swarm · vtx.nodalyst.ai

---

## Estado general

| # | Feature | Estado | Sprint |
|---|---------|--------|--------|
| 1 | Verificación de miembros | ⬜ Pendiente | 1 |
| 2 | Métricas de captación (ranking) | ⬜ Pendiente | 1 |
| 3 | Exportar red (CSV) | ⬜ Pendiente | 2 |
| 4 | Notificaciones push | ⬜ Pendiente | 2 |
| 5 | Metas por municipio | ⬜ Pendiente | 3 |
| 6 | PWA / modo offline | ⬜ Pendiente | 3 |
| 7 | Voz Nivel 2 — NLU con Claude | ⬜ Pendiente | 4 |
| 8 | Gestos con manos (MediaPipe) | ⬜ Pendiente | 4 |

Leyenda: ⬜ Pendiente · 🔄 En progreso · ✅ Listo

---

## Completado (Fase 1)

- ✅ Canvas MeshEngine (radial / árbol / orgánico, zoom, pan, selección)
- ✅ Fase 1 Electoral — QuickAddModal, IntelDashboard, seed Norte de Santander
- ✅ Color por municipio + paleta MUNI_COLORS
- ✅ Ficha de nodo: municipio, cédula enmascarada, link de invitación
- ✅ Real-time adhesiones (Supabase Realtime + REPLICA IDENTITY FULL)
- ✅ Optimización mobile (LOD, 30fps, auto-colapso depth ≥ 3, DPR 1.5)
- ✅ Filtros por estado (Activo / Nuevo / Inactivo) y por municipio
- ✅ Control por voz Nivel 1 (Web Speech API, 9 tipos de comando, es-CO)

---

## Sprint 1

### 1. Verificación de miembros

**Qué es:** Un coordinador o líder puede marcar a un simpatizante como "verificado" (confirmó identidad, cédula correcta, existe en padrón). El KPI `% verificados` del tablero cobra valor real.

**DB:**
```sql
-- Ya existe: verified BOOLEAN DEFAULT FALSE, verified_at TIMESTAMPTZ
-- RPC nueva:
CREATE OR REPLACE FUNCTION vtx_verify_member(p_member_uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- solo puede verificar quien sea ancestro directo del miembro
  UPDATE vtx_members
  SET verified = TRUE, verified_at = NOW()
  WHERE id = p_member_uid
    AND EXISTS (
      SELECT 1 FROM vtx_members me
      WHERE me.user_id = auth.uid()
        AND p_member_uid::ltree <@ (me.path || '*'::lquery)::lquery -- descendiente
    );
END;$$;
```

**UI:**
- Botón "✓ Verificar" en ficha de nodo (desktop detail panel + mobile bottom sheet)
- Solo visible si el viewer es ancestro del nodo seleccionado (`selData.depth > meData.depth`)
- Al verificar: nodo actualiza `verified=true`, badge aparece en ficha, KPI sube en tiempo real
- En canvas: nodo verificado muestra pequeño checkmark sobre el círculo cuando `colorMode === 'status'`

**Archivos a tocar:**
- `db/06_verify.sql` (nueva RPC)
- `components/MeshEngine.ts` — `buildSel()` agrega `isVerifiable`, `verified`; `_draw()` dibuja checkmark
- `components/MeshCanvas.tsx` — botón verificar en detail panel desktop + mobile sheet

---

### 2. Métricas de captación (ranking)

**Qué es:** Dentro del Tablero Electoral, una sección con el ranking de captadores por periodo: quién suma más adheridos en los últimos 7 / 30 días o en total. Motiva al equipo, identifica quién movilizar.

**DB:**
```sql
CREATE OR REPLACE VIEW vtx_top_captadores AS
SELECT
  m.id, m.full_name, m.municipio,
  COUNT(h.id) FILTER (WHERE h.created_at >= NOW() - INTERVAL '7 days')  AS cap_7d,
  COUNT(h.id) FILTER (WHERE h.created_at >= NOW() - INTERVAL '30 days') AS cap_30d,
  COUNT(h.id) AS cap_total,
  vtx_role_for_depth(m.depth) AS role
FROM vtx_members m
LEFT JOIN vtx_members h ON h.parent_id = m.id
WHERE m.user_id IS NOT NULL  -- solo captadores con cuenta
GROUP BY m.id
ORDER BY cap_7d DESC;

GRANT SELECT ON vtx_top_captadores TO authenticated;
```

**UI (dentro de IntelDashboard.tsx):**
- Nueva tab "Captadores" junto al mapa de burbujas
- Tabla: posición · nombre · rol · municipio · 7d · 30d · total
- Periodo toggle: 7d / 30d / Total
- Top 3 con highlight (oro / plata / bronce)
- Filtro por municipio opcional

**Archivos a tocar:**
- `db/07_captadores.sql` (nueva vista)
- `components/IntelDashboard.tsx` — nueva sección de ranking

---

## Sprint 2

### 3. Exportar red (CSV)

**Qué es:** Un coordinador descarga su subtree como CSV o Excel para logística de campaña (transporte el día E, listas de contacto, verificación en campo).

**Implementación:**
- Botón "⬇ Exportar" en el Tablero Electoral y/o en la ficha del nodo propio
- Client-side: `engine.nodes` filtrado por subtree → construir CSV → `URL.createObjectURL` → descarga
- Columnas: Nombre · Cédula · Teléfono · Municipio · Rol · Estado · Verificado · Captado por · Fecha adhesión
- Solo exporta el subtree del usuario autenticado (respeta RLS)

**Archivos a tocar:**
- `lib/export.ts` (nueva utilidad `exportSubtreeCSV(nodes, meId)`)
- `components/IntelDashboard.tsx` — botón exportar
- `components/MeshCanvas.tsx` — botón exportar en ProfileModal / panel mi ID

---

### 4. Notificaciones push

**Qué es:** Cuando alguien se une a tu red via tu link, recibes una notificación push aunque la app esté cerrada.

**Implementación:**
- Service worker `public/sw.js` con `push` event listener
- `lib/push.ts` — `subscribePush()` guarda endpoint en tabla `vtx_push_subscriptions`
- Supabase Edge Function `notify-on-join` — trigger en INSERT de vtx_members → llama Web Push API con VAPID
- Notificación: "🎉 [Nombre] se unió a tu red"
- Permisos: solo si el usuario acepta en la UI (prompt no intrusivo)

**DB:**
```sql
CREATE TABLE vtx_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Archivos a tocar:**
- `public/sw.js` (nuevo)
- `lib/push.ts` (nuevo)
- `supabase/functions/notify-on-join/index.ts` (nueva Edge Function)
- `components/ProfileModal.tsx` — botón "Activar notificaciones"

---

## Sprint 3

### 5. Metas por municipio

**Qué es:** El coordinador de campaña fija una meta de adheridos por municipio. El tablero muestra progreso real vs meta con barra y % de cumplimiento.

**DB:**
```sql
ALTER TABLE vtx_municipios ADD COLUMN meta_adheridos INTEGER DEFAULT 0;
-- o tabla separada para histórico de metas
```

**UI:**
- En IntelDashboard: columna "Meta" en tabla de cobertura por municipio
- Barra de progreso doble: adheridos actuales / meta
- Color: rojo < 50%, amarillo 50-80%, verde > 80%
- Edición de meta: inline input para rol Candidato/Coordinador

---

### 6. PWA / modo offline

**Qué es:** Promotores en zonas rurales captan simpatizantes sin señal. La app funciona offline y sincroniza al recuperar conexión.

**Implementación:**
- `next-pwa` o service worker manual con Workbox
- Cache: app shell + últimos datos del grafo
- Cola offline: adhesiones guardadas en IndexedDB → sync cuando hay red
- Manifest: ícono VÉRTICE, `display: standalone`, `theme_color`

---

## Sprint 4

### 7. Voz Nivel 2 — NLU con Claude

**Qué es:** Preguntas en lenguaje libre respondidas con inteligencia: *"¿Cuántos nuevos hay en Tibú esta semana?"*, *"¿Quién captó más en Ocaña?"*, *"¿Cómo va la verificación?"*

**Implementación:**
- Route API `app/api/voice-nlu/route.ts`
- Recibe transcript → llama Claude Haiku con contexto del dashboard + intents definidos
- Responde JSON `{ intent, params, answer }` + texto para TTS opcional
- Modelo: `claude-haiku-4-5-20251001` (~$0.001/consulta)
- Fallback a Nivel 1 si la consulta es simple

---

### 8. Gestos con manos (MediaPipe)

**Qué es:** Feature opcional activable desde configuración. Controla el canvas con gestos de la webcam. Para demos del candidato.

**Gestos:**
- Pinch (pulgar+índice separándose/juntándose) → zoom in/out
- Palma abierta + movimiento → pan
- Puño cerrado → colapsar nodo seleccionado
- ✌️ Dos dedos → expandir
- Swipe lateral → cambiar vista Global ↔ La mía

**Implementación:**
- `@mediapipe/hands` lazy-loaded solo cuando se activa (~2MB WASM)
- `lib/gesture/GestureController.ts` — detecta landmarks → mapea a acciones del engine
- `components/GestureOverlay.tsx` — canvas overlay con visualización de landmarks
- Activación: toggle en configuración (menú ⋮ o settings panel)

---

## Notas técnicas

- Todas las RPCs nuevas usan `SECURITY DEFINER` + validación de ancestro
- Los commits siguen el patrón: `feat:` / `fix:` / `perf:` / `db:`
- Cada sprint se prueba en vtx.nodalyst.ai antes de pasar al siguiente
- El seed de 1500 miembros cubre todos los casos de prueba de UI

---

*Última actualización: Junio 2026*
