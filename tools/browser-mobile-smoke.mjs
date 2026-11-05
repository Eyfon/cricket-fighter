import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

await mkdir("artifacts", { recursive: true });
const port = 9353;
const chrome = spawn(process.env.CHROMIUM_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve("artifacts/mobile-chrome-profile")}`, "about:blank",
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
  const pending = new Map(), errors = [], networkErrors = [], results = [];
  let sequence = 0;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const p = pending.get(message.id); pending.delete(message.id);
      if (message.error) p.reject(new Error(JSON.stringify(message.error))); else p.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
    else if (message.method === "Network.responseReceived" && message.params.response.status >= 400)
      networkErrors.push(message.params.response.url);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const run = (fn) => evaluate(`(${fn.toString()})()`);
  const frames = (count) => evaluate(`advanceFrames(${count})`);
  const state = () => evaluate("import('./js/arena.js').then(m => m.snapshot())");
  const screenshot = async (name) => {
    const shot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(`artifacts/${name}.png`, Buffer.from(shot.data, "base64"));
  };
  const metrics = (width, height, mobile = true) => send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile,
    screenOrientation: { type: height > width ? "portraitPrimary" : "landscapePrimary", angle: height > width ? 0 : 90 },
  });
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  await metrics(390, 844);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  let initScript;
  initScript = await send("Page.addScriptToEvaluateOnNewDocument", { source: `(${(() => {
    localStorage.clear();
    let callback, now = 1000;
    requestAnimationFrame = (fn) => { callback = fn; return 1; };
    window.advanceFrames = (count) => {
      for (let i = 0; i < count; i++) { now += 1000 / 60; const fn = callback; callback = null; fn?.(now); }
    };
    window.fullscreenCalls = 0; window.lockCalls = [];
    // Exercise the unsupported-browser path explicitly; no fake native fullscreen.
    Element.prototype.requestFullscreen = async () => { fullscreenCalls++; throw new Error("unsupported in QA"); };
    screen.orientation.lock = async (value) => { lockCalls.push(value); throw new Error("unsupported in QA"); };
  }).toString()})()` });
  await send("Page.navigate", { url: process.env.GAME_URL || "http://127.0.0.1:5173/" });
  for (let i = 0; i < 100; i++) {
    if (await run(() => document.readyState === "complete" && !!document.querySelector("#p1 option"))) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const layout = () => run(() => {
    const rect = (selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return { mobile: document.body.classList.contains("mobile-device"), rotated: document.body.classList.contains("mobile-portrait"),
      app: rect(".app"), arena: rect("#arena"), touch: getComputedStyle(document.querySelector(".touch")).display,
      buttonCount: document.querySelectorAll(".touch [data-action]").length,
      toolbar: getComputedStyle(document.querySelector(".toolbar")).display,
      control: document.body.dataset.directionControl,
      backing: { width: document.getElementById("arena").width, height: document.getElementById("arena").height },
      fullscreenCalls, lockCalls };
  });
  let view = await layout();
  assert.ok(view.mobile && view.rotated); assert.equal(view.buttonCount, 6);
  assert.ok(Math.abs(view.app.width - 390) < 1 && Math.abs(view.app.height - 844) < 1);
  assert.ok(await run(() => document.querySelector(".home-copy").offsetWidth > 700), "home uses the full logical landscape width");
  await screenshot("mobile-portrait-menu");
  await run(() => {
    document.getElementById("training").click();
    document.getElementById("characters-next").click();
    document.getElementById("training-energy").checked = true;
    document.getElementById("start").click();
  });
  for (let i = 0; i < 100 && !(await state()).visualsReady; i++) await new Promise((r) => setTimeout(r, 50));
  await frames(150);
  view = await layout();
  assert.equal(view.touch, "block"); assert.equal(view.toolbar, "none");
  assert.equal(view.arena.width, 390); assert.equal(view.arena.height, 844);
  assert.equal(view.control, "joystick", "fresh mobile settings default to joystick");
  assert.ok(Math.abs(view.backing.width / view.backing.height - 844 / 390) < .006, "actual drawing fills canvas without letterboxing");
  assert.ok(view.fullscreenCalls > 0 && view.lockCalls.includes("landscape"));
  const points = (dx = 0, dy = 0, action = null) => evaluate(`(${((dx, dy, action) => {
    const r = document.querySelector('#touch-dpad:not([hidden]), #touch-joystick:not([hidden])').getBoundingClientRect();
    const rotated = document.body.classList.contains("mobile-portrait");
    const radius = Math.min(r.width, r.height) / 2;
    const points = [{ id: 1, x: r.x + r.width / 2 + (rotated ? -dy : dx) * radius,
      y: r.y + r.height / 2 + (rotated ? dx : dy) * radius }];
    if (action) {
      const b = document.querySelector(`[data-action="${action}"]`).getBoundingClientRect();
      points.push({ id: 2, x: b.x + b.width / 2, y: b.y + b.height / 2 });
    }
    return points;
  }).toString()})(${dx},${dy},${JSON.stringify(action)})`);
  const setControl = (value) => evaluate(`(${((value) => {
    const select = document.getElementById("direction-control");
    select.value = value; select.dispatchEvent(new Event("input"));
  }).toString()})(${JSON.stringify(value)})`);
  await setControl("dpad");
  let touchActive = false;
  const startTouch = async (dx, dy, action) => {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: await points(dx, dy, action) });
    touchActive = true;
  };
  const endTouch = async () => {
    if (touchActive) await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    touchActive = false;
  };
  const restart = async () => { await endTouch(); await run(() => document.getElementById("restart").click()); await frames(150); };

  // Actual CDP multi-touch, including the 90-degree portrait transformation.
  await startTouch(-0.7, 0.7); await frames(2);
  assert.equal((await state()).fighters[0].crouchGuard, true);
  await screenshot("mobile-portrait-crouch");
  await endTouch(); await frames(2);
  assert.equal((await state()).fighters[0].guard, false);
  await startTouch(-0.8, 0); await frames(10);
  assert.ok((await state()).fighters[0].x < 250, "dpad retreats");
  await restart();
  for (const [dx, dy, action, expected] of [
    [0, 0, "punch", "punch"], [0, 0, "kick", "kick"],
    [0.8, 0, "punch", "forwardPunch"], [0.8, 0, "kick", "forwardKick"],
    [0, 0.8, "punch", "specialPunch"], [0, 0.8, "kick", "specialKick"],
    [0, 0, "skill", "skill"], [0, 0, "skill2", "skill2"], [0, 0, "super", "super"],
  ]) {
    await startTouch(dx, dy, action); await frames(1);
    const s = await state();
    assert.equal(s.fighters[0].attack, expected, `touch ${expected}`);
    results.push({ action: expected, state: s.fighters[0].state });
    await restart();
  }
  await startTouch(0.8, 0, "dodge"); await frames(2);
  assert.ok((await state()).fighters[0].dodgeTimer > 0);
  await restart();
  await startTouch(0.7, -0.7); await frames(5);
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: await points(0.7, -0.7, "punch") });
  await frames(1);
  assert.equal((await state()).fighters[0].attack, "punch", "jump forward plus punch stays an aerial normal");
  await restart();

  // Natural landscape drops the rotation; canvas still occupies the entire window.
  await metrics(844, 390); await new Promise((r) => setTimeout(r, 150));
  view = await layout(); assert.equal(view.rotated, false);
  assert.equal(view.arena.width, 844); assert.equal(view.arena.height, 390);
  await screenshot("mobile-landscape-battle");
  await startTouch(-0.7, 0.7); await frames(2);
  assert.equal((await state()).fighters[0].crouchGuard, true);
  await run(() => document.getElementById("mobile-pause").click());
  assert.equal((await state()).paused, true);
  await run(() => document.getElementById("resume").click());
  await frames(2);
  assert.equal((await state()).fighters[0].guard, false, "pause clears held fingers");
  await endTouch();
  await restart();
  await startTouch(0, 0, "punch"); await endTouch(); await frames(1);
  assert.equal((await state()).fighters[0].attack, "punch", "very quick touch is not lost between simulation frames");
  await restart();
  await startTouch(0, 0, "punch");
  await send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  touchActive = false;
  await frames(1);
  assert.equal((await state()).fighters[0].attack, null, "cancelled touch has no ghost attack");

  // Slide between pad cells while captured, and combine separate direction fingers.
  await restart();
  await startTouch(-.7, 0); await frames(2);
  await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: await points(-.7, .7) });
  await frames(2); assert.equal((await state()).fighters[0].crouchGuard, true);
  await endTouch();
  const leftFinger = (await points(-.7, 0))[0];
  const downFinger = { ...(await points(0, .7))[0], id: 3 };
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [leftFinger, downFinger] });
  touchActive = true;
  await frames(2); assert.equal((await state()).fighters[0].crouchGuard, true);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [downFinger] });
  await frames(2); assert.equal((await state()).fighters[0].crouchGuard, false);
  await endTouch();

  await restart(); await startTouch(-.7, .7); await frames(2);
  await setControl("joystick"); await frames(2);
  assert.equal((await state()).fighters[0].guard, false, "switching clears held directions");
  await endTouch();
  assert.equal(await run(() => JSON.parse(localStorage.getItem("cricket-fighter-menu-v1")).options.directionControl), "joystick");
  await startTouch(-.7, .7); await frames(2);
  assert.equal((await state()).fighters[0].crouchGuard, true, "optional joystick works");
  await endTouch(); await restart();
  await startTouch(.8, 0, "punch"); await frames(1);
  assert.equal((await state()).fighters[0].attack, "forwardPunch");
  await endTouch(); await setControl("dpad"); await restart();

  // Smaller phones retain touch targets and reachable menu navigation.
  for (const [width, height] of [[667, 375], [568, 320], [915, 412]]) {
    await metrics(width, height); await new Promise((r) => setTimeout(r, 100));
    const bounds = await run(() => [...document.querySelectorAll(".touch [data-action], #touch-dpad:not([hidden]) button, #touch-joystick:not([hidden])")].map((e) => {
      const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    }));
    assert.ok(bounds.every((r) => r.x >= 0 && r.y >= 0 && r.right <= width && r.bottom <= height && r.width >= 44 && r.height >= 44));
  }
  await metrics(568, 320); await new Promise((r) => setTimeout(r, 100));
  const menus = await run(() => {
    const click = (id) => document.getElementById(id).click();
    const app = document.querySelector(".app"), out = [];
    const check = (name) => out.push({ name, width: app.clientWidth, scrollWidth: app.scrollWidth });
    click("home-link"); check("home"); click("play"); check("mode");
    document.querySelector("[data-mode=cpu]").click(); check("characters");
    click("characters-next"); check("setup");
    click("home-link"); document.querySelector('[data-go="options"]').click(); check("options");
    click("home-link"); document.querySelector('[data-go="gallery"]').click(); check("gallery");
    return out;
  });
  assert.ok(menus.every((m) => m.scrollWidth <= m.width + 1), JSON.stringify(menus));
  await frames(2);
  await screenshot("mobile-small-gallery");
  await run(() => {
    document.getElementById("home-link").click(); document.getElementById("play").click();
    document.querySelector("[data-mode=watch]").click();
    document.getElementById("characters-next").click(); document.getElementById("start").click();
  });
  assert.equal((await layout()).touch, "none", "watch hides touch controls");
  await metrics(720, 600, false);
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await run(() => { document.getElementById("home-link").click(); document.getElementById("training").click(); document.getElementById("characters-next").click(); document.getElementById("start").click(); });
  await new Promise((r) => setTimeout(r, 100));
  view = await layout();
  assert.equal(view.mobile, false); assert.equal(view.touch, "none", "small desktop has no automatic touch overlay");
  await frames(2);
  assert.ok(Math.abs(view.backing.width / view.backing.height - 720 / 600) < .003, "desktop also fills tall windows");
  await screenshot("desktop-adaptive-battle");
  for (const option of ["always", "never", "auto"]) {
    await evaluate(`(${((option) => {
      document.getElementById("home-link").click();
      document.querySelector('[data-go="options"]').click();
      const select = document.getElementById("touch-option"); select.value = option;
      select.dispatchEvent(new Event("input"));
      document.getElementById("home-link").click(); document.getElementById("training").click();
      document.getElementById("characters-next").click(); document.getElementById("start").click();
    }).toString()})(${JSON.stringify(option)})`);
    assert.equal((await layout()).touch, option === "always" ? "block" : "none", `${option} touch preference`);
  }
  // A real navigation reload must restore the chosen control from browser storage.
  await setControl("joystick");
  await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: initScript.identifier });
  await send("Page.reload", { ignoreCache: true });
  for (let i = 0; i < 100; i++) {
    if (await run(() => document.readyState === "complete" && document.body.dataset.directionControl === "joystick")) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal(await run(() => document.body.dataset.directionControl), "joystick");
  await run(() => {
    document.querySelector('[data-go="options"]').click();
    document.getElementById("reset-options").click();
  });
  assert.equal(await run(() => document.getElementById("direction-control").value), "joystick");
  assert.equal(await run(() => JSON.parse(localStorage.getItem("cricket-fighter-menu-v1")).options.directionControl), "joystick");
  assert.deepEqual(errors, []); assert.deepEqual(networkErrors, []);
  await writeFile("artifacts/mobile-browser-check.json", JSON.stringify({ results, desktop: view, errors, networkErrors }, null, 2));
  console.log("Mobile browser QA passed: portrait fallback, landscape full canvas, eight directions, six keys, four directional attacks, aerial attack, multi-touch, pause cleanup, phone sizes, watch and desktop visibility; no resource or runtime errors.");
} finally { socket?.close(); chrome.kill(); }
