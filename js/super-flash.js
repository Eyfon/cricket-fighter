export const SUPER_FREEZE = 0.18;
export const SUPER_DURATION = 0.58;
export function superFrame(elapsed) {
  const burst = Math.max(0, 1 - elapsed / SUPER_DURATION);
  return {
    frozen: elapsed < SUPER_FREEZE,
    done: elapsed >= SUPER_DURATION,
    // Brief pullback, followed by a clean return to the normal framing.
    scale:
      1 - Math.sin(Math.min(1, elapsed / SUPER_DURATION) * Math.PI) * 0.075,
    burst,
    radius: 190 * Math.max(0.05, 1 - elapsed / SUPER_FREEZE),
  };
}
export function drawSuperFlash(ctx, flash) {
  const frame = superFrame(flash.elapsed),
    f = flash.actor;
  ctx.save();
  ctx.fillStyle = `rgba(4,7,20,${frame.burst * 0.38})`;
  ctx.fillRect(0, 0, 960, 540);
  ctx.translate(f.x, f.y - 95);
  ctx.strokeStyle = f.def.color;
  ctx.lineWidth = 2 + frame.burst * 4;
  ctx.shadowColor = f.def.color;
  ctx.shadowBlur = 18;
  ctx.globalAlpha = frame.burst;
  ctx.beginPath();
  ctx.arc(0, 0, frame.radius, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8;
    ctx.beginPath();
    ctx.moveTo(
      Math.cos(angle) * (frame.radius + 20),
      Math.sin(angle) * (frame.radius + 20),
    );
    ctx.lineTo(
      Math.cos(angle) * (frame.radius + 90),
      Math.sin(angle) * (frame.radius + 90),
    );
    ctx.stroke();
  }
  ctx.fillStyle = "#fff8d5";
  ctx.fillRect(-90 * frame.burst, -3, 180 * frame.burst, 6);
  ctx.fillRect(-3, -75 * frame.burst, 6, 150 * frame.burst);
  ctx.restore();
}
