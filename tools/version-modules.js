import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// One revision for the entire module graph, including relative imports.
// Import maps resolve normalized URLs, so ./combat.js inside js/arena.js
// receives the same revision as ./js/combat.js imported from the page.
export async function versionModules() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const names = (await readdir(path.join(root, 'js'))).filter(n => n.endsWith('.js') && !['game.js'].includes(n)).sort();
  const hash = createHash('sha256');
  for (const name of names) hash.update(name).update(await readFile(path.join(root, 'js', name)));
  const revision = hash.digest('hex').slice(0, 12);
  const imports = Object.fromEntries(names.map(n => [`./js/${n}`, `./js/${n}?v=${revision}`]));
  const filename = path.join(root, 'index.html');
  let html = await readFile(filename, 'utf8');
  html = html.replace(/\s*<!-- MODULE_VERSIONS_START -->[\s\S]*?<!-- MODULE_VERSIONS_END -->/g, '');
  const block = `    <!-- MODULE_VERSIONS_START -->\n    <script type="importmap">${JSON.stringify({imports})}</script>\n    <!-- MODULE_VERSIONS_END -->\n`;
  html = html.replace(/    <script type="module" src="\.\/js\/arena\.js(?:\?v=[^"]*)?"><\/script>/,
    `${block}    <script type="module" src="./js/arena.js?v=${revision}"></script>`);
  await writeFile(filename, html);
  return revision;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(`Module revision: ${await versionModules()}`);
