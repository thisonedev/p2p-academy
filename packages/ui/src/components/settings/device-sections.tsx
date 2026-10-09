'use client';

import type { AcademyPeerAuditEntry, AcademyPeerPending, AcademyPeerInfo } from '@academy/validation';
import { Eraser, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { SectionLabel } from '../ui/section-label.js';
import { Card } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import { RoleBadge } from './role-badge.js';
import {
  formatClockTime,
  formatExecSample,
  formatRelativeTime,
  pairUserDataLabel,
  shortHex,
} from './device-format.js';
import { RELATIVE_TIME_TICK_MS } from '../../lib/timings.js';

function auditLabel(entry: AcademyPeerAuditEntry, peerName?: string | null): string {
  switch (entry.type) {
    case 'peer:pending':
      return `Pair request from ${pairUserDataLabel({ userData: entry.remoteUserData })}`;
    case 'peer:paired':
      return `Paired with ${pairUserDataLabel({ userData: entry.remoteUserData })} (${entry.role ?? '?'})`;
    case 'peer:approved':
      return 'Pair request approved';
    case 'peer:rejected':
      if (entry.reason === 'pairing-code-mismatch') {
        return 'Pairing code rejected';
      }
      if (entry.reason === 'pairing-code-lockout') {
        return 'Pairing locked after too many wrong codes';
      }
      if (entry.reason === 'device-revoked') {
        return 'Rejected: this device was revoked';
      }
      if (entry.reason === 'host-identity-mismatch') {
        return 'Rejected: the host is not the profile the invite claimed';
      }
      if (entry.reason === 'unverified-build') {
        return 'Pair request rejected';
      }
      return 'Pair request rejected';
    case 'peer:identity-verified':
      return entry.identityVerified
        ? `Profile verified${entry.identityPublicKey ? ` · ${shortHex(entry.identityPublicKey, 8, 6)}` : ''}`
        : 'Peer holds its device key but announced no verified profile';
    case 'peer:dropped':
      return 'Pair dropped';
    case 'peer:lockdown':
      return `Lockdown: ${entry.dropped ?? 0} dropped`;
    case 'peer:exec:started': {
      const sample = formatExecSample(entry);
      const tail = sample ? ` · ${sample}` : '';
      return `Exec started on this device${tail}`;
    }
    case 'peer:exec:finished': {
      const sample = formatExecSample(entry);
      const tail = sample ? ` · ${sample}` : '';
      return `Exec finished on this device · code ${entry.code ?? '?'}${entry.signal ? `, ${entry.signal}` : ''}${tail}`;
    }
    case 'peer:exec:error': {
      const sample = formatExecSample(entry);
      const tail = sample ? ` · ${sample}` : '';
      return `Exec error on this device: ${entry.message ?? 'unknown'}${tail}`;
    }
    case 'peer:exec:remote-started': {
      const sample = formatExecSample(entry);
      const tail = sample ? ` · ${sample}` : '';
      const who = peerName ? ` on ${peerName}` : ' on paired device';
      return `Exec started${who}${tail}`;
    }
    case 'peer:exec:remote-finished': {
      const sample = formatExecSample(entry);
      const tail = sample ? ` · ${sample}` : '';
      const who = peerName ? ` on ${peerName}` : ' on paired device';
      return `Exec finished${who} · code ${entry.code ?? '?'}${entry.signal ? `, ${entry.signal}` : ''}${tail}`;
    }
    case 'peer:exec:remote-error': {
      const sample = formatExecSample(entry);
      const tail = sample ? ` · ${sample}` : '';
      const who = peerName ? ` on ${peerName}` : ' on paired device';
      return `Exec error${who}: ${entry.message ?? 'unknown'}${tail}`;
    }
    case 'peer:pair:sent':
      return 'Pair request sent, waiting for approval';
    case 'peer:pair:error':
      return `Pair failed: ${entry.message ?? 'unknown'}`;
    default:
      return entry.type;
  }
}

const ACTIVITY_LIMIT = 100;

export function ActivitySection() {
  const [audit, setAudit] = useState<AcademyPeerAuditEntry[]>([]);
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!window.academy?.peer) return;
    let cancelled = false;
    const refresh = async () => {
      const [au, peers] = await Promise.all([
        window.academy?.peer?.audit({ limit: ACTIVITY_LIMIT }).catch(() => []) ?? [],
        window.academy?.peer?.list().catch(() => []) ?? [],
      ]);
      if (cancelled) return;
      setAudit(au.slice().reverse());
      const map: Record<string, string> = {};
      for (const p of peers) {
        if (p.discoveryKey) map[p.discoveryKey] = pairUserDataLabel(p);
      }
      setPeerNames(map);
    };
    refresh();
    const off = window.academy.peer.onEvent((msg) => {
      if (msg.event === 'peer:audit') {
        const entry = msg.payload as AcademyPeerAuditEntry;
        setAudit((prev) => [entry, ...prev].slice(0, ACTIVITY_LIMIT));
      }
      if (msg.event === 'peer:audit-cleared') {
        setAudit([]);
      }
      if (msg.event === 'peer:paired' || msg.event === 'peer:dropped') {
        refresh();
      }
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between">
        <SectionLabel>
          Activity
        </SectionLabel>
        {audit.length > 0 ? (
          <button
            type="button"
            onClick={() => window.academy?.peer?.clearAudit?.()}
            title="Clear activity log"
            aria-label="Clear activity log"
            className="inline-flex shrink-0 items-center gap-1 rounded border border-canvas-border bg-canvas-muted p-1.5 text-canvas-muted-foreground transition-colors hover:border-canvas-foreground/40 hover:text-canvas-foreground"
          >
            <Eraser className="size-3" />
          </button>
        ) : null}
      </div>
      {audit.length === 0 ? (
        <p className="mt-3 text-sm text-canvas-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-canvas-border bg-canvas-muted p-3 font-mono text-caption text-canvas-muted-foreground">
          {audit.map((entry, idx) => (
            <li key={`${entry.timestamp}-${idx}`} className="space-y-0.5">
              <div className="text-canvas-muted-foreground/60">{formatClockTime(entry.timestamp)}</div>
              <div className="text-canvas-foreground">
                {auditLabel(entry, entry.discoveryKey ? peerNames[entry.discoveryKey] : null)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

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

export function PairedDevicesSection() {
  const [peers, setPeers] = useState<AcademyPeerInfo[]>([]);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const refresh = useCallback(async () => {
    const p = (await window.academy?.peer?.list?.().catch(() => [])) ?? [];
    if (Array.isArray(p)) setPeers(p);
  }, []);

  useEffect(() => {
    if (!window.academy?.peer) return;
    let cancelled = false;
    refresh();
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

  const onDrop = useCallback(
    async (discoveryKey: string) => {
      if (!window.academy?.peer) return;
      setActionBusy(discoveryKey);
      try {
        await window.academy.peer.drop(discoveryKey);
        await refresh();
      } catch {
        // surfaced via peer events
      } finally {
        setActionBusy(null);
      }
    },
    [refresh],
  );

  return (
    <Card className="flex flex-col">
      <div className="flex items-baseline justify-between">
        <SectionLabel>
          Paired devices
        </SectionLabel>
        <span className="text-xs text-canvas-muted-foreground">{peers.length}</span>
      </div>
      {peers.length === 0 ? (
        <p className="mt-3 text-sm text-canvas-muted-foreground">
          No devices paired yet. Create or paste an invite to start.
        </p>
      ) : (
        <ul className="mt-3 max-h-40 divide-y divide-canvas-border overflow-y-auto rounded-lg border border-canvas-border bg-canvas-muted">
          {peers.map((p) => (
            <li
              key={p.discoveryKey}
              className="flex items-center justify-between gap-2 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm text-canvas-foreground">
                    {pairUserDataLabel(p)}
                  </p>
                  <RoleBadge role={p.role} hint />
                  <IdentityBadge peer={p} />
                </div>
                <p
                  className="mt-0.5 truncate font-mono text-caption text-canvas-muted-foreground"
                  title={p.verifiedIdentityPublicKey ?? p.discoveryKey}
                >
                  {p.verifiedIdentityPublicKey
                    ? `identity ${shortHex(p.verifiedIdentityPublicKey, 10, 6)}`
                    : shortHex(p.discoveryKey, 10, 6)}{' '}
                  · paired {formatRelativeTime(p.pairedAt, now)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDrop(p.discoveryKey)}
                disabled={actionBusy === p.discoveryKey}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-canvas-border bg-canvas px-2 py-1 text-caption text-canvas-muted-foreground transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
              >
                {actionBusy === p.discoveryKey ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  'Drop'
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Verified means the peer proved it holds a device key attested to the root identity it announced; unverified pairs still work but nothing vouches for whose device it is. */
function IdentityBadge({ peer }: { peer: AcademyPeerInfo }) {
  if (peer.identityVerified) {
    return (
      <Badge tone="primary" className="shrink-0" title={peer.verifiedIdentityPublicKey ?? undefined}>
        <ShieldCheck className="size-2.5" />
        verified
      </Badge>
    );
  }
  return (
    <Badge
      tone="warning"
      className="shrink-0"
      title="This peer has not proven an identity. Its name and key are self-reported."
    >
      <ShieldAlert className="size-2.5" />
      unverified
    </Badge>
  );
}
