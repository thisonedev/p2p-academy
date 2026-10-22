'use strict';

const test = require('brittle');
const fs = require('fs');
const path = require('path');
const {
  ERROR_CODES,
  ERROR_AREAS,
  isAcademyError,
  toAcademyErrorPayload,
} = require('@academy/validation/errors');
const { codedError, errorBody, fromErrorBody } = require('../../shared/coded-error.cjs');

const root = path.resolve(__dirname, '../..');
const PREFIX = { ipc: 'IPC_', peer: 'PEER_', identity: 'IDENTITY_', lessons: 'LESSON_' };

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(c?js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const usedCodes = new Set();
for (const dir of ['electron', 'workers', 'shared']) {
  for (const file of sourceFiles(path.join(root, dir))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/codedError\('([A-Z_]+)'/g)) usedCodes.add(m[1]);
    for (const m of text.matchAll(/code: '((?:IPC|PEER|IDENTITY|LESSON)_[A-Z_]+)'/g)) usedCodes.add(m[1]);
  }
}

test('error codes start with the prefix of their area', (t) => {
  for (const [code, info] of Object.entries(ERROR_CODES)) {
    t.ok(ERROR_AREAS.includes(info.area), `${code}: known area`);
    t.ok(code.startsWith(PREFIX[info.area]), `${code}: ${PREFIX[info.area]} prefix`);
    t.is(typeof info.recoverable, 'boolean', `${code}: recoverable is a boolean`);
  }
});

test('error codes raised in source are in the map, and every mapped code is raised', (t) => {
  for (const code of usedCodes) t.ok(Object.hasOwn(ERROR_CODES, code), `${code} is in ERROR_CODES`);
  for (const code of Object.keys(ERROR_CODES)) t.ok(usedCodes.has(code), `${code} is raised somewhere`);
});

test('error payload takes area and recoverable from the map', (t) => {
  const err = codedError('PEER_WORKER_EXITED', 'gone');
  // @ts-ignore - a field the payload must not trust
  err.recoverable = false;
  const payload = toAcademyErrorPayload(err);
  t.alike(payload, {
    name: 'AcademyError',
    code: 'PEER_WORKER_EXITED',
    area: 'peer',
    recoverable: true,
    message: 'gone',
  });
  t.ok(isAcademyError(payload));
});

test('error payload is null for an error without a known code', (t) => {
  t.is(toAcademyErrorPayload(new Error('plain')), null);
  t.is(toAcademyErrorPayload(Object.assign(new Error('x'), { code: 'ENOENT' })), null);
  t.is(toAcademyErrorPayload(null), null);
  t.absent(isAcademyError({ name: 'AcademyError', code: 'ENOENT', message: 'x' }));
});

test('error payload keeps the cause chain, three levels deep', (t) => {
  const deep = codedError('PEER_REMOTE_ERROR', 'a', codedError('B', 'b', codedError('C', 'c', codedError('D', 'd', new Error('e')))));
  const payload = toAcademyErrorPayload(deep);
  t.alike(payload?.cause, {
    message: 'b',
    code: 'B',
    cause: { message: 'c', code: 'C', cause: { message: 'd', code: 'D' } },
  });
});

test('error body keeps code and cause across bare-rpc', (t) => {
  const sent = codedError('PEER_REMOTE_ERROR', 'refused', { code: 'consent-denied', message: 'refused' });
  const received = fromErrorBody(JSON.parse(JSON.stringify(errorBody(sent))), 'fallback');
  t.is(received.message, 'refused');
  // @ts-ignore - Error has no code field in its type
  t.is(received.code, 'PEER_REMOTE_ERROR');
  t.alike(toAcademyErrorPayload(received)?.cause, { code: 'consent-denied', message: 'refused' });
  t.is(fromErrorBody(null, 'fallback').message, 'fallback');
});
