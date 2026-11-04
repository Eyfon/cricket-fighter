function clip(
  src,
  rects,
  {
    scale = 0.65,
    anchors = [],
    phases,
    loop = false,
    stride = 100,
    grabFrames,
    trims = [],
    fps = 12,
  } = {},
) {
  return {
    src,
    clip: rects.map((rect, i) => ({
      rect,
      scale,
      anchorX: anchors[i] ?? 0.5,
      trim: trims[i],
    })),
    fps,
    loop,
    stride,
    phases,
    grabFrames,
  };
}
export function installAnimations(roster) {
  const blue = "./assets/characters/canglan-actions-v2.png",
    red = "./assets/characters/chifeng-actions-v2.png";
  const castPhases = { startup: [0, 1], active: [2], recovery: [2, 3] };
  const attackPhases = { startup: [0], active: [1, 2], recovery: [2, 3] };
  const walkBlue = [
    [37, 29, 229, 293],
    [390, 30, 172, 292],
    [674, 30, 255, 292],
    [1016, 30, 163, 292],
  ];
  const walkRed = [
    [38, 14, 247, 305],
    [375, 14, 200, 306],
    [659, 25, 265, 298],
    [1012, 16, 173, 307],
  ];
  const punchBlue = [
    [30, 342, 274, 280],
    [336, 345, 302, 277],
    [639, 347, 349, 275],
    [994, 341, 246, 281],
  ];
  const clawRed = [
    [18, 364, 267, 271],
    [325, 347, 313, 288],
    [638, 376, 315, 260],
    [977, 359, 248, 277],
  ];
  const wave = [
    [16, 646, 275, 263],
    [327, 647, 293, 262],
    [628, 646, 343, 263],
    [980, 656, 263, 253],
  ];
  const blast = [
    [15, 897, 295, 341],
    [352, 967, 274, 271],
    [628, 951, 338, 286],
    [974, 966, 270, 272],
  ];
  const grab = [
    [13, 674, 299, 270],
    [325, 679, 306, 265],
    [638, 648, 290, 296],
    [966, 645, 281, 299],
  ];
  const frenzy = [
    [22, 1043, 265, 190],
    [300, 1026, 337, 207],
    [637, 924, 288, 317],
    [933, 1033, 316, 193],
  ];
  const a = roster[0].sprites,
    b = roster[1].sprites;
  const crouchSrc = './assets/characters/crouch-guard-v1.png';
  for (const [sprites, y, h, foot] of [[a,170,450,445],[b,740,470,460]]) {
    sprites.crouchGuard = clip(crouchSrc, [[80,y,480,h],[680,y,480,h]], {scale:0.33});
    for (const frame of sprites.crouchGuard.clip) frame.originY=foot;
  }
  a.walk = clip(blue, walkBlue, { scale: 0.63, loop: true, stride: 105 });
  b.walk = clip(red, walkRed, { scale: 0.61, loop: true, stride: 100 });
  a.punch = clip(blue, punchBlue, {
    phases: attackPhases,
    anchors: [0.5, 0.37, 0.35, 0.5],
  });
  b.punch = clip(red, clawRed, {
    phases: attackPhases,
    anchors: [0.5, 0.36, 0.35, 0.5],
  });
  a.specialPunch = clip(blue, wave, {
    scale: 0.7,
    phases: castPhases,
    anchors: [0.5, 0.42, 0.35, 0.48],
  });
  a.skill = clip(blue, wave, {
    scale: 0.7,
    phases: castPhases,
    anchors: [0.5, 0.42, 0.35, 0.48],
  });
  a.super = clip(blue, blast, {
    scale: 0.7,
    phases: castPhases,
    anchors: [0.5, 0.4, 0.35, 0.5],
    trims: [[0, 18, 0, 0], null, [0, 0, 0, 0], [0, 14, 0, 0]],
  });
  // The area shockwave uses a wide, grounded release instead of reusing the
  // projectile pose, making its startup and impact readable at a glance.
  a.skill2 = clip(blue, [wave[0], blast[1], blast[2], blast[3]], {
    scale: 0.7,
    phases: { startup: [0, 1], active: [2], recovery: [2, 3] },
    anchors: [0.5, 0.42, 0.35, 0.5],
  });
  b.specialPunch = clip(red, clawRed, {
    phases: { startup: [0], active: [1, 2, 1, 2], recovery: [2, 3] },
    anchors: [0.5, 0.36, 0.35, 0.5],
  });
  b.skill = clip(red, grab, {
    scale: 0.65,
    phases: castPhases,
    grabFrames: [1, 2, 1, 2, 3],
    anchors: [0.4, 0.35, 0.48, 0.5],
  });
  b.super = clip(red, frenzy, {
    scale: 0.65,
    phases: { startup: [0], active: [1], recovery: [2, 3] },
    grabFrames: [2, 1, 2, 3],
    anchors: [0.5, 0.3, 0.48, 0.5],
    trims: [null, null, [28, 16, 0, 0], [0, 14, 0, 0]],
  });
  // Red's jump hammer has a clear lift, overhead impact, and landing pose.
  b.skill2 = clip(red, [clawRed[0], frenzy[1], frenzy[2], clawRed[3]], {
    scale: 0.65,
    phases: { startup: [0, 1], active: [2], recovery: [2, 3] },
    anchors: [0.5, 0.3, 0.48, 0.5],
  });
  // Existing silhouettes become explicit anticipation/strike/recovery clips.
  for (const sprites of [a, b]) {
    sprites.kick = {
      src: sprites.idle.src,
      clip: [{ ...sprites.idle }, { ...sprites.kick }, { ...sprites.guard }],
      fps: 12,
      phases: { startup: [0], active: [1], recovery: [1, 2] },
    };
    sprites.jump = {
      src: sprites.idle.src,
      clip: [{ ...sprites.idle }, { ...sprites.jump }, { ...sprites.guard }],
      fps: 10,
    };
    sprites.dodge = {
      src: sprites.idle.src,
      clip: [
        { ...sprites.guard },
        { ...sprites.jump.clip[1] },
        { ...sprites.guard },
      ],
      fps: 12,
    };
  }
  a.specialKick = {
    src: a.idle.src,
    clip: [
      { ...a.guard },
      { ...a.jump.clip[1] },
      { ...a.kick.clip[1] },
      { ...a.guard },
    ],
    fps: 12,
    phases: castPhases,
  };
  b.specialKick = clip(red, [clawRed[0], frenzy[2], clawRed[3]], {
    phases: { startup: [0], active: [1], recovery: [1, 2] },
  });
  // Knockdown is a short loss-of-balance sequence, rather than an immediate
  // switch to the flat KO silhouette.
  // V3 generated atlas has measured row bounds (not an assumed equal grid).
  // Keep each row isolated; all six poses share a stable foot/ground baseline.
  const v3 = './assets/characters/skill-knockdown-v3.png';
  const row = (y, height) => Array.from({ length: 6 }, (_, i) => [i * 256, y, 256, height]);
  a.skill2 = clip(v3, row(0, 292), {
    scale: 0.86,
    phases: { startup: [0, 1, 2], active: [3], recovery: [4, 5] },
  });
  b.skill2 = clip(v3, row(294, 280), {
    scale: 0.78,
    phases: { startup: [0], active: [1, 2, 3], recovery: [4, 5] },
  });
  a.knockdown = clip(v3, row(576, 205), { scale: 0.86, fps: 12 });
  b.knockdown = clip(v3, row(787, 218), { scale: 0.86, fps: 12 });
  const directional = './assets/characters/direction-attacks-v4.png';
  const strikes = (y, h) => [[0,y,272,h],[272,y,272,h],[544,y,304,h],[848,y,238,h]];
  const phases = { startup: [0, 1], active: [2], recovery: [2, 3] };
  for (const [sprites, rows] of [[a, [[0,225],[225,252],[478,228]]], [b, [[712,214],[926,249],[1175,230]]]]) {
    for (const [i, slot] of ['forwardPunch','specialPunch','forwardKick'].entries()) {
      sprites[slot] = clip(directional, strikes(...rows[i]), {
        scale: 0.83, phases, anchors: [0.5, 0.5, 0.4, 0.5],
      });
    }
  }
  for (const [sprites, y] of [[a, 180], [b, 570]]) {
    sprites.specialKick = clip('./assets/characters/sweeps-v4.png',
      [[0,y,380,280],[400,y,510,280],[912,y,510,280],[1430,y,344,280]],
      { scale: 0.46, phases, anchors: [0.5, 0.28, 0.26, 0.5] });
  }
  // V5: clean isolated poses, fixed anatomical scale per sheet. Foot pivots
  // are independent from image height (especially for arms raised overhead).
  const grid = Array.from({length:6},(_,i)=>[(i%3)*512, Math.floor(i/3)*512, 512, 512]);
  const skillClip = (src, scale, feet, pivots, phases, extras={}) => {
    const sprite = clip(src, grid, {scale, phases});
    sprite.clip.forEach((pose,i)=>{
      pose.originY=feet[i];
      pose.anchorX=pivots[i]/512;
    });
    return Object.assign(sprite,extras);
  };
  a.skill = skillClip('./assets/characters/canglan-skill-v5.png',0.48,
    [495,495,495,456,456,456],[278,269,235,278,266,245],
    {startup:[0,1,2],active:[3],recovery:[2,1,5]});
  // The separately isolated halfway extension bridges gather and release.
  a.skill.clip[2]={src:'./assets/characters/canglan-skill-mid-v5.png',rect:[720,200,360,440],scale:0.435,anchorX:0.48,originY:438};
  a.skill.clip[3]={src:a.skill.src,rect:grid[2],scale:0.48,anchorX:235/512,originY:495};
  a.super = skillClip('./assets/characters/canglan-super-v5.png',0.44,
    [512,512,512,470,473,473],[280,267,235,251,204,240],
    {startup:[0,1,2,2,3],active:[4],recovery:[4,3,5,0]});
  b.skill = skillClip('./assets/characters/chifeng-skill-v5.png',0.49,
    [486,487,486,458,458,458],[260,245,243,265,222,251],
    {startup:[0,1],active:[1,2],recovery:[2,1,0]},
    {grabFrames:[2,3,2,3,4,5,0],grabTimeline:[
      {at:0,frame:2},{at:0.18,frame:3},{at:0.30,frame:2},
      {at:0.41,frame:3},{at:0.56,frame:4},{at:0.72,frame:5},{at:0.86,frame:0}]});
  b.super = skillClip('./assets/characters/chifeng-super-v5.png',0.5,
    [460,460,459,460,460,460],[240,222,222,240,260,265],
    {startup:[0,1],active:[1,2],recovery:[2,1,0]},
    {grabFrames:[2,3,2,3,2,3,2,3,2,3,2,3,4,5,0],grabTimeline:[
      {at:0,frame:2},{at:0.12,frame:3},{at:0.24,frame:2},
      {at:0.32,frame:3},{at:0.44,frame:2},{at:0.52,frame:3},
      {at:0.64,frame:2},{at:0.72,frame:3},{at:0.84,frame:2},
      {at:0.92,frame:3},{at:1.04,frame:2},{at:1.12,frame:3},
      {at:1.3,frame:4},{at:1.48,frame:5},{at:1.62,frame:0}]});
}
