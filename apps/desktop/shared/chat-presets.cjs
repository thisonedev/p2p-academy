// Which SDK registry constant backs each chat model file, built from the shared
// list in @academy/constants/models. Its own module so the catalogue can use it
// without importing chat.cjs, which imports the catalogue back.
'use strict';

const { CHAT_MODELS } = require('@academy/constants/models');

const CHAT_PRESETS = Object.freeze(Object.fromEntries(CHAT_MODELS.map((m) => [m.file, m.sdkKey])));

module.exports = { CHAT_PRESETS };
