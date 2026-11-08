import test from "node:test";
import assert from "node:assert/strict";
import { newBattleSeed, seededRandom, prepareBattleFrame } from "../js/battle-frame.js";
import { Fighter, cpuInput } from "../js/combat.js";
import { CombatWorld } from "../js/combat-world.js";
import { roster } from "../js/roster.js";

const dt = 1 / 60;
function clash(world, lead = -1, gap = 75) {
  const fighters = [new Fighter(roster[0], 400, 1), new Fighter(roster[0], 400 + gap, -1)];
  fighters.forEach((f, i) => {
    assert.ok(f.tryMove("punch"));
    f.attack.frame = f.attack.move.startup + (i === lead ? 1 : 0);
  });
  const events = world.step(fighters, dt);
  if (!events.length) return { fighters, events };
  assert.equal(events.length, 1);
  const winner = fighters[0].hp === 100 ? 0 : 1;
  assert.equal(fighters[winner].hp, 100);
  assert.ok(fighters[1 - winner].hp < 100);
  assert.equal(fighters[1 - winner].attack, null);
  return { fighters, events, winner };
}

test("seeded random supports zero, reproduces a sequence, and accepts fresh match seeds", () => {
  const draws = (seed) => {
    const random = seededRandom(seed);
    return Array.from({ length: 64 }, () => random());
  };
  assert.deepEqual(draws(0), draws(0));
  assert.notDeepEqual(draws(0), draws(1));
  assert.ok(draws(0xffffffff).every((v) => v >= 0 && v < 1));
  const seed = newBattleSeed();
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
  for (const invalid of [-1, 0x100000000, 1.5, NaN, "1"])
    assert.throws(() => new CombatWorld(invalid), RangeError);
});

test("exact normal ties can favor either player and never cause a mutual stagger", () => {
  const counts = [0, 0];
  for (let seed = 0; seed < 1024; seed++) counts[clash(new CombatWorld(seed)).winner]++;
  assert.ok(counts.every((count) => count > 400 && count < 624), String(counts));
});

test("same seed reproduces tie outcomes and rounds continue instead of repeating", () => {
  const run = (seed) => {
    const world = new CombatWorld(seed);
    return Array.from({ length: 40 }, () => {
      const winner = clash(world).winner;
      world.reset();
      return winner;
    });
  };
  assert.deepEqual(run(91234), run(91234));
  assert.notDeepEqual(run(91234), run(91235));
  assert.equal(new Set(run(91234)).size, 2);
});

test("an earlier active attack wins on either side without rolling a tie", () => {
  for (const lead of [0, 1]) {
    const world = new CombatWorld(4);
    world.tieRandom = () => assert.fail("a real first hit must not draw random priority");
    assert.equal(clash(world, lead).winner, lead);
  }
});

test("one exact contact rolls once, with no draws for misses or already resolved hits", () => {
  const world = new CombatWorld(4);
  let draws = 0;
  world.tieRandom = () => { draws++; return 0.25; };
  assert.equal(clash(world, -1, 400).events.length, 0);
  assert.equal(draws, 0);
  const { fighters } = clash(world);
  for (let i = 0; i < 10; i++) world.step(fighters, dt);
  assert.equal(draws, 1);
});

test("AI random streams do not consume the collision tie stream", () => {
  const a = new CombatWorld(22), b = new CombatWorld(22);
  for (let i = 0; i < 100; i++) a.aiRandom[i % 2]();
  assert.equal(clash(a).winner, clash(b).winner);
});

test("both inputs see the frame-start attacks and both facings use the old positions", () => {
  const fighters = [new Fighter(roster[0], 470, 1), new Fighter(roster[0], 471, -1)];
  const observed = [];
  const frame = prepareBattleFrame(fighters, (f, i) => {
    observed.push(fighters[1 - i].attack);
    return i === 0 ? { right: true } : {};
  });
  for (const { fighter, input, opponent } of frame) fighter.step(input, opponent, dt);
  assert.deepEqual(observed, [null, null]);
  assert.ok(fighters[0].x > 471);
  assert.equal(fighters[1].facing, -1);

  const attacks = prepareBattleFrame(fighters, (f, i) => {
    assert.equal(fighters[1 - i].attack, null);
    return { punch: true };
  });
  for (const { fighter, input, opponent } of attacks) fighter.step(input, opponent, dt);
  assert.ok(fighters.every((f) => f.attack?.key === "punch"));
});

function simulate(seed, reverseSteps = false, visualNoise = false) {
  const world = new CombatWorld(seed);
  const fighters = [new Fighter(roster[0], 250, 1), new Fighter(roster[1], 710, -1)];
  const hits = [];
  for (let tick = 0; tick < 1800 && fighters.every((f) => f.hp > 0); tick++) {
    const frame = prepareBattleFrame(fighters, (f, i) => {
      f.projectileThreat = world.projectiles.some((p) =>
        p.owner !== f && p.delay <= 0 && Math.abs(p.x - f.x) < 170 && Math.sign(f.x - p.x) === p.direction);
      return cpuInput(f, fighters[1 - i], dt, "normal", world.aiRandom[i]);
    });
    if (reverseSteps) frame.reverse();
    if (visualNoise) for (let i = 0; i < 7; i++) Math.random();
    for (const { fighter, input, opponent } of frame) fighter.step(input, opponent, dt);
    for (const event of world.step(fighters, dt))
      hits.push([tick, event.key, event.damage, ...fighters.map((f) => f.hp)]);
  }
  return { hits, fighters: fighters.map((f) => [f.x, f.y, f.hp, f.meter, f.energyPoints, f.attack?.key]) };
}

test("seeded AI combat reproduces with reversed fighter updates and unrelated visual randomness", () => {
  const expected = simulate(73482);
  assert.ok(expected.hits.length > 0);
  assert.deepEqual(simulate(73482, true, true), expected);
  assert.notDeepEqual(simulate(73483), expected);
});
