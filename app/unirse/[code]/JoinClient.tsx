'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Inviter { full_name: string; role: string; subtree_size: number; depth: number; }
interface Props { code: string; inviter: Inviter; userId: string | null; }

export default function JoinClient({ code, inviter, userId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<'preview' | 'auth' | 'joining'>('preview');
  const [tab, setTab] = useState<'login' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inp = { background:'rgba(255,255,255,.06)', border:'1px solid rgba(120,200,210,.2)', borderRadius:10, padding:'10px 14px', color:'#dbeee9', fontSize:13.5, width:'100%', outline:'none', fontFamily:"'Space Grotesk',sans-serif" } as React.CSSProperties;

  const doJoin = async (uid: string, fullName: string) => {
    setStep('joining');
    const { error: err } = await supabase.rpc('vtx_join_with_code', { p_code: code, p_name: fullName });
    if (err) {
      setError(err.message.includes('ya pertenece') ? 'Este usuario ya pertenece a la red.' : err.message);
      setStep('auth');
      setLoading(false);
      return;
    }
    router.push('/red');
    router.refresh();
  };

  const handleAlreadyLoggedIn = async () => {
    if (!userId) { setStep('auth'); return; }
    setLoading(true);
    const { data: me } = await supabase.from('vtx_members').select('id').eq('user_id', userId).single();
    if (me) { router.push('/red'); return; }
    const { data: profile } = await supabase.auth.getUser();
    const n = profile?.user?.email?.split('@')[0] || 'Miembro';
    await doJoin(userId, n);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    if (tab === 'signup') {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) { setError(err.message); setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Error al crear la cuenta. Verifica tu correo.'); setLoading(false); return; }
      await doJoin(user.id, name || email.split('@')[0]);
    } else {
      const { data: { user }, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message); setLoading(false); return; }
      if (!user) return;
      const { data: me } = await supabase.from('vtx_members').select('id').eq('user_id', user.id).single();
      if (me) { router.push('/red'); return; }
      await doJoin(user.id, name || email.split('@')[0]);
    }
  };

  const S = { bg:'#05070d', accent:'#27e0c8', accent2:'#5b9bff', muted:'#7c8a92', text:'#dbeee9', panel:'rgba(9,14,22,.84)', border:'rgba(120,200,210,.18)' };
  const active = { background:`linear-gradient(135deg,${S.accent},${S.accent2})`, color:'#04121a', border:'none', cursor:'pointer', fontWeight:700 };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:`radial-gradient(1200px 820px at 50% 42%, #0b1422 0%, ${S.bg} 72%)`, fontFamily:"'Space Grotesk',sans-serif", color:S.text, padding:24 }}>
      <div style={{ width:460, maxWidth:'100%', display:'flex', flexDirection:'column', gap:16 }}>

        {/* inviter card */}
        <div style={{ background:S.panel, backdropFilter:'blur(20px)', border:`1px solid ${S.border}`, borderRadius:20, padding:24, textAlign:'center' }}>
          <div style={{ fontSize:11, letterSpacing:'.2em', textTransform:'uppercase', color:S.muted, marginBottom:12 }}>Invitado por</div>
          <div style={{ width:60, height:60, borderRadius:'50%', background:`linear-gradient(135deg,${S.accent},${S.accent2})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#04121a', margin:'0 auto 12px', boxShadow:`0 0 28px ${S.accent}66` }}>
            {inviter.full_name.split(' ').map(p => p[0]).slice(0,2).join('')}
          </div>
          <div style={{ fontSize:20, fontWeight:700 }}>{inviter.full_name}</div>
          <div style={{ fontSize:13, color:S.accent, marginTop:4 }}>{inviter.role}</div>
          <div style={{ display:'flex', justifyContent:'center', gap:24, marginTop:16, paddingTop:16, borderTop:`1px solid ${S.border}` }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:22, fontWeight:600, color:S.text }}>{inviter.subtree_size}</div>
              <div style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:S.muted, marginTop:2 }}>En su red</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:22, fontWeight:600, color:S.accent }}>{inviter.depth}</div>
              <div style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:S.muted, marginTop:2 }}>Nivel</div>
            </div>
          </div>
        </div>

        {/* action panel */}
        <div style={{ background:S.panel, backdropFilter:'blur(20px)', border:`1px solid ${S.border}`, borderRadius:20, padding:24 }}>

          {step === 'preview' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontSize:15, fontWeight:600, textAlign:'center' }}>
                Únete a la red de <span style={{ color:S.accent }}>{inviter.full_name.split(' ')[0]}</span>
              </div>
              <div style={{ fontSize:12.5, color:S.muted, textAlign:'center', lineHeight:1.6 }}>
                Quedarás enlazado como adherido directo. Obtendrás tu propio ID para invitar a otros.
              </div>
              {userId ? (
                <button onClick={handleAlreadyLoggedIn} disabled={loading}
                  style={{ height:46, borderRadius:12, fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700, border:'none', ...active, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Procesando…' : 'Unirme ahora'}
                </button>
              ) : (
                <button onClick={() => setStep('auth')}
                  style={{ height:46, borderRadius:12, fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700, border:'none', ...active }}>
                  Crear cuenta y unirme ⟢
                </button>
              )}
              <div style={{ fontSize:12, color:S.muted, textAlign:'center' }}>
                ¿Ya tienes cuenta? <span onClick={() => { setStep('auth'); setTab('login'); }} style={{ color:S.accent, cursor:'pointer' }}>Iniciar sesión</span>
              </div>
            </div>
          )}

          {step === 'joining' && (
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              <div style={{ width:38, height:38, border:`2px solid ${S.accent}`, borderTopColor:'transparent', borderRadius:'50%', animation:'vspin 1s linear infinite', margin:'0 auto 16px' }} />
              <div style={{ fontSize:14, color:S.muted }}>Procesando tu adhesión...</div>
            </div>
          )}

          {step === 'auth' && (
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,.05)', borderRadius:10, padding:4, marginBottom:4 }}>
                {(['signup','login'] as const).map(t => (
                  <button key={t} type="button" onClick={() => { setTab(t); setError(null); }}
                    style={{ flex:1, padding:'7px 0', borderRadius:8, border:'none', fontSize:12.5, fontWeight:600, fontFamily:"'Space Grotesk',sans-serif", cursor:'pointer', transition:'all .15s', ...(tab===t ? active : { background:'transparent', color:S.muted }) }}>
                    {t === 'signup' ? 'Registrarse' : 'Ya tengo cuenta'}
                  </button>
                ))}
              </div>

              {tab === 'signup' && (
                <div>
                  <label style={{ fontSize:10.5, letterSpacing:'.18em', textTransform:'uppercase', color:S.muted, display:'block', marginBottom:5 }}>Tu nombre completo</label>
                  <input required value={name} onChange={e => setName(e.target.value)} placeholder="Nombre Apellido" style={inp} />
                </div>
              )}
              <div>
                <label style={{ fontSize:10.5, letterSpacing:'.18em', textTransform:'uppercase', color:S.muted, display:'block', marginBottom:5 }}>Correo electrónico</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" style={inp} />
              </div>
              <div>
                <label style={{ fontSize:10.5, letterSpacing:'.18em', textTransform:'uppercase', color:S.muted, display:'block', marginBottom:5 }}>Contraseña</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} />
              </div>

              {error && <div style={{ fontSize:12.5, color:'#ff6b6b', background:'rgba(255,107,107,.1)', border:'1px solid rgba(255,107,107,.2)', borderRadius:9, padding:'10px 14px' }}>{error}</div>}

              <button type="submit" disabled={loading}
                style={{ height:46, borderRadius:12, fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700, border:'none', ...active, opacity: loading ? 0.7 : 1, marginTop:2 }}>
                {loading ? 'Procesando...' : tab === 'signup' ? 'Crear cuenta y unirme' : 'Entrar y unirme'}
              </button>

              <button type="button" onClick={() => setStep('preview')} style={{ background:'none', border:'none', color:S.muted, fontSize:12, cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif" }}>← Volver</button>
            </form>
          )}
        </div>

        <div style={{ textAlign:'center', fontSize:11, color:S.muted }}>
          <span style={{ fontWeight:700, letterSpacing:'.2em', color:S.accent }}>VÉRTICE</span> · Red de movimiento
        </div>
      </div>
    </div>
  );
}
