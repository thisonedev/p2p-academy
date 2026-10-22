// Main-process proxy for the pear-end Bare worker. Matches peer.cjs's old
// exported shape so pear-end/index.cjs's `peer` swap is one line.
// shutdownWorker() is new: killing the worker process is distinct from
// close()/CMD.CLOSE, which only tears down the mesh.
const RPC = require('bare-rpc');
const { EventEmitter } = require('events');
const CMD = require('../../shared/rpc-commands.cjs');
const { resolveBareBin } = require('../../shared/bare-bin.cjs');
const { diagnoseNativeAddonError } = require('../linux-lib-hint.cjs');
const { codedError, fromErrorBody } = require('../../shared/coded-error.cjs');

const WORKER_ENTRY = require.resolve('../../workers/entry.cjs');
const SHUTDOWN_TIMEOUT_MS = 5000;
// An unexpected exit restarts the worker after RESTART_BASE_MS, doubling per
// recent restart. More than MAX_RESTARTS within RESTART_WINDOW_MS stops the
// loop, so a worker that dies on start does not respawn forever.
const RESTART_BASE_MS = 1000;
const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 60_000;

// Same lazy-require guard as root-store.cjs's loadCorestore().
function loadPearRuntime() {
  try {
    return require('pear-runtime');
  } catch (err) {
    const hint = diagnoseNativeAddonError(err);
    if (hint) err.message = `${err.message}\n${hint}`;
    throw err;
  }
}

let worker = null;
let rpc = null;
const listeners = new Set();
const pendingExec = new Map(); // peerId -> EventEmitter
// The INIT arguments of the live mesh, replayed on a restart. Null when no
// mesh is up, so a crash after close() leaves the worker down until init().
let meshArgs = null;
let restartTimer = null;
let restartTimes = [];
let shuttingDown = false;

function workerExitedError(message = 'pear-end worker exited; restarting') {
  return codedError('PEER_WORKER_EXITED', message);
}

function notInitializedError() {
  return codedError('PEER_NOT_READY', 'worker-client: not initialized');
}

function emit(event, payload) {
  for (const listener of listeners) {
    try {
      listener(event, payload);
    } catch (err) {
      console.warn('[worker-client] listener error:', err?.message ?? err);
    }
  }
}

function toJson(value) {
  return Buffer.from(JSON.stringify(value === undefined ? null : value), 'utf8');
}
function fromJson(data) {
  return data && data.length ? JSON.parse(data.toString('utf8')) : null;
}
function unwrap(res) {
  if (!res || !res.ok) {
    throw fromErrorBody(res && res.error, 'pear-end worker error');
  }
  return res.result;
}

async function call(command, args) {
  if (!rpc) {
    if (meshArgs) throw workerExitedError();
    throw notInitializedError();
  }
  const current = rpc;
  const req = current.request(command);
  req.send(toJson(args));
  let data;
  try {
    data = await req.reply();
  } catch (err) {
    // bare-rpc rejects in-flight requests with CHANNEL_CLOSED when the worker
    // dies. Only a quit keeps that code; a crash reports PEER_WORKER_EXITED.
    if (err?.code === 'CHANNEL_CLOSED' && !shuttingDown && rpc !== current) throw workerExitedError();
    throw err;
  }
  return unwrap(fromJson(data));
}

function buildMainRouter() {
  const router = new RPC.CommandRouter();
  router.respond(CMD.PEER_EVENT, (_req, data) => {
    const { event, payload } = fromJson(data);
    emit(event, payload);
    return toJson({ ok: true });
  });
  router.respond(CMD.EXEC_CHUNK, (_req, data) => {
    const { peerId, stream, data: chunk } = fromJson(data);
    pendingExec.get(peerId)?.emit(stream, chunk);
    return toJson({ ok: true });
  });
  router.respond(CMD.EXEC_EXIT, (_req, data) => {
    const { peerId, info } = fromJson(data);
    const emitter = pendingExec.get(peerId);
    pendingExec.delete(peerId);
    emitter?.emit('exit', info);
    return toJson({ ok: true });
  });
  router.respond(CMD.EXEC_ERROR, (_req, data) => {
    const { peerId, error } = fromJson(data);
    const emitter = pendingExec.get(peerId);
    pendingExec.delete(peerId);
    emitter?.emit('error', fromErrorBody(error, 'exec error'));
    return toJson({ ok: true });
  });
  // The worker (Bare, no @qvac/sdk) asks main to run the actual peer-exec
  // security scan, since chat.cjs's model machinery only exists here.
  router.respond(CMD.SECURITY_SCAN, async (_req, data) => {
    try {
      const chat = require('../chat.cjs');
      const payload = fromJson(data) || {};
      const result = await chat.runSecurityScan(payload);
      return toJson({ ok: true, result });
    } catch (err) {
      return toJson({ ok: false, error: { message: err?.message || String(err) } });
    }
  });
  // Same reason as the scan above: the worker runs under Bare, which has no
  // https, so the direct model fetch happens here.
  router.respond(CMD.FETCH_MODELS, async (_req, data) => {
    try {
      const { ensureModels } = require('../../shared/model-fetch.cjs');
      const { names } = fromJson(data) || {};
      const result = await ensureModels(Array.isArray(names) ? names : []);
      return toJson({ ok: true, result });
    } catch (err) {
      return toJson({ ok: false, error: { message: err?.message || String(err) } });
    }
  });
  // The lesson builder needs Node modules the Bare worker does not have, so
  // the worker asks main whether a declared source builds to the code it got.
  router.respond(CMD.VERIFY_SOURCE, async (_req, data) => {
    try {
      const { isPeerBuildOf } = require('../runner-process.cjs');
      const { coursesDir } = require('../../workers/sandbox/capabilities.cjs').defaultTemplateVars();
      const { source, code } = fromJson(data) || {};
      const result = await isPeerBuildOf({ source, code, cwd: coursesDir });
      return toJson({ ok: true, result });
    } catch (err) {
      return toJson({ ok: false, error: { message: err?.message || String(err) } });
    }
  });
  return router;
}

function spawnWorker() {
  const PearRuntime = loadPearRuntime();
  const w = PearRuntime.run(WORKER_ENTRY, []);
  worker = w;
  w.stderr.on('data', (d) => console.warn('[pear-end worker]', d.toString('utf8')));
  // Unread otherwise: an unconsumed pipe can fill and block the worker's
  // own writes once the OS buffer is full, not just hide its output.
  w.stdout.on('data', (d) => console.log('[pear-end worker]', d.toString('utf8')));
  w.once('exit', (code, signal) => onWorkerExit(w, code, signal));
  rpc = new RPC(w, buildMainRouter());
}

function onWorkerExit(w, code, signal) {
  // shutdownWorker() already cleared the state of the worker it destroyed.
  if (worker !== w) return;
  rpc = null;
  worker = null;
  for (const emitter of pendingExec.values()) {
    emitter.emit('error', workerExitedError('pear-end worker exited'));
  }
  pendingExec.clear();
  if (shuttingDown) return;
  const now = Date.now();
  restartTimes = restartTimes.filter((at) => now - at < RESTART_WINDOW_MS);
  const restarting = meshArgs !== null && restartTimes.length < MAX_RESTARTS;
  console.warn(`[pear-end worker] exited unexpectedly, code=${code} signal=${signal}, restarting=${restarting}`);
  emit('peer:worker-exited', { code: code ?? null, signal: signal ?? null, restarting });
  if (!restarting) {
    // A later init() spawns a fresh worker with the arguments its caller passes.
    meshArgs = null;
    return;
  }
  const delay = RESTART_BASE_MS * 2 ** restartTimes.length;
  restartTimes.push(now);
  restartTimer = setTimeout(restartWorker, delay);
}

async function restartWorker() {
  restartTimer = null;
  try {
    spawnWorker();
    await call(CMD.INIT, meshArgs);
    emit('peer:worker-restarted', { at: Date.now() });
  } catch (err) {
    console.warn('[worker-client] restart failed:', err?.message ?? err);
    // A crash during INIT already went through onWorkerExit(), which scheduled
    // the next try or gave up.
    if (restartTimer || shuttingDown || !meshArgs) return;
    meshArgs = null;
    emit('peer:worker-exited', { code: null, signal: null, restarting: false });
  }
}

async function init({
  store,
  bootstrap = null,
  deviceIdentity = null,
  execPath = null,
  secretScheme = null,
  attestation = null,
  revokedDevices = null,
  auditPath = null,
  userData = null,
}) {
  if (!rpc && meshArgs) throw workerExitedError();
  shuttingDown = false;
  if (!rpc) spawnWorker();
  const args = {
    deviceIdentity,
    bootstrap,
    execPath: execPath || process.execPath,
    bareRuntimeBinPath: resolveBareBin(),
    secretScheme,
    attestation,
    revokedDevices,
    auditPath,
    userData,
  };
  const result = await call(CMD.INIT, args);
  meshArgs = args;
  return result;
}

async function getIdentity() {
  return call(CMD.GET_IDENTITY, {});
}
async function createInvite(opts) {
  return call(CMD.CREATE_INVITE, opts ?? {});
}
async function approve(requestId) {
  return call(CMD.APPROVE, { requestId });
}
async function reject(requestId) {
  return call(CMD.REJECT, { requestId });
}
async function listPending() {
  return call(CMD.LIST_PENDING, {});
}
async function resolveDeviceRequest(requestId, approved) {
  return call(CMD.RESOLVE_DEVICE_REQUEST, { requestId, approved });
}
async function listDeviceRequests() {
  return call(CMD.LIST_DEVICE_REQUESTS, {});
}
async function getAudit(opts) {
  return call(CMD.GET_AUDIT, opts ?? {});
}
async function acceptInvite(inviteB64, opts) {
  return call(CMD.ACCEPT_INVITE, { inviteB64, opts: opts ?? {} });
}
async function listPeers() {
  return call(CMD.LIST_PEERS, {});
}
async function dropPeer(discoveryKeyHex) {
  return call(CMD.DROP_PEER, { discoveryKeyHex });
}
async function setAskEveryRun(discoveryKeyHex, value) {
  return call(CMD.SET_ASK_EVERY_RUN, { discoveryKeyHex, value });
}
async function stopHostedRun(discoveryKeyHex) {
  return call(CMD.STOP_HOSTED_RUN, { discoveryKeyHex });
}
async function setRevokedDevices(keys) {
  // A restart replays meshArgs, so it has to hold the current list.
  if (meshArgs) meshArgs = { ...meshArgs, revokedDevices: keys };
  return call(CMD.SET_REVOKED_DEVICES, { keys });
}
async function lockdown() {
  return call(CMD.LOCKDOWN, {});
}
async function cancelExec(peerId) {
  return call(CMD.CANCEL_EXEC, { peerId });
}
async function clearAudit() {
  return call(CMD.CLEAR_AUDIT, {});
}
async function clearPeerAudit(discoveryKey) {
  return call(CMD.CLEAR_PEER_AUDIT, { discoveryKey });
}

// Matches peer.cjs's synchronous exec() contract: returns an EventEmitter
// immediately. Since the real call is async RPC, dispatch-time failures
// arrive as a deferred 'error' event instead of a synchronous throw.
function exec(args) {
  const emitter = new EventEmitter();
  const { peerId } = args;
  if (!rpc) {
    const err = meshArgs ? workerExitedError() : notInitializedError();
    queueMicrotask(() => emitter.emit('error', err));
    return emitter;
  }
  pendingExec.set(peerId, emitter);
  const req = rpc.request(CMD.EXEC);
  req.send(toJson(args));
  req
    .reply()
    .then((data) => {
      const res = fromJson(data);
      if (!res.ok) {
        pendingExec.delete(peerId);
        emitter.emit('error', fromErrorBody(res.error, 'exec failed'));
      }
      // else: worker-pushed EXEC_CHUNK/EXEC_EXIT/EXEC_ERROR drive the rest.
    })
    .catch((err) => {
      pendingExec.delete(peerId);
      emitter.emit('error', err);
    });
  return emitter;
}

function on(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Mesh teardown only; worker process stays alive so a later init() can re-init in place.
async function close() {
  meshArgs = null;
  if (!rpc) return;
  await call(CMD.CLOSE, {});
}

// App quit requires OS process termination; close() only tears down mesh state.
async function shutdownWorker() {
  shuttingDown = true;
  meshArgs = null;
  clearTimeout(restartTimer);
  restartTimer = null;
  if (!rpc || !worker) return;
  const w = worker;
  try {
    await Promise.race([
      call(CMD.SHUTDOWN, {}),
      new Promise((_, reject) => setTimeout(() => reject(new Error('shutdown timeout')), SHUTDOWN_TIMEOUT_MS)),
    ]);
  } catch (err) {
    console.warn('[worker-client] graceful shutdown failed, force-killing:', err?.message ?? err);
  }
  // Always force-kill too: destroy() on an already-dead process is a no-op.
  try {
    w.destroy();
  } catch {
    // already gone
  }
  rpc = null;
  worker = null;
  pendingExec.clear();
  listeners.clear();
}

module.exports = {
  init,
  getIdentity,
  createInvite,
  approve,
  reject,
  listPending,
  resolveDeviceRequest,
  listDeviceRequests,
  getAudit,
  acceptInvite,
  listPeers,
  dropPeer,
  setAskEveryRun,
  stopHostedRun,
  setRevokedDevices,
  lockdown,
  exec,
  cancelExec,
  clearAudit,
  clearPeerAudit,
  on,
  close,
  shutdownWorker,
  // Exposed for tests that kill the worker to check the restart.
  _workerPid: () => worker?._process?.pid ?? null,
};
