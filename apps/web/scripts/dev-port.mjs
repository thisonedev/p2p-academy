// `next dev` must own :3000, since the desktop app loads PEAR_DEV_URL from it.
// A dev server this repo left running from an earlier session is stopped here;
// anything else on the port is reported, never killed.
import { execFileSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3000;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function portIsFree() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(PORT);
  });
}

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function isInsideRepo(dir) {
  const rel = path.relative(repoRoot, dir);
  return dir !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// Returns the pids to stop, or null when the port's owner isn't ours.
function staleOwnerPids() {
  if (process.platform === 'win32') {
    const line = run('netstat', ['-ano', '-p', 'TCP'])
      .split(/\r?\n/)
      .find((l) => /LISTENING/.test(l) && new RegExp(`:${PORT}\\s`).test(l));
    const pid = line?.trim().split(/\s+/).pop();
    if (!pid) return null;
    const cmdline = run('powershell', [
      '-NoProfile',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
    ]);
    return cmdline.toLowerCase().includes(repoRoot.toLowerCase()) ? [pid] : null;
  }
  const pids = run('lsof', ['-nP', `-iTCP:${PORT}`, '-sTCP:LISTEN', '-t'])
    .split('\n')
    .filter(Boolean);
  if (pids.length === 0) return null;
  for (const pid of pids) {
    const cwd = run('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'])
      .split('\n')
      .find((l) => l.startsWith('n'));
    if (!cwd || !isInsideRepo(cwd.slice(1))) return null;
  }
  return pids;
}

function stop(pids) {
  if (process.platform === 'win32') {
    for (const pid of pids) run('taskkill', ['/PID', pid, '/T', '/F']);
    return;
  }
  // The whole process group, so the old `next dev` parent can't respawn its
  // server and the old run's tsc watchers go with it.
  const ownGroup = run('ps', ['-o', 'pgid=', '-p', String(process.pid)]).trim();
  for (const pid of pids) {
    const group = run('ps', ['-o', 'pgid=', '-p', pid]).trim();
    try {
      if (group && group !== ownGroup) process.kill(-Number(group), 'SIGTERM');
      else process.kill(Number(pid), 'SIGTERM');
    } catch {
      // already gone
    }
  }
}

async function waitForFreePort(ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await portIsFree()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

if (!(await portIsFree())) {
  const pids = staleOwnerPids();
  if (!pids) {
    console.error(
      `[dev] Port ${PORT} is taken by a process outside this repo. The desktop app expects the web dev server on ${PORT}, so stop that process and run \`pnpm dev\` again.`,
    );
    process.exit(1);
  }
  console.log(`[dev] Stopping a dev server left running on port ${PORT} (pid ${pids.join(', ')}).`);
  stop(pids);
  if (!(await waitForFreePort(10_000))) {
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGKILL');
      } catch {
        // already gone
      }
    }
    if (!(await waitForFreePort(5_000))) {
      console.error(`[dev] Port ${PORT} is still busy after stopping pid ${pids.join(', ')}.`);
      process.exit(1);
    }
  }
}
