'use strict';

// Pins unstreamed() (packages/ui build output): a stopped or failed run appends only
// the part of the host's final output the live stream did not already show.

const test = require('brittle');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () =>
  import(pathToFileURL(path.join(__dirname, '../../../../packages/ui/dist/components/lesson/run-helpers.js')).href);

function stream(chunks) {
  const text = { stdout: '', stderr: '' };
  for (const c of chunks) text[c.stream] += c.data;
  return text;
}

test('unstreamed - stderr in the middle of a stdout line adds nothing', async (t) => {
  const { unstreamed } = await load();
  const streamed = stream([
    { stream: 'stdout', data: 'It is sunny.' },
    { stream: 'stderr', data: '✖ Turn failed\n' },
    { stream: 'stdout', data: '\n▸ Listening...\n' },
  ]);
  t.is(unstreamed(`${streamed.stdout}${streamed.stderr}`, streamed), '');
});

test('unstreamed - keeps the host note the stream never carried', async (t) => {
  const { unstreamed } = await load();
  const streamed = stream([
    { stream: 'stdout', data: 'done\n' },
    { stream: 'stderr', data: 'warn\n' },
  ]);
  const output = `${streamed.stdout}${streamed.stderr}\n[runner] stop sent but the process did not exit; treating the run as stopped`;
  t.is(unstreamed(output, streamed), '[runner] stop sent but the process did not exit; treating the run as stopped');
});

test('unstreamed - nothing streamed returns the whole output', async (t) => {
  const { unstreamed } = await load();
  t.is(unstreamed('[runner] aborted before spawn', { stdout: '', stderr: '' }), '[runner] aborted before spawn');
});
