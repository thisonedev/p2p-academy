'use strict';

// Pins when `p2p-academy update` warns about the macOS keychain prompt. macOS grants keychain
// access per Electron binary, so only a changed Electron version on macOS should print it.

const test = require('brittle');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { electronVersionIn, keychainNotice } = require('../../../cli/src/keychain-notice.js');

test('keychain notice - printed on macOS when Electron changes', (t) => {
  const notice = keychainNotice('darwin', '40.10.6', '44.7.2');
  t.ok(notice.includes('40.10.6 → 44.7.2'));
  t.ok(notice.includes('"P2P Academy Safe Storage"'));
  t.ok(notice.includes('Always Allow'));
});

test('keychain notice - silent when Electron is unchanged, unknown, or not on macOS', (t) => {
  t.is(keychainNotice('darwin', '44.7.2', '44.7.2'), null);
  t.is(keychainNotice('darwin', null, '44.7.2'), null, 'first install');
  t.is(keychainNotice('darwin', '40.10.6', null), null);
  t.is(keychainNotice('linux', '40.10.6', '44.7.2'), null);
  t.is(keychainNotice('win32', '40.10.6', '44.7.2'), null);
});

test('keychain notice - reads the Electron version installed in a checkout', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keychain-notice-'));
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }));
  t.is(electronVersionIn(dir), null, 'no install');
  const electronDir = path.join(dir, 'apps', 'desktop', 'node_modules', 'electron');
  fs.mkdirSync(electronDir, { recursive: true });
  fs.writeFileSync(path.join(electronDir, 'package.json'), JSON.stringify({ name: 'electron', version: '44.7.2' }));
  t.is(electronVersionIn(dir), '44.7.2');
});
