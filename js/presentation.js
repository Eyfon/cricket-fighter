import { maps } from "./maps.js";
import { assetUrl } from "./asset-url.js";
let currentMap = maps[0];
// Visual presentation is separate from combat, so art can change without balance changes.
const stage = new Image();
let loadedStagePath = null;
function loadStageImage(map) {
  const path = map.image ? assetUrl(map.image) : "";
  if (path === loadedStagePath) return;
  loadedStagePath = path;
  stage.src = path;
}
loadStageImage(currentMap);
export function setStage(id) {
  currentMap = maps.find((map) => map.id === id) || maps[0];
  loadStageImage(currentMap);
}
export const stageReady = () => stage.complete && stage.naturalWidth > 0;

export function drawStage(ctx, { width = 960, height = 540, worldY = 0 } = {}) {
  const ground = 438 + worldY;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#382d32";
  ctx.fillRect(0, 0, width, height);
  if (currentMap.id === "training") {
    ctx.fillStyle = "#192532";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#66839b33";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = ground % 40; y <= height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#9dbfcaaa";
    ctx.beginPath();
    ctx.moveTo(0, ground);
    ctx.lineTo(width, ground);
    ctx.stroke();
  } else if (stageReady()) {
    ctx.save();
    ctx.filter = currentMap.filter;
    // Adapt scenery to the viewport; keep the floor aligned with the fighters.
    ctx.drawImage(stage, 0, 0, stage.naturalWidth, stage.naturalHeight * 438 / 540,
      0, 0, width, ground);
    ctx.drawImage(stage, 0, stage.naturalHeight * 438 / 540,
      stage.naturalWidth, stage.naturalHeight * 102 / 540,
      0, ground, width, 102);
    ctx.restore();
  }
  const shade = ctx.createLinearGradient(0, 0, 0, 170);
  shade.addColorStop(0, "#100f19ed");
  shade.addColorStop(1, "#100f1900");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, 170);
  // Warm floating dust, intentionally independent of the simulation RNG.
  const t = performance.now() / 1000;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? "#ffd49c66" : "#ffe7b22f";
    ctx.fillRect(
      (i * 127 + t * (5 + (i % 4))) % width,
      170 + ((i * 67) % Math.max(1, ground - 170)) + Math.sin(t + i) * 12,
      2,
      2,
    );
  }
  label(ctx, currentMap.english, 23, height - 22, 11, "#ffe6bd", "left");
  label(ctx, "STAGE 01  /  FREE PLAY", width - 24, height - 22, 10, "#ffe6bd", "right");
}
export function label(
  ctx,
  text,
  x,
  y,
  size = 20,
  color = "#fff3db",
  align = "center",
) {
  ctx.save();
  ctx.font = `900 italic ${size}px "Arial Black", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = align;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#17151d";
  ctx.lineWidth = size > 25 ? 5 : 3;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}
function polygon(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}
export function drawHUD(ctx, fighters, timer, round, winsRequired = 2, width = 960) {
  fighters.forEach((f, i) => {
    const healthTop = 49;
    const healthHeight = 17;
    const energyY = 78;
    const winsY = 93;
    const panelBottom = 106;
    const energyTextY = 124;
    const skillsY = 142;
    const comboY = 163;
    ctx.save();
    if (i) ctx.translate(width - 960, 0);
    ctx.save();
    if (i) {
      ctx.translate(960, 0);
      ctx.scale(-1, 1);
    }
    polygon(
      ctx,
      [
        [22, 22],
        [408, 22],
        [388, panelBottom],
        [22, panelBottom],
      ],
      "#16151cb5",
    );
    polygon(
      ctx,
      [
        [28, 45],
        [409, 45],
        [400, 70],
        [28, 70],
      ],
      "#e9d5ab",
    );
    polygon(
      ctx,
      [
        [32, 49],
        [402, 49],
        [395, 66],
        [32, 66],
      ],
      "#6e302c",
    );
    const barTopWidth = 370;
    const clipHealthShape = () => {
      ctx.beginPath();
      ctx.moveTo(32, healthTop);
      ctx.lineTo(402, healthTop);
      ctx.lineTo(395, healthTop + healthHeight);
      ctx.lineTo(32, healthTop + healthHeight);
      ctx.closePath();
      ctx.clip();
    };
    const remainingLives = Math.max(0, Math.ceil(Math.max(0, f.hp) / 100) - 1);
    if (remainingLives > 0) {
      // Reserve lives are full bars behind the current life at the exact
      // same position. The active bar is painted afterward on the top layer.
      ctx.save();
      clipHealthShape();
      ctx.fillStyle = "#f5d85866";
      ctx.fillRect(32, healthTop, barTopWidth, healthHeight);
      ctx.fillStyle = "#fff4cc44";
      ctx.fillRect(32, healthTop, barTopWidth, 2);
      ctx.restore();
    }
    // Multiple lives share one exact position.  When the current life is
    // depleted, the next life is revealed at the same width instead of
    // extending the bar or adding visible segments.
    const currentLifeHp = f.hp <= 0 ? 0 : f.hp % 100 || 100;
    const length = (barTopWidth * currentLifeHp) / 100;
    if (length > 0) {
      const health = ctx.createLinearGradient(0, healthTop, 0, healthTop + healthHeight);
      const low = currentLifeHp <= 25;
      health.addColorStop(0, low ? "#ffbbb0" : "#fffac1");
      health.addColorStop(0.35, low ? "#ff5947" : "#f5d858");
      health.addColorStop(1, low ? "#b82436" : "#b78a29");
      ctx.save();
      clipHealthShape();
      ctx.fillStyle = health;
      ctx.fillRect(32, healthTop, length, healthHeight);
      ctx.fillStyle = "#fff4cc88";
      ctx.fillRect(32, healthTop, length, 2);
      ctx.restore();
    }
    ctx.fillStyle = "#19171f";
    ctx.fillRect(32, energyY, 220, 7);
    ctx.fillStyle = f.energyPoints === 3 ? "#fff1a0" : f.def.color;
    ctx.fillRect(32, energyY, f.energyPoints === 3 ? 220 : (220 * f.meter) / 100, 7);
    for (let point = 0; point < 3; point++) {
      const x = 275 + point * 30;
      polygon(
        ctx,
        [
          [x, energyY - 5],
          [x + 10, energyY + 5],
          [x, energyY + 15],
          [x - 10, energyY + 5],
        ],
        "#d9bb83",
      );
      polygon(
        ctx,
        [
          [x, energyY - 2],
          [x + 7, energyY + 5],
          [x, energyY + 12],
          [x - 7, energyY + 5],
        ],
        point < f.energyPoints ? "#ffe797" : "#30252b",
      );
    }
    for (let j = 0; j < winsRequired; j++)
      polygon(
        ctx,
        [
          [30 + j * 19, winsY + 6],
          [36 + j * 19, winsY],
          [42 + j * 19, winsY + 6],
          [36 + j * 19, winsY + 12],
        ],
        j < f.wins ? "#ffd574" : "#574345",
      );
    ctx.restore();
    const displayedLives = Math.max(0, Math.ceil(Math.max(0, f.hp) / 100));
    if (displayedLives > 1)
      label(
        ctx,
        `x${displayedLives}`,
        i ? 580 : 382,
        62,
        10,
        "#fff3c2",
        i ? "left" : "right",
      );
    label(
      ctx,
      `SKILLS ${f.energyPoints >= 1 ? "READY" : "1 PT"} / SUPER ${f.energyPoints >= 3 ? "READY" : "3 PT"} / DODGE ${f.dodgeCooldown > 0 ? f.dodgeCooldown.toFixed(1) + "s" : "READY"}`,
      i ? 926 : 34,
      skillsY,
      9,
      "#ebd3b9",
      i ? "right" : "left",
    );
    if (f.combo > 1)
      label(
        ctx,
        `${f.combo} HIT COMBO`,
        i ? 926 : 34,
        comboY,
        14,
        "#ffe797",
        i ? "right" : "left",
      );
    label(
      ctx,
      f.def.name,
      i ? 926 : 34,
      38,
      19,
      "#fff0cf",
      i ? "right" : "left",
    );
    label(
      ctx,
      i ? "2P" : "1P",
      i ? 570 : 390,
      36,
      13,
      f.def.color,
      i ? "left" : "right",
    );
    label(
      ctx,
      `ENERGY ${f.energyPoints}/3  ·  ${f.energyPoints === 3 ? "MAX" : Math.floor(f.meter) + "%"}`,
      i ? 926 : 34,
      energyTextY,
      10,
      f.energyPoints === 3 ? "#ffe388" : "#ebd3b9",
      i ? "right" : "left",
    );
    ctx.restore();
  });
  ctx.save();
  ctx.translate((width - 960) / 2, 0);
  polygon(
    ctx,
    [
      [433, 18],
      [527, 18],
      [542, 65],
      [522, 98],
      [438, 98],
      [418, 65],
    ],
    "#181720",
  );
  ctx.strokeStyle = "#ddbd86";
  ctx.lineWidth = 2;
  ctx.strokeRect(442, 20, 76, 70);
  label(
    ctx,
    Number.isFinite(timer) ? String(Math.ceil(timer)).padStart(2, "0") : "∞",
    480,
    73,
    47,
    timer < 10 ? "#ff745e" : "#fff3cf",
  );
  label(ctx, `ROUND ${round}`, 480, 113, 11, "#f0d2a6");
  ctx.restore();
}

export function drawImpact(ctx, particles) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    const alpha = Math.max(0, p.life / 0.3);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.blocked ? 2 : 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
    ctx.stroke();
    ctx.fillStyle = "#fff5ce";
    ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
  }
  ctx.restore();
}
