'use strict';

// Pins the lesson console's stage marker parsing (packages/ui build output). A long run
// of spaces must not make it slow, since console lines come from the lesson run.

const test = require('brittle');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () =>
  import(pathToFileURL(path.join(__dirname, '../../../../packages/ui/dist/components/lesson/stages.js')).href);

test('stage markers - open', async (t) => {
  const { parseStageOpen } = await load();
  t.is(parseStageOpen('→ Preparing packages...'), 'Preparing packages...');
  t.is(parseStageOpen('→   loadModel({ ctx })   '), 'loadModel({ ctx })');
  t.is(parseStageOpen('→Preparing'), null, 'needs a space after the arrow');
  t.is(parseStageOpen('→    '), null);
  t.is(parseStageOpen('x → Preparing'), null);
});

test('stage markers - close with and without seconds', async (t) => {
  const { parseStageClose } = await load();
  t.alike(parseStageClose('✓ Device verified'), { label: 'Device verified', seconds: null });
  t.alike(parseStageClose('  ✓ Built (1.25s)  '), { label: 'Built', seconds: 1.25 });
  t.alike(parseStageClose('✓ (2s)'), { label: '(2s)', seconds: null }, 'a lone suffix is the label');
  t.is(parseStageClose('✓done'), null);
  t.is(parseStageClose('✓   '), null);
});

test('stage markers - a long run of spaces stays fast', async (t) => {
  const { parseStageOpen, parseStageClose } = await load();
  const spaces = ' '.repeat(200_000);
  const started = Date.now();
  parseStageOpen(`→${spaces}x${spaces}\n`);
  parseStageClose(`✓${spaces}x${spaces}(1s`);
  t.ok(Date.now() - started < 1000, `took ${Date.now() - started} ms`);
});
