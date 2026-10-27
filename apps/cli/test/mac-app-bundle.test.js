'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ensureBrandedApp } = require('../src/mac-app-bundle');

const FRAMEWORK = path.join('Contents', 'Frameworks', 'Electron Framework.framework');

function fakeDesktop(root) {
  const desktopDir = path.join(root, 'desktop');
  const app = path.join(desktopDir, 'node_modules', 'electron', 'dist', 'Electron.app');
  fs.mkdirSync(path.join(app, 'Contents', 'MacOS'), { recursive: true });
  fs.writeFileSync(path.join(app, 'Contents', 'MacOS', 'Electron'), '');
  fs.writeFileSync(
    path.join(app, 'Contents', 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleShortVersionString</key><string>1.2.3</string>
<key>CFBundleName</key><string>Electron</string>
<key>CFBundleDisplayName</key><string>Electron</string>
<key>CFBundleIconFile</key><string>electron.icns</string>
<key>CFBundleIdentifier</key><string>com.github.Electron</string>
</dict></plist>
`,
  );
  fs.mkdirSync(path.join(app, FRAMEWORK, 'Versions', 'A', 'Resources'), { recursive: true });
  fs.writeFileSync(path.join(app, FRAMEWORK, 'Versions', 'A', 'Resources', 'icudtl.dat'), '');
  fs.symlinkSync('A', path.join(app, FRAMEWORK, 'Versions', 'Current'));
  fs.symlinkSync(path.join('Versions', 'Current', 'Resources'), path.join(app, FRAMEWORK, 'Resources'));
  return desktopDir;
}

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mac-app-bundle-'));
  const previousHome = process.env.P2P_ACADEMY_HOME;
  process.env.P2P_ACADEMY_HOME = path.join(root, 'home');
  t.after(() => {
    if (previousHome === undefined) delete process.env.P2P_ACADEMY_HOME;
    else process.env.P2P_ACADEMY_HOME = previousHome;
    fs.rmSync(root, { recursive: true, force: true });
  });
  return fakeDesktop(root);
}

const bundleFramework = (exe) => path.join(exe, '..', '..', '..', FRAMEWORK);

// Absolute links into the source Electron.app made Chromium miss icudtl.dat,
// and the GPU process exited with code 5 at launch.
test('the branded bundle keeps the framework links relative', { skip: process.platform !== 'darwin' }, (t) => {
  const exe = ensureBrandedApp(setup(t));
  assert.ok(exe);
  assert.equal(fs.readlinkSync(path.join(bundleFramework(exe), 'Versions', 'Current')), 'A');
  assert.equal(fs.readlinkSync(path.join(bundleFramework(exe), 'Resources')), path.join('Versions', 'Current', 'Resources'));
});

test('a cached bundle with an absolute framework link is rebuilt', { skip: process.platform !== 'darwin' }, (t) => {
  const desktopDir = setup(t);
  const exe = ensureBrandedApp(desktopDir);
  const current = path.join(bundleFramework(exe), 'Versions', 'Current');
  fs.rmSync(current);
  fs.symlinkSync(path.join(bundleFramework(exe), 'Versions', 'A'), current);

  assert.equal(ensureBrandedApp(desktopDir), exe);
  assert.equal(fs.readlinkSync(current), 'A');
});
