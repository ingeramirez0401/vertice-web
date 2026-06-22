import { MUNI_COLORS } from '@/components/MeshEngine';
import type { NodeStatus, LayoutMode } from '@/components/MeshEngine';

export type VoiceCommand =
  | { type: 'VIEW';          view: 'global' | 'personal';       label: string }
  | { type: 'LAYOUT';        mode: LayoutMode;                  label: string }
  | { type: 'FILTER_STATUS'; status: NodeStatus | null;         label: string }
  | { type: 'FILTER_MUNI';   municipio: string | null;          label: string }
  | { type: 'COLOR_MODE';    mode: 'status' | 'municipio';      label: string }
  | { type: 'FIT_VIEW';                                         label: string }
  | { type: 'MODAL';         modal: 'intel' | 'quickadd' | 'profile'; label: string }
  | { type: 'NODE_ACTION';   action: 'expand' | 'collapse';    label: string }
  | { type: 'SEARCH';        query: string;                     label: string }
  | { type: 'UNKNOWN';                                          label: string };

// strip accents + lowercase + collapse spaces
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MUNIS = Object.keys(MUNI_COLORS);

function matchMuni(text: string): string | null {
  const n = norm(text);
  for (const m of MUNIS) {
    if (n.includes(norm(m))) return m;
  }
  return null;
}

export function parseCommand(raw: string): VoiceCommand {
  const t = norm(raw);

  // Search must be first so "buscar activos" doesn't hit filter rules
  const searchM = t.match(/\b(?:buscar?|busca|ir a|mostrar a|llevame a|lleva(?:me)?\s+a)\s+(.+)/);
  if (searchM) return { type: 'SEARCH', query: searchM[1].trim(), label: `Buscar "${searchM[1].trim()}"` };

  // View
  if (/\b(global|red global|vista global|todos?|ver todos?)\b/.test(t) && !/filtrar|activo|nuevo|inactivo/.test(t))
    return { type: 'VIEW', view: 'global', label: 'Vista global' };
  if (/\b(la mia|mi red|personal|vista personal|mi vista)\b/.test(t))
    return { type: 'VIEW', view: 'personal', label: 'Vista personal' };

  // Layout
  if (/\bradial\b/.test(t))                              return { type: 'LAYOUT', mode: 'radial', label: 'Diseño radial' };
  if (/\b(arbol|jerarquia|jerarquico)\b/.test(t))        return { type: 'LAYOUT', mode: 'tree',   label: 'Vista árbol' };
  if (/\b(organico|fuerza|libre|dinamico)\b/.test(t))    return { type: 'LAYOUT', mode: 'force',  label: 'Vista orgánica' };

  // Filter status — "todos" / "limpiar" (clear)
  if (/\b(sin filtro|limpiar|quitar filtro|ver todos?|mostrar todos?|todos los? miembros?)\b/.test(t))
    return { type: 'FILTER_STATUS', status: null, label: 'Mostrar todos' };
  if (/\b(activos?|filtrar activos?|mostrar activos?|solo activos?)\b/.test(t))
    return { type: 'FILTER_STATUS', status: 'activo', label: 'Filtrar activos' };
  if (/\b(nuevos?(\s+ingresos?)?|filtrar nuevos?|recientes?|ingresos? nuevos?)\b/.test(t))
    return { type: 'FILTER_STATUS', status: 'nuevo', label: 'Filtrar nuevos ingresos' };
  if (/\b(inactivos?|filtrar inactivos?|sin actividad)\b/.test(t))
    return { type: 'FILTER_STATUS', status: 'inactivo', label: 'Filtrar inactivos' };

  // Color mode
  if (/\b(por municipio|color municipio|municipios|colorear municipio)\b/.test(t))
    return { type: 'COLOR_MODE', mode: 'municipio', label: 'Color por municipio' };
  if (/\b(por estado|color estado|estados|colorear estado)\b/.test(t))
    return { type: 'COLOR_MODE', mode: 'status', label: 'Color por estado' };

  // Fit view
  if (/\b(encuadrar|centrar|ver todo|ajustar|zoom|encuadra|centra)\b/.test(t))
    return { type: 'FIT_VIEW', label: 'Encuadrar red' };

  // Modals
  if (/\b(tablero|estadisticas?|intel|inteligencia|dashboard)\b/.test(t))
    return { type: 'MODAL', modal: 'intel',    label: 'Tablero electoral' };
  if (/\b(captar|nuevo simpatizante|agregar|sumar|registrar)\b/.test(t))
    return { type: 'MODAL', modal: 'quickadd', label: 'Captar simpatizante' };
  if (/\b(perfil|mi id|mi codigo|mi invitacion|mi enlace)\b/.test(t))
    return { type: 'MODAL', modal: 'profile',  label: 'Mi perfil' };

  // Node actions
  if (/\b(expandir|desplegar|abrir rama)\b/.test(t))  return { type: 'NODE_ACTION', action: 'expand',   label: 'Expandir nodo' };
  if (/\b(colapsar|comprimir|cerrar rama)\b/.test(t)) return { type: 'NODE_ACTION', action: 'collapse', label: 'Colapsar nodo' };

  // Municipio filter (last — broad match)
  const muni = matchMuni(t);
  if (muni) return { type: 'FILTER_MUNI', municipio: muni, label: `Filtrar ${muni}` };

  return { type: 'UNKNOWN', label: 'No entendí ese comando' };
}
