'use strict';

// Pins the academy:// Content-Type for Next's route data. Served as anything but text/plain,
// every in-app link falls back to a full page reload, and an early click aborted the startup load.

const test = require('brittle');
const path = require('path');
const fs = require('fs');
const { staticMimeFor } = require('../../electron/static-mime.cjs');

test('static mime - route data index.txt is text/plain', (t) => {
  t.is(staticMimeFor('/out/playground/index.txt'), 'text/plain; charset=utf-8');
  t.is(staticMimeFor('/out/INDEX.TXT'), 'text/plain; charset=utf-8');
});

test('static mime - other files keep the shared table', (t) => {
  t.is(staticMimeFor('/out/index.html'), 'text/html; charset=utf-8');
  t.is(staticMimeFor('/out/_next/static/chunks/app.js'), 'text/javascript; charset=utf-8');
});

test('static mime - the academy handler uses it', (t) => {
  const main = fs.readFileSync(path.resolve(__dirname, '../../electron/main.js'), 'utf8');
  t.ok(main.includes("'Content-Type': staticMimeFor(finalPath)"));
});

test('startup load - a superseded load is not treated as a failure', (t) => {
  const main = fs.readFileSync(path.resolve(__dirname, '../../electron/main.js'), 'utf8');
  t.absent(/await win\.loadURL\(/.test(main.replace(/async function loadInto[\s\S]*?\n}\n/, '')));
  t.ok(main.includes("if (err?.code !== 'ERR_ABORTED') throw err;"));
});
