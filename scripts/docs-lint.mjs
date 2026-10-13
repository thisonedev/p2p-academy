// pnpm docs:lint [file ...]
// Runs Vale on the repo's Markdown with the shared Tether rules from tetherto/docs-template,
// pinned to one commit. Needs the `vale` CLI and git.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_REF = '269703edea9dcb983241d5809dd9d4710a7acc16';
const TEMPLATE_URL = 'https://github.com/tetherto/docs-template.git';
const IGNORED = ['packages/courses/', 'packages/scorm/'];
// temp/ is gitignored, so the checkout and the synced style packages stay out of the repo.
const dir = path.join(ROOT, 'temp', 'vale', TEMPLATE_REF);
const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });

if (spawnSync('vale', ['--version']).status !== 0) {
  console.error('vale is not installed. See https://vale.sh/docs/install (macOS: brew install vale).');
  process.exit(2);
}

const config = path.join(dir, '.vale.ini');
if (!existsSync(config)) {
  mkdirSync(dir, { recursive: true });
  git(['init', '--quiet'], dir);
  git(['fetch', '--quiet', '--depth', '1', TEMPLATE_URL, TEMPLATE_REF], dir);
  git(['checkout', '--quiet', 'FETCH_HEAD'], dir);
  execFileSync('vale', ['--no-global', '--config', config, 'sync'], { cwd: dir, stdio: 'inherit' });
}

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : git(['ls-files', '*.md'], ROOT)
      .split('\n')
      .filter((file) => file && !IGNORED.some((prefix) => file.startsWith(prefix)));

const run = spawnSync('vale', ['--no-global', '--config', config, ...files], { cwd: ROOT, stdio: 'inherit' });
// Exit 1 means Vale found error-level alerts. Those are advisory, so only a broken run fails.
process.exit(run.status === 1 ? 0 : (run.status ?? 2));
