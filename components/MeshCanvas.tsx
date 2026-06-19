'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MeshEngine, THEMES, ThemeKey, LayoutMode } from './MeshEngine';
import ProfileModal from './ProfileModal';
import QuickAddModal from './QuickAddModal';
import IntelDashboard from './IntelDashboard';

interface Props { userId: string; }

const THEME_KEYS: ThemeKey[] = ['cian', 'violeta', 'neon', 'claro'];

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const check = () => setM(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return m;
}

export default function MeshCanvas({ userId }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const engineRef   = useRef<MeshEngine | null>(null);
  const supabase    = useMemo(() => createClient(), []);
  const isMobile    = useIsMobile();

  const [loading,    setLoading]    = useState(true);
  const [tick,       setTick]       = useState(0);
  const [selectedId, setSelectedId] = useState(-1);
  const [query,      setQuery]      = useState('');
  const [shareOpen,    setShareOpen]    = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [intelOpen,    setIntelOpen]    = useState(false);
  const [toast,      setToast]      = useState<string | null>(null);
  const [themeKey,   setThemeKey]   = useState<ThemeKey>('cian');
  const [layout,     setLayout]     = useState<LayoutMode>('radial');
  const [view,       setView]       = useState<'global' | 'personal'>('global');
  const [live,       setLive]       = useState(true);
  // mobile bottom-sheet: 'hidden' | 'peek' | 'full'
  const [sheet,      setSheet]      = useState<'hidden'|'peek'|'full'>('hidden');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1700);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new MeshEngine();
    engine.init(canvas);
    engine.onSelect  = (id) => {
      setSelectedId(id);
      if (id >= 0) setSheet('peek');
      else setSheet('hidden');
    };
    engine.onToast  = showToast;
    engine.onUpdate = () => setTick(t => t + 1);
    engineRef.current = engine;
    engine.loadGraph(supabase, userId).then(() => setLoading(false));
    engine.startLoop();
    const channel = supabase.channel('vtx-members-stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vtx_members' },
        (payload) => engine.onRemoteJoin(payload.new as Record<string, unknown>))
      .subscribe();
    return () => { engine.destroy(); supabase.removeChannel(channel); };
  }, [userId, supabase, showToast]);

  const engine  = engineRef.current;
  const T       = engine ? engine.getTheme() : THEMES.cian;

  const stats        = useMemo(() => engine?.getStats() ?? { total:0, maxDepth:0, ramas:0, nuevos:0 }, [tick, engine]); // eslint-disable-line react-hooks/exhaustive-deps
  const searchResults= useMemo(() => engine?.search(query) ?? [], [query, tick, engine]); // eslint-disable-line react-hooks/exhaustive-deps
  const selData      = useMemo(() => engine && selectedId >= 0 ? engine.buildSel(selectedId) : null, [selectedId, tick, engine]); // eslint-disable-line react-hooks/exhaustive-deps
  const meData       = useMemo(() => engine?.buildMe(), [tick, engine]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTheme  = (k: ThemeKey)   => { setThemeKey(k); engine?.setTheme(k); };
  const handleLayout = (m: LayoutMode) => { setLayout(m);   engine?.setMode(m); };
  const handleView   = (v: 'global'|'personal') => { setView(v); engine?.setView(v); };
  const handleLive   = () => { const nl = !live; setLive(nl); if (engine) engine.live = nl; };
  const handleClose  = () => { setSelectedId(-1); setSheet('hidden'); engine?.clearSel(); };

  const handleProfile = () => setProfileOpen(true);

  const handleShare = async () => {
    if (!meData) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'VÉRTICE', text: `Únete a mi red con código ${meData.idCode}`, url: meData.link });
        return;
      } catch { /* fallback to modal */ }
    }
    setShareOpen(true);
  };

  // Bottom sheet drag
  const sheetTouchY  = useRef(0);
  const onSheetTouchStart = (e: React.TouchEvent) => { sheetTouchY.current = e.touches[0].clientY; };
  const onSheetTouchEnd   = (e: React.TouchEvent) => {
    const dy = sheetTouchY.current - e.changedTouches[0].clientY;
    if (dy > 40)  setSheet('full');
    if (dy < -40) {
      if (sheet === 'full') setSheet('peek');
      else handleClose();
    }
  };

  // Style helpers
  const pill = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
    fontSize: 12.5, fontWeight: 600, transition: 'all .15s',
    ...(active
      ? { background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#04121a' }
      : { color: 'var(--muted)' }),
  });
  const btn = (active: boolean): React.CSSProperties => ({
    flex: 1, textAlign: 'center' as const, padding: '7px 0', borderRadius: 8,
    cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all .15s',
    ...(active
      ? { background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#04121a', boxShadow: '0 0 16px rgba(39,224,200,.35)' }
      : { background: 'rgba(255,255,255,.05)', color: 'var(--muted)' }),
  });

  const cssVars = {
    '--accent': T.accent, '--accent2': T.accent2, '--text': T.text,
    '--muted': T.muted, '--border': T.border, '--panel': T.panel, '--bg': T.bg,
  } as React.CSSProperties;

  const accentGrad = `linear-gradient(135deg,${T.accent},${T.accent2})`;
  const panelBg    = T.bg === '#e9e7df' ? 'rgba(255,255,255,.86)' : 'rgba(9,14,22,.9)';

  // ─── MOBILE LAYOUT ───────────────────────────────────────────────────────────
  if (isMobile) {
    const sheetH = sheet === 'full' ? '80vh' : sheet === 'peek' ? 260 : 0;

    return (
      <div style={{ position:'fixed', inset:0, overflow:'hidden', fontFamily:'var(--font-space,sans-serif)', color:'var(--text)', background:`radial-gradient(800px 600px at 50% 38%,${T.bg2} 0%,${T.bg} 72%)`, ...cssVars }}>

        {/* grid */}
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)', backgroundSize:'46px 46px', pointerEvents:'none', maskImage:'radial-gradient(circle at 50% 40%,#000 20%,transparent 70%)', WebkitMaskImage:'radial-gradient(circle at 50% 40%,#000 20%,transparent 70%)' }} />

        {/* canvas */}
        <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', display:'block', touchAction:'none', cursor:'grab' }} />

        {/* vignette */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', boxShadow:'inset 0 0 180px 20px rgba(0,0,0,.5)' }} />

        {/* ── MOBILE TOP BAR ── */}
        <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:30, paddingTop:'var(--safe-t)', background:'linear-gradient(180deg,rgba(5,7,13,.88) 60%,transparent)', pointerEvents:'none' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', pointerEvents:'auto' }}>
            {/* logo */}
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:26, height:26, display:'flex', alignItems:'center', justifyContent:'center', border:`1.5px solid var(--accent)`, transform:'rotate(45deg)', boxShadow:`0 0 14px ${T.accent}55` }}>
                <div style={{ width:7, height:7, background:'var(--accent)' }} />
              </div>
              <span style={{ fontSize:16, fontWeight:800, letterSpacing:'.3em', paddingLeft:'.3em', fontFamily:'var(--font-display,var(--font-space,sans-serif))' }}>VÉRTICE</span>
            </div>
            {/* actions */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div onClick={() => setIntelOpen(true)}
                style={{ width:38, height:38, borderRadius:11, background:'var(--panel)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', backdropFilter:'blur(12px)', fontSize:16 }}
                title="Tablero electoral">📊</div>
              {meData && (
                <div onClick={() => setQuickAddOpen(true)}
                  style={{ width:38, height:38, borderRadius:11, background:`${T.accent}22`, border:`1px solid ${T.accent}55`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16 }}
                  title="Captar simpatizante">+</div>
              )}
              <div onClick={() => setSearchOpen(true)}
                style={{ width:38, height:38, borderRadius:11, background:'var(--panel)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', backdropFilter:'blur(12px)' }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="var(--muted)" strokeWidth="1.6"/>
                  <path d="M10.5 10.5L13 13" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
              <div onClick={handleProfile}
                style={{ height:38, padding:'0 14px', borderRadius:11, background: meData ? accentGrad : 'rgba(255,255,255,.1)', display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontWeight:700, fontSize:13, color: meData ? '#04121a' : 'var(--muted)' }}>
                <span>⟢</span><span>{meData ? 'Mi ID' : 'Perfil'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── MOBILE BOTTOM NAV ── */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:30, paddingBottom:'var(--safe-b)' }}>
          <div style={{ margin:'0 12px 12px', background:'var(--panel)', backdropFilter:'blur(16px)', border:'1px solid var(--border)', borderRadius:18, padding:'8px 10px', display:'flex', alignItems:'center', gap:6 }}>
            {([['radial','◎'],['tree','⋔'],['force','✦']] as [LayoutMode,string][]).map(([m,ico]) => (
              <div key={m} onClick={() => handleLayout(m)}
                style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'6px 0', borderRadius:10, cursor:'pointer', transition:'all .15s',
                  ...(layout===m ? { background:accentGrad, color:'#04121a' } : { color:'var(--muted)' }) }}>
                <span style={{ fontSize:16 }}>{ico}</span>
                <span style={{ fontSize:9, fontWeight:600, letterSpacing:'.06em' }}>{m==='radial'?'RADIAL':m==='tree'?'ÁRBOL':'ORGÁNICO'}</span>
              </div>
            ))}
            <div style={{ width:1, height:32, background:'var(--border)', margin:'0 2px' }} />
            <div onClick={() => engine?.fitView(true)}
              style={{ width:38, height:38, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16, color:'var(--text)' }}>⤢</div>
            <div onClick={handleLive}
              style={{ width:38, height:38, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <span style={{ width:10, height:10, borderRadius:'50%', background: live ? 'var(--accent)' : 'var(--muted)', boxShadow: live ? `0 0 8px var(--accent)` : 'none', animation: live ? 'vbreath 1.4s infinite' : 'none' }} />
            </div>
          </div>
        </div>

        {/* ── MOBILE BOTTOM SHEET ── */}
        {selectedId >= 0 && selData && (
          <>
            {/* backdrop */}
            {sheet === 'full' && (
              <div onClick={handleClose}
                style={{ position:'absolute', inset:0, zIndex:38, background:'rgba(0,0,0,.4)', backdropFilter:'blur(3px)' }} />
            )}
            <div className="vsheet"
              style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:40,
                height: sheetH,
                maxHeight:'80vh', background:panelBg, backdropFilter:'blur(24px)',
                borderRadius:'20px 20px 0 0', border:'1px solid var(--border)',
                borderBottom:'none', transition:'height .28s cubic-bezier(.32,1,.4,1)',
                display:'flex', flexDirection:'column', paddingBottom:'var(--safe-b)',
                overflow: 'hidden' }}
              onTouchStart={onSheetTouchStart}
              onTouchEnd={onSheetTouchEnd}>

              {/* drag handle */}
              <div style={{ flexShrink:0, padding:'10px 0 6px', textAlign:'center', cursor:'grab' }}
                onClick={() => setSheet(s => s === 'full' ? 'peek' : 'full')}>
                <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,.25)', display:'inline-block' }} />
              </div>

              {/* peek content */}
              <div style={{ padding:'0 18px 14px', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:48, height:48, borderRadius:'50%', flexShrink:0, background:`linear-gradient(135deg,${selData.color},${selData.color}55)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#04121a', boxShadow:`0 0 20px ${selData.color}55` }}>{selData.initials}</div>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:17, fontWeight:700, lineHeight:1.15, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{selData.name}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:4 }}>
                      <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:`${selData.color}30`, color:selData.color }}>{selData.roleLabel}</span>
                      <span style={{ fontFamily:'var(--font-mono,monospace)', fontSize:10, color:'var(--muted)' }}>{selData.idCode}</span>
                    </div>
                  </div>
                  <div onClick={handleClose}
                    style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--muted)', flexShrink:0, background:'rgba(255,255,255,.06)' }}>✕</div>
                </div>

                {/* mini stats */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:12 }}>
                  {[{v:selData.depth,l:'Nivel'},{v:selData.childrenCount,l:'Hijos'},{v:selData.descCount,l:'Red',c:'var(--accent)'}].map(({v,l,c}) => (
                    <div key={l} style={{ background:'rgba(255,255,255,.06)', borderRadius:10, padding:'10px 0', textAlign:'center' }}>
                      <div style={{ fontFamily:'var(--font-mono,monospace)', fontSize:20, fontWeight:600, color:c||'var(--text)' }}>{v}</div>
                      <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted)', marginTop:2 }}>{l}</div>
                    </div>
                  ))}
                </div>

                {sheet === 'peek' && (
                  <div onClick={() => setSheet('full')}
                    style={{ marginTop:10, textAlign:'center', fontSize:12, color:'var(--accent)', cursor:'pointer', padding:'8px 0' }}>
                    Ver linaje completo ↑
                  </div>
                )}
              </div>

              {/* full content (scrollable) */}
              {sheet === 'full' && (
                <div style={{ flex:1, overflowY:'auto', padding:'0 18px 20px' }}>

                  {selData.hasParent && (
                    <div onClick={() => engine?.select(selData.parentId)}
                      style={{ marginBottom:12, padding:'11px 14px', borderRadius:11, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted)' }}>Adherido por</div>
                        <div style={{ fontSize:14, fontWeight:600, marginTop:2 }}>{selData.parentName}</div>
                      </div>
                      <span style={{ color:'var(--accent)', fontSize:15 }}>↗</span>
                    </div>
                  )}

                  {/* ancestors */}
                  {selData.ancestors.length > 0 && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:9.5, letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)', marginBottom:8 }}>Linaje</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center', fontSize:12 }}>
                        {selData.ancestors.map(a => (
                          <span key={a.nodeId} onClick={() => engine?.select(a.nodeId)}
                            style={{ padding:'4px 10px', borderRadius:8, background:'rgba(255,255,255,.07)', cursor:'pointer' }}>{a.name}</span>
                        ))}
                        <span style={{ padding:'4px 10px', borderRadius:8, background:`${selData.color}30`, color:selData.color, fontWeight:600 }}>{selData.name}</span>
                      </div>
                    </div>
                  )}

                  {/* children */}
                  {selData.hasChildren && (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <span style={{ fontSize:9.5, letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)' }}>Directos · {selData.childrenCount}</span>
                        <span onClick={() => { engine?.toggleCollapse(selectedId); }} style={{ fontSize:11, cursor:'pointer', color:'var(--accent)' }}>
                          {selData.collapsed ? 'Expandir' : 'Colapsar'}
                        </span>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {selData.children.map(ch => (
                          <div key={ch.nodeId} onClick={() => { engine?.select(ch.nodeId); setSheet('peek'); }}
                            style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:10, background:'rgba(255,255,255,.04)', cursor:'pointer' }}>
                            <div style={{ width:30, height:30, borderRadius:'50%', background:ch.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#04121a', flexShrink:0 }}>{ch.initials}</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ch.name}</div>
                              <div style={{ fontSize:10, color:'var(--muted)' }}>{ch.roleLabel} · {ch.descCount} en su red</div>
                            </div>
                            <span style={{ color:'var(--muted)' }}>›</span>
                          </div>
                        ))}
                        {selData.moreChildren > 0 && (
                          <div style={{ fontSize:11, color:'var(--muted)', padding:'4px 10px' }}>+ {selData.moreChildren} más</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── MOBILE SEARCH MODAL ── */}
        {searchOpen && (
          <div style={{ position:'absolute', inset:0, zIndex:50, background:panelBg, backdropFilter:'blur(20px)', display:'flex', flexDirection:'column', paddingTop:'var(--safe-t)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
              <div onClick={() => { setSearchOpen(false); setQuery(''); }} style={{ cursor:'pointer', color:'var(--accent)', fontWeight:600, fontSize:14 }}>← Volver</div>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Buscar persona o ID…"
                style={{ flex:1, background:'rgba(255,255,255,.07)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', color:'var(--text)', fontSize:14, outline:'none', fontFamily:'var(--font-space,sans-serif)' }} />
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              {query && searchResults.length === 0 && (
                <div style={{ padding:'24px 20px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>Sin resultados</div>
              )}
              {searchResults.map(r => (
                <div key={r.nodeId} onClick={() => { engine?.select(r.nodeId); setQuery(''); setSearchOpen(false); }}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,.04)', cursor:'pointer' }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:r.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#04121a', flexShrink:0 }}>{r.initials}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600 }}>{r.name}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{r.roleLabel} · nivel {r.depth}</div>
                  </div>
                  <div style={{ fontFamily:'var(--font-mono,monospace)', fontSize:11, color:'var(--accent)' }}>{r.idCode}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROFILE MODAL (mobile) ── */}
        {profileOpen && (
          <ProfileModal
            meData={meData ?? null}
            themeKey={themeKey}
            onClose={() => setProfileOpen(false)}
            onCenterMe={() => { engine?.setView('personal'); setView('personal'); }}
          />
        )}

        {/* ── QUICK ADD + INTEL (mobile) ── */}
        {quickAddOpen && (
          <QuickAddModal
            themeKey={themeKey}
            onClose={() => setQuickAddOpen(false)}
            onSuccess={(name) => { setQuickAddOpen(false); showToast(`${name} captado ✓`); }}
          />
        )}
        {intelOpen && <IntelDashboard themeKey={themeKey} onClose={() => setIntelOpen(false)} />}

        {/* toast */}
        {toast && (
          <div style={{ position:'absolute', left:'50%', bottom: sheet !== 'hidden' ? `calc(${typeof sheetH === 'number' ? sheetH + 'px' : sheetH} + 12px)` : '80px', transform:'translateX(-50%)', zIndex:60, padding:'10px 18px', borderRadius:11, background:'var(--accent)', color:'#04121a', fontWeight:700, fontSize:13, whiteSpace:'nowrap', animation:'vrise .2s ease' }}>{toast}</div>
        )}

        {/* loading */}
        {loading && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(5,7,13,.9)', zIndex:100 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ width:38, height:38, border:`2px solid ${T.accent}`, borderTopColor:'transparent', borderRadius:'50%', animation:'vspin 1s linear infinite', margin:'0 auto 16px' }} />
              <div style={{ fontSize:13, color:'var(--muted)' }}>Cargando la red...</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ──────────────────────────────────────────────────────────
  return (
    <div style={{ position:'fixed', inset:0, overflow:'hidden', fontFamily:'var(--font-space,sans-serif)', color:'var(--text)', background:`radial-gradient(1200px 820px at 50% 42%,${T.bg2} 0%,${T.bg} 72%)`, ...cssVars }}>

      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)', backgroundSize:'46px 46px', pointerEvents:'none', maskImage:'radial-gradient(circle at 50% 45%,#000 30%,transparent 78%)', WebkitMaskImage:'radial-gradient(circle at 50% 45%,#000 30%,transparent 78%)' }} />
      <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', display:'block', touchAction:'none', cursor:'grab' }} />
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', boxShadow:'inset 0 0 220px 30px rgba(0,0,0,.55)' }} />

      {/* TOP BAR */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:62, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', zIndex:30, background:'linear-gradient(180deg,rgba(5,7,13,.82),rgba(5,7,13,0))', pointerEvents:'none' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, pointerEvents:'auto' }}>
          <div style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', border:`1.5px solid var(--accent)`, transform:'rotate(45deg)', boxShadow:`0 0 18px ${T.accent}55` }}>
            <div style={{ width:9, height:9, background:'var(--accent)', boxShadow:`0 0 12px var(--accent)` }} />
          </div>
          <div style={{ lineHeight:1 }}>
            <div style={{ fontSize:19, fontWeight:800, letterSpacing:'.34em', paddingLeft:'.34em', fontFamily:'var(--font-display,var(--font-space,sans-serif))' }}>VÉRTICE</div>
            <div style={{ fontSize:10, letterSpacing:'.26em', color:'var(--muted)', textTransform:'uppercase', marginTop:3 }}>Red de movimiento</div>
          </div>
        </div>

        {/* search */}
        <div style={{ position:'relative', width:'min(380px,38vw)', pointerEvents:'auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, height:38, padding:'0 14px', background:'var(--panel)', backdropFilter:'blur(14px)', border:'1px solid var(--border)', borderRadius:11 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink:0 }}>
              <circle cx="5.5" cy="5.5" r="4.5" stroke="var(--muted)" strokeWidth="1.5"/>
              <path d="M9 9L11.5 11.5" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar persona o ID de adhesión…"
              style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:13 }} />
            <span style={{ fontFamily:'var(--font-mono,monospace)', fontSize:10, color:'var(--muted)' }}>{stats.total} miembros</span>
          </div>
          {searchResults.length > 0 && (
            <div style={{ position:'absolute', top:46, left:0, right:0, background:panelBg, backdropFilter:'blur(16px)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', animation:'vpop .16s ease', boxShadow:'0 18px 50px rgba(0,0,0,.5)', zIndex:10 }}>
              {searchResults.map(r => (
                <div key={r.nodeId} onClick={() => { engine?.select(r.nodeId); setQuery(''); }}
                  style={{ display:'flex', alignItems:'center', gap:11, padding:'9px 13px', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', flexShrink:0, background:r.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#04121a' }}>{r.initials}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.name}</div>
                    <div style={{ fontSize:10, color:'var(--muted)' }}>{r.roleLabel} · nivel {r.depth}</div>
                  </div>
                  <div style={{ fontFamily:'var(--font-mono,monospace)', fontSize:10, color:'var(--accent)' }}>{r.idCode}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* theme + actions */}
        <div style={{ display:'flex', alignItems:'center', gap:10, pointerEvents:'auto' }}>
          <div style={{ display:'flex', gap:7 }}>
            {THEME_KEYS.map(k => (
              <div key={k} onClick={() => handleTheme(k)} title={k}
                style={{ width:20, height:20, borderRadius:'50%', cursor:'pointer', background:`linear-gradient(135deg,${THEMES[k].accent},${THEMES[k].accent2})`, outline:themeKey===k?`2px solid ${THEMES[k].accent}`:'2px solid transparent', outlineOffset:2, transition:'transform .15s' }} />
            ))}
          </div>
          <div onClick={() => setIntelOpen(true)}
            style={{ display:'flex', alignItems:'center', gap:8, height:38, padding:'0 14px', borderRadius:11, cursor:'pointer', fontWeight:600, fontSize:12.5, color:T.text, background:'rgba(255,255,255,.07)', border:`1px solid ${T.border}` }}>
            📊 Tablero
          </div>
          {meData && (
            <div onClick={() => setQuickAddOpen(true)}
              style={{ display:'flex', alignItems:'center', gap:8, height:38, padding:'0 14px', borderRadius:11, cursor:'pointer', fontWeight:700, fontSize:12.5, color:T.accent, background:`${T.accent}18`, border:`1px solid ${T.accent}55` }}>
              + Captar
            </div>
          )}
          <div onClick={handleProfile}
            style={{ display:'flex', alignItems:'center', gap:9, height:38, padding:'0 17px', borderRadius:11, cursor:'pointer', fontWeight:700, fontSize:13, color: meData ? '#04121a' : T.muted, background: meData ? accentGrad : 'rgba(255,255,255,.07)', border: meData ? 'none' : `1px solid ${T.border}`, boxShadow: meData ? `0 0 22px ${T.accent}55` : 'none' }}>
            <span style={{ fontSize:15 }}>⟢</span> {meData ? 'Mi ID y perfil' : 'Mi perfil'}
          </div>
        </div>
      </div>

      {/* BOTTOM LEFT: vista */}
      <div style={{ position:'absolute', left:20, bottom:20, zIndex:25, display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ background:'var(--panel)', backdropFilter:'blur(14px)', border:'1px solid var(--border)', borderRadius:13, padding:'12px 14px', width:188 }}>
          <div style={{ fontSize:10, letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)', marginBottom:9 }}>Vista de red</div>
          <div style={{ display:'flex', gap:6, marginBottom:12 }}>
            <div onClick={() => handleView('global')} style={pill(view==='global')}>Global</div>
            <div onClick={() => handleView('personal')} style={pill(view==='personal')}>La mía</div>
          </div>
          <div style={{ fontSize:10, letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)', marginBottom:8 }}>Estado</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:11.5 }}>
            {[{col:'var(--accent)',l:'Activo'},{col:'var(--accent2)',l:'Nuevo ingreso'},{col:'#3a434c',l:'Inactivo'}].map(({col,l}) => (
              <div key={l} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:9, height:9, borderRadius:'50%', background:col, boxShadow:`0 0 8px ${col}`, flexShrink:0 }} />{l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM CENTER: layout + live */}
      <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', bottom:20, zIndex:25, display:'flex', alignItems:'center', gap:8, background:'var(--panel)', backdropFilter:'blur(14px)', border:'1px solid var(--border)', borderRadius:14, padding:'7px 8px' }}>
        {([['radial','◎ Radial'],['tree','⋔ Árbol'],['force','✦ Orgánico']] as [LayoutMode, string][]).map(([m, label]) => (
          <div key={m} onClick={() => handleLayout(m)} style={btn(layout===m)}>{label}</div>
        ))}
        <div style={{ width:1, height:22, background:'var(--border)', margin:'0 2px' }} />
        <div onClick={() => engine?.fitView(true)} title="Encuadrar todo"
          style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:32, borderRadius:9, cursor:'pointer', fontSize:14, color:'var(--text)' }}>⤢</div>
        <div onClick={handleLive}
          style={{ display:'flex', alignItems:'center', gap:7, height:32, padding:'0 12px', borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:500, color: live ? 'var(--accent)' : 'var(--muted)' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background: live ? 'var(--accent)' : 'var(--muted)', boxShadow: live ? `0 0 9px var(--accent)` : 'none', animation: live ? 'vbreath 1.4s infinite' : 'none' }} />
          {live ? 'En vivo' : 'Pausado'}
        </div>
      </div>

      {/* BOTTOM RIGHT: stats */}
      <div style={{ position:'absolute', right:20, bottom:20, zIndex:25, display:'flex', gap:9 }}>
        {[{value:stats.total,label:'Miembros',color:'var(--text)'},{value:stats.maxDepth,label:'Profundidad',color:'var(--accent)'},{value:stats.ramas,label:'Ramas',color:'var(--text)'},{value:stats.nuevos,label:'Nuevos',color:'var(--accent2)'}].map(s => (
          <div key={s.label} style={{ background:'var(--panel)', backdropFilter:'blur(14px)', border:'1px solid var(--border)', borderRadius:13, padding:'11px 15px', minWidth:78 }}>
            <div style={{ fontFamily:'var(--font-display,var(--font-space,sans-serif))', fontSize:26, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--muted)', marginTop:5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* DETAIL PANEL */}
      {selectedId >= 0 && selData && (
        <div style={{ position:'absolute', top:74, right:20, width:340, maxWidth:'92vw', maxHeight:'calc(100vh - 170px)', overflowY:'auto', zIndex:28, background:panelBg, backdropFilter:'blur(20px)', border:'1px solid var(--border)', borderRadius:18, animation:'vrise .22s ease', boxShadow:'0 24px 70px rgba(0,0,0,.55)' }}>
          <div style={{ position:'relative', padding:'20px 20px 16px', background:`linear-gradient(180deg,${selData.color}28,transparent)` }}>
            <div onClick={handleClose}
              style={{ position:'absolute', top:14, right:14, width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--muted)', fontSize:15 }}>✕</div>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:'50%', flexShrink:0, background:`linear-gradient(135deg,${selData.color},${selData.color}55)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#04121a', boxShadow:`0 0 26px ${selData.color}66`, border:`2px solid ${selData.color}88` }}>{selData.initials}</div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:18, fontWeight:700, lineHeight:1.15 }}>{selData.name}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
                  <span style={{ fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:20, background:`${selData.color}33`, color:selData.color }}>{selData.roleLabel}</span>
                  <span style={{ fontFamily:'var(--font-mono,monospace)', fontSize:11, color:'var(--muted)' }}>{selData.idCode}</span>
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
            {[{val:selData.depth,label:'Nivel'},{val:selData.childrenCount,label:'Hijos'},{val:selData.descCount,label:'Red total',color:'var(--accent)'}].map(({val,label,color}) => (
              <div key={label} style={{ background: T.bg === '#e9e7df' ? '#f3f1ea' : '#0a1018', padding:'13px 14px' }}>
                <div style={{ fontFamily:'var(--font-mono,monospace)', fontSize:21, fontWeight:600, color:color||'var(--text)' }}>{val}</div>
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
                  <div style={{ fontSize:11, color:'var(--muted)', padding:'4px 9px' }}>+ {selData.moreChildren} más</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PROFILE MODAL (desktop) */}
      {profileOpen && (
        <ProfileModal
          meData={meData ?? null}
          themeKey={themeKey}
          onClose={() => setProfileOpen(false)}
          onCenterMe={() => { engine?.setView('personal'); setView('personal'); }}
        />
      )}

      {/* QUICK ADD + INTEL (desktop) */}
      {quickAddOpen && (
        <QuickAddModal
          themeKey={themeKey}
          onClose={() => setQuickAddOpen(false)}
          onSuccess={(name) => { setQuickAddOpen(false); showToast(`${name} captado ✓`); }}
        />
      )}
      {intelOpen && <IntelDashboard themeKey={themeKey} onClose={() => setIntelOpen(false)} />}

      {/* TOAST */}
      {toast && (
        <div style={{ position:'absolute', left:'50%', bottom:84, transform:'translateX(-50%)', zIndex:60, padding:'11px 20px', borderRadius:11, background:'var(--accent)', color:'#04121a', fontWeight:600, fontSize:13, boxShadow:`0 0 30px ${T.accent}88`, animation:'vrise .2s ease', whiteSpace:'nowrap' }}>{toast}</div>
      )}

      {/* HINT */}
      {!loading && (
        <div style={{ position:'absolute', top:70, left:'50%', transform:'translateX(-50%)', zIndex:20, fontSize:11, color:'var(--muted)', letterSpacing:'.04em', pointerEvents:'none', background:'rgba(5,7,13,.5)', padding:'5px 13px', borderRadius:20, whiteSpace:'nowrap' }}>
          Arrastra · rueda para zoom · clic en un nodo
        </div>
      )}

      {/* LOADING */}
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
