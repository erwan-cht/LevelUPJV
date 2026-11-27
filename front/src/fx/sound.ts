// Effets sonores synthétisés avec Web Audio : aucun fichier à charger, aucun droit d'auteur, quelques octets.
// Le son peut être coupé (réglage mémorisé dans le navigateur) ; les navigateurs n'autorisent l'audio qu'après un geste de
// l'utilisateur, donc un son déclenché trop tôt est simplement ignoré.

const KEY = 'levelupjv-muted';
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

export const isMuted = () => muted;
export const setMuted = (value: boolean) => {
  muted = value;
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    /* réglage non mémorisé */
  }
  listeners.forEach((l) => l());
};
export const onMutedChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Une note : fréquence (Hz), début (s après maintenant), durée (s), forme d'onde, volume. */
function note(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = 'sine', volume = 0.07) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  const t = c.currentTime + at;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

const play = (fn: (c: AudioContext) => void) => {
  const c = audio();
  if (c) fn(c);
};

// Fréquences (Hz) : do5, mi5, sol5, do6, mi6, sol6
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1568;

export const sfx = {
  /** Bonne réponse : petit arpège montant. */
  success: () =>
    play((c) => {
      note(c, C5, 0, 0.18, 'triangle');
      note(c, E5, 0.08, 0.18, 'triangle');
      note(c, G5, 0.16, 0.3, 'triangle');
    }),
  /** Mauvaise réponse : deux notes descendantes, douces (pas de buzzer agressif). */
  wrong: () =>
    play((c) => {
      note(c, 330, 0, 0.16, 'sine', 0.06);
      note(c, 262, 0.13, 0.26, 'sine', 0.06);
    }),
  /** Niveau supérieur, podium : fanfare. */
  levelUp: () =>
    play((c) => {
      [C5, E5, G5, C6].forEach((f, i) => note(c, f, i * 0.11, 0.25, 'triangle', 0.08));
      note(c, G5, 0.5, 0.5, 'sawtooth', 0.04);
      note(c, C6, 0.5, 0.6, 'triangle', 0.08);
      note(c, E6, 0.62, 0.7, 'triangle', 0.07);
      note(c, G6, 0.74, 0.9, 'triangle', 0.06);
    }),
  /** Tic du compte à rebours. */
  tick: () => play((c) => note(c, 880, 0, 0.06, 'square', 0.03)),
  /** Début de partie. */
  start: () =>
    play((c) => {
      note(c, G5, 0, 0.12, 'square', 0.04);
      note(c, G5, 0.16, 0.12, 'square', 0.04);
      note(c, C6, 0.32, 0.4, 'square', 0.05);
    }),
  /** Clic discret. */
  pop: () => play((c) => note(c, 700, 0, 0.05, 'sine', 0.04)),
};
