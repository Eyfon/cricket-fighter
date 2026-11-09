import { FLOOR, WIDTH, intersects, applyDamage, resolveHit } from "./combat.js";
import { newBattleSeed, seededRandom } from "./battle-frame.js";
export class CombatWorld {
  constructor(seed = newBattleSeed()) {
    this.projectiles = [];
    this.grabs = [];
    this.setSeed(seed);
  }
  setSeed(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
      throw new RangeError("Battle seed must be an unsigned 32-bit integer");
    this.seed = seed;
    this.tieRandom = seededRandom(seed);
    // Separate player streams keep AI draws from consuming collision tie rolls.
    this.aiRandom = [seededRandom(seed ^ 0x9e3779b9), seededRandom(seed ^ 0x243f6a88)];
  }
  reset() {
    for (const g of this.grabs) this.release(g, false);
    this.projectiles = [];
    this.grabs = [];
  }
  release(g, toss) {
    g.owner.grabbing = null;
    g.owner.attack = null;
    g.target.capturedBy = null;
    g.target.y = FLOOR;
    g.target.ground = true;
    g.target.vy = toss ? -260 : 0;
    g.target.vx = toss ? g.owner.facing * 520 : 0;
    g.target.stun = toss ? 0.16 : 0.1;
    if (toss && g.target.hp > 0) {
      g.target.escapeTimer = Math.max(g.target.escapeTimer, 0.34);
      g.target.controlTime = g.target.pressureHits = 0;
    }
    g.target.visualRotation = 0;
    g.target.state = g.target.hp <= 0 ? "ko" : "hurt";
  }
  acquire(owner, target) {
    const a = owner.attack;
    if (
      !a ||
      !owner.active() ||
      target.resistsHit(a.key, a.move) ||
      target.capturedBy ||
      target.grabbing ||
      !target.ground ||
      target.dodgeTimer > 0.06 ||
      target.escapeTimer > 0 ||
      !intersects(owner.hitbox(), target.hurtbox())
    )
      return false;
    const grab = {
      owner,
      target,
      move: a.move,
      key: a.key,
      time: 0,
      nextHit: 0,
    };
    owner.grabbing = grab;
    target.capturedBy = owner;
    target.attack = null;
    target.guard = false;
    target.stun = 0;
    a.hit = true;
    this.grabs.push(grab);
    return true;
  }
  step(fighters, dt) {
    const events = [];
    for (const f of fighters) {
      const a = f.attack;
      if (
        a?.move.effect === "projectile" &&
        !a.spawned &&
        a.frame >= a.move.startup &&
        !f.capturedBy
      ) {
        a.spawned = true;
        const p = a.move.projectile;
        const lockedTarget = p.targeted ? fighters.find((other) => other !== f && other.hp > 0) : null;
        const lockedX = lockedTarget?.x ?? f.x + f.facing * (p.offsetX ?? 64);
        const lockedY = lockedTarget?.y ?? f.y;
        if (lockedTarget) {
          f.targetLock = { x: lockedX, y: lockedY, age: 0, duration: (p.lockDelay ?? 0.65) + 0.42 };
        }
        for (const [shotIndex, shot] of (p.shots || [{ delay: 0, damage: a.move.damage }]).entries())
          this.projectiles.push({
            owner: f,
            move: a.move,
            key: a.key,
            x: p.targeted
              ? lockedX
              : p.rain
              ? 80 + (shotIndex + 1) * ((WIDTH - 160) / ((p.shots || []).length + 1))
              : p.whale
              ? p.edgeSpawn
                ? f.facing === 1 ? -p.radius * 0.8 : WIDTH + p.radius * 0.8
                : f.x + f.facing * (p.offsetX ?? -180)
              : f.x + f.facing * (p.offsetX ?? 64),
            y: p.targeted
              ? lockedY - 300
              : p.rain ? -80 - shotIndex * 28 : f.y + (p.offsetY ?? (p.whale ? -90 : -95)),
            direction: f.facing,
            radius: p.radius,
            speed: p.targeted || p.rain ? 0 : p.speed * Math.cos(shot.angle ?? 0),
            verticalSpeed: p.targeted || p.rain ? p.speed : p.speed * Math.sin(shot.angle ?? 0),
            life: p.life,
            power: p.power || 1,
            age: 0,
            delay: p.targeted ? (p.lockDelay ?? 0.65) + shot.delay : shot.delay,
            damage: shot.damage,
            rain: !!p.rain,
            targeted: !!p.targeted,
            whale: !!p.whale,
            edgeSpawn: !!p.edgeSpawn,
            waterBurst: !!p.waterBurst,
          });
      }
      if (
        a?.move.effect === "burst" &&
        a.frame >= a.move.startup + (a.move.burstAt === "active" ? a.move.active : 0) &&
        (a.move.burstAt !== "active" || a.landed) &&
        !f.capturedBy
      ) {
        if (!a.spawned) a.spawned = true;
        if (a.impactFrame == null)
          a.impactFrame = a.move.hits ? a.move.startup + a.move.active : a.frame;
        f.vx = 0;
        const burstX = f.x + f.facing * (a.move.burstOffsetX ?? 0);
        if (!a.move.hits || !a.hitIndices.size)
          f.burstVisual = { age: 0, x: burstX, y: f.y, range: a.move.burstRange, ground: !!a.move.riseVelocity, soundwave: !!a.move.soundwave, waterWave: !!a.move.waterWave };
        const elapsed = a.frame - a.move.startup;
        const hit = a.move.hits?.find((entry, index) => elapsed >= entry.at && !a.hitIndices.has(index));
        if (hit) {
          const hitIndex = a.move.hits.indexOf(hit);
          a.hitIndices.add(hitIndex);
          const target = fighters.find((other) => other !== f);
          if (target && Math.abs(target.x - burstX) <= (a.move.burstRange ?? a.move.range)) {
            const event = applyDamage(f, target, a.move, {
              key: a.key,
              direction: target.x >= burstX ? 1 : -1,
              damage: hit.damage,
              final: hitIndex === a.move.hits.length - 1,
              source: 'burst',
            });
            if (event) events.push(event);
          }
        } else if (!a.move.hits && !a.burstHit) {
          a.burstHit = true;
          const target = fighters.find((other) => other !== f);
          if (target && Math.abs(target.x - burstX) <= (a.move.burstRange ?? a.move.range)) {
            const event = applyDamage(f, target, a.move, {
              key: a.key,
              direction: target.x >= burstX ? 1 : -1,
              damage: a.move.damage,
              source: 'burst',
            });
            if (event) events.push(event);
          }
        }
      }
      if (a?.move.effect === "global" && !a.spawned && a.frame >= a.move.startup && !f.capturedBy) {
        a.spawned = true;
        const target = fighters.find((other) => other !== f);
        if (target) {
          const event = applyDamage(f, target, a.move, {
            key: a.key,
            direction: target.x >= f.x ? 1 : -1,
            damage: a.move.damage,
            source: 'global',
          });
          if (event) {
            if (a.move.waterPillar) {
              f.burstVisual = {
                age: 0,
                duration: 0.55,
                x: target.x,
                y: target.y,
                range: 92,
                waterPillar: true,
              };
            }
            events.push(event);
          }
        }
      }
    }
    // Sample both contacts before applying damage. Earlier active attacks win;
    // exact ties use one seeded 50/50 roll, never the player's array position.
    // An interrupted reciprocal attack is still discarded to prevent normal trades.
    const contacts = fighters.map((f, i) =>
      f.active() &&
      !f.capturedBy &&
      !f.grabbing &&
      fighters[1 - i].hp > 0 &&
      fighters[1 - i].stun <= 0 &&
      fighters[1 - i].dodgeTimer <= 0.06 &&
      intersects(f.hitbox(), fighters[1 - i].hurtbox())
        ? {
            f,
            target: fighters[1 - i],
            attack: f.attack,
            targetAttack: fighters[1 - i].attack,
          }
        : null,
    )
      .filter(Boolean)
      .sort((a, b) => {
        const progress = (c) => c.attack.frame - c.attack.move.startup;
        return progress(b) - progress(a);
      });
    if (contacts.length === 2) {
      const [a, b] = contacts;
      const progress = (c) => c.attack.frame - c.attack.move.startup;
      if (progress(a) === progress(b) && this.tieRandom() < 0.5)
        contacts.reverse();
    }
    for (const c of contacts) {
      if (
        c.f.capturedBy ||
        c.target.capturedBy ||
        c.f.attack !== c.attack ||
        c.target.hp <= 0 ||
        c.target.stun > 0 ||
        c.target.attack !== c.targetAttack
      )
        continue;
      if (c.attack.move.effect === "grab") {
        this.acquire(c.f, c.target);
        continue;
      }
      const saved = c.f.attack;
      c.f.attack = c.attack;
      const event = resolveHit(c.f, c.target);
      if (saved !== c.attack) c.f.attack = saved;
      if (event) events.push(event);
    }
    for (const p of this.projectiles) {
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      const oldX = p.x, oldY = p.y;
      p.x += p.direction * p.speed * dt;
      p.y += (p.verticalSpeed ?? 0) * dt;
      p.life -= dt;
      p.age += dt;
      const target = fighters.find((f) => f !== p.owner);
      if (p.targeted && p.y >= FLOOR) {
        p.y = FLOOR;
        p.owner.eggImpact = { age: 0, x: p.x, y: FLOOR, range: 135 };
        p.owner.burstVisual = { age: 0, x: p.x, y: FLOOR, range: 135, ground: true };
        p.life = 0;
        continue;
      }
      const box = {
        x: Math.min(oldX, p.x) - p.radius,
        y: Math.min(oldY, p.y) - p.radius,
        w: Math.abs(p.x - oldX) + p.radius * 2,
        h: Math.abs(p.y - oldY) + p.radius * 2,
      };
      if (
        p.life > 0 &&
        !target.capturedBy &&
        target.dodgeTimer <= 0.06 &&
        intersects(box, target.hurtbox())
      ) {
        const event = applyDamage(p.owner, target, p.move, {
          key: p.key,
          direction: p.direction,
          damage: p.damage,
          source: 'projectile',
        });
        if (event) {
          events.push(event);
          if (p.targeted) {
            target.eggImpact = { age: 0, x: target.x, y: target.y, range: 110 };
            target.burstVisual = { age: 0, x: target.x, y: target.y, range: 110, ground: true };
          }
          p.life = 0;
        }
      }
      if (p.x < -100 || p.x > WIDTH + 100) p.life = 0;
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
    this.grabs = this.grabs.filter((g) => {
      if (g.owner.hp <= 0 || g.owner.stun > 0 || g.owner.capturedBy) {
        this.release(g, false);
        return false;
      }
      g.time += dt;
      const config = g.move.grab;
      g.target.x = Math.max(
        38,
        Math.min(
          WIDTH - 38,
          g.owner.x + g.owner.facing * (78 + Math.sin(g.time * 12) * 8),
        ),
      );
      g.target.y = FLOOR - 22 - Math.abs(Math.sin(g.time * 10)) * 20;
      g.target.visualRotation = Math.sin(g.time * 16) * 0.3;
      while (
        g.nextHit < config.hits.length &&
        g.time >= config.hits[g.nextHit].at
      ) {
        const hit = config.hits[g.nextHit],
          final = g.nextHit === config.hits.length - 1;
        const event = applyDamage(g.owner, g.target, g.move, {
          key: g.key,
          damage: hit.damage,
          unblockable: true,
          final,
          source: 'grab',
        });
        if (event) events.push({ ...event, grab: true });
        g.nextHit++;
      }
      if (g.time >= config.duration || g.target.hp <= 0) {
        this.release(g, true);
        return false;
      }
      return true;
    });
    return events;
  }
}
