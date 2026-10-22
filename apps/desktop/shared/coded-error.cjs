// Errors with a code from ERROR_CODES in @academy/validation/errors. The worker runs
// under Bare and does not load that package, so this module only attaches the code;
// main.js looks it up when the error crosses to the page.
'use strict';

const MAX_CAUSE_DEPTH = 3;

/** @param {string} code @param {string} message @param {unknown} [cause] */
function codedError(code, message, cause) {
  const err = cause === undefined ? new Error(message) : new Error(message, { cause });
  // @ts-ignore - Error has no code field in its type
  err.code = code;
  return err;
}

// JSON-safe copy of an error for bare-rpc, which would otherwise carry only the message.
/** @returns {{ message: string, code?: string, cause?: any }} */
function errorBody(err, depth = 0) {
  const body = { message: err && err.message ? String(err.message) : String(err) };
  if (typeof err?.code === 'string') body.code = err.code;
  if (err?.cause != null && depth < MAX_CAUSE_DEPTH) body.cause = errorBody(err.cause, depth + 1);
  return body;
}

/** @param {{ message?: string, code?: string, cause?: any } | null | undefined} body @param {string} fallback */
function fromErrorBody(body, fallback) {
  const message = body?.message || fallback;
  const err = body?.cause ? new Error(message, { cause: body.cause }) : new Error(message);
  // @ts-ignore - Error has no code field in its type
  if (typeof body?.code === 'string') err.code = body.code;
  return err;
}

module.exports = { codedError, errorBody, fromErrorBody };
