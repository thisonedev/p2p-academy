'use strict';

// The bare-rpc boundary between the Electron main process and the Bare worker
// hosting peer.cjs. All of this also works in-process (pairing.cjs, exec.cjs);
// this proves it survives the RPC channel, including the worker-to-main push commands carrying streamed exec output.

const test = require('brittle');
const os = require('node:os');

const path = require('node:path');

const { createWorkerPeers, runExec, waitFor, waitForExecChannel } = require('../helpers/index.cjs');
const { buildLesson } = require('../../electron/runner-process.cjs');

// The directory worker-client.cjs rebuilds a declared source against.
const COURSES_DIR = path.resolve(__dirname, '../../../../packages/courses');

const LESSON_SOURCE = [
  'import { close } from "@qvac/sdk";',
  '',
  'async function main() {',
  '  process.stdout.write("source-check:ran close=" + (typeof close) + "\\n");',
  '}',
  '',
  'main().catch((err) => { console.error(err); process.exit(1); });',
  '',
].join('\n');

// The worker path adds an RPC round-trip and a process spawn on top of the DHT handshake; a tighter bound failed intermittently.
const PAIR_TIMEOUT_MS = 30_000;

async function pairWorkers(t, label, init) {
  const { clients: [host, guest] } = await createWorkerPeers(t, 2, { label, init });

  const hostPaired = waitFor(host, 'peer:paired', null, PAIR_TIMEOUT_MS);
  const guestPaired = waitFor(guest, 'peer:paired', null, PAIR_TIMEOUT_MS);

  const invite = await host.createInvite({ autoApprove: true });
  const accepted = await guest.acceptInvite(invite.invite, {
    userData: { name: 'guest-from-rpc-test', hostname: os.hostname() },
    code: invite.pairingCode,
  });

  const [hostEvent, guestEvent] = await Promise.all([hostPaired, guestPaired]);
  return { host, guest, hostEvent, guestEvent, accepted };
}

test('worker-client - peers pair across the RPC boundary', async (t) => {
  const { hostEvent, guestEvent, accepted } = await pairWorkers(t, 'rpc-pair');

  t.is(hostEvent.discoveryKey, guestEvent.discoveryKey, 'discovery keys survive serialisation');
  t.is(accepted.discoveryKey, hostEvent.discoveryKey, 'the RPC return value agrees');
});

// listPeers is a request/response command, unlike the event push above.
test('worker-client - listPeers round-trips on both sides', async (t) => {
  const { host, guest } = await pairWorkers(t, 'rpc-list');

  t.is((await host.listPeers()).length, 1);
  t.is((await guest.listPeers()).length, 1);
});

// Exec output arrives via the worker->main push commands (EXEC_CHUNK/EXEC_EXIT), most likely to break independently of the in-process path.
test('worker-client - exec output streams back through the push commands', async (t) => {
  const { guest, guestEvent } = await pairWorkers(t, 'rpc-exec');
  await waitForExecChannel(guest, guestEvent.discoveryKey, 10_000);

  const result = await runExec(
    guest,
    {
      peerId: guestEvent.discoveryKey,
      code: 'console.log("hello-from-rpc-exec")',
      mode: 'inline',
    },
    20_000,
  );

  t.ok(result.stdout.includes('hello-from-rpc-exec'), 'stdout crossed the RPC boundary');
});

// The worker cannot build a lesson, so it asks main to (VERIFY_SOURCE). A
// broken bridge lets every run through, which only the refusal here shows.
test('worker-client - the host refuses code its own build of the declared source does not give', async (t) => {
  // The app runs a Node build on its Electron binary, so the host here gets the same one.
  const { guest, guestEvent } = await pairWorkers(t, 'rpc-source', { execPath: require('electron') });
  await waitForExecChannel(guest, guestEvent.discoveryKey, 10_000);

  const built = buildLesson({ source: LESSON_SOURCE, cwd: COURSES_DIR, runtime: 'node', portable: true });
  const send = (code) => runExec(
    guest,
    {
      peerId: guestEvent.discoveryKey,
      code,
      mode: 'file',
      cwd: COURSES_DIR,
      fileName: 'snippet.mjs',
      declared: { rawSource: LESSON_SOURCE },
    },
    30_000,
  );

  const result = await send(built);
  t.ok(result.stdout.includes('source-check:ran close=function'), `the real build runs; stderr=${result.stderr.replace(/\s*\n\s*/g, ' | ')}`);

  // A guest on another app version sends its own builder's output.
  const err = await send(`${built}\n// built by another app version\n`).then(() => null, (e) => e);
  t.ok(err, 'a build this device would not produce is refused');
  t.ok(/does not match the source sent with it/.test(err?.message ?? ''), `refused as a source mismatch; got: ${err?.message}`);
});

test('worker-client - dropPeer over RPC removes the pair', async (t) => {
  const { host, hostEvent } = await pairWorkers(t, 'rpc-drop');

  await host.dropPeer(hostEvent.discoveryKey);

  t.is((await host.listPeers()).length, 0);
});
