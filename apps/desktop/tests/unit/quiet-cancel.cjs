'use strict';

// A cancelled generate call is one log line and a value the preload script rethrows,
// so Electron never prints a stack for it. A real failure still throws.

const test = require('brittle');
const path = require('path');
const fs = require('fs');
const { isCancelError, quietCancel } = require('../../electron/quiet-cancel.cjs');

const named = (name, message) => Object.assign(new Error(message), { name });

test('quiet cancel - a cancelled load is returned, not thrown', async (t) => {
  const lines = [];
  const run = quietCancel('academy:generate-music', async () => {
    throw named('InferenceCancelledError', 'ACE-Step load cancelled');
  }, (line) => lines.push(line));
  t.alike(await run(), { academyCancelled: 'ACE-Step load cancelled' });
  t.alike(lines, ['[p2p-academy-desktop] academy:generate-music: ACE-Step load cancelled']);
});

test('quiet cancel - a real failure still throws and logs nothing', async (t) => {
  const lines = [];
  const run = quietCancel('academy:generate-image', async () => {
    throw new Error('not enough disk space');
  }, (line) => lines.push(line));
  await t.exception(run(), /not enough disk space/);
  t.is(lines.length, 0);
});

test('quiet cancel - a result passes through', async (t) => {
  const run = quietCancel('academy:generate-music', async (a) => `data:${a}`, () => {});
  t.is(await run('x'), 'data:x');
});

test('quiet cancel - what counts as a cancel', (t) => {
  t.ok(isCancelError(named('WorkerShutdownError', 'worker exited')));
  t.ok(isCancelError(new Error('Image generation stopped.')));
  t.ok(isCancelError(Object.assign(new Error('aborted'), { code: 'ABORT_ERR' })));
  t.absent(isCancelError(new Error('Model file is corrupt')));
  t.absent(isCancelError(null));
});

test('quiet cancel - every channel goes through it, on both sides', (t) => {
  const main = fs.readFileSync(path.resolve(__dirname, '../../electron/main.js'), 'utf8');
  const preload = fs.readFileSync(path.resolve(__dirname, '../../electron/preload.js'), 'utf8');
  t.ok(main.includes('await quietCancel(channel, fn)(args, evt)'), 'the handle wrapper uses it');
  // The one raw call is inside the helper that rethrows a cancel for the page.
  t.is((preload.match(/ipcRenderer\.invoke\(/g) || []).length, 1);
});
