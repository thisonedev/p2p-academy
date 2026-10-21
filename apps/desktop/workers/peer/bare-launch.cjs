'use strict';

// Starts a file-mode Bare run as `bare bare-launch.cjs <file> ...argv`, Bare
// having no preload flag. Removes itself from Bare.argv so the run sees the
// same argv as `bare <file> ...argv`.
require('./bare-exit-flush.cjs');

Bare.argv.splice(1, 1);
require(Bare.argv[1]);
