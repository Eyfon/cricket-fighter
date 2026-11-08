// Generate a fresh seed for each match; recorded seeds are only reused for debugging.
export function newBattleSeed() {
  if (globalThis.crypto?.getRandomValues)
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 0x100000000);
}

// Mulberry32: simulation randomness stays separate from sound and visual effects.
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

export function prepareBattleFrame(fighters, readInput) {
  // Fighter.step only reads the opponent's x. Freeze it before either fighter moves.
  const positions = fighters.map((fighter) => ({ x: fighter.x }));
  // Read both decisions before updating either fighter's movement or attack.
  const inputs = fighters.map(readInput);
  return fighters.map((fighter, index) => ({
    fighter,
    input: inputs[index],
    opponent: positions[1 - index],
  }));
}

export function separateFighters([a, b]) {
  const minimum = (a.def.width + b.def.width) / 2;
  if (a.ground && b.ground && !a.dodgeTimer && !b.dodgeTimer &&
      !a.capturedBy && !a.grabbing && !b.capturedBy && !b.grabbing &&
      Math.abs(a.x - b.x) < minimum) {
    const direction = a.x <= b.x ? 1 : -1;
    const overlap = minimum - Math.abs(a.x - b.x);
    a.x = clampPosition(a.x - direction * overlap / 2);
    b.x = clampPosition(b.x + direction * overlap / 2);
  }
}
const clampPosition = (x) => Math.max(38, Math.min(922, x));
