'use strict';

// Which code `install`/`update` build. stable (default) is the newest vX.Y.Z
// release tag, latest is master, which has no release signature to check.
// A --channel flag is saved in ~/.p2p-academy/channel.
const fs = require('node:fs');
const path = require('node:path');
const { run } = require('./proc');
const { home, repoUrl, devBranch } = require('./home');

const CHANNELS = ['stable', 'latest'];
const TAG = /^refs\/tags\/v(\d+)\.(\d+)\.(\d+)$/;

function channelFile() {
  return path.join(home(), 'channel');
}

function savedChannel() {
  try {
    const saved = fs.readFileSync(channelFile(), 'utf8').trim();
    return CHANNELS.includes(saved) ? saved : 'stable';
  } catch {
    return 'stable';
  }
}

function selectChannel(flag) {
  if (flag === undefined) return savedChannel();
  if (!CHANNELS.includes(flag)) throw new Error(`--channel must be one of: ${CHANNELS.join(', ')}`);
  fs.mkdirSync(home(), { recursive: true });
  fs.writeFileSync(channelFile(), `${flag}\n`);
  return flag;
}

function compareParts(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function newestReleaseTag() {
  const out = run('git', ['ls-remote', '--tags', '--refs', repoUrl(), 'refs/tags/v*'], { quiet: true }).stdout;
  const versions = out
    .split('\n')
    .map((line) => line.split('\t')[1]?.trim().match(TAG))
    .filter(Boolean)
    .map((match) => match.slice(1).map(Number))
    .sort(compareParts);
  return versions.length > 0 ? `v${versions.at(-1).join('.')}` : null;
}

// The git ref to clone for a channel. `signed` means the ref is a release tag
// that has to pass verifyReleaseTag before anything from the clone runs.
function refFor(channel) {
  const dev = devBranch();
  if (dev) return { ref: dev, signed: false };
  if (channel === 'latest') return { ref: 'master', signed: false };
  const tag = newestReleaseTag();
  if (!tag) throw new Error('No release tag found. Try again later, or use --channel latest.');
  return { ref: tag, signed: true };
}

module.exports = { selectChannel, refFor };
