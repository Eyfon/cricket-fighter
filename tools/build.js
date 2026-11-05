import { mkdir, copyFile, cp, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { versionModules } from './version-modules.js';
import { verifyAssets } from './verify-assets.js';
await verifyAssets();
await versionModules();
const root = fileURLToPath(new URL("../", import.meta.url));
// Only package the new game. Original upstream code/assets stay in the checkout.
for (const file of [
  "index.html",
  "js/arena.js",
  "js/asset-url.js",
  "js/audio.js",
  "js/round-ending.js",
  "js/super-flash.js",
  "js/menu.js",
  "js/settings.js",
  "js/maps.js",
  "js/combat.js",
  "js/combat-world.js",
  "js/battle-frame.js",
  "js/ai.js",
  "js/ai-profiles.js",
  "js/animation.js",
  "js/animation-data.js",
  "js/energy-effects.js",
  "js/input.js",
  "js/mobile-controls.js",
  "js/battle-viewport.js",
  "js/roster.js",
  "js/character-schema.js",
  "js/presentation.js",
  "style/arena.css",
  "style/mobile-arena.css",
  "style/match-lobby.css",
]) {
  const dest = path.join(root, "dist", file);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(path.join(root, file), dest);
}
const sprites = path.join(root, "assets/characters");
try {
  await access(sprites);
  await cp(sprites, path.join(root, "dist/assets/characters"), {
    recursive: true,
  });
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
console.log("Static game built in dist/ (no runtime dependencies).");

await cp(
  path.join(root, "assets/arena"),
  path.join(root, "dist/assets/arena"),
  { recursive: true },
);

await cp(
  path.join(root, "assets/audio"),
  path.join(root, "dist/assets/audio"),
  { recursive: true },
);
