import test from "node:test";
import assert from "node:assert/strict";
import { roster } from "../js/roster.js";
import { Fighter, FLOOR, applyDamage, KNOCKDOWN_DURATION } from "../js/combat.js";
import { CombatWorld } from "../js/combat-world.js";
import { sampleAnimation, drawAnimatedFighter } from "../js/animation.js";
const dt = 1 / 60;
test('Canglan pushes once and emits three staggered balls along one palm-height line', () => {
  for (const direction of [-1,1]) {
    const a=new Fighter(roster[0],480,direction), b=new Fighter(roster[1],480+direction*400,-direction), world=new CombatWorld();
    a.energyPoints=1;a.tryMove('skill');
    a.attack.frame=a.attack.move.startup;
    world.step([a,b],dt);
    assert.equal(world.projectiles.length,3);
    assert.equal(world.projectiles.filter(p=>p.age>0).length,1);
    assert.equal(world.projectiles.filter(p=>p.delay>0).length,2);
    assert.ok(world.projectiles.every(p=>Math.abs(p.y-(a.y-142))<2));
    assert.ok(world.projectiles.every(p=>(p.x-a.x)*direction>=94));
    assert.ok(world.projectiles.every(p=>p.verticalSpeed===0));
    assert.deepEqual(a.def.sprites.skill.phases.active,[3]);
    const heights=world.projectiles.map(p=>p.y);
    for(let i=0;i<17;i++) world.step([a,b],dt);
    assert.equal(world.projectiles.length,3);
    assert.deepEqual(world.projectiles.map(p=>p.y),heights);
    assert.ok(world.projectiles.every(p=>p.delay<=0 && p.age>0));
    assert.ok((world.projectiles[0].x-world.projectiles[1].x)*direction>50);
    assert.ok((world.projectiles[1].x-world.projectiles[2].x)*direction>50);
  }
  assert.equal(roster[0].moves.super.projectile.offsetY,-148);
});
test('Chifeng super holds six punches and a final slam across its extended sequence', () => {
  const a=new Fighter(roster[1],400,1),b=new Fighter(roster[0],475,-1),world=new CombatWorld();
  a.energyPoints=3;a.tryMove('super');
  const hitTimes=[];let capturedFrames=0;
  for(let i=0;i<180;i++) {
    a.step({},b,dt);b.step({},a,dt);
    for(const e of world.step([a,b],dt)) if(e.grab) hitTimes.push(i*dt);
    if(b.capturedBy) capturedFrames++;
  }
  assert.equal(hitTimes.length,7);
  assert.ok(hitTimes.at(-1)-hitTimes[0]>1.3);
  assert.ok(capturedFrames>=100);
  assert.equal(b.hp,79);
  assert.equal(a.energyPoints,0);
  assert.equal(b.capturedBy,null);
  assert.equal(a.grabbing,null);
});
test('expanded second skills hit targets beyond their previous radius', () => {
  for(const [def,x,targetX] of [[roster[0],400,650],[roster[1],300,605]]) {
    const a=new Fighter(def,x,1),b=new Fighter(roster[0],targetX,-1),world=new CombatWorld();
    a.energyPoints=1;a.tryMove('skill2');
    let hits=0;
    for(let i=0;i<100;i++) {a.step({},b,dt);hits+=world.step([a,b],dt).length;}
    assert.equal(hits,1,def.name);
    assert.equal(b.hp,100-a.def.moves.skill2.damage);
    if(def===roster[0]) assert.equal(b.knockdownTimer,0);
  }
});
test('V5 skills use isolated new art with foot pivots and time their grapple impacts', () => {
  for(const def of roster) for(const slot of ['skill','super']) {
    const sprite=def.sprites[slot];
    assert.match(sprite.src,/-v5\.png$/);
    assert.equal(sprite.clip.length,6);
    assert.ok(sprite.clip.every(p=>p.originY>0));
    // A sheet uses one anatomical scale. Only the separate blue halfway
    // extension uses its own calibrated scale for its different source size.
    const sameSheet=sprite.clip.filter(p=>!p.src || p.src===sprite.src);
    assert.equal(new Set(sameSheet.map(p=>p.scale)).size,1);
    if(sprite.grabTimeline) {
      const f=new Fighter(def,400,1);f.energyPoints=3;f.tryMove(slot);f.state=slot;
      for(const key of sprite.grabTimeline) {
        f.grabbing={time:key.at,move:f.attack.move};
        assert.deepEqual(sampleAnimation(f).a.rect,sprite.clip[key.frame].rect);
      }
    }
  }
});
test('Canglan super projectile launches its target then completes a grounded knockdown', () => {
  const a = new Fighter(roster[0],200,1), b = new Fighter(roster[1],480,-1), world = new CombatWorld();
  a.energyPoints=3;
  a.tryMove('super');
  let hit=false, airborne=false, down=false;
  for(let i=0;i<160;i++) {
    a.step({},b,dt); b.step({},a,dt);
    for(const event of world.step([a,b],dt)) {
      if(event.key==='super') {
        hit=true;
        assert.ok(b.vy<0);
        assert.ok(b.knockdownTimer>0);
      }
    }
    if(hit && !b.ground) airborne=true;
    if(hit && b.ground && b.state==='knockdown') down=true;
  }
  assert.ok(hit && airborne && down);
  assert.equal(b.hp,100-a.def.moves.super.damage);
});
test('sweep immunity prevents repeat knockdown only, while damage, stun and grabs work normally', () => {
  const a = new Fighter(roster[0], 400, 1), b = new Fighter(roster[1], 475, -1);
  const sweep = () => applyDamage(a, b, a.def.moves.specialKick, { key: 'specialKick' });
  sweep();
  assert.equal(b.knockdownTimer, KNOCKDOWN_DURATION);
  assert.equal(b.sweepImmunity, 5);
  const health = b.hp;
  for (let i = 0; i < 44; i++) b.step({}, a, dt);
  assert.equal(b.knockdownTimer, 0);
  assert.ok(applyDamage(a, b, a.def.moves.punch));
  assert.ok(b.hp < health);
  assert.ok(b.stun > 0);
  assert.ok(b.sweepImmunity > 0);
  assert.ok(sweep());
  assert.equal(b.knockdownTimer, 0);
  assert.equal(b.state, 'hurt');
  for (let i = 0; i < 310; i++) b.step({}, a, dt);
  assert.equal(b.sweepImmunity, 0);
  assert.ok(sweep());
  assert.equal(b.knockdownTimer, KNOCKDOWN_DURATION);
  b.reset(475, -1);
  assert.equal(b.sweepImmunity, 0);
});
test("a wave travels independently, hits at range and disappears", () => {
  const a = new Fighter(roster[0], 200, 1),
    b = new Fighter(roster[1], 500, -1),
    world = new CombatWorld();
  a.energyPoints = 1;
  a.tryMove("skill");
  a.attack.frame = a.attack.move.startup;
  assert.equal(world.step([a, b], dt).length, 0);
  assert.equal(world.projectiles.length, 3);
  a.attack = null;
  let damage = 0;
  for (let i = 0; i < 90; i++)
    damage += world.step([a, b], dt).reduce((s, e) => s + e.damage, 0);
  assert.equal(damage, 15);
  assert.equal(world.projectiles.length, 0);
});
test('blue burst damages both sides and launches without knockdown, including after sweep protection', () => {
  for (const direction of [-1, 1]) {
    const a = new Fighter(roster[0], 480, 1),
      b = new Fighter(roster[1], 480 + direction * 160, -direction), world = new CombatWorld();
    b.sweepImmunity = 4;
    a.energyPoints = 1;
    a.tryMove('skill2');
    let hits = 0;
    for (let i = 0; i < 20; i++) {
      a.step({}, b, dt);
      hits += world.step([a, b], dt).length;
    }
    assert.equal(hits, 1);
    assert.equal(b.hp, 88);
    assert.ok(b.vy < 0);
    assert.equal(b.ground, false);
    assert.equal(Math.sign(b.pushVx), direction);
    let airborne = false, downed = false;
    for (let i = 0; i < 70; i++) {
      b.step({}, a, dt);
      if (!b.ground) airborne = true;
      if (b.ground && b.state === 'knockdown') downed = true;
    }
    assert.ok(airborne);
    assert.equal(downed, false);
    assert.equal(b.knockdownTimer, 0);
  }
});
test('ground hammer stops on contact, damages once, and retains a ground impact visual', () => {
  const a = new Fighter(roster[1], 300, 1),
    b = new Fighter(roster[0], 470, -1), world = new CombatWorld();
  a.energyPoints = 1;
  a.tryMove('skill2');
  let hits = 0, landingX;
  for (let i = 0; i < 90; i++) {
    a.step({}, b, dt);
    const events = world.step([a, b], dt);
    hits += events.length;
    if (events.length) {
      assert.equal(a.ground, true);
      assert.equal(a.vx, 0);
      assert.equal(a.burstVisual.ground, true);
      assert.equal(b.hp, 86);
      landingX = a.x;
    }
  }
  assert.equal(hits, 1);
  assert.equal(a.x, landingX);
  assert.equal(a.attack, null);
});
test('jump hammer has a recovery exit even if world effect processing is unavailable', () => {
  const a = new Fighter(roster[1], 300, 1), b = new Fighter(roster[0], 700, -1);
  a.energyPoints = 1;
  a.tryMove('skill2');
  for(let i=0;i<100;i++) a.step({}, b, dt);
  assert.equal(a.ground, true);
  assert.equal(a.attack, null);
  const oldX = a.x;
  a.step({right:true}, b, dt);
  assert.ok(a.x > oldX);
  assert.equal(a.tryMove('punch'), true);
});
test("normal wave is blockable and dodge does not consume invulnerability", () => {
  for (const mode of ["guard", "dodge"]) {
    const a = new Fighter(roster[0], 200, 1),
      b = new Fighter(roster[1], 290, -1),
      world = new CombatWorld();
    b.guard = mode === "guard";
    if (mode === "dodge") b.dodgeTimer = 0.2;
    a.energyPoints = 1;
    a.tryMove("skill");
    a.attack.frame = 18;
    const events = world.step([a, b], dt);
    assert.equal(b.hp, mode === "guard" ? 100 - 5 * 0.25 : 100);
    if (mode === "guard") {
      assert.equal(events[0].blocked, true);
      assert.equal(world.projectiles.length, 2);
    } else assert.equal(world.projectiles.length, 3);
  }
});
test("projectiles pass through each other and keep traveling", () => {
  for (const superBall of [false, true]) {
    const a = new Fighter(roster[0], 200, 1),
      b = new Fighter(roster[0], 750, -1),
      world = new CombatWorld();
    a.energyPoints = 3;
    b.energyPoints = 1;
    a.tryMove(superBall ? "super" : "skill");
    b.tryMove("skill");
    a.attack.frame = a.attack.move.startup;
    b.attack.frame = b.attack.move.startup;
    world.step([a, b], dt);
    a.attack = b.attack = null;
    for (let i = 0; i < 28; i++) world.step([a, b], dt);
    assert.equal(world.projectiles.length, superBall ? 4 : 6);
  }
});
test("grab ignores guard, locks movement, deals timed damage and releases", () => {
  const a = new Fighter(roster[1], 400, 1),
    b = new Fighter(roster[0], 475, -1),
    world = new CombatWorld();
  b.guard = true;
  a.energyPoints = 1;
  a.tryMove("skill");
  a.attack.frame = a.attack.move.startup;
  world.step([a, b], dt);
  assert.equal(b.capturedBy, a);
  assert.equal(b.canUseMove("punch"), false);
  const x = b.x;
  b.step({ left: true, jump: true }, a, dt);
  assert.equal(b.x, x);
  for (let i = 0; i < 65; i++) world.step([a, b], dt);
  assert.equal(b.hp, 87);
  assert.equal(b.capturedBy, null);
  assert.equal(a.grabbing, null);
  assert.equal(b.y, FLOOR);
  assert.ok(b.vx > 0);
});
test("grab misses airborne and dodging targets; interruption and reset release both actors", () => {
  for (const condition of ["air", "dodge", "interrupt", "reset"]) {
    const a = new Fighter(roster[1], 400, 1),
      b = new Fighter(roster[0], 475, -1),
      world = new CombatWorld();
    if (condition === "air") b.ground = false;
    if (condition === "dodge") b.dodgeTimer = 0.2;
    a.energyPoints = 1;
    a.tryMove("skill");
    a.attack.frame = 12;
    world.step([a, b], dt);
    if (condition === "air" || condition === "dodge") {
      assert.equal(world.grabs.length, 0);
      continue;
    }
    if (condition === "interrupt") {
      a.stun = 0.5;
      world.step([a, b], dt);
    } else world.reset();
    assert.equal(b.capturedBy, null);
    assert.equal(a.grabbing, null);
    assert.equal(world.grabs.length, 0);
  }
});
test("sweep attack knocks down an unguarded grounded target", () => {
  const a = new Fighter(roster[1], 400, 1),
    b = new Fighter(roster[0], 475, -1),
    world = new CombatWorld();
  a.tryMove("specialKick");
  a.attack.frame = a.attack.move.startup;
  world.step([a, b], dt);
  assert.equal(b.state, "knockdown");
  assert.ok(b.knockdownTimer > 0);
});
test("Chifeng skill two jumps forward and bursts on landing", () => {
  const a = new Fighter(roster[1], 300, 1),
    b = new Fighter(roster[0], 470, -1),
    world = new CombatWorld();
  a.energyPoints = 1;
  assert.equal(a.tryMove("skill2"), true);
  const startX = a.x;
  let burst = false;
  for (let i = 0; i < 70; i++) {
    a.step({}, b, dt);
    const events = world.step([a, b], dt);
    if (events.length) burst = true;
  }
  assert.ok(a.x > startX, "jump hammer travels forward");
  assert.equal(burst, true, "impact happens after the landing sequence");
});
test('new skill atlas follows physical landing and keeps blue burst grounded', () => {
  const a = new Fighter(roster[1], 300, 1),
    b = new Fighter(roster[0], 470, -1), world = new CombatWorld();
  a.energyPoints = 1;
  a.tryMove('skill2');
  a.state = 'skill2';
  let landed = false;
  for (let i = 0; i < 80; i++) {
    a.step({}, b, dt);
    const events = world.step([a, b], dt);
    if (a.attack && !a.ground) {
      assert.equal(a.attack.spawned, false);
      assert.notDeepEqual(sampleAnimation(a).a.rect, a.def.sprites.skill2.clip[4].rect);
    }
    if (events.length) {
      assert.equal(a.ground, true);
      assert.deepEqual(sampleAnimation(a).a.rect, a.def.sprites.skill2.clip[4].rect);
      assert.ok(b.knockdownTimer > 0);
      landed = true;
    }
  }
  assert.ok(landed);
  b.reset(470, -1);
  b.energyPoints = 1;
  b.tryMove('skill2');
  for (let i = 0; i < 20; i++) {
    b.step({}, a, dt);
    assert.equal(b.ground, true);
  }
});
test('knockdown atlas progresses from recoil to lying down before getting up', () => {
  const f = new Fighter(roster[0], 400, 1);
  f.state = 'knockdown';
  const sprite = f.def.sprites.knockdown;
  f.knockdownDuration = 0.52;
  for (const [remaining, index] of [[0.52, 0], [0.14, 4], [0.02, 5]]) {
    f.knockdownTimer = remaining;
    assert.deepEqual(sampleAnimation(f).a.rect, sprite.clip[index].rect);
    assert.equal(f.tryMove('punch'), false);
    assert.equal(f.tryDodge({}), false);
  }
});
test("simultaneous normal attacks resolve as one first hit, not a trade", () => {
  const a = new Fighter(roster[0], 400, 1),
    b = new Fighter(roster[1], 475, -1),
    world = new CombatWorld();
  a.tryMove("punch");
  b.tryMove("punch");
  a.attack.frame = a.attack.move.startup;
  b.attack.frame = b.attack.move.startup;
  const events = world.step([a, b], dt);
  assert.equal(events.length, 1);
  assert.equal(a.hp, 100);
  assert.ok(b.hp < 100);
  assert.equal(b.attack, null);
});
test("walk animation uses distinct foot frames and attacks switch from charge to release", () => {
  const a = new Fighter(roster[0], 400, 1);
  a.state = "walk";
  a.vx = 245;
  const poses = new Set();
  for (const distance of [0, 27, 54, 80]) {
    a.walkDistance = distance;
    poses.add(JSON.stringify(sampleAnimation(a).a.rect));
  }
  assert.equal(poses.size, 4);
  a.energyPoints = 1;
  a.tryMove("skill2");
  a.state = "skill2";
  a.attack.frame = 1;
  const charge = sampleAnimation(a).a.rect;
  a.attack.frame = a.attack.move.startup;
  assert.notDeepEqual(sampleAnimation(a).a.rect, charge);
});

test("animation rendering draws exactly one opaque pose, including state changes", () => {
  const f = new Fighter(roster[0], 400, 1),
    images = new Map();
  for (const sprite of Object.values(f.def.sprites))
    for (const pose of [sprite, ...(sprite.clip || [])])
      images.set(pose.src || sprite.src, {
        complete: true,
        naturalWidth: 1254,
      });
  let draws = 0;
  const ctx = {
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    drawImage() {
      draws++;
    },
  };
  for (const state of ["idle", "walk", "punch", "specialPunch", "hurt"]) {
    f.state = state;
    f.animTime = 0.13;
    f.walkDistance = 37;
    const before = draws;
    assert.equal(drawAnimatedFighter(ctx, f, images), true);
    assert.equal(draws - before, 1);
    assert.equal(sampleAnimation(f).blend, 0);
  }
});
