// The CLI, the install scripts and the README cannot import this package (the
// installer stays dependency-free), so their links are checked against it here.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as links from '../dist/links.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const cliSources = ['apps/cli/src', 'apps/cli/bin'].flatMap((dir) =>
  readdirSync(path.join(root, dir)).map((name) => path.join(dir, name)),
);
const files = [...cliSources, 'apps/cli/install.sh', 'apps/web/public/install.ps1', 'README.md'];
const ourHosts = /https?:\/\/(?:p2pacademy\.cc|github\.com\/thisonedev|x\.com|thisonedev\.github\.io)[^\s'"`)<>}]*/g;
const known = new Set(
  Object.values(links).flatMap((value) => (typeof value === 'string' ? [value] : Object.values(value))),
);

for (const file of files) {
  test(`${file} only links to known addresses`, () => {
    const text = readFileSync(path.join(root, file), 'utf8');
    for (const [url] of text.matchAll(ourHosts)) {
      const bare = url.replace(/[.,;:]+$/, '').replace(/#.*$/, '');
      assert.ok(known.has(bare), `${file}: ${url} is not in packages/constants/src/links.ts`);
    }
  });
}

test('install commands in the CLI and README match', () => {
  for (const file of ['apps/cli/src/uninstall.js', 'README.md']) {
    const text = readFileSync(path.join(root, file), 'utf8');
    assert.ok(text.includes(links.INSTALL_COMMANDS.unix), `${file}: unix install command`);
    assert.ok(text.includes(links.INSTALL_COMMANDS.windows), `${file}: windows install command`);
  }
});
