'use strict';

// Everything a pairing device sends is unauthenticated input. These pin what
// the host keeps of it, which is also what reaches the renderer and the audit file.

const test = require('brittle');
const {
  MAX_FRAME_BYTES,
  MAX_FRAME_BYTES_BY_KIND,
  parseFrame,
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

// Every frame from another device goes through parseFrame before any field
// is read, so these are the bounds on what a peer can make this process parse.
test('peer-messages - a frame over the cap is dropped without being parsed', (t) => {
  const original = JSON.parse;
  let parsed = 0;
  JSON.parse = (...args) => {
    parsed += 1;
    return original(...args);
  };
  t.teardown(() => { JSON.parse = original; });

  const huge = Buffer.alloc(MAX_FRAME_BYTES + 1, 0x20);
  huge.write('{"kind":"request","code":"', 0);
  t.is(parseFrame(huge), null);
  t.is(parsed, 0, 'the oversized frame never reached JSON.parse');

  t.alike(parseFrame(frame({ kind: 'cancel' })), { kind: 'cancel' });
  t.is(parsed, 1);
});

test('peer-messages - only a JSON object with a string kind is a frame', (t) => {
  t.is(parseFrame(null), null);
  t.is(parseFrame(Buffer.alloc(0)), null);
  t.is(parseFrame(frame('plain stdout')), null);
  t.is(parseFrame(frame('[{"kind":"cancel"}]')), null);
  t.is(parseFrame(frame('"cancel"')), null);
  t.is(parseFrame(frame({ kind: 7 })), null);
  t.is(parseFrame(frame({ code: 'x' })), null);
  t.alike(parseFrame(frame({ kind: 'chunk', runId: 'r', stream: 'stdout', data: 'hi' })).data, 'hi');
});

test('peer-messages - control frames have their own smaller caps', (t) => {
  for (const [kind, cap] of Object.entries(MAX_FRAME_BYTES_BY_KIND)) {
    const padding = 'x'.repeat(cap);
    t.is(parseFrame(frame({ kind, padding })), null, `${kind} over ${cap} bytes is dropped`);
    t.ok(cap < MAX_FRAME_BYTES);
  }
  t.ok(parseFrame(frame({ kind: 'pairing-wake' })), 'a real pairing-wake frame fits');
  // A run request is the one kind allowed to use the whole frame cap.
  t.ok(parseFrame(frame({ kind: 'request', code: 'x'.repeat(100_000) })));
  // A kind named like an Object.prototype key still gets the default cap.
  t.ok(parseFrame(frame({ kind: 'constructor' })));
});
