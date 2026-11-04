import { CombatWorld } from "../js/combat-world.js";
import test from "node:test";
import assert from "node:assert/strict";
import { roster } from "../js/roster.js";
import {
  validateCharacter,
  assertRoster,
  MOVE_SLOTS,
} from "../js/character-schema.js";
import { Fighter, resolveHit, cpuInput } from "../js/combat.js";
test("all shipped characters satisfy the six-slot contract", () => {
  for (const character of roster)
    assert.deepEqual(validateCharacter(character), []);
});
test("invalid slots, resource rules, artwork and duplicate ids are rejected", () => {
  const broken = structuredClone(roster[0]);
  delete broken.moves.specialKick;
  broken.moves.skill.cooldown = 4;
  broken.moves.super.cost = 0;
  broken.moves.punch.cancel = ["missing"];
  delete broken.sprites.dodge;
  const errors = validateCharacter(broken).join("\n");
  for (const field of ["specialKick", "cooldown", "cost", "cancel", "dodge"])
    assert.ok(errors.includes(field));
  assert.throws(() => assertRoster([roster[0], roster[0]]), /id 重复/);
});
for (const character of roster) {
  test(`${character.name}: every slot can activate and cause its configured damage`, () => {
    for (const slot of MOVE_SLOTS) {
      const a = new Fighter(character, 400, 1),
        b = new Fighter(roster[0], 470, -1);
      a.energyPoints = 3;
      assert.equal(a.tryMove(slot), true, slot);
      const world = new CombatWorld();
      let damage = 0;
      for (let frame = 0; frame < 180; frame++) {
        a.step({}, b, 1 / 60);
        damage += world
          .step([a, b], 1 / 60)
          .reduce((sum, event) => sum + event.damage, 0);
      }
      assert.equal(damage, character.moves[slot].damage, slot);
    }
  });
  test(`${character.name}: special roles are distinct and grounded moves reject aerial use`, () => {
    const a = new Fighter(character, 400, 1);
    assert.notEqual(
      character.moves.specialPunch.ai.role,
      character.moves.specialKick.ai.role,
    );
    a.ground = false;
    for (const slot of ["specialPunch", "specialKick", "skill", "super"])
      assert.equal(a.canUseMove(slot), false, slot);
    assert.equal(a.canUseMove("punch"), true);
  });
}
test("AI filters ground-only skills in the air", () => {
  const a = new Fighter(roster[0], 400, 1),
    b = new Fighter(roster[1], 480, -1);
  a.ground = false;
  a.energyPoints = 3;
  for (let i = 0; i < 30; i++) {
    a.aiTime = 0;
    const input = cpuInput(a, b, 1 / 60);
    for (const slot of ["specialPunch", "specialKick", "skill", "super"])
      assert.equal(input[slot], undefined);
  }
});
test("per-character launch and dash parameters control actual movement", () => {
  for (const character of roster) {
    const a = new Fighter(character, 400, 1),
      b = new Fighter(roster[0], 850, -1);
    const dash = Object.keys(character.moves).find(
      (key) => character.moves[key].dashSpeed,
    );
    if (dash) {
      a.energyPoints = 3;
      a.tryMove(dash);
      a.attack.frame = a.attack.move.startup - 1;
      a.step({}, b, 1 / 60);
      assert.equal(a.vx, character.moves[dash].dashSpeed);
    }
    const antiAir = Object.keys(character.moves).find(
      (key) => character.moves[key].effect === "rise",
    );
    if (antiAir) {
      a.reset(400, 1);
      a.energyPoints = 3;
      a.tryMove(antiAir);
      a.attack.frame = a.attack.move.startup - 1;
      a.step({}, b, 1 / 60);
      assert.ok(a.vy < 0);
      assert.ok(Math.abs(a.vy - (character.moves[antiAir].riseVelocity + 1650 / 60)) < 0.001);
    }
  }
});
