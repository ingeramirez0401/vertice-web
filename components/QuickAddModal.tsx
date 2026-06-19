'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { THEMES, type ThemeKey } from './MeshEngine';

interface Municipio { codigo: string; nombre: string; }
interface Props {
  themeKey: ThemeKey;
  onClose: () => void;
  onSuccess: (name: string) => void;
}

export default function QuickAddModal({ themeKey, onClose, onSuccess }: Props) {
  const T = THEMES[themeKey];
  const supabase = createClient();

  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [name,       setName]       = useState('');
  const [cedula,     setCedula]     = useState('');
  const [phone,      setPhone]      = useState('');
  const [muniCode,   setMuniCode]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    supabase.from('vtx_municipios').select('codigo, nombre').order('nombre')
      .then(({ data }) => { if (data) setMunicipios(data); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const panelBg = T.bg === '#e9e7df' ? 'rgba(255,255,255,.96)' : 'rgba(8,12,20,.97)';
  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,.06)', border: `1px solid ${T.border}`,
    borderRadius: 10, padding: '10px 14px', color: T.text, fontSize: 13.5,
    width: '100%', outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
  };
  const accentGrad = `linear-gradient(135deg,${T.accent},${T.accent2})`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); setError(null);
    const { error: err } = await supabase.rpc('vtx_quick_add', {
      p_name:             name.trim(),
      p_cedula:           cedula.trim() || null,
      p_phone:            phone.trim()  || null,
      p_municipio_codigo: muniCode      || null,
    });
    setLoading(false);
    if (err) {
      const msg = err.message.includes('ya está registrada')
        ? 'Esta cédula ya está en la red.'
        : err.message.includes('no está registrado')
        ? 'Tu usuario no aparece en la red. Pide al admin que lo vincule.'
        : err.message;
      setError(msg);
      return;
    }
    onSuccess(name.trim());
  };

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, background: panelBg, backdropFilter: 'blur(28px)', borderRadius: '22px 22px 0 0', border: `1px solid ${T.border}`, borderBottom: 'none', paddingBottom: 'var(--safe-b)', animation: 'vsheetin .32s cubic-bezier(.32,1.2,.4,1)', boxShadow: '0 -24px 80px rgba(0,0,0,.6)' }}>

        {/* Handle */}
        <div style={{ padding: '10px 0 4px', textAlign: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)', display: 'inline-block' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '12px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}` }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Captar simpatizante</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>Quedará bajo tu nodo en la red</div>
          </div>
          <div onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.muted, background: 'rgba(255,255,255,.07)' }}>✕</div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: T.muted, display: 'block', marginBottom: 5 }}>Nombre completo *</label>
            <input autoFocus required value={name} onChange={e => setName(e.target.value)}
              placeholder="Nombre Apellido" style={inp} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: T.muted, display: 'block', marginBottom: 5 }}>Cédula</label>
              <input value={cedula} onChange={e => setCedula(e.target.value)}
                placeholder="1001234567" inputMode="numeric" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: T.muted, display: 'block', marginBottom: 5 }}>Celular</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="3175551234" inputMode="tel" style={inp} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: T.muted, display: 'block', marginBottom: 5 }}>Municipio</label>
            <select value={muniCode} onChange={e => setMuniCode(e.target.value)}
              style={{ ...inp, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}>
              <option value="">Seleccionar municipio...</option>
              {municipios.map(m => (
                <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
              ))}
            </select>
          </div>

          {error && (
            <div style={{ fontSize: 12.5, color: '#ff6b6b', background: 'rgba(255,107,107,.1)', border: '1px solid rgba(255,107,107,.2)', borderRadius: 9, padding: '10px 14px' }}>{error}</div>
          )}

          <button type="submit" disabled={loading || !name.trim()}
            style={{ height: 48, borderRadius: 13, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: accentGrad, color: '#04121a', opacity: loading || !name.trim() ? 0.65 : 1, marginTop: 2 }}>
            {loading ? 'Captando...' : 'Captar simpatizante'}
          </button>

          <div style={{ fontSize: 11.5, color: T.muted, textAlign: 'center', lineHeight: 1.6 }}>
            El simpatizante queda en tu red sin necesitar cuenta.
            Si luego quiere invitar a otros, puede crear su acceso con su código.
          </div>
        </form>
      </div>
    </div>
  );
}
