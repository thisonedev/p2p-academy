// @ts-check
'use strict';

// Pre-installs the MCP servers course lessons spawn, from the host; the package list and each package's version and integrity come from course-allowlist.json, never the running code.

const fs = require('fs');
const path = require('path');
const process = require('process');

const { resolveMcpBins } = require('./mcp-bins.cjs');

// A cold install pulls a whole dependency tree.
const WARM_TIMEOUT_MS = 4 * 60_000;

// npx on Windows is npx.cmd, which needs shell: true post-CVE-2024-27980 (see
// warmPackage). That reopens cmd.exe reinterpretation on the package spec, the
// one argument here that isn't a fixed literal, so its parts must clear these first.
const NPM_PACKAGE_NAME_RE = /^(@[a-z0-9-][a-z0-9._-]*\/)?[a-z0-9-][a-z0-9._-]*$/;

// An exact version only: the pin goes to npx as `name@version`, and a range
// or a tag would let the registry choose what gets installed.
const EXACT_VERSION_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const SHA512_INTEGRITY_RE = /^sha512-[A-Za-z0-9+/]{86}==$/;

/**
 * @typedef {{ name: string, version: string, integrity: string }} McpPin
 */

/**
 * @param {unknown} entry
 * @returns {McpPin | null}
 */
function parsePin(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const { name, version, integrity } = /** @type {Record<string, unknown>} */ (entry);
  if (typeof name !== 'string' || !NPM_PACKAGE_NAME_RE.test(name)) return null;
  if (typeof version !== 'string' || !EXACT_VERSION_RE.test(version)) return null;
  if (typeof integrity !== 'string' || !SHA512_INTEGRITY_RE.test(integrity)) return null;
  return { name, version, integrity };
}

/** The spec both the host install and the child's npx use, so both resolve to one `_npx` directory. */
function pinSpec(pin) {
  return `${pin.name}@${pin.version}`;
}

/**
 * The version and integrity npm's lockfile records for `name` in one `_npx/<hash>` directory.
 * @returns {{ version: string | null, integrity: string | null } | null}
 */
function lockedPackage(hashDir, name) {
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(hashDir, 'package-lock.json'), 'utf8'));
    const entry = lock?.packages?.[`node_modules/${name}`];
    if (!entry || !fs.statSync(path.join(hashDir, 'node_modules', name)).isDirectory()) return null;
    return { version: entry.version ?? null, integrity: entry.integrity ?? null };
  } catch {
    return null;
  }
}

function npxHashDirs(cacheDir) {
  try {
    return fs.readdirSync(path.join(cacheDir, '_npx'));
  } catch {
    return [];
  }
}

/** True once the cache holds exactly the pinned version with the pinned integrity. */
function isWarm(cacheDir, pin) {
  return hashDirsFor(cacheDir, [pin]).length > 0;
}

/**
 * Hash directory names under `_npx` that hold any of `pins`. npx locks
 * per hash dir (a `concurrency.lock` it mkdir's even for an already-cached
 * package); the sandbox needs these specific names to grant that one write.
 * @param {string} cacheDir
 * @param {McpPin[]} pins
 * @returns {string[]}
 */
function hashDirsFor(cacheDir, pins) {
  const root = path.join(cacheDir, '_npx');
  return npxHashDirs(cacheDir).filter((hash) =>
    pins.some((pin) => {
      const locked = lockedPackage(path.join(root, hash), pin.name);
      return locked?.version === pin.version && locked.integrity === pin.integrity;
    }),
  );
}

/** Removes every `_npx` directory that holds `pin`'s version under some other integrity. */
function dropMismatched(cacheDir, pin) {
  const root = path.join(cacheDir, '_npx');
  let dropped = 0;
  for (const hash of npxHashDirs(cacheDir)) {
    const locked = lockedPackage(path.join(root, hash), pin.name);
    if (!locked || locked.version !== pin.version || locked.integrity === pin.integrity) continue;
    fs.rmSync(path.join(root, hash), { recursive: true, force: true });
    dropped += 1;
  }
  return dropped;
}

/**
 * Installs `pin` into the child's npm cache from this process, with lifecycle
 * scripts off. The package-only invocation avoids leaving an MCP server on stdio forever.
 * @param {string} cacheDir
 * @param {McpPin | { name: string }} pin
 * @returns {{ ok: boolean, error?: string }}
 */
function warmPackage(cacheDir, pin) {
  const checked = parsePin(pin);
  if (!checked) {
    return { ok: false, error: 'the allowlist entry needs a valid npm package name, an exact version, and a sha512 integrity' };
  }
  if (isWarm(cacheDir, checked)) return { ok: true };
  const { npx } = resolveMcpBins();
  if (!npx) return { ok: false, error: 'npx is not installed on this device' };

  const { execFileSyncCompat: execFileSync } = require('./exec-file-sync.cjs');
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    execFileSync(npx, ['--yes', '--ignore-scripts', '--package', pinSpec(checked), '--', 'node', '-e', '0'], {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: WARM_TIMEOUT_MS,
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        npm_config_cache: cacheDir,
        NPM_CONFIG_CACHE: cacheDir,
        npm_config_update_notifier: 'false',
        npm_config_fund: 'false',
      },
    });
  } catch (err) {
    return { ok: false, error: err?.message ? String(err.message).slice(0, 200) : 'install failed' };
  }
  if (isWarm(cacheDir, checked)) return { ok: true };
  // Nothing from the install has run yet (scripts are off), so a tarball with
  // another integrity is deleted before any child could execute it.
  if (dropMismatched(cacheDir, checked) > 0) {
    return { ok: false, error: `${pinSpec(checked)} does not have the integrity the allowlist pins` };
  }
  return { ok: false, error: `${pinSpec(checked)} did not appear in the cache after install` };
}

/**
 * @param {string} cacheDir
 * @param {Array<McpPin | { name: string }>} pins from the shipped allowlist
 * @returns {{ ok: boolean, failed: Array<{ pkg: string, error: string }> }}
 */
function warmPackages(cacheDir, pins) {
  const failed = [];
  for (const pin of pins) {
    const result = warmPackage(cacheDir, pin);
    if (!result.ok) failed.push({ pkg: typeof pin?.name === 'string' ? pin.name : 'unknown', error: result.error ?? 'unknown' });
  }
  return { ok: failed.length === 0, failed };
}

module.exports = {
  isWarm,
  hashDirsFor,
  warmPackage,
  warmPackages,
  parsePin,
  pinSpec,
  WARM_TIMEOUT_MS,
  NPM_PACKAGE_NAME_RE,
};
