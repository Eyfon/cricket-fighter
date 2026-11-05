import { maps } from "./maps.js";
import { AI_PROFILES } from "./ai-profiles.js";
import { assetUrl } from "./asset-url.js";
import {
  DEFAULT_RULES,
  DEFAULT_OPTIONS,
  normalizeRules,
  normalizeOptions,
  loadPreferences,
  savePreferences,
} from "./settings.js";
import { MOVE_SLOTS } from "./character-schema.js";
export function createMenu({ roster, onStart, onLeave, onOptions, onScreen }) {
  const $ = (id) => document.getElementById(id),
    saved = loadPreferences();
  let screen = "home",
    options = normalizeOptions(saved.options),
    rules = normalizeRules(saved.rules),
    lastMatch = null,
    activeCharacter = roster[0].id;
  if (saved.audioDefaultsVersion !== 2) options.muted = false;
  if (saved.directionControlVersion !== 1) options.directionControl = "joystick";
  const modeNames = {
    watch: "电子斗蛐蛐 · AI vs AI",
    cpu: "单人挑战 · 1P vs AI",
    local: "本地双人 · 1P vs 2P",
    training: "练习模式",
  };
  const validId = (id, fallback) =>
    roster.some((c) => c.id === id) ? id : fallback;
  $("p1").value = validId(saved.p1, roster[0].id);
  $("p2").value = validId(saved.p2, roster[1]?.id || roster[0].id);
  $("mode").value = ["watch", "cpu", "local"].includes(saved.mode)
    ? saved.mode
    : "watch";
  let pickTurn = "p1";
  const lockedPicks = { p1: false, p2: false };
  function renderDraft() {
    $("selection-arena").dataset.turn = pickTurn || "ready";
    for (const side of ["p1", "p2"]) {
      const character = roster.find((c) => c.id === $(side).value);
      $(side + "-name").textContent = character.name;
      const panel = document.querySelector(`[data-player="${side}"]`);
      panel.classList.toggle("is-active", pickTurn === side);
      panel.classList.toggle("is-locked", lockedPicks[side]);
      const edit = panel.querySelector("[data-edit-pick]");
      edit.disabled = !lockedPicks[side];
      edit.textContent = lockedPicks[side] ? "已锁定 · 重选 ↻" : pickTurn === side ? "正在选择" : "等待选择";
      const mode = $("mode").value;
      $(side + "-controller").textContent = mode === "watch" || (mode === "cpu" && side === "p2")
        ? "电脑" : mode === "training" && side === "p2" ? "练习对手" : "玩家";
    }
    $("draft-turn").textContent = pickTurn ? `${pickTurn === "p1" ? "1P" : "2P"} 选择出战角色` : "双方就绪";
    $("draft-hint").textContent = pickTurn ? "点击角色预览，再确认出战" : "前往选择地图与对战规则";
    $("characters-next").textContent = pickTurn ? `锁定 ${pickTurn === "p1" ? "1P" : "2P"} 角色 →` : "选择地图 →";
    $("random-fighter").disabled = !pickTurn;
    document.querySelectorAll("[data-roster-id]").forEach((card) => {
      card.disabled = !pickTurn;
      card.setAttribute("aria-pressed", !!pickTurn && card.dataset.rosterId === $(pickTurn).value);
      for (const side of ["p1", "p2"]) {
        const mark = card.querySelector(`[data-pick-marker="${side}"]`);
        mark.hidden = card.dataset.rosterId !== $(side).value;
        mark.textContent = `${side === "p1" ? "1P" : "2P"}${lockedPicks[side] ? " ✓" : ""}`;
      }
    });
  }
  function previewPick(id) {
    if (!pickTurn) return;
    $(pickTurn).value = id;
    refreshCharacters();
  }
  $("roster-count").textContent = `${String(roster.length).padStart(2, "0")} FIGHTERS`;
  for (const character of roster) {
    const card = document.createElement("button");
    card.className = "roster-card";
    card.dataset.rosterId = character.id;
    card.setAttribute("aria-label", `选择${character.name}`);
    const canvas = document.createElement("canvas");
    canvas.id = "pool-preview-" + character.id;
    canvas.width = 240;
    canvas.height = 260;
    canvas.setAttribute("aria-hidden", "true");
    const name = document.createElement("strong");
    name.textContent = character.name;
    const marks = document.createElement("span");
    marks.className = "pick-markers";
    for (const side of ["p1", "p2"]) {
      const mark = document.createElement("span");
      mark.dataset.pickMarker = side;
      marks.append(mark);
    }
    card.append(canvas, name, marks);
    card.onclick = () => previewPick(character.id);
    $("roster-pool").append(card);
  }
  $("roster-pool").addEventListener("keydown", (event) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!pickTurn || !delta) return;
    event.preventDefault();
    const index = roster.findIndex((c) => c.id === $(pickTurn).value);
    const character = roster[(index + delta + roster.length) % roster.length];
    previewPick(character.id);
    [...$("roster-pool").children].find((c) => c.dataset.rosterId === character.id).focus({ preventScroll: true });
  });
  $("random-fighter").onclick = () => previewPick(roster[Math.floor(Math.random() * roster.length)].id);
  document.querySelectorAll("[data-edit-pick]").forEach((button) => {
    button.onclick = () => {
      pickTurn = button.dataset.editPick;
      lockedPicks[pickTurn] = false;
      renderDraft();
    };
  });
  function persist() {
    savePreferences({
      rules,
      options,
      audioDefaultsVersion: 2,
      directionControlVersion: 1,
      p1: $("p1").value,
      p2: $("p2").value,
      mode: $("mode").value,
    });
  }
  function readRules() {
    rules = normalizeRules({
      time: $("mode").value === "training" ? rules.time : $("round-time").value,
      wins: $("wins-required").value,
      healthMultiplier: $("health-multiplier").value,
      difficulty: $("difficulty").value,
      p1Difficulty: $("p1-difficulty").value,
      p2Difficulty: $("difficulty").value,
      stage: rules.stage,
    });
  }
  function renderRules() {
    $("round-time").value = $("mode").value === "training" ? 0 : rules.time;
    $("wins-required").value = rules.wins;
    $("health-multiplier").value = rules.healthMultiplier;
    $("difficulty").value = rules.p2Difficulty;
    $("p1-difficulty").value = rules.p1Difficulty;
    const training = $("mode").value === "training";
    $("training-settings").hidden = !training;
    $("round-time").disabled = training;
    $("wins-required").disabled = training;
    $("difficulty").disabled = ["local", "training"].includes($("mode").value);
    $("p1-ai-field").hidden = $("mode").value !== "watch";
    $("p1-difficulty").disabled = $("mode").value !== "watch";
    $("p2-ai-field").hidden = ["local", "training"].includes($("mode").value);
    $("ai-description").hidden = $("p2-ai-field").hidden;
    $("difficulty-label").textContent = $("mode").value === "watch" ? "2P AI 难度" : "对手 AI 难度";
    $("ai-description").textContent = $("mode").value === "watch"
      ? '1P ' + AI_PROFILES[rules.p1Difficulty].name + ' / 2P ' + AI_PROFILES[rules.p2Difficulty].name + '。难度影响判断与打法，不改变伤害、血量和能量规则。'
      : AI_PROFILES[rules.p2Difficulty].description + ' 伤害、血量和能量规则相同。';
    const map = maps.find((map) => map.id === rules.stage);
    $("map-name").textContent = map.name;
    $("map-english").textContent = map.english;
    $("map-subtitle").textContent = map.subtitle;
    $("map-preview").classList.toggle("grid-map", !map.image);
    $("map-preview").style.setProperty(
      "--map-image",
      map.image
        ? `url("${new URL(assetUrl(map.image), document.baseURI).href}")`
        : "none",
    );
    $("map-preview").style.setProperty("--map-filter", map.filter);
    document.querySelectorAll("[data-map]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.map === rules.stage);
    });
    $("mode-summary").textContent = modeNames[$("mode").value];
    const names = ["p1", "p2"].map(
      (side) => roster.find((c) => c.id === $(side).value).name,
    );
    $("match-summary").textContent =
      `${names[0]} vs ${names[1]} · ${map.name} · ${training ? "练习 / 无限时间" : (rules.time ? rules.time + " 秒" : "无限时间") + " / " + rules.wins + " 胜"} · 双方 ${rules.healthMultiplier} 倍血量`;
  }
  function show(next) {
    if (next === "characters" && screen !== "characters") {
      pickTurn = "p1";
      lockedPicks.p1 = lockedPicks.p2 = false;
      renderDraft();
    }
    screen = next;
    onScreen?.(next);
    document.body.dataset.screen = next;
    document
      .querySelectorAll(".screen")
      .forEach((section) => (section.hidden = section.dataset.screen !== next));
    document
      .querySelectorAll("[data-step]")
      .forEach((step) =>
        step.classList.toggle("active", step.dataset.step === next),
      );
    $("steps").hidden = [
      "home",
      "options",
      "gallery",
      "character-detail",
      "battle",
    ].includes(next);
    $("pause-panel").hidden = true;
    $("result-panel").hidden = true;
    if (next === "setup" || next === "characters") renderRules();
    if (next === "battle") $("arena").focus({ preventScroll: true });
    else {
      window.scrollTo(0, 0);
      document
        .querySelector(`.screen[data-screen="${next}"] h1`)
        ?.setAttribute("tabindex", "-1");
    }
  }
  function refreshCharacters() {
    renderDraft();
    renderRules();
    persist();
  }
  for (const side of ["p1", "p2"])
    $(side).addEventListener("change", refreshCharacters);
  document
    .querySelectorAll("[data-go]")
    .forEach((button) => (button.onclick = () => show(button.dataset.go)));
  document.querySelectorAll("[data-mode]").forEach(
    (button) =>
      (button.onclick = () => {
        $("mode").value = button.dataset.mode;
        persist();
        show("characters");
      }),
  );
  for (const [index, map] of maps.entries()) {
    const button = document.createElement("button");
    button.dataset.map = map.id;
    const thumb = document.createElement("span");
    thumb.className = "map-thumb" + (!map.image ? " grid-map" : "");
    thumb.setAttribute("aria-hidden", "true");
    if (map.image) thumb.style.backgroundImage = `url("${new URL(assetUrl(map.image), document.baseURI).href}")`;
    thumb.style.filter = map.filter;
    const caption = document.createElement("span");
    caption.className = "map-caption";
    const number = document.createElement("small");
    number.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("strong");
    name.textContent = map.name;
    caption.append(number, name);
    button.append(thumb, caption);
    button.onclick = () => {
      rules.stage = map.id;
      renderRules();
      persist();
    };
    $("map-list").append(button);
  }
  $("random-map").onclick = () => {
    rules.stage = maps[Math.floor(Math.random() * maps.length)].id;
    renderRules();
    persist();
  };
  for (const id of [
    "round-time",
    "wins-required",
    "health-multiplier",
    "difficulty",
    "p1-difficulty",
  ])
    $(id).onchange = () => {
      readRules();
      renderRules();
      persist();
    };
  $("reset-rules").onclick = () => {
    rules = { ...DEFAULT_RULES };
    renderRules();
    persist();
  };
  $("play").onclick = () => show("mode");
  $("training").onclick = () => {
    $("mode").value = "training";
    show("characters");
  };
  $("characters-back").onclick = () =>
    show($("mode").value === "training" ? "home" : "mode");
  $("characters-next").onclick = () => {
    if (!pickTurn) { show("setup"); return; }
    lockedPicks[pickTurn] = true;
    pickTurn = ["p1", "p2"].find((side) => !lockedPicks[side]) || null;
    renderDraft();
    persist();
  };
  function launch(config) {
    lastMatch = { ...config };
    show("battle");
    onStart({ ...config });
  }
  $("start").onclick = () => {
    readRules();
    persist();
    launch({
      ...rules,
      mode: $("mode").value,
      p1: $("p1").value,
      p2: $("p2").value,
      dummy: $("dummy").value,
      infiniteEnergy: $("training-energy").checked,
    });
  };
  $("restart").onclick = $("result-rematch").onclick = () => {
    if (lastMatch) launch(lastMatch);
  };
  function leave() {
    onLeave();
    show("characters");
  }
  $("battle-return").onclick = $("result-return").onclick = leave;
  $("home-link").onclick = () => {
    if (screen === "battle") onLeave();
    show("home");
  };
  function renderOptions() {
    $("muted").checked = options.muted;
    $("volume").value = options.volume;
    $("shake").checked = options.shake;
    $("scanlines").checked = options.scanlines;
    $("touch-option").value = options.touch;
    $("direction-control").value = options.directionControl;
    document.body.classList.toggle("no-scanlines", !options.scanlines);
    document.body.dataset.touch = options.touch;
    document.body.dataset.directionControl = options.directionControl;
    onOptions({ ...options });
  }
  for (const id of ["muted", "volume", "shake", "scanlines", "touch-option", "direction-control"])
    $(id).addEventListener("input", () => {
      options = normalizeOptions({
        muted: $("muted").checked,
        volume: Number($("volume").value),
        shake: $("shake").checked,
        scanlines: $("scanlines").checked,
        touch: $("touch-option").value,
        directionControl: $("direction-control").value,
      });
      renderOptions();
      persist();
    });
  $("reset-options").onclick = () => {
    options = { ...DEFAULT_OPTIONS };
    $("boxes").checked = false;
    $("boxes").dispatchEvent(new Event("change"));
    renderOptions();
    persist();
  };
  $("fullscreen").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      $("option-status").textContent = "设置已保存。";
    } catch {
      $("option-status").textContent =
        "当前浏览器不支持全屏，可使用浏览器全屏功能。";
    }
  };
  const categories = [
    "普攻 · 拳",
    "普攻 · 脚",
    "前 · 拳",
    "前 · 脚",
    "下 · 拳",
    "下 · 脚",
    "技能1",
    "技能2",
    "绝招",
  ];
  function showCharacter(character) {
    activeCharacter = character.id;
    $("detail-name").textContent = character.name;
    $("detail-description").textContent = character.description;
    const list = $("detail-moves");
    list.replaceChildren();
    MOVE_SLOTS.forEach((slot, i) => {
      const move = character.moves[slot],
        term = document.createElement("dt"),
        body = document.createElement("dd");
      term.textContent = `${categories[i]} · ${move.name}`;
      body.textContent = `${move.damage} 伤害 · ${move.cost ? move.cost + " 能量点" : "免费"} — ${move.description}`;
      list.append(term, body);
    });
    show("character-detail");
  }
  for (const character of roster) {
    const card = document.createElement("button");
    card.className = "archive-card";
    card.dataset.characterId = character.id;
    card.setAttribute("aria-label", `查看${character.name}的技能详情`);
    const canvas = document.createElement("canvas");
    canvas.id = "gallery-preview-" + character.id;
    canvas.width = 360;
    canvas.height = 360;
    const name = document.createElement("h2");
    name.textContent = character.name;
    card.append(canvas, name);
    card.onclick = () => showCharacter(character);
    $("gallery").append(card);
  }
  refreshCharacters();
  renderOptions();
  show("home");
  return {
    get screen() {
      return screen;
    },
    get activeCharacter() {
      return activeCharacter;
    },
    get options() {
      return options;
    },
    show,
    pause(value) {
      $("pause-panel").hidden = !value;
      if (value) $("resume").focus({ preventScroll: true });
      else $("arena").focus({ preventScroll: true });
    },
    result({ name, score }) {
      onScreen?.("result");
      $("pause-panel").hidden = true;
      $("result-title").textContent = name + " 获胜";
      $("result-score").textContent = score;
      $("result-panel").hidden = false;
      $("result-rematch").focus({ preventScroll: true });
    },
  };
}
