'use strict';

// A stable install builds a release tag. The tag has to carry an SSH signature
// from a key in release-signers before any code from the clone runs.
const fs = require('node:fs');
const path = require('node:path');
const { run } = require('./proc');

const SIGNERS_FILE = path.join(__dirname, '..', 'release-signers');
const VERSION = /^v(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(text) {
  const match = VERSION.exec(text ?? '');
  return match ? match.slice(1).map(Number) : null;
}

function isOlder(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

function git(dir, args) {
  return run('git', ['-C', dir, ...args], { quiet: true }).stdout;
}

// `installedVersion` is the package.json version of the current install, or null.
function verifyReleaseTag(dir, tag, { installedVersion = null, signersFile = SIGNERS_FILE } = {}) {
  const fail = (reason) => {
    throw new Error(`Release ${tag} failed verification: ${reason}. Nothing was installed.`);
  };
  const version = parseVersion(tag);
  if (!version) fail('not a vX.Y.Z tag');
  if (git(dir, ['cat-file', '-t', tag]).trim() !== 'tag') fail('the tag is not signed');
  try {
    git(dir, ['-c', `gpg.ssh.allowedSignersFile=${signersFile}`, 'verify-tag', tag]);
  } catch (err) {
    fail(`no valid signature from a release key (${err.message})`);
  }
  // The signed tag object records its own name, so an old release pushed under
  // a newer tag name still fails here.
  const header = git(dir, ['cat-file', 'tag', tag]).split('\n\n')[0];
  if (!header.split('\n').includes(`tag ${tag}`)) fail('the signed tag name does not match');
  const tagged = git(dir, ['rev-parse', `${tag}^{commit}`]).trim();
  const head = git(dir, ['rev-parse', 'HEAD']).trim();
  if (tagged !== head) fail('the checkout is not the signed commit');
  const installed = parseVersion(installedVersion ? `v${installedVersion}` : null);
  if (installed && isOlder(version, installed)) fail(`it is older than the installed ${installedVersion}`);
}

function versionIn(checkoutDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(checkoutDir, 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

function warnUnsigned(ref) {
  console.log(`  ${ref} is not a signed release, so its signature is not checked.`);
}

module.exports = { verifyReleaseTag, versionIn, warnUnsigned, SIGNERS_FILE };
