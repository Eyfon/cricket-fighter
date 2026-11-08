import test from "node:test";
import assert from "node:assert/strict";
import { Fighter, applyDamage, cpuInput } from "../js/combat.js";
import { CombatWorld } from "../js/combat-world.js";
import { roster } from "../js/roster.js";

function pair() {
  const a = new Fighter(roster[0], 400, 1);
  const b = new Fighter(roster[1], 480, -1);
  b.energyPoints = 3;
  assert.ok(b.tryMove("super"));
  return [a, b];
}
test('both skills resist repeated normals and directional strikes throughout their action', () => {
  for (const def of roster) for (const slot of ['skill','skill2']) {
    for (const phase of ['startup','active','recovery']) {
      const a = new Fighter(def,400,1), b = new Fighter(roster[0],480,-1);
      a.energyPoints = 1;
      a.tryMove(slot);
      const attack = a.attack, move = attack.move;
      attack.frame = phase === 'startup' ? 1 : phase === 'active' ? move.startup : move.startup + move.active;
      for (const key of ['punch','kick','forwardPunch','forwardKick']) {
        const hp = a.hp;
        const event = applyDamage(b,a,b.def.moves[key],{key});
        assert.ok(event.armored, `${def.name}/${slot}/${phase}/${key}`);
        assert.equal(a.attack,attack);
        assert.equal(a.stun,0);
        assert.equal(a.pushVx,0);
        assert.equal(a.hp,hp-b.def.moves[key].damage);
      }
    }
  }
});
test('launch and knockdown break skills, but a protected sweep does not', () => {
  for (const slot of ['skill','skill2']) for (const key of ['specialPunch','specialKick']) {
    const a = new Fighter(roster[0],400,1), b = new Fighter(roster[1],480,-1);
    a.energyPoints=1;
    a.tryMove(slot);
    assert.equal(applyDamage(b,a,b.def.moves[key],{key}).armored,false);
    assert.equal(a.attack,null);
    a.reset(400,1);
    a.energyPoints=1;
    a.tryMove(slot);
    a.sweepImmunity=3;
    assert.ok(applyDamage(b,a,b.def.moves.specialKick,{key:'specialKick'}).armored);
    assert.ok(a.attack);
    a.hp=1;
    applyDamage(b,a,b.def.moves.punch);
    assert.equal(a.attack,null);
    assert.equal(a.hp,0);
  }
});
test('grabs respect skill resistance unless they carry launch or knockdown', () => {
  for (const launch of [0,140]) {
    const a = new Fighter(structuredClone(roster[1]),400,1), b = new Fighter(roster[0],480,-1);
    a.def.moves.skill.launch=launch;
    a.energyPoints=b.energyPoints=1;
    a.tryMove('skill'); b.tryMove('skill2');
    a.attack.frame=a.attack.move.startup;
    assert.equal(new CombatWorld().acquire(a,b),launch>0);
  }
});

test("super absorbs repeated normal hits at full damage without interruption", () => {
  const [a, b] = pair();
  const attack = b.attack;
  const first = applyDamage(a, b, a.def.moves.punch);
  assert.equal(first.armored, true);
  assert.equal(b.hp, 96);
  assert.equal(b.attack, attack);
  assert.equal(b.stun, 0);
  assert.equal(b.pushVx, 0);
  assert.equal(b.vy, 0);
  assert.equal(b.energyPoints, 0);
  const second = applyDamage(a, b, a.def.moves.punch);
  assert.equal(second.armored, true);
  assert.equal(b.hp, 92);
  assert.equal(b.attack, attack);
  assert.equal(b.stun, 0);
});

test("super protection remains through startup, active frames and recovery", () => {
  for (const index of [0, 1]) {
    const a = new Fighter(roster[1 - index], 400, 1);
    const b = new Fighter(roster[index], 480, -1);
    b.energyPoints = 3;
    b.tryMove("super");
    for (const frame of [0, b.attack.move.startup, b.attack.move.startup + b.attack.move.active]) {
      b.attack.frame = frame;
      assert.equal(applyDamage(a, b, a.def.moves.punch).armored, true);
      assert.ok(b.attack);
    }
    b.reset(480, -1);
    b.energyPoints = 3;
    b.tryMove("super");
    assert.equal(b.hasSuperArmor(), true);
  }
});

test("supers, throws and lethal hits bypass startup armor", () => {
  let [a, b] = pair();
  assert.equal(
    applyDamage(a, b, a.def.moves.super, { key: "super" }).armored,
    false,
  );
  assert.equal(b.attack, null);
  [a, b] = pair();
  b.hp = 3;
  applyDamage(a, b, a.def.moves.punch);
  assert.equal(b.hp, 0);
  assert.equal(b.attack, null);
  [a, b] = pair();
  // The grabbing character must acquire through the world's real collision path.
  a.attack = null;
  a.energyPoints = 3;
  a.def = roster[1];
  a.tryMove("super");
  a.attack.frame = a.attack.move.startup;
  const world = new CombatWorld();
  assert.equal(world.acquire(a, b), true);
  assert.equal(b.attack, null);
  assert.equal(b.capturedBy, a);
});
test("only skill one, skill two and super interrupt; all directional attacks retain super", () => {
  for (const key of ['punch','kick','forwardPunch','forwardKick','specialPunch','specialKick','skill','skill2','super']) {
    const [a,b] = pair();
    const skill = ['skill','skill2','super'].includes(key);
    const event = applyDamage(a,b,a.def.moves[key],{key});
    assert.equal(event.armored, !skill, key);
    assert.equal(b.attack === null, skill, key);
  }
});

test("AI saves super while an opponent is dodging or attacking at close range", () => {
  for (const threat of ["dodge", "attack", "projectile"]) {
    const [a, b] = pair();
    a.def = roster[1];
    b.def = roster[0];
    a.energyPoints = 3;
    a.aiTime = 0;
    b.attack = null;
    if (threat === "dodge") b.dodgeTimer = 0.2;
    if (threat === "attack") b.tryMove("punch");
    if (threat === "projectile") a.projectileThreat = true;
    for (let i = 0; i < 80; i++) {
      a.aiTime = 0;
      const input = cpuInput(a, b, 1 / 60);
      // New threats cannot affect choices before they pass the reaction delay.
      if (a.aiBrain.time > a.aiBrain.latency + 1 / 60) assert.ok(!input.super);
    }
  }
  const [a, b] = pair();
  a.def = roster[1];
  a.energyPoints = 3;
  b.attack = null;
  let used = false;
  for (let i = 0; i < 80; i++) {
    a.aiTime = 0;
    used ||= !!cpuInput(a, b, 1 / 60).super;
  }
  assert.equal(used, true, "AI still uses super when there is a safe opening");
});
