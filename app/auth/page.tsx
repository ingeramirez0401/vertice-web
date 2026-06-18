'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const returnTo = params.get('from') || '/red';

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setInfo(null);
    if (tab === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) { setError(err.message); setLoading(false); return; }
      setInfo('Revisa tu correo para confirmar tu cuenta, luego inicia sesión.');
      setLoading(false); return;
    }
    router.push(returnTo);
    router.refresh();
  };

  const inp = { background:'rgba(255,255,255,.06)', border:'1px solid rgba(120,200,210,.2)', borderRadius:10, padding:'11px 14px', color:'#dbeee9', fontSize:14, width:'100%', outline:'none', fontFamily:"'Space Grotesk',sans-serif" } as React.CSSProperties;
  const active = { background:'linear-gradient(135deg,#27e0c8,#5b9bff)', color:'#04121a', border:'none', cursor:'pointer', fontWeight:700 };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'radial-gradient(1200px 820px at 50% 42%, #0b1422 0%, #05070d 72%)', fontFamily:"'Space Grotesk',sans-serif", color:'#dbeee9' }}>
      <div style={{ width:420, maxWidth:'94vw', background:'rgba(9,14,22,.84)', backdropFilter:'blur(20px)', border:'1px solid rgba(120,200,210,.18)', borderRadius:22, overflow:'hidden', boxShadow:'0 30px 90px rgba(0,0,0,.6)' }}>

        <div style={{ padding:'28px 28px 0', textAlign:'center' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:18 }}>
            <div style={{ width:26, height:26, display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid #27e0c8', transform:'rotate(45deg)', boxShadow:'0 0 16px #27e0c855' }}>
              <div style={{ width:7, height:7, background:'#27e0c8' }} />
            </div>
            <div style={{ fontSize:20, fontWeight:700, letterSpacing:'.3em', paddingLeft:'.3em' }}>{process.env.NEXT_PUBLIC_BRAND_NAME || 'VÉRTICE'}</div>
          </div>
          <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,.05)', borderRadius:10, padding:4 }}>
            {(['login','signup'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(null); setInfo(null); }}
                style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', fontSize:13, fontWeight:600, fontFamily:"'Space Grotesk',sans-serif", cursor:'pointer', transition:'all .15s', ...(tab===t ? active : { background:'transparent', color:'#7c8a92' }) }}>
                {t === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handle} style={{ padding:'22px 28px 28px', display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'#7c8a92', display:'block', marginBottom:6 }}>Correo electrónico</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@ejemplo.com" style={inp} />
          </div>
          <div>
            <label style={{ fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'#7c8a92', display:'block', marginBottom:6 }}>Contraseña</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} />
          </div>

          {error && <div style={{ fontSize:12.5, color:'#ff6b6b', background:'rgba(255,107,107,.1)', border:'1px solid rgba(255,107,107,.2)', borderRadius:9, padding:'10px 14px' }}>{error}</div>}
          {info  && <div style={{ fontSize:12.5, color:'#27e0c8', background:'rgba(39,224,200,.1)', border:'1px solid rgba(39,224,200,.2)', borderRadius:9, padding:'10px 14px' }}>{info}</div>}

          <button type="submit" disabled={loading}
            style={{ height:46, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', gap:9, cursor: loading ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:14, fontFamily:"'Space Grotesk',sans-serif", border:'none', ...active, opacity: loading ? 0.7 : 1, marginTop:4 }}>
            {loading ? (
              <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:16, height:16, border:'2px solid #04121a', borderTopColor:'transparent', borderRadius:'50%', animation:'vspin 1s linear infinite', display:'inline-block' }} />
                Cargando...
              </span>
            ) : tab === 'login' ? 'Entrar a la red' : 'Crear cuenta'}
          </button>

          {returnTo.startsWith('/unirse/') && (
            <div style={{ fontSize:12, color:'#7c8a92', textAlign:'center', lineHeight:1.5 }}>
              Después de {tab === 'login' ? 'iniciar sesión' : 'registrarte'} se procesará tu adhesión.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
