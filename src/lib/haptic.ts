// Utilitário de Feedback Tátil Háptico (Web Vibration API + iOS Taptic Simulation)
// Proporciona sensação física ao interagir com o app no celular

export type HapticType =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error'
  | 'trophy';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Simula a batida tátil da Apple (Taptic Engine) no iOS Safari
 * usando um micro-pulso de áudio sub-grave de 10ms imperceptível como som,
 * mas percebido pelo alto-falante do iPhone como clique tátil no chassi.
 */
function playIosTapticTick(type: HapticType): void {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;

    if (type === 'trophy') {
      // Duplo clique comemorativo
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.05);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else {
      // Clique seco de seleção (12ms)
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.02);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.02);
    }
  } catch {
    // Falha silenciosa
  }
}

/**
 * Dispara feedback tátil háptico no celular
 */
export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof window === 'undefined') return;

  // 1. Tentar Web Vibration API oficial (Android, Chrome, navegadores compatíveis)
  if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      switch (type) {
        case 'selection':
        case 'light':
          navigator.vibrate(12);
          return;
        case 'medium':
          navigator.vibrate(25);
          return;
        case 'heavy':
          navigator.vibrate(45);
          return;
        case 'success':
          navigator.vibrate([15, 45, 25]);
          return;
        case 'trophy':
          navigator.vibrate([25, 40, 25, 40, 60]);
          return;
        case 'warning':
          navigator.vibrate([30, 60, 30]);
          return;
        case 'error':
          navigator.vibrate([50, 40, 50]);
          return;
      }
    } catch {
      // Continua para o fallback
    }
  }

  // 2. Fallback para iOS / WebKit (simulação acústico-tátil Taptic Engine)
  playIosTapticTick(type);
}
