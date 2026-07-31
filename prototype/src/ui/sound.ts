// Tiny WebAudio bleeps — no assets, no network (constitution #6).

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, duration: number, gain = 0.08): void {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration);
}

/** Ascending two-tone cheer for a goal scored. */
export function goalSound(): void {
  tone(523, 0, 0.18);
  tone(784, 0.12, 0.3);
}

/** Low thud for a goal conceded. */
export function concedeSound(): void {
  tone(196, 0, 0.3, 0.1);
  tone(147, 0.15, 0.4, 0.08);
}

export function whistleSound(): void {
  tone(2093, 0, 0.25, 0.05);
}
