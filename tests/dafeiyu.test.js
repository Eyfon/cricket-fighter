import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Fighter } from "../js/combat.js";
import { CombatWorld } from "../js/combat-world.js";
import { roster } from "../js/roster.js";

const dt = 1 / 60;
const dafeiyu = roster.find((character) => character.id === "dafeiyu");
const target = roster.find((character) => character.id === "prototype-b");

test("大肥鱼资源目录包含独立图集、鲸鱼特效和裁切清单", async () => {
  const root = path.resolve("assets/characters/dafeiyu");
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.character, "dafeiyu");
  for (const file of ["common/atlas.png", "common/legacy-atlas.png", "skill1/atlas.png", "skill2/atlas.png", "super/atlas.png", "super/whale.png"])
    assert.ok((await readFile(path.join(root, file))).length > 0, file);
  for (const action of ["idle", "walk", "jump", "guard", "crouch-guard", "hurt", "knockdown", "ko", "dodge", "punch", "kick", "forward-punch", "forward-kick", "down-punch", "down-kick", "skill1", "skill2", "super"])
    assert.ok(manifest.actions[action]?.frames?.length, action);
});

test("大肥鱼公共图集的拳脚动作使用分开的图集行", () => {
  const sprites = dafeiyu.sprites;
  assert.ok(sprites.punch.clip.every((frame) => frame.rect[1] < 948));
  assert.ok(sprites.kick.clip.every((frame) => frame.rect[1] >= 948));
  assert.ok(sprites.forwardPunch.clip.every((frame) => frame.rect[1] < 948));
  assert.ok(sprites.forwardKick.clip.every((frame) => frame.rect[1] >= 948));
});

test("大肥鱼技能一从目标脚下命中并击飞", () => {
  const a = new Fighter(dafeiyu, 120, 1), b = new Fighter(target, 840, -1);
  a.energyPoints = 1;
  assert.equal(a.tryMove("skill"), true);
  const world = new CombatWorld(11);
  const events = [];
  for (let i = 0; i < 80 && !events.length; i++) {
    a.step({}, b, dt);
    b.step({}, a, dt);
    events.push(...world.step([a, b], dt).filter((event) => event.key === "skill"));
  }
  assert.equal(events.length, 1);
  assert.equal(events[0].damage, 15);
  assert.ok(b.vy < 0 || b.stun > 0);
});

test("大肥鱼技能二在前方定点水波震爆并击飞倒地", () => {
  const a = new Fighter(dafeiyu, 400, 1), b = new Fighter(target, 520, -1);
  a.energyPoints = 1;
  assert.equal(a.tryMove("skill2"), true);
  const world = new CombatWorld(12);
  let event = null;
  for (let i = 0; i < 80 && !event; i++) {
    a.step({}, b, dt);
    b.step({}, a, dt);
    const events = world.step([a, b], dt);
    event ||= events.find((entry) => entry.key === "skill2");
    if (i === 16) assert.equal(world.projectiles.length, 0);
  }
  assert.ok(event);
  assert.equal(event.damage, 10);
  assert.ok(b.hp <= 90);
  assert.ok(b.knockdownTimer > 0 || b.state === "ko");
});

test("大肥鱼大招从身后生成蓝鲸并击飞倒地", () => {
  const a = new Fighter(dafeiyu, 360, 1), b = new Fighter(target, 600, -1);
  a.energyPoints = 3;
  assert.equal(a.tryMove("super"), true);
  const world = new CombatWorld(13);
  let event = null;
  let whale = false;
  for (let i = 0; i < 100 && !event; i++) {
    a.step({}, b, dt);
    b.step({}, a, dt);
    whale ||= world.projectiles.some((projectile) => projectile.whale);
    event ||= world.step([a, b], dt).find((entry) => entry.key === "super");
  }
  assert.equal(whale, true);
  assert.ok(event);
  assert.equal(event.damage, 40);
  assert.ok(b.knockdownTimer > 0 || b.state === "ko");
});
