import { decideCpuInput } from './ai.js';
export const DEFAULT_CHIP_RATIO = 0.25;
export const KNOCKDOWN_DURATION = 0.72;
const ATTACK_KEYS = [
  "super",
  "skill",
  "skill2",
  "forwardPunch",
  "forwardKick",
  "specialPunch",
  "specialKick",
  "kick",
  "punch",
];
export const MAX_HEALTH = 100,
  MAX_ENERGY_POINTS = 3,
  ENERGY_PER_POINT = 100;
export const FLOOR = 438,
  WIDTH = 960;
export const intersects = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export class Fighter {
  constructor(def, x, facing, healthMultiplier = 1) {
    this.healthMultiplier = [1, 2, 3, 5].includes(healthMultiplier)
      ? healthMultiplier
      : 1;
    this.def = def;
    this.wins = 0;
    this.reset(x, facing);
  }
  reset(x, facing) {
    Object.assign(this, {
      x,
      y: FLOOR,
      vx: 0,
      vy: 0,
      facing,
      hp: MAX_HEALTH * this.healthMultiplier,
      maxHp: MAX_HEALTH * this.healthMultiplier,
      energyPoints: 0,
      meter: 0,
      attack: null,
      bufferedAction: null,
      blockStun: false,
      walkDistance: 0,
      capturedBy: null,
      grabbing: null,
      visual: null,
      cooldowns: {},
      dodgeTimer: 0,
      dodgeDirection: 0,
      dodgeCooldown: 0,
      stun: 0,
      knockdownTimer: 0,
      knockdownDuration: KNOCKDOWN_DURATION,
      burstVisual: null,
      sweepImmunity: 0,
      pushVx: 0,
      pressureHits: 0,
      controlTime: 0,
      pressureGap: 0,
      escapeTimer: 0,
      guard: false,
      crouchGuard: false,
      ground: true,
      combo: 0,
      comboTime: 0,
      aiTime: 0,
      aiInput: {},
      aiBrain: null,
      aiProjectiles: [],
      projectileThreat: false,
      targetLock: null,
      eggImpact: null,
      state: "idle",
      animTime: 0,
    });
  }
  gainEnergy(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (this.energyPoints >= MAX_ENERGY_POINTS) {
      this.meter = 0;
      return;
    }
    const charge = this.meter + amount;
    const earned = Math.floor(charge / ENERGY_PER_POINT);
    this.energyPoints = Math.min(MAX_ENERGY_POINTS, this.energyPoints + earned);
    this.meter =
      this.energyPoints >= MAX_ENERGY_POINTS ? 0 : charge % ENERGY_PER_POINT;
  }
  hurtbox() {
    const height = this.guard && this.crouchGuard && this.ground
      ? this.def.height * 0.8 : this.def.height;
    return {
      x: this.x - this.def.width / 2,
      y: this.y - height,
      w: this.def.width,
      h: height,
    };
  }
  hitbox() {
    if (!this.attack) return null;
    const b = this.attack.move.box;
    return {
      x: this.x + (this.facing === 1 ? b.x : -b.x - b.w),
      y: this.y + b.y,
      w: b.w,
      h: b.h,
    };
  }
  canUseMove(key) {
    const move = this.def.moves[key];
    if (
      !move ||
      this.hp <= 0 ||
      this.stun > 0 ||
      this.knockdownTimer > 0 ||
      this.guard ||
      this.capturedBy ||
      this.grabbing ||
      (move.groundOnly && !this.ground) ||
      this.dodgeTimer > 0 ||
      (this.cooldowns[key] || 0) > 0
    )
      return false;
    if (
      this.attack &&
      !(
        this.attack.hit &&
        !this.attack.blocked &&
        this.attack.move.cancel?.includes(key) &&
        this.attack.frame <
          this.attack.move.startup + this.attack.move.active + 9
      )
    )
      return false;
    if (this.energyPoints < (move.cost || 0)) return false;
    return true;
  }
  tryMove(key) {
    if (!this.canUseMove(key)) return false;
    const move = this.def.moves[key];
    this.energyPoints -= move.cost || 0;
    if (move.cooldown) this.cooldowns[key] = move.cooldown;
    this.attack = {
      key,
      move,
      frame: 0,
      hit: false,
      hitIndices: new Set(),
      spawned: false,
      armorHits: 0,
    };
    this.vx = 0;
    this.animTime = 0;
    return true;
  }
  hasSuperArmor() {
    const a = this.attack;
    return !!(
      a &&
      a.key === "super" &&
      this.hp > 0 &&
      !this.capturedBy
    );
  }
  isInvulnerable() {
    return !!(
      this.attack &&
      this.hp > 0 &&
      Number.isInteger(this.attack.move.invulnerableFrames) &&
      this.attack.frame <= this.attack.move.invulnerableFrames
    );
  }
  resistsHit(key, move, final = true) {
    if (!this.attack || this.hp <= 0 || this.capturedBy) return false;
    if (this.attack.key === 'super')
      return !['skill', 'skill2', 'super'].includes(key);
    if (!['skill', 'skill2'].includes(this.attack.key)) return false;
    const protectedSweep = key === 'specialKick' && move.low && this.sweepImmunity > 0;
    const knocksDown = move.knockdown && !protectedSweep;
    // A launch-capable move is an offensive control move from its first
    // pulse. Requiring `final` here made multi-hit skills (奶娃's laugh wave
    // in particular) deal damage while leaving an opponent's skill running
    // until the last pulse, which often arrived after that skill had ended.
    return !(knocksDown || (move.launch ?? 0) > 0);
  }
  tryDodge(input) {
    if (
      !this.ground ||
      this.hp <= 0 ||
      this.stun > 0 ||
      this.knockdownTimer > 0 ||
      this.attack ||
      this.capturedBy ||
      this.grabbing ||
      this.dodgeTimer > 0 ||
      this.dodgeCooldown > 0
    )
      return false;
    this.dodgeDirection =
      input.left !== input.right ? (input.right ? 1 : -1) : 0;
    this.dodgeTimer = 0.28;
    this.dodgeCooldown = 0.8;
    this.guard = false;
    this.animTime = 0;
    return true;
  }
  step(input, other, dt) {
    const oldState = this.state;
    this.animTime += dt;
    if (this.burstVisual) {
      this.burstVisual.age += dt;
      if (this.burstVisual.age >= (this.burstVisual.duration ?? 0.4)) this.burstVisual = null;
    }
    if (this.eggImpact) {
      this.eggImpact.age += dt;
      if (this.eggImpact.age >= 0.45) this.eggImpact = null;
    }
    if (this.targetLock) {
      this.targetLock.age += dt;
      if (this.targetLock.age >= this.targetLock.duration) this.targetLock = null;
    }
    this.escapeTimer = Math.max(0, this.escapeTimer - dt);
    this.sweepImmunity = Math.max(0, this.sweepImmunity - dt);
    if (this.stun > 0 || this.capturedBy) {
      this.controlTime += dt;
      this.pressureGap = 0;
    } else {
      this.pressureGap += dt;
      if (this.pressureGap >= 0.18) {
        this.controlTime = 0;
        this.pressureHits = 0;
      }
    }
    if (this.bufferedAction) {
      this.bufferedAction.remaining -= dt;
      if (this.bufferedAction.remaining <= 0) this.bufferedAction = null;
    }
    if (!this.attack && this.hp > 0 && this.stun <= 0)
      this.facing = other.x >= this.x ? 1 : -1;
    const forward = this.facing === 1 ? input.right : input.left;
    const back = this.facing === 1 ? input.left : input.right;
    if (forward && !input.down && this.ground) {
      if (input.punch) input = { ...input, punch: false, forwardPunch: true };
      if (input.kick) input = { ...input, kick: false, forwardKick: true };
    }
    const requested = ATTACK_KEYS.find((key) => input[key]);
    // Hit/block stun cannot bank a skill for automatic release on recovery.
    // The normal attack-recovery input buffer remains available.
    if (this.stun > 0 || this.knockdownTimer > 0 || this.capturedBy)
      this.bufferedAction = null;
    else if (requested) this.bufferedAction = { key: requested, remaining: 0.1 };
    this.comboTime = Math.max(0, this.comboTime - dt);
    if (!this.comboTime) this.combo = 0;
    this.stun = Math.max(0, this.stun - dt);
    if (this.ground) this.knockdownTimer = Math.max(0, this.knockdownTimer - dt);
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    for (const key of Object.keys(this.cooldowns))
      this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
    if (this.stun <= 0) this.blockStun = false;
    const comboIntent = !!this.bufferedAction;
    // Back alone retreats. Down guards; adding back turns it into crouch guard.
    // An AI or training input may still provide the explicit guard flag.
    const guardIntent = !!input.guard || !!input.down;
    this.crouchGuard = !!input.down && !!back && !forward;
    this.guard =
      guardIntent &&
      this.ground &&
      !this.attack &&
      !this.dodgeTimer &&
      this.knockdownTimer <= 0 &&
      !this.capturedBy && !this.grabbing && this.hp > 0 &&
      !comboIntent &&
      (this.stun <= 0 || this.blockStun);
    if (this.capturedBy) {
      this.state = this.hp <= 0 ? "ko" : "hurt";
      this.vx = this.vy = 0;
      return;
    }
    if (this.grabbing) {
      this.state = this.grabbing.key;
      this.vx = this.vy = 0;
      return;
    }
    if (this.hp > 0 && this.stun <= 0 && this.knockdownTimer <= 0 && this.dodgeTimer <= 0) {
      if (!this.attack) this.facing = other.x >= this.x ? 1 : -1;
      this.guard = guardIntent && this.ground && !this.attack && !comboIntent;
      if (input.dodge) this.tryDodge(input);
      if (!this.attack && this.dodgeTimer <= 0) {
        this.vx = this.guard
          ? 0
          : ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * this.def.speed;
      }
      // Resolve action intents after the input layer gives down+attack priority over guard.
      if (this.bufferedAction && this.tryMove(this.bufferedAction.key))
        this.bufferedAction = null;
      if (
        input.jump &&
        !this.attack &&
        this.dodgeTimer <= 0 &&
        this.ground &&
        !this.guard
      ) {
        this.vy = -this.def.jump;
        this.ground = false;
      }
    } else this.vx *= 0.92;
    if (this.dodgeTimer > 0) this.vx = this.dodgeDirection * 520;
    if (this.attack) {
      const a = this.attack;
      a.frame++;
      if (
        a.frame === a.move.startup &&
        (a.move.effect === 'rise' || (a.move.effect === 'projectile' && a.move.riseVelocity) || (a.move.effect === 'burst' && a.move.riseVelocity)) &&
        this.ground
      ) {
        this.vy = a.move.riseVelocity ?? -410;
        this.ground = false;
        a.airborne = true;
      }
      const movingAttack =
        ["dash", "rush", "grab"].includes(a.move.effect) &&
        a.frame >= a.move.startup &&
        a.frame < a.move.startup + a.move.active;
      // Aerial normals keep the player's held horizontal direction, so a
      // jump-in can travel forward and attack instead of freezing in place.
      const airNormal =
        !this.ground && ["punch", "kick"].includes(a.key) && !movingAttack;
      const forwardBurst =
        a.move.effect === "burst" &&
        a.move.forwardSpeed &&
        a.frame >= a.move.startup &&
        !a.spawned && !a.landed;
      this.vx = movingAttack
        ? this.facing * (a.move.dashSpeed ?? 480)
        : forwardBurst
          ? this.facing * a.move.forwardSpeed
          : airNormal
          ? ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * this.def.speed * 0.7
          : 0;
      const waitingForLanding =
        a.move.effect === "burst" &&
        a.move.burstAt === "active" &&
        (!this.ground || (!a.spawned && a.frame - (a.landingFrame ?? a.move.startup + a.move.active) < 3));
      if (
        a.frame >= (a.impactFrame ?? a.move.startup + a.move.active) + a.move.recovery &&
        !waitingForLanding
      )
        this.attack = null;
    }
    this.vy += 1650 * dt;
    if (this.ground && !this.attack && !this.dodgeTimer)
      this.walkDistance += Math.abs(this.vx) * dt;
    this.x = Math.max(
      38,
      Math.min(WIDTH - 38, this.x + (this.vx + this.pushVx) * dt),
    );
    this.pushVx *= Math.exp(-12 * dt);
    this.y += this.vy * dt;
    if (this.y >= FLOOR) {
      this.y = FLOOR;
      this.vy = 0;
      this.ground = true;
      if (this.attack?.airborne && !this.attack.landed) {
        this.attack.landed = true;
        this.attack.landingFrame = this.attack.frame;
        if (this.attack.move.effect === 'burst') this.vx = 0;
      }
    } else this.ground = false;
    this.state =
      this.hp <= 0
        ? "ko"
        : this.knockdownTimer > 0
          ? this.ground ? "knockdown" : "hurt"
        : this.stun > 0 && !(this.blockStun && this.guard)
          ? "hurt"
          : this.dodgeTimer > 0
            ? "dodge"
            : this.guard
              ? this.crouchGuard ? "crouchGuard" : "guard"
              : this.attack
                ? this.attack.key
                : !this.ground
                  ? "jump"
                  : Math.abs(this.vx) > 10
                    ? "walk"
                    : "idle";
    if (oldState !== this.state) this.animTime = 0;
  }
  hitWindow() {
    const a = this.attack;
    if (!a || ["projectile", "burst"].includes(a.move.effect)) return null;
    const t = a.frame - a.move.startup;
    if (t < 0 || t >= a.move.active) return null;
    if (a.move.hits) {
      for (let i = a.move.hits.length - 1; i >= 0; i--) {
        const hit = a.move.hits[i];
        if (
          t >= hit.at &&
          t < hit.at + (hit.window || 4) &&
          !a.hitIndices.has(i)
        )
          return {
            index: i,
            damage: hit.damage,
            final: i === a.move.hits.length - 1,
          };
      }
      return null;
    }
    return a.hit ? null : { index: 0, damage: a.move.damage, final: true };
  }
  active() {
    return !!this.hitWindow();
  }
}
export function applyDamage(
  attacker,
  defender,
  move,
  {
    damage = move.damage,
    key = "punch",
    direction = attacker.facing,
    unblockable = false,
    final = true,
    source = ['projectile', 'burst', 'grab', 'global'].includes(move.effect) ? move.effect : 'melee',
  } = {},
) {
  if (
    defender.dodgeTimer > 0.06 ||
    defender.isInvulnerable() ||
    defender.escapeTimer > 0 ||
    defender.hp <= 0
  )
    return null;
  const blocked =
    defender.guard &&
    (!move.low || defender.crouchGuard) &&
    !move.unblockable &&
    !unblockable &&
    defender.facing === -direction;
  const finalDamage = blocked
    ? damage * (move.chipRatio ?? DEFAULT_CHIP_RATIO)
    : damage;
  const controlMove = ["skill", "skill2", "super"].includes(key);
  const sweep = key === 'specialKick' && move.low && move.knockdown;
  const knockedDown = move.knockdown && !(sweep && defender.sweepImmunity > 0);
  defender.hp = Math.max(0, defender.hp - finalDamage);
  // Super and one-point skills have distinct interruption rules. Resistance
  // prevents control only: full damage and lethal KOs still apply.
  const armored = !blocked && defender.resistsHit(key, move, final);
  if (armored) defender.attack.armorHits++;
  if (!blocked && !controlMove) defender.pressureHits++;
  if (controlMove) defender.controlTime = 0;
  const scaling = Math.max(
    0.45,
    1 - Math.max(0, defender.pressureHits - 1) * 0.15,
  );
  defender.stun = armored
    ? 0
    : (blocked
        ? 4
        : Math.max(
            5,
            Math.min(["skill", "skill2", "super"].includes(key) ? 30 : 24, move.stun) * scaling,
          )) / 60;
  defender.blockStun = blocked;
  defender.vx = 0;
  defender.pushVx = armored
    ? 0
    : direction * move.knockback * (blocked ? 0.45 : final ? 1 : 0.12);
  const cornered = direction > 0 ? defender.x > WIDTH - 115 : defender.x < 115;
  const closeMelee = source === 'melee' &&
    Math.abs(attacker.x - defender.x) <= 140 &&
    Math.abs(attacker.y - defender.y) <= 100;
  if (cornered && closeMelee && !defender.capturedBy) {
    attacker.pushVx =
      -direction * Math.max(blocked ? 190 : 240, move.knockback * 0.8);
  }
  if (!blocked) {
    if (!armored) {
      defender.vy = final ? -(move.launch ?? 70) : 0;
      if (defender.vy < 0) defender.ground = false;
      if (knockedDown) {
        defender.knockdownDuration = KNOCKDOWN_DURATION;
        defender.knockdownTimer = KNOCKDOWN_DURATION;
        if (sweep) {
          defender.sweepImmunity = 5;
        }
        defender.vy = -(move.launch ?? 0);
        defender.ground = defender.y >= FLOOR && defender.vy === 0;
      }
      defender.attack = null;
      defender.bufferedAction = null;
      defender.dodgeTimer = 0;
      defender.state = defender.hp <= 0 ? "ko" : knockedDown && defender.ground ? "knockdown" : "hurt";
      defender.animTime = 0;
    }
    attacker.combo++;
    attacker.comboTime = 1.2;
  }
  if (defender.hp <= 0) {
    defender.state = "ko";
    defender.attack = null;
    defender.bufferedAction = null;
  }
  const escape =
    !blocked &&
    !armored &&
    defender.hp > 0 &&
    !defender.capturedBy &&
    !controlMove &&
    (defender.pressureHits >= 6 || defender.controlTime >= 0.75);
  if (escape) {
    defender.stun = 0;
    defender.blockStun = false;
    defender.escapeTimer = 0.22;
    defender.pressureHits = defender.controlTime = 0;
    if (closeMelee) attacker.pushVx = -direction * 420;
    defender.pushVx = direction * 180;
    attacker.combo = 0;
  }
  attacker.gainEnergy((move.gain || 0) * (blocked ? 0.4 : 1));
  defender.gainEnergy(blocked ? 3 : 10);
  return {
    blocked,
    armored,
    damage: finalDamage,
    x: defender.x,
    y: defender.y - 90,
    super: key === "super",
    key,
    effect: move.effect,
    escape,
    color: attacker.def.color,
  };
}
export function resolveHit(attacker, defender) {
  const hit = attacker.hitWindow();
  if (
    !hit ||
    attacker.attack.move.effect === "grab" ||
    defender.capturedBy ||
    defender.dodgeTimer > 0.06 ||
    !intersects(attacker.hitbox(), defender.hurtbox())
  )
    return null;
  const a = attacker.attack;
  a.hit = true;
  a.hitIndices.add(hit.index);
  const event = applyDamage(attacker, defender, a.move, {
    damage: hit.damage,
    key: a.key,
    final: hit.final,
  });
  a.blocked = event?.blocked || false;
  return event;
}
export function defenseInput(self, other, crouch = false) {
  const back = other.x >= self.x ? -1 : 1;
  return {guard: true, down: crouch, left: crouch && back === -1, right: crouch && back === 1};
}
export function cpuInput(self, other, dt, difficulty = "normal", random = Math.random) {
  const input = decideCpuInput(self, other, dt, difficulty, random);
  self.aiInput = input;
  return input;
}
