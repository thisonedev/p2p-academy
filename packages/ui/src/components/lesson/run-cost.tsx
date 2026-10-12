'use client';

import type { AcademyModelDownloadQueueState } from '@academy/validation';
import { formatBytes } from '@academy/constants';
import { Gauge, Square } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { percentOf } from '../ui/progress-bar.js';
import { ProgressRing } from '../ui/progress-ring.js';
import type { LessonData, LessonRequirement } from './lesson-types.js';
import { setVisibleLessonDownloadScope } from '../../lib/lesson-download-scope.js';
import '../../lib/academy.js';

interface MissingModel {
  name: string;
  sizeBytes: number;
}

export interface LessonModelDownload {
  /** Null on the web build, which has no model cache to ask. */
  missing: MissingModel[] | null;
  /** False for a lesson whose code names no model. */
  usesModels: boolean;
  /** True while this lesson's own download is in the queue. */
  downloading: boolean;
  /** True while the queue is busy with some other download. */
  busyElsewhere: boolean;
  name: string | null;
  progress: { loaded: number; total: number } | null;
  start: () => void;
  stop: () => void;
}

/**
 * The models a lesson's code names that are not on disk yet, and a way to fetch them through the
 * queue Settings uses, so the download outlives this page and shows in the header.
 */
export function useLessonModelDownload(source: string, scope: string, running: boolean): LessonModelDownload {
  const [missing, setMissing] = useState<MissingModel[] | null>(null);
  const [usesModels, setUsesModels] = useState(false);
  const [queue, setQueue] = useState<AcademyModelDownloadQueueState | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const refresh = useCallback(() => {
    const api = window.academy?.models;
    if (!api?.missingForSource) return;
    void api
      .missingForSource(sourceRef.current)
      .then((result) => {
        setMissing(result.missing);
        setUsesModels(result.named > 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setVisibleLessonDownloadScope(scope);
    return () => setVisibleLessonDownloadScope(null);
  }, [scope]);

  // Asked again when a run ends, since Run downloads the lesson's models itself.
  useEffect(() => {
    if (!running) refresh();
  }, [running, refresh]);

  useEffect(() => {
    const api = window.academy?.models;
    if (!api) return;
    let cancelled = false;
    let lastName: string | null = null;
    api
      .downloadQueueState()
      .then((state) => {
        if (cancelled || !state?.active) return;
        lastName = state.name;
        setQueue(state);
        setProgress(state.progress);
      })
      .catch(() => {});
    const offQueue = api.onDownloadQueueProgress((snapshot) => {
      if (!snapshot?.active) {
        lastName = null;
        setQueue(null);
        setProgress(null);
        refresh();
        return;
      }
      if (snapshot.name !== lastName) setProgress(snapshot.progress);
      lastName = snapshot.name;
      setQueue(snapshot);
    });
    const offProgress = api.onDownloadProgress((event) => {
      if (event?.name) setProgress({ loaded: event.loaded, total: event.total });
    });
    return () => {
      cancelled = true;
      offQueue();
      offProgress();
    };
  }, [refresh]);

  const active = queue?.active === true;
  const downloading = active && queue.scope === scope;
  const start = useCallback(() => {
    if (!missing || missing.length === 0) return;
    void window.academy?.models
      ?.downloadQueue(
        scope,
        missing.map((model) => model.name),
      )
      .catch(() => {});
  }, [missing, scope]);

  const stop = useCallback(() => {
    void window.academy?.models?.cancelDownloadQueue?.().catch(() => {});
  }, []);

  return {
    missing,
    usesModels,
    downloading,
    busyElsewhere: active && !downloading,
    name: downloading ? queue.name : null,
    progress: downloading ? progress : null,
    start,
    stop,
  };
}

// Rendered at the body root: the toolbar and the editor pane both clip, so a panel
// positioned inside either one gets cut off.
function WithPanel({
  title,
  rows,
  footer,
  children,
}: {
  title: string;
  rows: LessonRequirement[];
  footer?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setAt({ top: box.bottom + 6, left: box.left });
  };
  const hide = () => setAt(null);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the wrapper only opens a hover panel, the control inside keeps its own role
    <span ref={ref} className="inline-flex shrink-0" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {at
        ? createPortal(
            <div
              role="tooltip"
              style={{ top: at.top, left: at.left }}
              className="pointer-events-none fixed z-tooltip w-max min-w-56 max-w-xs overflow-hidden rounded-lg border border-canvas-border bg-canvas font-sans shadow-xl"
            >
              <div className="px-3 pt-2.5 text-xs font-semibold text-canvas-foreground">{title}</div>
              <dl className="px-3 pb-2.5 pt-1.5">
                {rows.map((row) => (
                  // The value never wraps; a long label does, so the two columns stay aligned.
                  <div key={row.label} className="flex items-baseline justify-between gap-6 py-0.5 text-caption leading-relaxed">
                    <dt className="text-canvas-muted-foreground">{row.label}</dt>
                    <dd className="shrink-0 whitespace-nowrap text-right text-canvas-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>
              {footer ? (
                <div className="border-t border-canvas-border px-3 py-2 text-caption text-canvas-muted-foreground">{footer}</div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

// The same arrow as the download buttons in Settings > Models.
function DownloadGlyph() {
  return (
    <svg className="size-[13px]" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v13m0 0l-4.5-4.5M12 16l4.5-4.5" />
      <path d="M5 20h14" />
    </svg>
  );
}

const AMBER = 'flex size-7 cursor-help items-center justify-center rounded-md bg-warning-strong/10 text-warning/80';

function DownloadControl({
  title,
  rows,
  download,
  running,
  webIcon,
}: {
  title: string;
  rows: LessonRequirement[];
  download: LessonModelDownload;
  running: boolean;
  /** Shows a plain icon on the web build, where nothing can be downloaded. */
  webIcon: boolean;
}) {
  const { missing, usesModels, downloading, busyElsewhere, progress, name, start, stop } = download;

  if (downloading) {
    const percent = percentOf(progress);
    const state = [
      { label: 'Downloading', value: name ?? 'Preparing…' },
      ...(progress && progress.total > 0
        ? [{ label: 'Progress', value: `${formatBytes(progress.loaded)} / ${formatBytes(progress.total)}` }]
        : []),
    ];
    return (
      <WithPanel title={title} rows={[...state, ...rows]} footer="Click to stop the download.">
        {/* The header hides its own ring on this page, so this one also carries the stop control. */}
        <button
          type="button"
          onClick={stop}
          aria-label="Stop the download"
          className="group relative flex size-7 items-center justify-center rounded-full bg-canvas-muted text-primary"
        >
          {percent === null ? (
            <span className="pointer-events-none absolute inset-[-1px] animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          ) : (
            <span className="contents group-hover:hidden group-focus-visible:hidden">
              <ProgressRing percent={percent} />
            </span>
          )}
          <Square className="hidden size-2.5 fill-current group-hover:block group-focus-visible:block" />
        </button>
      </WithPanel>
    );
  }

  if (missing === null) {
    if (!webIcon) return null;
    return (
      <WithPanel title={title} rows={rows}>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: focus opens the panel for keyboard users */}
        <span tabIndex={0} className={AMBER}>
          <DownloadGlyph />
        </span>
      </WithPanel>
    );
  }

  if (missing.length === 0) {
    if (!usesModels) return null;
    return (
      <WithPanel title="Model downloaded" rows={rows}>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: focus opens the panel for keyboard users */}
        <span tabIndex={0} className="flex size-7 cursor-help items-center justify-center text-primary">
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12l3 3 5-6" />
          </svg>
        </span>
      </WithPanel>
    );
  }

  const bytes = missing.reduce((sum, model) => sum + model.sizeBytes, 0);
  const footer = busyElsewhere
    ? 'Another download is running. Start this one when it finishes.'
    : running
      ? 'This run is downloading the model.'
      : 'Click to download.';
  return (
    <WithPanel title={title} rows={[{ label: 'Download', value: formatBytes(bytes) }, ...rows]} footer={footer}>
      <button
        type="button"
        onClick={start}
        disabled={busyElsewhere || running}
        aria-label="Download model"
        className="flex size-7 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
      >
        <DownloadGlyph />
      </button>
    </WithPanel>
  );
}

/** Toolbar icons for what a lesson costs to run, and for fetching its models ahead of a run.
 *  The words are in the panel each one opens. */
export function RunCost({
  requirements,
  kind,
  download,
  running,
}: {
  requirements: LessonRequirement[];
  kind: NonNullable<LessonData['requirementsKind']>;
  download: LessonModelDownload;
  running: boolean;
}) {
  const kinds = Array.isArray(kind) ? kind : [kind];
  const heavy = requirements.length > 0 && kinds.includes('heavy-run');
  const large = kinds.includes('large-download');
  // A heavy lesson's rows sit behind the gauge; otherwise they belong to the download icon.
  return (
    <>
      {heavy ? (
        <WithPanel title="Heavy run" rows={requirements}>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: focus opens the panel for keyboard users */}
          <span tabIndex={0} className={AMBER}>
            <Gauge className="size-3.5" />
          </span>
        </WithPanel>
      ) : null}
      <DownloadControl
        title={large ? 'Large model' : 'Model download'}
        rows={heavy ? [] : requirements}
        download={download}
        running={running}
        webIcon={large && !heavy}
      />
    </>
  );
}
