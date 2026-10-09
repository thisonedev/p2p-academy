// pnpm release patch|minor|major
// From an up-to-date master: creates release/vX.Y.Z, bumps both package.json
// files and drafts a CHANGELOG section from the master commits since the last tag.
// Edit the draft, commit, push and open the PR.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
const PACKAGES = ['package.json', 'apps/desktop/package.json'];

function fail(message) {
  console.error(message);
  process.exit(1);
}

const level = process.argv[2];
if (!['patch', 'minor', 'major'].includes(level)) fail('usage: pnpm release patch|minor|major');

if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'master') fail('run this on master');
if (git('status', '--porcelain')) fail('commit or stash your changes first');
git('fetch', '--quiet', '--tags', 'origin', 'master');
if (git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/master')) fail('master is not in sync with origin/master, pull or push first');

const current = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const parts = current.split('.').map(Number);
if (level === 'major') parts.splice(0, 3, parts[0] + 1, 0, 0);
if (level === 'minor') parts.splice(1, 2, parts[1] + 1, 0);
if (level === 'patch') parts[2] += 1;
const version = parts.join('.');

let lastTag;
try {
  lastTag = git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', 'HEAD');
} catch {
  fail('no vX.Y.Z tag found to draft the CHANGELOG from');
}
const merged = git('log', '--first-parent', '--format=%s', `${lastTag}..HEAD`).split('\n').filter(Boolean);
if (merged.length === 0) fail(`nothing merged since ${lastTag}`);

const branch = `release/v${version}`;
git('checkout', '--quiet', '-b', branch);

for (const file of PACKAGES) {
  const full = path.join(ROOT, file);
  const pkg = JSON.parse(readFileSync(full, 'utf8'));
  pkg.version = version;
  writeFileSync(full, `${JSON.stringify(pkg, null, 2)}\n`);
}

const changelog = path.join(ROOT, 'CHANGELOG.md');
const text = readFileSync(changelog, 'utf8');
const date = new Date().toISOString().slice(0, 10);
const section = `## [${version}] - ${date}\n\n${merged.map((s) => `- ${s}`).join('\n')}\n\n`;
const at = text.indexOf('\n## [');
writeFileSync(changelog, at === -1 ? `${text.trimEnd()}\n\n${section}` : `${text.slice(0, at + 1)}${section}${text.slice(at + 1)}`);

console.log(`On ${branch}: ${current} -> ${version}, CHANGELOG drafted from ${merged.length} commits since ${lastTag}.
Next: edit the ${version} section in CHANGELOG.md, then
  git add ${PACKAGES.join(' ')} CHANGELOG.md
  git commit -m "update version to ${version}"
  git push -u origin ${branch}
and open a PR into master.`);
