import { CombatWorld } from "../js/combat-world.js";
import test from "node:test";
import assert from "node:assert/strict";
import { Fighter, resolveHit, cpuInput, FLOOR } from "../js/combat.js";
import { roster } from "../js/roster.js";
const pair = () => [
  new Fighter(roster[0], 400, 1),
  new Fighter(roster[1], 480, -1),
];
function active(f, key = "punch") {
  assert.equal(f.tryMove(key), true);
  f.attack.frame = f.attack.move.startup;
}
test("startup cannot hit; all active frames test collision; one hit per attack", () => {
  const [a, b] = pair();
  a.tryMove("punch");
  assert.equal(resolveHit(a, b), null);
  a.attack.frame = 6;
  assert.equal(resolveHit(a, b).damage, 4);
  assert.equal(b.hp, 96);
  assert.equal(resolveHit(a, b), null);
});
test("a missed active frame can hit later when the opponent enters range", () => {
  const [a, b] = pair();
  b.x = 700;
  active(a);
  assert.equal(resolveHit(a, b), null);
  b.x = 480;
  a.attack.frame++;
  assert.ok(resolveHit(a, b));
});
test("left-facing hitbox mirrors the attack", () => {
  const [a, b] = pair();
  active(b);
  assert.equal(resolveHit(b, a).damage, 4);
});
test("guard reduces normal damage, adds meter, and cannot cancel on block", () => {
  const [a, b] = pair();
  b.guard = true;
  active(a);
  assert.equal(resolveHit(a, b).blocked, true);
  assert.equal(b.hp, 99);
  assert.ok(b.meter > 0);
  assert.equal(a.tryMove("kick"), false);
});
test("three points gate the super; it spends points and penetrates guard", () => {
  const [a, b] = pair();
  assert.equal(a.tryMove("super"), false);
  a.energyPoints = 3;
  b.guard = true;
  active(a, "super");
  assert.equal(a.meter, 0);
  assert.equal(new CombatWorld().step([a, b], 1 / 60)[0].damage, 19);
});
test("confirmed punch can cancel into kick, interrupted attacks are cleared", () => {
  const [a, b] = pair();
  active(a);
  resolveHit(a, b);
  assert.equal(a.tryMove("kick"), true);
  b.stun = 0;
  active(b);
  resolveHit(b, a);
  assert.equal(a.attack, null);
  assert.equal(a.tryMove("punch"), false);
});
test("jump lands on the floor and movement remains inside the arena", () => {
  const [a, b] = pair();
  a.step({ jump: true }, b, 1 / 60);
  assert.ok(a.y < FLOOR);
  b.x = 0;
  for (let i = 0; i < 240; i++) a.step({ left: true }, b, 1 / 60);
  assert.equal(a.y, FLOOR);
  assert.equal(a.x, 38);
});
test("reset clears match-local attack and stun but preserves round wins", () => {
  const [a] = pair();
  a.wins = 1;
  a.hp = 0;
  a.stun = 5;
  a.reset(250, 1);
  assert.equal(a.hp, 100);
  assert.equal(a.stun, 0);
  assert.equal(a.attack, null);
  assert.equal(a.wins, 1);
});
test("AI approaches a distant target without a server", () => {
  const [a, b] = pair();
  b.x = 850;
  const input = cpuInput(a, b, 1 / 60);
  assert.equal(input.right, true);
});
