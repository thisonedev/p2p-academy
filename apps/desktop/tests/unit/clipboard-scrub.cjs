'use strict';

// Pins the clipboard scrub against a Promise-returning clipboard. Comparing the unawaited
// read with the text never matches, and the copied pairing code stays on the clipboard.

const test = require('brittle');
const { copyWithScrub } = require('../../electron/clipboard-scrub.cjs');

function fakeClipboard() {
  const state = { text: '', cleared: 0 };
  return {
    state,
    writeText: async (text) => { state.text = text; },
    readText: async () => state.text,
    clear: () => { state.text = ''; state.cleared++; },
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('clipboard scrub - clears the copied text after the delay', async (t) => {
  const clipboard = fakeClipboard();
  t.is(await copyWithScrub(clipboard, 'ABC123', 10), true);
  t.is(clipboard.state.text, 'ABC123', 'written before the handler returns');
  await wait(40);
  t.is(clipboard.state.text, '');
  t.is(clipboard.state.cleared, 1);
});

test('clipboard scrub - leaves text the user copied since', async (t) => {
  const clipboard = fakeClipboard();
  await copyWithScrub(clipboard, 'ABC123', 10);
  clipboard.state.text = 'something else';
  await wait(40);
  t.is(clipboard.state.text, 'something else');
  t.is(clipboard.state.cleared, 0);
});

test('clipboard scrub - a zero delay never clears', async (t) => {
  const clipboard = fakeClipboard();
  await copyWithScrub(clipboard, 'ABC123', 0);
  await wait(30);
  t.is(clipboard.state.text, 'ABC123');
});

test('clipboard scrub - clears when the clipboard cannot be read', async (t) => {
  const clipboard = fakeClipboard();
  clipboard.readText = async () => { throw new Error('unreadable'); };
  await copyWithScrub(clipboard, 'ABC123', 10);
  await wait(40);
  t.is(clipboard.state.cleared, 1);
});
