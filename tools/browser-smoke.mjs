import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
try {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => {
    let callback,
      now = 1000;
    window.requestAnimationFrame = (f) => ((callback = f), 1);
    window.__advanceFrames = (count) => {
      for (let i = 0; i < count; i++) {
        now += 1000 / 60;
        const f = callback;
        callback = null;
        f?.(now);
      }
    };
    let seed = 34829;
    Math.random = () =>
      (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    window.__drawnText = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.__drawnText.push(String(text));
      if (window.__drawnText.length > 4000) window.__drawnText.splice(0, 2000);
      return original.call(this, text, ...args);
    };
  });
  assert.equal(
    (
      await page.goto(process.env.GAME_URL || "http://127.0.0.1:5173/")
    ).status(),
    200,
  );
  await page.waitForFunction(
    async () => (await import("./js/arena.js")).snapshot().visualsReady,
  );
  const state = () =>
    page.evaluate(async () => (await import("./js/arena.js")).snapshot());
  const advance = (n) => page.evaluate((n) => __advanceFrames(n), n);
  const click = async (id) => {
    assert.equal(await page.locator("#" + id).isVisible(), true, id);
    await page.evaluate((id) => document.getElementById(id).click(), id);
  };
  const togglePause = async () => {
    await page.keyboard.press("Escape");
  };
  const card = async (selector) => {
    assert.equal(await page.locator(selector).isVisible(), true, selector);
    await page.locator(selector).evaluate((element) => element.click());
  };
  const goSelection = async (mode = "local") => {
    const s = await state();
    if (s.screen === "battle") {
      if (s.matchOver) await click("result-return");
      else {
        if (!s.paused) await togglePause();
        await click("battle-return");
      }
    } else if (s.screen === "setup")
      await card('.screen[data-screen="setup"] [data-go="characters"]');
    else if (s.screen === "home") {
      if (mode === "training") await click("training");
      else {
        await click("play");
        await card(`[data-mode="${mode}"]`);
      }
    } else if (s.screen === "mode") await card(`[data-mode="${mode}"]`);
    else if (s.screen !== "characters") {
      await click("home-link");
      await click("play");
      await card(`[data-mode="${mode}"]`);
    }
  };
  const launch = async ({
    mode = "local",
    health = 1,
    time = 60,
    wins = 2,
    stage = "sunset",
    p1 = "prototype-a",
    p2 = "prototype-b",
  } = {}) => {
    await goSelection(mode);
    assert.equal((await state()).audio.stage, "selection");
    assert.equal((await state()).audio.paused, false);
    await page.selectOption("#p1", p1);
    await page.selectOption("#p2", p2);
    await click("characters-next");
    await page.selectOption("#health-multiplier", String(health));
    if (mode !== "training") {
      await page.selectOption("#round-time", String(time));
      await page.selectOption("#wins-required", String(wins));
    }
    await card(`[data-map="${stage}"]`);
    await click("start");
    await advance(145);
  };
  await mkdir("artifacts", { recursive: true });
  assert.equal((await state()).screen, "home");
  assert.equal((await state()).audio.stage, "lobby");
  await page.keyboard.press("Shift");
  await page.waitForFunction(
    async () => (await import("./js/arena.js")).snapshot().audio.ready,
  );
  await advance(1);
  await page.screenshot({ path: "artifacts/main-menu.png", fullPage: true });
  await card('.screen[data-screen="home"] [data-go="options"]');
  assert.equal(await page.locator("#muted").isChecked(), false);
  await page.locator("#muted").check();

  await page.locator("#shake").uncheck();
  await page.locator("#scanlines").uncheck();
  await page.selectOption("#touch-option", "never");
  await click("home-link");
  await page.reload();
  await page.waitForFunction(
    async () => (await import("./js/arena.js")).snapshot().visualsReady,
  );
  assert.equal(await page.locator("body").getAttribute("data-touch"), "never");
  await card('.screen[data-screen="home"] [data-go="options"]');
  assert.equal(await page.locator("#shake").isChecked(), false);
  await click("reset-options");
  assert.equal(await page.locator("#muted").isChecked(), false);

  await click("home-link");
  await card('.screen[data-screen="home"] [data-go="gallery"]');
  await advance(1);
  assert.equal(await page.locator("#gallery .archive-card canvas").count(), 2);
  assert.equal(await page.locator("#gallery dt").count(), 0);
  await page.screenshot({
    path: "artifacts/character-gallery.png",
    fullPage: true,
  });
  await card('[data-character-id="prototype-a"]');
  await advance(1);
  assert.equal((await state()).screen, "character-detail");
  assert.equal(await page.locator("#detail-moves dt").count(), 6);
  const details = await page.locator("#detail-moves").textContent();
  for (const category of ["普攻", "招式1", "招式2", "特技", "绝招"])
    assert.ok(details.includes(category));
  assert.ok(!/小键盘|S＋|J \//.test(details));
  await page.screenshot({
    path: "artifacts/character-detail.png",
    fullPage: true,
  });
  await click("home-link");
  await click("play");
  await card('[data-mode="watch"]');
  assert.equal(
    await page.locator('.screen[data-screen="characters"] dt').count(),
    0,
  );
  await page.selectOption("#p1", "prototype-b");
  await page.selectOption("#p1", "prototype-a");
  await click("characters-next");
  assert.equal(await page.locator("#round-time").inputValue(), "60");
  assert.equal(await page.locator("#health-multiplier").inputValue(), "1");
  await page.selectOption("#health-multiplier", "3");
  await page.selectOption("#round-time", "30");
  await page.selectOption("#wins-required", "1");
  await card('[data-map="midnight"]');
  await page.screenshot({
    path: "artifacts/match-setup.png",
    fullPage: true,
    animations: "disabled",
  });
  await click("start");
  await advance(145);
  let s = await state();
  assert.equal(s.config.stage, "midnight");
  assert.equal(s.audio.track, "霓虹追击");
  const viewport = page.viewportSize(),
    area = await page.locator(".cabinet").boundingBox();
  assert.ok(area.width >= viewport.width - 2);
  assert.ok(area.height >= viewport.height - 60);

  assert.ok(s.fighters.every((f) => f.maxHp === 300));
  assert.ok(s.timer <= 30);
  await togglePause();
  const pausedTimer = (await state()).timer;
  await advance(120);
  assert.equal((await state()).timer, pausedTimer);
  assert.equal((await state()).audio.paused, false);
  await togglePause();
  await advance(10000);
  s = await state();
  assert.equal(s.matchOver, true);
  assert.equal(await page.locator("#result-panel button").count(), 2);
  await page.screenshot({ path: "artifacts/result.png", fullPage: true });
  await click("result-rematch");
  s = await state();
  assert.equal(s.matchOver, false);
  assert.equal(s.config.healthMultiplier, 3);
  assert.ok(s.fighters.every((f) => f.hp === 300 && f.wins === 0));
  await togglePause();
  await click("battle-return");
  assert.equal((await state()).screen, "characters");
  await click("characters-next");
  assert.equal(await page.locator("#health-multiplier").inputValue(), "3");
  await click("reset-rules");
  assert.equal(await page.locator("#health-multiplier").inputValue(), "1");
  await click("home-link");
  await launch({ mode: "local", health: 5, time: 0, stage: "training" });
  s = await state();
  assert.ok(s.fighters.every((f) => f.hp === 500));
  assert.equal(s.timer, null);
  assert.equal(s.audio.track, "极限热身");
  await advance(100);
  assert.equal((await state()).timer, null);
  await launch();
  for (const [side, down, punch, kick, dodge, jump] of [
    [0, "s", "j", "k", "l", "w"],
    [1, "ArrowDown", "Numpad1", "Numpad2", "Numpad3", "ArrowUp"],
  ]) {
    for (const [key, expected] of [
      [punch, "punch"],
      [kick, "kick"],
    ]) {
      await togglePause();
      await click("restart");
      await advance(145);
      await page.keyboard.down(key);
      await advance(1);
      assert.equal((await state()).fighters[side].attack, expected);
      await page.keyboard.up(key);
    }
    for (const [key, expected] of [
      [punch, "specialPunch"],
      [kick, "specialKick"],
    ]) {
      await togglePause();
      await click("restart");
      await advance(145);
      await page.keyboard.down(down);
      await advance(2);
      await page.keyboard.down(key);
      await advance(1);
      assert.equal((await state()).fighters[side].attack, expected);
      await page.keyboard.up(key);
      await page.keyboard.up(down);
    }
    await togglePause();
    await click("restart");
    await advance(145);
    await page.keyboard.down(jump);
    await advance(1);
    assert.ok((await state()).fighters[side].y < 438);
    await page.keyboard.up(jump);
    await togglePause();
    await click("restart");
    await advance(145);
    await page.keyboard.down(dodge);
    await advance(2);
    assert.ok((await state()).fighters[side].dodgeTimer > 0);
    await page.keyboard.up(dodge);
  }
  await launch();
  await page.keyboard.down("s");
  await page.keyboard.down("j");
  await advance(22);
  await page.keyboard.up("s");
  await page.keyboard.up("j");
  assert.ok((await state()).projectiles.length > 0);
  await advance(70);
  assert.ok((await state()).fighters[1].hp < 100);
  assert.equal(
    await page.evaluate(() =>
      __drawnText.some((text) => /^\d+(?:\.\d+)?\s*\/\s*\d+$/.test(text)),
    ),
    false,
    "HUD must not draw numerical HP",
  );
  await launch({ p1: "prototype-b", p2: "prototype-a" });
  for (let i = 0; i < 12 && (await state()).fighters[0].energyPoints < 1; i++) {
    await page.keyboard.down("d");
    await advance(35);
    await page.keyboard.up("d");
    await page.keyboard.down("j");
    await advance(1);
    await page.keyboard.up("j");
    await advance(32);
  }
  assert.ok((await state()).fighters[0].energyPoints >= 1);
  await page.keyboard.down("d");
  await advance(18);
  await page.keyboard.up("d");
  const hpBeforeGrab = (await state()).fighters[1].hp;
  await page.keyboard.down("u");
  await advance(18);
  await page.keyboard.up("u");
  assert.equal((await state()).captures, 1);
  await advance(150);
  assert.equal((await state()).captures, 0);
  assert.ok((await state()).fighters[1].hp <= hpBeforeGrab - 13);
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
  await togglePause();
  await click("battle-return");
  await click("home-link");
  await click("training");
  await page.selectOption("#p1", "prototype-a");
  await page.selectOption("#p2", "prototype-b");
  await click("characters-next");
  assert.equal(await page.locator("#round-time").inputValue(), "0");
  await card('[data-map="training"]');
  await page.selectOption("#dummy", "guard");
  await click("start");
  await advance(145);
  assert.equal((await state()).mode, "training");
  assert.equal((await state()).timer, null);
  assert.equal((await state()).fighters[0].energyPoints, 3);
  await page.keyboard.down("s");
  await page.keyboard.down("j");
  await advance(22);
  await page.keyboard.up("j");
  await page.keyboard.up("s");
  await advance(70);
  assert.equal((await state()).fighters[1].hp, 100 - 8.5 * 0.25);
  await page.keyboard.down("u");
  await advance(1);
  await page.keyboard.up("u");
  assert.equal((await state()).fighters[0].attack, "skill");
  await page.keyboard.up("u");
  await advance(100);
  await page.keyboard.down("i");
  await advance(1);
  await page.keyboard.up("i");
  const frozenSuper = await state();
  assert.equal(frozenSuper.superFlash.frozen, true);
  assert.equal(frozenSuper.fighters[0].energyPoints, 0);
  await advance(5);
  const duringSuper = await state();
  assert.equal(
    duringSuper.fighters[0].attackFrame,
    frozenSuper.fighters[0].attackFrame,
  );
  assert.deepEqual(
    duringSuper.fighters.map((f) => [f.x, f.y, f.hp]),
    frozenSuper.fighters.map((f) => [f.x, f.y, f.hp]),
  );
  assert.ok(duringSuper.superFlash.scale < 1);
  assert.ok(!duringSuper.audio.announcements.includes("super"));
  await page.screenshot({ path: "artifacts/super-flash.png", fullPage: true });
  await advance(40);
  assert.equal((await state()).superFlash, null);
  assert.ok(
    (await state()).fighters[0].attackFrame >
      frozenSuper.fighters[0].attackFrame,
  );
  await togglePause();
  await click("battle-return");
  await click("home-link");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 2,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await advance(1);
  await page.screenshot({ path: "artifacts/mobile-menu.png", fullPage: true });
  await launch();
  assert.equal(await page.locator(".touch").isVisible(), true);
  const points = await page.evaluate(() => {
    const s = document.querySelector('#touch-dpad:not([hidden]), #touch-joystick:not([hidden])').getBoundingClientRect();
    const b = document.querySelector('[data-action="punch"]').getBoundingClientRect();
    const radius = Math.min(s.width, s.height) / 2;
    const rotated = document.body.classList.contains("mobile-portrait");
    return [
      { id: 1, x: s.x + s.width / 2 - (rotated ? radius * .7 : 0),
        y: s.y + s.height / 2 + (rotated ? 0 : radius * .7) },
      { id: 2, x: b.x + b.width / 2, y: b.y + b.height / 2 },
    ];
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points,
  });
  await advance(1);
  assert.equal((await state()).fighters[0].attack, "specialPunch");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await cdp.detach();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  // A real final KO must play the whole in-arena sequence before the modal.
  await togglePause();
  await click("battle-return");
  await click("home-link");
  await page.setViewportSize({ width: 1280, height: 900 });
  await launch({ mode: "watch", time: 0, wins: 1, stage: "sunset" });
  await page.locator("#arena").click({ position: { x: 15, y: 15 } });
  await page.waitForFunction(async () => {
    const s = (await import("./js/arena.js")).snapshot();
    return (
      s.audio.ready &&
      s.audio.voicesLoaded === 13 &&
      s.audio.combatSamplesLoaded === 27
    );
  });
  assert.equal((await state()).audio.track, "烈日决斗");
  for (let i = 0; i < 600 && !(await state()).finale; i++) await advance(30);
  s = await state();
  assert.ok(s.finale?.knockout, "AI match must reach a real KO");
  assert.equal(s.matchOver, false);
  assert.equal(await page.locator("#result-panel").isVisible(), false);
  const finalHP = s.fighters.map((fighter) => fighter.hp);
  await advance(Math.ceil((1.5 - s.finale.elapsed) * 60));
  s = await state();
  assert.equal(s.finale.stage, "ko");
  assert.equal(await page.locator("#result-panel").isVisible(), false);
  assert.deepEqual(
    s.fighters.map((fighter) => fighter.hp),
    finalHP,
  );
  assert.ok(s.audio.announcements.includes("ko"));
  await page.screenshot({
    path: "artifacts/ko-announcement.png",
    fullPage: true,
  });
  await advance(110);
  assert.equal((await state()).finale.stage, "winner");
  s = await state();
  assert.equal(
    s.audio.announcements.at(-1),
    s.finale.winnerIndex === 0 ? "p1win" : "p2win",
  );
  assert.equal(await page.locator("#result-panel").isVisible(), false);
  await page.screenshot({
    path: "artifacts/victory-announcement.png",
    fullPage: true,
  });
  await advance(125);
  assert.equal((await state()).matchOver, true);
  assert.equal(await page.locator("#result-panel").isVisible(), true);
  assert.equal((await state()).audio.stage, "result");
  assert.equal((await state()).audio.paused, false);
  await click("result-return");
  assert.equal((await state()).audio.stage, "selection");
  await click("home-link");
  assert.equal((await state()).audio.stage, "lobby");
  await launch({ mode: "cpu", time: 0, wins: 1 });
  await togglePause();
  assert.equal(
    (await state()).audio.paused,
    false,
    "pause keeps map BGM playing",
  );
  await togglePause();
  for (let i = 0; i < 900 && !(await state()).finale; i++) await advance(30);
  s = await state();
  assert.ok(s.finale?.knockout, "AI must defeat the idle human");
  assert.equal(s.finale.winnerIndex, 1);
  await advance(Math.ceil((3.3 - s.finale.elapsed) * 60));
  s = await state();
  assert.equal(s.finale.outcome.headline, "YOU LOSE");
  assert.equal(s.audio.announcements.at(-1), "loser");
  assert.ok(await page.evaluate(() => __drawnText.includes("YOU LOSE")));
  await page.screenshot({
    path: "artifacts/defeat-announcement.png",
    fullPage: true,
  });
  await advance(130);
  assert.equal((await state()).audio.stage, "result");
  await click("result-rematch");
  assert.equal((await state()).audio.stage, "sunset");
  assert.deepEqual(errors, []);
  console.log(
    "Browser QA passed: menus/maps/results BGM, pause/return/rematch audio, 13 announcer clips, watch winner and CPU loss announcements, menu flow, combat, both inputs and mobile touch.",
  );
} finally {
  await browser.close();
}
