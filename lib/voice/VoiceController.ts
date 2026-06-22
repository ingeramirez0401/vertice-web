export type VoiceState = 'idle' | 'listening' | 'processing';

export class VoiceController {
  private rec: SpeechRecognition | null = null;
  private _state: VoiceState = 'idle';

  onStateChange?: (s: VoiceState) => void;
  onTranscript?: (text: string) => void;
  onResult?: (text: string) => void;
  onError?: (msg: string) => void;

  static isSupported(): boolean {
    return typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }

  get state(): VoiceState { return this._state; }

  start(): void {
    if (this._state !== 'idle') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: typeof SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { this.onError?.('Tu navegador no soporta comandos de voz'); return; }

    this.rec = new SR();
    this.rec.lang = 'es-CO';
    this.rec.continuous = false;
    this.rec.interimResults = true;
    this.rec.maxAlternatives = 3;

    this.rec.onstart = () => {
      this._state = 'listening';
      this.onStateChange?.('listening');
    };

    this.rec.onresult = (e: SpeechRecognitionEvent) => {
      const last = e.results[e.results.length - 1];
      const text = last[0].transcript.trim();
      this.onTranscript?.(text);
      if (last.isFinal) {
        this._state = 'processing';
        this.onStateChange?.('processing');
        this.onResult?.(text.toLowerCase());
      }
    };

    this.rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      this._state = 'idle';
      this.onStateChange?.('idle');
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        this.onError?.(
          e.error === 'not-allowed' ? 'Permiso de micrófono denegado' : 'Error de reconocimiento'
        );
      }
    };

    // fires after result too — only reset if we never got a result
    this.rec.onend = () => {
      if (this._state === 'listening') {
        this._state = 'idle';
        this.onStateChange?.('idle');
      }
    };

    try { this.rec.start(); } catch { /* already running */ }
  }

  abort(): void {
    this.rec?.abort();
    this._state = 'idle';
    this.onStateChange?.('idle');
  }

  done(): void {
    this._state = 'idle';
    this.onStateChange?.('idle');
  }
}
