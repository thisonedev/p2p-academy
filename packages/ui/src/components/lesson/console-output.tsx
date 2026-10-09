'use client';

import { useState, useEffect, useContext } from 'react';
import { parseProgress, type LessonProgress } from './progress.js';
import { splitStages, type StageSegment, formatSeconds, type RunSegment } from './stages.js';
import type { OutputLine } from './lesson-types.js';
import { ProgressBar } from '../ui/progress-bar.js';
import {
  DOT_BUSY,
  DOT_DONE,
  DOT_IDLE,
  NO_PACING,
  RailRow,
  StagePacingContext,
  useRevealed,
} from './console-rail.js';

// One per download tick, rendered as the progress bar instead of as output.
const DOWNLOAD_TICK_LINE = /^\s*▸\s*Downloading\s+\d+(?:\.\d+)?%/;

const STATUS_LINE = /^\s*▸|^\[[A-Za-z][\w.-]*\]/;

// --- Run output rendering ---

// Every write logs `[saved] <absolute path>`, which the footer makes clickable.
const SAVED_LINE = /^\[saved\]\s+(.+)$/;

function savedFilesFrom(lines: OutputLine[]): string[] {
  const out: string[] = [];
  for (const { line } of lines) {
    const m = line.match(SAVED_LINE);
    if (m?.[1] && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

function SavedFilesBar({ files }: { files: string[] }) {
  const home = files[0]?.match(/^(\/Users\/[^/]+|\/home\/[^/]+|[A-Z]:\\Users\\[^\\]+)/)?.[1];
  const pretty = (p: string) => (home && p.startsWith(home) ? `~${p.slice(home.length)}` : p);
  return (
    <div className="mt-3 space-y-2 border-t border-canvas-border pt-2 font-sans text-xs">
      {files.map((file) => (
        <SavedPreview key={`preview-${file}`} file={file} />
      ))}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs">
        <span className="text-canvas-muted-foreground">
          Saved {files.length === 1 ? 'file' : `${files.length} files`} to
        </span>
        {files.map((file) => (
          <button
            key={file}
            type="button"
            onClick={() => void window.academy?.reveal?.(file)}
            className="max-w-full truncate rounded border border-canvas-border px-2 py-0.5 text-canvas-foreground hover:bg-canvas-muted"
            title={`Show ${file} in your file manager`}
          >
            {pretty(file)}
          </button>
        ))}
      </div>
    </div>
  );
}

const PREVIEWABLE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'mov', 'avi', 'mp3', 'wav']);

function isPreviewable(file: string): boolean {
  const m = file.toLowerCase().match(/[^./]+\.([a-z0-9]+)$/);
  return !!m && PREVIEWABLE_EXTS.has(m[1]);
}

function SavedPreview({ file }: { file: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [kind, setKind] = useState<'image' | 'video' | 'audio' | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setSrc(null);
    setKind(null);
    if (!isPreviewable(file)) return () => {};
    if (typeof window === 'undefined' || !window.academy?.readSaved) return () => {};
    void window.academy
      .readSaved(file)
      .then((res) => {
        if (cancelled || !res) return;
        const lower = file.toLowerCase();
        if (
          lower.endsWith('.png') ||
          lower.endsWith('.jpg') ||
          lower.endsWith('.jpeg') ||
          lower.endsWith('.webp') ||
          lower.endsWith('.gif')
        ) {
          setKind('image');
        } else if (
          lower.endsWith('.mp4') ||
          lower.endsWith('.webm') ||
          lower.endsWith('.mov') ||
          lower.endsWith('.avi')
        ) {
          setKind('video');
        } else if (lower.endsWith('.mp3') || lower.endsWith('.wav')) {
          setKind('audio');
        }
        // Route audio/video through a blob URL so Chromium can stream-decode
        // it and fire loadedmetadata — the data: URL path sometimes leaves the
        // player stuck at 0:00 / 0:00. Images keep the data: URL; CSP forbids
        // blobs for them anyway.
        if (lower.endsWith('.wav') || lower.endsWith('.mp3') || lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.avi')) {
          const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: res.mime });
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        } else {
          setSrc(`data:${res.mime};base64,${res.base64}`);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!kind || !src) return null;
  if (kind === 'image') {
    return <img src={src} alt="Saved by this run" className="max-h-72 max-w-full rounded" />;
  }
  if (kind === 'video') {
    return <video src={src} controls preload="metadata" className="max-h-72 max-w-full rounded" />;
  }
  return <audio src={src} controls preload="metadata" className="w-full" />;
}

export function OutputView({
  lines: allLines,
  isAnimating,
  settledStage,
}: {
  lines: OutputLine[];
  isAnimating: boolean;
  settledStage?: string;
}) {
  const savedFiles = savedFilesFrom(allLines);
  const progress = parseProgress(allLines);
  // A run that has finished cannot still be inside a stage, so an opener left
  // hanging by a stop or a throw settles too.
  const segments = splitStages(allLines, !isAnimating || settledStage || false);
  const firstLines = segments.find((s) => s.kind === 'lines');
  // One rail row per segment: a stage as a labelled row, output as a card.
  const body: React.ReactNode[] = [];
  // Parallel to `body`: true where the row is a host stage, the only kind the
  // reveal below paces. Output is never held back.
  const paced: boolean[] = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.kind === 'stage') {
      body.push(<StageRow key={`stage-${i}`} stage={segment} />);
      // Only the host's own stages are paced. A call already appears at the
      // moment the lesson makes it.
      paced.push(!segment.call);
      continue;
    }
    // Blank lines between two stages would otherwise draw a rail dot with
    // nothing beside it. A progress bar counts as content, download ticks or not.
    const own = progress && progress.at >= segment.from && progress.at < segment.from + segment.count;
    const speaks = allLines
      .slice(segment.from, segment.from + segment.count)
      .some((l) => l.line.trim().length > 0);
    if (!speaks && !own) continue;
    // The bar gets a card of its own, between the output before and after it.
    if (own && progress) {
      const end = segment.from + segment.count;
      const parts = [
        { from: segment.from, count: progress.at + 1 - segment.from, bar: false },
        { from: progress.at, count: 0, bar: true },
        { from: progress.at + 1, count: end - progress.at - 1, bar: false },
      ];
      for (const part of parts) {
        if (part.bar) {
          body.push(
            <OutputRow key={`bar-${i}`}>
              <div className="my-1.5">
                <LessonProgressBar progress={progress} />
              </div>
            </OutputRow>,
          );
          paced.push(false);
          continue;
        }
        const shown = allLines
          .slice(part.from, part.from + part.count)
          .some((l) => l.line.trim().length > 0 && !DOWNLOAD_TICK_LINE.test(l.line));
        if (!shown) continue;
        body.push(
          <OutputRow key={`lines-${i}-${part.from}`}>
            <SegmentLines
              lines={allLines}
              segment={{ ...segment, from: part.from, count: part.count }}
              progress={null}
              dimPreamble={segment === firstLines && part.from === segment.from}
            />
          </OutputRow>,
        );
        paced.push(false);
      }
      continue;
    }
    const out = (
      <SegmentLines
        lines={allLines}
        segment={segment}
        progress={progress}
        // Only the run's opening output can be a preamble, so a later segment
        // does not dim its own first paragraph too.
        dimPreamble={segment === firstLines}
      />
    );
    body.push(<OutputRow key={`lines-${i}`}>{out}</OutputRow>);
    paced.push(false);
  }

  const pacing = useContext(StagePacingContext);
  const revealed = useRevealed(body.length, pacing ? paced : NO_PACING, !isAnimating || !pacing);
  const visible = body.slice(0, revealed);

  // The rail line is drawn once behind every row, so consecutive stages share
  // one continuous line instead of each stacking its own segment.
  return (
    <div className="text-canvas-foreground">
      {allLines.length === 0 && !isAnimating ? (
        <>
          <p className="text-primary">$ Run your code to see results</p>
          <p>
            <span className="text-primary">$</span>
            <span className="ml-1 inline-block h-3 w-2 animate-pulse bg-primary align-middle" />
          </p>
        </>
      ) : null}
      <div>{visible}</div>
      {savedFiles.length > 0 ? <SavedFilesBar files={savedFiles} /> : null}
    </div>
  );
}

// A stage still open pulses; one the host skipped is a passive row with no
// time of its own. The wording is the closer once there is one, since that
// carries the outcome the opener could only promise.
function StageRow({ stage }: { stage: StageSegment }) {
  const open = stage.state === 'open';
  const opener = stage.openLabel.replace(/\.{3}$/, '');
  // A lone ✓ (a stage whose opener sits above the output it produced, or one
  // the host skipped) still reports something finished, so it gets the same
  // treatment as every other completed row.
  const dot = open ? DOT_BUSY : DOT_DONE;
  // A closed phase keeps both wordings, which is why splitStages preserves
  // openLabel. The trailing percentage goes, or the kept line reads as frozen
  // mid-download.
  const opened = opener.replace(/\s\d{1,3}%$/, '');
  // The ✓ for this opener sits in a later entry, under the output that split
  // the pair, so the opener is settled rather than still running.
  if (stage.state === 'settled') {
    return (
      <RailRow dot={DOT_IDLE}>
        <span className="text-canvas-foreground">{opened}</span>
      </RailRow>
    );
  }
  const keepsOpener = stage.state === 'done' && !stage.call && stage.closeLabel !== opened;
  return (
    <>
      {keepsOpener ? (
        <RailRow dot={DOT_IDLE}>
          <span className="text-canvas-foreground">{opened}</span>
        </RailRow>
      ) : null}
      <RailRow dot={dot}>
        <div className="flex justify-between gap-3">
          <span className="text-canvas-foreground">{stage.call || open ? opener : stage.closeLabel}</span>
          {stage.seconds !== null ? (
            <span className="shrink-0 text-[11px] whitespace-nowrap text-canvas-muted-foreground">
              {formatSeconds(stage.seconds)}
            </span>
          ) : null}
        </div>
      </RailRow>
    </>
  );
}

// Program output, as its own row rather than loose text under the last stage.
// The dot stays neutral, since the lesson printed this and the host did not.
function OutputRow({ children }: { children: React.ReactNode }) {
  return (
    <RailRow dot={DOT_IDLE} card>
      {children}
    </RailRow>
  );
}

// A run longer than this is a wall of text in a panel a few hundred pixels
// tall, so the tail stays on screen and the rest folds behind one click.
const FOLD_AFTER = 200;

// Output printed while a stage was open, rendered under that stage's row. The
// progress bar renders inside the segment that produced it, so reading a run
// top to bottom does not mean scrolling back up for the bar.
function SegmentLines({
  lines,
  segment,
  progress,
  dimPreamble,
}: {
  lines: OutputLine[];
  segment: Extract<RunSegment, { kind: 'lines' }>;
  progress: LessonProgress | null;
  dimPreamble: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const end = segment.from + segment.count;

  // Download ticks render as the bar rather than as lines, so the fold counts
  // what is on screen instead of what the run printed.
  const shown: number[] = [];
  for (let i = segment.from; i < end; i++) {
    if (!DOWNLOAD_TICK_LINE.test(lines[i].line)) shown.push(i);
  }
  const foldable = Math.max(0, shown.length - FOLD_AFTER);
  const start = foldable === 0 || expanded ? segment.from : shown[foldable];

  const own = progress && progress.at >= segment.from && progress.at < end ? progress : null;
  // A bar whose ticks are folded away still belongs on screen, so it leads the
  // visible lines rather than disappearing with them.
  const barLeads = own !== null && own.at < start;
  return (
    <div className="my-1.5">
      {foldable > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="font-mono text-[11px] text-canvas-muted-foreground transition-colors hover:text-canvas-foreground"
        >
          {expanded ? `▴ Hide ${foldable} earlier lines` : `▾ ${foldable} earlier lines`}
        </button>
      ) : null}
      {barLeads && own ? <LessonProgressBar progress={own} /> : null}
      {own && !barLeads ? (
        <>
          <OutputLines lines={lines.slice(start, own.at + 1)} dimPreamble={dimPreamble} />
          <LessonProgressBar progress={own} />
          <OutputLines lines={lines.slice(own.at + 1, end)} dimPreamble={false} />
        </>
      ) : (
        <OutputLines lines={lines.slice(start, end)} dimPreamble={dimPreamble} />
      )}
    </div>
  );
}

function LessonProgressBar({ progress }: { progress: LessonProgress }) {
  return (
    <div className="my-2">
      <div className="mb-1 flex items-center justify-between font-mono text-xs">
        <span className="text-primary">
          {progress.completed ? `${progress.label} complete` : `${progress.label}: ${progress.detail}`}
        </span>
        <span className="text-canvas-muted-foreground">{progress.percent}%</span>
      </div>
      <ProgressBar
        percent={progress.percent}
        className="w-full bg-canvas-muted"
      />
    </div>
  );
}

function OutputLines({ lines: allLines, dimPreamble }: { lines: OutputLine[]; dimPreamble: boolean }) {
  return (
    <>
      {(() => {
        const lines = allLines.filter((e) => !DOWNLOAD_TICK_LINE.test(e.line));
        // Falls back to line-by-line when finetune progress lines are present.
        const hasFinetuneProgress = lines.some((e) => e.stream === 'stdout' && /^▸\s+epoch=/.test(e.line));

        if (hasFinetuneProgress) {
          const firstBlank = lines.findIndex((e) => e.stream === 'stdout' && e.line === '');
          const prefixEnd = firstBlank === -1 ? lines.length : firstBlank;
          return lines.map((entry, i) => {
            const isStderr = entry.stream === 'stderr';
            const isPrefix = !isStderr && i < prefixEnd;
            const className =
              isStderr || isPrefix
                ? 'wrap-anywhere whitespace-pre-wrap text-canvas-muted-foreground/60 italic'
                : 'wrap-anywhere whitespace-pre-wrap';
            return (
              <p key={i} className={className}>
                {entry.line}
              </p>
            );
          });
        }

        // Grouped by consecutive stream rather than stdout-then-stderr: the
        // host's stage lines are stderr, so splitting the two puts a result
        // above the steps that produced it.
        const groups: { stream: string; lines: string[] }[] = [];
        for (const entry of lines) {
          const last = groups[groups.length - 1];
          if (last && last.stream === entry.stream) last.lines.push(entry.line);
          else groups.push({ stream: entry.stream, lines: [entry.line] });
        }
        const dim = 'wrap-anywhere whitespace-pre-wrap text-canvas-muted-foreground/60 italic';

        let stdoutSeen = 0;
        return (
          <>
            {groups.flatMap((group, g) => {
              if (group.stream === 'stderr') {
                return group.lines.map((line, i) => (
                  <p key={`err-${g}-${i}`} className={dim}>
                    {line}
                  </p>
                ));
              }
              // Status lines (`▸ ...`) and SDK logs (download chatter) keep their
              // own line breaks and form their own block, so they don't run into
              // the answer text that follows them.
              const blocks: { lines: string[]; status: boolean }[] = [];
              for (const line of group.lines) {
                const status = STATUS_LINE.test(line);
                const last = blocks[blocks.length - 1];
                if (last && last.status === status) last.lines.push(line);
                else blocks.push({ lines: [line], status });
              }
              const paragraphs = blocks.flatMap((block) =>
                block.status
                  ? [block.lines.join('\n').trim()]
                  : block.lines
                      .join('\n')
                      .split(/\n{2,}/)
                      .map((p) => p.replace(/\n+/g, ' ').trim()),
              ).filter(Boolean);
              return paragraphs.map((para, i) => {
                // Lessons open with a preamble before their real output; it
                // stays dimmed, but only the very first one across the run.
                const isPrefix = dimPreamble && stdoutSeen++ === 0 && paragraphs.length + g > 1;
                return (
                  <p key={`out-${g}-${i}`} className={isPrefix ? dim : 'wrap-anywhere whitespace-pre-wrap'}>
                    {para}
                  </p>
                );
              });
            })}
          </>
        );
      })()}
    </>
  );
}
