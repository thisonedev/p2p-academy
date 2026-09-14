'use strict';

// Pins the renderer Content-Security-Policy, emitted in two places (the
// Electron main-process header and the web export's <meta>) that must agree.
// A remote origin in script-src is the failure mode this guards against.

const test = require('brittle');
const fs = require('node:fs');
const path = require('node:path');

const { CSP_DIRECTIVES, CONTENT_SECURITY_POLICY, SECURITY_HEADERS } = require('../../electron/security-headers.cjs');

const WEB_LAYOUT = path.resolve(__dirname, '../../../web/src/app/layout.tsx');
const META_ONLY_POLICY = CSP_DIRECTIVES.join('; ');

// The hero demo video's two required, reviewed exceptions to an otherwise
// remote-origin-free policy: a thumbnail image and a video embed, neither of
// which can reach window.academy or read page state.
const ALLOWED_REMOTE_ORIGINS = new Set(['https://img.youtube.com', 'https://www.youtube-nocookie.com']);

test('csp - no directive names a remote origin outside the reviewed allowlist', (t) => {
  const csp = CONTENT_SECURITY_POLICY;
  const directives = {};
  for (const d of csp.split(';').map((s) => s.trim()).filter(Boolean)) {
    const idx = d.indexOf(' ');
    if (idx === -1) {
      directives[d] = '';
      continue;
    }
    directives[d.slice(0, idx)] = d.slice(idx + 1);
  }
  for (const [name, value] of Object.entries(directives)) {
    const hosts = value.match(/https?:\/\/[^\s]+/g) ?? [];
    const unexpected = hosts.filter((h) => !ALLOWED_REMOTE_ORIGINS.has(h));
    t.alike(unexpected, [], `${name} names no unreviewed remote origin`);
  }
});

test('csp - the electron header and the web <meta> agree on the policy', (t) => {
  // frame-ancestors is the one directive a <meta> ignores, so it stays only in the Electron header.
  const source = fs.readFileSync(WEB_LAYOUT, 'utf8');
  const directives = [];
  // Quote-agnostic: biome picks the outer quote per-string based on content
  // (frame-src has no apostrophe, so it gets single quotes unlike the rest),
  // so this matches either and requires the closing quote to match the opener.
  const re = /(["'])((?:default|script|style|img|frame|media|font|worker|connect|object|base|form).*?)\1/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    directives.push(m[2]);
  }
  // The web layout must include every directive the electron module exports (frame-ancestors excepted).
  for (const directive of CSP_DIRECTIVES) {
    t.ok(directives.includes(directive), `${directive} is in both policies`);
  }
  t.ok(
    !source.includes('https://cdn.jsdelivr.net'),
    'web layout does not name jsdelivr anywhere',
  );
});

test('csp - SECURITY_HEADERS has the four static headers a renderer needs', (t) => {
  t.ok(SECURITY_HEADERS['Content-Security-Policy'], 'CSP is set');
  t.is(SECURITY_HEADERS['X-Content-Type-Options'], 'nosniff', 'no MIME sniffing');
  t.is(SECURITY_HEADERS['X-Frame-Options'], 'DENY', 'no framing');
  t.is(SECURITY_HEADERS['Referrer-Policy'], 'no-referrer', 'no referrer leak');
});
