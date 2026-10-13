'use strict';

// The Windows half (shell: true actually reaching execFileSync) needs a real
// win32 host to assert honestly; see temp/windows.md. What runs everywhere is
// the input gate: this is the one argument in that call that isn't a fixed
// literal, so a package name has to clear npm's own naming grammar before it
// can reach a shell on any platform.

const test = require('brittle');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { NPM_PACKAGE_NAME_RE, warmPackage, parsePin, pinSpec, hashDirsFor, isWarm } = require('../../workers/sandbox/mcp-warm.cjs');
const { createToolWrappers } = require('../../workers/sandbox/tool-wrappers.cjs');
const { mcpPackagePins, allowedMcpPackages } = require('../../workers/sandbox/index.cjs');

const INTEGRITY = `sha512-${'A'.repeat(86)}==`;
const OTHER_INTEGRITY = `sha512-${'B'.repeat(86)}==`;
const PIN = { name: '@scope/server', version: '1.2.3', integrity: INTEGRITY };

test('mcp-warm - NPM_PACKAGE_NAME_RE accepts real package names', (t) => {
  for (const name of ['left-pad', '@oevortex/ddg_search', 'a', '@scope/pkg.name_2']) {
    t.ok(NPM_PACKAGE_NAME_RE.test(name), name);
  }
});

test('mcp-warm - NPM_PACKAGE_NAME_RE refuses shell metacharacters', (t) => {
  for (const name of ['pkg; rm -rf /', 'pkg && calc', 'pkg | more', 'pkg`whoami`', 'pkg"&whoami', 'pkg%TEMP%', '../escape']) {
    t.absent(NPM_PACKAGE_NAME_RE.test(name), name);
  }
});

test('mcp-warm - warmPackage refuses an invalid name before touching npx or the cache dir', (t) => {
  const cacheDir = path.join(os.tmpdir(), `academy-mcp-warm-test-${process.pid}-${Date.now()}`);
  const result = warmPackage(cacheDir, { ...PIN, name: 'pkg; rm -rf /' });
  t.is(result.ok, false);
  t.ok(result.error.includes('valid npm package name'));
  t.absent(fs.existsSync(cacheDir), 'never created the cache dir for a refused name');
});

// The version and the integrity reach npx and the cache check, so a pin
// missing either one must not install whatever the registry serves that day.
test('mcp-warm - a pin needs an exact version and a sha512 integrity', (t) => {
  t.alike(parsePin(PIN), PIN);
  t.is(pinSpec(PIN), '@scope/server@1.2.3');

  for (const version of ['^1.2.3', '1.2', 'latest', '*', '1.2.3 && calc', '']) {
    t.is(parsePin({ ...PIN, version }), null, `version ${JSON.stringify(version)}`);
  }
  for (const integrity of ['', 'sha1-abc', 'sha512-short', `sha512-${'A'.repeat(86)}`]) {
    t.is(parsePin({ ...PIN, integrity }), null, `integrity ${JSON.stringify(integrity)}`);
  }
  t.is(parsePin('@scope/server'), null, 'a bare name is not a pin');
  t.is(parsePin(null), null);

  const cacheDir = path.join(os.tmpdir(), `academy-mcp-warm-test-${process.pid}-${Date.now()}-b`);
  t.is(warmPackage(cacheDir, { name: '@scope/server' }).ok, false, 'an unpinned package is not installed');
  t.absent(fs.existsSync(cacheDir));
});

test('mcp-warm - every shipped MCP package is pinned', (t) => {
  const pins = [...mcpPackagePins().values()];
  t.ok(pins.length > 0);
  t.alike(pins.map((pin) => pin.name), allowedMcpPackages());
  for (const pin of pins) t.alike(parsePin(pin), pin, pin.name);
});

// Lays out what `npx --package name@version` leaves under `_npx/<hash>`.
function fakeNpxDir(cacheDir, hash, { name, version, integrity }) {
  const dir = path.join(cacheDir, '_npx', hash);
  fs.mkdirSync(path.join(dir, 'node_modules', name), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package-lock.json'),
    JSON.stringify({ packages: { [`node_modules/${name}`]: { version, integrity } } }),
  );
}

test('mcp-warm - the cache counts as warm only for the pinned version and integrity', (t) => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-mcp-warm-'));
  t.teardown(() => fs.rmSync(cacheDir, { recursive: true, force: true }));

  t.absent(isWarm(cacheDir, PIN), 'an empty cache is cold');
  fakeNpxDir(cacheDir, 'older', { ...PIN, version: '1.2.2' });
  fakeNpxDir(cacheDir, 'tampered', { ...PIN, integrity: OTHER_INTEGRITY });
  t.absent(isWarm(cacheDir, PIN), 'another version or another integrity does not count');

  fakeNpxDir(cacheDir, 'pinned', PIN);
  t.alike(hashDirsFor(cacheDir, [PIN]), ['pinned'], 'only the matching directory is named');
});

// The lesson says `npx -y <name>`, as the SDK example does. The child's npx
// shim adds the pinned version so npx reuses the host's install offline.
test('mcp-warm - the npx shim swaps a pinned name for name@version', { skip: process.platform === 'win32' }, (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-mcp-shim-'));
  t.teardown(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
  const wrappers = createToolWrappers({ cacheDir: path.join(tmpDir, 'cache'), tmpDir, pins: [PIN] });
  const shim = path.join(wrappers.dir, 'npx');
  if (!fs.existsSync(shim)) {
    t.comment('npx is not installed here, so no shim was written');
    t.pass();
    return;
  }

  // Same script with the final exec swapped for a print of its arguments.
  const body = fs.readFileSync(shim, 'utf8').replace(/^exec .*$/m, 'printf "%s\\n" "$@"');
  const probe = path.join(tmpDir, 'probe.sh');
  fs.writeFileSync(probe, body);
  const run = (...args) => execFileSync('/bin/sh', [probe, ...args], { encoding: 'utf8' }).trimEnd().split('\n');

  t.alike(run('-y', '@scope/server'), ['-y', '@scope/server@1.2.3']);
  t.alike(run('-y', '@scope/server', '--flag', 'a b'), ['-y', '@scope/server@1.2.3', '--flag', 'a b'], 'other arguments pass through');
  t.alike(run('-y', '@scope/other'), ['-y', '@scope/other'], 'an unpinned name is left alone');
  t.absent(fs.readFileSync(path.join(wrappers.dir, 'node'), 'utf8').includes('@scope/server'), 'only npx is rewritten');
});
