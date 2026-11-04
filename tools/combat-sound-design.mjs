// Original, dry arcade foley samples: no game recordings or imported audio.
export const SAMPLE_RATE = 22050;
export const SOUNDS = {
  "punch-air": {
    duration: 0.12,
    air: true,
    low: 850,
    high: 3900,
    strength: 0.78,
  },
  "kick-air": {
    duration: 0.19,
    air: true,
    low: 420,
    high: 2700,
    strength: 0.92,
  },
  "slash-air": {
    duration: 0.15,
    air: true,
    low: 1300,
    high: 5400,
    strength: 0.86,
  },
  "punch-hit": { duration: 0.22, weight: 1, crack: 0.9, bass: 165 },
  "kick-hit": { duration: 0.28, weight: 1.3, crack: 1.05, bass: 135 },
  "heavy-hit": { duration: 0.36, weight: 1.6, crack: 1.2, bass: 120 },
  "energy-hit": {
    duration: 0.31,
    weight: 1.25,
    crack: 1.4,
    bass: 145,
    energy: true,
  },
  "slam-hit": { duration: 0.38, weight: 1.7, crack: 0.8, bass: 105 },
  "guard-hit": {
    duration: 0.16,
    weight: 0.45,
    crack: 1.25,
    bass: 260,
    guard: true,
  },
};
export function renderSound(name, variation = 0) {
  const p = SOUNDS[name];
  if (!p) throw Error(`Unknown sound: ${name}`);
  let seed = 13277 + variation * 331;
  const random = () =>
    (seed = (1664525 * seed + 1013904223) >>> 0) / 2147483648 - 1;
  const output = new Float32Array(Math.ceil(p.duration * SAMPLE_RATE));
  let low = 0,
    middle = 0,
    phase = 0,
    x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const color = 1 + (variation - 1) * 0.045;
  for (let i = 0; i < output.length; i++) {
    const t = i / SAMPLE_RATE,
      u = t / p.duration,
      n = random();
    low += 0.16 * (n - low);
    middle += 0.55 * (n - middle);
    const attack = Math.min(1, t / 0.0008);
    let value;
    if (p.air) {
      // A rising and falling resonant air band, rather than a pitched laser chirp.
      const sweep = Math.sin(Math.PI * u);
      const cutoff = (p.low + (p.high - p.low) * sweep) * color;
      const omega = 2 * Math.PI * Math.min(6500, cutoff) / SAMPLE_RATE;
      const alpha = Math.sin(omega) / 1.8;
      const a0 = 1 + alpha;
      const band = alpha / a0 * (n - x2) + 2 * Math.cos(omega) / a0 * y1 - (1 - alpha) / a0 * y2;
      x2 = x1; x1 = n; y2 = y1; y1 = band;
      const envelope = Math.sin(Math.PI * u) ** 1.7;
      value =
        (band * 0.6 + (n - middle) * 0.14 + low * 0.1) * envelope * p.strength;
    } else {
      const weight = p.weight;
      const frequency = (44 + (p.bass - 44) * Math.exp(-t / 0.025)) * color;
      phase += (2 * Math.PI * frequency) / SAMPLE_RATE;
      // Chest thud, crunchy midrange contact, sharp slap and a short cloth rattle.
      const body =
        Math.sin(phase) *
        Math.exp(-t / (0.043 + weight * 0.018)) *
        weight *
        0.48;
      const meat = low * Math.exp(-t / 0.037) * 2.5 * weight;
      const crack = (n - middle) * Math.exp(-t / 0.011) * p.crack * 1.8;
      const slap =
        (middle - low) *
        Math.exp(-Math.max(0, t - 0.009) / 0.024) *
        (t > 0.009 ? 1 : 0) *
        1.05;
      const tail = low * Math.exp(-t / 0.065) * 0.18;
      const ring = p.guard
        ? Math.sin(2 * Math.PI * 1380 * t) * Math.exp(-t / 0.025) * 0.26
        : 0;
      const energy = p.energy ? (n - low) * Math.exp(-t / 0.05) * 0.55 : 0;
      value =
        Math.tanh((body + meat + crack + slap + tail + ring + energy) * 1.9) *
        0.93;
    }
    const fade = Math.min(1, (p.duration - t) / 0.015);
    // Subtle 12-bit grain gives contacts a sampled arcade edge without clipping.
    output[i] =
      Math.round(
        Math.max(-0.96, Math.min(0.96, value * attack * fade)) * 2048,
      ) / 2048;
  }
  return output;
}
