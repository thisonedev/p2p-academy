'use strict';

const { createInterface } = require('node:readline');
const { runInherit } = require('./proc');
const { desktopDir } = require('./desktop-dir');
const { ensureBrandedApp } = require('./mac-app-bundle');
const { printBanner } = require('./splash');

// Harmless lines Electron prints from native code, same list as the desktop
// dev launcher (apps/desktop/scripts/kill-stale.mjs).
const NOISE = [
  /SetApplicationIsDaemon: Error Domain=NSOSStatusErrorDomain Code=-50/,
  /representedObject is not a WeakPtrToElectronMenuModelAsNSObject/,
];

function start({ storage } = {}) {
  printBanner('Starting P2P Academy...');
  // macOS: launch a rebranded copy of Electron.app so the dock/menu bar show
  // "P2P Academy" from process start, not just after app.setName() runs
  // (see mac-app-bundle.js). Falls back to plain Electron elsewhere.
  const electronPath = ensureBrandedApp(desktopDir()) ?? require('electron');
  const args = [desktopDir()];
  if (storage) args.push('--storage', storage);
  const env = { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' };
  const child = runInherit(electronPath, args, { env, stdio: ['inherit', 'inherit', 'pipe'] });
  createInterface({ input: child.stderr }).on('line', (line) => {
    if (!NOISE.some((re) => re.test(line))) process.stderr.write(`${line}\n`);
  });
  return new Promise((resolve) => child.on('exit', (code) => resolve(code ?? 0)));
}

module.exports = { start };
