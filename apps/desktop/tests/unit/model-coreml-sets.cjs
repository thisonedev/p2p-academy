'use strict';

// On macOS the SDK saves some Parakeet GGUFs with their Core ML encoders in
// sets/<setKey>/ without a registry companionSet, so Settings showed a
// downloaded model as missing.

const test = require('brittle');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { coremlSidecarSets, catalogueEntryFromName } = require('../../electron/models.cjs');

const SET_KEY = '0b2c5437a1a88f6f';
const GGUF = 'diar_streaming_sortformer_4spk-v2.1.q8_0.gguf';
const MIL = 'diar_streaming_sortformer_4spk-v2.1-encoder.mlmodelc/model.mil';

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coreml-sets-'));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

// `onDisk` maps targetName to the byte count written; a missing key
// leaves that file off disk.
function writeSet(root, dirName, meta, onDisk = {}) {
  const dir = path.join(root, 'sets', dirName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.coreml-companions.json'), JSON.stringify(meta));
  for (const [name, bytes] of Object.entries(onDisk)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), Buffer.alloc(bytes));
  }
}

const META = {
  setKey: SET_KEY,
  primaryKey: 'modelPath',
  files: [
    { key: 'modelPath', targetName: GGUF, expectedSize: 8 },
    { key: 'encoder/model.mil', targetName: MIL, expectedSize: 4 },
  ],
};

test('coreml sets - every file at its expected size makes a complete set', async (t) => {
  const root = tempRoot(t);
  writeSet(root, SET_KEY, META, { [GGUF]: 8, [MIL]: 4 });
  const sets = await coremlSidecarSets(root);
  t.alike(sets.get(SET_KEY), { primary: GGUF, complete: true });
});

test('coreml sets - a missing or short file leaves the set incomplete', async (t) => {
  const root = tempRoot(t);
  writeSet(root, SET_KEY, META, { [GGUF]: 8 });
  writeSet(root, 'short', { ...META, setKey: 'short' }, { [GGUF]: 8, [MIL]: 2 });
  const sets = await coremlSidecarSets(root);
  t.is(sets.get(SET_KEY).complete, false);
  t.is(sets.get('short').complete, false);
});

test('coreml sets - a file listed outside its set folder never counts', async (t) => {
  const root = tempRoot(t);
  fs.mkdirSync(path.join(root, 'sets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'sets', 'outside.bin'), Buffer.alloc(4));
  const meta = { ...META, files: [META.files[0], { key: 'x', targetName: '../outside.bin', expectedSize: 4 }] };
  writeSet(root, SET_KEY, meta, { [GGUF]: 8 });
  const sets = await coremlSidecarSets(root);
  t.is(sets.get(SET_KEY).complete, false);
});

test('coreml sets - skips folders without valid metadata', async (t) => {
  const root = tempRoot(t);
  fs.mkdirSync(path.join(root, 'sets', 'no-metadata'), { recursive: true });
  writeSet(root, 'wrong-key', { ...META, setKey: 'other' });
  writeSet(root, 'no-primary', { setKey: 'no-primary', files: [{ key: 'x', targetName: 'x', expectedSize: 1 }] });
  const sets = await coremlSidecarSets(root);
  t.is(sets.size, 0);
});

test('coreml sets - a missing sets folder gives an empty map', async (t) => {
  const sets = await coremlSidecarSets(tempRoot(t));
  t.is(sets.size, 0);
});

test('coreml sets - a GGUF inside a complete set reads as installed', (t) => {
  const sidecarSets = new Map([[SET_KEY, { primary: GGUF, complete: true }]]);
  const entry = catalogueEntryFromName(GGUF, new Map(), new Map(), new Map(), sidecarSets);
  t.is(entry.installed, true);
  t.is(entry.companionSetKey, SET_KEY);

  const setRow = catalogueEntryFromName(SET_KEY, new Map(), new Map(), new Map(), sidecarSets);
  t.is(setRow.isCompanionSet, true, 'the set folder itself is not listed as a model');
});

test('coreml sets - the GGUF stays missing while its set is incomplete', (t) => {
  const sidecarSets = new Map([[SET_KEY, { primary: GGUF, complete: false }]]);
  // listModels counts any non-empty set folder as complete; the set's own check wins.
  const installedByName = new Map([[SET_KEY, 8]]);
  const entry = catalogueEntryFromName(GGUF, new Map(), new Map(), installedByName, sidecarSets);
  t.is(entry.installed, false);
  t.is(entry.companionSetKey, SET_KEY, 'Remove still targets the partial set');
});
