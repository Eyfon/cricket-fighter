import test from 'node:test';
import assert from 'node:assert/strict';
import { roster } from '../js/roster.js';
import { Fighter, applyDamage } from '../js/combat.js';
import { CombatWorld } from '../js/combat-world.js';
const dt = 1 / 60;
const naiwa = roster.find((c) => c.id === 'naiwa');

test('奶娃回眸一击 ignores distance and causes one hit', () => {
  const a = new Fighter(naiwa, 120, 1), b = new Fighter(roster[0], 840, -1);
  a.energyPoints = 1;
  assert.equal(a.tryMove('skill'), true);
  const world = new CombatWorld();
  const events = [];
  for (let i = 0; i < 80; i++) { a.step({}, b, dt); events.push(...world.step([a, b], dt)); }
  assert.equal(events.filter((e) => e.key === 'skill').reduce((s, e) => s + e.damage, 0), naiwa.moves.skill.damage);
  assert.ok(b.stun > 0 || b.hp < b.maxHp);
});

test('奶娃捧腹大笑 applies four local pulses totaling its configured damage', () => {
  const a = new Fighter(naiwa, 400, 1), b = new Fighter(roster[0], 500, -1);
  a.energyPoints = 1;
  assert.equal(a.tryMove('skill2'), true);
  const world = new CombatWorld();
  let damage = 0;
  for (let i = 0; i < 80; i++) { a.step({}, b, dt); damage += world.step([a, b], dt).filter((e) => e.key === 'skill2').reduce((s, e) => s + e.damage, 0); }
  assert.equal(damage, naiwa.moves.skill2.damage);
});

test('奶娃大招 has startup invulnerability and spawns a falling egg rain', () => {
  const a = new Fighter(naiwa, 400, 1), b = new Fighter(roster[0], 520, -1);
  a.energyPoints = 3;
  assert.equal(a.tryMove('super'), true);
  const blocked = applyDamage(b, a, b.def.moves.punch, { key: 'punch', damage: 4 });
  assert.equal(blocked, null);
  const world = new CombatWorld();
  for (let i = 0; i < 30; i++) { a.step({}, b, dt); world.step([a, b], dt); }
  assert.equal(world.projectiles.length, 6);
  assert.ok(world.projectiles.every((p) => p.rain && p.verticalSpeed > 0));
});
