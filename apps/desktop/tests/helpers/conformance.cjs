'use strict';

// What each platform's sandbox is claimed to enforce, in one table; every row
// is asserted against a real kernel by integration/sandbox-conformance.cjs.
//
// `expect` values:
//   'denied'      the platform stops it, and the test fails if the run succeeds
//   'allowed'     the platform permits it on purpose, asserted so a change shows
//   'not-claimed' the platform cannot enforce it; the row records the gap and
//                 names what refuses the run instead

const os = require('node:os');
const path = require('node:path');

const { appStateDir } = require('../../workers/sandbox/capabilities.cjs');

// Reports 'blocked: <errno>' or 'leaked', never throws, so a denial and a crash cannot be read as the same thing.
const attempt = (body) =>
  `try { ${body} } catch (e) { process.stdout.write('blocked: ' + e.code + '\\n'); process.exit(0); }`;

const readFile = (file) =>
  attempt(
    `const d = require('fs').readFileSync(${JSON.stringify(file)}, 'utf8');`
      + `process.stdout.write('leaked ' + d.length + '\\n');`,
  );

// A host that resolves but is not loopback; the timeout branch counts as reached, since the connection was permitted.
const connectTo = (host) =>
  `const req = require('http').get('http://${host}/', () => { process.stdout.write('reached\\n'); process.exit(0); });`
  + `req.on('error', (e) => { process.stdout.write('blocked: ' + e.code + '\\n'); process.exit(0); });`
  + `req.setTimeout(6000, () => { process.stdout.write('reached: timeout\\n'); process.exit(0); });`;

/**
 * @typedef {object} ConformanceRow
 * @property {string} id
 * @property {string} claim what the sandbox is said to guarantee
 * @property {string[]} grants run grants to apply
 * @property {(ctx: { runDir: string, hostPid: number, hostSocket: string, dylib: string, userData?: string }) => string} code snippet to run inside the sandbox
 * @property {{ darwin: string, linux: string }} expect
 * @property {string} [note] why a platform does not claim it
 */

/** @type {ConformanceRow[]} */
const CONFORMANCE = [
  {
    id: 'network-none',
    claim: "with no network grant, connect() fails",
    grants: [],
    code: () => connectTo('example.com'),
    expect: { darwin: 'denied', linux: 'denied' },
  },
  {
    id: 'network-loopback-is-not-egress',
    claim: "with a loopback grant, a non-loopback connect() fails",
    grants: ['network-loopback'],
    code: () => connectTo('example.com'),
    expect: { darwin: 'denied', linux: 'denied' },
  },
  {
    id: 'network-granted-is-unfiltered',
    claim: 'with a full network grant, any host is reachable',
    grants: ['network'],
    code: () => connectTo('example.com'),
    expect: { darwin: 'allowed', linux: 'allowed' },
    note: 'Neither backend filters by domain. Asserted so it stays a known gap.',
  },
  {
    id: 'write-outside-run-dir',
    claim: 'writes outside the run directory fail',
    grants: [],
    code: () =>
      attempt(
        `require('fs').writeFileSync('/usr/ta-conformance-${process.pid}.txt', 'x');`
          + `process.stdout.write('leaked\\n');`,
      ),
    expect: { darwin: 'denied', linux: 'denied' },
  },
  {
    id: 'write-inside-run-dir',
    claim: 'the run directory is writable',
    grants: [],
    code: ({ runDir }) =>
      attempt(
        `require('fs').writeFileSync(${JSON.stringify(path.join('RUNDIR', 'ok.txt'))}.replace('RUNDIR', ${JSON.stringify(runDir)}), 'x');`
          + `process.stdout.write('leaked\\n');`,
      ),
    expect: { darwin: 'allowed', linux: 'allowed' },
    note: 'The one place a run may write. "leaked" is the success token here.',
  },
  {
    id: 'app-state-unreadable',
    claim: "the app's own state directory is unreadable",
    grants: [],
    // The path is the resolved userData when supplied to wrapSpawn, otherwise the home-default.
    code: (ctx) => {
      const target = ctx.userData
        ? path.join(ctx.userData, 'identity-v3.json')
        : path.join(appStateDir(), 'identity-v3.json');
      return readFile(target);
    },
    expect: { darwin: 'denied', linux: 'denied' },
  },
  {
    id: 'secrets-dir-unreadable',
    claim: 'the local encryption key is unreadable',
    grants: [],
    code: () => readFile(path.join(os.homedir(), '.p2p-academy', 'keys', 'local-key')),
    expect: { darwin: 'denied', linux: 'denied' },
  },
  {
    id: 'symlink-escape',
    claim: 'a run cannot create a symlink inside its writable area',
    grants: [],
    code: ({ runDir }) =>
      attempt(
        `require('fs').symlinkSync('/etc/passwd', ${JSON.stringify(runDir)} + '/escape');`
          + `process.stdout.write('leaked\\n');`,
      ),
    expect: { darwin: 'denied', linux: 'denied' },
    note:
      'macOS denies file-write-create on vnode-type SYMLINK; Linux denies the '
      + 'symlink syscalls in seccomp-filter.cjs. Without it a link planted in a '
      + 'writable bind is followed back out of it.',
  },
  {
    id: 'dns-without-network',
    claim: 'with no network grant, a DNS lookup fails',
    grants: [],
    code: () =>
      `require('dns').lookup('example.com', (e, address) => {`
      + ` process.stdout.write(e ? 'blocked: ' + e.code + '\\n' : 'leaked ' + address + '\\n'); process.exit(0); });`,
    expect: { darwin: 'denied', linux: 'denied' },
    note: 'A DNS query carries data out on its own, so name lookups go with the network grant.',
  },
  {
    id: 'signal-outside-run',
    claim: 'a run cannot signal a process outside its own tree',
    grants: [],
    // Signal 0 is the permission check alone, so the test process is never hit.
    code: ({ hostPid }) =>
      attempt(`process.kill(${hostPid}, 0); process.stdout.write('leaked\\n');`),
    expect: { darwin: 'denied', linux: 'denied' },
    note: 'macOS allows signals to the run and its children only; on Linux the run has its own PID namespace.',
  },
  {
    id: 'unix-socket-outside-run',
    claim: "a unix socket in the host's temp directory is unreachable",
    grants: ['network'],
    code: ({ hostSocket }) =>
      `const s = require('net').connect(${JSON.stringify(hostSocket)});`
      + `s.on('connect', () => { process.stdout.write('reached\\n'); process.exit(0); });`
      + `s.on('error', (e) => { process.stdout.write('blocked: ' + e.code + '\\n'); process.exit(0); });`,
    expect: { darwin: 'denied', linux: 'denied' },
    note: 'Run with a network grant, so the rule holds when IP egress is open. The socket stands in for an ssh-agent.',
  },
  {
    id: 'native-code-from-run-dir',
    claim: 'a run cannot load native code it wrote',
    grants: [],
    // dlopen of a copied dylib: the sandbox refuses the mapping, where an
    // allowed dlopen gets as far as Node's own "did not self-register" check.
    code: ({ runDir, dylib }) =>
      `const copy = ${JSON.stringify(runDir)} + '/copy.dylib';`
      + `require('fs').copyFileSync(${JSON.stringify(dylib)}, copy);`
      + `try { process.dlopen({ exports: {} }, copy); process.stdout.write('leaked\\n'); }`
      + `catch (e) { process.stdout.write(/sandbox/.test(e.message) ? 'blocked: sandbox\\n' : 'leaked: ' + e.message.split('\\n')[0] + '\\n'); }`,
    expect: { darwin: 'denied', linux: 'not-claimed' },
    note: 'Linux has no rule for it.',
  },
];

module.exports = { CONFORMANCE, attempt };
