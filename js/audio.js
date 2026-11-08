// Original procedural arcade score. No streaming services, API keys or backend.
export const MUSIC = {
  lobby: {
    name: "街机集结",
    bpm: 120,
    root: 43,
    wave: "triangle",
    lead: [12, 19, 24, 19, 16, 19, 21, 19, 14, 17, 21, 24, 21, 17, 19, 16],
    progression: [0, 5, 2, 7],
  },
  selection: {
    name: "准备出击",
    bpm: 132,
    root: 42,
    wave: "square",
    lead: [12, 12, 19, 17, 15, 19, 22, 19, 17, 17, 24, 22, 19, 17, 15, 10],
    progression: [0, 8, 3, 10],
  },
  result: {
    name: "再战时刻",
    bpm: 112,
    root: 41,
    wave: "triangle",
    lead: [12, 16, 19, 16, 14, 17, 21, 17, 16, 19, 24, 21, 19, 17, 16, 14],
    progression: [0, 2, 5, 7],
  },
  sunset: {
    name: "烈日决斗",
    bpm: 148,
    root: 40,
    wave: "sawtooth",
    lead: [12, 15, 19, 22, 19, 15, 12, 10, 12, 15, 19, 24, 22, 19, 15, 10],
    progression: [0, 0, 8, 10],
  },
  midnight: {
    name: "霓虹追击",
    bpm: 138,
    root: 38,
    wave: "square",
    lead: [12, 19, 15, 22, 12, 19, 17, 15, 10, 17, 14, 22, 10, 17, 15, 14],
    progression: [0, 3, 8, 7],
  },
  training: {
    name: "极限热身",
    bpm: 126,
    root: 45,
    wave: "triangle",
    lead: [12, 16, 19, 21, 19, 16, 14, 16, 12, 16, 19, 24, 21, 19, 16, 14],
    progression: [0, 5, 7, 5],
  },
  neon: {
    name: "霓虹脉冲",
    bpm: 154,
    root: 39,
    wave: "square",
    lead: [12, 19, 24, 26, 19, 22, 29, 24, 14, 19, 22, 31, 26, 22, 19, 14],
    progression: [0, 3, 7, 10],
  },
  factory: {
    name: "钢铁警报",
    bpm: 142,
    root: 36,
    wave: "sawtooth",
    lead: [7, 7, 14, 19, 7, 12, 17, 14, 5, 5, 12, 17, 19, 14, 12, 7],
    progression: [0, 2, 5, 3],
  },
  bamboo: {
    name: "月影疾风",
    bpm: 118,
    root: 44,
    wave: "triangle",
    lead: [12, 16, 21, 24, 21, 16, 14, 12, 19, 21, 26, 29, 26, 21, 19, 14],
    progression: [0, 7, 5, 2],
  },
  dairy: {
    name: "奶蛋狂欢",
    bpm: 136,
    root: 47,
    wave: "square",
    lead: [19, 19, 24, 19, 16, 21, 24, 21, 12, 16, 21, 26, 24, 21, 16, 12],
    progression: [0, 5, 9, 7],
  },
};
export function musicForScreen(screen) {
  if (screen === "battle") return null; // The selected map owns battle music.
  if (screen === "result") return "result";
  return ["characters", "setup"].includes(screen) ? "selection" : "lobby";
}
export const COMBAT_SOUNDS = [
  "punch-air",
  "kick-air",
  "slash-air",
  "punch-hit",
  "kick-hit",
  "heavy-hit",
  "energy-hit",
  "slam-hit",
  "guard-hit",
];
const hz = (note) => 440 * 2 ** ((note - 69) / 12);
export class ArcadeAudio {
  constructor() {
    this.context = null;
    this.options = { muted: false, volume: 0.5 };
    this.sources = new Set();
    this.voices = new Map();
    this.samples = new Map();
    this.specialSamples = new Map();
    this.sampleCounts = new Map();
    this.stage = null;
    this.paused = false;
    this.step = 0;
    this.nextBeat = 0;
    this.announcements = [];
    this.pendingSpecial = null;
  }
  configure(options) {
    this.options = options;
    if (this.master)
      this.master.gain.setTargetAtTime(
        options.muted ? 0 : options.volume * 0.75,
        this.context.currentTime,
        0.025,
      );
    if (options.muted) this.cancelVoice();
  }
  unlock() {
    if (this.options.muted) return;
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.context = new Context();
      const c = this.context;
      this.master = c.createGain();
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.knee.value = 12;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;
      this.master.connect(limiter).connect(c.destination);
      this.music = c.createGain();
      this.music.gain.value = 0.55;
      this.music.connect(this.master);
      this.fx = c.createGain();
      this.fx.connect(this.master);
      this.voiceBus = c.createGain();
      this.voiceBus.gain.value = 0.85;
      this.voiceBus.connect(this.master);
      // Short stereo ping-pong style echo gives the announcer an arena tail.
      const delay = c.createDelay(1),
        echo = c.createGain();
      delay.delayTime.value = 0.135;
      echo.gain.value = 0.16;
      this.voiceBus.connect(delay).connect(echo).connect(this.master);
      this.noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.configure(this.options);
      for (const name of COMBAT_SOUNDS)
        for (let take = 0; take < 3; take++) {
          const key = `${name}-${take}`;
          fetch(new URL(`../assets/audio/combat/${key}.wav`, import.meta.url))
            .then((response) => {
              if (!response.ok) throw Error(response.status);
              return response.arrayBuffer();
            })
            .then((bytes) => c.decodeAudioData(bytes))
            .then((buffer) => this.samples.set(key, buffer))
            .catch(() => {});
        }
      for (const key of [
        "round",
        "one",
        "two",
        "three",
        "fight",
        "ko",
        "time",
        "draw",
        "winner",
        "loser",
        "p1win",
        "p2win",
        "ready",
      ]) {
        fetch(new URL(`../assets/audio/announcer/${key}.wav`, import.meta.url))
          .then((r) => {
            if (!r.ok) throw Error(r.status);
            return r.arrayBuffer();
          })
          .then((buffer) => c.decodeAudioData(buffer))
          .then((buffer) => this.voices.set(key, buffer))
          .catch(() => {});
      }
      fetch(new URL("../assets/audio/naiwa-laugh.wav", import.meta.url))
        .then((response) => {
          if (!response.ok) throw Error(response.status);
          return response.arrayBuffer();
        })
        .then((bytes) => c.decodeAudioData(bytes))
        .then((buffer) => {
          this.specialSamples.set("naiwa-laugh", buffer);
          if (this.pendingSpecial?.name === "naiwa-laugh") {
            const pending = this.pendingSpecial;
            this.pendingSpecial = null;
            this.playSpecial(pending.name, pending.duration, pending.volume);
          }
        })
        .catch(() => {});
    }
    if (this.context.state === "suspended")
      this.context.resume().catch(() => {});
  }
  track(source, when, duration, nodes = []) {
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
    };
    source.start(when);
    source.stop(when + duration);
  }
  tone(
    freq,
    end,
    duration,
    volume,
    type = "sine",
    when = this.context?.currentTime,
    bus = this.fx,
  ) {
    if (!this.context || this.options.muted || volume <= 0) return;
    const c = this.context,
      osc = c.createOscillator(),
      gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(15, freq), when);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(15, end),
      when + duration,
    );
    gain.gain.setValueAtTime(0.001, when);
    gain.gain.exponentialRampToValueAtTime(
      volume,
      when + Math.min(0.008, duration / 4),
    );
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(gain).connect(bus);
    this.track(osc, when, duration + 0.01, [gain]);
  }
  noise(
    duration,
    volume,
    frequency = 2000,
    when = this.context?.currentTime,
    bus = this.fx,
    highpass = false,
  ) {
    if (!this.context || this.options.muted) return;
    const c = this.context,
      source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = highpass ? "highpass" : "bandpass";
    filter.frequency.setValueAtTime(frequency, when);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(80, frequency * 0.22),
      when + duration,
    );
    filter.Q.value = 0.65;
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    source.connect(filter).connect(gain).connect(bus);
    this.track(source, when, duration, [filter, gain]);
  }
  playMove(key, move) {
    if (!this.context || this.paused) return;
    if (move.voiceCue) {
      this.playSpecial("naiwa-laugh", 2, 0.9);
      return;
    }
    const t = this.context.currentTime;
    if (key === "dodge") {
      this.noise(0.17, 0.28, 3600);
      return;
    }
    if (key === "punch" || key === "kick") {
      if (!this.sample(`${key}-air`, key === "kick" ? 0.88 : 0.78))
        this.noise(
          key === "kick" ? 0.16 : 0.1,
          0.65,
          key === "kick" ? 1900 : 3200,
        );
      return;
    }
    const big = key === "super",
      release = t + (move.startup || 12) / 60;
    this.tone(
      big ? 90 : 150,
      big ? 780 : 480,
      release - t + 0.05,
      big ? 0.2 : 0.12,
      "sawtooth",
    );
    this.noise(0.16, 0.25, 4200);
  }
  releaseMove(key, move) {
    if (!this.context || this.paused || key === "punch" || key === "kick")
      return;
    if (move.voiceCue) return;
    const big = key === "super",
      release = this.context.currentTime;
    if (move.effect === "projectile") {
      for (const offset of big ? [0, 0.09, 0.18] : [0, 0.055]) {
        this.tone(
          big ? 440 : 720,
          55,
          big ? 0.65 : 0.3,
          0.18,
          "sawtooth",
          release + offset,
        );
        this.noise(big ? 0.7 : 0.28, 0.34, 2400, release + offset);
      }
    } else if (move.effect === "grab") {
      this.noise(0.22, 0.45, 900, release);
      this.tone(130, 30, 0.26, 0.35, "triangle", release);
    } else {
      for (let i = 0; i < (move.hits?.length || 1); i++)
        if (!this.sample("slash-air", 0.85, i * 0.075))
          this.noise(0.16, 0.65, 3200, release + i * 0.075);
      this.tone(260, 42, 0.28, 0.2, "triangle", release);
    }
  }
  playSpecial(name, duration = 2, volume = 1) {
    if (!this.context || this.paused || this.options.muted) return false;
    const buffer = this.specialSamples.get(name);
    if (!buffer) {
      this.pendingSpecial = { name, duration, volume };
      return false;
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain).connect(this.fx);
    this.track(source, this.context.currentTime, Math.min(duration, buffer.duration), [gain]);
    return true;
  }
  sample(name, volume = 1, delay = 0) {
    if (!this.context || this.paused || this.options.muted) return false;
    const count = this.sampleCounts.get(name) || 0;
    const buffer =
      this.samples.get(`${name}-${count % 3}`) || this.samples.get(`${name}-0`);
    if (!buffer) return false;
    this.sampleCounts.set(name, count + 1);
    const c = this.context,
      source = c.createBufferSource(),
      gain = c.createGain();
    source.buffer = buffer;
    source.playbackRate.value = [1, 0.97, 1.035][count % 3];
    gain.gain.value = volume;
    source.connect(gain).connect(this.fx);
    this.track(
      source,
      c.currentTime + delay,
      buffer.duration / source.playbackRate.value + 0.01,
      [gain],
    );
    return true;
  }
  impact(event) {
    if (!this.context || this.paused) return;
    const sound = event.blocked
      ? "guard-hit"
      : event.super
        ? "heavy-hit"
        : event.grab
          ? "slam-hit"
          : event.effect === "projectile"
            ? "energy-hit"
            : event.key === "kick" || event.key === "specialKick"
              ? "kick-hit"
              : event.key === "specialPunch"
                ? "heavy-hit"
                : "punch-hit";
    if (this.sample(sound, event.blocked ? 0.82 : event.super ? 1.2 : 1.05))
      return;
    // Immediate fallback while the small sample pack is still decoding.
    this.tone(
      event.blocked ? 310 : 135,
      event.blocked ? 160 : 42,
      0.14,
      0.65,
      "triangle",
    );
    this.noise(0.1, 0.9, event.blocked ? 3400 : 2100);
  }
  finisher() {
    if (!this.context) return;
    const t = this.context.currentTime;
    // A layered impact gives the final hit a clear arcade punctuation.
    this.tone(82, 24, 0.95, 0.9, "sine", t);
    this.tone(170, 38, 0.32, 0.34, "triangle", t + 0.018);
    this.noise(0.75, 0.85, 1250, t, this.fx, false);
    this.noise(0.18, 0.55, 4200, t + 0.025, this.fx, true);
  }
  koReveal() {
    if (!this.context || this.paused) return;
    const t = this.context.currentTime;
    this.tone(980, 180, 0.18, 0.22, "square", t);
    this.tone(130, 42, 0.62, 0.68, "sawtooth", t + 0.015);
    this.noise(0.32, 0.58, 2600, t, this.fx, true);
  }
  superStart() {
    if (!this.context || this.paused) return;
    const t = this.context.currentTime;
    this.noise(0.08, 0.85, 5300);
    this.tone(1250, 270, 0.14, 0.32, "triangle");
    this.tone(75, 35, 0.3, 0.62);
    this.tone(180, 920, 0.18, 0.2, "sawtooth", t + 0.025);
    this.noise(0.24, 0.33, 2200, t + 0.07);
  }
  victory(lost = false) {
    if (!this.context || this.paused) return;
    const t = this.context.currentTime;
    for (const [i, note] of (lost
      ? [59, 55, 52, 47]
      : [52, 55, 59, 64]
    ).entries()) {
      const at = t + i * 0.13;
      this.tone(hz(note), hz(note), i === 3 ? 0.8 : 0.24, 0.12, "sawtooth", at);
      this.tone(hz(note + 12), hz(note + 12), 0.35, 0.06, "triangle", at);
    }
    this.noise(0.65, 0.22, 5800, t + 0.39);
  }
  setStage(stage) {
    if (stage === this.stage) return;
    this.stop();
    this.stage = stage;
    this.step = 0;
    this.nextBeat = this.context?.currentTime || 0;
  }
  pause(value) {
    this.paused = value;
    if (value) this.stop();
    else this.nextBeat = this.context?.currentTime || 0;
  }
  cancelVoice() {
    if (this.voiceSource) {
      try {
        this.voiceSource.stop();
      } catch {}
      this.voiceSource = null;
    }
    if (this.music)
      this.music.gain.setTargetAtTime(0.55, this.context.currentTime, 0.1);
  }
  stop() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {}
    }
    this.sources.clear();
    this.cancelVoice();
  }
  announce(key) {
    if (!this.context || this.options.muted || this.paused) return;
    this.cancelVoice();
    this.announcements.push(key);
    this.announcements = this.announcements.slice(-12);
    const buffer = this.voices.get(key);
    if (!buffer) return;
    const c = this.context,
      source = c.createBufferSource(),
      filter = c.createBiquadFilter();
    source.buffer = buffer;
    source.playbackRate.value = key === "ko" ? 1 : 0.96;
    filter.type = "highpass";
    filter.frequency.value = 150;
    source.connect(filter).connect(this.voiceBus);
    this.voiceSource = source;
    this.music.gain.setTargetAtTime(0.19, c.currentTime, 0.025);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      if (this.voiceSource === source) {
        this.voiceSource = null;
        this.music.gain.setTargetAtTime(0.55, c.currentTime, 0.18);
      }
    };
    source.start();
  }
  update() {
    const c = this.context,
      theme = MUSIC[this.stage];
    if (
      !c ||
      c.state !== "running" ||
      !theme ||
      this.paused ||
      this.options.muted
    )
      return;
    const stepTime = 60 / theme.bpm / 4;
    if (this.nextBeat < c.currentTime - 0.2) this.nextBeat = c.currentTime;
    while (this.nextBeat < c.currentTime + 0.12) {
      const s = this.step,
        t = this.nextBeat,
        root = theme.root + theme.progression[Math.floor(s / 32) % 4];
      // Four-on-the-floor kick, backbeat snare, offbeat hats and octave bass.
      if (s % 4 === 0) this.tone(145, 38, 0.18, 0.56, "sine", t, this.music);
      if (s % 8 === 4) {
        this.noise(0.14, 0.42, 2100, t, this.music);
        this.tone(190, 105, 0.12, 0.18, "triangle", t, this.music);
      }
      if (s % 2 === 0)
        this.noise(s % 4 === 2 ? 0.12 : 0.045, 0.11, 7200, t, this.music, true);
      if (s % 2 === 0) {
        const bass = hz(root + (s % 8 === 6 ? 12 : 0));
        this.tone(bass, bass, stepTime * 1.6, 0.15, "sawtooth", t, this.music);
        this.tone(
          bass / 2,
          bass / 2,
          stepTime * 1.6,
          0.15,
          "sine",
          t,
          this.music,
        );
      }
      if (s % 2 === 0 && s % 32 !== 30) {
        const note = hz(root + theme.lead[Math.floor(s / 2) % 16]);
        this.tone(
          note,
          note * 0.998,
          stepTime * 1.7,
          0.065,
          theme.wave,
          t,
          this.music,
        );
        this.tone(
          note * 1.005,
          note,
          stepTime * 1.5,
          0.035,
          theme.wave,
          t + 0.01,
          this.music,
        );
        this.tone(
          note * 2,
          note * 2,
          stepTime * 1.5,
          0.025,
          "triangle",
          t + stepTime * 1.5,
          this.music,
        );
      }
      if (s % 16 === 0)
        for (const n of [12, 19, 24]) {
          const f = hz(root + n);
          this.tone(f, f, stepTime * 7, 0.035, "triangle", t, this.music);
        }
      if (s % 32 >= 30) this.noise(0.08, 0.22, 2200, t, this.music);
      this.step++;
      this.nextBeat += stepTime;
    }
  }
  snapshot() {
    return {
      ready: this.context?.state === "running",
      stage: this.stage,
      track: MUSIC[this.stage]?.name || null,
      paused: this.paused,
      voicesLoaded: this.voices.size,
      combatSamplesLoaded: this.samples.size,
      announcements: [...this.announcements],
    };
  }
}
