'use strict';

// Bare 1.35 drops stdout and stderr writes still pending at exit, so output
// printed right before process.exit() is lost. `Bare` is not extensible, so
// this wraps exit() on the bare-process instance the run's own code imports.
// `any`: the bare-process types say exit() never returns, and this one does.
const process = /** @type {any} */ (require('bare-process'));

let exiting = false;

process.exit = function exitAfterFlush(code) {
  if (exiting) return;
  exiting = true;
  const finish = () => Bare.exit(code);
  // In case a write never calls back.
  setTimeout(finish, 250).unref();
  let pending = 2;
  const done = () => {
    if (--pending === 0) finish();
  };
  process.stdout.write('', done);
  process.stderr.write('', done);
};
