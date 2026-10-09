'use strict';

// A Stop click, or quitting the app mid-run, ends a generate call on purpose. Electron prints
// a full stack for every handler that throws, so a cancel is logged as one line and sent back
// as a value. preload.js turns that value into a rejection again for the page.

const CANCEL_NAMES = new Set(['InferenceCancelledError', 'WorkerShutdownError']);

function isCancelError(err) {
  if (!err) return false;
  if (CANCEL_NAMES.has(err.name) || err.code === 'ABORT_ERR') return true;
  return /cancel|stopped\.$/i.test(String(err.message ?? ''));
}

/** @param {string} channel @param {(...args: any[]) => Promise<any>} fn @param {(line: string) => void} [log] */
function quietCancel(channel, fn, log = console.log) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (!isCancelError(err)) throw err;
      const message = String(err.message || 'cancelled');
      log(`[p2p-academy-desktop] ${channel}: ${message}`);
      return { academyCancelled: message };
    }
  };
}

module.exports = { CANCEL_NAMES, isCancelError, quietCancel };
