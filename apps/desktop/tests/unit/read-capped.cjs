'use strict';

// Pins the saved-file preview read: the size cap and the read share one handle.

const test = require('brittle');
const fs = require('node:fs');
const path = require('node:path');
const { readFileCapped } = require('../../electron/read-capped.cjs');
const { tmpDir } = require('../helpers/index.cjs');

test('read capped - returns the bytes of a file within the cap', async (t) => {
  const file = path.join(tmpDir(t, 'read-capped'), 'a.png');
  fs.writeFileSync(file, Buffer.from([1, 2, 3]));
  t.alike(await readFileCapped(file, 3), Buffer.from([1, 2, 3]));
});

test('read capped - null for a file over the cap, a directory, or a missing path', async (t) => {
  const dir = tmpDir(t, 'read-capped');
  const file = path.join(dir, 'big.bin');
  fs.writeFileSync(file, Buffer.alloc(10));
  t.is(await readFileCapped(file, 9), null);
  t.is(await readFileCapped(dir, 100), null);
  t.is(await readFileCapped(path.join(dir, 'missing'), 100), null);
});
