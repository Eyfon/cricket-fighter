import test from "node:test";
import assert from "node:assert/strict";
import { Fighter, applyDamage, resolveHit } from "../js/combat.js";
import { roster } from "../js/roster.js";
const dt = 1 / 60;
const pair = () => [
  new Fighter(roster[0], 400, 1),
  new Fighter(roster[1], 480, -1),
];
test("damage in configuration is the actual full-hit damage, with no hidden multiplier", () => {
  const [a, b] = pair();
  const move = { ...a.def.moves.punch, damage: 10 };
  const event = applyDamage(a, b, move);
  assert.equal(event.damage, 10);
  assert.equal(b.hp, 90);
});
test("guard chips for 25 percent, can be overridden per move, and chip can KO", () => {
  const [a, b] = pair();
  b.guard = true;
  const move = { ...a.def.moves.punch, damage: 8 };
  assert.equal(applyDamage(a, b, move).damage, 2);
  b.guard = true;
  assert.equal(applyDamage(a, b, { ...move, chipRatio: 0.1 }).damage, 0.8);
  b.hp = 0.5;
  b.guard = true;
  applyDamage(a, b, move);
  assert.equal(b.hp, 0);
  assert.equal(b.state, "ko");
});
test("holding guard stays effective through block stun against rapid attacks", () => {
  const [a, b] = pair();
  b.guard = true;
  applyDamage(a, b, a.def.moves.punch);
  b.step({ guard: true }, a, dt);
  assert.equal(b.guard, true);
  assert.equal(b.blockStun, true);
  const event = applyDamage(a, b, a.def.moves.punch);
  assert.equal(event.blocked, true);
  assert.equal(event.damage, 1);
});
test("special moves can repeat as soon as recovery ends, with no cooldown", () => {
  const [a, b] = pair();
  a.tryMove("specialPunch");
  const total =
    a.attack.move.startup + a.attack.move.active + a.attack.move.recovery;
  for (let i = 0; i < total + 1; i++) a.step({}, b, dt);
  assert.equal(a.attack, null);
  assert.equal(a.tryMove("specialPunch"), true);
  for (const character of roster)
    for (const move of Object.values(character.moves)) {
      assert.equal(move.cooldown, undefined);
      assert.ok(move.recovery <= 14);
    }
});
test("an attack pressed just before recovery ends is buffered into the next action", () => {
  const [a, b] = pair();
  b.x = 850;
  a.tryMove("punch");
  const m = a.attack.move;
  a.attack.frame = m.startup + m.active + m.recovery - 3;
  a.step({ kick: true }, b, dt);
  assert.equal(a.attack.key, "punch");
  for (let i = 0; i < 4; i++) a.step({}, b, dt);
  assert.equal(a.attack.key, "kick");
  assert.equal(a.bufferedAction, null);
});
