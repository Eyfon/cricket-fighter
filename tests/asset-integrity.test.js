import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyAssets, verifyAssetBytes } from '../tools/verify-assets.js';
import { assetUrl } from '../js/asset-url.js';

test('asset refresh URLs preserve GitHub Pages repository paths', () => {
  assert.equal(new URL(assetUrl('./assets/characters/arcade-fighters.png', 'fixed'),
    'https://eyfon.github.io/cricket-fighter/').href,
    'https://eyfon.github.io/cricket-fighter/assets/characters/arcade-fighters.png?v=fixed');
  assert.equal(assetUrl('./assets/arena/rooftop-sunset.png', null), './assets/arena/rooftop-sunset.png');
});

test('all shipped artwork and sound match the original byte lengths and SHA-256 checksums', async () => {
  assert.ok(await verifyAssets() > 0);
});

test('a truncated atlas cannot pass release validation even when its PNG header survives', async () => {
  const name = 'assets/characters/arcade-fighters.png';
  const manifest = JSON.parse(await readFile(new URL('../tools/asset-integrity.json', import.meta.url), 'utf8'));
  const original = await readFile(new URL(`../${name}`, import.meta.url));
  assert.throws(() => verifyAssetBytes(name, original.subarray(0, 786444), manifest.files[name]), /incomplete asset/);
  const damaged = Buffer.from(original);
  damaged[Math.floor(damaged.length / 2)] ^= 1;
  assert.throws(() => verifyAssetBytes(name, damaged, manifest.files[name]), /SHA-256 mismatch/);
});
