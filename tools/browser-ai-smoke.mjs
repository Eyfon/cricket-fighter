import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const profile = path.resolve('artifacts/ai-chrome-profile');
await mkdir(profile, { recursive: true });
const port = 9351;
const child = spawn(process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + port, '--user-data-dir=' + profile, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let targets;
  for (let i = 0; i < 80; i++) {
    try { targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.ok(targets, 'Chrome starts');
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const pending = new Map(), errors = [];
  let sequence = 0;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const promise = pending.get(message.id); pending.delete(message.id);
      if (message.error) promise.reject(new Error(JSON.stringify(message.error))); else promise.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const run = (fn) => evaluate('(' + fn.toString() + ')()');
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 960, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: '(' + (() => {
    let callback, now = 1000;
    requestAnimationFrame = (fn) => { callback = fn; return 1; };
    window.advanceFrames = (count) => {
      for (let i = 0; i < count; i++) { now += 1000 / 60; const fn = callback; callback = null; fn?.(now); }
    };
  }).toString() + ')()' });
  const url = new URL(process.env.GAME_URL || 'http://127.0.0.1:5173/');
  url.searchParams.set('ai-qa', String(Date.now()));
  await send('Page.navigate', { url: url.href });
  for (let i = 0; i < 80; i++) {
    if (await run(() => document.readyState === 'complete' && !!document.querySelector('#p1 option'))) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const setup = await run(async () => {
    const { snapshot } = await import('./js/arena.js');
    const click = (id) => document.getElementById(id).click();
    const change = (id, value) => { const input = document.getElementById(id); input.value = value; input.dispatchEvent(new Event('change')); };
    click('play'); document.querySelector('[data-mode=watch]').click(); for (let pick = 0; pick < 3; pick++) click('characters-next');
    change('p1-difficulty', 'easy'); change('difficulty', 'hard'); change('wins-required', '1');
    advanceFrames(2);
    return { p1Visible: !document.getElementById('p1-ai-field').hidden, p2Visible: !document.getElementById('p2-ai-field').hidden,
      p1: document.getElementById('p1-difficulty').value, p2: document.getElementById('difficulty').value,
      saved: JSON.parse(localStorage.getItem('cricket-fighter-menu-v1')).rules, screen: snapshot().screen };
  });
  assert.ok(setup.p1Visible && setup.p2Visible);
  assert.equal(setup.saved.p1Difficulty, 'easy'); assert.equal(setup.saved.p2Difficulty, 'hard');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('artifacts/ai-difficulty-setup.png', Buffer.from(screenshot.data, 'base64'));
  const cases = await run(async () => {
    const { snapshot } = await import('./js/arena.js');
    const click = (id) => document.getElementById(id).click();
    const change = (id, value) => { const input = document.getElementById(id); input.value = value; input.dispatchEvent(new Event('change')); };
    const ready = async () => { for (let i = 0; i < 80 && !snapshot().visualsReady; i++) await new Promise((resolve) => setTimeout(resolve, 50)); };
    const observations = [];
    click('start'); await ready(); advanceFrames(500);
    observations.push({ kind: 'mixed-watch', state: snapshot() });
    const previousSeed = snapshot().config.seed;
    dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
    dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', key: 'Escape', bubbles: true }));
    click('restart');
    observations.push({ kind: 'rematch', previousSeed, state: snapshot() });
    for (const level of ['easy', 'normal', 'hard']) {
      click('home-link'); click('play'); document.querySelector('[data-mode=cpu]').click(); for (let pick = 0; pick < 3; pick++) click('characters-next');
      const visible = { p1: !document.getElementById('p1-ai-field').hidden, p2: !document.getElementById('p2-ai-field').hidden };
      change('difficulty', level); click('start'); await ready(); advanceFrames(600);
      observations.push({ kind: 'cpu', level, visible, state: snapshot() });
    }
    click('home-link'); click('play'); document.querySelector('[data-mode=local]').click(); for (let pick = 0; pick < 3; pick++) click('characters-next');
    observations.push({ kind: 'local', p1Hidden: document.getElementById('p1-ai-field').hidden, p2Hidden: document.getElementById('p2-ai-field').hidden });
    return observations;
  });
  const mixed = cases.find((item) => item.kind === 'mixed-watch').state;
  assert.equal(mixed.fighters[0].ai.difficulty, 'easy'); assert.equal(mixed.fighters[1].ai.difficulty, 'hard');
  assert.ok(mixed.fighters.some((fighter) => fighter.hp < fighter.maxHp), 'watch combat deals damage');
  const rematch = cases.find((item) => item.kind === 'rematch');
  assert.notEqual(rematch.previousSeed, rematch.state.config.seed);
  assert.equal(rematch.state.config.p1Difficulty, 'easy'); assert.equal(rematch.state.config.p2Difficulty, 'hard');
  for (const item of cases.filter((item) => item.kind === 'cpu')) {
    assert.equal(item.visible.p1, false); assert.equal(item.visible.p2, true);
    assert.equal(item.state.fighters[0].ai, null);
    assert.equal(item.state.fighters[1].ai.difficulty, item.level);
    assert.ok(item.state.fighters[0].hp < 100, item.level + ' CPU can approach and attack');
  }
  assert.ok(cases.find((item) => item.kind === 'local').p1Hidden);
  assert.ok(cases.find((item) => item.kind === 'local').p2Hidden);
  assert.deepEqual(errors, []);
  await writeFile('artifacts/ai-browser-check.json', JSON.stringify({ setup, cases, errors }, null, 2));
  console.log('AI browser QA passed: independent watch levels, saved settings, fresh rematch seed, all three CPU levels, local-mode controls and zero script errors.');
} finally {
  socket?.close(); child.kill();
}
