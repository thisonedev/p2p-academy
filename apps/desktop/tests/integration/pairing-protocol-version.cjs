'use strict';

// A guest sends its exec protocol version with the pairing request, and the
// host refuses another version, or none from an older release, before anyone
// is asked to approve it. The audit trail says why.

const test = require('brittle');

const { createPeers, waitFor } = require('../helpers/index.cjs');
const { EXEC_PROTOCOL } = require('../../workers/peer/index.cjs');

const PAIR_TIMEOUT_MS = 30_000;

async function refusedGuest(t, label, execProtocol) {
  const { peers: [host, guest] } = await createPeers(t, 2, { label });
  guest._testHooks.setExecProtocol(execProtocol);

  const refused = waitFor(
    host,
    'peer:audit',
    (a) => a.type === 'peer:rejected' && a.reason === 'protocol-version',
    PAIR_TIMEOUT_MS,
  );
  const invite = await host.createInvite();
  guest
    .acceptInvite(invite.invite, { userData: { name: `${label}-guest` }, code: invite.pairingCode })
    .catch(() => {});
  const audit = await refused;
  t.is(host.listPending().length, 0, 'no approval prompt for it');
  t.is(host.listPeers().length, 0, 'and nothing paired');
  return audit;
}

test('protocol version - a guest on another version is refused at pairing', async (t) => {
  const audit = await refusedGuest(t, 'proto-v2', { protocol: EXEC_PROTOCOL, version: 2 });
  t.is(audit.remoteVersion, 2, 'the audit names the version the other device sent');
});

test('protocol version - an older release with no version is refused at pairing', async (t) => {
  const audit = await refusedGuest(t, 'proto-legacy', { protocol: 'academy-exec', version: null });
  t.is(audit.remoteVersion, null, 'an older release sends no version');
});

test('protocol version - a channel opened with another version is closed and the pair dropped', async (t) => {
  const { peers: [host, guest] } = await createPeers(t, 2, { label: 'proto-channel' });
  guest._testHooks.setExecProtocol({ protocol: EXEC_PROTOCOL, version: 2, pairingVersion: 1 });

  const refused = waitFor(
    host,
    'peer:audit',
    (a) => a.type === 'peer:rejected' && a.reason === 'protocol-version',
    PAIR_TIMEOUT_MS,
  );
  const dropped = waitFor(host, 'peer:dropped', null, PAIR_TIMEOUT_MS);
  const invite = await host.createInvite({ autoApprove: true });
  guest
    .acceptInvite(invite.invite, { userData: { name: 'channel-guest' }, code: invite.pairingCode })
    .catch(() => {});

  const audit = await refused;
  t.is(audit.remoteVersion, 2, 'the version from the channel handshake is recorded');
  await dropped;
  t.is(host.listPeers().length, 0, 'the device is not left paired without a channel');
});

test('protocol version - matching versions open the channel and verify', async (t) => {
  const { peers: [host, guest] } = await createPeers(t, 2, { label: 'proto-match' });
  const verified = waitFor(host, 'peer:identity-verified', (p) => p.identityVerified, PAIR_TIMEOUT_MS);
  const invite = await host.createInvite({ autoApprove: true });
  await guest.acceptInvite(invite.invite, { userData: { name: 'match-guest' }, code: invite.pairingCode });
  await verified;
  t.absent(
    host.getAudit().some((e) => e.reason === 'protocol-version'),
    'no version refusal between two current devices',
  );
});
