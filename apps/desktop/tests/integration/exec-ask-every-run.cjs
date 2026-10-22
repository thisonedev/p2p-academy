'use strict';

// A run that needs no device and no network starts without a prompt, unless
// the host turned on "ask before every run" for that paired device. Runs
// through the worker so the setting crosses the real RPC boundary.

const test = require('brittle');
const os = require('node:os');

const { createWorkerPeers, runExec, waitFor, waitForExecChannel } = require('../helpers/index.cjs');

const PAIR_TIMEOUT_MS = 45_000;
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

test('ask-every-run - off by default, a compute-only run starts without a prompt', async (t) => {
  const { host, guest, hostKey, peerId } = await pairedGuest(t, 'ask-off');

  const [entry] = (await host.listPeers()).filter((p) => p.discoveryKey === hostKey);
  t.is(entry.askEveryRun, false, 'a new pairing does not ask');

  let prompted = false;
  const off = host.on((event) => {
    if (event === 'peer:exec:device-request') prompted = true;
  });
  t.teardown(off);

  const result = await runExec(guest, { peerId, mode: 'inline', code: COMPUTE_ONLY }, 40_000);
  t.ok(result.stdout.includes('SUM:5'), `the run finished; got ${result.stdout.trim()}`);
  t.absent(prompted, 'no consent prompt was raised');
});

test('ask-every-run - on, a compute-only run waits for the host', async (t) => {
  const { host, guest, hostKey, peerId } = await pairedGuest(t, 'ask-on');

  t.is(await host.setAskEveryRun(hostKey, true), true, 'the host turns the setting on');
  const [entry] = (await host.listPeers()).filter((p) => p.discoveryKey === hostKey);
  t.is(entry.askEveryRun, true, 'the peer list reports it');
  t.is(await guest.setAskEveryRun(peerId, true), false, 'a guest-role entry refuses the setting');

  const requested = waitFor(host, 'peer:exec:device-request', null, 20_000);
  const run = runExec(guest, { peerId, mode: 'inline', code: COMPUTE_ONLY }, 40_000);
  const request = await requested;
  t.alike(request.devices, [], 'the prompt asks for no device');
  t.is(request.network, null, 'the prompt asks for no network');

  t.is(await host.resolveDeviceRequest(request.requestId, true), true);
  const result = await run;
  t.ok(result.stdout.includes('SUM:5'), `the approved run finished; got ${result.stdout.trim()}`);
});

test('ask-every-run - on, a denied compute-only run never runs', async (t) => {
  const { host, guest, hostKey, peerId } = await pairedGuest(t, 'ask-deny');
  await host.setAskEveryRun(hostKey, true);

  const requested = waitFor(host, 'peer:exec:device-request', null, 20_000);
  const run = runExec(guest, { peerId, mode: 'inline', code: COMPUTE_ONLY }, 40_000).then(
    (ok) => ({ ok }),
    (err) => ({ err }),
  );
  const request = await requested;
  t.is(await host.resolveDeviceRequest(request.requestId, false), true);

  const outcome = await run;
  const message = outcome.err ? outcome.err.message : outcome.ok.stderr + outcome.ok.stdout;
  t.ok(/not approved/i.test(message), `the refusal says so; got: ${message}`);
  t.absent(/SUM:/.test(message), 'a denied run does not execute');
});
