'use strict';

const fs = require('node:fs');
const path = require('node:path');

// The Electron version installed in a checkout, or null when it can't be read.
function electronVersionIn(checkoutDir) {
  try {
    const manifest = path.join(checkoutDir, 'apps', 'desktop', 'node_modules', 'electron', 'package.json');
    return JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
  } catch {
    return null;
  }
}

// macOS grants keychain access per Electron binary, so it asks again after an Electron version change.
function keychainNotice(platform, beforeElectron, afterElectron) {
  if (platform !== 'darwin' || !beforeElectron || !afterElectron || beforeElectron === afterElectron) return null;
  return (
    `Electron ${beforeElectron} → ${afterElectron}. On the next start, macOS will ask you for access to ` +
    '"P2P Academy Safe Storage" in your keychain. Enter your login password and choose Always Allow.'
  );
}

module.exports = { electronVersionIn, keychainNotice };
