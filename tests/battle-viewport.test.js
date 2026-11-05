import test from "node:test";
import assert from "node:assert/strict";
import { battleViewport } from "../js/battle-viewport.js";

test("adaptive view fills phone and desktop ratios without cropping combat bounds", () => {
  for (const [w, h] of [[960, 540], [844, 390], [568, 320], [915, 412], [1920, 720], [1280, 1024]]) {
    const view = battleViewport(w, h);
    assert.ok(Math.abs(view.width / view.height - w / h) < 1e-10);
    assert.ok(view.worldX >= 0 && view.worldX + 960 <= view.width);
    assert.ok(view.height >= 420 - 1e-10);
    assert.equal(438 + view.worldY, view.height - 102);
    // Standing and jumping poses have space above the floor.
    assert.ok(438 + view.worldY >= 318 - 1e-10);
  }
});
