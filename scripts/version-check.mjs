// Version rules for a PR into master. Only a release/vX.Y.Z branch may change
// the version; it must bump it and add a CHANGELOG section for it.
// CI passes BASE_REF and HEAD_REF; locally they default to master and the current branch.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { changelogNotes } from './changelog-notes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const readJson = (file) => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'));

const baseRef = process.env.BASE_REF || 'master';
const headRef = process.env.HEAD_REF || git('rev-parse', '--abbrev-ref', 'HEAD');
const baseVersion = JSON.parse(git('show', `origin/${baseRef}:package.json`)).version;
const version = readJson('package.json').version;
const errors = [];

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
function greater(a, b) {
  const [x, y] = [a, b].map((v) => v.match(SEMVER).slice(1).map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

console.log(`${baseRef}: ${baseVersion}, ${headRef}: ${version}`);
if (headRef.startsWith('release/')) {
  if (!SEMVER.test(version)) errors.push(`version ${version} must be X.Y.Z`);
  else if (!greater(version, baseVersion)) errors.push(`version ${version} must be greater than ${baseRef} (${baseVersion})`);
  if (headRef !== `release/v${version}`) errors.push(`branch must be named release/v${version}`);
  if (!changelogNotes(version)) errors.push(`CHANGELOG.md needs a non-empty "## [${version}]" section`);
} else if (version !== baseVersion) {
  errors.push(`version changed from ${baseVersion} to ${version}; only release/vX.Y.Z branches change it (pnpm release)`);
}

// Settings > About shows the desktop version, so it must match the root one.
const desktopVersion = readJson('apps/desktop/package.json').version;
if (desktopVersion !== version) {
  errors.push(`apps/desktop/package.json version (${desktopVersion}) must equal package.json (${version})`);
}

// The installers run before any checkout, so they pin pnpm by hand.
const pnpm = readJson('package.json').packageManager.split('@')[1].split('+')[0];
const installers = [
  ['apps/cli/install.sh', `  npm install -g pnpm@${pnpm}`],
  ['apps/web/public/install.ps1', `  npm.cmd install -g pnpm@${pnpm}`],
];
for (const [file, line] of installers) {
  if (!readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/).includes(line)) {
    errors.push(`${file} must install pnpm@${pnpm} (package.json packageManager)`);
  }
}

if (errors.length > 0) {
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.log('Version check passed.');
