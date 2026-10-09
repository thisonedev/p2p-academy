'use strict';

// Shared load-once/idle-evict shape for the media capabilities (ocr, tts,
// transcribe, diffusion, audiogen): same lifecycle as translate.cjs/chat.cjs,
// factored out since six near-identical copies would just drift apart.

const fs = require('node:fs');
const path = require('node:path');
const { ensureModels, checkDiskSpace } = require('../shared/model-fetch.cjs');
const { cacheFileName, modelsDir, readRegistry } = require('../shared/model-sideload.cjs');
const { notify } = require('./model-status.cjs');
const { claim, release, ownerOf } = require('./model-ownership.cjs');

const { IDLE_UNLOAD_MS } = require('./model-idle.cjs');

// The SDK can refuse a second loadModel for an id it still considers live
// even after this cache lost it. Reusing that id recovers the load.
function parseAlreadyRegisteredModelId(err) {
  const message = err instanceof Error ? err.message : String(err);
  const match = /Model with ID "([^"]+)" is already registered/.exec(message);
  return match ? match[1] : null;
}

/** Whether every file is on disk at its full size. A file still being written does not count,
 *  unlike model-fetch's isPresent, which lets a recently touched partial file pass. */
function allComplete(registryKeys) {
  try {
    const registry = readRegistry();
    return registryKeys.every((key) => {
      const entry = registry.get(key);
      if (!entry) return true;
      return fs.statSync(path.join(modelsDir(), cacheFileName(entry.registryPath))).size === entry.expectedSize;
    });
  } catch {
    return false;
  }
}

/**
 * @param {{ label: string, registryKeys?: string[], buildLoadArgs: (sdk: any) => object, modelName?: string, modelKind?: string }} opts
 */
function createLazyModel({ label, registryKeys, buildLoadArgs, modelName, modelKind }) {
  let modelId = null;
  let idleTimer = null;
  // Diagnostic only, surfaced by callers on a downstream failure: which path
  // handed out the id that then broke (cache hit, fresh load, or adoption
  // of an "already registered" id) narrows down where the real bug is.
  let lastSource = null;
  // The load in flight, so a Stop click can reach it: the download phase by its
  // AbortController, the sdk.loadModel phase by its requestId. Same as chat.cjs.
  let currentLoad = null;
  let loadCancelled = false;

  function cancelledError() {
    const err = new Error(`${modelName ?? label} load cancelled`);
    err.name = 'InferenceCancelledError';
    return err;
  }

  /** Stops a load or download in flight. A no-op when nothing is loading. */
  async function cancelLoad() {
    const cur = currentLoad;
    if (!cur) return false;
    loadCancelled = true;
    cur.controller.abort();
    if (cur.requestId) {
      const sdk = require('@qvac/sdk');
      await sdk.cancel({ requestId: cur.requestId }).catch(() => {});
    }
    return true;
  }

  function clearIdleTimer() {
    if (!idleTimer) return;
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  function touchIdleTimer() {
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      unload().catch((err) => console.warn(`[${label}] idle unload failed`, err && err.message));
    }, IDLE_UNLOAD_MS);
    if (typeof idleTimer.unref === 'function') idleTimer.unref();
  }

  async function unload() {
    clearIdleTimer();
    if (!modelId) return;
    const id = modelId;
    modelId = null;
    release(id);
    const sdk = require('@qvac/sdk');
    try {
      await sdk.unloadModel({ modelId: id, clearStorage: false });
    } catch (err) {
      console.warn(`[${label}] unload failed`, err && err.message);
    }
    // The SDK refuses a fresh loadModel for this id until unloadModel's
    // effect is visible, so a caller reloading immediately after gets the
    // still-broken id back through "already registered" adoption.
    for (let i = 0; i < 20; i++) {
      const stillThere = await sdk.getLoadedModelInfo({ modelId: id }).then(
        () => true,
        () => false,
      );
      if (!stillThere) break;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  async function ensureLoaded() {
    const sdk = require('@qvac/sdk');
    if (modelId) {
      // getLoadedModelInfo throws ModelNotFoundError if the registry has
      // since lost this id (e.g. it was unloaded from under us); a truthy
      // cache alone doesn't mean the SDK still has the model registered.
      const stillRegistered = await sdk.getLoadedModelInfo({ modelId }).then(
        () => true,
        () => false,
      );
      if (stillRegistered) {
        lastSource = 'cache';
        touchIdleTimer();
        return modelId;
      }
      modelId = null;
    }
    loadCancelled = false;
    const controller = new AbortController();
    currentLoad = { controller, requestId: null };
    // Whether every file was on disk before the load. Decides what its progress is called below.
    let alreadyOnDisk = true;
    if (registryKeys && registryKeys.length > 0) {
      const spaceCheck = await checkDiskSpace(registryKeys);
      if (!spaceCheck.ok) {
        currentLoad = null;
        throw new Error(spaceCheck.message);
      }
      await ensureModels(registryKeys, {
        signal: controller.signal,
        onEvent: (e) => {
          if (modelName && e.phase === 'progress') {
            notify({ name: modelName, kind: modelKind, phase: 'downloading', downloaded: e.downloaded, total: e.total });
          }
        },
      }).catch(() => {});
      alreadyOnDisk = allComplete(registryKeys);
    }
    if (loadCancelled) {
      currentLoad = null;
      // Otherwise the status stays on "downloading": nothing else says the load stopped.
      if (modelName) notify({ name: modelName, kind: modelKind, phase: 'ready', cancelled: true });
      throw cancelledError();
    }
    if (modelName) notify({ name: modelName, kind: modelKind, phase: 'loading' });
    try {
      const { withFallbackSrc } = require('./models.cjs');
      const op = sdk.loadModel(withFallbackSrc({
        ...buildLoadArgs(sdk),
        // The SDK fetches whatever is still missing inside this call, and that is the only
        // sign of it. Reading a file already on disk fires this too, so that stays "loading".
        onProgress: (p) => {
          if (!modelName || alreadyOnDisk || !p || typeof p.downloaded !== 'number' || !(p.total > 0)) return;
          notify({ name: modelName, kind: modelKind, phase: 'downloading', downloaded: p.downloaded, total: p.total });
        },
      }));
      currentLoad = { controller, requestId: op && op.requestId };
      modelId = await op;
      lastSource = 'fresh';
    } catch (err) {
      if (loadCancelled) throw cancelledError();
      const existingId = parseAlreadyRegisteredModelId(err);
      if (!existingId) throw err;
      // Adopting an id another capability owns would let this loader unload
      // their model underneath them. See model-ownership.cjs.
      const owner = ownerOf(existingId);
      if (owner && owner !== label) {
        throw new Error(`Model with ID "${existingId}" is already registered to "${owner}", not "${label}"; refusing to adopt it.`);
      }
      modelId = existingId;
      lastSource = 'adopted';
    } finally {
      // Every throw above left this stuck at 'loading'/'downloading' with
      // nothing to clear it, across all six capabilities on this loader.
      if (modelName) notify({ name: modelName, kind: modelKind, phase: 'ready', ...(loadCancelled ? { cancelled: true } : {}) });
      currentLoad = null;
    }
    claim(modelId, label);
    touchIdleTimer();
    return modelId;
  }

  return { ensureLoaded, unload, cancelLoad, getModelId: () => modelId, getLastSource: () => lastSource };
}

module.exports = { createLazyModel };
