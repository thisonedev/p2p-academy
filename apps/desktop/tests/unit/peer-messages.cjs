'use strict';

// Everything a pairing device sends is unauthenticated input. These pin what
// the host keeps of it, which is also what reaches the renderer and the audit file.

const test = require('brittle');
const {
  MAX_PROFILE_FRAME_BYTES,
  sanitizeProfileUserData,
  readPairingUserData,
} = require('../../workers/peer/peer-messages.cjs');

const KEY = 'ab'.repeat(32);
const frame = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value), 'utf8');

test('peer-messages - a pairing request yields a bounded profile and the code, apart', (t) => {
  const { userData, enteredCode } = readPairingUserData(frame({
    name: 'Laptop',
    app: 'p2p-academy',
    os: 'mac',
    buildId: 'p2p-academy-desktop',
    devicePublicKey: KEY,
    swarmPublicKey: KEY,
    pairingCode: 'ABC234',
    extra: { nested: 'x'.repeat(500) },
  }));

  t.is(enteredCode, 'ABC234');
  t.alike(userData, {
    name: 'Laptop',
    app: 'p2p-academy',
    os: 'mac',
    buildId: 'p2p-academy-desktop',
    devicePublicKey: KEY,
    swarmPublicKey: KEY,
  });
  t.absent('pairingCode' in userData, 'the code is not part of what gets stored or logged');
  t.absent('extra' in userData, 'unknown fields are dropped');
});

test('peer-messages - oversized, malformed, and mistyped pairing data is dropped', (t) => {
  const empty = { userData: null, enteredCode: null };

  t.alike(readPairingUserData(null), empty);
  t.alike(readPairingUserData(Buffer.alloc(0)), empty);
  t.alike(readPairingUserData(frame('{not json')), empty);
  t.alike(readPairingUserData(frame('"a string"')), empty);
  t.alike(readPairingUserData(frame([1, 2])), empty);
  t.alike(
    readPairingUserData(frame({ name: 'x'.repeat(MAX_PROFILE_FRAME_BYTES), pairingCode: 'ABC234' })),
    empty,
    'a frame over the cap is never parsed',
  );

  const mistyped = readPairingUserData(frame({ name: 'Laptop', pairingCode: { toString: 'x' }, devicePublicKey: 'nope' }));
  t.is(mistyped.enteredCode, null, 'a code that is not a string is no code');
  t.is(mistyped.userData.devicePublicKey, null, 'a key that is not 64 hex characters is dropped');

  const long = readPairingUserData(frame({ name: 'n'.repeat(900), pairingCode: 'A'.repeat(900) }));
  t.is(long.userData.name.length, 200);
  t.is(long.enteredCode.length, 64);
});

test('peer-messages - a profile needs a name', (t) => {
  t.is(sanitizeProfileUserData({ app: 'p2p-academy' }), null);
  t.is(sanitizeProfileUserData({ name: 42 }), null);
  t.is(sanitizeProfileUserData('Laptop'), null);
});
