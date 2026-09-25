const path = require('node:path');
const fs = require('node:fs');
const { openRootStore } = require('./root-store.cjs');
const { createKvCore, SNAPSHOT_THRESHOLD } = require('./kv-core.cjs');

// Key-value state only; device identity lives in identity/manager.cjs. The
// KV logic itself lives in kv-core.cjs, shared with catalog-store.cjs; this
// file owns the 'kv-state' core name and the legacy state.json migration.

/**
 * Opens its own root Corestore. Prefer createStoreFromRoot (pear-end's
 * shared instance) in production; this is for tests/scripts wanting the
 * progress KV in isolation.
 * @param {string} userDataDir
 */
async function createStore(userDataDir) {
  const root = await openRootStore(userDataDir);
  try {
    const store = await createStoreFromRoot(root, userDataDir);
    return { ...store, close: () => root.close() };
  } catch (err) {
    await root.close().catch(() => {});
    throw err;
  }
}

/**
 * @param {import('corestore')} store an already-ready Corestore instance
 * @param {string} userDataDir only used for the one-time legacy state.json migration
 */
async function createStoreFromRoot(store, userDataDir) {
  const kv = await createKvCore(store, 'kv-state');
  if (kv.wasEmpty) {
    await migrateLegacyState(kv, userDataDir);
  }

  return {
    get: kv.get,
    set: kv.set,
    remove: kv.remove,
    list: kv.list,
    // The shared root belongs to pear-end, which closes it on shutdown.
    async close() {},
  };
}

async function migrateLegacyState(kv, userDataDir) {
  const legacyPath = path.join(userDataDir, 'state.json');
  if (!fs.existsSync(legacyPath)) return;
  try {
    const data = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
    const entries = Object.entries(data ?? {});
    if (entries.length === 0) return;
    for (const [key, value] of entries) {
      await kv.set(key, value);
    }
    fs.unlinkSync(legacyPath);
    console.log(
      `[state-store] migrated ${entries.length} key(s) from state.json into kv-state core`,
    );
  } catch (err) {
    console.warn('[state-store] state.json migration failed:', err.message);
  }
}

module.exports = { createStore, createStoreFromRoot, SNAPSHOT_THRESHOLD };
