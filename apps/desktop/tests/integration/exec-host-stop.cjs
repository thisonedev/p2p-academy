'use strict';

// The host's own Stop on a guest's run. It ends that run, keeps the pair, and
// tells the guest the host did it. Runs through the worker so the call
// crosses the real RPC boundary.

const test = require('brittle');
const os = require('node:os');

const { createWorkerPeers, runExec, waitFor, waitForExecChannel } = require('../helpers/index.cjs');

const PAIR_TIMEOUT_MS = 45_000;
const KEEPS_RUNNING = "console.log('started'); setInterval(() => {}, 1000);";
const COMPUTE_ONLY = "console.log('SUM:' + (2 + 3));";

async function pairedGuest(t, label) {
  const { clients: [host, guest] } = await createWorkerPeers(t, 2, { label });

  const hostPaired = waitFor(host, 'peer:paired', null, PAIR_TIMEOUT_MS);
  const guestPaired = waitFor(guest, 'peer:paired', null, PAIR_TIMEOUT_MS);
  const invite = await host.createInvite({ autoApprove: true });
  await guest.acceptInvite(invite.invite, {
    userData: { name: `${label}-guest`, hostname: os.hostname() },
    code: invite.pairingCode,
  });
  const [hostEvent, guestEvent] = await Promise.all([hostPaired, guestPaired]);

  await waitForExecChannel(guest, guestEvent.discoveryKey, 10_000);
  return { host, guest, hostKey: hostEvent.discoveryKey, peerId: guestEvent.discoveryKey };
}

test('host-stop - ends the run, keeps the pair, and the guest learns who stopped it', async (t) => {
  const { host, guest, hostKey, peerId } = await pairedGuest(t, 'host-stop');

  let stopped = null;
  const result = await runExec(
    guest,
    {
      peerId,
      mode: 'inline',
      code: KEEPS_RUNNING,
      onStdout: (stdout) => {
        if (stdout.includes('started') && !stopped) stopped = host.stopHostedRun(hostKey);
      },
    },
    20_000,
  );
  t.is(await stopped, true, 'the host stop call reports a run was stopped');
  t.is(result.cancelled, true, 'the guest sees the run as cancelled');
  t.is(result.stoppedByHost, true, 'the guest sees the host stopped it');

  // The channel probe run wrote entries too; the stopped run's are the newest.
  const audit = await host.getAudit({ limit: 50 });
  const newest = (type) =>
    audit
      .filter((e) => e.type === type && e.discoveryKey === hostKey)
      .reduce((a, b) => (!a || b.timestamp >= a.timestamp ? b : a), null);
  const started = newest('peer:exec:started');
  t.is(started?.network, 'none', 'the started entry records the network mode');
  t.alike(started?.devices, [], 'the started entry records the devices asked for');
  t.is(started?.asked, false, 'the started entry records that the host was not asked');
  const finished = newest('peer:exec:finished');
  t.is(finished?.stoppedByHost, true, 'the finished entry records the host stop');

  t.ok((await host.listPeers()).some((p) => p.discoveryKey === hostKey), 'the pair stays');
  const again = await runExec(guest, { peerId, mode: 'inline', code: COMPUTE_ONLY }, 40_000);
  t.ok(again.stdout.includes('SUM:5'), `the guest can run again; got ${again.stdout.trim()}`);
});

test('host-stop - refuses with no run going, and on a guest-role entry', async (t) => {
  const { host, guest, hostKey, peerId } = await pairedGuest(t, 'host-stop-none');
  t.is(await host.stopHostedRun(hostKey), false, 'nothing to stop');
  t.is(await guest.stopHostedRun(peerId), false, 'a guest-role entry has no hosted run');
});
