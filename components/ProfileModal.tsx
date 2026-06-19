'use client';

import { useState, useCallback } from 'react';
import { THEMES, type ThemeKey } from './MeshEngine';

// ── Level system ──────────────────────────────────────────────────────────────
const LEVELS = [
  { name: 'Adherente',   icon: '◦', color: '#6b7a82', min: 0,  next: 1  },
  { name: 'Activista',   icon: '◈', color: '#27e0c8', min: 1,  next: 5  },
  { name: 'Coordinador', icon: '◉', color: '#5b9bff', min: 5,  next: 15 },
  { name: 'Líder',       icon: '◆', color: '#b06cff', min: 15, next: 30 },
  { name: 'Director',    icon: '⬡', color: '#ffd86b', min: 30, next: 50 },
  { name: 'Regional',    icon: '★', color: '#ff6b35', min: 50, next: null },
] as const;

function lvlIdx(directos: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (directos >= LEVELS[i].min) return i;
  }
  return 0;
}

// ── Achievements ─────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: 'a1', emoji: '🌱', name: 'Primer Contacto',  desc: '1 adherido directo',   unlock: (d: number, t: number) => d >= 1   },
  { id: 'a2', emoji: '⚡', name: 'En Movimiento',    desc: '5 adheridos directos', unlock: (d: number, t: number) => d >= 5   },
  { id: 'a3', emoji: '💎', name: 'Diamante',          desc: '10 adheridos',         unlock: (d: number, t: number) => d >= 10  },
  { id: 'a4', emoji: '🌐', name: 'Nodo Central',     desc: '25 en tu red',         unlock: (d: number, t: number) => t >= 25  },
  { id: 'a5', emoji: '🔥', name: 'Fuerza Regional',  desc: '50 en tu red',         unlock: (d: number, t: number) => t >= 50  },
  { id: 'a6', emoji: '🚀', name: 'Sin Límites',      desc: '100 en tu red',        unlock: (d: number, t: number) => t >= 100 },
];

// ── Active challenge label ────────────────────────────────────────────────────
function getChallenge(directos: number) {
  if (directos === 0) return { label: 'Invita tu primer contacto',     goal: 1,  current: 0 };
  if (directos < 5)  return { label: `Forma tu grupo de 5`,            goal: 5,  current: directos };
  if (directos < 15) return { label: `Construye tu coordinación de 15`, goal: 15, current: directos };
  if (directos < 30) return { label: `Lleva tu red a 30 directos`,     goal: 30, current: directos };
  if (directos < 50) return { label: `Alcanza 50 para ser Regional`,   goal: 50, current: directos };
  return { label: '¡Máximo nivel alcanzado!', goal: directos, current: directos };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface MeData {
  name: string; initials: string; roleLabel: string;
  idCode: string; descCount: number; childrenCount: number;
  link: string; nodeId: number;
  verified?: boolean;
  municipio?: string | null;
}

interface Props {
  meData: MeData | null;
  themeKey: ThemeKey;
  onClose: () => void;
  onCenterMe: () => void;
}

export default function ProfileModal({ meData, themeKey, onClose, onCenterMe }: Props) {
  const T = THEMES[themeKey];
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(label);
    setTimeout(() => setCopied(null), 1600);
  }, []);

  const accentGrad = `linear-gradient(135deg,${T.accent},${T.accent2})`;
  const panelBg = T.bg === '#e9e7df' ? 'rgba(255,255,255,.94)' : 'rgba(8,12,20,.96)';

  if (!meData) {
    // Not yet in network
    return (
      <Overlay onClose={onClose} panelBg={panelBg} T={T}>
        <div style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>◇</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Aún no estás en la red</div>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 24 }}>
            Para unirte necesitas un código de adhesión de alguien que ya esté en VÉRTICE.
            Pídele a tu contacto que comparta su link contigo.
          </div>
          <div onClick={onClose}
            style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, background: accentGrad, color: '#04121a' }}>
            Entendido
          </div>
        </div>
      </Overlay>
    );
  }

  const d = meData.childrenCount;
  const t = meData.descCount;
  const li = lvlIdx(d);
  const lv = LEVELS[li];
  const nextLv = LEVELS[li + 1] ?? null;
  const pct = nextLv ? (d - lv.min) / (nextLv.min - lv.min) : 1;
  const challenge = getChallenge(d);
  const shareText = `Únete a la red conmigo en VÉRTICE 🌐 Usa mi código ${meData.idCode}: ${meData.link}`;

  return (
    <Overlay onClose={onClose} panelBg={panelBg} T={T}>
      {/* ── Header: avatar + level ── */}
      <div style={{ position: 'relative', padding: '28px 24px 20px', background: `radial-gradient(340px 200px at 30% -20%,${lv.color}44,transparent)`, borderBottom: `1px solid ${T.border}` }}>
        <div onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.muted, fontSize: 16, background: 'rgba(255,255,255,.06)' }}>✕</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* Avatar with level aura */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg,${lv.color},${lv.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#04121a', boxShadow: `0 0 0 3px ${T.bg === '#e9e7df' ? '#fff' : '#0a0f18'}, 0 0 0 5px ${lv.color}, 0 0 28px ${lv.color}66, 0 0 56px ${lv.color}33`, fontFamily: 'var(--font-display, var(--font-space, sans-serif))' }}>
              {meData.initials}
            </div>
            <div style={{ position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: '50%', background: lv.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#04121a', fontWeight: 800, border: `2px solid ${T.bg === '#e9e7df' ? '#fff' : '#0a0f18'}` }}>
              {li + 1}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1, fontFamily: 'var(--font-display, var(--font-space, sans-serif))' }}>{meData.name}</span>
              {meData.verified && (
                <span title="Identidad verificada" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(39,224,200,.18)', color: '#27e0c8', letterSpacing: '.06em' }}>✓ Verificado</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: `${lv.color}30`, color: lv.color, fontFamily: 'var(--font-display, var(--font-space, sans-serif))' }}>{lv.icon} {lv.name}</span>
              {meData.municipio && (
                <span style={{ fontSize: 10.5, color: T.muted }}>📍 {meData.municipio}</span>
              )}
            </div>

            {/* Level progress bar */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.muted, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: lv.color }}>{lv.name.toUpperCase()}</span>
                {nextLv && <span>{d} / {nextLv.min} → {nextLv.name}</span>}
                {!nextLv && <span style={{ color: lv.color }}>Nivel máximo ✓</span>}
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(1, pct) * 100}%`, background: `linear-gradient(90deg,${lv.color},${nextLv?.color ?? lv.color})`, borderRadius: 3, transition: 'width .6s ease' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Center on network button */}
        <div onClick={() => { onCenterMe(); onClose(); }}
          style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.accent, cursor: 'pointer', width: 'fit-content' }}>
          <span>◎</span><span>Ver mi posición en la red</span>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ overflowY: 'auto', flex: 1, maxHeight: 'calc(80vh - 200px)' }}>

        {/* ID de Adhesión */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: T.muted, marginBottom: 10 }}>Tu ID de Adhesión</div>
          <div onClick={() => copy(meData.idCode, 'id')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 14, border: `1.5px dashed ${T.accent}88`, background: `${T.accent}12`, cursor: 'pointer', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 28, fontWeight: 600, letterSpacing: '.16em', color: T.accent }}>{meData.idCode}</span>
            <span style={{ fontSize: 11, color: T.muted }}>{copied === 'id' ? '✓ Copiado' : '⧉ copiar'}</span>
          </div>

          {/* Share row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 11, background: '#25D366', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
            <a href={`https://t.me/share/url?url=${encodeURIComponent(meData.link)}&text=${encodeURIComponent(`Únete a mi red en VÉRTICE con código ${meData.idCode}`)}`} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 11, background: '#0088cc', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z"/></svg>
              Telegram
            </a>
            <div onClick={() => copy(meData.link, 'link')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 11, background: `${T.accent}22`, border: `1px solid ${T.accent}44`, color: T.accent, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {copied === 'link' ? '✓' : '⧉'} Link
            </div>
          </div>
        </div>

        {/* Network stats */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { val: d,   label: 'Directos',    color: T.text },
            { val: t,   label: 'En tu red',   color: T.accent },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,.05)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontFamily: 'var(--font-display, var(--font-space, sans-serif))', fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: T.muted, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Active challenge */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: T.muted, marginBottom: 10 }}>Próximo Reto</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{challenge.label}</span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, color: T.accent }}>{challenge.current}/{challenge.goal}</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(1, challenge.current / Math.max(1, challenge.goal)) * 100}%`, background: accentGrad, borderRadius: 4, transition: 'width .6s ease' }} />
          </div>
        </div>

        {/* Achievements */}
        <div style={{ padding: '16px 24px 24px' }}>
          <div style={{ fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: T.muted, marginBottom: 12 }}>Logros</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {ACHIEVEMENTS.map(a => {
              const unlocked = a.unlock(d, t);
              return (
                <div key={a.id}
                  style={{ borderRadius: 12, padding: '12px 8px', textAlign: 'center', background: unlocked ? `${T.accent}15` : 'rgba(255,255,255,.04)', border: `1px solid ${unlocked ? T.accent + '44' : 'transparent'}`, transition: 'all .2s' }}>
                  <div style={{ fontSize: 24, marginBottom: 4, opacity: unlocked ? 1 : 0.25, filter: unlocked ? 'none' : 'grayscale(1)' }}>{a.emoji}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: unlocked ? T.text : T.muted, lineHeight: 1.3 }}>{a.name}</div>
                  <div style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>{a.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// ── Shared overlay wrapper ────────────────────────────────────────────────────
function Overlay({ children, onClose, panelBg, T }: {
  children: React.ReactNode;
  onClose: () => void;
  panelBg: string;
  T: (typeof THEMES)[ThemeKey];
}) {
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 0' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, background: panelBg, backdropFilter: 'blur(28px)', borderRadius: '22px 22px 0 0', border: `1px solid ${T.border}`, borderBottom: 'none', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -24px 80px rgba(0,0,0,.6)', animation: 'vsheetin .32s cubic-bezier(.32,1.2,.4,1)', paddingBottom: 'var(--safe-b)' }}>
        {/* Drag indicator */}
        <div style={{ padding: '10px 0 4px', textAlign: 'center', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)', display: 'inline-block' }} />
        </div>
        {children}
      </div>
    </div>
  );
}
