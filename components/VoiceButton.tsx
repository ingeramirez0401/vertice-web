'use client';

import { useRef, useState, useEffect } from 'react';
import { VoiceController } from '@/lib/voice/VoiceController';
import { parseCommand } from '@/lib/voice/commands';
import type { VoiceCommand } from '@/lib/voice/commands';
import { THEMES } from './MeshEngine';
import type { ThemeKey } from './MeshEngine';

interface Props {
  themeKey: ThemeKey;
  onCommand: (cmd: VoiceCommand) => void;
  size?: number;
}

export default function VoiceButton({ themeKey, onCommand, size = 38 }: Props) {
  const T = THEMES[themeKey];
  const ctrlRef     = useRef<VoiceController | null>(null);
  const onCmdRef    = useRef(onCommand);
  onCmdRef.current  = onCommand; // always latest without re-creating controller

  const [vs,         setVs]        = useState<'idle' | 'listening' | 'processing'>('idle');
  const [transcript, setTranscript] = useState('');
  const [feedback,   setFeedback]   = useState('');
  const [supported,  setSupported]  = useState(false);

  useEffect(() => { setSupported(VoiceController.isSupported()); }, []);

  const getOrCreate = () => {
    if (ctrlRef.current) return ctrlRef.current;
    const c = new VoiceController();
    c.onStateChange = (s) => { setVs(s); if (s === 'idle') setTranscript(''); };
    c.onTranscript  = (t) => setTranscript(t);
    c.onResult      = (text) => {
      const cmd = parseCommand(text);
      onCmdRef.current(cmd);
      const fb = cmd.type === 'UNKNOWN' ? '⚠ No entendí ese comando' : `✓ ${cmd.label}`;
      setFeedback(fb);
      setTimeout(() => { setFeedback(''); c.done(); }, 1900);
    };
    c.onError = (msg) => {
      setFeedback(`⚠ ${msg}`);
      setTimeout(() => setFeedback(''), 2200);
    };
    ctrlRef.current = c;
    return c;
  };

  const handleClick = () => {
    if (vs === 'idle') {
      getOrCreate().start();
    } else {
      ctrlRef.current?.abort();
    }
  };

  if (!supported) return null;

  const isListening  = vs === 'listening';
  const isProcessing = vs === 'processing';
  const iconColor    = isListening ? T.accent : isProcessing ? T.accent2 : T.muted;
  const bubble       = feedback || (isListening && transcript ? transcript : '');

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>

      {/* transcript / feedback bubble */}
      {bubble && (
        <div style={{
          position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(9,14,22,.97)', backdropFilter: 'blur(14px)',
          border: `1px solid ${feedback.startsWith('✓') ? T.accent : T.border}`,
          borderRadius: 11, padding: '7px 13px',
          fontSize: 11.5, color: feedback.startsWith('✓') ? T.accent : T.text,
          whiteSpace: 'nowrap', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis',
          boxShadow: '0 8px 28px rgba(0,0,0,.5)', zIndex: 200,
          animation: 'vpop .14s ease',
        }}>
          {bubble}
        </div>
      )}

      {/* animated ring while listening */}
      {isListening && (
        <div style={{
          position: 'absolute',
          width: size + 14, height: size + 14,
          borderRadius: '50%',
          border: `2px solid ${T.accent}`,
          animation: 'vbreath 1s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      <div
        onClick={handleClick}
        title={isListening ? 'Detener — escuchando…' : 'Comando de voz'}
        style={{
          width: size, height: size, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all .18s',
          background: isListening ? `${T.accent}22` : 'rgba(255,255,255,.07)',
          border: `1px solid ${isListening ? T.accent : T.border}`,
          boxShadow: isListening ? `0 0 20px ${T.accent}55` : 'none',
          backdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}
      >
        {/* microphone SVG */}
        <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none">
          <rect x="9" y="2" width="6" height="11" rx="3" fill={iconColor} />
          <path d="M5 11a7 7 0 0 0 14 0" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="18" x2="12" y2="22" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
          <line x1="8" y1="22" x2="16" y2="22" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
