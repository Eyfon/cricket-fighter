export function drawProjectiles(ctx, world) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of world.projectiles) {
    if (p.delay > 0) continue;
    const r = p.radius,
      t = p.age,
      blue = p.owner.def.color;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.direction, 1);
    const trail = ctx.createLinearGradient(-r * 4, 0, r, 0);
    trail.addColorStop(0, "transparent");
    trail.addColorStop(0.6, blue + "66");
    trail.addColorStop(1, "#e6ffff");
    ctx.fillStyle = trail;
    ctx.beginPath();
    ctx.moveTo(-r * 4, -r * 0.3);
    ctx.quadraticCurveTo(-r, -r * 1.3, r, 0);
    ctx.quadraticCurveTo(-r, r * 1.3, -r * 4, r * 0.3);
    ctx.fill();
    ctx.shadowColor = blue;
    ctx.shadowBlur = p.key === "super" ? 28 : 14;
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, r);
    glow.addColorStop(0, "#ffffff");
    glow.addColorStop(0.3, "#baffff");
    glow.addColorStop(0.7, blue);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.25, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e8ffff";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        r * (0.6 + i * 0.2),
        r * (0.3 + i * 0.2),
        t * 9 + i,
        0,
        Math.PI * 1.5,
      );
      ctx.stroke();
    }
    if (p.key === "super") {
      ctx.strokeStyle = "#9cfaff";
      for (let i = 0; i < 6; i++) {
        const angle = t * 11 + (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * r * 0.8, Math.sin(angle) * r * 0.8);
        ctx.lineTo(
          Math.cos(angle + 0.2) * r * 1.5,
          Math.sin(angle + 0.2) * r * 1.5,
        );
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}
export function drawMoveAura(ctx, f) {
  // Caller already translates and mirrors into the fighter's local space.
  if (f.burstVisual) {
    const v = f.burstVisual, t = v.age / 0.4;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = f.def.color;
    ctx.lineWidth = 7 * (1 - t) + 1;
    const r = v.range * (0.25 + 0.75 * t);
    ctx.beginPath();
    ctx.ellipse((v.x - f.x) * f.facing, v.y - f.y - (v.ground ? 5 : 80), r, v.ground ? r * 0.22 : r * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (v.ground) {
      for (let i = 0; i < 9; i++) {
        const x = (i - 4) * r / 4;
        ctx.beginPath();
        ctx.moveTo(x, -4);
        ctx.lineTo(x * 1.12, -16 - (1 - t) * (18 + (i % 3) * 14));
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  if (!f.attack) return;
  const a = f.attack,
    m = a.move;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (f.hasSuperArmor()) {
    ctx.strokeStyle = "#ffe7a1";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#ffc447";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, -85, 43, 87, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (m.effect === "projectile" && a.frame < m.startup) {
    const charge = a.frame / m.startup,
      r = (a.key === "super" ? 38 : 15) * charge;
    // Charge follows the pose, while release always originates at the
    // configured palms. Raised arms must not leave the orb at waist height.
    let x, y;
    if (a.key === 'super') {
      if (charge < 0.3) {
        const t=charge/0.3; x=12*(1-t); y=-95-95*t;
      } else if (charge < 0.75) {
        x=0; y=-190-36*(charge-0.3)/0.45;
      } else {
        const t=(charge-0.75)/0.25;
        x=(m.projectile.offsetX ?? 64)*t;
        y=-226+((m.projectile.offsetY ?? -95)+226)*t;
      }
    } else {
      const t=Math.max(0,(charge-0.55)/0.45);
      x=-12+((m.projectile.offsetX ?? 64)+12)*t;
      y=-100+((m.projectile.offsetY ?? -95)+100)*t;
    }
    const glow = ctx.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      Math.max(1, r),
    );
    glow.addColorStop(0, "#fff");
    glow.addColorStop(0.4, "#b6ffff");
    glow.addColorStop(1, "#56cfff00");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle='#d6fcff';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.ellipse(x,y,r*0.8,r*0.45,a.frame*0.15,0,Math.PI*2);ctx.stroke();
  }
  if (m.effect === "rush" && f.active()) {
    ctx.strokeStyle = "#ff4a9a";
    ctx.shadowColor = "#ff205e";
    ctx.shadowBlur = 18;
    for (let i = 0; i < 3; i++) {
      ctx.lineWidth = 4 - i;
      ctx.beginPath();
      ctx.ellipse(45, -105, 85 - i * 9, 50 - i * 5, -0.5, -1.5, 1);
      ctx.stroke();
    }
  }
  if (m.effect === "burst") {
    const charging = a.frame < m.startup;
    const progress = charging ? a.frame / m.startup : 1;
    const radius = charging ? 18 + progress * 18 : 52 + Math.sin(a.frame * 1.8) * 6;
    ctx.strokeStyle = f.def.color;
    ctx.shadowColor = f.def.accent || f.def.color;
    ctx.shadowBlur = charging ? 12 : 22;
    ctx.lineWidth = charging ? 3 : 5;
    for (let i = 0; i < (charging ? 2 : 4); i++) {
      ctx.beginPath();
      ctx.ellipse(0, -88, radius + i * 8, radius * 0.72 + i * 5, i * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (!charging) {
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 + a.frame * 0.08;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 36, -88 + Math.sin(angle) * 28);
        ctx.lineTo(Math.cos(angle) * 82, -88 + Math.sin(angle) * 62);
        ctx.stroke();
      }
    }
  }
  if (f.grabbing) {
    ctx.strokeStyle = a.key === "super" ? "#ff659e" : "#cc66fa";
    ctx.lineWidth = 2;
    const progress = f.grabbing.time / f.grabbing.move.grab.duration;
    ctx.beginPath();
    ctx.ellipse(
      62,
      -90,
      40 + Math.sin(progress * 30) * 8,
      65,
      progress * 7,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  ctx.restore();
}
