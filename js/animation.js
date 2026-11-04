const clamp = (t) => Math.max(0, Math.min(1, t));
function pair(frames, indices, progress, loop = false) {
  const count = indices.length;
  const index = Math.min(
    count - 1,
    Math.floor((loop ? progress : clamp(progress)) * count),
  );
  const pose = frames[indices[index]];
  return { a: pose, b: pose, blend: 0 };
}
export function sampleAnimation(f) {
  const state = f.guard && f.crouchGuard ? 'crouchGuard' : f.state;
  const sprite = f.def.sprites[state] || f.def.sprites.idle;
  if (!sprite.clip) return { a: sprite, b: sprite, blend: 0 };
  const frames = sprite.clip.map((frame) => ({
    ...sprite,
    ...frame,
    clip: undefined,
  }));
  const indices = frames.map((_, i) => i);
  if (state === 'crouchGuard')
    return pair(frames, [f.blockStun ? 1 : 0], 0);
  if (f.state === 'knockdown')
    return pair(frames, indices, 1 - f.knockdownTimer / f.knockdownDuration);
  if (f.state === "walk")
    return pair(
      frames,
      indices,
      (((((f.vx * f.facing < 0 ? -1 : 1) * f.walkDistance) /
        (sprite.stride || 100)) %
        1) +
        1) %
        1,
      true,
    );
  if (f.grabbing && sprite.grabTimeline) {
    const key = [...sprite.grabTimeline].reverse().find(k=>f.grabbing.time>=k.at) || sprite.grabTimeline[0];
    const pose = frames[key.frame];
    return {a:pose,b:pose,blend:0};
  }
  if (f.grabbing && sprite.grabFrames)
    return pair(
      frames,
      sprite.grabFrames,
      f.grabbing.time / f.grabbing.move.grab.duration,
    );
  if (f.attack && sprite.phases) {
    const { frame, move } = f.attack;
    if (move.effect === 'burst' && move.burstAt === 'active' && frame >= move.startup) {
      if (!f.attack.spawned) {
        // Actual ascent/descent selects the pose; don't show the ground punch
        // while the physics still has the fighter in midair.
        const pose = frames[f.vy < -100 ? 1 : f.vy < 100 ? 2 : 3];
        return { a: pose, b: pose, blend: 0 };
      }
      return pair(frames, sprite.phases.recovery,
        (frame - f.attack.impactFrame) / move.recovery);
    }
    if (frame < move.startup)
      return pair(frames, sprite.phases.startup, frame / move.startup);
    if (frame < move.startup + move.active)
      return pair(
        frames,
        sprite.phases.active,
        (frame - move.startup) / move.active,
      );
    return pair(
      frames,
      sprite.phases.recovery,
      (frame - move.startup - move.active) / move.recovery,
    );
  }
  const duration = frames.length / (sprite.fps || 10);
  return pair(
    frames,
    indices,
    sprite.loop ? (f.animTime / duration) % 1 : f.animTime / duration,
    !!sprite.loop,
  );
}
function drawPose(ctx, pose, images, time) {
  const image = images.get(pose.src);
  if (!image?.complete || !image.naturalWidth) return;
  ctx.save();
  if (pose.rect) {
    const [x, y, w, h] = pose.rect,
      [trimLeft, trimTop, trimRight, trimBottom] = pose.trim || [0, 0, 0, 0],
      scale = pose.scale || 0.65,
      // Keep a one-pixel transparent gutter so neighboring atlas poses cannot bleed in.
      inset = Math.min(1, Math.floor(Math.min(w, h) / 8)),
      sourceX = x + trimLeft + inset,
      sourceY = y + trimTop + inset,
      sourceW = w - trimLeft - trimRight - inset * 2,
      sourceH = h - trimTop - trimBottom - inset * 2,
      drawW = sourceW * scale,
      drawH = sourceH * scale;
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceW,
      sourceH,
      -w * scale * (pose.anchorX ?? 0.5) + (trimLeft + inset) * scale,
      -(pose.originY ?? h) * scale + (trimTop + inset) * scale,
      drawW,
      drawH,
    );
  } else {
    const frame = Math.floor(time * (pose.fps || 8)) % pose.frames;
    ctx.drawImage(
      image,
      frame * pose.frameWidth,
      0,
      pose.frameWidth,
      pose.frameHeight,
      -pose.drawWidth / 2,
      -pose.drawHeight,
      pose.drawWidth,
      pose.drawHeight,
    );
  }
  ctx.restore();
}
export function drawAnimatedFighter(ctx, f, images) {
  const sample = sampleAnimation(f);
  if (!images.get(sample.a.src)?.naturalWidth) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (f.state === "idle") ctx.translate(0, Math.sin(f.animTime * 6) * 1.5);
  if (f.capturedBy) ctx.rotate(f.visualRotation || 0);
  // One complete pose per render. No crossfade, duplicated body or afterimage.
  drawPose(ctx, sample.a, images, f.animTime);
  ctx.restore();
  return true;
}
