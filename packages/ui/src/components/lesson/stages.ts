// Host stages, read off the lines the peer worker already prints. Its phase
// reporter (apps/desktop/workers/peer/exec-host.cjs) writes `→ Label...` when a
// stage opens and `  ✓ Outcome (1.2s)` when it closes, both on stderr, so the
// rail needs no new plumbing. A same-device run prints neither and renders flat.

export interface StageLine {
  stream: string;
  line: string;
}

// The lesson runtime traces its SDK calls with the markers the host also uses
// for its stages, so one run carries both. Only a host phase ends in an
// ellipsis, which separates `Preparing packages...` from `loadModel({ ctx })`.
const HOST_PHASE = /\.{3}$/;
const LINE_BREAK = /[\n\r\u2028\u2029]/;
// `(1.2s)` at the end of a close marker.
const SECONDS_SUFFIX = /\s\((\d+(?:\.\d+)?)s\)$/;

// Marker parsing uses trim and fixed-prefix checks instead of one regex with lazy
// groups, so a long run of spaces in a line can't make it quadratic.
/** `→ label`: the label, or null. */
export function parseStageOpen(line: string): string | null {
  if (!line.startsWith('→') || !/^\s/.test(line.slice(1))) return null;
  const label = line.slice(1).trim();
  return label && !LINE_BREAK.test(label) ? label : null;
}

/** `✓ label` with an optional `(1.2s)`: the label and seconds, or null. */
export function parseStageClose(line: string): { label: string; seconds: number | null } | null {
  const text = line.trim();
  if (!text.startsWith('✓') || !/^\s/.test(text.slice(1))) return null;
  let label = text.slice(1).trim();
  let seconds: number | null = null;
  const suffix = SECONDS_SUFFIX.exec(label);
  if (suffix && label.slice(0, suffix.index).trim()) {
    label = label.slice(0, suffix.index).trimEnd();
    seconds = Number(suffix[1]);
  }
  return label && !LINE_BREAK.test(label) ? { label, seconds } : null;
}

export interface StageSegment {
  kind: 'stage';
  /** Wording when the stage opens. Preserved after close so the opener line
   *  doesn't get overwritten by the closer's text. */
  openLabel: string;
  /** Wording when the stage closes (or the open wording if it never closed). */
  closeLabel: string;
  /** 'note' is a ✓ with no opener, such as a stage the host skipped.
   *  'settled' is an opener whose ✓ went to a later entry. */
  state: 'open' | 'done' | 'note' | 'settled';
  seconds: number | null;
  /** An SDK call the lesson made, rather than a stage the host ran. */
  call: boolean;
}

export interface LinesSegment {
  kind: 'lines';
  /** Index of the first line, so the progress bar still renders at its own. */
  from: number;
  count: number;
}

export type RunSegment = StageSegment | LinesSegment;

/** Splits a run's output into stage rows and the output printed under each.
 *  `settled` reports an opener whose ✓ never appears in these lines: `true` for
 *  a run that has ended, or the label of one closed by a later entry. */
export function splitStages(lines: StageLine[], settled: boolean | string = false): RunSegment[] {
  const segments: RunSegment[] = [];
  let open: StageSegment | null = null;
  // A marker ends the run of lines it interrupts. Reading the tail of
  // `segments` instead would rejoin what a call printed with what followed it.
  let printed: LinesSegment | null = null;

  for (let i = 0; i < lines.length; i++) {
    const entry = lines[i];
    if (typeof entry?.line !== 'string') continue;
    const fromHost = entry.stream === 'stderr';

    const opened = fromHost ? parseStageOpen(entry.line) : null;
    if (opened) {
      open = {
        kind: 'stage',
        openLabel: opened,
        closeLabel: opened,
        state: 'open',
        seconds: null,
        call: !HOST_PHASE.test(opened),
      };
      segments.push(open);
      printed = null;
      continue;
    }

    const closed = fromHost ? parseStageClose(entry.line) : null;
    if (closed) {
      const { seconds } = closed;
      if (open) {
        // Closing in place: keep the opener wording on openLabel so the
        // transcript shows `→ Verifying the requesting device...` and
        // `✓ Device verified` as two distinct lines.
        open.closeLabel = closed.label;
        open.state = 'done';
        open.seconds = seconds;
        open = null;
      } else {
        segments.push({ kind: 'stage', openLabel: '', closeLabel: closed.label, state: 'note', seconds, call: false });
      }
      printed = null;
      continue;
    }

    if (printed) printed.count++;
    else {
      printed = { kind: 'lines', from: i, count: 1 };
      segments.push(printed);
    }
  }

  // A label settles only the stage it names, so a model load opening after it
  // in the same run keeps pulsing. An ended run settles every stage it left open.
  for (const segment of segments) {
    if (segment.kind !== 'stage' || segment.state !== 'open') continue;
    if (settled === true || segment.openLabel.replace(HOST_PHASE, '') === settled) segment.state = 'settled';
  }

  return segments;
}

/** `12.4s`, or `2m14s` past a minute, since `134.0s` takes a moment to read. */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m${String(Math.round(seconds % 60)).padStart(2, '0')}s`;
}
