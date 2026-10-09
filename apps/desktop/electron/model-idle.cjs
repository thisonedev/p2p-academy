// A loaded model nobody has used for this long is unloaded to free its memory.
// Chat, RAG, translation and the media models all use the same window.
'use strict';

const IDLE_UNLOAD_MS = 20 * 60 * 1000;

module.exports = { IDLE_UNLOAD_MS };
