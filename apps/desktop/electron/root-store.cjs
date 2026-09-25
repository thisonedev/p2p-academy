const path = require('node:path');
const fs = require('node:fs');
const { diagnoseNativeAddonError } = require('./linux-lib-hint.cjs');

// Lazy so a missing native dep (e.g. rocksdb-native needs libatomic.so.1)
// throws from openRootStore(), where it's catchable, instead of crashing the
// whole process at require time with no chance to add a hint.
function loadCorestore() {
  try {
    return require('corestore');
  } catch (err) {
    const hint = diagnoseNativeAddonError(err);
    if (hint) err.message = `${err.message}\n${hint}`;
    throw err;
  }
}

/**
 * The one Corestore instance for this user's data directory (RocksDB-backed,
 * one open handle per directory). Every namespaced store shares this via `.namespace()`.
 * @param {string} userDataDir
 */
function corestoreDir(userDataDir) {
  return path.join(userDataDir, 'corestore');
}

async function openRootStore(userDataDir) {
  const Corestore = loadCorestore();
  const dir = corestoreDir(userDataDir);
  fs.mkdirSync(dir, { recursive: true });
  const store = new Corestore(dir);
  await store.ready();
  return store;
}

module.exports = { openRootStore, loadCorestore, corestoreDir };
