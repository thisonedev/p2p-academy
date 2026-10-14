'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { verifyReleaseTag } = require('../src/release-verify');

// Keep the developer's own git config (signing keys, hooks) out of these repos.
process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-verify-'));
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

function sh(cmd, args, cwd = root) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function makeKey(name) {
  const file = path.join(root, name);
  sh('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', name, '-f', file]);
  return { file, pub: fs.readFileSync(`${file}.pub`, 'utf8').trim() };
}

function signersFile(name, keys) {
  const file = path.join(root, name);
  const lines = keys.map((key, i) => `release-${i} namespaces="git" ${key.pub}`);
  fs.writeFileSync(file, ['# test signers', ...lines, ''].join('\n'));
  return file;
}

const release = makeKey('release-key');
const stranger = makeKey('stranger-key');
const trusted = signersFile('signers', [release]);
const emptySigners = signersFile('signers-empty', []);

const origin = path.join(root, 'origin');
fs.mkdirSync(origin);
const git = (...args) => sh('git', ['-C', origin, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args]);
const signedTag = (key, name, ref = 'HEAD') =>
  git('-c', 'gpg.format=ssh', '-c', `user.signingkey=${key.file}`, 'tag', '-s', name, '-m', name, ref);

git('init', '-q', '-b', 'master');
fs.writeFileSync(path.join(origin, 'package.json'), '{"version":"1.0.0"}\n');
git('add', '.');
git('commit', '-q', '-m', 'one');
signedTag(release, 'v1.0.0');
git('commit', '-q', '--allow-empty', '-m', 'two');
signedTag(release, 'v1.1.0');
signedTag(stranger, 'v1.2.0');
git('tag', 'v1.3.0');
// An old signed tag object pushed under a newer name.
git('update-ref', 'refs/tags/v9.0.0', sh('git', ['-C', origin, 'rev-parse', 'v1.0.0']).trim());

let clones = 0;
function cloneAt(ref) {
  const dir = path.join(root, `clone-${clones++}`);
  sh('git', ['clone', '-q', '--depth', '1', '--branch', ref, pathToFileURL(origin).href, dir]);
  return dir;
}

test('accepts a tag signed by a release key, from a shallow clone', () => {
  verifyReleaseTag(cloneAt('v1.1.0'), 'v1.1.0', { signersFile: trusted });
});

test('accepts the same version as the installed one', () => {
  verifyReleaseTag(cloneAt('v1.1.0'), 'v1.1.0', { signersFile: trusted, installedVersion: '1.1.0' });
});

test('rejects a tag signed by a key that is not listed', () => {
  assert.throws(() => verifyReleaseTag(cloneAt('v1.2.0'), 'v1.2.0', { signersFile: trusted }), /no valid signature/);
});

test('rejects every tag when no key is listed', () => {
  assert.throws(() => verifyReleaseTag(cloneAt('v1.1.0'), 'v1.1.0', { signersFile: emptySigners }), /no valid signature/);
});

test('rejects a tag with no signature', () => {
  assert.throws(() => verifyReleaseTag(cloneAt('v1.3.0'), 'v1.3.0', { signersFile: trusted }), /not signed/);
});

test('rejects a signed tag pushed under another name', () => {
  assert.throws(() => verifyReleaseTag(cloneAt('v9.0.0'), 'v9.0.0', { signersFile: trusted }), /name does not match/);
});

test('rejects a checkout that is not the signed commit', () => {
  const dir = cloneAt('v1.1.0');
  sh('git', ['-C', dir, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-q', '--allow-empty', '-m', 'extra']);
  assert.throws(() => verifyReleaseTag(dir, 'v1.1.0', { signersFile: trusted }), /not the signed commit/);
});

test('rejects a release older than the installed one', () => {
  assert.throws(
    () => verifyReleaseTag(cloneAt('v1.0.0'), 'v1.0.0', { signersFile: trusted, installedVersion: '1.1.0' }),
    /older than the installed 1\.1\.0/,
  );
});

// A tag the maintainer signed with a YubiKey (ed25519-sk). Only the tag object is
// stored, so this checks that each OS's git and ssh-keygen accept that key type.
test('verifies a real security-key signature', () => {
  const fixtures = path.join(__dirname, 'fixtures');
  const dir = path.join(root, 'security-key');
  sh('git', ['init', '-q', dir]);
  const object = sh('git', ['-C', dir, 'hash-object', '-t', 'tag', '-w', '--literally', path.join(fixtures, 'security-key-tag')]).trim();
  assert.equal(object, '73ea6e7892cf0f685f48421eb42bbfa4430808c3', 'the fixture bytes changed');
  const verify = (signers) =>
    sh('git', ['-C', dir, '-c', `gpg.ssh.allowedSignersFile=${signers}`, 'verify-tag', object]);
  verify(path.join(fixtures, 'security-key-signers'));
  assert.throws(() => verify(trusted));
});

test('rejects a ref that is not a vX.Y.Z tag', () => {
  assert.throws(() => verifyReleaseTag(cloneAt('master'), 'master', { signersFile: trusted }), /not a vX\.Y\.Z tag/);
});
