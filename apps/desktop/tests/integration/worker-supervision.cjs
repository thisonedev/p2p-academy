'use strict';

// A pear-end worker that dies is restarted with the same mesh arguments, and
// calls made while it is down fail with WORKER_EXITED.

const test = require('brittle');

const { createWorkerPeers, waitFor } = require('../helpers/index.cjs');

function kill(client) {
  const pid = client._workerPid();
  if (!pid) throw new Error('no worker to kill');
  process.kill(pid, 'SIGKILL');
}

test('worker-supervision - a killed worker restarts with the same identity', async (t) => {
  const {
    clients: [client],
  } = await createWorkerPeers(t, 1, { label: 'supervise-restart' });
  const before = await client.getIdentity();

  const exited = waitFor(client, 'peer:worker-exited', null, 5_000);
  const restarted = waitFor(client, 'peer:worker-restarted', null, 15_000);
  kill(client);

  const exit = await exited;
  t.is(exit.signal, 'SIGKILL', 'the exit event names the signal');
  t.is(exit.restarting, true, 'a restart is scheduled');

  // The restart waits at least RESTART_BASE_MS, so this call runs while the worker is down.
  const gapError = await client.getIdentity().then(
    () => null,
    (err) => err,
  );
  t.is(gapError?.code, 'WORKER_EXITED', 'a call in the gap fails with WORKER_EXITED');

  await restarted;
  const after = await client.getIdentity();
  t.is(after.publicKey, before.publicKey, 'the restarted worker runs the same device identity');
});

test('worker-supervision - repeated crashes stop the restart loop', async (t) => {
  t.timeout(60_000);
  const {
    clients: [client],
  } = await createWorkerPeers(t, 1, { label: 'supervise-limit' });

  // MAX_RESTARTS is 3: three kills restart, the fourth gives up.
  for (let i = 0; i < 3; i++) {
    const restarted = waitFor(client, 'peer:worker-restarted', null, 20_000);
    kill(client);
    await restarted;
  }
  const exited = waitFor(client, 'peer:worker-exited', null, 5_000);
  kill(client);
  t.is((await exited).restarting, false, 'the fourth crash in the window is not restarted');
  await t.exception(client.getIdentity(), /not initialized/, 'calls fail until the next init()');
});

test('worker-supervision - shutdownWorker does not trigger a restart', async (t) => {
  const {
    clients: [client],
  } = await createWorkerPeers(t, 1, { label: 'supervise-shutdown' });

  await client.shutdownWorker();
  // Longer than RESTART_BASE_MS, so a scheduled restart would have spawned by now.
  await new Promise((resolve) => setTimeout(resolve, 2_000));

  t.is(client._workerPid(), null, 'no worker was respawned');
});
