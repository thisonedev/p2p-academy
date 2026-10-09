// Channels main.js pushes to the page with sendToAll/sender.send and preload.js
// subscribes to with ipcRenderer.on. tests/unit/ipc-contract.cjs checks both sides.
'use strict';

module.exports = Object.freeze([
  'academy:run:chunk',
  'academy:voice:event',
  'academy:model:status',
  'academy:chat:chunk',
  'academy:chat:verify-result',
  'academy:chat:security-result',
  'academy:chat:load-progress',
  'academy:models:download-progress',
  'academy:models:download-queue',
  'academy:peer:event',
]);
