'use client';

import type { MatchStatus } from '@academy/validation';
import { Check, X, Loader2, Download, FileArchive, FileText } from 'lucide-react';
import { saveMediaFile } from '../playground/flow/workflow.js';
import type { ConsoleEntry } from './console-types.js';
import type { TimelineState } from './console-rail.js';
import { OutputView } from './console-output.js';

function EntryCard({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-full overflow-hidden">
      <div className="flex items-center gap-1.5 pb-1 text-micro font-semibold uppercase leading-4 tracking-wider text-canvas-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

export function UserBubble({ content }: { content: string }) {
  return (
    <div className="my-3 max-w-full overflow-hidden rounded-md bg-chat-user px-3 py-2">
      <p className="wrap-anywhere whitespace-pre-wrap font-mono text-xs text-canvas-foreground">{content}</p>
    </div>
  );
}

// Label shown for each whole-submission verdict. 'match' is set client-side
// (no AI call); the rest come from the AI's own reply.
const VERDICT_WORD: Record<MatchStatus, string> = {
  match: 'Matches',
  complete: 'Complete',
  'different-but-valid': 'Valid',
  unfinished: 'Unfinished',
  wrong: 'Not there yet',
};

// Bare period for anything the AI grades; a fixed filler phrase would
// drown out the AI's own one-sentence reason, which carries the real detail.
const VERDICT_REST: Record<MatchStatus, string> = {
  match: ' the reference solution.',
  complete: '.',
  'different-but-valid': '.',
  unfinished: '.',
  wrong: '.',
};

const PASSING_VERDICTS = new Set<MatchStatus>(['match', 'complete', 'different-but-valid']);

// A failing structural check or AI verdict fails the entry; missing AI review only passes if every structural check did.
export function checkState(entry: Extract<ConsoleEntry, { kind: 'check' }>): TimelineState {
  if (entry.ai === 'loading') return 'thinking';
  const structuralPassed = entry.structural.every((r) => r.passed);
  if (entry.ai === 'error') return 'failure';
  if (entry.ai === 'done') {
    const verdictPassed = entry.aiVerdict ? PASSING_VERDICTS.has(entry.aiVerdict) : false;
    return structuralPassed && verdictPassed ? 'success' : 'failure';
  }
  return structuralPassed ? 'success' : 'failure';
}

export function CheckCard({
  entry,
  onStop,
}: {
  entry: Extract<ConsoleEntry, { kind: 'check' }>;
  onStop: () => void;
}) {
  const verdictPassed = entry.aiVerdict ? PASSING_VERDICTS.has(entry.aiVerdict) : false;
  return (
    <EntryCard label="check">
      <div className="font-mono text-xs">
      <ul className="space-y-1.5">
        {entry.structural.map((r) => (
          <li key={r.id} className="flex items-start gap-2">
            <span
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border ${
                r.passed
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-canvas-border text-canvas-muted-foreground'
              }`}
            >
              {r.passed ? <Check className="size-3" /> : <X className="size-3" />}
            </span>
            <span className={r.passed ? 'text-canvas-foreground' : 'text-canvas-muted-foreground'}>
              {r.description}
            </span>
          </li>
        ))}
        {entry.ai === 'done' && entry.aiVerdict ? (
          <li className="flex items-start gap-2">
            <span
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border ${
                verdictPassed
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-canvas-border text-canvas-muted-foreground'
              }`}
            >
              {verdictPassed ? <Check className="size-3" /> : <X className="size-3" />}
            </span>
            <span className={verdictPassed ? 'text-canvas-foreground' : 'text-canvas-muted-foreground'}>
              <span className="font-semibold">AI reviewer:</span> {VERDICT_WORD[entry.aiVerdict]}
              {VERDICT_REST[entry.aiVerdict]}
              {entry.aiReason ? ` ${entry.aiReason}` : ''}
            </span>
          </li>
        ) : null}
      </ul>
      {entry.ai === 'loading' ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-canvas-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          <span>Reviewing your code…</span>
          <button
            type="button"
            onClick={onStop}
            className="ml-1 rounded px-1.5 py-0.5 font-semibold text-canvas-muted-foreground transition-colors hover:bg-canvas-muted hover:text-canvas-foreground"
          >
            Stop
          </button>
        </div>
      ) : null}
      {entry.ai === 'unavailable' ? (
        <p className="mt-2 text-xs text-canvas-muted-foreground">
          AI review unavailable. Showing structural checks only.
        </p>
      ) : null}
      {entry.ai === 'error' ? (
        <p className="mt-2 text-xs text-warning">{entry.aiError ?? 'AI review failed. Try Check Answer again.'}</p>
      ) : null}
      </div>
    </EntryCard>
  );
}

export function ConfirmCard({
  entry,
  onAnswer,
}: {
  entry: Extract<ConsoleEntry, { kind: 'confirm' }>;
  onAnswer: (answer: 'yes' | 'no') => void;
}) {
  return (
    <EntryCard label="confirm">
      <div className="font-mono text-xs">
        <p className="text-canvas-foreground">{entry.message}</p>
        {entry.answer === null ? (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAnswer('yes')}
              className="rounded border border-primary/40 bg-primary/15 px-2.5 py-1 font-semibold text-primary transition-colors hover:bg-primary/25"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => onAnswer('no')}
              className="rounded border border-decline/40 bg-decline/15 px-2.5 py-1 font-semibold text-decline transition-colors hover:bg-decline/25"
            >
              No
            </button>
          </div>
        ) : (
          <p className="mt-1.5 text-canvas-muted-foreground">Answered: {entry.answer === 'yes' ? 'Yes' : 'No'}</p>
        )}
      </div>
    </EntryCard>
  );
}

export function MediaCard({ entry }: { entry: Extract<ConsoleEntry, { kind: 'media' }> }) {
  return (
    <EntryCard label={entry.mediaType}>
      <div className="font-mono text-xs">
        <div className="group relative">
          <button
            type="button"
            onClick={() => void saveMediaFile(entry.dataUrl, entry.caption || `generated-${entry.mediaType}`)}
            className="absolute top-1.5 right-1.5 z-10 rounded border border-canvas-border bg-canvas-muted p-1 text-canvas-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
            title="Save this file"
            aria-label="Save this file"
          >
            <Download className="size-3" />
          </button>
          {entry.mediaType === 'image' && (
            // biome-ignore lint/performance/noImgElement: a data: URL from a local generation call, not a remote asset next/image would optimize
            <img src={entry.dataUrl} alt={entry.caption ?? 'Generated image'} className="max-w-full rounded-md" />
          )}
          {entry.mediaType === 'audio' && (
            // biome-ignore lint/a11y/useMediaCaption: synthesized/generated audio has no caption track to attach
            <audio controls src={entry.dataUrl} className="w-full" />
          )}
          {entry.mediaType === 'video' && (
            // biome-ignore lint/a11y/useMediaCaption: generated clip has no caption track to attach
            <video controls src={entry.dataUrl} className="max-w-full rounded-md" />
          )}
          {(entry.mediaType === 'pdf' || entry.mediaType === 'zip') && (
            <div className="flex items-center gap-2 rounded-md border border-canvas-border bg-canvas-muted px-2.5 py-2 pr-9">
              {entry.mediaType === 'zip' ? (
                <FileArchive className="size-4 shrink-0 text-primary" />
              ) : (
                <FileText className="size-4 shrink-0 text-canvas-muted-foreground" />
              )}
              <span className="truncate text-canvas-foreground">{entry.caption ?? 'Document.pdf'}</span>
            </div>
          )}
        </div>
        {entry.caption && entry.mediaType !== 'pdf' && entry.mediaType !== 'zip' && (
          <p className="mt-1.5 text-canvas-muted-foreground">{entry.caption}</p>
        )}
      </div>
    </EntryCard>
  );
}

// No "View code" here: the editor is right next to it. That's for the
// receiving device instead (notification-center.tsx, devices-panel.tsx).
// No spinner on the row: the pinned line below already owns the one spinner
// on screen, and a second for the same run reads as a second thing running.
export function RunCard({ entry }: { entry: Extract<ConsoleEntry, { kind: 'run' }> }) {
  return (
    <div className="font-mono text-xs">
      <OutputView
        lines={entry.lines}
        isAnimating={entry.status === 'running'}
        settledStage={entry.settledStage}
      />
    </div>
  );
}

export function EmptyState({ text }: { text?: string }) {
  return (
    <p className="px-1 py-1 font-mono text-xs text-canvas-foreground">
      {text ?? 'Run your code, check your answer, or ask a question. It all shows up here.'}
    </p>
  );
}
