'use client';

import { Loader2, Square, Play, Check, RotateCcw, Copy, X, Pencil } from 'lucide-react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRef, useState, type ReactNode, useEffect, useCallback } from 'react';
import { HelpPanel } from '../shell/help-panel.js';
import { MonacoLessonEditor } from './editor/monaco-lesson-editor.js';
import { LessonConsole } from './console.js';
import type { ConsoleEntry } from './console-types.js';
import { QVAC_EDITOR_BACKGROUND } from './editor/qvac-theme.js';
import { ThemedSelect } from '../ui/themed-select.js';
import { copyText } from '../../lib/clipboard.js';
import { IconButton } from '../ui/icon-button.js';
import { useFlash } from '../../hooks/use-flash.js';
import type { LessonArgvSlot, LessonData } from './lesson-types.js';
import {
  argInputPlaceholder,
  peerDisplayName,
  peerIsWindows,
  peerLabel,
  sourceFromArgvFrom,
  type RunMode,
} from './run-helpers.js';

// Anchored to the badge and rendered at the body root: the toolbar and the
// editor pane both clip, so a panel positioned inside either one gets cut off.
function HeavyRunBadge({ requirements }: { requirements: string[] }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);

  const show = () => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setAt({ top: box.bottom + 6, right: window.innerWidth - box.right });
    setOpen(true);
  };

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        className="shrink-0 cursor-help rounded border border-warning-strong/40 bg-warning-strong/10 px-1.5 py-0.5 text-micro font-medium uppercase tracking-wider text-warning transition-colors hover:bg-warning-strong/20"
      >
        heavy run
      </span>
      {open && at
        ? createPortal(
            <div
              role="tooltip"
              style={{ top: at.top, right: at.right }}
              className="pointer-events-none fixed z-tooltip w-72 rounded-lg border border-canvas-border bg-canvas p-3 font-sans shadow-xl"
            >
              <div className="text-xs font-semibold text-canvas-foreground">
                This lesson needs a fast machine
              </div>
              <ul className="mt-2 space-y-1.5">
                {requirements.map((line) => (
                  <li key={line} className="flex gap-1.5 text-caption leading-relaxed text-canvas-muted-foreground">
                    <span className="text-warning">&bull;</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function Runner({
  userCode,
  setUserCode,
  platform,
  setPlatform,
  runMode,
  setRunMode,
  isDesktop = false,
  entries,
  onStopCheck,
  isAnimating,
  onRun,
  onStop,
  stopRequested = false,
  onCheck,
  checkDisabled,
  onReset,
  platforms,
  pairedMode = true,
  requirements,
  readOnly = false,
  hints,
  answer,
  argv,
  argvOverrides,
  argvCaptured,
  onArgvOverrideValue,
  onArgvOverrideStart,
  onArgvOverrideClear,
  remotePeers,
  selectedPeerId,
  setSelectedPeerId,
  selfPairCount,
  localIsOnlyHost,
  lastRemoteRun,
  clearLastRemoteRun,
  footer,
}: {
  userCode: string;
  setUserCode: (s: string) => void;
  platform: LessonData['platforms'][number];
  setPlatform: (p: LessonData['platforms'][number]) => void;
  runMode: RunMode;
  setRunMode: (m: RunMode) => void;
  isDesktop?: boolean;
  entries: ConsoleEntry[];
  onStopCheck: (entryId: string) => void;
  isAnimating: boolean;
  onRun: () => void;
  onStop?: () => void;
  stopRequested?: boolean;
  onCheck: () => void;
  checkDisabled: boolean;
  onReset: () => void;
  platforms: LessonData['platforms'];
  pairedMode?: boolean;
  requirements?: string[];
  readOnly?: boolean;
  hints: string[];
  answer: string;
  argv?: LessonArgvSlot[];
  argvOverrides: Record<string, string>;
  argvCaptured: Record<string, string>;
  onArgvOverrideValue: (name: string, value: string) => void;
  onArgvOverrideStart: (name: string) => void;
  onArgvOverrideClear: (name: string) => void;
  remotePeers: Array<{ discoveryKey: string; userData: unknown; role: string; pairedAt: number }>;
  selectedPeerId: string;
  setSelectedPeerId: (id: string) => void;
  selfPairCount: number;
  localIsOnlyHost: boolean;
  lastRemoteRun:
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
      }
    | null;
  clearLastRemoteRun: () => void;
  /** Docked under the console, so the column reads code, output, input. */
  footer?: ReactNode;
}) {
  const [copied, flashCopied] = useFlash<true>();
  const [capturedCopiedKey, flashCapturedCopied] = useFlash<string>();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!lastRemoteRun) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [lastRemoteRun]);
  // Reference `tick` so lint sees it being read; the interval is the effect.
  void tick;

  const selectedPeer = remotePeers.find((p) => p.discoveryKey === selectedPeerId) ?? null;
  const peerName = selectedPeer
    ? peerLabel(selectedPeer)
    : selectedPeerId
      ? selectedPeerId.slice(0, 12)
      : 'paired device';
  const handleCopy = useCallback(async () => {
    try {
      await copyText(userCode);
      flashCopied(true);
    } catch {
    }
  }, [userCode]);

  const handleCopyCaptured = useCallback(async (slotName: string, value: string) => {
    try {
      await copyText(value);
      flashCapturedCopied(slotName);
    } catch {
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-canvas-border bg-canvas-muted">
      <div className="flex items-center justify-between gap-2 border-b border-canvas-border bg-canvas px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span
            className={`size-2 shrink-0 rounded-full ${
              readOnly ? 'bg-canvas-muted-foreground/60' : 'bg-primary'
            }`}
          />
          <span className="truncate font-mono text-canvas-foreground">
            {readOnly ? 'overview' : 'index.ts'}
          </span>
          {readOnly ? (
            <span className="rounded bg-canvas-muted px-1.5 py-0.5 text-micro font-medium uppercase tracking-wider text-canvas-muted-foreground">
              read-only
            </span>
          ) : null}
          {requirements && requirements.length > 0 ? (
            <HeavyRunBadge requirements={requirements} />
          ) : null}
        </div>
        <div className="flex min-w-0 items-center gap-1 text-canvas-muted-foreground sm:gap-2">
          <button
            type="button"
            onClick={isAnimating ? onStop : onRun}
            disabled={readOnly || (isAnimating ? stopRequested || !onStop : false)}
            className={
              isAnimating
                ? stopRequested
                  ? 'inline-flex shrink-0 items-center gap-1.5 rounded-md bg-canvas-muted px-2.5 py-1 text-xs font-semibold text-canvas-muted-foreground disabled:cursor-not-allowed disabled:opacity-60'
                  : 'inline-flex shrink-0 items-center justify-center rounded p-1.5 text-danger transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40'
                : 'inline-flex shrink-0 items-center justify-center rounded p-1.5 text-canvas-muted-foreground transition-colors hover:bg-canvas-muted hover:text-canvas-foreground disabled:cursor-not-allowed disabled:opacity-40'
            }
            title={stopRequested ? 'Stopping…' : isAnimating ? 'Stop run' : 'Run code (R)'}
            aria-label={stopRequested ? 'Stopping' : isAnimating ? 'Stop run' : 'Run code'}
          >
            {isAnimating ? (
              stopRequested ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Stopping…</span>
                </>
              ) : (
                <Square className="size-4 fill-current" />
              )
            ) : (
              <Play className="size-4 fill-current" />
            )}
          </button>
          <IconButton
            look="toolbar"
            onClick={onCheck}
            disabled={readOnly || checkDisabled}
            title="Check answer"
            aria-label="Check answer"
          >
            <Check className="size-4" />
          </IconButton>
          <ThemedSelect
            id="run-mode-select-desktop"
            value={runMode}
            onChange={(v) => setRunMode(v as RunMode)}
            disabled={readOnly}
            title="Run mode"
            ariaLabel="Run mode"
            className="run-mode-select-desktop ml-1 flex min-w-0 max-w-[6.5rem] shrink items-center justify-between gap-1 rounded border border-canvas-border bg-canvas px-1.5 py-1 text-micro font-medium uppercase tracking-wider text-canvas-muted-foreground sm:max-w-none transition-colors hover:text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
            options={[
              { value: 'this-device', label: 'This device' },
              { value: 'simulated', label: 'Simulated' },
              {
                value: 'remote',
                label: 'Paired device',
                disabled: pairedMode === false || remotePeers.length === 0,
                title:
                  pairedMode === false
                    ? 'This lesson serves a port on the machine it runs on, which a paired device cannot reach. Run it here.'
                    : localIsOnlyHost
                      ? 'This device is the host in every pair. Hosts accept runs from guests, not the other way around.'
                      : selfPairCount > 0
                        ? 'Only paired device is this device. Launch an isolated host with `pnpm dev:host` to enable this mode.'
                        : 'No paired devices. Pair one in Settings > Devices.',
              },
            ]}
          />
          {runMode === 'remote' ? (
            <ThemedSelect
              ariaLabel="Pick a paired device"
              value={selectedPeerId}
              onChange={setSelectedPeerId}
              disabled={readOnly}
              title={
                remotePeers.length === 0
                  ? 'No paired devices. Pair one in Settings.'
                  : 'Pick a paired device. Windows devices are listed but disabled: they cannot execute a paired run yet.'
              }
              className="ml-1 flex min-w-0 max-w-[5.5rem] shrink items-center justify-between gap-1 rounded border border-canvas-border bg-canvas px-1.5 py-1 sm:max-w-[10rem] text-micro font-medium uppercase tracking-wider text-canvas-muted-foreground transition-colors hover:text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
              options={
                remotePeers.length === 0
                  ? [{ value: '', label: 'No paired devices' }]
                  : remotePeers.map((p) => ({
                      value: p.discoveryKey,
                      label: `${peerDisplayName(p)}${peerIsWindows(p.userData) ? ' (Windows, cannot execute)' : ''}`,
                      disabled: peerIsWindows(p.userData),
                      title: peerIsWindows(p.userData) ? 'Windows cannot execute a paired run yet' : undefined,
                    }))
              }
            />
          ) : null}
          <select
            aria-hidden={isDesktop}
            tabIndex={isDesktop ? -1 : undefined}
            disabled={isDesktop || readOnly}
            suppressHydrationWarning
            className="run-mode-select-web ml-1 shrink-0 rounded border border-canvas-border bg-canvas px-1.5 py-1 text-micro font-medium uppercase tracking-wider text-canvas-muted-foreground"
            title={isDesktop ? undefined : 'Run mode'}
            aria-label={isDesktop ? undefined : 'Run mode'}
          >
            <option value="simulated">Simulated</option>
          </select>
          <HelpPanel
            hints={hints}
            answer={answer}
            onReveal={() => setUserCode(answer)}
            disabled={readOnly || !answer}
          />
          <button
            type="button"
            aria-label="Reset code"
            onClick={onReset}
            disabled={readOnly}
            className="shrink-0 rounded p-1.5 transition-colors hover:bg-canvas-muted hover:text-canvas-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Reset to starting code"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            aria-label={copied ? 'Copied' : 'Copy code'}
            onClick={handleCopy}
            className={`relative rounded p-1.5 transition-colors ${
              copied ? 'text-primary' : 'hover:bg-canvas-muted hover:text-canvas-foreground'
            }`}
            title={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </div>
      </div>

      {argv && argv.length > 0 && isDesktop && runMode === 'this-device' && !readOnly ? (
        <div className="flex flex-col gap-1.5 border-b border-canvas-border bg-canvas/60 px-3 py-2 sm:px-4">
          {argv.map((slot) => {
            const source = sourceFromArgvFrom(slot.from);
            const capturedValue = source ? (argvCaptured[source] ?? '') : '';
            const isOverriding = slot.name in argvOverrides;
            const displayValue = isOverriding ? argvOverrides[slot.name] : capturedValue;
            const wasJustCopied = capturedCopiedKey === slot.name;
            return (
              <div key={slot.name} className="flex items-center gap-2 text-xs">
                <label
                  htmlFor={`argv-${slot.name}`}
                  className="shrink-0 font-medium text-canvas-muted-foreground"
                >
                  {slot.label ?? slot.name}
                </label>
                <input
                  id={`argv-${slot.name}`}
                  type="text"
                  value={displayValue}
                  readOnly={!isOverriding}
                  spellCheck={false}
                  autoComplete="off"
                  onFocus={(e) => {
                    if (!isOverriding) e.currentTarget.select();
                  }}
                  onChange={(e) => onArgvOverrideValue(slot.name, e.target.value)}
                  placeholder={isOverriding ? '' : argInputPlaceholder(slot, argvCaptured)}
                  className={
                    isOverriding
                      ? 'min-w-0 flex-1 rounded border border-canvas-border bg-canvas px-2 py-1 font-mono text-xs text-canvas-foreground placeholder:text-canvas-muted-foreground/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30'
                      : 'min-w-0 flex-1 cursor-default select-all rounded border border-canvas-border bg-canvas-muted/50 px-2 py-1 font-mono text-xs text-canvas-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20'
                  }
                />
                {isOverriding ? (
                  <button
                    type="button"
                    onClick={() => onArgvOverrideClear(slot.name)}
                    className="shrink-0 rounded p-1 text-canvas-muted-foreground transition-colors hover:bg-canvas-muted hover:text-canvas-foreground"
                    title="Clear override (use captured value)"
                  >
                    <X className="size-3" />
                  </button>
                ) : (
                  <>
                    {capturedValue ? (
                      <button
                        type="button"
                        onClick={() => handleCopyCaptured(slot.name, capturedValue)}
                        className={`shrink-0 rounded p-1 transition-colors hover:bg-canvas-muted ${
                          wasJustCopied
                            ? 'text-primary'
                            : 'text-canvas-muted-foreground hover:text-canvas-foreground'
                        }`}
                        title="Copy captured key"
                      >
                        {wasJustCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onArgvOverrideStart(slot.name)}
                      className="shrink-0 rounded p-1 text-canvas-muted-foreground transition-colors hover:bg-canvas-muted hover:text-canvas-foreground"
                      title="Use a different key"
                    >
                      <Pencil className="size-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* One platform is not a choice, and the row costs as much height as six
          lines of code. Only lessons that actually offer an alternative get it. */}
      {platforms.length > 1 ? (
      <div className="flex flex-wrap items-center gap-1 border-b border-canvas-border bg-canvas px-3 py-2 sm:px-4">
        {platforms.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatform(p)}
            disabled={readOnly}
            className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors disabled:cursor-not-allowed ${
              platform === p
                ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
                : 'text-canvas-muted-foreground hover:bg-canvas-muted hover:text-canvas-foreground'
            }`}
          >
            {p}
          </button>
        ))}
        {platform !== 'node' ? (
          <span className="ml-2 text-xs text-canvas-muted-foreground">
            ({platform} version isn't supported yet)
          </span>
        ) : null}
      </div>
      ) : null}

      {/* lg split: code 70% / output 30% of the runner card's height. */}
      {/* Monaco sits out of flow so its height comes from this box; in the stacked layout
          its own height:100% wrapper would otherwise resolve to auto and collapse. */}
      <div
        className="relative min-h-[420px] flex-1 overflow-hidden lg:min-h-0 lg:flex lg:basis-[70%]"
        style={{ backgroundColor: QVAC_EDITOR_BACKGROUND }}
      >
        <div className="absolute inset-0">
          <MonacoLessonEditor
            value={userCode}
            readOnly={readOnly}
            onChange={(value) => setUserCode(value)}
          />
        </div>
      </div>

      {runMode === 'remote' && remotePeers.length === 0 ? (
        <div className="flex h-[280px] shrink-0 items-center justify-center border-t border-canvas-border bg-canvas-muted font-sans text-sm text-canvas-muted-foreground lg:h-auto lg:min-h-0 lg:flex lg:basis-[30%]">
          <div className="flex max-w-sm flex-col items-center gap-2 text-center">
            {localIsOnlyHost ? (
              <>
                <div className="text-canvas-foreground">
                  This device is the host in every pair.
                </div>
                <div>
                  Hosts accept runs from guests; they don&apos;t forward them. Pair a second
                  device (or run{' '}
                  <code className="rounded bg-canvas-muted px-1.5 py-0.5 text-caption">
                    pnpm dev:host
                  </code>{' '}
                  in another terminal) and have it accept the invite, then come back.
                </div>
              </>
            ) : selfPairCount > 0 ? (
              <>
                <div className="text-canvas-foreground">
                  The only paired device is this device.
                </div>
                <div>
                  Two app instances sharing a userData directory pair as the same identity, but
                  the exec channel can&apos;t route between matching keys. Run{' '}
                  <code className="rounded bg-canvas-muted px-1.5 py-0.5 text-caption">
                    pnpm dev:host
                  </code>{' '}
                  in a second terminal to launch an isolated host, then pair it from{' '}
                  <Link
                    href="/settings"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Settings
                  </Link>
                  .
                </div>
              </>
            ) : (
              <>
                <div className="text-canvas-foreground">No paired devices yet.</div>
                <div>
                  Pair another device in{' '}
                  <Link
                    href="/settings"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Settings
                  </Link>{' '}
                  to run this lesson there.
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 lg:flex lg:basis-[30%]">
          <LessonConsole entries={entries} onStopCheck={onStopCheck} />
        </div>
      )}
      {/* No padding and no border of its own: the inset was the panel's own
          fill showing through around the chat bar, and the bar draws the only
          two rules this needs. */}
      {footer ? (
        <div className="shrink-0" style={{ backgroundColor: QVAC_EDITOR_BACKGROUND }}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
