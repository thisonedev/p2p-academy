'use strict';

// Compaction of the append-only KV state log: an index op + clear() of dead
// blocks keeps it bounded. Replay must read {wait: false} so a cleared block returns
// null instead of hanging forever on a local-only core.

const test = require('brittle');
const fs = require('node:fs');
const path = require('node:path');

const { createStore, SNAPSHOT_THRESHOLD } = require('../../electron/state-store.cjs');
const { tmpDir } = require('../helpers/index.cjs');

test('state-store - set/get/remove/list round trip', async (t) => {
  const dir = tmpDir(t, 'kv-roundtrip');
  const store = await createStore(dir);
  t.is(await store.get('a'), null);
  await store.set('a', 1);
  await store.set('b', 'two');
  t.is(await store.get('a'), 1);
  t.is(await store.get('b'), 'two');
  await store.remove('a');
  t.is(await store.get('a'), null);
  const list = await store.list();
  t.is(list.length, 1);
  t.alike(list[0], { key: 'b', value: 'two' });
  await store.close();
});

test('state-store - compaction appends an index and clears dead blocks', async (t) => {
  const dir = tmpDir(t, 'kv-compact');
  const store = await createStore(dir);
  // Overwriting one key leaves every earlier 'set' block dead.
  for (let i = 0; i < SNAPSHOT_THRESHOLD; i++) {
    await store.set('a', i);
  }
  await store.close();

  // Only one corestore holds the directory at a time, so close-then-reopen is required.
  const Corestore = require('corestore');
  const cs = new Corestore(path.join(dir, 'corestore'));
  const rawCore = cs.get({ name: 'kv-state', valueEncoding: 'json' });
  await rawCore.ready();
  // core.length does NOT shrink on clear(); check the per-block flag instead.
  const tail = await rawCore.get(rawCore.length - 1, { wait: false });
  t.ok(tail && tail.op === 'index', 'tail is an index snapshot');
  t.alike(tail.index, { a: SNAPSHOT_THRESHOLD - 1 });
  t.is(await rawCore.get(0, { wait: false }), null, 'dead blocks are gone');
  const live = await rawCore.get(SNAPSHOT_THRESHOLD - 1, { wait: false });
  t.is(live.value, SNAPSHOT_THRESHOLD - 1, 'live block survives');
  await cs.close();
});

test('state-store - reopened store replays from snapshot', async (t) => {
  const dir = tmpDir(t, 'kv-reopen');
  let store = await createStore(dir);
  for (let i = 0; i < SNAPSHOT_THRESHOLD + 5; i++) {
    await store.set(`k${i}`, i);
  }
  await store.close();

  store = await createStore(dir);
  // The post-snapshot writes are also in the log; reopen must apply them all.
  t.is(await store.get(`k${SNAPSHOT_THRESHOLD + 4}`), SNAPSHOT_THRESHOLD + 4);
  t.is(await store.get('k0'), 0);
  const list = await store.list();
  t.is(list.length, SNAPSHOT_THRESHOLD + 5);
  await store.close();
});

test('state-store - legacy full-state snapshot still replays', async (t) => {
  const dir = tmpDir(t, 'kv-legacy-snapshot');
  const Corestore = require('corestore');
  const cs = new Corestore(path.join(dir, 'corestore'));
  const core = cs.get({ name: 'kv-state', valueEncoding: 'json' });
  await core.ready();
  await core.append({ op: 'snapshot', state: { a: 1, b: 2 }, ts: 0 });
  await core.append({ op: 'set', key: 'b', value: 3, ts: 0 });
  await cs.close();

  const store = await createStore(dir);
  t.alike(await store.list(), [
    { key: 'a', value: 1 },
    { key: 'b', value: 3 },
  ]);
  // Compacting keeps the legacy block alive while 'a' still points into it.
  for (let i = 0; i < SNAPSHOT_THRESHOLD; i++) {
    await store.set('c', i);
  }
  await store.close();

  const reopened = await createStore(dir);
  t.is(await reopened.get('a'), 1);
  t.is(await reopened.get('c'), SNAPSHOT_THRESHOLD - 1);
  await reopened.close();
});

test('state-store - prototype keys are plain keys', async (t) => {
  const dir = tmpDir(t, 'kv-proto');
  let store = await createStore(dir);
  await store.set('__proto__', { polluted: true });
  t.alike(await store.get('__proto__'), { polluted: true });
  for (let i = 0; i < SNAPSHOT_THRESHOLD; i++) {
    await store.set('x', i);
  }
  await store.close();

  store = await createStore(dir);
  t.alike(await store.get('__proto__'), { polluted: true });
  t.is((await store.list()).length, 2);
  await store.close();
});

test('state-store - concurrent writes across compaction all survive', async (t) => {
  const dir = tmpDir(t, 'kv-concurrent');
  let store = await createStore(dir);
  const writes = [];
  for (let i = 0; i < SNAPSHOT_THRESHOLD * 3; i++) {
    writes.push(store.set(`k${i}`, i));
  }
  await Promise.all(writes);
  await store.close();

  store = await createStore(dir);
  t.is((await store.list()).length, SNAPSHOT_THRESHOLD * 3);
  await store.close();
});

test('state-store - reopen after a clear completes without hanging', async (t) => {
  // The regression this guards is a hang, not a wrong value: against a real corestore with no peers, a
  // replay loop calling core.get(i) without {wait: false} blocks forever instead of returning null.
  const dir = tmpDir(t, 'kv-clear-hang');
  const Corestore = require('corestore');
  const corestore = new Corestore(path.join(dir, 'corestore'));
  const core = corestore.get({ name: 'kv-state', valueEncoding: 'json' });
  await core.ready();
  await core.append({ op: 'set', key: 'a', value: 1 });
  await core.append({ op: 'set', key: 'b', value: 2 });
  await core.clear(0, core.length);
  await corestore.close();

  const store = await createStore(dir);
  t.is(await store.get('a'), null, 'cleared key returns null');
  t.is(await store.get('b'), null, 'cleared key returns null');
  t.alike(await store.list(), []);
  await store.close();
});