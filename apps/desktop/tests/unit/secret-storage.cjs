'use strict';

// A keyring-sealed record outlives the keyring that sealed it. What matters is
// that reopening it without one says so, instead of failing as a GCM error.

const test = require('brittle');
const {
  createSecretStorage,
  sealedBySafeStorage,
} = require('../../electron/secret-storage.cjs');
const { tmpDir } = require('../helpers/index.cjs');

function localStorage(t, name) {
  const dir = tmpDir(t, name);
  return createSecretStorage(dir, { safeStorage: null, keyDir: dir });
}

test('secret-storage - names the keyring when the local key cannot open a sealed record', (t) => {
  const local = localStorage(t, 'secrets-keyring');
  t.is(local.scheme, 'aes-gcm-local');

  // The version tag Chromium writes when the OS keyring seals a value.
  const sealed = Buffer.concat([Buffer.from('v11'), Buffer.alloc(32, 7)]).toString('base64');
  t.ok(sealedBySafeStorage(sealed), 'recognised as keyring-sealed');
  t.exception(() => local.decryptString(sealed), /OS keyring/);

  try {
    local.decryptString(sealed);
    t.fail('should have thrown');
  } catch (err) {
    t.is(err.code, 'IDENTITY_KEYRING_UNAVAILABLE', 'carries the code main.js reports on');
  }
});

test('secret-storage - round-trips its own payload, which never reads as sealed', (t) => {
  const local = localStorage(t, 'secrets-roundtrip');
  const payload = local.encryptString('device-secret');

  t.absent(sealedBySafeStorage(payload), 'a local payload is not mistaken for a sealed one');
  t.is(local.decryptString(payload), 'device-secret');
});

function fakeSafeStorage(backend) {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from(s, 'utf8'),
    decryptString: (b) => Buffer.from(b).toString('utf8'),
    ...(backend ? { getSelectedStorageBackend: () => backend } : {}),
  };
}

test('secret-storage - flags the Linux basic_text backend as unprotected', (t) => {
  const dir = tmpDir(t, 'secrets-backend');
  const open = (backend) => createSecretStorage(dir, { safeStorage: fakeSafeStorage(backend), keyDir: dir });

  t.is(open('basic_text').scheme, 'safeStorage');
  t.is(open('basic_text').unprotected, true);
  t.is(open('gnome_libsecret').unprotected, false);
  t.is(open(null).unprotected, false, 'macOS and Windows have no backend getter');
  t.is(localStorage(t, 'secrets-backend-local').unprotected, false);
});
