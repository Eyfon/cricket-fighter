const profile = (value) => Object.freeze({ ...value, reaction: Object.freeze(value.reaction) });
export const AI_PROFILES = Object.freeze({
  easy: profile({
    name: '简单', description: '单招为主，反应较慢，防守容易出现破绽。', reaction: [0.25, 0.34], think: 0.06,
    attackChance: 0.75, defendChance: 0.4, crouchAccuracy: 0.38,
    dodgeChance: 0.12, antiAir: 0.8, comboChance: 0.16, confirmDelay: 0.09, prediction: 0.25, bankChance: 0.25,
    temperature: 1.1, distanceError: 38, memory: 0, memorySeconds: 8,
    repeatPenalty: 0.2, jumpChance: 0.025, punish: 0.3,
  }),
  normal: profile({
    name: '正常', description: '按距离选择招式，掌握基础防守和命中接招。', reaction: [0.16, 0.20], think: 0.045,
    attackChance: 0.86, defendChance: 0.72, crouchAccuracy: 0.78,
    dodgeChance: 0.3, antiAir: 2.4, comboChance: 0.65, confirmDelay: 0.07, prediction: 0.85, bankChance: 0.4,
    temperature: 0.8, distanceError: 20, memory: 3, memorySeconds: 8,
    repeatPenalty: 0.45, jumpChance: 0.045, punish: 1,
  }),
  hard: profile({
    name: '困难', description: '更善于控制距离、防守反击，并参考近期对手习惯。', reaction: [0.13, 0.14], think: 0.03,
    attackChance: 0.92, defendChance: 0.86, crouchAccuracy: 0.95,
    dodgeChance: 0.42, antiAir: 5, comboChance: 0.92, confirmDelay: 0.05, prediction: 1, bankChance: 0.5,
    temperature: 0.65, distanceError: 8, memory: 8, memorySeconds: 10,
    repeatPenalty: 0.65, jumpChance: 0.055, punish: 1.4,
  }),
});
export const aiProfile = (difficulty) => AI_PROFILES[difficulty] || AI_PROFILES.normal;
