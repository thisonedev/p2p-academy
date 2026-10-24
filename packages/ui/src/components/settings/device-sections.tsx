'use client';

import type { AcademyPeerPending } from '@academy/validation';
import { Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { SectionLabel } from '../ui/section-label.js';
import { Card } from '../ui/card.js';
import { formatRelativeTime, pairUserDataLabel, shortHex } from './device-format.js';
import { RELATIVE_TIME_TICK_MS } from '../../lib/timings.js';

export function PendingRequestsSection() {
  const [pending, setPending] = useState<AcademyPeerPending[]>([]);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  // A pending request only exists for a device someone tried to pair with as
  // host, which Windows can never be.
  const [isWindows, setIsWindows] = useState(false);

  const refresh = useCallback(async () => {
    const pn = (await window.academy?.peer?.pending?.().catch(() => [])) ?? [];
    if (Array.isArray(pn)) setPending(pn);
  }, []);

  useEffect(() => {
    if (!window.academy?.peer) return;
    let cancelled = false;
    refresh();
    void window.academy?.device
      ?.info()
      .then((info) => setIsWindows(info.os === 'windows'))
      .catch(() => {});
    const off = window.academy.peer.onEvent(() => {
      if (cancelled) return;
      refresh();
    });
    const tick = setInterval(() => setNow(Date.now()), RELATIVE_TIME_TICK_MS);
    return () => {
      cancelled = true;
      off();
      clearInterval(tick);
    };
  }, [refresh]);

  const onApprove = useCallback(
    async (requestId: string) => {
      if (!window.academy?.peer) return;
      setActionBusy(requestId);
      try {
        const ok = await window.academy.peer.approve(requestId);
        if (ok) {
          setPending((prev) => prev.filter((p) => p.requestId !== requestId));
        } else {
          await refresh();
        }
      } catch {
        // approval errors are surfaced via peer events
      } finally {
        setActionBusy(null);
      }
    },
    [refresh],
  );

  const onReject = useCallback(async (requestId: string) => {
    if (!window.academy?.peer) return;
    setActionBusy(requestId);
    try {
      await window.academy.peer.reject(requestId);
    } catch {
      // surface via peer events
    } finally {
      setActionBusy(null);
    }
  }, []);

  if (isWindows) return null;

  return (
    <Card className="flex flex-col">
      <div className="flex items-baseline justify-between">
        <SectionLabel>
          Pending requests
        </SectionLabel>
        <span className="text-xs text-canvas-muted-foreground">{pending.length}</span>
      </div>
      <p className="mt-1 text-xs text-canvas-muted-foreground">
        Approve only devices you trust. They can run code on this machine, confined by the OS.
      </p>
      {pending.length === 0 ? (
        <p className="mt-3 text-sm text-canvas-muted-foreground">No pending requests.</p>
      ) : (
        <ul className="mt-3 max-h-40 divide-y divide-canvas-border overflow-y-auto overflow-x-hidden rounded-lg border border-canvas-border bg-canvas-muted">
          {pending.map((p) => {
            const codeMatches =
              p.enteredPairingCode &&
              p.enteredPairingCode.toLowerCase().split('-').join('-') ===
                p.expectedPairingCode.toLowerCase().split('-').join('-');
            return (
              <li key={p.requestId} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-canvas-foreground">
                      {pairUserDataLabel(p)}
                    </p>
                    <p
                      className="mt-0.5 truncate font-mono text-caption text-canvas-muted-foreground"
                      title={p.discoveryKey}
                    >
                      {shortHex(p.discoveryKey, 10, 6)} · {formatRelativeTime(p.receivedAt, now)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onReject(p.requestId)}
                      disabled={actionBusy === p.requestId}
                      className="rounded border border-canvas-border bg-canvas px-2 py-1 text-caption text-canvas-muted-foreground transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
                    >
                      {actionBusy === p.requestId ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        'Reject'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onApprove(p.requestId)}
                      disabled={actionBusy === p.requestId || !codeMatches}
                      className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-caption font-semibold text-canvas transition-colors hover:bg-primary disabled:opacity-50"
                    >
                      {actionBusy === p.requestId ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        'Approve'
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-micro text-canvas-muted-foreground">
                  <span className="font-mono">{p.expectedPairingCode}</span>
                  <span
                    className={
                      codeMatches
                        ? 'inline-flex items-center gap-1 font-mono text-primary'
                        : 'inline-flex items-center gap-1 font-mono text-danger'
                    }
                  >
                    {codeMatches ? (
                      <ShieldCheck className="size-3" />
                    ) : (
                      <ShieldAlert className="size-3" />
                    )}
                    {p.enteredPairingCode ?? 'no code'}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
