import { bindings } from "./input.js";

// Screen coordinates must follow the CSS landscape fallback, including diagonals.
export function joystickVector(dx, dy, radius, rotated = false) {
  if (rotated) [dx, dy] = [dy, -dx];
  const distance = Math.hypot(dx, dy);
  const scale = Math.min(1, radius / (distance || 1));
  const x = dx * scale, y = dy * scale;
  if (distance < radius * 0.22) return { x, y, actions: [] };
  const angle = Math.atan2(y, x), threshold = Math.sin(Math.PI / 8);
  const actions = [];
  if (Math.cos(angle) > threshold) actions.push("right");
  if (Math.cos(angle) < -threshold) actions.push("left");
  if (Math.sin(angle) > threshold) actions.push("guard");
  if (Math.sin(angle) < -threshold) actions.push("up");
  return { x, y, actions };
}

// A square 3 × 3 pad: the center is neutral, corners hold two directions.
export function dpadVector(dx, dy, radius, rotated = false) {
  if (rotated) [dx, dy] = [dy, -dx];
  const actions = [];
  if (dx > radius / 3) actions.push("right");
  if (dx < -radius / 3) actions.push("left");
  if (dy > radius / 3) actions.push("guard");
  if (dy < -radius / 3) actions.push("up");
  return actions;
}

// Separate from physical keys: releasing a finger must not release a keyboard key.
export class PointerKeys {
  constructor() { this.pointers = new Map(); this.pending = new Map(); }
  set(id, codes, latch = true) {
    const previous = this.pointers.get(id) || [];
    if (latch) this.pending.set(id, [...new Set([
      ...(this.pending.get(id) || []), ...codes.filter((code) => !previous.includes(code)),
    ])]);
    this.pointers.set(id, codes);
  }
  release(id, cancelled = false) {
    this.pointers.delete(id);
    if (cancelled) this.pending.delete(id);
  }
  sample() {
    const codes = new Set([...this.pending.values(), ...this.pointers.values()].flat());
    this.pending.clear();
    return codes;
  }
  clear() { this.pointers.clear(); this.pending.clear(); }
}

export function createMobileControls({ canInput, onPause }) {
  const body = document.body, app = document.querySelector(".app");
  const panel = document.querySelector(".touch");
  const stick = document.getElementById("touch-joystick");
  const pad = document.getElementById("touch-dpad");
  const directionButtons = [...pad.querySelectorAll("[data-directions]")];
  const buttons = [...panel.querySelectorAll("[data-action]")];
  const fullscreen = document.getElementById("mobile-fullscreen");
  const pause = document.getElementById("mobile-pause");
  const notice = document.getElementById("mobile-notice");
  const coarse = matchMedia("(pointer: coarse)");
  const state = new PointerKeys(), binding = bindings[0];
  const padDirections = new Map();
  let stickId = null, rotated = false, noticeTimer, fullscreenRequest = null, directionControl;
  const mobile = () => coarse.matches && navigator.maxTouchPoints > 0;
  const enabled = () => canInput() && !panel.hidden && body.dataset.touch !== "never";
  function clear() {
    state.clear(); padDirections.clear(); stickId = null;
    for (const button of [...buttons, ...directionButtons]) button.classList.remove("held");
    stick.classList.remove("held");
    stick.style.setProperty("--stick-x", "0px");
    stick.style.setProperty("--stick-y", "0px");
    for (const element of [stick, pad, ...buttons]) {
      for (const id of element._pointers || []) {
        if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
      }
      element._pointers?.clear();
    }
  }
  function refresh() {
    const nextControl = body.dataset.directionControl === "joystick" ? "joystick" : "dpad";
    if (directionControl !== nextControl) clear();
    directionControl = nextControl;
    stick.hidden = directionControl !== "joystick";
    pad.hidden = directionControl !== "dpad";
    const isMobile = mobile();
    const width = window.visualViewport?.width || innerWidth;
    const height = window.visualViewport?.height || innerHeight;
    const nextRotated = isMobile && height > width;
    if (rotated !== nextRotated) clear();
    rotated = nextRotated;
    body.classList.toggle("mobile-device", isMobile);
    body.classList.toggle("mobile-portrait", rotated);
    const w = isMobile ? Math.max(width, height) : width;
    const h = isMobile ? Math.min(width, height) : height;
    app.style.setProperty("--game-width", `${w}px`);
    app.style.setProperty("--game-height", `${h}px`);
    app.style.setProperty("--view-width", `${width}px`);
    app.style.setProperty("--view-height", `${height}px`);
    app.style.setProperty("--view-left", `${window.visualViewport?.offsetLeft || 0}px`);
    app.style.setProperty("--view-top", `${window.visualViewport?.offsetTop || 0}px`);
    panel.hidden = body.dataset.screen !== "battle" || body.dataset.mode === "watch";
    pause.hidden = body.dataset.screen !== "battle";
    body.classList.toggle("touch-visible", !panel.hidden &&
      body.dataset.touch !== "never" && (isMobile || body.dataset.touch === "always"));
    panel.classList.toggle("touch-blocked", !canInput());
    if (!enabled()) clear();
    fullscreen.setAttribute("aria-label", document.fullscreenElement ? "退出全屏" : "横屏全屏");
  }
  async function requestLandscape() {
    if (!mobile()) return false;
    if (fullscreenRequest) return fullscreenRequest;
    fullscreenRequest = (async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
        }
      } catch { /* CSS rotation still provides the landscape layout. */ }
      try { await screen.orientation?.lock?.("landscape"); } catch { /* Safari / windowed tabs. */ }
      refresh();
      return !!document.fullscreenElement;
    })();
    try { return await fullscreenRequest; } finally { fullscreenRequest = null; }
  }
  fullscreen.onclick = async () => {
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* Keep the playable layout. */ }
    } else if (!await requestLandscape()) {
      notice.textContent = "已使用横屏布局；旋转手机可获得更大画面。浏览器全屏不可用时可添加到主屏幕。";
      notice.hidden = false;
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => { notice.hidden = true; }, 4500);
    }
  };
  pause.onclick = onPause;
  document.addEventListener("click", (event) => {
    if (event.target.closest("#play, #training, #start, #restart, #result-rematch, [data-mode]"))
      void requestLandscape();
  }, { capture: true });
  function capture(element, event) {
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    element._pointers ||= new Set();
    element._pointers.add(event.pointerId);
  }
  const moveStick = (event) => {
    const rect = stick.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) / 2;
    const vector = joystickVector(event.clientX - rect.left - rect.width / 2,
      event.clientY - rect.top - rect.height / 2, radius, rotated);
    state.set(event.pointerId, vector.actions.map((action) => binding[action]), false);
    stick.style.setProperty("--stick-x", `${vector.x * 0.55}px`);
    stick.style.setProperty("--stick-y", `${vector.y * 0.55}px`);
  };
  stick.addEventListener("pointerdown", (event) => {
    if (!enabled() || directionControl !== "joystick" || stickId !== null) return;
    capture(stick, event); stickId = event.pointerId;
    stick.classList.add("held"); moveStick(event);
  });
  stick.addEventListener("pointermove", (event) => {
    if (event.pointerId !== stickId) return;
    event.preventDefault(); moveStick(event);
  });
  function paintPad() {
    const held = new Set([...padDirections.values()].flat());
    for (const button of directionButtons)
      button.classList.toggle("held", button.dataset.directions.split(" ").every((action) => held.has(action)));
  }
  function movePad(event) {
    const rect = pad.getBoundingClientRect();
    const actions = dpadVector(event.clientX - rect.left - rect.width / 2,
      event.clientY - rect.top - rect.height / 2, Math.min(rect.width, rect.height) / 2, rotated);
    padDirections.set(event.pointerId, actions);
    state.set(event.pointerId, actions.map((action) => binding[action]), false);
    paintPad();
  }
  pad.addEventListener("pointerdown", (event) => {
    if (!enabled() || directionControl !== "dpad") return;
    capture(pad, event); movePad(event);
  });
  pad.addEventListener("pointermove", (event) => {
    if (!padDirections.has(event.pointerId)) return;
    event.preventDefault(); movePad(event);
  });
  for (const button of buttons) button.addEventListener("pointerdown", (event) => {
    if (!enabled()) return;
    capture(button, event);
    state.set(event.pointerId, [binding[button.dataset.action]]);
    button.classList.add("held");
  });
  for (const element of [stick, pad, ...buttons]) {
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      element.addEventListener(type, (event) => {
        state.release(event.pointerId, type === "pointercancel");
        if (padDirections.delete(event.pointerId)) paintPad();
        element._pointers?.delete(event.pointerId);
        if (!element._pointers?.size) element.classList.remove("held");
        if (event.pointerId === stickId) {
          stickId = null;
          stick.style.setProperty("--stick-x", "0px");
          stick.style.setProperty("--stick-y", "0px");
        }
      });
    }
    element.addEventListener("contextmenu", (event) => event.preventDefault());
  }
  window.addEventListener("resize", refresh);
  window.visualViewport?.addEventListener("resize", refresh);
  window.visualViewport?.addEventListener("scroll", refresh);
  coarse.addEventListener("change", refresh);
  document.addEventListener("fullscreenchange", () => { clear(); refresh(); });
  new MutationObserver(refresh).observe(body, {
    attributes: true, attributeFilter: ["data-screen", "data-mode", "data-touch", "data-direction-control"],
  });
  refresh();
  return { clear, refresh, sample: () => enabled() ? state.sample() : new Set() };
}
