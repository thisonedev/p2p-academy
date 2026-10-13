'use strict';

// Core pairing handshake over a real in-process DHT testnet: invite, accept,
// and what each side ends up knowing about the other.

const test = require('brittle');
const os = require('node:os');

const { createPeers, waitFor } = require('../helpers/index.cjs');

test('pairing - host and guest agree on the pair', async (t) => {
  const { peers: [host, guest] } = await createPeers(t, 2, { label: 'basic' });

  const hostPaired = waitFor(host, 'peer:paired');
  const guestPaired = waitFor(guest, 'peer:paired');

  const invite = await host.createInvite({ autoApprove: true });
  const accepted = await guest.acceptInvite(invite.invite, {
    userData: { name: 'guest-from-test', hostname: os.hostname() },
    code: invite.pairingCode,
    hostIdentity: host.getIdentity().publicKey,
  });

  const [hostEvent, guestEvent] = await Promise.all([hostPaired, guestPaired]);

  t.is(hostEvent.discoveryKey, guestEvent.discoveryKey, 'same discovery key');
  t.is(hostEvent.discoveryKey, accepted.discoveryKey, 'acceptInvite reports it too');
  t.is(hostEvent.autobaseKey, guestEvent.autobaseKey, 'same autobase key');
  t.is(hostEvent.role, 'host');
  t.is(guestEvent.role, 'guest');
});

// The pair forming at all proves the code reached the host and matched. The
// code is not kept in the peer's profile, which is emitted and written to the audit file.
test('pairing - the profile reaches the host without the pairing code', async (t) => {
  const { peers: [host, guest] } = await createPeers(t, 2, { label: 'userdata' });

  const hostPaired = waitFor(host, 'peer:paired');
  const invite = await host.createInvite({ autoApprove: true });
  await guest.acceptInvite(invite.invite, {
    userData: { name: 'guest-from-test' },
    code: invite.pairingCode,
  });

  const hostEvent = await hostPaired;
  t.is(hostEvent.userData?.name, 'guest-from-test');
  t.absent('pairingCode' in hostEvent.userData, 'the code is not stored with the profile');
  const paired = (await host.getAudit()).find((entry) => entry.type === 'peer:paired');
  t.ok(paired, 'the pairing is in the audit trail');
  t.absent(JSON.stringify(paired).includes(invite.pairingCode), 'and the code is not');
});

// The guest learns who it paired with; the host has no symmetric field to fill
// in, so its own peerInfo must leave hostIdentity null rather than echo itself.
test('pairing - hostIdentity flows to the guest only', async (t) => {
  const { peers: [host, guest], identities: [hostDevice] } = await createPeers(t, 2, { label: 'identity' });

  const hostPaired = waitFor(host, 'peer:paired');
  const guestPaired = waitFor(guest, 'peer:paired');

  const invite = await host.createInvite({ autoApprove: true });
  await guest.acceptInvite(invite.invite, {
    userData: { name: 'guest-from-test' },
    code: invite.pairingCode,
    hostIdentity: hostDevice.publicKey,
  });

  const [hostEvent, guestEvent] = await Promise.all([hostPaired, guestPaired]);

  t.is(guestEvent.hostIdentity, hostDevice.publicKey);
  t.is(hostEvent.hostIdentity, null, 'host peerInfo carries no hostIdentity');
});

// blind-pairing's handshake has no channel for the host to hand the guest
// its userData, so the guest used to fall back to displaying its own.
test('pairing - guest learns the host real name via a profile frame, not its own', async (t) => {
  const { peers: [host, guest] } = await createPeers(t, 2, { label: 'host-profile' });

  const invite = await host.createInvite({ autoApprove: true, userData: { name: 'host-from-test' } });
  await guest.acceptInvite(invite.invite, {
    userData: { name: 'guest-from-test' },
    code: invite.pairingCode,
  });

  const corrected = await waitFor(
    guest,
    'peer:paired',
    (payload) => payload.userData?.name === 'host-from-test',
    10_000,
  );
  t.is(corrected.userData?.name, 'host-from-test');
});

test('pairing - both sides list exactly one peer, and dropPeer removes it', async (t) => {
  const { peers: [host, guest] } = await createPeers(t, 2, { label: 'drop' });

  const hostPaired = waitFor(host, 'peer:paired');
  const guestPaired = waitFor(guest, 'peer:paired');
  const invite = await host.createInvite({ autoApprove: true });
  await guest.acceptInvite(invite.invite, {
    userData: { name: 'guest-from-test' },
    code: invite.pairingCode,
  });
  const [hostEvent] = await Promise.all([hostPaired, guestPaired]);

  t.is(host.listPeers().length, 1);
  t.is(guest.listPeers().length, 1);

  await host.dropPeer(hostEvent.discoveryKey);
  t.is(host.listPeers().length, 0, 'dropPeer removes the pair');
});

// Each side has to publish its own key, not echo the one it received, or a
// reconnect would knock on its own door.
test('pairing - the profile frame carries a swarm key to reconnect on', async (t) => {
  const { peers: [host, guest] } = await createPeers(t, 2, { label: 'swarm-key' });

  const invite = await host.createInvite({ autoApprove: true, userData: { name: 'host-from-test' } });
  await guest.acceptInvite(invite.invite, {
    userData: { name: 'guest-from-test' },
    code: invite.pairingCode,
  });

  const seen = await waitFor(
    guest,
    'peer:paired',
    (payload) => typeof payload.userData?.swarmPublicKey === 'string',
    10_000,
  );
  t.ok(/^[0-9a-f]{64}$/.test(seen.userData.swarmPublicKey), 'the host published a usable swarm key');

  const hostSideView = host.listPeers()[0];
  t.ok(
    /^[0-9a-f]{64}$/.test(hostSideView?.userData?.swarmPublicKey ?? ''),
    'and the guest published one back',
  );
  t.not(
    seen.userData.swarmPublicKey,
    hostSideView.userData.swarmPublicKey,
    'each side reports its own, not a reflection of the other',
  );
});
