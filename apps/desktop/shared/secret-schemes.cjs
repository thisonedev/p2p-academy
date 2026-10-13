// @ts-check
'use strict';

// How the identity record is sealed on this device, as main reports it to the
// peer worker. Shared so the worker's refusal and main's report cannot disagree.

/** Sealed by the OS keyring through Electron safeStorage. */
const KEYRING = 'safeStorage';
/** No keyring: sealed with AES under a key file on disk. */
const LOCAL_FILE_KEY = 'aes-gcm-local';
/** safeStorage on the Linux basic_text backend, which seals with a hardcoded password (see electron/secret-storage.cjs). */
const KEYRING_UNPROTECTED = 'safeStorage-basic-text';

/** Schemes under which anyone who can read the files can open the identity record. */
const UNSEALED = new Set([LOCAL_FILE_KEY, KEYRING_UNPROTECTED]);

/** @param {string | null | undefined} scheme */
function isUnsealed(scheme) {
  return typeof scheme === 'string' && UNSEALED.has(scheme);
}

module.exports = { KEYRING, LOCAL_FILE_KEY, KEYRING_UNPROTECTED, isUnsealed };
