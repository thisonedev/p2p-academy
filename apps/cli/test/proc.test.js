'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('../src/proc');

// Install paths can contain spaces (a Windows user name), and git revisions can
// contain `^`. Through cmd.exe both would break, so git has to skip the shell.
test('git gets a path with spaces and a ^ revision unchanged', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proc test '));
  test.after(() => fs.rmSync(root, { recursive: true, force: true }));
  // Keep the developer's git config (hooks, signing) out of this repo.
  process.env.GIT_CONFIG_GLOBAL = path.join(root, 'gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  const dir = path.join(root, 'repo with spaces');
  const git = (...args) => run('git', ['-C', dir, ...args], { quiet: true }).stdout.trim();
  run('git', ['init', '-q', dir], { quiet: true });
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-q', '--allow-empty', '-m', 'one');
  assert.equal(git('rev-parse', 'HEAD^{commit}'), git('rev-parse', 'HEAD'));
});
