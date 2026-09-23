const fs = require('node:fs');
const { createKvCore } = require('./kv-core.cjs');
const {
  IC_DESIGNS_NS,
  PG_WORKFLOWS_NS,
  BRAND_KITS_NS,
} = require('./pear-end/corestore-namespaces.cjs');

// "My saved things" across every kit-facing surface. A new kind needs no
// schema change, just an entry here; keep in sync with catalogKindSchema in
// packages/validation/src/ipc.ts.
const CATALOG_KINDS = [IC_DESIGNS_NS, PG_WORKFLOWS_NS, BRAND_KITS_NS];

const MANIFEST_NAMESPACE = 'catalog-manifest';

// Saves stop below the floor, leaving RocksDB room to compact; the renderer
// can warn from 'low' before that. Keep the code in sync with catalog-storage.ts.
const DISK_FLOOR_BYTES = 500 * 1024 ** 2;
const DISK_WARN_BYTES = 2 * 1024 ** 3;
const DISK_LOW_CODE = 'CATALOG_DISK_LOW';
const manifestKey = (kind, id) => `${kind}:${id}`;

/**
 * One browsable manifest plus one namespaced data core per kind, so a
 * scheduler can open just the kind it needs, by id, with no UI running.
 * @param {import('corestore')} rootStore an already-ready Corestore instance
 * @param {{ dataDir: string, statfs?: typeof fs.promises.statfs }} opts dataDir is the root's directory
 */
async function createCatalogStore(rootStore, { dataDir, statfs = fs.promises.statfs }) {
  const manifest = await createKvCore(rootStore.namespace(MANIFEST_NAMESPACE), 'index');

  // Each kind's core opens on first use; list() never needs one.
  const data = new Map();
  function requireKind(kind) {
    if (!CATALOG_KINDS.includes(kind)) {
      return Promise.reject(new Error(`catalog-store: unknown kind "${kind}"`));
    }
    if (!data.has(kind)) {
      const opening = openKind(kind);
      opening.catch(() => data.delete(kind));
      data.set(kind, opening);
    }
    return data.get(kind);
  }

  // Drops rows a crash left without a manifest entry. Runs before the kind
  // is handed out, so an in-flight save can't be mistaken for an orphan.
  async function openKind(kind) {
    const core = await createKvCore(rootStore.namespace(kind), 'kv-state');
    for (const id of await core.keys()) {
      if (!(await manifest.has(manifestKey(kind, id)))) await core.remove(id);
    }
    return core;
  }

  // 'unknown' when the filesystem can't report free space; saves aren't blocked then.
  async function diskStatus() {
    let stats;
    try {
      stats = await statfs(dataDir);
    } catch {
      return { level: 'unknown', freeBytes: null, totalBytes: null };
    }
    const freeBytes = stats.bavail * stats.bsize;
    const totalBytes = stats.blocks * stats.bsize;
    const level =
      freeBytes <= DISK_FLOOR_BYTES ? 'full' : freeBytes <= DISK_WARN_BYTES ? 'low' : 'ok';
    return { level, freeBytes, totalBytes };
  }

  // Returns the payload's serialized size, which the manifest keeps for display.
  async function ensureRoomFor(payload) {
    const bytes = Buffer.byteLength(JSON.stringify(payload));
    const { freeBytes } = await diskStatus();
    if (freeBytes !== null && freeBytes - bytes < DISK_FLOOR_BYTES) {
      throw new Error(`${DISK_LOW_CODE}: not enough free disk space to save this item`);
    }
    return bytes;
  }

  return {
    diskStatus,

    // The manifest entry is written after the payload and removed before it,
    // so a crash can only orphan a data row, which openKind() then drops.
    // preview is a small kind-specific sketch, like a workflow's node layout,
    // so a library can draw its cards without loading any payload.
    async save(kind, id, title, payload, preview = null) {
      const core = await requireKind(kind);
      const bytes = await ensureRoomFor(payload);
      await core.set(id, payload);
      await manifest.set(manifestKey(kind, id), {
        kind,
        id,
        title,
        updatedAt: Date.now(),
        bytes,
        preview,
        v: 1,
      });
    },

    // Manifest-only: the payload keeps whatever name it was saved with.
    async rename(kind, id, title) {
      await requireKind(kind);
      const key = manifestKey(kind, id);
      const entry = await manifest.get(key);
      if (!entry) return;
      await manifest.set(key, { ...entry, title, updatedAt: Date.now() });
    },

    async get(kind, id) {
      return (await requireKind(kind)).get(id);
    },

    async remove(kind, id) {
      const core = await requireKind(kind);
      await manifest.remove(manifestKey(kind, id));
      await core.remove(id);
    },

    // No kind lists everything saved across every surface; one kind narrows
    // to it, e.g. just brand kits for the Themes panel's picker.
    async list(kind) {
      const entries = await manifest.list();
      return entries
        .map((e) => e.value)
        .filter((e) => e && (!kind || e.kind === kind))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async close() {
      // Every core here shares the root store's lifecycle; its owner closes it.
    },
  };
}

module.exports = { createCatalogStore, CATALOG_KINDS, DISK_FLOOR_BYTES, DISK_WARN_BYTES, DISK_LOW_CODE };
