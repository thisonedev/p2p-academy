// What a paired or pairing device sends is read here before any of it is
// stored, shown, or logged. Pure functions, so the bounds are testable without a swarm.
'use strict';

const { MAX_EXEC_ARGV, MAX_EXEC_ARGV_ENTRY } = require('./exec-validate.cjs');

// The largest frame is a run request. Its code is capped at 1,000,000 bytes
// (exec-validate.cjs) and its lesson source at as many characters
// (exec-host.cjs), both before JSON escaping.
const MAX_FRAME_BYTES = 4 * 1024 * 1024;
// A profile is a name and a few short fields.
const MAX_PROFILE_FRAME_BYTES = 4096;
// Control frames are far smaller than a run request, so each kind has its own
// cap. A measured pairing response is 153 bytes and a handshake frame a few hundred.
const MAX_FRAME_BYTES_BY_KIND = {
  'pairing-wake': 64,
  'pairing-response': 1024,
  'identity-hello': 8192,
  'identity-proof': 8192,
  'peer-profile': MAX_PROFILE_FRAME_BYTES,
  cancel: 64,
};
const HEX_64 = /^[0-9a-fA-F]{64}$/;

// Only the fields the UI actually reads, each bounded; anything else in the
// frame is dropped rather than stored.
function sanitizeProfileUserData(userData) {
  if (!userData || typeof userData !== 'object') return null;
  const name = typeof userData.name === 'string' ? userData.name.slice(0, 200) : null;
  if (!name) return null;
  return {
    name,
    app: typeof userData.app === 'string' ? userData.app.slice(0, 200) : null,
    // Self-reported, same trust level as `name`: lets the other side's peer
    // picker flag a Windows peer as execute-only, nothing more.
    os: typeof userData.os === 'string' ? userData.os.slice(0, 40) : null,
    buildId: typeof userData.buildId === 'string' ? userData.buildId.slice(0, 200) : null,
    devicePublicKey: typeof userData.devicePublicKey === 'string' && HEX_64.test(userData.devicePublicKey)
      ? userData.devicePublicKey
      : null,
    // Where to find this peer again without an invite. Derived from their
    // identity, so it is the same on their next run. Self-reported like the
    // rest of this frame: it only says where to knock, never who answers.
    swarmPublicKey: typeof userData.swarmPublicKey === 'string' && HEX_64.test(userData.swarmPublicKey)
      ? userData.swarmPublicKey
      : null,
  };
}

/**
 * The userData a guest sends with its pairing request: a profile and the
 * pairing code. The code is returned on its own, never inside the profile.
 * @param {Uint8Array | null | undefined} buf
 * @returns {{ userData: ReturnType<typeof sanitizeProfileUserData>, enteredCode: string | null }}
 */
function readPairingUserData(buf) {
  const empty = { userData: null, enteredCode: null };
  if (!buf || buf.length === 0 || buf.length > MAX_PROFILE_FRAME_BYTES) return empty;
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(buf).toString('utf8'));
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return empty;
  return {
    userData: sanitizeProfileUserData(parsed),
    // pairing-code.cjs rejects a code of the wrong length, so this cap only
    // bounds what the pending request holds.
    enteredCode: typeof parsed.pairingCode === 'string' ? parsed.pairingCode.slice(0, 64) : null,
  };
}

/**
 * The one place a frame from another device becomes an object. A frame over
 * the cap is dropped unparsed. Returns null for anything that is not a JSON
 * object with a string `kind`, or that is over the cap for its kind.
 * @param {Uint8Array | null | undefined} buf
 * @returns {{ kind: string, [key: string]: unknown } | null}
 */
function parseFrame(buf) {
  if (!buf || buf.length === 0 || buf.length > MAX_FRAME_BYTES) return null;
  let msg;
  try {
    msg = JSON.parse(Buffer.from(buf).toString('utf8'));
  } catch {
    return null;
  }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.kind !== 'string') return null;
  const cap = Object.hasOwn(MAX_FRAME_BYTES_BY_KIND, msg.kind) ? MAX_FRAME_BYTES_BY_KIND[msg.kind] : MAX_FRAME_BYTES;
  return buf.length > cap ? null : msg;
}

const str = (max) => (v) => typeof v === 'string' && v.length <= max;
const filled = (max) => (v) => typeof v === 'string' && v.length > 0 && v.length <= max;
const maybe = (check) => (v) => v == null || check(v);
const list = (check, max) => (v) => Array.isArray(v) && v.length <= max && v.every(check);
const oneOf = (...values) => (v) => values.includes(v);
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * A check for one message kind: every field named here must pass, and a field
 * not named here is an error.
 * @param {Record<string, (v: unknown) => boolean>} fields
 * @returns {(msg: Record<string, unknown>) => string | null}
 */
function shape(fields) {
  return (msg) => {
    if (!isPlainObject(msg)) return 'expected an object';
    for (const key of Object.keys(msg)) {
      if (!Object.hasOwn(fields, key)) return `unexpected field "${key}"`;
    }
    for (const [key, check] of Object.entries(fields)) {
      if (!check(msg[key])) return `invalid field "${key}"`;
    }
    return null;
  };
}

const kind = (name) => (v) => v === name;
const RUN_ID = filled(64);
const MODE = oneOf('inline', 'file');
const FILE_NAME = str(256);
const LABEL = str(200);
const TEXT = str(MAX_FRAME_BYTES);

const declared = shape({
  network: maybe(oneOf('none', 'localhost', 'all')),
  device: maybe(list(str(40), 16)),
  lessonReference: maybe(TEXT),
  rawSource: maybe(TEXT),
});

// One entry per message kind sent in workers/peer. A new kind needs an entry
// here, or routeExecMessage in index.cjs drops it. Lengths are coarse bounds;
// exec-validate.cjs and identity-handshake.cjs hold the exact rules.
const SHAPES = {
  'pairing-wake': shape({ kind: kind('pairing-wake') }),
  'pairing-response': shape({ kind: kind('pairing-response'), response: filled(1024) }),
  'identity-hello': shape({
    kind: kind('identity-hello'),
    nonce: filled(64),
    devicePublicKey: filled(64),
    identityPublicKey: maybe(str(64)),
    proof: maybe(str(MAX_FRAME_BYTES_BY_KIND['identity-hello'])),
  }),
  'identity-proof': shape({ kind: kind('identity-proof'), nonce: filled(64), signature: filled(128) }),
  'peer-profile': shape({ kind: kind('peer-profile'), userData: isPlainObject }),
  request: shape({
    kind: kind('request'),
    runId: RUN_ID,
    code: TEXT,
    mode: MODE,
    argv: list(str(MAX_EXEC_ARGV_ENTRY), MAX_EXEC_ARGV),
    fileName: FILE_NAME,
    label: maybe(LABEL),
    declared: maybe((v) => declared(v) === null),
  }),
  cancel: shape({ kind: kind('cancel') }),
  started: shape({
    kind: kind('started'),
    runId: RUN_ID,
    mode: maybe(MODE),
    fileName: maybe(FILE_NAME),
    label: maybe(LABEL),
  }),
  chunk: shape({ kind: kind('chunk'), runId: RUN_ID, stream: oneOf('stdout', 'stderr'), data: TEXT }),
  exit: shape({
    kind: kind('exit'),
    runId: RUN_ID,
    code: maybe(Number.isInteger),
    signal: maybe(str(32)),
    cancelled: maybe((v) => typeof v === 'boolean'),
    mode: maybe(MODE),
    fileName: maybe(FILE_NAME),
  }),
  // `code`, `runId`, and `message`, then the WIRE_SAFE_META fields of exec-host.cjs.
  error: shape({
    kind: kind('error'),
    code: filled(64),
    runId: maybe(RUN_ID),
    message: TEXT,
    mode: maybe(MODE),
    fileName: maybe(FILE_NAME),
    devicePublicKey: maybe(str(64)),
    packages: maybe(list(str(256), 1024)),
    assets: maybe(list(str(4096), 1024)),
    devices: maybe(list(str(40), 16)),
    network: maybe(TEXT),
    networkScope: maybe(str(32)),
    runtime: maybe(str(16)),
    signal: maybe(str(32)),
    scheme: maybe(str(64)),
    reason: maybe(str(200)),
    sandboxMode: maybe(str(64)),
    sandboxed: maybe((v) => typeof v === 'boolean'),
  }),
};

/**
 * Null when `msg` has exactly the fields its kind allows, each of the right
 * type. Otherwise a short reason, for the audit trail.
 * @param {{ kind: string, [key: string]: unknown }} msg
 * @returns {string | null}
 */
function frameProblem(msg) {
  if (!isPlainObject(msg) || typeof msg.kind !== 'string') return 'not a frame';
  if (!Object.hasOwn(SHAPES, msg.kind)) return 'unknown kind';
  return SHAPES[msg.kind](msg);
}

module.exports = {
  MAX_FRAME_BYTES,
  MAX_FRAME_BYTES_BY_KIND,
  parseFrame,
  frameProblem,
  FRAME_KINDS: Object.keys(SHAPES),
  MAX_PROFILE_FRAME_BYTES,
  HEX_64,
  sanitizeProfileUserData,
  readPairingUserData,
};
