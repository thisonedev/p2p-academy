'use strict';

const test = require('brittle');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { gitCommit } = require('../../electron/git-commit.cjs');

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' }).trim();
}

function repo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-commit-'));
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, 'init', '-q', '-b', 'master');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'one');
  return { dir, sha: git(dir, 'rev-parse', 'HEAD') };
}

test('branch with a loose ref', (t) => {
  const { dir, sha } = repo(t);
  t.is(gitCommit(dir), sha);
});

test('branch ref only in packed-refs', (t) => {
  const { dir, sha } = repo(t);
  git(dir, 'pack-refs', '--all');
  t.absent(fs.existsSync(path.join(dir, '.git', 'refs', 'heads', 'master')));
  t.is(gitCommit(dir), sha);
});

test('detached HEAD, as a clone of a release tag', (t) => {
  const { dir, sha } = repo(t);
  git(dir, 'tag', 'v1.0.0');
  const clone = `${dir}-clone`;
  t.teardown(() => fs.rmSync(clone, { recursive: true, force: true }));
  git(dir, 'clone', '-q', '--depth', '1', '--branch', 'v1.0.0', `file://${dir}`, clone);
  t.is(gitCommit(clone), sha);
});

test('worktree', (t) => {
  const { dir } = repo(t);
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'two');
  const wt = `${dir}-wt`;
  t.teardown(() => fs.rmSync(wt, { recursive: true, force: true }));
  git(dir, 'worktree', 'add', '-q', '-b', 'side', wt, 'HEAD~1');
  t.is(gitCommit(wt), git(wt, 'rev-parse', 'HEAD'));
  t.not(gitCommit(wt), gitCommit(dir));
});

test('no checkout or a garbled HEAD gives null', (t) => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'git-commit-none-'));
  t.teardown(() => fs.rmSync(empty, { recursive: true, force: true }));
  t.is(gitCommit(empty), null);
  const { dir } = repo(t);
  fs.writeFileSync(path.join(dir, '.git', 'HEAD'), 'not a ref\n');
  t.is(gitCommit(dir), null);
});
