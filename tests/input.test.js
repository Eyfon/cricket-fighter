import test from "node:test";
import assert from "node:assert/strict";
import { bindings, HumanInput, eventCode } from "../js/input.js";
import { Fighter, FLOOR, resolveHit } from "../js/combat.js";
import { applyDamage } from "../js/combat.js";
import { roster } from "../js/roster.js";
const dt = 1 / 60;
test("direction attacks and guards follow facing for both players", () => {
  for (const binding of bindings) for (const facing of [1, -1]) {
    const a = new Fighter(roster[0], 480, facing), b = new Fighter(roster[1], 480 + facing * 150, -facing);
    const forward = facing === 1 ? binding.right : binding.left;
    const back = facing === 1 ? binding.left : binding.right;
    for (const [button, slot] of [[binding.punch, "forwardPunch"], [binding.kick, "forwardKick"]]) {
      a.reset(480, facing);
      a.step(new HumanInput(binding).read(new Set([forward, button]), dt), b, dt);
      assert.equal(a.attack?.key, slot);
    }
    a.reset(480, facing);
    a.step(new HumanInput(binding).read(new Set([binding.guard]), dt), b, dt);
    assert.equal(a.guard, true);
    assert.equal(a.crouchGuard, false);
    assert.equal(applyDamage(b, a, b.def.moves.specialKick).blocked, false);
    a.reset(480, facing);
    a.step(new HumanInput(binding).read(new Set([back, binding.guard]), dt), b, dt);
    assert.equal(a.crouchGuard, true);
    assert.equal(a.state, 'crouchGuard');
    assert.equal(a.vx, 0);
    assert.equal(a.hurtbox().h, a.def.height * 0.8);
    assert.equal(applyDamage(b, a, b.def.moves.specialKick).blocked, true);
    const held = new HumanInput(binding).read(new Set([back,binding.guard]),dt);
    a.step(held,b,dt);
    assert.equal(a.state,'crouchGuard');
    assert.equal(a.blockStun,true);
    assert.equal(a.def.sprites.crouchGuard.clip.length,2);
  }
});
test('releasing crouch guard restores standing height and airborne/downed fighters cannot guard', () => {
  for (const def of roster) {
    const a=new Fighter(def,400,1),b=new Fighter(roster[0],600,-1);
    a.step({down:true,left:true},b,dt);
    assert.equal(a.state,'crouchGuard');
    a.step({},b,dt);
    assert.equal(a.guard,false);
    assert.equal(a.hurtbox().h,def.height);
    a.knockdownTimer=0.5;
    a.step({down:true,left:true},b,dt);
    assert.equal(a.guard,false);
    a.reset(400,1);a.y=350;a.ground=false;
    a.step({down:true,left:true},b,dt);
    assert.equal(a.guard,false);
  }
});
test("both skill buttons spend one point, super spends three", () => {
  for (const binding of bindings) for (const [button, slot, cost] of [["skill", "skill", 1], ["skill2", "skill2", 1], ["super", "super", 3]]) {
    const a = new Fighter(roster[0], 400, 1), b = new Fighter(roster[1], 600, -1);
    a.energyPoints = 3;
    a.step(new HumanInput(binding).read(new Set([binding[button]]), dt), b, dt);
    assert.equal(a.attack?.key, slot);
    assert.equal(a.energyPoints, 3 - cost);
  }
});
test("airborne forward movement does not convert attacks into grounded specials", () => {
  const a = new Fighter(roster[0], 400, 1), b = new Fighter(roster[1], 600, -1);
  a.ground = false;
  const input = new HumanInput(bindings[0]).read(new Set([bindings[0].right, bindings[0].punch]), dt);
  a.step(input, b, dt);
  assert.equal(a.attack?.key, "punch");
  assert.ok(a.vx > 0, "aerial normal keeps held forward movement");
});
test("back direction remains usable while grounded", () => {
  const a = new Fighter(roster[0], 400, 1), b = new Fighter(roster[1], 600, -1);
  const input = new HumanInput(bindings[0]);
  const back = input.read(new Set([bindings[0].left]), dt);
  a.step(back, b, dt);
  assert.ok(a.x < 400);
  assert.equal(a.guard, false);
});
for (const [i, binding] of bindings.entries()) {
  test(`P${i + 1}: down+attack overrides guard and selects both special moves`, () => {
    for (const [button, move] of [
      ["punch", "specialPunch"],
      ["kick", "specialKick"],
    ]) {
      const input = new HumanInput(binding),
        keys = new Set([binding.guard]);
      assert.equal(input.read(keys, dt).down, true);
      input.read(keys, dt);
      keys.add(binding[button]);
      const action = input.read(keys, dt);
      assert.equal(action[move], true);
      assert.equal(action.down, true);
      assert.equal(action.jump, undefined);
      for (let n = 0; n < 10; n++)
        assert.equal(input.read(keys, dt).jump, undefined);
    }
  });
  test(`P${i + 1}: up alone jumps once; held attacks do not repeat`, () => {
    const input = new HumanInput(binding),
      keys = new Set([binding.up]);
    assert.equal(input.read(keys, dt).jump, true);
    input.reset();
    let jumps = 0;
    for (let n = 0; n < 20; n++) if (input.read(keys, dt).jump) jumps++;
    assert.equal(jumps, 1);
    keys.clear();
    input.read(keys, dt);
    keys.add(binding.punch);
    assert.equal(input.read(keys, dt).punch, true);
    assert.equal(input.read(keys, dt).punch, undefined);
  });
}
test("up+attack is no longer a special command", () => {
  for (const binding of bindings) {
    const input = new HumanInput(binding);
    const action = input.read(new Set([binding.up, binding.punch]), dt);
    assert.equal(action.jump, true);
    assert.equal(action.punch, true);
    assert.equal(action.specialPunch, undefined);
  }
});
test("physical numpad keys survive Num Lock being off", () => {
  assert.equal(eventCode({ code: "Numpad1", key: "End" }), "Numpad1");
  assert.equal(eventCode({ code: "Digit1", key: "1" }), "Digit1");
  assert.equal(
    new HumanInput(bindings[1]).read(new Set(["Digit1"]), dt).punch,
    undefined,
  );
});
test("down+attack starts a free special instead of staying in guard", () => {
  const a = new Fighter(roster[0], 400, 1),
    b = new Fighter(roster[1], 600, -1);
  const input = new HumanInput(bindings[0]);
  a.step(input.read(new Set(["KeyS", "KeyJ"]), dt), b, dt);
  assert.equal(a.attack.key, "specialPunch");
  assert.equal(a.meter, 0);
  assert.equal(a.y, FLOOR);
});
test("dodge defaults in place, honors direction and cannot repeat during cooldown", () => {
  for (const facing of [1, -1]) {
    const a = new Fighter(roster[0], 400, facing);
    assert.equal(a.tryDodge({}), true);
    assert.equal(a.dodgeDirection, 0);
    assert.equal(a.tryMove("punch"), false);
    a.dodgeTimer = 0;
    assert.equal(a.tryDodge({ right: true }), false);
    a.dodgeCooldown = 0;
    assert.equal(a.tryDodge({ right: true }), true);
    assert.equal(a.dodgeDirection, 1);
  }
});
test("dodge invulnerability expires before recovery finishes", () => {
  const a = new Fighter(roster[0], 400, 1),
    b = new Fighter(roster[1], 480, -1);
  a.tryMove("punch");
  a.attack.frame = 6;
  b.tryDodge({});
  assert.equal(resolveHit(a, b), null);
  b.dodgeTimer = 0.04;
  assert.ok(resolveHit(a, b));
});
test("small skill can repeat after recovery while points remain, without a cooldown", () => {
  const a = new Fighter(roster[0], 400, 1),
    b = new Fighter(roster[1], 750, -1);
  a.energyPoints = 3;
  for (let cast = 0; cast < 3; cast++) {
    assert.equal(a.tryMove("skill"), true);
    assert.equal(a.cooldowns.skill, undefined);
    const total =
      a.attack.move.startup + a.attack.move.active + a.attack.move.recovery;
    for (let i = 0; i < total + 1; i++) a.step({}, b, dt);
  }
  assert.equal(a.energyPoints, 0);
  assert.equal(a.tryMove("skill"), false);
  a.reset(400, 1);
  assert.deepEqual(a.cooldowns, {});
});
