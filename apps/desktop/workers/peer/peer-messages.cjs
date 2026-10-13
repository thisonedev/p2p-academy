// What a paired or pairing device sends is read here before any of it is
// stored, shown, or logged. Pure functions, so the bounds are testable without a swarm.
'use strict';

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

module.exports = {
  MAX_FRAME_BYTES,
  MAX_FRAME_BYTES_BY_KIND,
  parseFrame,
  MAX_PROFILE_FRAME_BYTES,
  HEX_64,
  sanitizeProfileUserData,
  readPairingUserData,
};
