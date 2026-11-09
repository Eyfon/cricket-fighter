const naiWaEggImage = new Image();
naiWaEggImage.src = new URL("../assets/effects/naiwa-egg.png", import.meta.url).href;
const dafeiyuWhaleImage = new Image();
dafeiyuWhaleImage.src = new URL("../assets/characters/dafeiyu/super/whale.png", import.meta.url).href;
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
    if (p.whale) {
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowColor = "#35bfff";
      ctx.shadowBlur = 24;
      const width = p.radius * 3.7;
      const height = width * 0.5;
      if (dafeiyuWhaleImage.complete && dafeiyuWhaleImage.naturalWidth) {
        ctx.drawImage(dafeiyuWhaleImage, -width * 0.5, -height * 0.62, width, height);
      } else {
        const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, p.radius * 1.6);
        glow.addColorStop(0, "#e3fbff");
        glow.addColorStop(0.45, "#55cfff");
        glow.addColorStop(1, "#1974e900");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 1.55, p.radius * 0.66, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      continue;
    }
    if (p.targeted) {
      const r = p.radius;
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowColor = "#ffe9a0";
      ctx.shadowBlur = 14;
      if (naiWaEggImage.complete && naiWaEggImage.naturalWidth) {
        const size = r * 3.4;
        ctx.save();
        // The falling奶蛋 must enter point-first, with its head down.
        ctx.rotate(Math.PI);
        ctx.drawImage(naiWaEggImage, -size / 2, -size * 0.38, size, size);
        ctx.restore();
      } else {
        ctx.fillStyle = "#f4c85d";
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.9, r * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      continue;
    }
    if (p.waterBurst) {
      const r = p.radius;
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "#36cfff";
      ctx.shadowBlur = 22;
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.7);
      glow.addColorStop(0, "#f0ffff");
      glow.addColorStop(0.3, "#9deaff");
      glow.addColorStop(0.75, "#2d9effaa");
      glow.addColorStop(1, "#1a74ff00");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d7fbff";
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.55 + i * 0.22), -1.2 + t * 4 + i, 1.2 + t * 4 + i);
        ctx.stroke();
      }
      ctx.restore();
      continue;
    }
    if (p.rain) {
      const r = p.radius;
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowColor = "#ffe9a0";
      ctx.shadowBlur = 16;
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.4);
      glow.addColorStop(0, "#fff8d6");
      glow.addColorStop(0.55, "#ffe48a");
      glow.addColorStop(1, "#f4a93d00");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff0ae";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff8d6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }
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
    const v = f.burstVisual, t = Math.min(1, v.age / (v.duration ?? 0.4));
    ctx.save();
    ctx.globalAlpha = 1 - t;
    const r = v.range * (0.25 + 0.75 * t);
    if (v.waterPillar) {
      const x = (v.x - f.x) * f.facing;
      const top = v.y - f.y - 205;
      const bottom = v.y - f.y + 8;
      const width = Math.max(24, r * (0.35 + t * 0.2));
      const water = ctx.createLinearGradient(x, top, x, bottom);
      water.addColorStop(0, "#bdf8ff00");
      water.addColorStop(0.25, "#61d9ffcc");
      water.addColorStop(0.7, "#1987ffdd");
      water.addColorStop(1, "#bdf8ff22");
      ctx.fillStyle = water;
      ctx.shadowColor = "#37c9ff";
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.ellipse(x, (top + bottom) / 2, width, (bottom - top) / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d7fbff";
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const waveX = x + (i - 1.5) * width * 0.45;
        ctx.beginPath();
        ctx.moveTo(waveX, bottom - 10);
        ctx.bezierCurveTo(waveX - 12, bottom - 52, waveX + 18, top + 54, waveX, top + 10);
        ctx.stroke();
      }
    } else if (v.waterWave) {
      const x = (v.x - f.x) * f.facing;
      ctx.strokeStyle = "#8beaff";
      ctx.shadowColor = "#2bbcff";
      ctx.shadowBlur = 18;
      ctx.lineWidth = 5 * (1 - t) + 1;
      for (let i = 0; i < 4; i++) {
        const radius = r * (0.35 + i * 0.16);
        ctx.beginPath();
        ctx.arc(x, -92, radius, -Math.PI * 0.72, Math.PI * 0.72);
        ctx.stroke();
      }
      ctx.fillStyle = "#bff8ff88";
      ctx.beginPath();
      ctx.ellipse(x, -92, r * 0.32, r * 0.9, 0, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();
    } else if (v.soundwave) {
      ctx.strokeStyle = "#f4f0c2";
      ctx.lineWidth = 4 * (1 - t) + 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc((v.x - f.x) * f.facing, v.y - f.y - 92, r * (0.45 + i * 0.22), 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = f.def.color;
      ctx.lineWidth = 7 * (1 - t) + 1;
      ctx.beginPath();
      ctx.ellipse((v.x - f.x) * f.facing, v.y - f.y - (v.ground ? 5 : 80), r, v.ground ? r * 0.22 : r * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (v.ground && !v.soundwave) {
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
  if (f.eggImpact) {
    const v = f.eggImpact, t = Math.min(1, v.age / 0.45);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = "#ffe48a";
    ctx.shadowColor = "#ffb43b";
    ctx.shadowBlur = 24;
    ctx.lineWidth = 8 - t * 6;
    ctx.beginPath();
    ctx.arc((v.x - f.x) * f.facing, v.y - f.y - 90, v.range * (0.18 + t * 0.82), 0, Math.PI * 2);
    ctx.stroke();
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
    if (m.soundwave) {
      ctx.strokeStyle = "#f4f0c2";
      ctx.shadowColor = "#fff4a8";
      ctx.shadowBlur = 14;
      ctx.lineWidth = charging ? 2 : 3;
      const waveCount = charging ? 2 : 8;
      for (let i = 0; i < waveCount; i++) {
        const phase = (progress * 2.8 + i / waveCount) % 1;
        const radius = 24 + phase * 150;
        ctx.globalAlpha = charging ? 0.7 : (1 - phase) * 0.85;
        ctx.beginPath();
        ctx.arc(0, -92, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
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

export function drawTargetLocks(ctx, fighters) {
  for (const f of fighters) {
    const lock = f.targetLock;
    if (!lock) continue;
    const t = Math.max(0, Math.min(1, lock.age / lock.duration));
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.translate(lock.x, lock.y - 105);
    ctx.rotate(t * Math.PI * 2.4);
    ctx.strokeStyle = "#ff334d";
    ctx.shadowColor = "#ff102f";
    ctx.shadowBlur = 16;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0.15, Math.PI * 0.85);
    ctx.arc(0, 0, 30, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-46, 0); ctx.lineTo(-20, 0);
    ctx.moveTo(20, 0); ctx.lineTo(46, 0);
    ctx.moveTo(0, -46); ctx.lineTo(0, -20);
    ctx.moveTo(0, 20); ctx.lineTo(0, 46);
    ctx.stroke();
    ctx.restore();
  }
}
