import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRules,
  DEFAULT_RULES,
  normalizeOptions,
  DEFAULT_OPTIONS,
} from "../js/settings.js";
import { Fighter, resolveHit } from "../js/combat.js";
import { roster } from "../js/roster.js";
test("rule defaults and corrupted preferences normalize safely", () => {
  assert.deepEqual(normalizeRules(), DEFAULT_RULES);
  assert.deepEqual(normalizeRules(null), DEFAULT_RULES);
  assert.deepEqual(
    normalizeRules({
      healthMultiplier: 200,
      wins: 0,
      time: -1,
      stage: "missing",
    }),
    DEFAULT_RULES,
  );
  assert.deepEqual(normalizeOptions(null), DEFAULT_OPTIONS);
  assert.equal(normalizeOptions({ volume: 8 }).volume, 1);
});
test("all allowed times, shared health multipliers and victory targets survive normalization", () => {
  for (const time of [0, 30, 60, 90])
    for (const healthMultiplier of [1, 2, 3, 5])
      for (const wins of [1, 2, 3]) {
        const rules = normalizeRules({ time, healthMultiplier, wins });
        assert.equal(rules.time, time);
        assert.equal(rules.healthMultiplier, healthMultiplier);
        assert.equal(rules.wins, wins);
      }
});
test("shared multiplier changes health only; configured damage is used directly", () => {
  for (const multiplier of [1, 2, 3, 5]) {
    const a = new Fighter(roster[0], 400, 1, multiplier),
      b = new Fighter(roster[1], 480, -1, multiplier);
    assert.equal(a.maxHp, 100 * multiplier);
    assert.equal(b.maxHp, a.maxHp);
    a.tryMove("punch");
    a.attack.frame = a.attack.move.startup;
    const hit = resolveHit(a, b);
    assert.equal(hit.damage, 4);
    assert.equal(b.hp, 100 * multiplier - 4);
    b.reset(480, -1);
    assert.equal(b.hp, 100 * multiplier);
  }
});

test("sound defaults to on while explicit mute remains supported", () => {
  assert.equal(DEFAULT_OPTIONS.muted, false);
  assert.equal(normalizeOptions().muted, false);
  assert.equal(normalizeOptions({ muted: true }).muted, true);
});
