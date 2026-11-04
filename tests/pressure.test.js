import test from "node:test";
import assert from "node:assert/strict";
import { Fighter, applyDamage } from "../js/combat.js";
import { roster } from "../js/roster.js";
import { CombatWorld } from "../js/combat-world.js";
import { superFrame, SUPER_FREEZE, SUPER_DURATION } from "../js/super-flash.js";
const dt = 1 / 60;
test("repeated normals leave time to guard, dodge or jump, and never relaunch", () => {
  for (const def of roster)
    for (const key of ["punch", "kick"]) {
      const move = def.moves[key];
      assert.ok(move.stun < move.startup + move.active + move.recovery);
      for (const action of ["guard", "dodge", "jump"]) {
        const a = new Fighter(def, 842, 1),
          b = new Fighter(def, 922, -1);
        applyDamage(a, b, move, { key });
        assert.equal(Math.abs(b.vy), 0);
        for (let i = 0; i <= move.stun; i++) b.step({ [action]: true }, a, dt);
        assert.ok(
          action === "guard"
            ? b.guard
            : action === "dodge"
              ? b.dodgeTimer > 0
              : !b.ground,
          `${def.name}/${key}/${action}`,
        );
      }
    }
});
test("both walls recoil the attacker even while they are in an attack", () => {
  for (const direction of [-1, 1]) {
    const a = new Fighter(roster[0], direction === 1 ? 842 : 118, direction);
    const b = new Fighter(roster[1], direction === 1 ? 922 : 38, -direction);
    a.tryMove("punch");
    b.guard = true;
    applyDamage(a, b, a.def.moves.punch, { direction });
    const before = a.x;
    a.step({}, b, dt);
    assert.ok((a.x - before) * direction < 0);
  }
});
test('wall recoil applies to close melee only, including the pressure escape path', () => {
  for (const direction of [-1, 1]) for (const pressure of [false, true]) {
    for (const [source, distance] of [['projectile', 80], ['projectile', 500], ['burst', 80], ['burst', 200], ['grab', 80], ['melee', 200]]) {
      const targetX = direction === 1 ? 922 : 38;
      const a = new Fighter(roster[0], targetX - direction * distance, direction),
        b = new Fighter(roster[1], targetX, -direction);
      if (pressure) b.controlTime = 0.8;
      const e = applyDamage(a, b, a.def.moves.punch, {source, direction});
      assert.ok(e);
      assert.equal(a.pushVx, 0, `${source}/${distance}/${pressure}`);
      assert.ok(b.hp < 100);
    }
  }
});
test('hit and block stun reject all skills without spending energy or buffering them', () => {
  for (const def of roster) for (const key of ['skill', 'skill2', 'super']) for (const block of [false,true]) {
    const a = new Fighter(def, 400, 1), b = new Fighter(roster[0], 700, -1);
    a.energyPoints = 3;
    a.stun = 0.08;
    a.blockStun = block;
    assert.equal(a.tryMove(key), false);
    a.step({[key]:true}, b, dt);
    assert.equal(a.attack, null);
    assert.equal(a.bufferedAction, null);
    assert.equal(a.energyPoints, 3);
    for (let i=0;i<8;i++) a.step({}, b, dt);
    assert.equal(a.attack, null);
    assert.equal(a.tryMove(key), true);
  }
});
test("prolonged pressure grants an actionable window, then expires normally", () => {
  const a = new Fighter(roster[0], 842, 1),
    b = new Fighter(roster[1], 922, -1);
  const move = a.def.moves.punch;
  applyDamage(a, b, move);
  const firstStun = b.stun;
  applyDamage(a, b, move);
  assert.ok(b.stun < firstStun);
  b.controlTime = 0.8;
  const event = applyDamage(a, b, move);
  assert.equal(event.escape, true);
  assert.equal(b.stun, 0);
  const hp = b.hp;
  assert.equal(applyDamage(a, b, move), null);
  assert.equal(b.hp, hp);
  b.step({ dodge: true, left: true }, a, dt);
  assert.ok(b.dodgeTimer > 0);
  for (let i = 0; i < 50; i++) b.step({}, a, dt);
  assert.equal(b.escapeTimer, 0);
  assert.ok(applyDamage(a, b, move));
});
test("a completed throw cannot immediately chain into another grab", () => {
  const a = new Fighter(roster[1], 450, 1),
    b = new Fighter(roster[0], 520, -1);
  const world = new CombatWorld();
  const grab = { owner: a, target: b };
  a.grabbing = grab;
  b.capturedBy = a;
  world.release(grab, true);
  assert.ok(b.stun <= 0.16 && b.escapeTimer >= 0.34);
  b.y = 438;
  b.ground = true;
  a.energyPoints = 3;
  a.tryMove("skill");
  a.attack.frame = a.attack.move.startup;
  assert.equal(world.acquire(a, b), false);
});
test("super camera returns to normal after a short freeze", () => {
  assert.equal(superFrame(0).frozen, true);
  assert.equal(superFrame(SUPER_FREEZE + 0.01).frozen, false);
  assert.ok(superFrame(0.2).scale < 1);
  assert.equal(superFrame(SUPER_DURATION).scale, 1);
  assert.equal(superFrame(SUPER_DURATION).done, true);
});
