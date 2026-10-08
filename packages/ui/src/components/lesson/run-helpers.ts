import type { MatchStatus } from '@academy/validation';
import type { LessonArgvSlot, LessonData, LessonTest, OutputLine } from './lesson-types.js';

const RUN_MODES = ['simulated', 'this-device', 'remote'] as const;

export type RunMode = (typeof RUN_MODES)[number];

const ARGV_OVERRIDE_PREFIX = 'argv.override.';

const ARGV_CAPTURED_PREFIX = 'argv.captured.';

export const CAPTURE_MARKERS: Array<{ pattern: RegExp; target: string }> = [
  { pattern: /▸\s+Provider Public Key:\s+([a-f0-9]{64})/i, target: 'lastProviderPublicKey' },
];

// Which check-entry verdicts count as the lesson being done. 'match' is set
// client-side by normalizeLessonCode, never returned by the AI itself.
export const PASSING_MATCH_STATUSES = new Set<MatchStatus>(['match', 'complete', 'different-but-valid']);

// Streamed chunks rarely align with real newlines; treating each chunk as
// its own line inserted a phantom space at every boundary once rejoined.
export function appendChunkLines(
  lines: OutputLine[],
  chunk: { stream: OutputLine['stream']; data: string },
): OutputLine[] {
  const segments = chunk.data.split('\n');
  const last = lines[lines.length - 1];
  const merged =
    last && last.stream === chunk.stream
      ? [...lines.slice(0, -1), { stream: chunk.stream, line: last.line + segments[0] }]
      : [...lines, { stream: chunk.stream, line: segments[0] }];
  for (let i = 1; i < segments.length; i++) {
    merged.push({ stream: chunk.stream, line: segments[i] });
  }
  return merged;
}

// Matches the label shown in the device picker below, so a run's "ran on X"
// header always agrees with what X was called when it was selected.
export function peerDisplayName(p: { discoveryKey: string; userData: unknown }): string {
  return p.userData && typeof p.userData === 'object' && 'name' in p.userData
    ? String((p.userData as { name: unknown }).name)
    : p.discoveryKey.slice(0, 8);
}

// Self-reported at pairing time (see devices-panel.tsx's pairingUserData);
// Windows has no AppContainer sandbox, so a Windows peer can never execute.
export function peerIsWindows(userData: unknown): boolean {
  return Boolean(userData && typeof userData === 'object' && 'os' in userData && (userData as { os: unknown }).os === 'windows');
}

export function overrideKey(slotName: string): string {
  return `${ARGV_OVERRIDE_PREFIX}${slotName}`;
}

export function capturedKey(source: string): string {
  return `${ARGV_CAPTURED_PREFIX}${source}`;
}

export function sourceFromArgvFrom(from: LessonArgvSlot['from']): string | null {
  const m = from.match(/^state:(.+)$/);
  return m ? m[1] : null;
}

export function peerLabel(peer: { discoveryKey: string; userData: unknown }): string {
  const data = peer.userData;
  if (
    data &&
    typeof data === 'object' &&
    'name' in data &&
    typeof (data as { name: unknown }).name === 'string'
  ) {
    return (data as { name: string }).name;
  }
  if (
    data &&
    typeof data === 'object' &&
    'hostname' in data &&
    typeof (data as { hostname: unknown }).hostname === 'string'
  ) {
    return (data as { hostname: string }).hostname;
  }
  return peer.discoveryKey.slice(0, 12);
}

export function argInputPlaceholder(slot: LessonArgvSlot, captured: Record<string, string>): string {
  const source = sourceFromArgvFrom(slot.from);
  if (source) {
    const value = captured[source];
    if (value) return `auto-captured: ${value}`;
    return `auto from previous run (${source})`;
  }
  if (slot.from === 'literal' && slot.default) return slot.default;
  return 'optional';
}

export function runFileName(data: LessonData): string {
  const slug = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'lesson'}.mts`;
}

export function runLabel(data: LessonData): string {
  if (data.currentLesson?.title) return data.currentLesson.title;
  const chapter = data.currentChapter?.slug;
  const lesson = data.currentLesson?.slug;
  if (chapter && lesson) return `${chapter}/${lesson}`;
  return data.title;
}

/** The part of a run's final `output` the live stream never carried; appending all of `output` would print a failed run's log twice. */
export function unstreamed(output: string, streamed: OutputLine[]): string {
  let rest = output;
  for (const stream of ['stdout', 'stderr'] as const) {
    const text = streamed
      .filter((entry) => entry.stream === stream)
      .map((entry) => entry.line)
      .join('\n');
    if (text) rest = rest.replace(text, '');
  }
  return rest.trim();
}

type RemoteRunState =
  | { kind: 'running'; peerId: string; startedAt: number }
  | { kind: 'ok'; peerId: string; startedAt: number; endedAt: number }
  | {
      kind: 'err';
      peerId: string;
      startedAt: number;
      endedAt: number;
      code: number | null;
      signal: string | null;
      message: string | null;
    };

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  const m2 = min % 60;
  return `${hr}h ${m2}m`;
}

// Pattern flags must match the runner's logic so a passing test here also passes the browser's Check Answer.
export function runTests(code: string, tests: LessonTest[]) {
  return tests.map((t) => {
    let passed = false;
    if (t.pattern) {
      try {
        passed = new RegExp(t.pattern, 'm').test(code);
      } catch {
        passed = false;
      }
    }
    if (!passed && t.contains) {
      passed = code.includes(t.contains);
    }
    return { id: t.id, description: t.description, passed };
  });
}

export function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
