'use strict';

// Everything a pairing device sends is unauthenticated input. These pin what
// the host keeps of it, which is also what reaches the renderer and the audit file.

const test = require('brittle');
const {
  MAX_FRAME_BYTES,
  MAX_FRAME_BYTES_BY_KIND,
  parseFrame,
  frameProblem,
  FRAME_KINDS,
  MAX_PROFILE_FRAME_BYTES,
  sanitizeProfileUserData,
  readPairingUserData,
  encodeFrame,
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

test('peer-messages - a pairing request carries its exec protocol version only as an integer', (t) => {
  t.is(readPairingUserData(frame({ name: 'Laptop', execProtocolVersion: 1 })).execVersion, 1);
  t.is(readPairingUserData(frame({ name: 'Laptop' })).execVersion, null, 'an older release sends none');
  t.is(readPairingUserData(frame({ name: 'Laptop', execProtocolVersion: '1' })).execVersion, null);
  t.is(readPairingUserData(frame({ name: 'Laptop', execProtocolVersion: 1.5 })).execVersion, null);
});

test('peer-messages - oversized, malformed, and mistyped pairing data is dropped', (t) => {
  const empty = { userData: null, enteredCode: null, execVersion: null };

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
// is read, so these are the bounds on what a peer can make this process decode.
test('peer-messages - a frame over the cap is dropped', (t) => {
  t.is(parseFrame(Buffer.alloc(MAX_FRAME_BYTES + 1, 0x07)), null);
  t.alike(parseFrame(encodeFrame({ kind: 'cancel' })), { kind: 'cancel' });
});

test('peer-messages - only a whole frame of a known kind decodes', (t) => {
  const chunk = encodeFrame({ kind: 'chunk', runId: 'r', stream: 'stdout', data: 'hi' });
  t.is(parseFrame(chunk).data, 'hi');
  t.is(parseFrame(null), null);
  t.is(parseFrame(Buffer.alloc(0)), null);
  t.is(parseFrame(Buffer.from('plain stdout')), null, 'text is not a frame');
  t.is(parseFrame(Buffer.from(JSON.stringify({ kind: 'cancel' }))), null, 'nor is the old JSON form');
  t.is(parseFrame(Buffer.from([99])), null, 'an unknown kind tag');
  t.is(parseFrame(chunk.subarray(0, chunk.length - 1)), null, 'a frame that ends early');
  t.is(parseFrame(Buffer.concat([chunk, Buffer.from([0])])), null, 'a frame with bytes left over');
  t.is(parseFrame(Buffer.from([7, 1])), null, 'an optional field the kind does not have');
});

test('peer-messages - control frames have their own smaller caps', (t) => {
  for (const cap of Object.values(MAX_FRAME_BYTES_BY_KIND)) t.ok(cap < MAX_FRAME_BYTES);
  const over = {
    'pairing-response': { kind: 'pairing-response', response: Buffer.alloc(1024, 1) },
    'identity-hello': { kind: 'identity-hello', nonce: KEY, devicePublicKey: KEY, proof: 'A'.repeat(8192) },
    'peer-profile': { kind: 'peer-profile', userData: { name: 'x'.repeat(MAX_PROFILE_FRAME_BYTES) } },
  };
  for (const [kind, msg] of Object.entries(over)) {
    const buf = encodeFrame(msg);
    t.ok(buf.length > MAX_FRAME_BYTES_BY_KIND[kind], `${kind} example is over its cap`);
    t.is(parseFrame(buf), null, `${kind} over its cap is dropped`);
  }
  t.ok(parseFrame(encodeFrame({ kind: 'pairing-wake' })), 'a real pairing-wake frame fits');
  // A run request is the one kind allowed to use the whole frame cap.
  t.ok(parseFrame(encodeFrame({ ...VALID.request, code: 'x'.repeat(100_000) })));
});

// One valid example per kind, each as its sender in workers/peer builds it.
const VALID = {
  'pairing-wake': { kind: 'pairing-wake' },
  'pairing-response': { kind: 'pairing-response', response: Buffer.from('AAAA') },
  'identity-hello': { kind: 'identity-hello', nonce: KEY, devicePublicKey: KEY, identityPublicKey: null, proof: null },
  'identity-proof': { kind: 'identity-proof', nonce: KEY, signature: 'A'.repeat(88) },
  'peer-profile': { kind: 'peer-profile', userData: { name: 'Laptop' } },
  request: {
    kind: 'request',
    runId: 'run-1',
    code: 'console.log(1)',
    mode: 'file',
    argv: ['--flag'],
    fileName: 'snippet.mts',
    label: null,
    declared: { network: 'all', device: ['microphone'], lessonReference: 'ref', rawSource: 'raw' },
  },
  cancel: { kind: 'cancel' },
  started: { kind: 'started', runId: 'run-1', mode: 'file', fileName: 'snippet.mts', label: 'Lesson' },
  chunk: { kind: 'chunk', runId: 'run-1', stream: 'stdout', data: 'hi\n' },
  exit: { kind: 'exit', runId: 'run-1', code: 0, signal: null, mode: 'file', fileName: 'snippet.mts' },
  error: { kind: 'error', runId: 'run-1', code: 'consent-denied', message: 'refused', devices: ['microphone'], network: 'it needs the network' },
};

test('peer-messages - every kind round-trips and the decoded frame passes its shape', (t) => {
  t.alike(Object.keys(VALID).sort(), FRAME_KINDS.slice().sort(), 'the examples cover every kind');
  for (const [kind, msg] of Object.entries(VALID)) {
    const decoded = parseFrame(encodeFrame(msg));
    const sent = Object.fromEntries(Object.entries(msg).filter(([, v]) => v != null));
    t.alike(decoded, sent, `${kind} decodes to what was sent, absent fields left out`);
    t.is(frameProblem(decoded), null, kind);
  }
});

test('peer-messages - a malformed frame fails on the sending side', (t) => {
  t.exception(() => encodeFrame({ ...VALID.request, cwd: '/etc' }), /unexpected field "cwd"/);
  t.exception(() => encodeFrame({ kind: 'shell' }), /unknown kind/);
});

test('peer-messages - a profile frame carries only the profile fields', (t) => {
  const decoded = parseFrame(encodeFrame({ kind: 'peer-profile', userData: { name: 'Laptop', hostname: 'secret' } }));
  t.alike(decoded.userData, { name: 'Laptop' });
});

test('peer-messages - an extra, missing, or mistyped field fails the shape', (t) => {
  for (const [kind, msg] of Object.entries(VALID)) {
    t.is(frameProblem({ ...msg, extra: 1 }), 'unexpected field "extra"', `${kind}: an extra field`);
  }
  t.is(frameProblem({ ...VALID.request, cwd: '/etc' }), 'unexpected field "cwd"', 'a request cannot name a working directory');

  const { code: _code, ...noCode } = VALID.request;
  t.is(frameProblem(noCode), 'invalid field "code"');
  t.is(frameProblem({ ...VALID.request, runId: '' }), 'invalid field "runId"');
  t.is(frameProblem({ ...VALID.request, mode: 'shell' }), 'invalid field "mode"');
  t.is(frameProblem({ ...VALID.request, argv: 'one string' }), 'invalid field "argv"');
  t.is(frameProblem({ ...VALID.request, argv: Array(33).fill('a') }), 'invalid field "argv"');
  t.is(frameProblem({ ...VALID.request, declared: { network: 'everything' } }), 'invalid field "declared"');
  t.is(frameProblem({ ...VALID.request, declared: { shell: true } }), 'invalid field "declared"');
  t.is(frameProblem({ ...VALID.chunk, stream: 'exit' }), 'invalid field "stream"');
  t.is(frameProblem({ ...VALID.chunk, data: { toString: 1 } }), 'invalid field "data"');
  t.is(frameProblem({ ...VALID.exit, code: '0' }), 'invalid field "code"');
  t.is(frameProblem({ ...VALID['pairing-response'], response: Buffer.alloc(0) }), 'invalid field "response"');
  t.is(frameProblem({ ...VALID['pairing-response'], response: 'AAAA' }), 'invalid field "response"');
  t.is(frameProblem({ ...VALID['peer-profile'], userData: 'Laptop' }), 'invalid field "userData"');
});

test('peer-messages - an unknown kind is refused, including prototype names', (t) => {
  t.is(frameProblem({ kind: 'shell' }), 'unknown kind');
  t.is(frameProblem({ kind: 'constructor' }), 'unknown kind');
  t.is(frameProblem({ kind: '__proto__' }), 'unknown kind');
  t.is(frameProblem(null), 'not a frame');
  t.is(frameProblem({ kind: 7 }), 'not a frame');
});
