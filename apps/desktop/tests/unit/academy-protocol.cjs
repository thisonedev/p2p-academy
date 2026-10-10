'use strict';

// Pins the navigation hardening's URL comparison and resolveStaticPath, which
// the academy:// protocol handler relies on. Node's URL serialises every
// non-special scheme to origin 'null', so a naive origin comparison would
// accept academy://evil/ alongside academy://app/.

const test = require('brittle');
const path = require('path');
const fs = require('fs');
const os = require('os');

const main = fs.readFileSync(
  path.resolve(__dirname, '../../electron/main.js'),
  'utf8',
);
const {
  isAllowedUrl: simulateWillNavigate,
  localDevUrl,
  isTrustedSender,
  isPermissionAllowed,
  resolveStaticPath,
} = require('../../electron/window-trust.cjs');

test('academy protocol - academy://app/ is allowed when academy://app is in the allowlist', (t) => {
  t.is(
    simulateWillNavigate('academy://app/', ['academy://app/']),
    true,
  );
});

test('academy protocol - academy://evil/ is refused when academy://app is in the allowlist', (t) => {
  t.is(
    simulateWillNavigate('academy://evil/', ['academy://app/']),
    false,
  );
});

test('academy protocol - origin comparison would accept academy://evil/ (the trap)', (t) => {
  const a = new URL('academy://app/').origin;
  const b = new URL('academy://evil/').origin;
  t.is(a, b, 'Node serialises both custom-scheme URLs to the same origin');
  t.is(a, 'null', 'both origins are the opaque string "null"');
});

test('academy protocol - academy://anything is refused when allowlist is empty', (t) => {
  t.is(simulateWillNavigate('academy://app/', []), false, 'no allowlist, no entry');
});

test('academy protocol - http(s) dev URLs compare on origin', (t) => {
  t.is(
    simulateWillNavigate('http://localhost:3000/page', ['http://localhost:3000']),
    true,
    'http origin equality still works',
  );
  t.is(
    simulateWillNavigate('http://localhost:9999/page', ['http://localhost:3000']),
    false,
    'different port is refused',
  );
  t.is(
    simulateWillNavigate('http://evil.example/', ['http://localhost:3000']),
    false,
    'different host is refused',
  );
});

test('academy protocol - main.js uses the shared check', (t) => {
  t.ok(/isAllowedUrl\(url, allowedOrigins\)/.test(main), 'will-navigate goes through isAllowedUrl');
  t.ok(/isTrustedSender\(evt\.senderFrame, appOrigins\)/.test(main), 'every IPC handler checks its caller');
});

test('academy protocol - resolveStaticPath rejects escapes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-proto-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');
  try {
    t.ok(resolveStaticPath('/', root) === root);
    t.ok(
      resolveStaticPath('/index.html', root) === path.join(root, 'index.html'),
    );
    t.is(resolveStaticPath('/../../../etc/passwd', root), null);
    t.is(resolveStaticPath('/%E0%A4%A', root), null, 'a malformed escape is a 404, not a throw');
    t.is(
      resolveStaticPath('/p2p-academy/index.html', root),
      path.join(root, 'index.html'),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('academy protocol - main.js no longer requires node:http', (t) => {
  t.absent(
    /require\('node:http'\)|require\('http'\)/.test(main),
  );
});

test('academy protocol - a dev URL must be plain http on localhost', (t) => {
  t.is(localDevUrl('http://localhost:3000'), 'http://localhost:3000/');
  t.is(localDevUrl('https://localhost:3000'), null, 'https is refused');
  t.is(localDevUrl('http://evil.example'), null, 'another host is refused');
  t.is(localDevUrl('http://localhost.evil.example'), null, 'a lookalike host is refused');
  t.is(localDevUrl('file:///etc/passwd'), null);
  t.is(localDevUrl('not a url'), null);
  t.is(localDevUrl(null), null);
});

test('academy protocol - IPC is for the top frame of an app page', (t) => {
  const origins = ['academy://app/'];
  t.is(isTrustedSender({ parent: null, url: 'academy://app/courses/' }, origins), true);
  t.is(isTrustedSender({ parent: {}, url: 'academy://app/courses/' }, origins), false, 'a subframe is refused');
  t.is(isTrustedSender({ parent: null, url: 'https://www.youtube-nocookie.com/' }, origins), false);
  t.is(isTrustedSender({ parent: null, url: 'data:text/html,hi' }, origins), false);
  t.is(isTrustedSender(null, origins), false, 'a frame that is already gone is refused');
  t.is(isTrustedSender({ parent: null, url: 'academy://app/' }, []), false, 'nothing is trusted before the window opens');
});

test('academy protocol - permissions are a short allowlist', (t) => {
  const origins = ['academy://app/'];
  t.is(isPermissionAllowed('clipboard-sanitized-write', 'academy://app/', origins), true);
  t.is(isPermissionAllowed('fileSystem', 'academy://app', origins), true);
  t.is(isPermissionAllowed('clipboard-read', 'https://www.youtube-nocookie.com', origins), false);
  t.is(isPermissionAllowed('fullscreen', 'https://www.youtube-nocookie.com', origins), true);
  for (const denied of ['media', 'geolocation', 'notifications', 'openExternal', 'hid', 'usb']) {
    t.is(isPermissionAllowed(denied, 'academy://app/', origins), false, `${denied} is refused`);
  }
});
