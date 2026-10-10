// Which pages the app window may show, and which of them may call IPC or hold a
// browser permission. Pure functions, so tests load them without Electron.
'use strict';

const path = require('node:path');

// Node's URL serialises non-special schemes to origin 'null', so academy://
// is compared by scheme+host directly instead of by origin.
function isAllowedUrl(url, allowedOrigins) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return allowedOrigins.some((origin) => {
    try {
      const allow = new URL(origin);
      if (allow.protocol === 'academy:') {
        return parsed.protocol === 'academy:' && parsed.host === allow.host;
      }
      return parsed.origin === allow.origin;
    } catch {
      return false;
    }
  });
}

/** The dev server to load, or null for anything that is not plain http on localhost. */
function localDevUrl(raw) {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' && parsed.hostname === 'localhost' ? parsed.href : null;
  } catch {
    return null;
  }
}

/** IPC is accepted only from the window's own top frame, on a page the app serves. */
function isTrustedSender(frame, allowedOrigins) {
  return !!frame && frame.parent === null && isAllowedUrl(frame.url, allowedOrigins);
}

// Copy and paste, the playground's save and open dialogs, and full screen for lesson videos.
const APP_PERMISSIONS = new Set(['clipboard-read', 'clipboard-sanitized-write', 'fileSystem']);

function isPermissionAllowed(permission, url, allowedOrigins) {
  // The video player asks from its own frame, so full screen is not tied to an app page.
  if (permission === 'fullscreen') return true;
  return APP_PERMISSIONS.has(permission) && isAllowedUrl(url, allowedOrigins);
}

function resolveStaticPath(pathname, root) {
  // trailingSlash: true, so directory and extensionless requests land on index.html.
  let p;
  try {
    p = decodeURIComponent(pathname || '/');
  } catch {
    return null;
  }
  const basePrefix = '/p2p-academy';
  if (p === basePrefix || p.startsWith(`${basePrefix}/`)) {
    p = p.slice(basePrefix.length) || '/';
  }
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  const abs = path.resolve(root, '.' + p);
  if (abs !== root && !abs.startsWith(rootWithSep)) return null;
  return abs;
}

module.exports = { isAllowedUrl, localDevUrl, isTrustedSender, isPermissionAllowed, resolveStaticPath };
