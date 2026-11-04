import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("assets/characters");
for (const character of ["canglan", "chifeng"]) {
  test(`${character} has organized common and skill sprite manifests`, async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, character, "manifest.json"), "utf8"),
    );
    assert.equal(manifest.character, character);
    for (const category of ["common", "skill1", "skill2", "super"])
      assert.ok(await readFile(path.join(root, character, category, category === "common" ? "idle.png" : "atlas.png")));
    for (const action of ["idle", "punch", "kick", "forward-punch", "forward-kick", "down-punch", "down-kick", "crouch-guard", "skill1", "skill2", "super"]) {
      assert.ok(manifest.actions[action], action);
      assert.ok(manifest.actions[action].frames.length > 0, action);
      for (const rect of manifest.actions[action].frames)
        assert.equal(rect.length, 4);
    }
  });
}
