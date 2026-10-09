'use strict';

// The commit this app runs from, for Settings > About. CLI installs are git
// checkouts; this reads .git without spawning git. Returns null without a
// checkout (a packaged build).
const fs = require('node:fs');
const path = require('node:path');

const SHA = /^[0-9a-f]{40}$/;

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    return null;
  }
}

function gitDir(repoRoot) {
  const dotGit = path.join(repoRoot, '.git');
  // A worktree's .git is a file pointing at the real git dir.
  const pointer = read(dotGit)?.match(/^gitdir: (.+)$/);
  return pointer ? path.resolve(repoRoot, pointer[1]) : dotGit;
}

function gitCommit(repoRoot) {
  const dir = gitDir(repoRoot);
  const head = read(path.join(dir, 'HEAD'));
  if (!head) return null;
  if (SHA.test(head)) return head;
  const ref = head.match(/^ref: (refs\/\S+)$/)?.[1];
  if (!ref) return null;
  // A worktree keeps HEAD to itself but shares refs with the main git dir.
  const common = read(path.join(dir, 'commondir'));
  const refsDir = common ? path.resolve(dir, common) : dir;
  const loose = read(path.join(refsDir, ref));
  if (loose && SHA.test(loose)) return loose;
  const packed = read(path.join(refsDir, 'packed-refs')) ?? '';
  for (const line of packed.split('\n')) {
    const [sha, name] = line.split(' ');
    if (name === ref && SHA.test(sha)) return sha;
  }
  return null;
}

module.exports = { gitCommit };
