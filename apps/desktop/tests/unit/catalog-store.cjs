'use strict';

const test = require('brittle');
const path = require('node:path');

const { openRootStore } = require('../../electron/root-store.cjs');
const {
  createCatalogStore,
  CATALOG_KINDS,
  DISK_FLOOR_BYTES,
  DISK_WARN_BYTES,
} = require('../../electron/catalog-store.cjs');
const { createKvCore, SNAPSHOT_THRESHOLD } = require('../../electron/kv-core.cjs');
const { tmpDir } = require('../helpers/index.cjs');

test('catalog-store - save/get/remove round trip per kind', async (t) => {
  const dir = tmpDir(t, 'catalog-roundtrip');
  const root = await openRootStore(dir);
  const catalog = await createCatalogStore(root, { dataDir: dir });

  t.is(await catalog.get('brand-kits', 'tether'), null);
  await catalog.save('brand-kits', 'tether', 'Tether', { accent: '#26A17B' });
  t.alike(await catalog.get('brand-kits', 'tether'), { accent: '#26A17B' });

  await catalog.remove('brand-kits', 'tether');
  t.is(await catalog.get('brand-kits', 'tether'), null);
  await root.close();
});

test('catalog-store - list is manifest-only, filterable by kind, newest first', async (t) => {
  const dir = tmpDir(t, 'catalog-list');
  const root = await openRootStore(dir);
  const catalog = await createCatalogStore(root, { dataDir: dir });

  await catalog.save('brand-kits', 'tether', 'Tether', { accent: '#26A17B' });
  await catalog.save('pg-workflows', 'w1', 'My workflow', { nodes: [] });
  await catalog.save('ic-designs', 'd1', 'My design', { layers: [] });

  const all = await catalog.list();
  t.is(all.length, 3);
  t.alike(all.map((e) => e.kind).sort(), ['brand-kits', 'ic-designs', 'pg-workflows']);

  const brandKitsOnly = await catalog.list('brand-kits');
  t.is(brandKitsOnly.length, 1);
  t.is(brandKitsOnly[0].id, 'tether');
  t.is(brandKitsOnly[0].title, 'Tether');
  t.ok(typeof brandKitsOnly[0].updatedAt === 'number');
  await root.close();
});

test('catalog-store - reopened store replays saved entries', async (t) => {
  const dir = tmpDir(t, 'catalog-reopen');
  let root = await openRootStore(dir);
  let catalog = await createCatalogStore(root, { dataDir: dir });
  await catalog.save('ic-designs', 'd1', 'My design', { layers: ['a', 'b'] });
  await root.close();

  root = await openRootStore(dir);
  catalog = await createCatalogStore(root, { dataDir: dir });
  t.alike(await catalog.get('ic-designs', 'd1'), { layers: ['a', 'b'] });
  t.is((await catalog.list('ic-designs'))[0].id, 'd1');
  await root.close();
});

test('catalog-store - unknown kind rejects rather than silently no-op', async (t) => {
  const dir = tmpDir(t, 'catalog-unknown-kind');
  const root = await openRootStore(dir);
  const catalog = await createCatalogStore(root, { dataDir: dir });
  await t.exception(() => catalog.save('not-a-kind', 'x', 'X', {}));
  await root.close();
});

test('catalog-store - every reserved kind is independently addressable', async (t) => {
  const dir = tmpDir(t, 'catalog-kinds');
  const root = await openRootStore(dir);
  const catalog = await createCatalogStore(root, { dataDir: dir });
  for (const kind of CATALOG_KINDS) {
    await catalog.save(kind, 'x', 'X', { kind });
  }
  for (const kind of CATALOG_KINDS) {
    t.alike(await catalog.get(kind, 'x'), { kind });
  }
  await root.close();
});

test('catalog-store - compacts once total payload exceeds one block', async (t) => {
  const dir = tmpDir(t, 'catalog-large');
  let root = await openRootStore(dir);
  let catalog = await createCatalogStore(root, { dataDir: dir });
  // 64 x 300 KB is past Hypercore's 15 MB block cap, so a full-state
  // snapshot can't hold it, but an index of block positions can.
  const blob = 'x'.repeat(300_000);
  for (let i = 0; i < SNAPSHOT_THRESHOLD; i++) {
    await catalog.save('ic-designs', `d${i}`, 'D', { blob, i });
  }
  await root.close();

  const Corestore = require('corestore');
  const cs = new Corestore(path.join(dir, 'corestore'));
  const raw = cs.namespace('ic-designs').get({ name: 'kv-state', valueEncoding: 'json' });
  await raw.ready();
  const tail = await raw.get(raw.length - 1, { wait: false });
  t.is(tail.op, 'index', 'compaction succeeded');
  await cs.close();

  root = await openRootStore(dir);
  catalog = await createCatalogStore(root, { dataDir: dir });
  t.is((await catalog.get('ic-designs', 'd63')).i, 63);
  t.is((await catalog.list('ic-designs')).length, SNAPSHOT_THRESHOLD);
  await root.close();
});

test('catalog-store - a data row with no manifest entry is dropped on open', async (t) => {
  const dir = tmpDir(t, 'catalog-orphan');
  let root = await openRootStore(dir);
  let catalog = await createCatalogStore(root, { dataDir: dir });
  await catalog.save('brand-kits', 'kept', 'Kept', { a: 1 });
  // Simulates a crash after the payload write but before the manifest write.
  const raw = await createKvCore(root.namespace('brand-kits'), 'kv-state');
  await raw.set('orphan', { b: 2 });
  await root.close();

  root = await openRootStore(dir);
  catalog = await createCatalogStore(root, { dataDir: dir });
  t.is(await catalog.get('brand-kits', 'orphan'), null);
  t.alike(await catalog.get('brand-kits', 'kept'), { a: 1 });
  await root.close();
});

function fakeStatfs(freeBytes) {
  return async () => ({ bavail: freeBytes / 4096, blocks: 1e9, bsize: 4096 });
}

test('catalog-store - disk status levels follow free space', async (t) => {
  const dir = tmpDir(t, 'catalog-disk-levels');
  const root = await openRootStore(dir);
  const at = async (free) =>
    (await (await createCatalogStore(root, { dataDir: dir, statfs: fakeStatfs(free) })).diskStatus())
      .level;
  t.is(await at(DISK_WARN_BYTES * 2), 'ok');
  t.is(await at(DISK_WARN_BYTES - 4096), 'low');
  t.is(await at(DISK_FLOOR_BYTES), 'full');
  const failing = await createCatalogStore(root, {
    dataDir: dir,
    statfs: async () => {
      throw new Error('ENOSYS');
    },
  });
  t.is((await failing.diskStatus()).level, 'unknown');
  await root.close();
});

test('catalog-store - save is refused when it would cross the disk floor', async (t) => {
  const dir = tmpDir(t, 'catalog-disk-full');
  const root = await openRootStore(dir);
  const catalog = await createCatalogStore(root, {
    dataDir: dir,
    statfs: fakeStatfs(DISK_FLOOR_BYTES + 4096),
  });
  await t.exception(
    () => catalog.save('ic-designs', 'big', 'Big', { blob: 'x'.repeat(8192) }),
    /CATALOG_DISK_LOW/,
  );
  t.is(await catalog.get('ic-designs', 'big'), null);
  t.is((await catalog.list()).length, 0);
  await catalog.save('ic-designs', 'small', 'Small', { a: 1 });
  t.is((await catalog.list()).length, 1);
  await root.close();
});

test('catalog-store - manifest keeps size and preview, rename touches only the title', async (t) => {
  const dir = tmpDir(t, 'catalog-rename');
  const root = await openRootStore(dir);
  const catalog = await createCatalogStore(root, { dataDir: dir });
  await catalog.save('pg-workflows', 'w1', 'Draft', { name: 'Draft', nodes: [] }, { n: [[0, 0]] });
  let [entry] = await catalog.list('pg-workflows');
  t.is(entry.bytes, Buffer.byteLength(JSON.stringify({ name: 'Draft', nodes: [] })));
  t.alike(entry.preview, { n: [[0, 0]] });

  await catalog.rename('pg-workflows', 'w1', 'Final');
  [entry] = await catalog.list('pg-workflows');
  t.is(entry.title, 'Final');
  t.alike(entry.preview, { n: [[0, 0]] });
  t.alike(await catalog.get('pg-workflows', 'w1'), { name: 'Draft', nodes: [] });

  await catalog.rename('pg-workflows', 'missing', 'Nope');
  t.is((await catalog.list()).length, 1);
  await root.close();
});
