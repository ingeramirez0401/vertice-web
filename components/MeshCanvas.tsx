'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MeshEngine, THEMES, ThemeKey, LayoutMode, roleForDepth } from './MeshEngine';

interface Props { userId: string; }

const THEME_KEYS: ThemeKey[] = ['cian', 'violeta', 'neon', 'claro'];

export default function MeshCanvas({ userId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MeshEngine | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState(-1);
  const [query, setQuery] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [themeKey, setThemeKey] = useState<ThemeKey>('cian');
  const [layout, setLayout] = useState<LayoutMode>('radial');
  const [view, setView] = useState<'global' | 'personal'>('global');
  const [live, setLive] = useState(true);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1700);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new MeshEngine();
    engine.init(canvas);
    engine.onSelect = (id) => setSelectedId(id);
    engine.onToast = showToast;
    engine.onUpdate = () => setTick(t => t + 1);
    engineRef.current = engine;

    engine.loadGraph(supabase, userId).then(() => setLoading(false));
    engine.startLoop();

    const channel = supabase
      .channel('vtx-members-stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vtx_members' },
        (payload) => engine.onRemoteJoin(payload.new as Record<string, unknown>))
      .subscribe();

    return () => {
      engine.destroy();
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, showToast]);

  const engine = engineRef.current;
  const T = engine ? engine.getTheme() : THEMES.cian;

  const stats = useMemo(() => engine?.getStats() ?? { total: 0, maxDepth: 0, ramas: 0, nuevos: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, engine]);
  const searchResults = useMemo(() => engine?.search(query) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, tick, engine]);
  const selData = useMemo(() => engine && selectedId >= 0 ? engine.buildSel(selectedId) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, tick, engine]);
  const meData = useMemo(() => engine?.buildMe(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, engine]);

  const handleTheme = (key: ThemeKey) => { setThemeKey(key); engine?.setTheme(key); };
  const handleLayout = (mode: LayoutMode) => { setLayout(mode); engine?.setMode(mode); };
  const handleView = (v: 'global' | 'personal') => { setView(v); engine?.setView(v); };
  const handleToggleLive = () => { const nl = !live; setLive(nl); if (engine) engine.live = nl; };

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
    fontSize: 12.5, fontWeight: 600, transition: 'all .15s',
    ...(active
      ? { background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#04121a' }
      : { color: 'var(--muted)' }),
  });
  const btn = (active: boolean): React.CSSProperties => ({
    flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 8,
    cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all .15s',
    ...(active
      ? { background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#04121a', boxShadow: '0 0 16px rgba(39,224,200,.35)' }
      : { background: 'rgba(255,255,255,.05)', color: 'var(--muted)' }),
  });

  const cssVars = {
    '--accent': T.accent, '--accent2': T.accent2, '--text': T.text,
    '--muted': T.muted, '--border': T.border, '--panel': T.panel, '--bg': T.bg,
  } as React.CSSProperties;

  return (
    <div style={{ position:'fixed', inset:0, overflow:'hidden', fontFamily:"'Space Grotesk',sans-serif", color:'var(--text)', background:`radial-gradient(1200px 820px at 50% 42%, ${T.bg2} 0%, ${T.bg} 72%)`, ...cssVars }}>

      {/* grid */}
      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)', backgroundSize:'46px 46px', pointerEvents:'none', maskImage:'radial-gradient(circle at 50% 45%,#000 30%,transparent 78%)', WebkitMaskImage:'radial-gradient(circle at 50% 45%,#000 30%,transparent 78%)' }} />

      {/* canvas */}
      <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', display:'block', touchAction:'none', cursor:'grab' }} />

      {/* vignette */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', boxShadow:'inset 0 0 220px 30px rgba(0,0,0,.55)' }} />

      {/* ── TOP BAR ── */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:62, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', zIndex:30, background:'linear-gradient(180deg,rgba(5,7,13,.82),rgba(5,7,13,0))', pointerEvents:'none' }}>

        {/* logo */}
        <div style={{ display:'flex', alignItems:'center', gap:12, pointerEvents:'auto' }}>
          <div style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', border:`1.5px solid var(--accent)`, transform:'rotate(45deg)', boxShadow:`0 0 18px ${T.accent}55` }}>
            <div style={{ width:9, height:9, background:'var(--accent)', boxShadow:`0 0 12px var(--accent)` }} />
          </div>
          <div style={{ lineHeight:1 }}>
            <div style={{ fontSize:19, fontWeight:700, letterSpacing:'.34em', paddingLeft:'.34em' }}>{process.env.NEXT_PUBLIC_BRAND_NAME || 'VÉRTICE'}</div>
            <div style={{ fontSize:10, letterSpacing:'.26em', color:'var(--muted)', textTransform:'uppercase', marginTop:3 }}>Red de movimiento · {process.env.NEXT_PUBLIC_REGION_LABEL || 'Gobernación'}</div>
          </div>
        </div>

        {/* search */}
        <div style={{ position:'relative', width:'min(380px,38vw)', pointerEvents:'auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, height:38, padding:'0 14px', background:'var(--panel)', backdropFilter:'blur(14px)', border:'1px solid var(--border)', borderRadius:11 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink:0 }}>
              <circle cx="5.5" cy="5.5" r="4.5" stroke="var(--muted)" strokeWidth="1.5"/>
              <path d="M9 9L11.5 11.5" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar persona o ID de adhesión…"
              style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text)', fontFamily:"'Space Grotesk',sans-serif", fontSize:13 }}
            />
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'var(--muted)' }}>{stats.total} miembros</span>
          </div>
          {searchResults.length > 0 && (
            <div style={{ position:'absolute', top:46, left:0, right:0, background:`rgba(${T.bg === '#e9e7df' ? '255,255,255' : '9,14,22'},.92)`, backdropFilter:'blur(16px)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', animation:'vpop .16s ease', boxShadow:'0 18px 50px rgba(0,0,0,.5)', zIndex:10 }}>
              {searchResults.map(r => (
                <div key={r.nodeId} onClick={() => { engine?.select(r.nodeId); setQuery(''); }}
                  style={{ display:'flex', alignItems:'center', gap:11, padding:'9px 13px', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', flexShrink:0, background:r.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#04121a' }}>{r.initials}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.name}</div>
                    <div style={{ fontSize:10, color:'var(--muted)' }}>{r.roleLabel} · nivel {r.depth}</div>
                  </div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'var(--accent)' }}>{r.idCode}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* theme + share */}
        <div style={{ display:'flex', alignItems:'center', gap:14, pointerEvents:'auto' }}>
          <div style={{ display:'flex', gap:7 }}>
            {THEME_KEYS.map(k => (
              <div key={k} onClick={() => handleTheme(k)} title={k}
                style={{ width:20, height:20, borderRadius:'50%', cursor:'pointer', background:`linear-gradient(135deg,${THEMES[k].accent},${THEMES[k].accent2})`, outline:themeKey===k?`2px solid ${THEMES[k].accent}`:'2px solid transparent', outlineOffset:2, transition:'transform .15s' }} />
            ))}
          </div>
          {meData && (
            <div onClick={() => setShareOpen(true)}
              style={{ display:'flex', alignItems:'center', gap:9, height:38, padding:'0 17px', borderRadius:11, cursor:'pointer', fontWeight:600, fontSize:13, color:'#04121a', background:'linear-gradient(135deg,var(--accent),var(--accent2))', boxShadow:`0 0 22px ${T.accent}66` }}>
              <span style={{ fontSize:15 }}>⟢</span> Mi ID de adhesión
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM LEFT: leyenda + vista ── */}
      <div style={{ position:'absolute', left:20, bottom:20, zIndex:25, display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ background:'var(--panel)', backdropFilter:'blur(14px)', border:'1px solid var(--border)', borderRadius:13, padding:'12px 14px', width:188 }}>
          <div style={{ fontSize:10, letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)', marginBottom:9 }}>Vista de red</div>
          <div style={{ display:'flex', gap:6, marginBottom:12 }}>
            <div onClick={() => handleView('global')} style={pill(view==='global')}>Global</div>
            <div onClick={() => handleView('personal')} style={pill(view==='personal')}>La mía</div>
          </div>
          <div style={{ fontSize:10, letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)', marginBottom:8 }}>Estado</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:11.5 }}>
            {[
              { col: 'var(--accent)', label: 'Activo' },
              { col: 'var(--accent2)', label: 'Nuevo ingreso' },
              { col: '#3a434c', label: 'Inactivo' },
            ].map(({ col, label }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:9, height:9, borderRadius:'50%', background:col, boxShadow:`0 0 8px ${col}`, flexShrink:0 }} />{label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM CENTER: layout + live ── */}
      <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', bottom:20, zIndex:25, display:'flex', alignItems:'center', gap:8, background:'var(--panel)', backdropFilter:'blur(14px)', border:'1px solid var(--border)', borderRadius:14, padding:'7px 8px' }}>
        {([['radial','◎ Radial'],['tree','⋔ Árbol'],['force','✦ Orgánico']] as [LayoutMode, string][]).map(([m, label]) => (
          <div key={m} onClick={() => handleLayout(m)} style={btn(layout===m)}>{label}</div>
        ))}
        <div style={{ width:1, height:22, background:'var(--border)', margin:'0 2px' }} />
        <div onClick={() => engine?.fitView(true)} title="Encuadrar todo"
          style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:32, borderRadius:9, cursor:'pointer', fontSize:14, color:'var(--text)' }}>⤢</div>
        <div onClick={handleToggleLive}
          style={{ display:'flex', alignItems:'center', gap:7, height:32, padding:'0 12px', borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:500, color: live ? 'var(--accent)' : 'var(--muted)' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background: live ? 'var(--accent)' : 'var(--muted)', boxShadow: live ? `0 0 9px var(--accent)` : 'none', animation: live ? 'vbreath 1.4s infinite' : 'none' }} />
          {live ? 'En vivo' : 'Pausado'}
        </div>
      </div>

      {/* ── BOTTOM RIGHT: stats ── */}
      <div style={{ position:'absolute', right:20, bottom:20, zIndex:25, display:'flex', gap:9 }}>
        {[
          { value: stats.total, label:'Miembros', color:'var(--text)' },
          { value: stats.maxDepth, label:'Profundidad', color:'var(--accent)' },
          { value: stats.ramas, label:'Ramas', color:'var(--text)' },
          { value: stats.nuevos, label:'Nuevos', color:'var(--accent2)' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--panel)', backdropFilter:'blur(14px)', border:'1px solid var(--border)', borderRadius:13, padding:'11px 15px', minWidth:78 }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:23, fontWeight:600, color:s.color, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--muted)', marginTop:5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── DETAIL PANEL ── */}
      {selectedId >= 0 && selData && (
        <div style={{ position:'absolute', top:74, right:20, width:340, maxWidth:'92vw', maxHeight:'calc(100vh - 170px)', overflowY:'auto', zIndex:28, background:`rgba(${T.bg === '#e9e7df' ? '255,255,255' : '9,14,22'},.86)`, backdropFilter:'blur(20px)', border:'1px solid var(--border)', borderRadius:18, animation:'vrise .22s ease', boxShadow:'0 24px 70px rgba(0,0,0,.55)' }}>
          <div style={{ position:'relative', padding:'20px 20px 16px', background:`linear-gradient(180deg,${selData.color}28,transparent)` }}>
            <div onClick={() => engine?.clearSel()}
              style={{ position:'absolute', top:14, right:14, width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--muted)', fontSize:15 }}>✕</div>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:'50%', flexShrink:0, background:`linear-gradient(135deg,${selData.color},${selData.color}55)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#04121a', boxShadow:`0 0 26px ${selData.color}66`, border:`2px solid ${selData.color}88` }}>{selData.initials}</div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:18, fontWeight:700, lineHeight:1.15 }}>{selData.name}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
                  <span style={{ fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:20, background:`${selData.color}33`, color:selData.color }}>{selData.roleLabel}</span>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--muted)' }}>{selData.idCode}</span>
                </div>
              </div>
            </div>
            {selData.isMe && (
              <div style={{ marginTop:12, fontSize:11, fontWeight:600, letterSpacing:'.16em', textTransform:'uppercase', color:'var(--accent)', display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', boxShadow:'0 0 8px var(--accent)' }} />Este eres tú
              </div>
            )}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:1, background:'var(--border)', margin:'0 0 4px' }}>
            {[
              { val: selData.depth, label: 'Nivel' },
              { val: selData.childrenCount, label: 'Hijos' },
              { val: selData.descCount, label: 'Red total', color: 'var(--accent)' },
            ].map(({ val, label, color }) => (
              <div key={label} style={{ background: T.bg === '#e9e7df' ? '#f3f1ea' : '#0a1018', padding:'13px 14px' }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:21, fontWeight:600, color: color || 'var(--text)' }}>{val}</div>
                <div style={{ fontSize:9.5, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted)', marginTop:3 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ padding:'14px 20px 6px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:10, letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)' }}>Linaje hasta el origen</span>
              <span style={{ fontSize:10, color:'var(--muted)' }}>{selData.statusLabel}</span>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:5, fontSize:11.5 }}>
              {selData.ancestors.map(a => (
                <span key={a.nodeId}>
                  <span onClick={() => engine?.select(a.nodeId)} style={{ cursor:'pointer', padding:'3px 9px', borderRadius:7, background:'rgba(255,255,255,.05)', color:'var(--text)' }}>{a.name}</span>
                  <span style={{ color:'var(--accent)', opacity:.6, marginLeft:5 }}>→</span>
                </span>
              ))}
              <span style={{ padding:'3px 9px', borderRadius:7, background:`${selData.color}33`, color:selData.color, fontWeight:600 }}>{selData.name}</span>
            </div>
          </div>

          {selData.hasParent && (
            <div onClick={() => engine?.select(selData.parentId)}
              style={{ margin:'10px 20px', padding:'11px 14px', borderRadius:11, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.06)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:9.5, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted)' }}>Adherido por</div>
                <div style={{ fontSize:13.5, fontWeight:600, marginTop:2 }}>{selData.parentName}</div>
              </div>
              <span style={{ color:'var(--accent)', fontSize:15 }}>↗</span>
            </div>
          )}

          {selData.hasChildren && (
            <div style={{ padding:'6px 20px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:9 }}>
                <span style={{ fontSize:10, letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)' }}>Adheridos directos · {selData.childrenCount}</span>
                <span onClick={() => { engine?.toggleCollapse(selectedId); }} style={{ fontSize:10.5, cursor:'pointer', color:'var(--accent)' }}>{selData.collapsed ? 'Expandir rama' : 'Colapsar rama'}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {selData.children.map(ch => (
                  <div key={ch.nodeId} onClick={() => engine?.select(ch.nodeId)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 9px', borderRadius:9, cursor:'pointer' }}>
                    <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, background:ch.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9.5, fontWeight:700, color:'#04121a' }}>{ch.initials}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12.5, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ch.name}</div>
                      <div style={{ fontSize:10, color:'var(--muted)' }}>{ch.roleLabel} · {ch.descCount} en su red</div>
                    </div>
                    <span style={{ color:'var(--muted)', fontSize:13 }}>›</span>
                  </div>
                ))}
                {selData.moreChildren > 0 && (
                  <div style={{ fontSize:11, color:'var(--muted)', padding:'4px 9px' }}>+ {selData.moreChildren} más en niveles inferiores</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SHARE MODAL ── */}
      {shareOpen && meData && (
        <div onClick={() => setShareOpen(false)}
          style={{ position:'absolute', inset:0, zIndex:50, background:'rgba(3,5,9,.72)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, animation:'vpop .2s ease' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width:430, maxWidth:'94vw', background:`linear-gradient(180deg,#0c1420,#080c14)`, border:'1px solid var(--border)', borderRadius:22, overflow:'hidden', boxShadow:'0 30px 90px rgba(0,0,0,.7)' }}>
            <div style={{ position:'relative', padding:'26px 26px 22px', textAlign:'center', background:`radial-gradient(420px 180px at 50% -20%,${T.accent}44,transparent)` }}>
              <div onClick={() => setShareOpen(false)}
                style={{ position:'absolute', top:16, right:16, width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--muted)' }}>✕</div>
              <div style={{ width:64, height:64, margin:'0 auto 14px', borderRadius:'50%', background:`linear-gradient(135deg,var(--accent),var(--accent2))`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, color:'#04121a', boxShadow:`0 0 34px ${T.accent}88` }}>{meData.initials}</div>
              <div style={{ fontSize:13, color:'var(--muted)' }}>Estás invitando como</div>
              <div style={{ fontSize:20, fontWeight:700, marginTop:2 }}>{meData.name}</div>
              <div style={{ fontSize:12, color:'var(--accent)', marginTop:3 }}>{meData.roleLabel} · {meData.descCount} personas en tu red</div>
            </div>
            <div style={{ padding:'4px 26px 24px' }}>
              <div style={{ fontSize:10, letterSpacing:'.22em', textTransform:'uppercase', color:'var(--muted)', margin:'14px 0 8px' }}>Tu ID de adhesión</div>
              <div onClick={() => { navigator.clipboard.writeText(meData.idCode).catch(() => {}); showToast('ID copiado: ' + meData.idCode); }}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'15px 18px', borderRadius:13, border:`1px dashed ${T.accent}88`, background:`${T.accent}14`, cursor:'pointer' }}>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:26, fontWeight:600, letterSpacing:'.14em', color:'var(--accent)' }}>{meData.idCode}</span>
                <span style={{ fontSize:11, color:'var(--muted)', display:'flex', alignItems:'center', gap:6 }}>⧉ copiar</span>
              </div>
              <div style={{ fontSize:10, letterSpacing:'.22em', textTransform:'uppercase', color:'var(--muted)', margin:'18px 0 8px' }}>Link de invitación</div>
              <div onClick={() => { navigator.clipboard.writeText(meData.link).catch(() => {}); showToast('Link de invitación copiado'); }}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'12px 16px', borderRadius:13, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.07)', cursor:'pointer' }}>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12.5, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{meData.link}</span>
                <span style={{ fontSize:11, color:'var(--accent)', flexShrink:0 }}>⧉</span>
              </div>
              <div style={{ marginTop:20, padding:'14px 16px', borderRadius:13, background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', fontSize:12, color:'var(--muted)', lineHeight:1.6 }}>
                Quien use tu ID quedará <strong style={{ color:'var(--text)' }}>enlazado como tu hijo directo</strong> en la red, sumando profundidad a tu rama. Cada persona pertenece a un solo padre.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{ position:'absolute', left:'50%', bottom:84, transform:'translateX(-50%)', zIndex:60, padding:'11px 20px', borderRadius:11, background:'var(--accent)', color:'#04121a', fontWeight:600, fontSize:13, boxShadow:`0 0 30px ${T.accent}88`, animation:'vrise .2s ease', whiteSpace:'nowrap' }}>{toast}</div>
      )}

      {/* ── HINT ── */}
      {!loading && (
        <div style={{ position:'absolute', top:70, left:'50%', transform:'translateX(-50%)', zIndex:20, fontSize:11, color:'var(--muted)', letterSpacing:'.04em', pointerEvents:'none', background:'rgba(5,7,13,.5)', padding:'5px 13px', borderRadius:20, whiteSpace:'nowrap' }}>
          Arrastra para mover · rueda para zoom · clic en un nodo para explorar su linaje
        </div>
      )}

      {/* ── LOADING ── */}
      {loading && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(5,7,13,.85)', zIndex:100 }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ width:42, height:42, border:`2px solid ${T.accent}`, borderTopColor:'transparent', borderRadius:'50%', animation:'vspin 1s linear infinite', margin:'0 auto 18px' }} />
            <div style={{ fontSize:14, color:'var(--muted)' }}>Cargando la red...</div>
          </div>
        </div>
      )}
    </div>
  );
}
