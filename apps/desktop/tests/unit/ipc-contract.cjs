'use strict';

const test = require('brittle');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'electron/preload.js'), 'utf8');
const registry = require(path.join(root, 'shared/ipc-channels.cjs'));
const pushChannels = require(path.join(root, 'shared/ipc-push-channels.cjs'));

// Match `handle('channel'` but not `protocol.handle('scheme'`. Only the
// IPC wrapper registers IPC channels, not the protocol handler.
const registered = [...main.matchAll(/(?<![\w.])handle\('([^']+)'/g)].map(
  (match) => match[1],
);
const pushed = [...main.matchAll(/(?:sendToAll|\.send)\('([^']+)'/g)].map((match) => match[1]);
// preload.js is sandboxed and cannot require the registry, so its literals are checked here.
const preloadCalls = [...preload.matchAll(/(?:invoke|sendSync)\('([^']+)'/g)].map((match) => match[1]);
const preloadSubscriptions = [...preload.matchAll(/ipcRenderer\.on\('([^']+)'/g)].map((match) => match[1]);
const dynamic = [...main.matchAll(/handle\(`([^`$]+)\$\{[^}]+\}([^`]*)`/g)].map(
  (match) => `${match[1]}${match[2]}`,
);

test('ipc contract keeps literal handlers in the registry', (t) => {
  for (const channel of registered) t.ok(Object.hasOwn(registry, channel), channel);
  t.ok(registered.length > 0, 'found wrapped handlers');
  t.ok(dynamic.includes('pear:worker:writeIPC:'), 'found dynamic worker handler');
});

test('ipc contract leaves only the wrapper registrations', (t) => {
  // The wrapper is the only direct ipcMain.handle call. protocol.handle
  // is the protocol scheme, not an IPC channel, and is counted
  // separately.
  const count = (main.match(/ipcMain\.handle\(/g) || []).length;
  t.is(count, 1);
});

test('ipc contract registry schemas resolve to validation exports', async (t) => {
  const validation = await import('@academy/validation');
  for (const [channel, schemaName] of Object.entries(registry)) {
    if (channel === 'pkg' || channel.endsWith(':') || channel === 'PEAR_WORKER_PREFIX') continue;
    if (schemaName !== null) t.ok(schemaName in validation, `${channel}: ${schemaName}`);
  }
});

test('ipc contract has no stale literal registry entries', (t) => {
  for (const channel of Object.keys(registry)) {
    if (channel === 'pkg' || channel.endsWith(':') || channel === 'PEAR_WORKER_PREFIX') continue;
    t.ok(registered.includes(channel) || channel === 'academy:run', channel);
  }
});

test('ipc contract keeps preload calls in the registry', (t) => {
  t.ok(preloadCalls.length > 0, 'found preload calls');
  for (const channel of preloadCalls) t.ok(Object.hasOwn(registry, channel), channel);
});

test('ipc contract keeps pushed channels in the push list', (t) => {
  t.ok(pushed.length > 0, 'found pushed channels');
  for (const channel of pushed) t.ok(pushChannels.includes(channel), `main sends ${channel}`);
  for (const channel of preloadSubscriptions) t.ok(pushChannels.includes(channel), `preload listens to ${channel}`);
  for (const channel of pushChannels) {
    t.ok(pushed.includes(channel), `main sends listed ${channel}`);
    t.ok(preloadSubscriptions.includes(channel), `preload listens to listed ${channel}`);
  }
});
