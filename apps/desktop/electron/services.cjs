'use strict';

// The long-lived services the main process owns (models, the SDK worker, the
// pear-end worker), each with the function that releases it. Quit disposes
// them in reverse registration order, so a service registered after another
// is gone before the one it may depend on.

function createServiceRegistry() {
  const services = new Map();
  let disposing = false;

  /**
   * @param {string} name
   * @param {() => unknown} dispose
   */
  function register(name, dispose) {
    if (typeof dispose !== 'function') throw new Error(`services: "${name}" needs a dispose function`);
    if (disposing) throw new Error(`services: cannot register "${name}" while disposing`);
    // A second registration would leave the first one with nothing to release it.
    if (services.has(name)) throw new Error(`services: "${name}" is already registered; dispose it first`);
    services.set(name, dispose);
  }

  /** @param {string} name */
  async function dispose(name) {
    const fn = services.get(name);
    if (!fn) return false;
    services.delete(name);
    await fn();
    return true;
  }

  // One failure does not stop the rest, so quit still releases every service.
  async function disposeAll() {
    disposing = true;
    const failed = [];
    try {
      for (const [name, fn] of [...services].reverse()) {
        services.delete(name);
        try {
          await fn();
        } catch (err) {
          console.warn(`[services] dispose "${name}" failed:`, err?.message ?? err);
          failed.push(name);
        }
      }
    } finally {
      disposing = false;
    }
    return failed;
  }

  return { register, dispose, disposeAll, names: () => [...services.keys()] };
}

module.exports = { createServiceRegistry };
