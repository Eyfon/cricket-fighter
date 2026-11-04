import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ArcadeAudio, COMBAT_SOUNDS } from "../js/audio.js";
import { renderSound } from "../tools/combat-sound-design.mjs";

test("combat sample pack contains finite, unclipped, non-silent takes with clean edges", () => {
  assert.equal(COMBAT_SOUNDS.length, 9);
  for (const name of COMBAT_SOUNDS) {
    for (let take = 0; take < 3; take++) {
      const samples = renderSound(name, take);
      let energy = 0;
      for (const sample of samples) {
        assert.ok(Number.isFinite(sample) && Math.abs(sample) < 0.97, name);
        energy += sample * sample;
      }
      assert.ok(Math.sqrt(energy / samples.length) > 0.025, name);
      assert.equal(Math.abs(samples[0]), 0);
      assert.ok(Math.abs(samples.at(-1)) < 0.005, name);
      const wav = readFileSync(
        new URL(`../assets/audio/combat/${name}-${take}.wav`, import.meta.url),
      );
      assert.equal(wav.toString("ascii", 0, 4), "RIFF");
      assert.equal(wav.length, 44 + samples.length * 2);
    }
    assert.notDeepEqual(renderSound(name, 0), renderSound(name, 1));
  }
});

test("super retains charge and release effects without any announcer call", () => {
  const audio = new ArcadeAudio();
  audio.context = { currentTime: 0 };
  let effects = 0,
    announcements = 0;
  audio.tone = audio.noise = () => effects++;
  audio.announce = () => announcements++;
  audio.playMove("super", { startup: 20, effect: "projectile" });
  audio.releaseMove("super", { effect: "projectile" });
  assert.ok(effects > 0);
  assert.equal(announcements, 0);
});
