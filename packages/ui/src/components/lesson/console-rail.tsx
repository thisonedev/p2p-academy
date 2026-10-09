'use client';

import { useState, useEffect, createContext, useRef, useContext } from 'react';
import { QVAC_EDITOR_BACKGROUND } from './editor/qvac-theme.js';

// Rotating word so a slow model doesn't look frozen.
const SHUFFLE_WORDS = [
  'Thinking',
  'Strategizing',
  'Analyzing',
  'Reasoning',
  'Considering',
  'Advancing',
  'Processing',
  'Reflecting',
  'Pondering',
  'Adjusting',
  'Distilling',
  'Synthesizing',
  'Working',
  'Computing',
  'Crunching',
];

function useShuffleWord(active: boolean): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const id = setInterval(() => setIndex((i) => (i + 1) % SHUFFLE_WORDS.length), 1000);
    return () => clearInterval(id);
  }, [active]);
  return SHUFFLE_WORDS[index];
}

export function ShuffleWord({ active, className = '' }: { active: boolean; className?: string }) {
  const word = useShuffleWord(active);
  return (
    <span key={word} className={`inline-block animate-in fade-in slide-in-from-left-2 duration-200 ${className}`}>
      {word}…
    </span>
  );
}

// A run whose checks are all cached finishes its stages inside one frame, so
// they all appear at once and nothing reads as having happened. Revealing them a
// beat apart paces only when a row appears; its duration stays the measured one.
const STAGE_REVEAL_MS = 1200;

/**
 * How many rows to show, in order, so output never appears above a stage still
 * waiting its turn. `paced` marks the rows that wait, read through a ref so a
 * fresh array each render does not restart the timer. `settled` shows a run
 * that was already over on mount all at once.
 */
// Empty, so every lookup is undefined and every row reveals with no delay.
export const NO_PACING: boolean[] = [];

/** Off in the playground: its output lives in sibling entries this hook cannot
 *  hold back, so pacing the stage rows only lets output overtake them. */
export const StagePacingContext = createContext(true);

/** The lesson workspace's console sits inside a canvas-muted card, so its surface
 *  matches that card. Playground's console is the whole right panel on canvas,
 *  with no wrapping card of its own, so it overrides this to canvas instead. */
export const ConsoleBackgroundContext = createContext(QVAC_EDITOR_BACKGROUND);

export function useRevealed(total: number, paced: boolean[], settled: boolean): number {
  const pacedRef = useRef(paced);
  pacedRef.current = paced;
  // Read once on mount and never again: a run that finishes mid-reveal keeps
  // revealing rather than dumping the rest at once.
  const [shown, setShown] = useState(() => (settled ? total : 0));
  useEffect(() => {
    if (shown >= total) return;
    const id = setTimeout(() => setShown((n) => n + 1), pacedRef.current[shown] ? STAGE_REVEAL_MS : 0);
    return () => clearTimeout(id);
  }, [shown, total]);
  return Math.min(shown, total);
}

// Gutter dot + connector rail. User bubbles skip this. Dot color: grey=in flight, green=ok, red=fail.
export type TimelineState = 'thinking' | 'success' | 'failure' | 'neutral';

// Grey while it is happening or when it is only output, green once it
// finished, red when it did not.
export const DOT_BUSY = 'bg-canvas-muted-foreground animate-pulse';

export const DOT_DONE = 'bg-primary';

const DOT_FAIL = 'bg-danger';

export const DOT_IDLE = 'bg-canvas-muted-foreground';

const TIMELINE_DOT: Record<TimelineState, string> = {
  thinking: DOT_BUSY,
  success: DOT_DONE,
  failure: DOT_FAIL,
  neutral: DOT_IDLE,
};

// One geometry for every row on the rail, so a chat reply, a host stage and a
// line of output all hang off one line at one size.
const RAIL_ROW = 'relative pl-[22px]';

const RAIL_LINE = 'absolute inset-y-0 left-[5px] w-px bg-canvas-border';

const RAIL_DOT = 'absolute left-[1px] size-[9px] rounded-full';

// Every row pads itself equally, so one offset serves all of them.
// Padding the children instead left the dot centred on some rows, adrift on others.
const ROW_PAD = 3;

// A boxed row starts its text one border and one padding lower, so the dot has
// to know which it is marking. Change one of these and the other has to follow.
const RAIL_CARD = 'max-w-full overflow-hidden rounded-lg border border-canvas-border px-2.5 py-1.5';

const CARD_INSET = 1 + 6;

// Centre of a 16px first line, less half the dot, plus a point and a half:
// a monospace glyph reads low in its line box because of the ascender space.
const DOT_OFFSET = 5;

export function RailRow({
  dot,
  card = false,
  children,
}: {
  dot: string;
  /** Wrap the content in a box. The row owns this so the dot can allow for it. */
  card?: boolean;
  children: React.ReactNode;
}) {
  const background = useContext(ConsoleBackgroundContext);
  return (
    <div className={RAIL_ROW} style={{ paddingTop: ROW_PAD, paddingBottom: ROW_PAD }}>
      {/* Padding, not margin: the line spans the full row, so spacing a row
          out does not leave a gap in the rail. */}
      <span className={RAIL_LINE} />
      {/* Ringed in the panel background so the line does not run through it. */}
      <span
        className={`${RAIL_DOT} ${dot}`}
        style={{
          top: ROW_PAD + (card ? CARD_INSET : 0) + DOT_OFFSET,
          boxShadow: `0 0 0 3px ${background}`,
        }}
      />
      <div className="min-w-0">{card ? <div className={RAIL_CARD}>{children}</div> : children}</div>
    </div>
  );
}

export function TimelineRow({
  state,
  card,
  children,
}: {
  state: TimelineState;
  card?: boolean;
  children: React.ReactNode;
}) {
  return (
    <RailRow dot={TIMELINE_DOT[state]} card={card}>
      {children}
    </RailRow>
  );
}
