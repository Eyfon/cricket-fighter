import { Fighter, cpuInput } from '../js/combat.js';
import { CombatWorld } from '../js/combat-world.js';
import { prepareBattleFrame, separateFighters } from '../js/battle-frame.js';
import { captureAiProjectiles } from '../js/ai.js';
import { superFrame } from '../js/super-flash.js';
import { roster } from '../js/roster.js';

export function simulateAiMatch({ seed = 1, characters = [0, 1], levels = ['normal', 'normal'],
  swapStreams = false, seconds = 60, reverseSteps = false } = {}) {
  const dt = 1 / 60, world = new CombatWorld(seed);
  const fighters = characters.map((index, i) => new Fighter(roster[index], i ? 710 : 250, i ? -1 : 1));
  const stats = fighters.map(() => ({ starts: {}, attacks: [], combos: 0, pointsSpent: 0, guardFrames: 0, fullMeterFrames: 0, controlledFrames: 0 }));
  let activeTime = 0, ticks = 0, hitstop = 0, flash = null, blocks = 0;
  while (activeTime < seconds && fighters.every((f) => f.hp > 0) && ticks < seconds * 600) {
    ticks++;
    if (flash !== null) {
      flash += dt;
      const frame = superFrame(flash);
      if (frame.done) flash = null;
      else if (frame.frozen) continue;
    }
    if (hitstop > 0) { hitstop -= dt; continue; }
    activeTime += dt;
    const inputs = prepareBattleFrame(fighters, (f, i) => {
      f.aiProjectiles = captureAiProjectiles(f, world.projectiles);
      f.projectileThreat = f.aiProjectiles.some((p) => Math.abs(p.x - f.x) < 170 && Math.sign(f.x - p.x) === p.direction);
      return cpuInput(f, fighters[1 - i], dt, levels[i], world.aiRandom[swapStreams ? 1 - i : i]);
    });
    const previous = fighters.map((f) => f.attack);
    if (reverseSteps) inputs.reverse();
    for (const { fighter, input, opponent } of inputs) fighter.step(input, opponent, dt);
    let superStarted = false;
    fighters.forEach((f, i) => {
      const stat = stats[i];
      if (f.attack && f.attack !== previous[i]) {
        const key = f.attack.key;
        stat.starts[key] = (stat.starts[key] || 0) + 1;
        stat.attacks.push(f.attack);
        stat.pointsSpent += f.attack.move.cost || 0;
        if (previous[i]?.hit && !previous[i].blocked && previous[i].move.cancel?.includes(key)) stat.combos++;
        if (key === 'super') superStarted = true;
      }
      if (f.guard) stat.guardFrames++;
      if (f.energyPoints === 3) stat.fullMeterFrames++;
      if (f.stun > 0 || f.knockdownTimer > 0 || f.capturedBy) stat.controlledFrames++;
    });
    if (superStarted) { flash = 0; continue; }
    separateFighters(fighters);
    for (const event of world.step(fighters, dt)) {
      hitstop = event.blocked ? 0.025 : event.super ? 0.08 : event.grab ? 0.04 : 0.032;
      if (event.blocked) blocks++;
    }
  }
  const winner = fighters[0].hp === fighters[1].hp ? null : fighters[0].hp > fighters[1].hp ? 0 : 1;
  return { seed, characters, levels, winner, timeout: fighters.every((f) => f.hp > 0),
    activeSeconds: activeTime, elapsedSeconds: ticks * dt, blocks,
    fighters: fighters.map((f, i) => {
      const stat = stats[i], direct = stat.attacks.filter((a) => !['projectile', 'burst'].includes(a.move.effect));
      return { hp: f.hp, damageDealt: fighters[1 - i].maxHp - fighters[1 - i].hp,
        starts: stat.starts, combos: stat.combos, pointsSpent: stat.pointsSpent,
        directAttacks: direct.length, directContacts: direct.filter((a) => a.hit).length,
        guardSeconds: stat.guardFrames * dt, fullMeterSeconds: stat.fullMeterFrames * dt,
        controlledSeconds: stat.controlledFrames * dt,
        reactionDelay: f.aiBrain?.latency, decisions: f.aiBrain?.decisions || 0 };
    }),
  };
}
