export const DEFAULT_RULES = {
  time: 60,
  wins: 2,
  healthMultiplier: 1,
  difficulty: "normal",
  p1Difficulty: "normal",
  p2Difficulty: "normal",
  stage: "sunset",
};
export const DEFAULT_OPTIONS = {
  volume: 0.5,
  muted: false,
  shake: true,
  scanlines: true,
  touch: "auto",
  directionControl: "joystick",
};
const choose = (value, values, fallback) =>
  values.includes(value) ? value : fallback;
export function normalizeRules(value = {}) {
  value = value && typeof value === "object" ? value : {};
  const difficulty = choose(value.difficulty, ["easy", "normal", "hard"], "normal");
  return {
    time: choose(Number(value.time), [0, 30, 60, 90], 60),
    wins: choose(Number(value.wins), [1, 2, 3], 2),
    healthMultiplier: choose(Number(value.healthMultiplier), [1, 2, 3, 5], 1),
    difficulty,
    p1Difficulty: choose(value.p1Difficulty, ["easy", "normal", "hard"], difficulty),
    p2Difficulty: choose(value.p2Difficulty, ["easy", "normal", "hard"], difficulty),
    stage: choose(
      value.stage,
      ["sunset", "midnight", "training", "neon", "factory", "bamboo", "dairy"],
      "sunset",
    ),
  };
}
export function normalizeOptions(value = {}) {
  value = value && typeof value === "object" ? value : {};
  return {
    volume:
      typeof value.volume === "number" && Number.isFinite(value.volume)
        ? Math.max(0, Math.min(1, value.volume))
        : 0.5,
    muted: typeof value.muted === "boolean" ? value.muted : false,
    shake: typeof value.shake === "boolean" ? value.shake : true,
    scanlines: typeof value.scanlines === "boolean" ? value.scanlines : true,
    touch: choose(value.touch, ["auto", "always", "never"], "auto"),
    directionControl: choose(value.directionControl, ["dpad", "joystick"], "joystick"),
  };
}
export function loadPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem("cricket-fighter-menu-v1"));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
export function savePreferences(value) {
  try {
    localStorage.setItem("cricket-fighter-menu-v1", JSON.stringify(value));
  } catch {
    /* Playable even when browser storage is disabled. */
  }
}
