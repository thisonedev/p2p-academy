const { contextBridge, ipcRenderer } = require('electron');

// The main process answers a cancelled call with a value, not a throw, so Electron does not
// print a stack for it (see quiet-cancel.cjs). The page still expects a rejection, so every
// call goes through here and becomes one again.
/** @param {string} channel @param {...unknown} args @returns {Promise<any>} */
const invoke = (channel, ...args) =>
  ipcRenderer.invoke(channel, ...args).then((res) => {
    if (res && typeof res === 'object' && typeof res.academyCancelled === 'string') {
      throw Object.assign(new Error(res.academyCancelled), { name: 'InferenceCancelledError' });
    }
    return res;
  });

// `@type` would silence mismatches instead of failing `pnpm typecheck`.
/** @type {import('@academy/validation').AcademyAPI} */
const academy = {
  pkg: () => ipcRenderer.sendSync('pkg'),
  run: (payload) => invoke('academy:run', payload),
  stop: () => invoke('academy:stop'),
  reveal: (filePath) => invoke('academy:reveal', filePath),
  readSaved: (filePath) => invoke('academy:read-saved', filePath),
  onRunChunk: (callback) => {
    const handler = (/** @type {unknown} */ _e, /** @type {any} */ chunk) => callback(chunk);
    ipcRenderer.on('academy:run:chunk', handler);
    return () => ipcRenderer.removeListener('academy:run:chunk', handler);
  },
  state: {
    get: (key) => invoke('academy:state:get', key),
    set: (key, value) => invoke('academy:state:set', { key, value }),
    remove: (key) => invoke('academy:state:remove', key),
    list: () => invoke('academy:state:list'),
  },
  catalog: {
    save: (kind, id, title, payload, preview) =>
      invoke('academy:catalog:save', { kind, id, title, payload, preview }),
    rename: (kind, id, title) => invoke('academy:catalog:rename', { kind, id, title }),
    get: (kind, id) => invoke('academy:catalog:get', { kind, id }),
    remove: (kind, id) => invoke('academy:catalog:remove', { kind, id }),
    list: (kind) => invoke('academy:catalog:list', kind ?? null),
    diskStatus: () => invoke('academy:catalog:disk-status'),
  },
  window: {
    minimize: () => invoke('academy:window:minimize'),
    maximize: () => invoke('academy:window:maximize'),
    close: () => invoke('academy:window:close'),
  },
  models: {
    list: () => invoke('academy:models:list'),
    remove: (id) => invoke('academy:models:remove', id),
    removeAll: () => invoke('academy:models:removeAll'),
    verify: () => invoke('academy:models:verify'),
    catalogue: () => invoke('academy:models:catalogue'),
    recommend: (lessonKey) => invoke('academy:models:recommend', lessonKey),
    forLesson: (lessonKey) => invoke('academy:models:for-lesson', lessonKey),
    download: (name) => invoke('academy:models:download', name),
    cancelDownload: () => invoke('academy:models:cancelDownload'),
    onDownloadProgress: (callback) => {
      const handler = (/** @type {unknown} */ _e, /** @type {any} */ progress) => callback(progress);
      ipcRenderer.on('academy:models:download-progress', handler);
      return () => ipcRenderer.removeListener('academy:models:download-progress', handler);
    },
    downloadQueue: (scope, names) => invoke('academy:models:downloadQueue', { scope, names }),
    cancelDownloadQueue: () => invoke('academy:models:cancelDownloadQueue'),
    downloadQueueState: () => invoke('academy:models:downloadQueueState'),
    onDownloadQueueProgress: (callback) => {
      const handler = (/** @type {unknown} */ _e, /** @type {any} */ snapshot) => callback(snapshot);
      ipcRenderer.on('academy:models:download-queue', handler);
      return () => ipcRenderer.removeListener('academy:models:download-queue', handler);
    },
  },
  device: {
    info: () => invoke('academy:device:info'),
  },
  chat: {
    ready: () => invoke('academy:chat:ready'),
    currentModel: () => invoke('academy:chat:current-model'),
    configuredModel: () => invoke('academy:chat:configured-model'),
    docsStatus: () => invoke('academy:chat:docs-status'),
    docsRefresh: () => invoke('academy:chat:docs-refresh'),
    load: (modelHint) => invoke('academy:chat:load', modelHint),
    cancelLoad: () => invoke('academy:chat:cancelLoad'),
    preload: () => invoke('academy:chat:preload'),
    send: (payload) => invoke('academy:chat:send', payload),
    verify: (payload) => invoke('academy:chat:verify', payload),
    securityScan: (payload) => invoke('academy:chat:security-scan', payload),
    stop: (requestId) => invoke('academy:chat:stop', requestId),
    onChunk: (callback) => {
      const handler = (/** @type {unknown} */ _e, /** @type {any} */ chunk) => callback(chunk);
      ipcRenderer.on('academy:chat:chunk', handler);
      return () => ipcRenderer.removeListener('academy:chat:chunk', handler);
    },
    onVerifyResult: (callback) => {
      const handler = (/** @type {unknown} */ _e, /** @type {any} */ result) => callback(result);
      ipcRenderer.on('academy:chat:verify-result', handler);
      return () => ipcRenderer.removeListener('academy:chat:verify-result', handler);
    },
    onSecurityResult: (callback) => {
      const handler = (/** @type {unknown} */ _e, /** @type {any} */ result) => callback(result);
      ipcRenderer.on('academy:chat:security-result', handler);
      return () => ipcRenderer.removeListener('academy:chat:security-result', handler);
    },
    onLoadProgress: (callback) => {
      const handler = (/** @type {unknown} */ _e, /** @type {any} */ progress) => callback(progress);
      ipcRenderer.on('academy:chat:load-progress', handler);
      return () => ipcRenderer.removeListener('academy:chat:load-progress', handler);
    },
  },
  clipboard: {
    copy: (text, scrubAfterMs) =>
      invoke('academy:clipboard:copy', { text, scrubAfterMs }),
  },
  playgroundCredentials: {
    list: () => invoke('academy:playground-credentials:list'),
    set: (name, value) => invoke('academy:playground-credentials:set', { name, value }),
    delete: (name) => invoke('academy:playground-credentials:delete', name),
  },
  translate: (text, language) => invoke('academy:translate', { text, language }),
  workflow: {
    generate: (prompt, catalogue, currentWorkflow) =>
      invoke('academy:workflow:generate', { prompt, catalogue, currentWorkflow }),
  },
  ragSearch: (documents, query, topK) => invoke('academy:rag-search', { documents, query, topK }),
  ragIndexBackend: () => invoke('academy:rag:index-backend'),
  setRagIndexBackend: (backend) => invoke('academy:rag:set-index-backend', backend),
  ocr: (image) => invoke('academy:ocr', { image }),
  classifyImage: (image) => invoke('academy:classify-image', { image }),
  textToSpeech: (text) => invoke('academy:text-to-speech', { text }),
  speechToText: (audio) => invoke('academy:speech-to-text', { audio }),
  voice: {
    start: (opts) => invoke('academy:voice:start', opts ?? {}),
    stop: (requestId) => invoke('academy:voice:stop', requestId),
    startConversation: (opts) => invoke('academy:voice:startConversation', opts ?? {}),
    stopConversation: (conversationId) => invoke('academy:voice:stopConversation', conversationId),
    preload: () => invoke('academy:voice:preload'),
    onEvent: (callback) => {
      const handler = (/** @type {unknown} */ _e, /** @type {any} */ event) => callback(event);
      ipcRenderer.on('academy:voice:event', handler);
      return () => ipcRenderer.removeListener('academy:voice:event', handler);
    },
  },
  cancelModelLoad: () => invoke('academy:model:cancel-load'),
  onModelStatus: (callback) => {
    const handler = (/** @type {unknown} */ _e, /** @type {any} */ status) => callback(status);
    ipcRenderer.on('academy:model:status', handler);
    return () => ipcRenderer.removeListener('academy:model:status', handler);
  },
  currentModelStatus: () => invoke('academy:model:status:current'),
  generateImage: (prompt, model, opts) => invoke('academy:generate-image', { prompt, model, ...opts }),
  cancelGenerateImage: () => invoke('academy:generate-image:cancel'),
  generateVideo: (prompt, model, frames, steps) => invoke('academy:generate-video', { prompt, model, frames, steps }),
  cancelGenerateVideo: () => invoke('academy:generate-video:cancel'),
  generateMusic: (caption, durationSec) => invoke('academy:generate-music', { caption, durationSec }),
  cancelGenerateMusic: () => invoke('academy:generate-music:cancel'),
  identity: {
    status: () => invoke('academy:identity:status'),
    create: () => invoke('academy:identity:create'),
    confirmBackup: () => invoke('academy:identity:confirm-backup'),
    recover: (mnemonic) => invoke('academy:identity:recover', mnemonic),
    beginAttest: (payload) => invoke('academy:identity:begin-attest', payload),
    finishAttest: (payload) => invoke('academy:identity:finish-attest', payload),
    cancelAttest: (sessionId) => invoke('academy:identity:cancel-attest', sessionId),
    revokeDevice: (devicePublicKey) =>
      invoke('academy:identity:revoke-device', devicePublicKey),
    listDevices: () => invoke('academy:identity:list-devices'),
    reset: () => invoke('academy:identity:reset'),
    // Attested blob store: username, progress, future xp/reputation.
    setUsername: (payload) => invoke('academy:identity:set-username', payload),
    getUsername: () => invoke('academy:identity:get-username'),
    setProgress: (payload) => invoke('academy:identity:set-progress', payload),
    getProgress: () => invoke('academy:identity:get-progress'),
    listBlobs: () => invoke('academy:identity:list-blobs'),
    publicSnapshot: () => invoke('academy:identity:public-snapshot'),
    verifyAttested: (payload) => invoke('academy:identity:verify-attested', payload),
    importProfile: (payload) => invoke('academy:identity:import-profile', payload),
  },
  peer: {
    identity: () => invoke('academy:peer:identity'),
    takeDeeplink: () => invoke('academy:peer:take-deeplink'),
    // Only userData is accepted by main; do not forward autoApprove/code.
    invite: (opts) => {
      const userData =
        opts && typeof opts === 'object' && opts.userData != null ? opts.userData : null;
      return invoke('academy:peer:invite', userData != null ? { userData } : {});
    },
    accept: (inviteB64, opts) => {
      const safe = {};
      if (opts && typeof opts === 'object') {
        if (opts.userData != null) safe.userData = opts.userData;
        if (opts.code != null) safe.code = opts.code;
        if (opts.hostIdentity != null) safe.hostIdentity = opts.hostIdentity;
      }
      return invoke('academy:peer:accept', { inviteB64, opts: safe });
    },
    list: () => invoke('academy:peer:list'),
    pending: () => invoke('academy:peer:pending'),
    deviceRequests: () => invoke('academy:peer:device-requests'),
    resolveDeviceRequest: (requestId, approved) =>
      invoke('academy:peer:device-consent', { requestId, approved: approved === true }),
    approve: (requestId) => invoke('academy:peer:approve', requestId),
    reject: (requestId) => invoke('academy:peer:reject', requestId),
    audit: (opts) => invoke('academy:peer:audit', opts),
    clearAudit: () => invoke('academy:peer:clear-audit'),
    clearPeerAudit: (discoveryKey) => invoke('academy:peer:clear-peer-audit', discoveryKey),
    lockdown: () => invoke('academy:peer:lockdown'),
    drop: (discoveryKey) => invoke('academy:peer:drop', discoveryKey),
    onEvent: (callback) => {
      const handler = (/** @type {unknown} */ _e, /** @type {any} */ payload) => callback(payload);
      ipcRenderer.on('academy:peer:event', handler);
      return () => ipcRenderer.removeListener('academy:peer:event', handler);
    },
  },
};

contextBridge.exposeInMainWorld('academy', academy);
