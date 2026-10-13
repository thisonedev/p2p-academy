// What a paired or pairing device sends is read here before any of it is
// stored, shown, or logged. Pure functions, so the bounds are testable without a swarm.
'use strict';

// A profile is a name and a few short fields.
const MAX_PROFILE_FRAME_BYTES = 4096;
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

module.exports = {
  MAX_PROFILE_FRAME_BYTES,
  HEX_64,
  sanitizeProfileUserData,
  readPairingUserData,
};
