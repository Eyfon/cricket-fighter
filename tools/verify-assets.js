import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = new URL('./asset-integrity.json', import.meta.url);
const assetDirs = ['assets/arena', 'assets/characters', 'assets/audio'];

async function assetPaths(root) {
  const files = [];
  async function visit(relative) {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(name);
      else if (/\.(png|wav)$/i.test(name)) files.push(name);
    }
  }
  for (const dir of assetDirs) await visit(dir);
  return files.sort();
}

export function verifyAssetBytes(name, bytes, expected) {
  if (bytes.length !== expected.bytes)
    throw new Error(`${name}: incomplete asset (${bytes.length} bytes; expected ${expected.bytes})`);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== expected.sha256)
    throw new Error(`${name}: SHA-256 mismatch; restore the original binary asset`);
}

export async function verifyAssets(root = projectRoot) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const files = await assetPaths(root);
  const known = Object.keys(manifest.files).sort();
  if (JSON.stringify(files) !== JSON.stringify(known))
    throw new Error('Asset file list changed. Review the originals, then run node tools/verify-assets.js --write.');
  await Promise.all(files.map(async name => {
    verifyAssetBytes(name, await readFile(path.join(root, name)), manifest.files[name]);
  }));
  return files.length;
}

// Regenerate only after reviewing an intentional local artwork/audio change.
// CI must validate this trusted manifest, never generate one from uploaded bytes.
async function writeManifest() {
  const files = {};
  for (const name of await assetPaths(projectRoot)) {
    const bytes = await readFile(path.join(projectRoot, name));
    files[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  await writeFile(manifestPath, JSON.stringify({ version: 1, files }, null, 2) + '\n');
  console.log(`Recorded ${Object.keys(files).length} original asset checksums.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--write')) await writeManifest();
  else console.log(`Verified ${await verifyAssets()} complete assets.`);
}
