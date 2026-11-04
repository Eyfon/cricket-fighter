import test from "node:test";
import assert from "node:assert/strict";
import { END_DURATION, endingFrame, roundOutcome } from "../js/round-ending.js";
import { MUSIC, ArcadeAudio, musicForScreen } from "../js/audio.js";
import { maps } from "../js/maps.js";
import { readFileSync } from "node:fs";

test("KO finishes impact, falling, announcement and victory before results", () => {
  assert.equal(endingFrame(0).stage, "impact");
  assert.equal(endingFrame(0.5).stage, "fall");
  assert.ok(endingFrame(0.5).fall > 0 && endingFrame(0.5).fall < 1);
  assert.equal(endingFrame(1.2).fall, 1);
  assert.equal(endingFrame(1.2).stage, "ko");
  assert.equal(endingFrame(3.2).stage, "winner");
  assert.equal(endingFrame(END_DURATION - 0.01).done, false);
  assert.equal(endingFrame(END_DURATION).done, true);
  assert.equal(endingFrame(1.2, false).title, "TIME OVER");
});

test("each selectable map has a distinct complete original music theme", () => {
  for (const map of maps) assert.ok(MUSIC[map.id]);
  assert.equal(
    new Set(Object.values(MUSIC).map((track) => track.name)).size,
    Object.keys(MUSIC).length,
  );
  assert.equal(
    new Set(Object.values(MUSIC).map((track) => JSON.stringify(track.lead)))
      .size,
    Object.keys(MUSIC).length,
  );
  for (const track of Object.values(MUSIC)) {
    assert.ok(track.bpm >= 100 && track.bpm <= 180);
    assert.equal(track.lead.length, 16);
    assert.equal(track.progression.length, 4);
  }
});

test("announcer lines are shipped as playable WAV recordings", () => {
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
    const bytes = readFileSync(
      new URL(`../assets/audio/announcer/${key}.wav`, import.meta.url),
    );
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
    assert.ok(bytes.length > 4000);
  }
});

test("every menu and results has music; battle leaves ownership to its map", () => {
  for (const screen of [
    "home",
    "mode",
    "options",
    "gallery",
    "character-detail",
  ])
    assert.equal(musicForScreen(screen), "lobby");
  for (const screen of ["characters", "setup"])
    assert.equal(musicForScreen(screen), "selection");
  assert.equal(musicForScreen("result"), "result");
  assert.equal(musicForScreen("battle"), null);
});

test("winner announcements match the human side or identify the winning player", () => {
  assert.equal(roundOutcome("cpu", 0).voice, "winner");
  assert.deepEqual(roundOutcome("cpu", 1), {
    voice: "loser",
    headline: "YOU LOSE",
    lost: true,
  });
  for (const mode of ["watch", "local", "training"]) {
    assert.equal(roundOutcome(mode, 0).voice, "p1win");
    assert.equal(roundOutcome(mode, 1).voice, "p2win");
  }
  assert.equal(roundOutcome("cpu", null).voice, "ready");
});

test("KO recording has no long gap between the two letters", () => {
  const bytes = readFileSync(
    new URL("../assets/audio/announcer/ko.wav", import.meta.url),
  );
  let rate, samples;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const size = bytes.readUInt32LE(offset + 4);
    const id = bytes.toString("ascii", offset, offset + 4);
    if (id === "fmt ") rate = bytes.readUInt32LE(offset + 12);
    if (id === "data") samples = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  assert.ok(samples.length / 2 / rate < 0.9);
  let gap = 0,
    longest = 0;
  for (let i = 0; i < samples.length; i += 2) {
    gap = Math.abs(samples.readInt16LE(i)) < 504 ? gap + 1 : 0;
    longest = Math.max(longest, gap);
  }
  assert.ok(longest / rate < 0.1);
});

test("audio remains safe before first user gesture and when disabled", () => {
  const audio = new ArcadeAudio();
  audio.configure({ muted: true, volume: 0 });
  audio.setStage("sunset");
  audio.playMove("punch", {});
  audio.impact({ blocked: false });
  audio.announce("ko");
  audio.pause(true);
  audio.update();
  audio.stop();
  assert.equal(audio.snapshot().ready, false);
  assert.equal(audio.snapshot().track, "烈日决斗");
});
