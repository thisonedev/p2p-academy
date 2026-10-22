'use client';

import type {
  AcademyAPI,
  AcademyPeerAuditEntry,
  AcademyPeerDeviceRequest,
  AcademyPeerInfo,
  AcademyPeerPending,
} from '@academy/validation';
import { Check, CircleAlert, Loader2, Lock, ShieldAlert, ShieldCheck, Square, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pairUserDataLabel, shortHex } from '../settings/device-format.js';
import { CodePreview } from '../ui/code-preview.js';
import { IconButton } from '../ui/icon-button.js';
import { NoticeCard, NoticeChip, type NoticeTone } from '../ui/notice-card.js';
import '../../lib/academy.js';

/**
 * Everything arriving from another device, surfaced where the user already is.
 * Settings keeps the full lists; this is what should not wait to be found.
 *
 *   warning a decision is blocked on a human (device access, pairing)
 *   info, success, or danger: a run, colored by its status
 */
export function NotificationCenter() {
  const deviceRequests = useDeviceRequests();
  const pairRequests = usePairRequests();
  const runs = useRunNotices();
  // Outgoing runs render inside the lesson workspace's output panel instead.
  const topRuns = runs.items.filter((run) => run.direction === 'incoming');

  if (
    deviceRequests.items.length === 0 &&
    pairRequests.items.length === 0 &&
    topRuns.length === 0
  ) {
    return null;
  }

  return (
    <div className="sticky top-14 z-sticky flex flex-col">
      {deviceRequests.items.map((request) => (
        <DeviceConsentRow
          key={request.requestId}
          request={request}
          onAnswer={deviceRequests.answer}
        />
      ))}
      {pairRequests.items.map((request) => (
        <PairRequestRow
          key={request.requestId}
          request={request}
          busy={pairRequests.busy === request.requestId}
          onAnswer={pairRequests.answer}
        />
      ))}
      {topRuns.map((run) => (
        <RunRow key={run.id} run={run} onDismiss={runs.dismiss} />
      ))}
    </div>
  );
}

// --- device access -----------------------------------------------------------

function useDeviceRequests() {
  const [items, setItems] = useState<AcademyPeerDeviceRequest[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.academy?.peer) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const list = (await window.academy?.peer?.deviceRequests?.()) ?? [];
        if (!cancelled) setItems(list);
      } catch {
        // Keep request lookup failures silent; no prompt appears.
      }
    };
    refresh();
    const off = window.academy.peer.onEvent((msg) => {
      if (msg?.event?.startsWith('peer:exec:device-')) refresh();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const answer = useCallback(async (requestId: string, approved: boolean) => {
    setItems((prev) => prev.filter((r) => r.requestId !== requestId));
    try {
      await window.academy?.peer?.resolveDeviceRequest?.(requestId, approved);
    } catch {
      // the run's own timeout denies it if this never lands
    }
  }, []);

  return { items, answer };
}

/** "your microphone and the network", for the sentence and the button. */
function consentAsks(request: AcademyPeerDeviceRequest): string {
  const asks = request.devices.map((d) => `your ${d}`);
  if (request.network) asks.push('the network');
  if (asks.length < 2) return asks[0] ?? 'access';
  return `${asks.slice(0, -1).join(', ')} and ${asks[asks.length - 1]}`;
}

// Deny is the plain button; no answer times out as a denial on the host.
function DeviceConsentRow({
  request,
  onAnswer,
}: {
  request: AcademyPeerDeviceRequest;
  onAnswer: (requestId: string, approved: boolean) => void;
}) {
  const hasAccessAsk = request.devices.length > 0 || !!request.network;
  const asks = consentAsks(request);
  const what = request.label ? `"${request.label}"` : 'A run';
  return (
    <NoticeCard
      tone="warning"
      devices={[pairUserDataLabel(request), 'self']}
      link="waiting"
      title={
        hasAccessAsk ? (
          <>
            {what} wants to use {asks}
            {request.network ? (
              <span className="font-normal text-canvas-muted-foreground"> ({request.network})</span>
            ) : null}
          </>
        ) : (
          what
        )
      }
      chips={
        <>
          <NoticeChip>from {pairUserDataLabel(request)}</NoticeChip>
          {request.devices.map((d) => (
            <NoticeChip key={d} tone="warning">
              {capitalize(d)}
            </NoticeChip>
          ))}
          {request.network ? <NoticeChip tone="warning">Network</NoticeChip> : null}
        </>
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => onAnswer(request.requestId, false)}
            className="rounded-md px-3 py-1.5 text-canvas-muted-foreground transition-colors hover:bg-canvas-border hover:text-canvas-foreground"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={() => onAnswer(request.requestId, true)}
            className="rounded-md bg-primary px-3.5 py-1.5 font-semibold text-canvas transition-colors hover:bg-primary"
          >
            {hasAccessAsk ? `Allow ${asks}` : 'Allow'}
          </button>
        </>
      }
      footer={request.sourcePreview ? <CodePreview source={request.sourcePreview} /> : null}
    >
      {!hasAccessAsk && 'Waiting to run on this device. '}
      It stays blocked until you answer, and nothing is recorded or sent unless you allow it.
      {request.networkScope ? (
        <span className="mt-1 block text-canvas-foreground">
          This device&apos;s sandbox cannot hold a run to localhost, so allowing this gives it{' '}
          <span className="font-medium">{request.networkScope}</span> network access.
        </span>
      ) : null}
    </NoticeCard>
  );
}

// --- pairing -----------------------------------------------------------------

function usePairRequests() {
  const [items, setItems] = useState<AcademyPeerPending[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.academy?.peer) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const list = (await window.academy?.peer?.pending?.()) ?? [];
        if (!cancelled && Array.isArray(list)) setItems(list);
      } catch {
        // settings still lists them
      }
    };
    refresh();
    // Only the events that change the pending list; 'peer:audit' fires per audited action.
    const off = window.academy.peer.onEvent((msg) => {
      if (
        msg.event === 'peer:pending' ||
        msg.event === 'peer:paired' ||
        msg.event === 'peer:rejected' ||
        msg.event === 'peer:dropped' ||
        msg.event === 'peer:worker-restarted'
      ) {
        refresh();
      }
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const answer = useCallback(async (requestId: string, approved: boolean) => {
    if (!window.academy?.peer) return;
    setBusy(requestId);
    try {
      if (approved) await window.academy.peer.approve(requestId);
      else await window.academy.peer.reject(requestId);
      setItems((prev) => prev.filter((r) => r.requestId !== requestId));
    } catch {
      // the peer event stream corrects the list either way
    } finally {
      setBusy(null);
    }
  }, []);

  return { items, busy, answer };
}

/** Same rule as the settings list: approval stays disabled until the code the
 *  guest typed matches the one this device generated. */
function pairingCodeMatches(request: AcademyPeerPending): boolean {
  if (!request.enteredPairingCode) return false;
  return request.enteredPairingCode.toLowerCase() === request.expectedPairingCode.toLowerCase();
}

function PairRequestRow({
  request,
  busy,
  onAnswer,
}: {
  request: AcademyPeerPending;
  busy: boolean;
  onAnswer: (requestId: string, approved: boolean) => void;
}) {
  const matches = pairingCodeMatches(request);
  return (
    <NoticeCard
      tone="warning"
      devices={[pairUserDataLabel(request), 'self']}
      link="waiting"
      title={`${pairUserDataLabel(request)} wants to pair`}
      chips={
        <>
          <NoticeChip>
            <span className="font-mono" title={request.discoveryKey}>
              {shortHex(request.discoveryKey, 10, 6)}
            </span>
          </NoticeChip>
          <NoticeChip>
            <span className="font-mono">expected {request.expectedPairingCode}</span>
          </NoticeChip>
          <NoticeChip tone={matches ? 'success' : 'warning'}>
            {matches ? <ShieldCheck className="size-3" /> : <ShieldAlert className="size-3" />}
            <span className="font-mono">{request.enteredPairingCode ?? 'no code'}</span>
          </NoticeChip>
        </>
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => onAnswer(request.requestId, false)}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-canvas-muted-foreground transition-colors hover:bg-canvas-border hover:text-canvas-foreground disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => onAnswer(request.requestId, true)}
            disabled={busy || !matches}
            title={
              matches ? undefined : 'The code this device generated is not the one that was entered'
            }
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3.5 py-1.5 font-semibold text-canvas transition-colors hover:bg-primary disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : null}
            Approve
          </button>
        </>
      }
    >
      Once approved it can run code on this machine, confined by the OS. Only approve devices you trust.
    </NoticeCard>
  );
}

// --- runs --------------------------------------------------------------------

export type RunTone = 'running' | 'ok' | 'err';

export type RunNotice = {
  id: string;
  /** incoming: a peer is running code here. outgoing: our code is running there. */
  direction: 'incoming' | 'outgoing';
  discoveryKey: string;
  label: string | null;
  tone: RunTone;
  status: string;
  startedAt: number;
  endedAt: number | null;
  /** Set on the 'started' event; carried forward through later updates
   *  (finished/error events don't repeat it) so "View code" survives the run. */
  sourcePreview?: string;
  /** What the host decided for an incoming run, from the 'started' event; carried forward the same way. */
  facts?: { network: 'none' | 'localhost' | 'all'; devices: string[]; asked: boolean };
  /** This device's Stop ended it. */
  stoppedByHost?: boolean;
};

// Long enough to read after the run ends, short enough not to pile up.
const RUN_DISMISS_MS = 10_000;

function runIdFor(entry: AcademyPeerAuditEntry, direction: RunNotice['direction']): string {
  return `${direction}:${entry.discoveryKey ?? 'unknown'}`;
}

export function useRunNotices() {
  const [items, setItems] = useState<RunNotice[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const scheduleDismiss = useCallback(
    (id: string) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), RUN_DISMISS_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.academy?.peer) return;
    const pending = timers.current;
    let cancelled = false;

    const refreshNames = async () => {
      const peers = (await window.academy?.peer?.list().catch(() => [])) ?? [];
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const p of peers as AcademyPeerInfo[]) {
        if (p.discoveryKey) map[p.discoveryKey] = pairUserDataLabel(p);
      }
      setNames(map);
    };
    refreshNames();

    const off = window.academy.peer.onEvent((msg) => {
      if (msg.event === 'peer:paired' || msg.event === 'peer:dropped' || msg.event === 'peer:worker-restarted') refreshNames();
      if (msg.event !== 'peer:audit') return;
      const entry = msg.payload as AcademyPeerAuditEntry;
      const notice = noticeFor(entry);
      if (!notice) return;

      setItems((prev) => {
        const rest = prev.filter((r) => r.id !== notice.id);
        const previous = prev.find((r) => r.id === notice.id);
        return [
          ...rest,
          {
            ...notice,
            startedAt: previous?.startedAt ?? notice.startedAt,
            sourcePreview: notice.sourcePreview ?? previous?.sourcePreview,
            facts: notice.facts ?? previous?.facts,
          },
        ];
      });
      if (notice.endedAt != null) scheduleDismiss(notice.id);
    });

    return () => {
      cancelled = true;
      off();
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, [scheduleDismiss]);

  const named = items.map((run) => ({
    ...run,
    peerLabel: names[run.discoveryKey] ?? shortHex(run.discoveryKey, 6, 4),
  }));

  return { items: named, dismiss };
}

/** One audit entry to a notice, or null when the entry is not about a run. */
function noticeFor(entry: AcademyPeerAuditEntry): RunNotice | null {
  const base = {
    discoveryKey: entry.discoveryKey ?? 'unknown',
    label: entry.label ?? entry.fileName ?? null,
    startedAt: entry.timestamp,
    endedAt: null as number | null,
  };

  switch (entry.type) {
    case 'peer:exec:started':
      return {
        ...base,
        id: runIdFor(entry, 'incoming'),
        direction: 'incoming',
        tone: 'running',
        status: 'Running',
        sourcePreview: entry.sourcePreview,
        facts:
          entry.network != null && entry.asked != null
            ? { network: entry.network, devices: entry.devices ?? [], asked: entry.asked }
            : undefined,
      };
    case 'peer:exec:remote-started':
      return {
        ...base,
        id: runIdFor(entry, 'outgoing'),
        direction: 'outgoing',
        tone: 'running',
        status: 'Running',
      };
    case 'peer:exec:finished':
    case 'peer:exec:remote-finished': {
      const direction = entry.type === 'peer:exec:finished' ? 'incoming' : 'outgoing';
      const ok = entry.code === 0 && !entry.cancelled;
      const status = entry.cancelled
        ? 'Stopped'
        : ok
        ? 'Finished · exit 0'
        : entry.code != null
          ? `Failed · exit ${entry.code}`
          : entry.signal
            ? `Stopped · ${entry.signal}`
            : 'Finished';
      return {
        ...base,
        id: runIdFor(entry, direction),
        direction,
        tone: ok ? 'ok' : 'err',
        status,
        endedAt: entry.timestamp,
        stoppedByHost: entry.stoppedByHost === true,
      };
    }
    case 'peer:exec:error':
    case 'peer:exec:remote-error': {
      const direction = entry.type === 'peer:exec:error' ? 'incoming' : 'outgoing';
      return {
        ...base,
        id: runIdFor(entry, direction),
        direction,
        tone: 'err',
        status: entry.message ? `Failed · ${entry.message}` : 'Failed',
        endedAt: entry.timestamp,
      };
    }
    default:
      return null;
  }
}

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

/** Ticks only while something is running, so a settled stack does no work. */
function useElapsedTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

// The same three colours the activity list uses, so a run reads the same in both places.
const RUN_TONES: Record<RunTone, { notice: NoticeTone; text: string }> = {
  running: { notice: 'info', text: 'text-info' },
  ok: { notice: 'success', text: 'text-primary' },
  err: { notice: 'danger', text: 'text-danger' },
};

const NETWORK_CHIPS = {
  none: 'No network',
  localhost: 'Localhost only',
  all: 'Network',
} as const;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function runTitle(run: RunNotice & { peerLabel: string }): string {
  const peer = run.peerLabel;
  if (run.direction === 'outgoing') {
    if (run.stoppedByHost) return `${peer} stopped your run`;
    if (run.tone === 'running') return `Your code is running on ${peer}`;
    return run.tone === 'ok' ? `Your code finished on ${peer}` : `Your run on ${peer} failed`;
  }
  if (run.stoppedByHost) return `You stopped ${peer}'s run`;
  if (run.tone === 'running') return `${peer} is running code on this device`;
  return run.tone === 'ok' ? `${peer} finished running code on this device` : `${peer}'s run failed on this device`;
}

function RunFacts({ facts }: { facts: NonNullable<RunNotice['facts']> }) {
  return (
    <>
      <NoticeChip>
        <Lock className="size-3" />
        Sandboxed
      </NoticeChip>
      <NoticeChip tone={facts.network === 'none' ? 'neutral' : 'warning'}>{NETWORK_CHIPS[facts.network]}</NoticeChip>
      {facts.devices.map((d) => (
        <NoticeChip key={d} tone="warning">
          {capitalize(d)}
        </NoticeChip>
      ))}
      {facts.asked ? (
        <NoticeChip tone="success">Allowed by you</NoticeChip>
      ) : (
        <NoticeChip>Ran without asking</NoticeChip>
      )}
    </>
  );
}

/** The running spinner. With `onStop` it holds a stop square and turns red on hover, like the coding panel's Stop. */
function RunSpinner({ onStop, stopping }: { onStop?: () => void; stopping: boolean }) {
  const ring = (
    <span
      aria-hidden
      className="absolute inset-0.5 animate-spin rounded-full border-2 border-canvas-muted-foreground/25 border-t-canvas-muted-foreground transition-colors group-hover:border-t-danger"
    />
  );
  if (!onStop) {
    return (
      <span role="status" aria-label="Running" className="relative inline-grid size-6 place-items-center">
        {ring}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onStop}
      disabled={stopping}
      title={stopping ? 'Stopping…' : 'Stop run'}
      aria-label={stopping ? 'Stopping' : 'Stop run'}
      className="group relative inline-grid size-6 place-items-center rounded-full transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      {ring}
      {stopping ? null : (
        <span className="size-2 rounded-[1.5px] bg-canvas-muted-foreground transition-colors group-hover:bg-danger" />
      )}
    </button>
  );
}

export function RunRow({
  run,
  onDismiss,
}: {
  run: RunNotice & { peerLabel: string };
  onDismiss: (id: string) => void;
}) {
  const now = useElapsedTick(run.endedAt == null);
  const elapsed = formatElapsed((run.endedAt ?? now) - run.startedAt);
  const tone = RUN_TONES[run.tone];
  const [stopping, setStopping] = useState(false);
  const running = run.tone === 'running';
  const canStop = running && run.direction === 'incoming';

  const stop = async () => {
    setStopping(true);
    try {
      await window.academy?.peer?.stopHostedRun(run.discoveryKey);
    } catch {
      setStopping(false);
    }
  };

  return (
    <NoticeCard
      tone={tone.notice}
      devices={run.direction === 'incoming' ? [run.peerLabel, 'self'] : ['self', run.peerLabel]}
      link={running ? 'moving' : 'done'}
      title={runTitle(run)}
      chips={run.direction === 'incoming' && run.facts ? <RunFacts facts={run.facts} /> : null}
      aside={
        <>
          {running ? (
            <RunSpinner onStop={canStop ? () => void stop() : undefined} stopping={stopping} />
          ) : (
            <span title={run.status} className={`inline-grid size-6 place-items-center ${tone.text}`}>
              {run.tone === 'ok' ? (
                <Check className="size-4" />
              ) : run.status === 'Stopped' ? (
                <Square className="size-3 fill-current" />
              ) : (
                <CircleAlert className="size-4" />
              )}
            </span>
          )}
          <span className="rounded-md border border-canvas-border bg-canvas-muted px-1.5 font-mono text-xs tabular-nums text-canvas-muted-foreground">
            {elapsed}
          </span>
          <IconButton look="small" onClick={() => onDismiss(run.id)} aria-label="Dismiss">
            <X className="size-3.5" />
          </IconButton>
        </>
      }
      footer={run.sourcePreview ? <CodePreview source={run.sourcePreview} /> : null}
    >
      {run.label}
    </NoticeCard>
  );
}
