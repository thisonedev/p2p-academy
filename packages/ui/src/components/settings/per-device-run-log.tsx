'use client';

import type { AcademyPeerInfo, AcademyPeerAuditEntry } from '@academy/validation';
import { Loader2, Eraser, Trash2 } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useExecRunRows, ExecRunList } from './exec-runs.js';
import { pairUserDataLabel, shortHex, formatRelativeTime } from './device-format.js';
import { RoleBadge } from './role-badge.js';
import { RELATIVE_TIME_TICK_MS } from '../../lib/timings.js';

export function PerDeviceRunLog() {
  const [peers, setPeers] = useState<AcademyPeerInfo[]>([]);
  const [audit, setAudit] = useState<AcademyPeerAuditEntry[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [clearBusy, setClearBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!window.academy?.peer) return;
    const [p, au] = await Promise.all([
      window.academy.peer.list().catch(() => []),
      window.academy.peer.audit({ limit: 500 }).catch(() => []),
    ]);
    setPeers(Array.isArray(p) ? p : []);
    setAudit(Array.isArray(au) ? au : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh();
    const off = window.academy?.peer?.onEvent?.((msg) => {
      if (cancelled) return;
      if (
        msg.event === 'peer:audit' ||
        msg.event === 'peer:paired' ||
        msg.event === 'peer:dropped' ||
        msg.event === 'peer:audit-cleared' ||
        msg.event === 'peer:audit-cleared-for-peer'
      ) {
        refresh();
      }
    });
    const tick = setInterval(() => setNow(Date.now()), RELATIVE_TIME_TICK_MS);
    return () => {
      cancelled = true;
      if (typeof off === 'function') off();
      clearInterval(tick);
    };
  }, [refresh]);

  const onDrop = useCallback(async (discoveryKey: string) => {
    if (!window.academy?.peer) return;
    setActionBusy(discoveryKey);
    try {
      await window.academy.peer.drop(discoveryKey);
    } catch {
    } finally {
      setActionBusy(null);
    }
  }, []);

  const onClear = useCallback(async (discoveryKey: string) => {
    if (!window.academy?.peer) return;
    setClearBusy(discoveryKey);
    try {
      await window.academy.peer.clearPeerAudit(discoveryKey);
    } catch {
    } finally {
      setClearBusy(null);
    }
  }, []);

  if (peers.length === 0) {
    return (
      <p className="rounded-md border border-canvas-border bg-canvas-muted p-4 text-sm text-canvas-muted-foreground">
        No paired devices. Pair one in the form above, then come back to see run history for
        that pair here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {peers.map((peer) => (
          <PairedDeviceCard
            key={peer.discoveryKey}
            peer={peer}
            audit={audit}
            now={now}
            busy={actionBusy === peer.discoveryKey}
            clearBusy={clearBusy === peer.discoveryKey}
            onDrop={() => onDrop(peer.discoveryKey)}
            onClear={() => onClear(peer.discoveryKey)}
          />
        ))}
    </div>
  );
}

function PairedDeviceCard({
  peer,
  audit,
  now,
  busy,
  clearBusy,
  onDrop,
  onClear,
}: {
  peer: AcademyPeerInfo;
  audit: AcademyPeerAuditEntry[];
  now: number;
  busy: boolean;
  clearBusy: boolean;
  onDrop: () => void;
  onClear: () => void;
}) {
  const rows = useExecRunRows(peer, audit);
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas p-4">
      <div className="flex items-center gap-2">
        <p
          className="min-w-0 flex-1 truncate text-sm font-medium text-canvas-foreground"
          title={pairUserDataLabel(peer)}
        >
          {pairUserDataLabel(peer)}
        </p>
        <button
          type="button"
          onClick={onClear}
          disabled={clearBusy || rows.length === 0}
          title="Clear this device's run history"
          aria-label="Clear this device's run history"
          className="inline-flex shrink-0 items-center rounded border border-canvas-border bg-canvas-muted p-1.5 text-canvas-muted-foreground transition-colors hover:border-canvas-foreground/40 hover:text-canvas-foreground disabled:opacity-50"
        >
          {clearBusy ? <Loader2 className="size-3 animate-spin" /> : <Eraser className="size-3" />}
        </button>
        <button
          type="button"
          onClick={onDrop}
          disabled={busy}
          title="Drop this pair"
          aria-label="Drop this pair"
          className="inline-flex shrink-0 items-center rounded border border-canvas-border bg-canvas-muted p-1.5 text-canvas-muted-foreground transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <RoleBadge role={peer.role} />
        <span
          className="truncate font-mono text-caption text-canvas-muted-foreground"
          title={peer.discoveryKey}
        >
          {shortHex(peer.discoveryKey, 10, 6)} · paired {formatRelativeTime(peer.pairedAt, now)}
        </span>
      </div>
      <div className="mt-3">
        <ExecRunList
          rows={rows}
          emptyHint="No code runs on this pair yet. Open a lesson, switch run mode to Paired device, and pick this one."
        />
      </div>
    </div>
  );
}
