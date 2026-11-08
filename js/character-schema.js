export const MOVE_SLOTS = [
  "punch",
  "kick",
  "forwardPunch",
  "forwardKick",
  "specialPunch",
  "specialKick",
  "skill",
  "skill2",
  "super",
];
export const SPRITE_STATES = [
  "idle",
  "walk",
  "jump",
  "guard",
  "crouchGuard",
  "hurt",
  "ko",
  "knockdown",
  "dodge",
  ...MOVE_SLOTS,
];
export const AI_ROLES = [
  "poke",
  "antiAir",
  "approach",
  "finisher",
  "ranged",
  "grapple",
];

// Shared by runtime and tests: new characters fail early with actionable errors.
export function validateCharacter(character) {
  const errors = [];
  const positive = (value) => Number.isFinite(value) && value > 0;
  if (!character || typeof character !== "object") return ["角色必须是对象"];
  for (const key of [
    "id",
    "name",
    "subtitle",
    "description",
    "color",
    "accent",
  ])
    if (typeof character[key] !== "string" || !character[key].trim())
      errors.push(`${key} 必须是非空字符串`);
  for (const key of ["speed", "jump", "width", "height"])
    if (!positive(character[key])) errors.push(`${key} 必须是正数`);
  if (!positive(character.ai?.preferredRange))
    errors.push("ai.preferredRange 必须是正数");
  for (const slot of MOVE_SLOTS) {
    const move = character.moves?.[slot];
    if (!move) {
      errors.push(`缺少 moves.${slot}`);
      continue;
    }
    const prefix = `moves.${slot}`;
    for (const key of ["name", "description"])
      if (typeof move[key] !== "string" || !move[key].trim())
        errors.push(`${prefix}.${key} 必须是非空字符串`);
    for (const key of ["startup", "active", "recovery", "stun"])
      if (!Number.isInteger(move[key]) || move[key] <= 0)
        errors.push(`${prefix}.${key} 必须是正整数帧`);
    for (const key of ["damage", "range", "knockback"])
      if (!positive(move[key])) errors.push(`${prefix}.${key} 必须是正数`);
    const maxStun =
      slot === "punch" ? 12 : slot === "kick" ? 16 : ["skill", "skill2", "super"].includes(slot) ? 30 : 24;
    if (move.stun > maxStun)
      errors.push(`${prefix}.stun 不得超过 ${maxStun} 帧，避免无限压制`);
    for (const key of ["cost", "gain"])
      if (!Number.isFinite(move[key]) || move[key] < 0)
        errors.push(`${prefix}.${key} 必须是非负数`);
    if (move.cost !== (slot === "super" ? 3 : ["skill", "skill2"].includes(slot) ? 1 : 0))
      errors.push(
        `${prefix}.cost 必须为 ${slot === "super" ? 3 : ["skill", "skill2"].includes(slot) ? 1 : 0}`,
      );
    if ((move.cooldown || 0) !== 0)
      errors.push(`${prefix}.cooldown 不允许时间冷却`);
    if (
      move.chipRatio !== undefined &&
      (!Number.isFinite(move.chipRatio) ||
        move.chipRatio <= 0 ||
        move.chipRatio >= 1)
    )
      errors.push(`${prefix}.chipRatio 必须大于 0 且小于 1`);
    if (typeof move.groundOnly !== "boolean")
      errors.push(`${prefix}.groundOnly 必须显式填写`);
    if (
      !move.box ||
      !Number.isFinite(move.box.x) ||
      !Number.isFinite(move.box.y) ||
      !positive(move.box.w) ||
      !positive(move.box.h)
    )
      errors.push(`${prefix}.box 必须包含有限坐标和正数宽高`);
    if (
      move.effect &&
      !["rise", "dash", "projectile", "burst", "rush", "grab", "global"].includes(move.effect)
    )
      errors.push(
        `${prefix}.effect 仅支持 rise / dash / projectile / burst / rush / grab / global`,
      );
    if (move.invulnerableFrames !== undefined &&
      (!Number.isInteger(move.invulnerableFrames) || move.invulnerableFrames < 0))
      errors.push(`${prefix}.invulnerableFrames 必须为非负整数帧`);
    if (
      move.dashSpeed !== undefined &&
      (!positive(move.dashSpeed) ||
        !["dash", "rush", "grab"].includes(move.effect))
    )
      errors.push(
        `${prefix}.dashSpeed 仅适用于 dash / rush / grab 且必须为正数`,
      );
    if (
      move.riseVelocity !== undefined &&
      (!Number.isFinite(move.riseVelocity) ||
        move.riseVelocity >= 0 ||
        !["rise", "burst", "projectile"].includes(move.effect))
    )
      errors.push(`${prefix}.riseVelocity 仅适用于 rise / burst / projectile 且必须为负数`);
    if (
      move.launch !== undefined &&
      (!Number.isFinite(move.launch) || move.launch < 0)
    )
      errors.push(`${prefix}.launch 必须非负`);
    if (move.effect === "projectile") {
      const p = move.projectile;
      if (
        !p ||
        !["speed", "radius", "life"].every((key) => positive(p[key])) ||
        !Number.isInteger(p.power) ||
        p.power < 1
      )
        errors.push(
          `${prefix}.projectile 需要正数 speed/radius/life 和正整数 power`,
        );
      if (
        p?.shots &&
        (!Array.isArray(p.shots) ||
          !p.shots.length ||
          p.shots.some(
            (shot) =>
              !Number.isFinite(shot.delay) ||
              shot.delay < 0 ||
              (shot.angle !== undefined && (!Number.isFinite(shot.angle) || Math.abs(shot.angle) > Math.PI / 2)) ||
              !positive(shot.damage),
          ) ||
          p.shots.reduce((sum, shot) => sum + shot.damage, 0) !== move.damage)
      )
        errors.push(
          `${prefix}.projectile.shots 伤害总和必须等于 damage 且延迟非负`,
        );
    }
    if (move.hits) {
      if (
        !Array.isArray(move.hits) ||
        !move.hits.length ||
        move.hits.some(
          (hit, i) =>
            !Number.isInteger(hit.at) ||
            hit.at < 0 ||
            hit.at >= move.active ||
            !positive(hit.damage) ||
            (i > 0 && hit.at <= move.hits[i - 1].at),
        ) ||
        move.hits.reduce((sum, hit) => sum + hit.damage, 0) !== move.damage
      )
        errors.push(`${prefix}.hits 需要递增有效帧和正确的总伤害`);
    }
    if (move.effect === "grab") {
      const g = move.grab;
      if (
        !g ||
        !positive(g.duration) ||
        !Array.isArray(g.hits) ||
        !g.hits.length ||
        g.hits.some(
          (hit, i) =>
            !Number.isFinite(hit.at) ||
            hit.at < 0 ||
            hit.at >= g.duration ||
            !positive(hit.damage) ||
            (i > 0 && hit.at <= g.hits[i - 1].at),
        ) ||
        g.hits.reduce((sum, hit) => sum + hit.damage, 0) !== move.damage
      )
        errors.push(`${prefix}.grab 需要有效 duration、递增 hits 与正确总伤害`);
    }
    if (move.unblockable && slot !== "super" && !(character.id === "naiwa" && ["skill", "skill2"].includes(slot)))
      errors.push(`${prefix} 仅大招允许破防`);
    if (!AI_ROLES.includes(move.ai?.role) || !positive(move.ai?.weight))
      errors.push(`${prefix}.ai 需要有效 role 和正数 weight`);
    if (
      move.cancel &&
      (!Array.isArray(move.cancel) ||
        move.cancel.some(
          (target) => !MOVE_SLOTS.includes(target) || target === slot,
        ))
    )
      errors.push(`${prefix}.cancel 引用了无效槽位或自身`);
  }
  for (const state of SPRITE_STATES) {
    const sprite = character.sprites?.[state];
    if (!sprite?.src) {
      errors.push(`缺少 sprites.${state}`);
      continue;
    }
    if (
      state === "walk" &&
      !(sprite.clip?.length >= 4) &&
      !(sprite.frames >= 4)
    )
      errors.push("sprites.walk 至少需要四个迈步帧");
    if (sprite.clip) {
      if (
        MOVE_SLOTS.includes(state) &&
        !["startup", "active", "recovery"].every(
          (phase) =>
            Array.isArray(sprite.phases?.[phase]) &&
            sprite.phases[phase].length,
        )
      )
        errors.push(`sprites.${state}.phases 必须包含三个攻击阶段`);

      const validRect = (rect) =>
        Array.isArray(rect) &&
        rect.length === 4 &&
        rect.every(Number.isFinite) &&
        rect[0] >= 0 &&
        rect[1] >= 0 &&
        rect[2] > 0 &&
        rect[3] > 0;
      if (
        !Array.isArray(sprite.clip) ||
        !sprite.clip.length ||
        !positive(sprite.fps) ||
        sprite.clip.some(
          (frame) =>
            !validRect(frame.rect) ||
            !positive(frame.scale) ||
            !Number.isFinite(frame.anchorX) ||
            frame.anchorX < 0 ||
            frame.anchorX > 1 ||
            (frame.originY !== undefined && (!Number.isFinite(frame.originY) || frame.originY <= 0 || frame.originY > frame.rect[3])),
        )
      )
        errors.push(`sprites.${state}.clip 参数无效`);
      for (const indices of [
        ...Object.values(sprite.phases || {}),
        ...(sprite.grabFrames ? [sprite.grabFrames] : []),
      ])
        if (
          !Array.isArray(indices) ||
          !indices.length ||
          indices.some(
            (i) => !Number.isInteger(i) || i < 0 || i >= sprite.clip.length,
          )
        )
          errors.push(`sprites.${state} 动画阶段引用无效`);
      if (sprite.grabTimeline && (!Array.isArray(sprite.grabTimeline) || !sprite.grabTimeline.length ||
        sprite.grabTimeline.some((key,i)=>!Number.isFinite(key.at) || key.at < 0 ||
          !Number.isInteger(key.frame) || key.frame < 0 || key.frame >= sprite.clip.length ||
          (i > 0 && key.at <= sprite.grabTimeline[i-1].at))))
        errors.push(`sprites.${state}.grabTimeline 必须按时间递增且引用有效帧`);
      continue;
    }
    if (sprite.rect) {
      if (
        !Array.isArray(sprite.rect) ||
        sprite.rect.length !== 4 ||
        sprite.rect.some((v) => !Number.isFinite(v)) ||
        sprite.rect[0] < 0 ||
        sprite.rect[1] < 0 ||
        sprite.rect[2] <= 0 ||
        sprite.rect[3] <= 0 ||
        !positive(sprite.scale) ||
        !Number.isFinite(sprite.anchorX) ||
        sprite.anchorX < 0 ||
        sprite.anchorX > 1
      )
        errors.push(`sprites.${state} 矩形、比例或锚点无效`);
    } else if (
      ![
        "frameWidth",
        "frameHeight",
        "frames",
        "fps",
        "drawWidth",
        "drawHeight",
      ].every((key) => positive(sprite[key]))
    )
      errors.push(`sprites.${state} 横向动画参数不完整`);
  }
  return errors;
}
export function assertRoster(roster) {
  const ids = new Set();
  for (const character of roster) {
    const errors = validateCharacter(character);
    if (ids.has(character.id)) errors.push("角色 id 重复");
    ids.add(character.id);
    if (errors.length)
      throw new Error(
        `角色 ${character.id || "?"} 配置错误：\n${errors.join("\n")}`,
      );
  }
}
