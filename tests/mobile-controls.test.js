import test from "node:test";
import assert from "node:assert/strict";
import { joystickVector, PointerKeys } from "../js/mobile-controls.js";
import { HumanInput, bindings } from "../js/input.js";

test("joystick has a dead zone and eight directions including crouch guard", () => {
  assert.deepEqual(joystickVector(5, 4, 60).actions, []);
  for (const [x, y, expected] of [
    [60, 0, ["right"]], [-60, 0, ["left"]], [0, -60, ["up"]], [0, 60, ["guard"]],
    [60, -60, ["right", "up"]], [-60, -60, ["left", "up"]],
    [60, 60, ["right", "guard"]], [-60, 60, ["left", "guard"]],
  ]) assert.deepEqual(joystickVector(x, y, 60).actions, expected);
  assert.ok(Math.hypot(...Object.values(joystickVector(300, -300, 60)).slice(0, 2)) <= 60.001);
});
test("portrait fallback maps physical touch to rotated landscape coordinates", () => {
  for (const [x, y] of [[60, 0], [0, 60], [0, -60], [-60, 60]]) {
    assert.deepEqual(joystickVector(-y, x, 60, true), joystickVector(x, y, 60));
  }
});
test("multiple fingers hold directions and attacks independently", () => {
  const touch = new PointerKeys();
  touch.set(1, ["KeyS", "KeyA"], false);
  touch.set(2, ["KeyJ"]);
  const input = new HumanInput(bindings[0]);
  assert.deepEqual(input.read(touch.sample()), { left: true, right: false, down: true, specialPunch: true });
  touch.release(2);
  assert.deepEqual(input.read(touch.sample()), { left: true, right: false, down: true });
  touch.set(3, ["KeyK"]);
  assert.equal(input.read(touch.sample()).specialKick, true);
});
test("all six touch keys use the shared six-button contract without repeating on hold", () => {
  for (const action of ["punch", "kick", "dodge", "skill", "skill2", "super"]) {
    const touch = new PointerKeys(), input = new HumanInput(bindings[0]);
    touch.set(2, [bindings[0][action]]);
    assert.equal(input.read(touch.sample())[action], true);
    assert.equal(input.read(touch.sample())[action], undefined);
  }
});
test("quick tap survives until a simulation step but cancellation discards it", () => {
  const touch = new PointerKeys();
  touch.set(1, ["KeyJ"]); touch.release(1);
  assert.equal(touch.sample().has("KeyJ"), true);
  assert.equal(touch.sample().has("KeyJ"), false);
  touch.set(2, ["KeyK"]); touch.release(2, true);
  assert.equal(touch.sample().has("KeyK"), false);
});
test("moving the stick replaces directions rather than latching obsolete ones", () => {
  const touch = new PointerKeys();
  touch.set(1, ["KeyD"], false); touch.set(1, ["KeyA"], false);
  assert.deepEqual([...touch.sample()], ["KeyA"]);
});
test("clearing releases every finger and tap, without mutating physical keys", () => {
  const touch = new PointerKeys(), keyboard = new Set(["KeyJ"]);
  touch.set(1, ["KeyJ"]); touch.set(2, ["KeyS"], false);
  touch.clear();
  assert.equal(touch.sample().size, 0);
  assert.equal(keyboard.has("KeyJ"), true);
});
test("two fingers on a button keep it held until both lift", () => {
  const touch = new PointerKeys();
  touch.set(1, ["KeyJ"]); touch.set(2, ["KeyJ"]); touch.sample();
  touch.release(1);
  assert.equal(touch.sample().has("KeyJ"), true);
  touch.release(2);
  assert.equal(touch.sample().has("KeyJ"), false);
});
