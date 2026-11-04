import { superFrame, drawSuperFlash } from "./super-flash.js";
import { assetUrl } from "./asset-url.js";
import { ArcadeAudio, musicForScreen } from "./audio.js";
import { END_DURATION, endingFrame, roundOutcome } from "./round-ending.js";
import { createMenu } from "./menu.js";
import { normalizeRules } from "./settings.js";
import { CombatWorld } from "./combat-world.js";
import { newBattleSeed, prepareBattleFrame, separateFighters } from "./battle-frame.js";
import { captureAiProjectiles, aiSnapshot } from "./ai.js";
import { drawAnimatedFighter } from "./animation.js";
import { drawProjectiles, drawMoveAura } from "./energy-effects.js";
import { bindings, HumanInput, eventCode } from "./input.js";
import { createMobileControls } from "./mobile-controls.js";
import {
  drawStage,
  drawHUD,
  drawImpact,
  label,
  stageReady,
  setStage,
} from "./presentation.js";
import { roster } from "./roster.js";
import { Fighter, FLOOR, cpuInput, defenseInput, resolveHit, intersects } from "./combat.js";
const $ = (id) => document.getElementById(id),
  canvas = $("arena"),
  ctx = canvas.getContext("2d");
const world = new CombatWorld();
const audio = new ArcadeAudio();
let superFlash = null;
let finale = null,
  introCues = new Set();
let activeConfig = null;
let gameOptions = { volume: 0.5, muted: false, shake: true };
const keys = new Set(),
  spriteImages = new Map();
let fighters = [],
  running = false,
  paused = false,
  showBoxes = false,
  round = 1,
  timer = 60,
  intro = 0,
  ending = 0,
  matchOver = false,
  hitstop = 0,
  shake = 0,
  particles = [],
  accumulator = 0,
  last = 0,
  mode = "watch",
  difficulty = "normal";
const humanInputs = bindings.map((binding) => new HumanInput(binding));
let mobileControls;
function clearInputs() {
  keys.clear();
  humanInputs.forEach((input) => input.reset());
  mobileControls?.clear();
  mobileControls?.refresh();
}
for (const id of ["p1", "p2"])
  for (const c of roster) {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = c.name;
    $(id).append(option);
  }
$("p2").value = roster[1]?.id || roster[0].id;
for (const def of roster)
  for (const sprite of Object.values(def.sprites || {}))
    for (const pose of [sprite, ...(sprite.clip || [])]) {
      const src = pose.src || sprite.src;
      if (spriteImages.has(src)) continue;
      const image = new Image();
      spriteImages.set(src, image);
      image.src = assetUrl(src);
    }
const menu = createMenu({
  roster,
  onStart: start,
  onLeave: leaveBattle,
  onScreen(screen) {
    const track = musicForScreen(screen);
    if (track) {
      audio.pause(false);
      audio.setStage(track);
    }
  },
  onOptions(options) {
    gameOptions = options;
    audio.configure(options);
  },
});
mobileControls = createMobileControls({
  canInput: () => menu.screen === "battle" && running && !paused && !matchOver &&
    !finale && mode !== "watch",
  onPause: togglePause,
});
function unlockAudio() {
  audio.unlock();
}
window.addEventListener("pointerdown", unlockAudio, { capture: true });
window.addEventListener("keydown", unlockAudio, { capture: true });
function leaveBattle() {
  superFlash = null;
  audio.cancelVoice();
  finale = null;
  running = false;
  paused = false;
  matchOver = false;
  world.reset();
  clearInputs();
  fighters = [];
}
function resetRound() {
  superFlash = null;
  world.reset();
  clearInputs();
  fighters.forEach((f, i) => f.reset(i ? 710 : 250, i ? -1 : 1));
  timer =
    activeConfig?.mode === "training" || activeConfig?.time === 0
      ? Infinity
      : activeConfig?.time || 60;
  intro = 2.2;
  finale = null;
  introCues = new Set();
  ending = 0;
  hitstop = 0;
  particles = [];
  shake = 0;
  mobileControls?.refresh();
}
function start(config) {
  activeConfig = { ...config, ...normalizeRules(config), seed: newBattleSeed() };
  world.setSeed(activeConfig.seed);
  mode = activeConfig.mode;
  document.body.dataset.mode = mode;
  difficulty = activeConfig.difficulty;
  setStage(activeConfig.stage);
  fighters = [activeConfig.p1, activeConfig.p2].map(
    (id, i) =>
      new Fighter(
        roster.find((c) => c.id === id),
        i ? 710 : 250,
        i ? -1 : 1,
        activeConfig.healthMultiplier,
      ),
  );
  round = 1;
  running = true;
  paused = false;
  matchOver = false;
  clearInputs();
  accumulator = 0;
  resetRound();
  $("pause").textContent = "暂停 / Esc";
  unlockAudio();
  audio.pause(false);
  audio.setStage(activeConfig.stage);
  $("status").textContent = {
    watch: "自动观战 · 双方 AI 控制",
    cpu: "人机对战 · 你控制左方 1P",
    local: "本地双人 · 使用两组键位",
    training: "练习模式 · 1P 操作 / 对手木桩",
  }[mode];
}
function togglePause() {
  if (!running || matchOver) return;
  paused = !paused;
  // Pausing freezes gameplay while the current BGM keeps playing.
  if (paused) audio.cancelVoice();
  clearInputs();
  $("pause").textContent = paused ? "继续 / Esc" : "暂停 / Esc";
  menu.pause(paused);
}
$("pause").onclick = togglePause;
$("resume").onclick = togglePause;
$("boxes").onchange = () => {
  showBoxes = $("boxes").checked;
};
const gameCodes = new Set(
  bindings.flatMap((binding) => Object.values(binding)),
);
window.addEventListener("keydown", (e) => {
  if (
    menu.screen !== "battle" ||
    /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)
  )
    return;
  const code = eventCode(e);
  if (gameCodes.has(code)) e.preventDefault();
  if (e.code === "Escape" && !e.repeat) {
    e.preventDefault();
    togglePause();
    return;
  }
  if (!e.repeat) keys.add(code);
});
window.addEventListener("keyup", (e) => keys.delete(eventCode(e)));
window.addEventListener("blur", () => {
  clearInputs();
  if (running && !paused && !matchOver) togglePause();
});
document.addEventListener("visibilitychange", () => {
  clearInputs();
  if (document.hidden && running && !paused && !matchOver) togglePause();
});
function finishRound() {
  if (finale) return;
  const [a, b] = fighters;
  const winner = a.hp === b.hp ? null : a.hp > b.hp ? a : b;
  if (mode !== "training" && winner) winner.wins++;
  const knockout = fighters.some((f) => f.hp <= 0);
  finale = {
    elapsed: 0,
    knockout,
    winner,
    outcome: roundOutcome(mode, winner ? fighters.indexOf(winner) : null),
    stage: "impact",
    finalMatch:
      mode !== "training" && !!winner && winner.wins >= activeConfig.wins,
    starts: fighters.map((f) => ({ x: f.x, y: f.y })),
    announcedKO: false,
    announcedWinner: false,
  };
  ending = END_DURATION;
  world.reset();
  clearInputs();
  for (const f of fighters) {
    // Keep the final attack object alive through the impact beat. The
    // presentation loop freezes simulation, so this lets the last punch,
    // kick, or skill pose remain visible before the KO fall begins.
    f.bufferedAction = null;
    f.dodgeTimer = 0;
    f.combo = 0;
    f.guard = false;
    if (f.hp <= 0) f.state = "hurt";
    else if (!f.attack) f.state = "idle";
    f.animTime = 0;
  }
  if (knockout) audio.finisher();
  $("status").textContent = knockout ? "最终一击！" : "时间结束";
}
function tickFinale(dt) {
  finale.elapsed += dt;
  ending = Math.max(0, END_DURATION - finale.elapsed);
  const frame = endingFrame(finale.elapsed, finale.knockout);
  finale.stage = frame.stage;
  fighters.forEach((f, i) => {
    f.animTime += dt;
    const start = finale.starts[i];
    const fall = frame.fall;
    f.y = start.y + (FLOOR - start.y) * fall;
    if (f.hp <= 0) f.state = fall >= 0.82 ? "ko" : fall < 0.28 && f.attack ? f.attack.key : "hurt";
    if (f.hp <= 0)
      f.x =
        start.x +
        (Math.max(145, Math.min(815, start.x - f.facing * 35)) - start.x) *
          fall;
  });
  particles = particles.filter((p) => (p.life -= dt) > 0);
  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  });
  shake *= 0.85;
  if (!finale.announcedKO && finale.elapsed >= 1.15) {
    finale.announcedKO = true;
    if (finale.knockout) audio.koReveal();
    audio.announce(!finale.winner ? "draw" : finale.knockout ? "ko" : "time");
  }
  if (!finale.announcedWinner && finale.elapsed >= 3.1) {
    finale.announcedWinner = true;
    if (finale.winner) audio.victory(finale.outcome.lost);
    audio.announce(finale.outcome.voice);
  }
  if (frame.done) {
    if (finale.finalMatch) {
      matchOver = true;
      $("status").textContent = `${finale.winner.def.name} 赢得比赛`;
      menu.result({
        name: finale.winner.def.name,
        score: `${fighters[0].wins} : ${fighters[1].wins}`,
      });
    } else {
      round++;
      resetRound();
    }
  }
}
function tick(dt) {
  if (menu.screen !== "battle" || !running || paused || matchOver) return;
  if (finale) {
    tickFinale(dt);
    return;
  }
  if (intro > 0) {
    const elapsed = 2.2 - intro;
    for (const [at, cue] of [
      [0, "round"],
      [
        0.6,
        round === 1
          ? "one"
          : round === 2
            ? "two"
            : round === 3
              ? "three"
              : "ready",
      ],
      [1.8, "fight"],
    ]) {
      if (elapsed >= at && !introCues.has(cue)) {
        introCues.add(cue);
        audio.announce(cue);
      }
    }
    intro -= dt;
    return;
  }
  if (superFlash) {
    superFlash.elapsed += dt;
    const frame = superFrame(superFlash.elapsed);
    if (frame.done) superFlash = null;
    else if (frame.frozen) return;
  }
  if (hitstop > 0) {
    hitstop -= dt;
    return;
  }
  timer = Math.max(0, timer - dt);
  const startedSupers = [];
  const frame = prepareBattleFrame(fighters, (f, i) => {
    f.aiProjectiles = captureAiProjectiles(f, world.projectiles);
    f.projectileThreat = world.projectiles.some(
      (p) =>
        p.owner !== f &&
        p.delay <= 0 &&
        Math.abs(p.x - f.x) < 170 &&
        Math.sign(f.x - p.x) === p.direction,
    );
    const ai = mode === "watch" || (mode === "cpu" && i === 1);
    if (mode === "training" && activeConfig.infiniteEnergy) {
      f.energyPoints = 3;
      f.meter = 0;
    }
    return mode === "training" && i === 1
        ? activeConfig.dummy === 'crouchGuard'
          ? defenseInput(f, fighters[1-i], true)
          : activeConfig.dummy === 'guard'
            ? defenseInput(f, fighters[1-i], !!fighters[1-i].attack?.move.low)
            : {}
        : ai
          ? cpuInput(f, fighters[1 - i], dt, i === 0 ? activeConfig.p1Difficulty : activeConfig.p2Difficulty, world.aiRandom[i])
          : humanInputs[i].read(i === 0
              ? new Set([...keys, ...mobileControls.sample()]) : keys, dt);
  });
  frame.forEach(({ fighter: f, input, opponent }) => {
    const previousAttack = f.attack,
      previousDodge = f.dodgeTimer;
    f.step(input, opponent, dt);
    if (f.attack && f.attack !== previousAttack) {
      audio.playMove(f.attack.key, f.attack.move);
      if (f.attack.key === "super") startedSupers.push(f);
    }
    if (f.attack && f.attack.frame === f.attack.move.startup)
      audio.releaseMove(f.attack.key, f.attack.move);
    if (f.dodgeTimer > previousDodge) audio.playMove("dodge", {});
  });
  if (startedSupers.length) {
    superFlash = { actor: startedSupers[0], elapsed: 0 };
    audio.superStart();
    return;
  }
  const [a, b] = fighters;
  separateFighters(fighters);
  for (const event of world.step(fighters, dt)) {
    hitstop = event.blocked
      ? 0.025
      : event.super
        ? 0.08
        : event.grab
          ? 0.04
          : 0.032;
    shake = gameOptions.shake ? (event.blocked ? 2 : event.super ? 12 : 5) : 0;
    audio.impact(event);
    for (let i = 0; i < 12; i++)
      particles.push({
        ...event,
        vx: (Math.random() - 0.5) * 600,
        vy: (Math.random() - 0.7) * 450,
        life: 0.3,
        color: event.blocked ? "#a8eaff" : event.color || "#ffde8a",
      });
  }
  particles = particles.filter((p) => (p.life -= dt) > 0);
  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  });
  shake *= 0.85;
  if (timer <= 0 || fighters.some((f) => f.hp <= 0)) finishRound();
}
function text(s, x, y, size = 20, color = "#fff", align = "center") {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px "Microsoft YaHei",sans-serif`;
  ctx.textAlign = align;
  label(ctx, s, x, y, size, color, align);
}
function bar(x, y, w, h, p, color, reverse = false) {
  ctx.fillStyle = "#080c12";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  const fill = w * Math.max(0, Math.min(1, p));
  ctx.fillRect(reverse ? x + w - fill : x, y, fill, h);
}
function drawFighter(f) {
  const box = f.hurtbox();
  ctx.fillStyle = "#0006";
  ctx.beginPath();
  ctx.ellipse(f.x, FLOOR + 6, 47, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.facing, 1);
  if (f.dodgeTimer > 0) {
    ctx.translate(0, 8);
    ctx.scale(1, 0.94);
  }
  if (finale && f.hp <= 0 && f.state !== "ko") {
    const fall = endingFrame(finale.elapsed).fall;
    const eased = 1 - (1 - fall) ** 3;
    ctx.translate(0, -90 + 70 * eased - Math.sin(fall * Math.PI) * 28);
    ctx.rotate(-0.9 * eased);
    ctx.translate(0, 90);
  }
  if (drawAnimatedFighter(ctx, f, spriteImages)) {
    drawMoveAura(ctx, f);
  } else {
    const bob = f.state === "idle" ? Math.sin(f.animTime * 6) * 2 : 0,
      reach = f.attack
        ? Math.min(1, f.attack.frame / f.attack.move.startup)
        : 0;
    ctx.translate(0, bob);
    ctx.strokeStyle = f.stun > 0 ? "#fff" : f.def.color;
    ctx.fillStyle = f.stun > 0 ? "#fff" : f.def.color;
    ctx.lineWidth = 15;
    ctx.lineCap = "round";
    if (f.hp <= 0) {
      ctx.rotate(-1.35);
      ctx.translate(35, 10);
    }
    const walk = f.state === "walk" ? Math.sin(f.animTime * 17) * 14 : 0;
    ctx.beginPath();
    ctx.moveTo(-10, -48);
    ctx.lineTo(-22 - walk, -7);
    ctx.moveTo(9, -48);
    ctx.lineTo(24 + walk, -7);
    ctx.stroke();
    ctx.fillRect(-23, -104, 46, 62);
    ctx.fillStyle = f.def.accent;
    ctx.fillRect(-23, -55, 46, 8);
    ctx.beginPath();
    ctx.arc(0, -122, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#18222c";
    ctx.fillRect(3, -128, 19, 7);
    ctx.strokeStyle = f.def.color;
    ctx.beginPath();
    ctx.moveTo(-14, -94);
    ctx.lineTo(-30, -75);
    ctx.moveTo(16, -94);
    if (f.state === "specialPunch" && f.attack?.move.effect === "rise")
      ctx.lineTo(28, -170 * reach);
    else if (f.state === "guard") ctx.lineTo(32, -129);
    else
      ctx.lineTo(
        33 + (f.state === "punch" || f.state === "super" ? 55 * reach : 0),
        -90,
      );
    ctx.stroke();
    if (f.state === "kick") {
      ctx.beginPath();
      ctx.moveTo(6, -45);
      ctx.lineTo(35 + 75 * reach, -50);
      ctx.stroke();
    }
    if (f.state === "super") {
      ctx.strokeStyle = "#e6f789";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(40, -90, 32 + Math.sin(f.animTime * 30) * 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  if (showBoxes) {
    ctx.strokeStyle = "#65dfff";
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    if (f.active()) {
      const b = f.hitbox();
      ctx.fillStyle = "#ff455544";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = "#ff4555";
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
  }
  if (f.escapeTimer > 0) {
    ctx.save();
    ctx.strokeStyle = "#a9ecff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y - 6, 48, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    text("RECOVER", f.x, f.y - 195, 14, "#bcf5ff");
    ctx.restore();
  }
}
const portraitActors = new Map();
function portrait(id, def, facing = 1, scale = 1.4) {
  const target = $(id);
  if (!target || !target.getClientRects().length) return;
  let actor = portraitActors.get(id);
  if (!actor || actor.def.id !== def.id) {
    actor = new Fighter(def, 0, 1);
    portraitActors.set(id, actor);
  }
  actor.animTime += 1 / 60;
  const context = target.getContext("2d");
  context.clearRect(0, 0, target.width, target.height);
  context.save();
  context.translate(target.width / 2, target.height - 8);
  context.scale(scale * facing, scale);
  drawAnimatedFighter(context, actor, spriteImages);
  context.restore();
}
function renderMenuPortraits() {
  if (menu.screen === "home") {
    portrait("home-left", roster[0], 1, 1.85);
    portrait("home-right", roster[1] || roster[0], -1, 1.85);
  }
  if (menu.screen === "characters") {
    portrait(
      "preview-p1",
      roster.find((c) => c.id === $("p1").value),
    );
    portrait(
      "preview-p2",
      roster.find((c) => c.id === $("p2").value),
      -1,
    );
  }
  if (menu.screen === "gallery")
    for (const def of roster)
      portrait("gallery-preview-" + def.id, def, 1, 1.65);
  if (menu.screen === "character-detail")
    portrait(
      "detail-portrait",
      roster.find((c) => c.id === menu.activeCharacter),
      1,
      1.8,
    );
}

function render() {
  if (menu.screen !== "battle") {
    renderMenuPortraits();
    return;
  }
  if (!fighters.length) {
    drawStage(ctx);
    roster
      .slice(0, 2)
      .forEach((def, i) =>
        drawFighter(new Fighter(def, i ? 715 : 245, i ? -1 : 1)),
      );
    text("READY TO FIGHT?", 480, 235, 46, "#ffe9a7");
    text("选择上方模式与角色 · 点击开始对战", 480, 272, 16, "#ffe7c7");
    return;
  }
  ctx.fillStyle = "#090a18";
  ctx.fillRect(0, 0, 960, 540);
  ctx.save();
  const scale = superFlash ? superFrame(superFlash.elapsed).scale : 1;
  ctx.translate(480, 270);
  ctx.scale(scale, scale);
  ctx.translate(-480, -270);
  drawStage(ctx);
  ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawProjectiles(ctx, world);
  fighters.forEach(drawFighter);
  drawImpact(ctx, particles);
  if (superFlash) drawSuperFlash(ctx, superFlash);
  ctx.restore();
  drawHUD(ctx, fighters, timer, round, activeConfig.wins);
  if (finale && !matchOver) {
    drawFinale();
  } else if (paused || intro > 0 || matchOver) {
    ctx.fillStyle = "#090f1b85";
    ctx.fillRect(0, 155, 960, 180);
    const winner = fighters[0].hp > fighters[1].hp ? fighters[0] : fighters[1];
    text(
      paused
        ? "PAUSED"
        : matchOver
          ? "WINNER"
          : intro > 1.4
            ? "VS"
            : intro > 0.4
              ? `ROUND ${round}`
              : intro > 0
                ? "FIGHT!"
                : fighters[0].hp === fighters[1].hp
                  ? "DRAW"
                  : "K.O.",
      480,
      238,
      64,
      "#ffe19a",
    );
    text(
      paused
        ? "点击继续或按 Esc"
        : matchOver
          ? `${winner.def.name} · 点击重新开局`
          : intro > 0
            ? `${fighters[0].def.name}  vs  ${fighters[1].def.name}`
            : `${fighters[0].hp === fighters[1].hp ? "平局" : winner.def.name + " 获胜"}`,
      480,
      280,
      19,
      "#dae1ea",
    );
  }
}
function drawFinale() {
  const t = finale.elapsed;
  const frame = endingFrame(t, finale.knockout);
  ctx.save();
  if (frame.stage === "impact" && finale.knockout) {
    ctx.fillStyle = `rgba(255,235,189,${0.65 * (1 - t / 0.28)})`;
    ctx.fillRect(0, 0, 960, 540);
    ctx.restore();
    return;
  }
  const bars = Math.min(1, t / 0.4) * 30;
  ctx.fillStyle = "#08070bd9";
  ctx.fillRect(0, 0, 960, bars);
  ctx.fillRect(0, 540 - bars, 960, bars);
  if (frame.stage === "ko" || frame.stage === "winner") {
    const since = t - (frame.stage === "ko" ? 1.15 : 3.1);
    const enter = Math.min(1, since / 0.22);
    const koPulse = frame.stage === "ko" ? Math.max(0, 1 - since / 0.72) : 0;
    ctx.translate(480, 250);
    ctx.scale(
      1 + (1 - enter) * 0.7 + Math.sin(since * 34) * koPulse * 0.035,
      1 + (1 - enter) * 0.7 + Math.sin(since * 34) * koPulse * 0.035,
    );
    ctx.globalAlpha = enter;
    if (frame.stage === "ko") {
      ctx.save();
      ctx.globalAlpha = enter * (0.35 + koPulse * 0.65);
      ctx.fillStyle = `rgba(224, 35, 45, ${0.18 + koPulse * 0.22})`;
      ctx.fillRect(-480, -170, 960, 340);
      ctx.strokeStyle = `rgba(255, 206, 104, ${0.35 + koPulse * 0.5})`;
      ctx.lineWidth = 3 + koPulse * 5;
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2 + since * 0.8;
        const inner = 135 + (i % 3) * 12;
        const outer = 330 + (i % 4) * 24;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner * 0.46);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer * 0.46);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.fillStyle = "#120e17bd";
    ctx.fillRect(-480, -96, 960, 188);
    const headline =
      frame.stage === "ko"
        ? finale.winner
          ? frame.title
          : "DRAW"
        : finale.outcome.headline;
    ctx.font = `italic 900 ${headline.length > 8 ? 76 : frame.stage === "ko" ? 142 : 112}px Impact, sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = frame.stage === "ko" ? 15 : 10;
    ctx.strokeStyle = frame.stage === "ko" ? "#3a0b16" : "#5e151c";
    ctx.strokeText(headline, 0, 8);
    const gradient = ctx.createLinearGradient(0, -95, 0, 30);
    gradient.addColorStop(0, "#fff7ce");
    gradient.addColorStop(0.5, "#ffc547");
    gradient.addColorStop(1, "#f24b32");
    ctx.fillStyle = gradient;
    ctx.fillText(headline, 0, 8);
    text(
      frame.stage === "winner"
        ? finale.winner
          ? `${finale.winner.def.name} · 胜利`
          : "再战一局"
        : finale.knockout
          ? "击 倒"
          : "时 间 结 束",
      0,
      54,
      24,
      "#fff1cf",
    );
  }
  ctx.restore();
}
function loop(now) {
  const elapsed = Math.min((now - last) / 1000 || 0, 0.1);
  last = now;
  accumulator += elapsed;
  while (accumulator >= 1 / 60) {
    tick(1 / 60);
    accumulator -= 1 / 60;
  }
  audio.update();
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
// Read-only inspection for browser QA and future replay tooling.
export function snapshot() {
  return {
    screen: menu.screen,
    config: activeConfig ? { ...activeConfig } : null,
    running,
    paused,
    mode,
    round,
    timer: Number.isFinite(timer) ? timer : null,
    intro,
    ending,
    matchOver,
    superFlash: superFlash
      ? {
          elapsed: superFlash.elapsed,
          actor: superFlash.actor.def.id,
          ...superFrame(superFlash.elapsed),
        }
      : null,
    finale: finale
      ? {
          elapsed: finale.elapsed,
          stage: finale.stage,
          knockout: finale.knockout,
          finalMatch: finale.finalMatch,
          winnerIndex: finale.winner ? fighters.indexOf(finale.winner) : null,
          outcome: { ...finale.outcome },
        }
      : null,
    audio: audio.snapshot(),
    showBoxes,
    projectiles: world.projectiles.map((p) => ({
      x: p.x,
      y: p.y,
      radius: p.radius,
      owner: p.owner.def.id,
      key: p.key,
    })),
    captures: world.grabs.length,
    visualsReady:
      stageReady() &&
      [...spriteImages.values()].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    fighters: fighters.map((f) => ({
      id: f.def.id,
      x: f.x,
      y: f.y,
      hp: f.hp,
      maxHp: f.maxHp,
      energyPoints: f.energyPoints,
      meter: f.meter,
      wins: f.wins,
      state: f.state,
      guard: f.guard,
      crouchGuard: f.crouchGuard,
      attack: f.attack?.key || null,
      attackFrame: f.attack?.frame ?? null,
      dodgeTimer: f.dodgeTimer,
      cooldowns: { ...f.cooldowns },
      stun: f.stun,
      escapeTimer: f.escapeTimer,
      pressureHits: f.pressureHits,
      controlTime: f.controlTime,
      captured: !!f.capturedBy,
      grabbing: !!f.grabbing,
      walkDistance: f.walkDistance,
      ai: aiSnapshot(f),
    })),
  };
}
