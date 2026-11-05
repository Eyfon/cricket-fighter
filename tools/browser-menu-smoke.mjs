import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

await mkdir("artifacts", { recursive: true });
const port = 9355;
const chrome = spawn(process.env.CHROMIUM_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve("artifacts/menu-chrome-profile")}`, "about:blank",
], { windowsHide: true, stdio: "ignore" });
let socket;
try {
  let targets;
  for (let i = 0; i < 80; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; }
    catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  assert.ok(targets, "Chrome starts");
  socket = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const pending = new Map(), errors = [];
  let sequence = 0;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const p = pending.get(message.id); pending.delete(message.id);
      if (message.error) p.reject(new Error(JSON.stringify(message.error))); else p.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
    else if (message.method === "Network.responseReceived" && message.params.response.status >= 400)
      errors.push(`${message.params.response.status} ${message.params.response.url}`);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const run = (fn) => evaluate(`(${fn.toString()})()`);
  const settle = () => new Promise((r) => setTimeout(r, 230));
  const click = async (selector) => { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await settle(); };
  const key = async (name) => {
    const windowsVirtualKeyCode = { Enter: 13, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 }[name];
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: name, code: name, windowsVirtualKeyCode, ...(name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code: name, windowsVirtualKeyCode });
    await settle();
  };
  const screenshot = async (name) => {
    const shot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(`artifacts/${name}.png`, Buffer.from(shot.data, "base64"));
  };
  const metrics = async (width, height, mobile) => {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    await send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
    await settle();
  };
  const fits = async (selector) => {
    const result = await evaluate(`(() => {
      const app=document.querySelector('.app'), el=document.querySelector(${JSON.stringify(selector)}), r=el.getBoundingClientRect();
      return {name:document.body.dataset.screen,app:{w:app.clientWidth,h:app.clientHeight,sw:app.scrollWidth,sh:app.scrollHeight},
        element:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height},w:innerWidth,h:innerHeight};
    })()`);
    assert.ok(result.app.sw <= result.app.w + 1 && result.app.sh <= result.app.h + 1, JSON.stringify(result));
    assert.ok(result.element.x >= 0 && result.element.y >= 0 && result.element.right <= result.w + 1 && result.element.bottom <= result.h + 1, JSON.stringify(result));
    return result;
  };
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "localStorage.clear();" });
  await metrics(1440, 900, false);
  await send("Page.navigate", { url: process.env.GAME_URL || "http://127.0.0.1:5173/" });
  for (let i = 0; i < 100; i++) {
    if (await run(() => document.readyState === "complete" && !!document.querySelector("#p1 option"))) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await settle();
  assert.equal(await run(() => document.querySelector(".app-header").getClientRects().length), 0);
  assert.equal(await run(() => document.querySelectorAll(".keyboard-hints,.touch-hints").length), 0);
  assert.equal(await run(() => document.querySelectorAll(".game-command-bar").length), 0);
  await fits("#play"); await screenshot("game-menu-desktop-home");
  await key("ArrowDown");
  assert.equal(await run(() => document.querySelector(".home-menu .is-highlighted").id), "training");
  await key("ArrowUp"); await key("Enter");
  assert.equal(await run(() => document.body.dataset.screen), "mode");
  await fits('[data-mode="local"]'); await screenshot("game-menu-desktop-modes");
  await key("ArrowRight"); await key("Enter");
  assert.equal(await run(() => document.getElementById("mode").value), "cpu");
  await key("Escape"); assert.equal(await run(() => document.body.dataset.screen), "mode");
  await key("Escape"); assert.equal(await run(() => document.body.dataset.screen), "home");
  await click('[data-go="options"]'); await fits("#reset-options"); await screenshot("game-menu-desktop-options");
  // Options use the same arrow buttons as match rules, with native values retained internally.
  assert.ok(await run(() => [...document.querySelectorAll('.options-grid select, .options-grid input')].every(el => !el.getClientRects().length)));
  await click('[data-rule="direction-control"][data-rule-step="1"]');
  assert.equal(await run(() => document.body.dataset.directionControl), "dpad");
  assert.equal(await run(() => JSON.parse(localStorage.getItem("cricket-fighter-menu-v1")).options.directionControl), "dpad");
  await run(() => document.querySelector('[data-rule="direction-control"][data-rule-step="-1"]').focus()); await key("Enter");
  assert.equal(await run(() => document.body.dataset.directionControl), "joystick");
  await click('[data-rule="volume"][data-rule-step="1"]');
  assert.equal(await run(() => document.getElementById("volume-value").value), "55%");
  await click('[data-rule="muted"][data-rule-step="1"]');
  assert.equal(await run(() => JSON.parse(localStorage.getItem("cricket-fighter-menu-v1")).options.muted), true);
  await click('#reset-options');
  assert.equal(await run(() => document.getElementById("volume-value").value), "50%");
  assert.equal(await run(() => document.getElementById("muted-value").value), "关闭");
  assert.equal(await run(() => document.body.dataset.screen), "options");
  await run(() => document.activeElement.blur()); await key("Escape");
  await click('[data-go="gallery"]'); await screenshot("game-menu-desktop-gallery");
  await key("Enter"); assert.equal(await run(() => document.body.dataset.screen), "character-detail");
  await fits(".detail-grid"); await screenshot("game-menu-desktop-details");
  await key("Escape"); assert.equal(await run(() => document.body.dataset.screen), "gallery");

  for (const [width, height] of [[844, 390], [932, 430], [960, 432], [568, 320]]) {
    await metrics(width, height, true);
    await click("#home-link"); await fits("#play"); await screenshot(`game-menu-${width}-home`);
    await click("#play"); await fits('[data-mode="cpu"]'); await screenshot(`game-menu-${width}-modes`);
    const cards = await run(() => ({ height: document.querySelector('.mode-grid').offsetHeight, gameHeight: document.querySelector('.app').clientHeight }));
    assert.ok(cards.height <= cards.gameHeight * .67, JSON.stringify(cards));
    assert.equal(await run(() => document.querySelector('[data-mode="local"]').getClientRects().length), 0);
    await click('[data-mode="watch"]');
    await fits("#characters-next"); await screenshot(`game-menu-${width}-draft`);
    for (let i = 0; i < 3; i++) await click("#characters-next");
    const setup = await run(() => {
      const rail = document.getElementById("map-list"), scene = document.getElementById("map-scene");
      const full = document.getElementById("mobile-fullscreen").getBoundingClientRect();
      const back = document.querySelector('.setup-screen .back').getBoundingClientRect();
      const image = document.getElementById("map-image");
      return { rail: { h: rail.clientHeight, scroll: rail.scrollHeight, direction: getComputedStyle(rail).flexDirection },
        scene: { w: scene.clientWidth, h: scene.clientHeight }, imageFit: getComputedStyle(image).objectFit,
        overlap: full.left < back.right && full.right > back.left && full.top < back.bottom && full.bottom > back.top,
        selects: [...document.querySelectorAll('.setup-screen select')].every(el => !el.getClientRects().length) };
    });
    assert.equal(setup.rail.direction, "column");
    assert.ok(setup.rail.scroll > setup.rail.h, "map rail scrolls vertically on phones");
    assert.ok(setup.scene.h >= 90 && setup.scene.w >= 130, JSON.stringify(setup));
    assert.equal(setup.imageFit, "contain");
    assert.equal(setup.overlap, false, "fullscreen and back have separate touch targets");
    assert.ok(setup.selects, "setup exposes buttons instead of native option sheets");
    const railBox = await run(() => {
      const e = document.getElementById("map-list"); e.scrollTop = 0;
      const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, top: r.top + 12, bottom: r.bottom - 12 };
    });
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: railBox.x, y: railBox.bottom, id: 1 }] });
    for (let step = 1; step <= 8; step++) {
      await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: railBox.x, y: railBox.bottom + (railBox.top - railBox.bottom) * step / 8, id: 1 }] });
    }
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    assert.ok(await run(() => document.getElementById("map-list").scrollTop > 10), "map rail supports landscape touch dragging");
    await click('[data-rule="health-multiplier"][data-rule-step="1"]');
    assert.deepEqual(await run(() => [...document.querySelectorAll('[data-rule="health-multiplier"]')].map(el => el.textContent)), ['<', '>']);
    assert.equal(await run(() => document.getElementById("health-multiplier-value").value), "2 倍");
    assert.equal(await run(() => JSON.parse(localStorage.getItem("cricket-fighter-menu-v1")).rules.healthMultiplier), 2);
    await click('[data-rule="health-multiplier"][data-rule-step="-1"]');
    assert.equal(await run(() => document.querySelector('[data-rule="health-multiplier"][data-rule-step="-1"]').disabled), true);
    await click('[data-rule="round-time"][data-rule-step="1"]');
    await click('[data-rule="round-time"][data-rule-step="1"]');
    assert.equal(await run(() => document.getElementById("round-time-value").value), "无限时间");
    assert.equal(await run(() => document.querySelector('[data-rule="round-time"][data-rule-step="1"]').disabled), true);
    await click("#reset-rules");
    await run(() => document.getElementById("map-list").scrollTop = 9999);
    await click('[data-map="training"]');
    assert.equal(await run(() => document.getElementById("map-name").textContent), "训练空间");
    assert.equal(await run(() => document.getElementById("map-image").hidden), true);
    await click("#random-map");
    await click("#reset-rules");
    await run(() => document.getElementById("map-list").scrollTop = 0);
    await fits("#start"); await screenshot(`game-menu-${width}-stage`);
    await click("#home-link"); await click('[data-go="options"]');
    await click('[data-rule="direction-control"][data-rule-step="1"]');
    assert.equal(await run(() => document.body.dataset.directionControl), "dpad");
    await click('#reset-options');
    await fits(".options-grid"); await screenshot(`game-menu-${width}-options`);
    await click("#home-link"); await click('[data-go="gallery"]');
    await fits(".gallery-grid"); await screenshot(`game-menu-${width}-gallery`);
  }
  assert.deepEqual(errors, []);
  console.log("Game menu QA passed: keyboard menus, arrow settings with persistence/reset, archive details, full viewport menus at desktop and four phone sizes including 19.5:9 and 20:9; no runtime/resource errors.");
} finally { socket?.close(); chrome.kill(); }
