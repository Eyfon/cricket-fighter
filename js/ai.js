import { aiProfile } from './ai-profiles.js';

const heldInput = (input = {}) => ({
  left: !!input.left, right: !!input.right, guard: !!input.guard, down: !!input.down,
});
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function captureAiProjectiles(self, projectiles) {
  return projectiles.filter((p) => p.owner !== self && p.delay <= 0 && p.life > 0)
    .map((p) => ({ token: p, x: p.x, y: p.y, speed: p.speed, direction: p.direction, radius: p.radius }));
}

function observe(self, other, brain) {
  if (other.attack !== brain.sourceAttack) {
    brain.sourceAttack = other.attack;
    if (other.attack) brain.sourceAttackId++;
  }
  const a = other.attack;
  return {
    x: other.x, y: other.y, vx: other.vx, vy: other.vy,
    ground: other.ground, guard: other.guard, crouchGuard: other.crouchGuard,
    dodge: other.dodgeTimer > 0.06, state: other.state, hp: other.hp,
    height: other.def.height, width: other.def.width, at: brain.time,
    attack: a ? { id: brain.sourceAttackId, key: a.key, frame: a.frame, move: a.move } : null,
    projectiles: (self.aiProjectiles || []).map((p) => ({ ...p })),
    projectileThreat: !!self.projectileThreat,
    sweep: self.attack?.key === 'specialKick' && self.attack.hit && !self.attack.blocked
      ? self.attack : null,
  };
}

function updatePerception(self, other, dt, difficulty, random) {
  const profile = aiProfile(difficulty);
  let brain = self.aiBrain;
  if (!brain || brain.profile !== profile) {
    brain = self.aiBrain = {
      profile, difficulty, time: 0, latency: profile.reaction[0] + random() * (profile.reaction[1] - profile.reaction[0]),
      bank: random() < profile.bankChance,
      samples: [], memory: [], ownMoves: [], defenses: new Map(), held: {},
      sourceAttack: null, sourceAttackId: 0, seenAttackId: 0, seenGround: other.ground,
      sweepUntil: 0, sweepToken: null, ownAttack: null, confirmation: null,
      mode: 'approach', decisions: 0, reactions: [],
      // Initial positions are public. New threats still need to pass through history.
      view: { x: other.x, y: other.y, vx: 0, vy: 0, ground: other.ground,
        guard: false, crouchGuard: false, dodge: false, state: 'idle', hp: other.hp,
        height: other.def.height, width: other.def.width, attack: null,
        projectiles: [], projectileThreat: false, at: 0 },
    };
    self.aiTime = 0;
  }
  brain.time += dt;
  brain.samples.push(observe(self, other, brain));
  while (brain.samples.length && brain.samples[0].at <= brain.time - brain.latency + 1e-9) {
    const view = brain.samples.shift();
    if (view.attack && view.attack.id !== brain.seenAttackId) {
      brain.seenAttackId = view.attack.id;
      brain.memory.push({ at: view.at, kind: view.attack.move.low ? 'low' : view.attack.move.effect === 'projectile' ? 'ranged' : 'attack' });
    }
    if (!view.ground && brain.seenGround) brain.memory.push({ at: view.at, kind: 'jump' });
    const retreating = Math.abs(view.vx) > 30 && Math.sign(view.vx) === Math.sign(view.x - self.x);
    if (retreating && !brain.seenRetreat) brain.memory.push({ at: view.at, kind: 'retreat' });
    brain.seenRetreat = retreating;
    brain.seenGround = view.ground;
    if (view.sweep && view.state === 'knockdown' && view.sweep !== brain.sweepToken) {
      brain.sweepToken = view.sweep;
      if (brain.time >= brain.sweepUntil) brain.sweepUntil = view.at + 5;
    }
    brain.view = view;
  }
  brain.memory = profile.memory ? brain.memory.filter((item) => brain.time - item.at < profile.memorySeconds).slice(-profile.memory) : [];
  if (self.attack && self.attack !== brain.ownAttack) {
    brain.ownAttack = self.attack;
    brain.ownMoves.push({ attack: self.attack, at: brain.time });
    brain.ownMoves = brain.ownMoves.filter((item) => brain.time - item.at < 4).slice(-5);
    brain.confirmation = null;
  }
  return brain;
}

function situation(self, brain) {
  const view = brain.view, p = brain.profile;
  const age = Math.min(0.2, brain.time - view.at);
  const prediction = p.prediction;
  const x = clamp(view.x + (view.vx || 0) * age * prediction, 38, 922);
  const y = view.ground ? view.y : Math.min(438, view.y + (view.vy || 0) * age * prediction + 825 * (age * prediction) ** 2);
  const dir = x >= self.x ? 1 : -1, dist = Math.abs(x - self.x);
  const attack = view.attack;
  const liveAttack = attack && attack.frame < attack.move.startup + attack.move.active;
  let danger = null;
  if (liveAttack && dist <= attack.move.range + 35 && Math.abs(self.y - y) < 200)
    danger = { token: 'attack:' + attack.id, low: !!attack.move.low, attack, at: view.at };
  for (const projectile of view.projectiles) {
    const px = projectile.x + projectile.direction * projectile.speed * age;
    const toward = Math.sign(self.x - px) === projectile.direction;
    const eta = (Math.abs(self.x - px) - self.def.width / 2 - projectile.radius) / Math.max(1, projectile.speed);
    if (toward && eta < 0.3 && Math.abs(projectile.y - (self.y - self.def.height * 0.55)) < self.def.height * 0.65) {
      danger = { token: projectile.token, low: false, projectile: true, at: view.at };
      break;
    }
  }
  if (!danger && view.projectileThreat) danger = { token: 'projectile-warning', low: false, projectile: true, at: view.at };
  return { view, x, y, dir, dist, danger, liveAttack };
}

function selectWeighted(entries, random, temperature) {
  if (!entries.length) return null;
  const max = Math.max(...entries.map((entry) => entry.score));
  const weighted = entries.map((entry) => ({ ...entry, weight: Math.exp((entry.score - max) / temperature) }));
  let roll = random() * weighted.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.key;
  }
  return weighted.at(-1).key;
}

function savingEnergy(self, brain, scene) {
  const emergency = scene.danger && (self.hp < self.maxHp * 0.25 ||
    ['skill', 'skill2', 'super'].includes(scene.view.attack?.key));
  return brain.bank && self.energyPoints > 0 && self.energyPoints < 3 && !emergency;
}

export function scoreAiMoves(self, brain, scene = situation(self, brain), allowed = null) {
  const { view, dist, y, danger } = scene, p = brain.profile;
  const result = [];
  for (const [key, move] of Object.entries(self.def.moves)) {
    if (allowed && !allowed.includes(key)) continue;
    if (!self.canUseMove(key) || dist >= move.range || dist < (move.minRange || 0)) continue;
    if (move.effect === 'grab' && (!view.ground || view.dodge || view.state === 'knockdown')) continue;
    if (view.dodge) continue;
    if (!['projectile', 'burst'].includes(move.effect)) {
      const top = self.y + move.box.y, bottom = top + move.box.h;
      const height = view.height * (view.crouchGuard ? 0.8 : 1);
      if (bottom < y - height || top > y) continue;
    }
    if (move.effect === 'projectile' && y < self.y - 155) continue;
    if (key === 'super' && (danger || view.projectileThreat ||
      (view.attack && view.attack.frame < view.attack.move.startup + view.attack.move.active && dist < 180))) continue;

    let score = move.ai?.weight || 1;
    const role = move.ai?.role;
    if (key === 'punch') score += dist < 90 ? 2.4 : 1;
    if (key === 'kick') score += dist > 100 ? 2.2 : 1.1;
    if (role === 'approach') score += dist > 120 ? 2 : 0.1;
    if (role === 'antiAir') score += view.ground ? -0.8 : p.antiAir;
    if (move.low) score += view.guard && !view.crouchGuard ? 2 : 0.5;
    if (move.low && brain.time < brain.sweepUntil) score -= 2;
    if (role === 'ranged') score += dist > 180 ? 3 : 0.3;
    if (move.effect === 'burst') score += dist < move.range * 0.7 ? 2.3 : 1;
    if (move.effect === 'grab') score += view.guard ? 3.4 : 1.8;
    if (move.cost === 1) score += self.energyPoints === 3 ? 0.9 : -0.25;
    if (move.cost === 1 && savingEnergy(self, brain, scene)) score -= 4;
    if (move.effect === 'burst' && self.def.ai?.retreatBelow && !danger) score -= 1;
    if (key === 'skill2' && danger && self.def.ai?.retreatBelow && dist < self.def.ai.retreatBelow) score += 2;
    if (key === 'super') score += 4.5;

    const recovery = view.attack ? Math.max(0, view.attack.move.startup + view.attack.move.active + view.attack.move.recovery - view.attack.frame) : 0;
    const recovering = view.attack && view.attack.frame >= view.attack.move.startup + view.attack.move.active;
    if (recovering) score += p.punish * (move.startup < recovery ? 1.5 : -0.3);
    if (danger) {
      if (view.attack?.key === 'super' && !['skill', 'skill2', 'super'].includes(key)) score -= 4;
      else if (['skill', 'skill2'].includes(view.attack?.key) && !(move.launch > 0 || move.knockdown)) score -= 3;
      if (move.startup < 10 || move.launch > 0 || move.knockdown) score += p.punish * 0.4;
    }
    const expectedDamage = move.damage * (view.guard && !move.unblockable && move.effect !== 'grab' ? (move.chipRatio ?? 0.25) : 1);
    if (expectedDamage >= view.hp && (move.effect !== 'projectile' || dist < 350)) score += p.punish;
    if (!view.ground && move.low) score -= 2;
    const failedRepeats = brain.ownMoves.filter((item) => item.attack.key === key && (!item.attack.hit || item.attack.blocked)).length;
    score -= failedRepeats * p.repeatPenalty;
    if (p.memory && brain.memory.filter((item) => item.kind === 'jump').length >= 2 && role === 'antiAir') score += p.punish;
    if (p.memory && brain.memory.filter((item) => ['ranged', 'retreat'].includes(item.kind)).length >= 2 && role === 'approach') score += p.punish * 0.7;
    result.push({ key, score });
  }
  return result;
}

function movement(self, brain, scene, random) {
  const preferred = self.def.ai?.preferredRange || 95;
  const ranged = preferred > 170;
  const buildingMeter = self.energyPoints === 0 || (brain.bank && self.energyPoints < 3);
  const target = (ranged && buildingMeter ? 115 : preferred) - (ranged && !buildingMeter ? 0 : brain.profile.punish * 9) + (random() - 0.5) * brain.profile.distanceError;
  const band = brain.profile.distanceError * 0.35 + 12;
  const canRetreat = scene.dir > 0 ? self.x > 100 : self.x < 860;
  let direction = 0;
  if (scene.dist > target + band) direction = scene.dir;
  else if (ranged && !buildingMeter && scene.dist < Math.max(140, target - band) && canRetreat) direction = -scene.dir;
  brain.mode = direction === -scene.dir ? 'retreat' : direction ? 'approach' : 'neutral';
  return { left: direction < 0, right: direction > 0 };
}

function defensiveInput(self, brain, scene, random) {
  const threat = scene.danger;
  if (!threat) return null;
  let choice = brain.defenses.get(threat.token);
  if (!choice) {
    const lows = brain.memory.filter((item) => item.kind === 'low').length;
    choice = { defend: random() < brain.profile.defendChance,
      crouch: threat.low && random() < Math.min(0.98, brain.profile.crouchAccuracy + (lows > 1 ? 0.03 : 0)),
      dodge: random() < brain.profile.dodgeChance, attemptedDodge: false };
    brain.defenses.set(threat.token, choice);
    if (brain.defenses.size > 24) brain.defenses.delete(brain.defenses.keys().next().value);
    brain.reactions.push({ at: brain.time, observedAt: brain.view.at });
    if (brain.reactions.length > 12) brain.reactions.shift();
  }
  if (!choice.defend) return null;
  if (choice.dodge && !choice.attemptedDodge && self.dodgeCooldown <= 0 && self.ground && !self.guard) {
    choice.attemptedDodge = true;
    const cornered = scene.dir > 0 ? self.x < 110 : self.x > 850;
    const direction = cornered ? scene.dir : -scene.dir;
    brain.mode = 'evade';
    return { dodge: true, left: direction < 0, right: direction > 0 };
  }
  if (!self.ground) return null;
  brain.mode = 'defend';
  return { guard: true, down: choice.crouch, left: choice.crouch && scene.dir > 0, right: choice.crouch && scene.dir < 0 };
}

export function decideCpuInput(self, other, dt, difficulty = 'normal', random = Math.random) {
  const brain = updatePerception(self, other, dt, difficulty, random);
  const p = brain.profile;
  self.aiTime = Math.max(0, self.aiTime - dt);
  if (self.hp <= 0 || self.knockdownTimer > 0 || self.capturedBy || self.grabbing || self.dodgeTimer > 0) {
    brain.mode = self.hp <= 0 ? 'ko' : 'recover';
    brain.held = {};
    return {};
  }
  if (self.stun > 0) {
    brain.confirmation = null;
    brain.mode = 'stunned';
    return self.blockStun ? heldInput(brain.held) : {};
  }
  const scene = situation(self, brain);
  if (self.attack) {
    const a = self.attack;
    if (a.hit && !a.blocked && a.move.cancel?.length && !brain.confirmation)
      brain.confirmation = { attack: a, readyAt: brain.time + p.confirmDelay, attempt: random() < p.comboChance, used: false };
    const confirm = brain.confirmation;
    if (confirm?.attack === a && confirm.attempt && !confirm.used && brain.time >= confirm.readyAt) {
      confirm.used = true;
      const options = scoreAiMoves(self, brain, scene, a.move.cancel);
      if (savingEnergy(self, brain, scene)) options.push({ key: null, score: 2.5 });
      const key = selectWeighted(options, random, p.temperature);
      if (key) { brain.mode = 'combo'; brain.held = {}; return { [key]: true }; }
    }
    return self.ground ? {} : heldInput(brain.held);
  }
  if (self.aiTime > 0) return heldInput(brain.held);
  self.aiTime = p.think;
  brain.decisions++;
  const defense = defensiveInput(self, brain, scene, random);
  if (defense) { brain.held = heldInput(defense); return defense; }
  const input = movement(self, brain, scene, random);
  const options = scoreAiMoves(self, brain, scene);
  if (options.length && random() < p.attackChance) {
    const saving = savingEnergy(self, brain, scene);
    const spacing = self.def.ai?.retreatBelow && self.energyPoints > 0 && !scene.danger &&
      ((scene.dir > 0 && input.left) || (scene.dir < 0 && input.right));
    const key = selectWeighted([...options, { key: null, score: spacing ? 3.6 : saving ? 2.5 : -1 }], random, p.temperature);
    if (key) {
      brain.mode = scene.liveAttack ? 'counter' : 'attack';
      brain.held = self.ground ? {} : heldInput(input);
      return { ...brain.held, [key]: true };
    }
  }
  const repeatedWaves = p.memory && brain.memory.filter((item) => item.kind === 'ranged').length >= 2;
  if (scene.dist > 170 && scene.dist < 420 && random() < p.jumpChance * (repeatedWaves ? 2 : 1)) input.jump = true;
  brain.held = heldInput(input);
  return input;
}

export function aiSnapshot(self) {
  const brain = self.aiBrain;
  return brain ? { difficulty: brain.difficulty, state: brain.mode, reactionDelay: brain.latency,
    memory: brain.memory.map((item) => item.kind), decisions: brain.decisions,
    perceivedAttack: brain.view.attack?.key || null, reactions: brain.reactions.map((item) => ({ ...item })) } : null;
}
