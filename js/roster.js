import { installAnimations } from "./animation-data.js";
import { assertRoster } from "./character-schema.js";
// See docs/CHARACTER-SPEC.md before adding or balancing a character.
// Source rectangles follow each generated pose; scale preserves anatomy.
const atlas = "./assets/characters/arcade-fighters.png";
function fighterSprites(rects) {
  const states = [
    "idle",
    "guard",
    "punch",
    "kick",
    "specialPunch",
    "hurt",
    "jump",
    "ko",
  ];
  const result = {};
  rects.forEach((rect, i) => {
    result[states[i]] = {
      src: atlas,
      rect,
      scale: 0.65,
      anchorX: i === 2 ? 0.39 : i === 3 ? 0.36 : 0.5,
    };
  });
  result.walk = { ...result.idle };
  result.specialKick = { ...result.kick };
  result.skill = { ...result.punch };
  result.dodge = { ...result.guard };
  result.super = { ...result.punch };
  return result;
}
const blueSprites = fighterSprites([
  [34, 10, 225, 286],
  [348, 18, 216, 280],
  [628, 21, 290, 277],
  [945, 9, 297, 291],
  [35, 303, 228, 324],
  [356, 374, 251, 251],
  [679, 319, 189, 247],
  [912, 541, 317, 88],
]);
const redSprites = fighterSprites([
  [24, 641, 256, 285],
  [348, 644, 219, 282],
  [628, 644, 289, 282],
  [945, 635, 298, 291],
  [12, 971, 318, 260],
  [397, 963, 231, 268],
  [682, 927, 200, 248],
  [917, 1142, 323, 93],
]);

export const roster = [
  {
    id: "prototype-a",
    name: "苍岚",
    subtitle: "均衡 / 对空",
    description: "均衡对空型：用快拳和横踢牵制，升龙拦截跳跃，疾风突袭接近。",
    color: "#6bd9f0",
    accent: "#e1fbff",
    speed: 245,
    jump: 650,
    width: 62,
    height: 180,
    ai: {
      preferredRange: 95,
    },
    moves: {
      punch: {
        name: "探风拳",
        description: "快速近身起手，命中后可接脚、特殊招式或技能。",
        startup: 5,
        active: 4,
        recovery: 4,
        damage: 4,
        range: 100,
        box: {
          x: 18,
          y: -105,
          w: 88,
          h: 35,
        },
        stun: 17,
        knockback: 170,
        cost: 0,
        gain: 12,
        groundOnly: false,
        ai: {
          role: "poke",
          weight: 1,
        },
        cancel: ["kick", "specialPunch", "specialKick", "skill", "super"],
      },
      kick: {
        name: "横风踢",
        description: "中距离牵制，距离比拳远，但打空后恢复较慢。",
        startup: 10,
        active: 6,
        recovery: 7,
        damage: 6.5,
        range: 135,
        box: {
          x: 16,
          y: -90,
          w: 120,
          h: 48,
        },
        stun: 23,
        knockback: 260,
        cost: 0,
        gain: 15,
        groundOnly: false,
        ai: {
          role: "poke",
          weight: 1,
        },
      },
      specialPunch: {
        name: "破空升龙",
        description: "原地上挑，对空使用；打空后有较长破绽。",
        startup: 8,
        active: 8,
        recovery: 10,
        damage: 8.5,
        range: 105,
        box: {
          x: 4,
          y: -200,
          w: 90,
          h: 190,
        },
        stun: 30,
        knockback: 230,
        cost: 0,
        gain: 8,
        groundOnly: true,
        ai: {
          role: "antiAir",
          weight: 1,
        },
        effect: "rise",
        riseVelocity: -450,
        launch: 370,
      },
      specialKick: {
        name: "旋风横踢",
        description: "保持地面横向出脚，用于牵制和拳后接招。",
        startup: 12,
        active: 7,
        recovery: 9,
        damage: 8,
        range: 145,
        box: {
          x: 8,
          y: -135,
          w: 132,
          h: 95,
        },
        stun: 25,
        knockback: 300,
        cost: 0,
        gain: 10,
        groundOnly: true,
        ai: {
          role: "poke",
          weight: 1,
        },
        launch: 100,
      },
      skill: {
        name: "疾风突袭",
        description: "消耗一点能量的快速突进，用于接近远处对手。",
        startup: 10,
        active: 12,
        recovery: 9,
        damage: 11.5,
        range: 205,
        box: {
          x: 10,
          y: -135,
          w: 145,
          h: 115,
        },
        stun: 30,
        knockback: 330,
        cost: 1,
        gain: 0,
        groundOnly: true,
        ai: {
          role: "approach",
          weight: 1,
        },
        effect: "dash",
        dashSpeed: 560,
        launch: 120,
      },
      super: {
        name: "苍岚破空",
        description: "满气破防冲拳，适合命中确认后收尾。",
        startup: 16,
        active: 14,
        recovery: 11,
        damage: 19,
        range: 220,
        box: {
          x: 8,
          y: -145,
          w: 210,
          h: 125,
        },
        stun: 45,
        knockback: 500,
        cost: 3,
        gain: 0,
        groundOnly: true,
        ai: {
          role: "finisher",
          weight: 1,
        },
        effect: "dash",
        dashSpeed: 640,
        launch: 210,
        unblockable: true,
      },
    },
  },
  {
    id: "prototype-b",
    name: "赤锋",
    subtitle: "重击 / 突进",
    description: "重击突进型：用长脚和崩山掌压制，截空踢防跳，重突进争夺距离。",
    color: "#ff896f",
    accent: "#ffe0ab",
    speed: 225,
    jump: 620,
    width: 68,
    height: 180,
    ai: {
      preferredRange: 115,
    },
    moves: {
      punch: {
        name: "试探掌",
        description: "近距离试探，起手稍慢，可命中接招。",
        startup: 7,
        active: 4,
        recovery: 5,
        damage: 4,
        range: 105,
        box: {
          x: 18,
          y: -110,
          w: 92,
          h: 40,
        },
        stun: 18,
        knockback: 190,
        cost: 0,
        gain: 12,
        groundOnly: false,
        ai: {
          role: "poke",
          weight: 1,
        },
        cancel: ["kick", "specialPunch", "specialKick", "skill", "super"],
      },
      kick: {
        name: "裂岩重踢",
        description: "较慢的长距离重踢，伤害高但后摇较长。",
        startup: 13,
        active: 6,
        recovery: 8,
        damage: 7.5,
        range: 150,
        box: {
          x: 16,
          y: -100,
          w: 135,
          h: 55,
        },
        stun: 25,
        knockback: 300,
        cost: 0,
        gain: 15,
        groundOnly: false,
        ai: {
          role: "poke",
          weight: 1,
        },
      },
      specialPunch: {
        name: "崩山掌",
        description: "短距离推进的重掌，正面压制，打空易被反击。",
        startup: 14,
        active: 8,
        recovery: 11,
        damage: 9.5,
        range: 155,
        box: {
          x: 10,
          y: -145,
          w: 145,
          h: 125,
        },
        stun: 30,
        knockback: 340,
        cost: 0,
        gain: 8,
        groundOnly: true,
        ai: {
          role: "approach",
          weight: 1,
        },
        effect: "dash",
        dashSpeed: 360,
        launch: 100,
      },
      specialKick: {
        name: "截空踢",
        description: "短距离腾空踢，主要拦截跳跃中的对手。",
        startup: 11,
        active: 9,
        recovery: 10,
        damage: 9,
        range: 110,
        box: {
          x: 2,
          y: -195,
          w: 105,
          h: 175,
        },
        stun: 30,
        knockback: 270,
        cost: 0,
        gain: 8,
        groundOnly: true,
        ai: {
          role: "antiAir",
          weight: 1,
        },
        effect: "rise",
        riseVelocity: -330,
        launch: 300,
      },
      skill: {
        name: "赤锋冲阵",
        description: "消耗一点能量的远距离重突进，命中压迫强。",
        startup: 16,
        active: 12,
        recovery: 11,
        damage: 13,
        range: 215,
        box: {
          x: 12,
          y: -145,
          w: 160,
          h: 125,
        },
        stun: 33,
        knockback: 390,
        cost: 1,
        gain: 0,
        groundOnly: true,
        ai: {
          role: "approach",
          weight: 1,
        },
        effect: "dash",
        dashSpeed: 620,
        launch: 140,
      },
      super: {
        name: "赤锋裂阵",
        description: "满气破防重击，伤害高但前摇和收招都更慢。",
        startup: 22,
        active: 12,
        recovery: 14,
        damage: 21,
        range: 240,
        box: {
          x: 8,
          y: -150,
          w: 220,
          h: 130,
        },
        stun: 45,
        knockback: 530,
        cost: 3,
        gain: 0,
        groundOnly: true,
        ai: {
          role: "finisher",
          weight: 1,
        },
        effect: "dash",
        dashSpeed: 720,
        launch: 210,
        unblockable: true,
      },
    },
  },
];
roster[0].sprites = blueSprites;
roster[1].sprites = redSprites;

const blue = roster[0],
  red = roster[1];
blue.ai.preferredRange = 260;
blue.ai.retreatBelow = 140;
red.ai.preferredRange = 95;
blue.subtitle = "气功 / 远程控场";
blue.description =
  "远程控场型：用气功波牵制，升龙踢防跳，双波压制；蓄气时容易被近身打断。";
Object.assign(blue.moves.specialPunch, {
  name: "岚光波",
  description: "蓄气后双掌推出独立飞行的气功波，可防御、跳过或闪避。",
  startup: 18,
  active: 8,
  recovery: 9,
  damage: 8.5,
  range: 580,
  minRange: 120,
  effect: "projectile",
  gain: 6,
  projectile: { speed: 480, radius: 21, life: 1.5, power: 1 },
  launch: 80,
  ai: { role: "ranged", weight: 1 },
});
delete blue.moves.specialPunch.riseVelocity;
Object.assign(blue.moves.specialKick, {
  name: "踏空升龙踢",
  description: "蓄势腾空踢起，对空拦截；落地前无法立即接下一招。",
  effect: "rise",
  riseVelocity: -450,
  range: 115,
  ai: { role: "antiAir", weight: 1 },
});
Object.assign(blue.moves.skill, {
  name: "回风双波",
  description: "连续发出两枚快气功波，分两次命中；可被防御或闪避。",
  startup: 23,
  active: 12,
  recovery: 10,
  effect: "projectile",
  range: 650,
  minRange: 130,
  projectile: {
    speed: 620,
    radius: 25,
    life: 1.4,
    power: 1,
    shots: [
      { delay: 0, damage: 5.5 },
      { delay: 0.15, damage: 6 },
    ],
  },
  ai: { role: "ranged", weight: 1 },
});
delete blue.moves.skill.dashSpeed;
Object.assign(blue.moves.super, {
  name: "苍穹元气弹",
  description:
    "举手聚气后推出大型破防能量弹，命中将敌人击飞后倒地；普通拳脚与方向招式不能打断，角色技能命中可以打断。",
  startup: 34,
  active: 10,
  recovery: 13,
  damage: 40,
  effect: "projectile",
  range: 750,
  minRange: 180,
  projectile: { speed: 410, radius: 57, life: 2.2, power: 3, offsetX: 100, offsetY: -148 },
  launch: 400,
  knockdown: true,
});
delete blue.moves.super.dashSpeed;
red.subtitle = "爪击 / 擒拿连打";
red.description =
  "近身擒拿型：裂影三连持续压制，抓住对手连打后甩出；抓空破绽大，怕远程牵制。";
Object.assign(red.moves.specialPunch, {
  name: "裂影三连",
  description: "左右爪连续划击三次，能防御；近身命中后逐段造成伤害。",
  startup: 10,
  active: 19,
  recovery: 8,
  effect: "rush",
  dashSpeed: 190,
  gain: 2,
  hits: [
    { at: 0, damage: 3.5 },
    { at: 7, damage: 3 },
    { at: 14, damage: 3 },
  ],
  ai: { role: "poke", weight: 1 },
});
Object.assign(red.moves.specialKick, {
  name: "猩红逆爪",
  description: "压低身体后向上掠起赤色爪痕，用于截击跳跃。",
});
Object.assign(red.moves.skill, {
  name: "缚影连摔",
  description:
    "近身抓住地面敌人，连打两下再摔出；抓取无视防御，但可跳开或闪避。",
  startup: 12,
  active: 14,
  recovery: 10,
  effect: "grab",
  dashSpeed: 480,
  range: 150,
  box: { x: 8, y: -165, w: 105, h: 160 },
  grab: {
    duration: 0.94,
    hits: [
      { at: 0.2, damage: 3 },
      { at: 0.43, damage: 3 },
      { at: 0.74, damage: 7 },
    ],
  },
  ai: { role: "grapple", weight: 1 },
});
Object.assign(red.moves.super, {
  name: "血月狂宴",
  description:
    "扑抓地面敌人，六拳连打后重摔；普通拳脚与方向招式不能打断，角色技能命中可以打断，跳跃和闪避可躲。",
  startup: 18,
  active: 20,
  recovery: 13,
  damage: 35,
  effect: "grab",
  dashSpeed: 760,
  range: 235,
  box: { x: 8, y: -170, w: 110, h: 165 },
  grab: {
    duration: 1.72,
    hits: [
      { at: 0.14, damage: 4 },
      { at: 0.34, damage: 4 },
      { at: 0.54, damage: 4 },
      { at: 0.74, damage: 4 },
      { at: 0.94, damage: 4 },
      { at: 1.14, damage: 4 },
      { at: 1.5, damage: 11 },
    ],
  },
  ai: { role: "grapple", weight: 1 },
});
// Normals leave a defensive gap when repeated; they do not pop grounded targets up.
for (const character of roster) {
  Object.assign(character.moves.punch, {
    stun: character === blue ? 9 : 10,
    launch: 0,
    knockback: 220,
  });
  Object.assign(character.moves.kick, {
    stun: character === blue ? 13 : 14,
    launch: 0,
    knockback: 310,
  });
  for (const slot of ["specialPunch", "specialKick", "skill"])
    character.moves[slot].stun = Math.min(22, character.moves[slot].stun);
  character.moves.super.stun = 30;
}
// The six basic attacks are shared; character-specific moves occupy skill slots.
for (const character of [blue, red]) {
  character.moves.skill2 = { ...character.moves.specialPunch, cost: 1, gain: 0 };
}
const naiwaAtlas = "./assets/characters/naiwa/common/atlas.png";
const naiwaActions = "./assets/characters/naiwa/common/actions-atlas.png";
const naiwaMotion = "./assets/characters/naiwa/common/motion-v2.png";
const naiwaWalk = "./assets/characters/naiwa/common/walk-v9.png";
const naiwaHurt = "./assets/characters/naiwa/common/hurt-v2.png";
const naiwaJump = "./assets/characters/naiwa/common/jump-v4.png";
const naiwaSweep = "./assets/characters/naiwa/common/sweep-v7.png";
const naiwaSkill1 = "./assets/characters/naiwa/skill1/atlas.png";
const naiwaSkill2 = "./assets/characters/naiwa/skill2/atlas.png";
const naiwaSuper = "./assets/characters/naiwa/super/atlas.png";
const naiwaRect = (index) => [(index % 4) * 320, Math.floor(index / 4) * 320, 320, 320];
const naiwaPose = (src, index, scale = 0.62) => ({ src, rect: naiwaRect(index), scale, anchorX: 0.5, originY: 302 });
const naiwaClip = (src, indices, phases, scale = 0.62) => ({ src, clip: indices.map((i) => naiwaPose(src, i, scale)), fps: 12, phases });
const naiwaPhases = { startup: [0, 1], active: [2], recovery: [2, 3] };
const naiwaMotionPose = (index, scale = 0.62) => ({ src: naiwaMotion, rect: naiwaRect(index), scale, anchorX: 0.5, originY: 312 });
const naiwaMotionClip = (indices, phases, scale = 0.62) => ({ src: naiwaMotion, clip: indices.map((i) => naiwaMotionPose(i, scale)), fps: 12, phases });
const naiwaSkillPose = (src, index, scale = 0.62) => ({ src, rect: naiwaRect(index), scale, anchorX: 0.5, originY: 312 });
const naiwaSkillClip = (src, indices, phases, scale = 0.62, fps = 16) => ({ src, clip: indices.map((i) => naiwaSkillPose(src, i, scale)), fps, phases });
const naiwaSweepClip = (indices, phases, scale = 0.62) => ({ src: naiwaSweep, clip: indices.map((i) => ({ src: naiwaSweep, rect: [i * 320, 0, 320, 320], scale, anchorX: 0.5, originY: 312 })), fps: 12, phases });
const naiwaSprites = {
  idle: naiwaPose(naiwaAtlas, 0),
  walk: { src: naiwaWalk, clip: [0, 1, 2, 3, 4, 5].map((i) => ({ src: naiwaWalk, rect: [i * 320, 0, 320, 320], scale: 0.62, anchorX: 0.5, originY: 312 })), fps: 9, loop: true, stride: 110, walkMode: "time" },
  jump: { src: naiwaJump, clip: [0, 1, 2].map((i) => ({ src: naiwaJump, rect: [i * 320, 0, 320, 320], scale: 0.62, anchorX: 0.5, originY: 312 })), fps: 10 },
  guard: naiwaPose(naiwaActions, 1),
  crouchGuard: naiwaPose(naiwaActions, 0),
  hurt: { src: naiwaHurt, clip: [0, 1, 2, 3].map((i) => ({ src: naiwaHurt, rect: [i * 320, 0, 320, 320], scale: 0.62, anchorX: 0.5, originY: 312 })), fps: 12 },
  ko: naiwaPose(naiwaAtlas, 15),
  knockdown: { src: naiwaAtlas, clip: [13, 14, 15].map((i) => naiwaPose(naiwaAtlas, i)), fps: 10 },
  dodge: { src: naiwaActions, clip: [10, 11, 10].map((i) => naiwaPose(naiwaActions, i)), fps: 12 },
  punch: naiwaMotionClip([4, 4, 5, 4], naiwaPhases),
  kick: naiwaMotionClip([6, 6, 7, 6], naiwaPhases),
  forwardPunch: naiwaMotionClip([4, 4, 5, 4], naiwaPhases),
  forwardKick: naiwaMotionClip([8, 8, 9, 8], naiwaPhases),
  specialPunch: naiwaClip(naiwaActions, [4, 4, 5, 14], naiwaPhases),
  specialKick: naiwaSweepClip([0, 1, 2, 3], naiwaPhases),
  skill: naiwaSkillClip(naiwaSkill1, [0, 1, 2, 3, 4, 5], { startup: [0, 1], active: [2, 3], recovery: [4, 5] }),
  // The laugh lasts 1.5 seconds for its hit pulses.  Cycle the middle poses
  // at a faster ping-pong rate so the hands/body keep moving instead of
  // freezing on each atlas frame for too long.
  skill2: Object.assign(
    naiwaSkillClip(naiwaSkill2, [0, 1, 2, 3, 4, 5, 6, 7], {
      startup: [0, 1, 2],
      active: [2, 3, 4, 5, 6, 5, 4, 3],
      recovery: [6, 7],
    }),
    { phaseLoop: { active: true }, phaseFps: 14 },
  ),
  super: naiwaSkillClip(naiwaSuper, [0, 1, 2, 3, 4, 5], { startup: [0, 1, 2], active: [3, 4], recovery: [5, 4] }),
};
const commonMoves = {
  punch: { name: "直拳", description: "快速近身直拳。", startup: 6, active: 4, recovery: 5, damage: 4, range: 105, box: { x: 18, y: -150, w: 95, h: 55 }, stun: 9, knockback: 220, cost: 0, gain: 12, groundOnly: false, launch: 0, ai: { role: "poke", weight: 1 }, cancel: ["kick", "forwardPunch", "forwardKick", "specialPunch", "specialKick", "skill", "skill2", "super"] },
  kick: { name: "中踢", description: "中距离踢击。", startup: 10, active: 5, recovery: 7, damage: 6.5, range: 145, box: { x: 16, y: -105, w: 130, h: 60 }, stun: 13, knockback: 310, cost: 0, gain: 14, groundOnly: false, launch: 0, ai: { role: "poke", weight: 1 } },
  forwardPunch: { name: "突进重拳", description: "向前突进的重拳。", startup: 11, active: 7, recovery: 8, damage: 8, range: 155, box: { x: 10, y: -135, w: 130, h: 100 }, stun: 20, knockback: 300, cost: 0, gain: 9, groundOnly: true, effect: "dash", dashSpeed: 350, launch: 0, ai: { role: "approach", weight: 1 } },
  forwardKick: { name: "飞踢", description: "向前突进的踢击。", startup: 12, active: 8, recovery: 9, damage: 8.5, range: 170, box: { x: 12, y: -120, w: 145, h: 90 }, stun: 20, knockback: 320, cost: 0, gain: 9, groundOnly: true, effect: "dash", dashSpeed: 420, launch: 0, ai: { role: "approach", weight: 1 } },
  specialPunch: { name: "上勾拳", description: "向上挥拳，适合对空。", startup: 9, active: 7, recovery: 8, damage: 7, range: 110, box: { x: 8, y: -190, w: 105, h: 150 }, stun: 20, knockback: 260, cost: 0, gain: 9, groundOnly: true, launch: 220, ai: { role: "antiAir", weight: 1 } },
  specialKick: { name: "扫腿", description: "攻击下段并扫倒未防御的对手。", startup: 10, active: 6, recovery: 8, damage: 7, range: 140, box: { x: 12, y: -55, w: 130, h: 55 }, stun: 20, knockback: 280, cost: 0, gain: 9, groundOnly: true, low: true, knockdown: true, launch: 0, ai: { role: "poke", weight: 1 } },
};
roster.push({
  id: "naiwa",
  name: "奶娃",
  subtitle: "全屏 / 范围控制",
  description: "恶作剧型全屏控制者：回眸一击无视距离，捧腹大笑持续震慑近身敌人，奶蛋弹幕雨覆盖全场。",
  color: "#ffd84d",
  accent: "#fff1ad",
  speed: 205,
  jump: 580,
  width: 70,
  height: 178,
  ai: { preferredRange: 190 },
  sprites: naiwaSprites,
  moves: { skill: {}, skill2: {}, super: {} },
});
for (const character of roster) Object.assign(character.moves, structuredClone(commonMoves));
Object.assign(blue.moves.skill, {
  name: "三重回风",
  description: "消耗一点能量，聚气后推掌一次，从手掌沿同一直线连续射出三枚气功球。",
  damage: 15,
  effect: "projectile",
  range: 680,
  minRange: 130,
  projectile: {
    speed: 600,
    radius: 17,
    life: 1.5,
    power: 1,
    offsetX: 94,
    offsetY: -142,
    shots: [
      { delay: 0, damage: 5, angle: 0 },
      { delay: 0.12, damage: 5, angle: 0 },
      { delay: 0.24, damage: 5, angle: 0 },
    ],
  },
  startup: 18,
  active: 18,
  recovery: 9,
  cost: 1,
  ai: { role: "ranged", weight: 1 },
});
Object.assign(blue.moves.skill2, {
  name: "震空回响",
  description: "以自身为中心爆气，对周围造成伤害并击飞未防御目标，不造成倒地。",
  damage: 10,
  startup: 16,
  active: 8,
  recovery: 10,
  effect: "burst",
  burstRange: 280,
  range: 280,
  launch: 350,
  knockdown: false,
  cost: 1,
  ai: { role: "poke", weight: 1 },
});
Object.assign(red.moves.skill2, {
  name: "裂地跳锤",
  description: "向前跃起后重拳砸地，对落点范围造成伤害。",
  damage: 14,
  startup: 18,
  active: 10,
  recovery: 11,
  effect: "burst",
  burstAt: "active",
  riseVelocity: -430,
  forwardSpeed: 250,
  burstRange: 200,
  range: 240,
  knockdown: true,
  cost: 1,
  groundOnly: true,
  ai: { role: "approach", weight: 1 },
});
delete red.moves.skill2.dashSpeed;
delete red.moves.skill2.hits;
delete blue.moves.skill2.projectile;
delete blue.moves.skill2.minRange;
Object.assign(roster[2].moves.skill, {
  name: "隔空嘲笑",
  description: "消耗一点能量，嘲笑着指向敌人；蓄力 0.5 秒后无视距离造成伤害和硬直。",
  startup: 30, active: 4, recovery: 8, damage: 15, range: 960,
  box: { x: -480, y: -180, w: 960, h: 150 }, stun: 30, knockback: 180, launch: 260, knockdown: true,
  cost: 1, gain: 0, groundOnly: true, effect: "global",
  ai: { role: "ranged", weight: 1 },
  unblockable: true,
  launch: 80,
  voiceCue: true,
});
Object.assign(roster[2].moves.skill2, {
  name: "捧腹大笑",
  description: "消耗一点能量，以自身为中心连续多段震慑并伤害附近未防御的敌人。",
  startup: 12, active: 90, recovery: 9, damage: 12, range: 220, burstRange: 220,
  box: { x: -220, y: -180, w: 440, h: 180 }, stun: 10, knockback: 115,
  cost: 1, gain: 0, groundOnly: true, effect: "burst",
  soundwave: true,
  voiceCue: true,
  unblockable: true,
  launch: 90,
  hits: [0, 10, 20, 30, 40, 50, 60, 70, 80].map((at) => ({ at, damage: 12 / 9 })),
  ai: { role: "poke", weight: 1 },
});
Object.assign(roster[2].moves.super, {
  name: "奶蛋天降",
  description: "消耗三点能量，锁定一名敌人；短暂瞄准后从目标头顶落下尖端朝下的奶蛋，爆炸并击飞倒地。",
  startup: 12, active: 6, recovery: 12, damage: 45, range: 960,
  box: { x: -480, y: -260, w: 960, h: 240 }, stun: 24, knockback: 220,
  cost: 3, gain: 0, groundOnly: true, effect: "projectile", invulnerableFrames: 18,
  launch: 300, knockdown: true, unblockable: true, voiceCue: true,
  projectile: {
    speed: 1080, radius: 42, life: 1.3, power: 1, targeted: true, lockDelay: 0.48,
    shots: [{ delay: 0, damage: 45 }],
  },
  ai: { role: "finisher", weight: 1 },
});
installAnimations(roster);
assertRoster(roster);
