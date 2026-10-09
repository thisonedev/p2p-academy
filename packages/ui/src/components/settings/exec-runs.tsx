'use client';

import type { AcademyPeerAuditEntry, AcademyPeerInfo } from '@academy/validation';
import { useMemo } from 'react';
import { Card } from '../ui/card.js';
import { RoleBadge } from './role-badge.js';
import {
  formatClockTime,
  formatExecSample,
  formatRelativeTime,
  pairUserDataLabel,
  shortHex,
} from './device-format.js';

const EXEC_EVENT_TYPES = new Set<AcademyPeerAuditEntry['type']>([
  'peer:exec:started',
  'peer:exec:finished',
  'peer:exec:error',
  'peer:exec:remote-started',
  'peer:exec:remote-finished',
  'peer:exec:remote-error',
]);

function execEventLabel(
  entry: AcademyPeerAuditEntry,
  peerRole: 'host' | 'guest',
  peerName?: string | null,
): { text: string; tone: 'running' | 'ok' | 'err' | 'info' } {
  const sample = formatExecSample(entry);
  const sampleTail = sample ? ` · ${sample}` : '';
  const onPeer = peerRole === 'guest' && peerName ? ` on ${peerName}` : '';
  switch (entry.type) {
    case 'peer:exec:started':
    case 'peer:exec:remote-started':
      return { text: `Run started${onPeer}${sampleTail}`, tone: 'running' };
    case 'peer:exec:finished':
    case 'peer:exec:remote-finished': {
      const code = entry.code;
      const signal = entry.signal;
      const base =
        code === 0
          ? `Run finished${onPeer} · exit 0`
          : code != null
            ? `Run failed${onPeer} · exit ${code}`
            : signal
              ? `Run stopped${onPeer} · ${signal}`
              : `Run finished${onPeer}`;
      return { text: `${base}${sampleTail}`, tone: code === 0 ? 'ok' : 'err' };
    }
    case 'peer:exec:error':
    case 'peer:exec:remote-error':
      return {
        text: `Run error${onPeer}${entry.message ? `: ${entry.message}` : ''}${sampleTail}`,
        tone: 'err',
      };
    default:
      return { text: entry.type, tone: 'info' };
  }
}

function execEventToneClass(tone: 'running' | 'ok' | 'err' | 'info'): string {
  switch (tone) {
    case 'running':
      return 'text-info';
    case 'ok':
      return 'text-primary';
    case 'err':
      return 'text-danger';
    default:
      return 'text-canvas-muted-foreground';
  }
}

function formatRunDuration(startTs: number, endTs: number): string {
  const sec = Math.max(0, Math.round((endTs - startTs) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  return `${min}m ${rest}s`;
}

type ExecRunRow = {
  key: string;
  label: string;
  tone: 'running' | 'ok' | 'err' | 'info';
  ts: number;
  duration: string | null;
  /** Set on the 'started' row so a run is inspectable even when it never
   *  triggered a device/network consent prompt. */
  sourcePreview?: string;
};

/** A paired device's code runs, newest first, each with how long it took. */
export function useExecRunRows(peer: AcademyPeerInfo, audit: AcademyPeerAuditEntry[]): ExecRunRow[] {
  const events = useMemo(() => {
    const list = audit.filter(
      (e) => e.discoveryKey === peer.discoveryKey && EXEC_EVENT_TYPES.has(e.type),
    );
    list.sort((a, b) => a.timestamp - b.timestamp);
    return list;
  }, [audit, peer.discoveryKey]);

  const peerName = pairUserDataLabel(peer);

  return useMemo(() => {
    const result: ExecRunRow[] = [];
    const openStartByRun = new Map<string, number>();
    let runIndex = 0;
    for (const e of events) {
      const isStarted = e.type === 'peer:exec:started' || e.type === 'peer:exec:remote-started';
      const isFinished = e.type === 'peer:exec:finished' || e.type === 'peer:exec:remote-finished';
      const isError = e.type === 'peer:exec:error' || e.type === 'peer:exec:remote-error';
      if (isStarted) {
        openStartByRun.set(`run-${runIndex}`, e.timestamp);
        const { text, tone } = execEventLabel(e, peer.role, peerName);
        result.push({
          key: `start-${e.timestamp}-${runIndex}`,
          label: text,
          tone,
          ts: e.timestamp,
          duration: null,
          sourcePreview: e.sourcePreview,
        });
        runIndex += 1;
        continue;
      }
      if (isFinished || isError) {
        const startKey = Array.from(openStartByRun.keys()).pop();
        const startTs = startKey ? openStartByRun.get(startKey) : undefined;
        if (startKey && startTs != null) openStartByRun.delete(startKey);
        const { text, tone } = execEventLabel(e, peer.role, peerName);
        result.push({
          key: `end-${e.timestamp}-${runIndex}`,
          label: text,
          tone,
          ts: e.timestamp,
          duration: startTs != null ? formatRunDuration(startTs, e.timestamp) : null,
        });
        continue;
      }
    }
    for (const [key, startTs] of openStartByRun) {
      result.push({
        key: `unfinished-${key}-${startTs}`,
        label: 'Run started · no completion recorded',
        tone: 'err',
        ts: startTs,
        duration: null,
      });
    }
    return result.reverse();
  }, [events, peer.role, peerName]);
}

export function ExecRunList({
  rows,
  emptyHint,
}: {
  rows: ExecRunRow[];
  emptyHint?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-canvas-muted-foreground">
        {emptyHint ?? 'No code runs on this pair yet.'}
      </p>
    );
  }
  return (
    <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-canvas-border bg-canvas-muted p-3 font-mono text-caption text-canvas-muted-foreground">
      {rows.map((row) => (
        <li key={row.key} className="space-y-0.5">
          <div className="text-canvas-muted-foreground/60">
            {formatClockTime(row.ts)}
            {row.duration ? ` · ${row.duration}` : ''}
          </div>
          <div className={execEventToneClass(row.tone)}>{row.label}</div>
          {row.sourcePreview ? (
            <details>
              <summary className="cursor-pointer select-none hover:underline">View code</summary>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-canvas-border/40 p-2 text-canvas-foreground">
                {row.sourcePreview}
              </pre>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function PairedDeviceActivity({
  peer,
  audit,
  now,
}: {
  peer: AcademyPeerInfo;
  audit: AcademyPeerAuditEntry[];
  now: number;
}) {
  const rows = useExecRunRows(peer, audit);

  return (
    <Card className="flex flex-col">
      <div className="flex items-center gap-2">
        <p className="truncate text-sm font-medium text-canvas-foreground">
          {pairUserDataLabel(peer)}
        </p>
        <RoleBadge role={peer.role} hint />
        <span className="ml-auto text-xs text-canvas-muted-foreground">
          {rows.length} {rows.length === 1 ? 'run' : 'runs'}
        </span>
      </div>
      <p
        className="mt-0.5 truncate font-mono text-caption text-canvas-muted-foreground"
        title={peer.discoveryKey}
      >
        {shortHex(peer.discoveryKey, 10, 6)} · paired {formatRelativeTime(peer.pairedAt, now)}
      </p>
      <div className="mt-3">
        <ExecRunList
          rows={rows}
          emptyHint="No code runs on this pair yet. Open a lesson, switch run mode to Paired device, and pick this one to send a run here."
        />
      </div>
    </Card>
  );
}
