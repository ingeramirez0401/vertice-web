'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { THEMES, type ThemeKey } from './MeshEngine';

interface DashStats {
  total_miembros: number;
  verificados: number;
  municipios_cubiertos: number;
  municipios_total: number;
  pct_verificacion: number;
  potencial_total: number;
  nuevos_hoy: number;
}

interface CoverageRow {
  codigo: string;
  nombre: string;
  lat: number;
  lng: number;
  potencial_votos: number;
  total_miembros: number;
  verificados: number;
  pct_potencial: number;
  pct_verificados: number;
}

interface Props { themeKey: ThemeKey; onClose: () => void; }

// Norte de Santander bounding box for SVG bubble map
const MAP = { latMin: 7.3, latMax: 8.72, lngMin: -73.45, lngMax: -72.35 };
function toSvg(lat: number, lng: number, W: number, H: number) {
  const x = ((lng - MAP.lngMin) / (MAP.lngMax - MAP.lngMin)) * W;
  const y = H - ((lat - MAP.latMin) / (MAP.latMax - MAP.latMin)) * H;
  return { x, y };
}

export default function IntelDashboard({ themeKey, onClose }: Props) {
  const T = THEMES[themeKey];
  const supabase = createClient();

  const [stats,    setStats]    = useState<DashStats | null>(null);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('vtx_dashboard_stats').select('*').single(),
      supabase.from('vtx_coverage_by_municipio').select('*'),
    ]).then(([{ data: s }, { data: c }]) => {
      if (s) setStats(s as DashStats);
      if (c) setCoverage(c as CoverageRow[]);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const panelBg = T.bg === '#e9e7df' ? 'rgba(255,255,255,.96)' : 'rgba(8,12,20,.97)';
  const accentGrad = `linear-gradient(135deg,${T.accent},${T.accent2})`;

  const maxMembers = coverage.length ? Math.max(...coverage.map(c => c.total_miembros)) : 1;
  const SVG_W = 260, SVG_H = 170;
  const bubbleMax = 28;

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, background: panelBg, backdropFilter: 'blur(28px)', borderRadius: '22px 22px 0 0', border: `1px solid ${T.border}`, borderBottom: 'none', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -24px 80px rgba(0,0,0,.6)', animation: 'vsheetin .32s cubic-bezier(.32,1.2,.4,1)', paddingBottom: 'var(--safe-b)' }}>

        {/* Handle */}
        <div style={{ padding: '10px 0 4px', textAlign: 'center', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)', display: 'inline-block' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '8px 22px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.04em', fontFamily: 'var(--font-display,var(--font-space,sans-serif))' }}>Tablero Electoral</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Norte de Santander · Gobernación</div>
          </div>
          <div onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.muted, background: 'rgba(255,255,255,.07)' }}>✕</div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {loading && (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'vspin 1s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13, color: T.muted }}>Calculando...</div>
            </div>
          )}

          {!loading && stats && (
            <>
              {/* KPI grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, padding: '16px 20px' }}>
                {[
                  { val: stats.total_miembros.toLocaleString('es'),   label: 'Adheridos',       color: T.text    },
                  { val: stats.verificados.toLocaleString('es'),      label: 'Verificados',     color: T.accent  },
                  { val: `${stats.pct_verificacion ?? 0}%`,           label: '% Verificación',  color: T.accent2 },
                  { val: `${stats.municipios_cubiertos}/${stats.municipios_total}`, label: 'Municipios', color: T.text },
                  { val: stats.nuevos_hoy.toLocaleString('es'),       label: 'Nuevos hoy',      color: '#3dff9a' },
                  { val: (stats.potencial_total ?? 0).toLocaleString('es'), label: 'Padrón total', color: T.muted },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,.05)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'var(--font-display,var(--font-space,sans-serif))', fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.1em', color: T.muted, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Bubble map */}
              {coverage.length > 0 && (
                <div style={{ padding: '0 20px 16px' }}>
                  <div style={{ fontSize: 10.5, letterSpacing: '.2em', textTransform: 'uppercase', color: T.muted, marginBottom: 10 }}>Mapa de cobertura</div>
                  <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, border: `1px solid ${T.border}`, overflow: 'hidden', position: 'relative' }}>
                    <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ display: 'block' }}>
                      {/* Background tint */}
                      <rect width={SVG_W} height={SVG_H} fill="transparent" />
                      {coverage.map(c => {
                        const pos = toSvg(c.lat, c.lng, SVG_W, SVG_H);
                        const r = c.total_miembros > 0
                          ? Math.max(5, (c.total_miembros / maxMembers) * bubbleMax)
                          : 4;
                        const pct = c.pct_verificados ?? 0;
                        const alpha = 0.5 + (pct / 100) * 0.5;
                        return (
                          <g key={c.codigo}>
                            <circle
                              cx={pos.x} cy={pos.y} r={r}
                              fill={T.accent} fillOpacity={alpha}
                              stroke={T.accent} strokeOpacity={0.8} strokeWidth={0.8}
                            />
                            {r > 10 && (
                              <text x={pos.x} y={pos.y + 3.5} textAnchor="middle" fontSize={7} fill="#04121a" fontWeight="bold">
                                {c.total_miembros}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                    {/* Legend */}
                    <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 9, color: T.muted, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, opacity: 0.9, display: 'inline-block' }} />Más adheridos
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, opacity: 0.5, display: 'inline-block' }} />Menos verificados
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Coverage table */}
              <div style={{ padding: '0 20px 24px' }}>
                <div style={{ fontSize: 10.5, letterSpacing: '.2em', textTransform: 'uppercase', color: T.muted, marginBottom: 10 }}>Cobertura por municipio</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {coverage.map(c => {
                    const pctBar = Math.min(100, c.pct_potencial ?? 0);
                    const verBar = Math.min(100, c.pct_verificados ?? 0);
                    return (
                      <div key={c.codigo} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 11, padding: '10px 14px', border: `1px solid ${T.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{c.nombre}</span>
                          <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                            <span style={{ color: T.accent, fontFamily: 'var(--font-mono,monospace)', fontWeight: 600 }}>{c.verificados}</span>
                            <span style={{ color: T.muted }}>/{c.total_miembros}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {/* Adheridos / potencial */}
                          <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pctBar}%`, background: accentGrad, borderRadius: 3, transition: 'width .6s ease' }} />
                          </div>
                          {/* % verificados */}
                          <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${verBar}%`, background: T.accent2, borderRadius: 2, opacity: 0.7 }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.muted }}>
                            <span>{(c.pct_potencial ?? 0).toFixed(2)}% del padrón</span>
                            <span>{c.pct_verificados ?? 0}% verificados</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
