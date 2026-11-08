import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_PROFILES } from '../js/ai-profiles.js';
import { aiSnapshot, captureAiProjectiles, scoreAiMoves } from '../js/ai.js';
import { Fighter, cpuInput } from '../js/combat.js';
import { seededRandom } from '../js/battle-frame.js';
import { roster } from '../js/roster.js';
import { normalizeRules } from '../js/settings.js';
import { simulateAiMatch } from '../tools/ai-simulation.mjs';

const dt = 1 / 60, levels = ['easy', 'normal', 'hard'];
const pair = (distance = 80, character = 0) => [new Fighter(roster[character], 400, 1), new Fighter(roster[1], 400 + distance, -1)];
const actions = ['punch', 'kick', 'forwardPunch', 'forwardKick', 'specialPunch', 'specialKick', 'skill', 'skill2', 'super', 'dodge', 'jump'];

test('difficulty profiles improve reaction, defense, confirmation and memory without changing fighter data', () => {
  assert.ok(AI_PROFILES.easy.reaction[0] > AI_PROFILES.normal.reaction[1]);
  assert.ok(AI_PROFILES.normal.reaction[0] > AI_PROFILES.hard.reaction[1]);
  for (const key of ['defendChance', 'comboChance', 'crouchAccuracy', 'memory'])
    assert.ok(AI_PROFILES.easy[key] < AI_PROFILES.normal[key] && AI_PROFILES.normal[key] < AI_PROFILES.hard[key]);
  for (const profile of Object.values(AI_PROFILES)) {
    assert.ok(profile.defendChance < 1);
    assert.ok(!('damageMultiplier' in profile));
  }
});

for (const level of levels) {
  test(level + ': hidden new attacks and movement cannot affect decisions before the observation delay', () => {
    const [a, b] = pair(), [control, opponent] = pair();
    const random = seededRandom(42), controlRandom = seededRandom(42);
    for (let i = 0; i < 30; i++)
      assert.deepEqual(cpuInput(a, b, dt, level, random), cpuInput(control, opponent, dt, level, controlRandom));
    b.tryMove('specialKick');
    b.x += 100;
    const limit = Math.floor(a.aiBrain.latency / dt) - 1;
    for (let i = 0; i < limit; i++)
      assert.deepEqual(cpuInput(a, b, dt, level, random), cpuInput(control, opponent, dt, level, controlRandom));
    for (let i = 0; i < 30; i++) cpuInput(a, b, dt, level, random);
    assert.equal(aiSnapshot(a).perceivedAttack, 'specialKick');
    assert.equal(a.aiBrain.view.x, b.x);
  });

  test(level + ': defense respects reaction time at different decision phases and rolls once per threat', () => {
    for (const phase of [0, 0.5, 0.95]) {
      const [a, b] = pair();
      a.canUseMove = () => false;
      a.dodgeCooldown = 1;
      for (let i = 0; i < 30; i++) cpuInput(a, b, dt, level, () => 0);
      a.aiTime = AI_PROFILES[level].think * phase;
      const startedAt = a.aiBrain.time;
      b.tryMove('specialKick');
      let firstDefense = null;
      for (let i = 0; i < 40; i++) {
        const input = cpuInput(a, b, dt, level, () => 0);
        if (input.guard && firstDefense === null) firstDefense = a.aiBrain.time - startedAt;
      }
      assert.ok(firstDefense >= AI_PROFILES[level].reaction[0], String(firstDefense));
      assert.ok(firstDefense <= AI_PROFILES[level].reaction[1] + AI_PROFILES[level].think + dt * 2);
      assert.equal(a.aiBrain.reactions.length, 1);
      assert.ok(a.aiBrain.reactions.every((r) => r.at - r.observedAt + 1e-9 >= a.aiBrain.latency));
      assert.equal(a.aiBrain.held.down, true);
    }
  });

  test(level + ': skills can use a single point at full health, with no extra cooldown', () => {
    let used = false;
    for (let seed = 0; seed < 24 && !used; seed++) {
      const [a, b] = pair(400); a.energyPoints = 1;
      const input = cpuInput(a, b, dt, level, seededRandom(seed));
      if (input.skill) {
        a.step(input, b, dt);
        assert.equal(a.attack.key, 'skill');
        assert.equal(a.energyPoints, 0);
        assert.deepEqual(a.cooldowns, {});
        used = true;
      }
    }
    assert.ok(used);
  });

  test(level + ': safe three-point supers are available instead of being permanently hoarded', () => {
    let used = false;
    for (let seed = 0; seed < 24 && !used; seed++) {
      const [a, b] = pair(100, 1); a.energyPoints = 3;
      const input = cpuInput(a, b, dt, level, seededRandom(seed));
      if (input.super) {
        a.step(input, b, dt);
        assert.equal(a.attack.key, 'super');
        assert.equal(a.energyPoints, 0);
        used = true;
      }
    }
    assert.ok(used);
  });

  test(level + ': stun and knockdown suppress attacks, and blockstun only retains held defense', () => {
    const [a, b] = pair(); a.energyPoints = 3;
    a.stun = 0.2;
    assert.deepEqual(cpuInput(a, b, dt, level, () => 0), {});
    a.stun = 0; a.knockdownTimer = 0.5;
    assert.deepEqual(cpuInput(a, b, dt, level, () => 0), {});
    a.knockdownTimer = 0; a.stun = 0.1; a.blockStun = true;
    a.aiBrain.held = { guard: true, down: true, left: true };
    const input = cpuInput(a, b, dt, level, () => 0);
    assert.equal(input.guard, true);
    assert.ok(actions.every((key) => !input[key]));
  });

  test(level + ': only confirmed unblocked punches can cancel into a legal follow-up', () => {
    for (const blocked of [false, true]) {
      const [a, b] = pair();
      a.tryMove('punch'); a.attack.frame = a.attack.move.startup;
      a.attack.hit = true; a.attack.blocked = blocked;
      let follow = null;
      for (let i = 0; i < 8 && a.attack?.key === 'punch'; i++) {
        const input = cpuInput(a, b, dt, level, () => 0);
        a.step(input, b, dt);
        if (a.attack && a.attack.key !== 'punch') follow = a.attack.key;
      }
      if (blocked) assert.equal(follow, null);
      else assert.ok(roster[0].moves.punch.cancel.includes(follow), String(follow));
    }
  });

  test(level + ': opponent memory is bounded, expires, and round reset clears it', () => {
    const [a, b] = pair(); a.canUseMove = () => false;
    for (let move = 0; move < 12; move++) {
      b.attack = { key: 'specialKick', move: b.def.moves.specialKick, frame: 0 };
      for (let i = 0; i < 24; i++) cpuInput(a, b, dt, level, () => 0.5);
    }
    assert.equal(a.aiBrain.memory.length, AI_PROFILES[level].memory);
    b.attack = null;
    for (let i = 0; i < 700; i++) cpuInput(a, b, dt, level, () => 0.5);
    assert.equal(a.aiBrain.memory.length, 0);
    a.reset(250, 1);
    assert.equal(a.aiBrain, null);
    assert.deepEqual(a.aiProjectiles, []);
  });
}

test('projectile perception excludes delayed shots and keeps a fixed copy of visible positions', () => {
  const [a, b] = pair();
  const shot = { owner: b, delay: 0, life: 1, x: 450, y: 300, speed: 400, direction: -1, radius: 20 };
  const samples = captureAiProjectiles(a, [shot, { ...shot, owner: a }, { ...shot, delay: 0.12 }]);
  assert.equal(samples.length, 1);
  shot.x = 430;
  assert.equal(samples[0].x, 450);
});

test('directional attacks cannot be scored as super interrupts while actual offensive skills can', () => {
  const [a, b] = pair(80); a.energyPoints = 1;
  b.tryMove('punch');
  for (let i = 0; i < 20; i++) cpuInput(a, b, dt, 'hard', () => 0.5);
  a.aiBrain.view.attack = { id: 12, key: 'super', frame: 1, move: b.def.moves.super };
  const entries = scoreAiMoves(a, a.aiBrain);
  assert.ok(entries.find((e) => e.key === 'skill2').score > entries.find((e) => e.key === 'punch').score);
});

test('mixed difficulty normalizes independently and old shared difficulty preferences still work', () => {
  const old = normalizeRules({ difficulty: 'hard' });
  assert.equal(old.p1Difficulty, 'hard'); assert.equal(old.p2Difficulty, 'hard');
  const mixed = normalizeRules({ p1Difficulty: 'easy', p2Difficulty: 'hard' });
  assert.equal(mixed.p1Difficulty, 'easy'); assert.equal(mixed.p2Difficulty, 'hard');
  assert.equal(normalizeRules({ p1Difficulty: 'missing' }).p1Difficulty, 'normal');
});

test('full AI simulation reproduces with reversed character updates and uses every role without stat changes', () => {
  const config = { seed: 45231, levels: ['hard', 'normal'], seconds: 20 };
  const expected = simulateAiMatch(config);
  assert.deepEqual(simulateAiMatch({ ...config, reverseSteps: true }), expected);
  assert.ok(expected.fighters.every((f) => f.damageDealt > 0));
  assert.ok(expected.fighters.every((f) => f.reactionDelay > 0));
  const plain = new Fighter(roster[0], 400, 1);
  assert.equal(plain.maxHp, 100); assert.equal(plain.def.moves.punch.damage, 4);
});
