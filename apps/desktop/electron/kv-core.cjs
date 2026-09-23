// A snapshot-compacted KV over one named Hypercore; the caller owns the store.
// Values stay in their 'set' blocks and memory holds a key -> block index, so
// snapshots grow with key count and stay under Hypercore's block cap.

const SNAPSHOT_THRESHOLD = 64;

// Newer logs keep a key's value in its own 'set' block. Logs written before
// the index format keep it inside a full-state 'snapshot' block.
function valueIn(block, key) {
  if (block === null) return null;
  if (block.op === 'snapshot') return Object.hasOwn(block.state, key) ? block.state[key] : null;
  return block.value ?? null;
}

// Scans back to the newest snapshot, then applies the ops after it in order.
// Reads use wait: false, since a cleared block would otherwise hang forever.
async function replay(core) {
  const index = new Map();
  const ops = [];
  for (let seq = core.length - 1; seq >= 0; seq--) {
    const block = await core.get(seq, { wait: false });
    if (block === null) continue;
    if (block.op === 'index') {
      for (const [key, at] of Object.entries(block.index)) index.set(key, at);
      break;
    }
    if (block.op === 'snapshot') {
      for (const key of Object.keys(block.state)) index.set(key, seq);
      break;
    }
    ops.push([seq, block]);
  }
  for (let i = ops.length - 1; i >= 0; i--) {
    const [seq, block] = ops[i];
    if (block.op === 'set') index.set(block.key, seq);
    else if (block.op === 'remove') index.delete(block.key);
  }
  return index;
}

/**
 * @param {import('corestore')} scopedStore an already-ready Corestore (root or namespaced)
 * @param {string} coreName
 */
async function createKvCore(scopedStore, coreName) {
  const core = scopedStore.get({ name: coreName, valueEncoding: 'json' });
  await core.ready();

  const initialLength = core.length;
  const index = await replay(core);
  let opsSinceSnapshot = 0;

  // Ops run one at a time, so a read sees every write issued before it and
  // compaction never interleaves with an append.
  let tail = Promise.resolve();
  function exclusive(fn) {
    const run = tail.then(fn);
    tail = run.catch(() => {});
    return run;
  }

  async function append(block) {
    const { length } = await core.append(block);
    return length - 1;
  }

  async function read(key, blocks) {
    const seq = index.get(key);
    if (seq === undefined) return null;
    let block = blocks?.get(seq);
    if (!block) {
      block = core.get(seq, { wait: false });
      blocks?.set(seq, block);
    }
    return valueIn(await block, key);
  }

  // The index is appended before any clear and live blocks are never
  // cleared, so a crash mid-compaction still replays to the same state.
  async function compact() {
    const snapshotSeq = await append({
      op: 'index',
      index: Object.fromEntries(index),
      ts: Date.now(),
    });
    const live = [...new Set(index.values())].sort((a, b) => a - b);
    let start = 0;
    for (const seq of live) {
      if (seq > start) await core.clear(start, seq);
      start = seq + 1;
    }
    if (snapshotSeq > start) await core.clear(start, snapshotSeq);
    opsSinceSnapshot = 0;
  }

  async function afterWrite() {
    opsSinceSnapshot += 1;
    if (opsSinceSnapshot >= SNAPSHOT_THRESHOLD) {
      try {
        await compact();
      } catch {
        // leave the log; next op will retry
      }
    }
  }

  return {
    // True only when this core had no entries before this session opened it;
    // callers use it to decide whether to run a one-time legacy migration.
    wasEmpty: initialLength === 0,

    get(key) {
      return exclusive(() => read(key));
    },

    has(key) {
      return exclusive(() => index.has(key));
    },

    keys() {
      return exclusive(() => [...index.keys()]);
    },

    set(key, value) {
      return exclusive(async () => {
        index.set(key, await append({ op: 'set', key, value, ts: Date.now() }));
        await afterWrite();
      });
    },

    remove(key) {
      return exclusive(async () => {
        if (!index.has(key)) return;
        await append({ op: 'remove', key, ts: Date.now() });
        index.delete(key);
        await afterWrite();
      });
    },

    list() {
      return exclusive(() => {
        const blocks = new Map();
        return Promise.all(
          [...index.keys()].map(async (key) => ({ key, value: await read(key, blocks) })),
        );
      });
    },
  };
}

module.exports = { createKvCore, SNAPSHOT_THRESHOLD };
