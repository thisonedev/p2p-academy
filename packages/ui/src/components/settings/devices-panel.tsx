'use client';

import type { AcademyPeerIdentity, AcademyPeerInvite, AcademyPeerInfo } from '@academy/validation';
import { Check, Copy, Loader2, Link2, Wifi, ShieldAlert, Lock, X } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { CLIPBOARD_SCRUB_MS, copyText, scrubClipboardLater } from '../../lib/clipboard.js';
import { SectionLabel } from '../ui/section-label.js';
import { Card } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import { Overlay } from '../ui/overlay.js';
import { useFlash } from '../../hooks/use-flash.js';
import { shortHex } from './device-format.js';
import '../../lib/academy.js';

/** Copies text and clears it after a delay. The desktop bridge is preferred because its timer lives in main and survives the window closing; the web fallback's scrub is best-effort and dies with the tab. */
function copyEphemeral(text: string): Promise<unknown> {
  const bridge = typeof window !== 'undefined' ? window.academy?.clipboard : undefined;
  if (bridge) return bridge.copy(text, CLIPBOARD_SCRUB_MS);
  return copyText(text).then(() => scrubClipboardLater(text));
}

function parsePairInput(input: string): {
  invite: string;
  hostIdentity: string | null;
} | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('p2p-academy://')) {
    try {
      const url = new URL(trimmed);
      const invite = url.searchParams.get('i');
      if (!invite) return null;
      return { invite, hostIdentity: url.searchParams.get('h') };
    } catch {
      return null;
    }
  }
  if (trimmed.includes('?i=')) {
    const invite = trimmed.split('?i=')[1]?.split('&')[0];
    if (!invite) return null;
    const hostIdentity = trimmed.includes('&h=') ? trimmed.split('&h=')[1]?.split('&')[0] ?? null : null;
    return {
      invite: decodeURIComponent(invite),
      hostIdentity: hostIdentity ? decodeURIComponent(hostIdentity) : null,
    };
  }
  return { invite: trimmed, hostIdentity: null };
}

/** The invite link excludes the pairing code, which the user shares separately. */
function pairUrl(invite: string, hostIdentity: string | null): string {
  const base = `p2p-academy://pair?i=${encodeURIComponent(invite)}`;
  return hostIdentity ? `${base}&h=${encodeURIComponent(hostIdentity)}` : base;
}

/** Profile username as the peer-visible device name, so pairing doesn't fall
 *  back to the OS login name and hostname. Also sends this device's OS, so
 *  the other side's peer picker can flag a Windows peer as execute-only. */
async function pairingUserData(): Promise<{ name?: string; os?: string } | undefined> {
  const name = await window.academy?.identity
    ?.getUsername?.()
    .then((host) => host?.username || undefined)
    .catch(() => undefined);
  const os = await window.academy?.device
    ?.info?.()
    .then((info) => info?.os || undefined)
    .catch(() => undefined);
  if (!name && !os) return undefined;
  return { ...(name ? { name } : {}), ...(os ? { os } : {}) };
}

function formatPairingCode(code: string): string {
  const upper = code.toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (upper.length <= 4) return upper;
  return `${upper.slice(0, 4)}-${upper.slice(4)}`;
}

function PairingCodeDisplay({ code, label }: { code: string; label: string }) {
  return (
    <div>
      <SectionLabel className="mb-1">
        {label}
      </SectionLabel>
      <p className="rounded-md border border-canvas-border bg-canvas-muted px-4 py-3 font-mono text-2xl font-semibold tracking-widest text-canvas-foreground">
        {formatPairingCode(code)}
      </p>
    </div>
  );
}

export function DevicesPanel() {
  const [identity, setIdentity] = useState<AcademyPeerIdentity | null | 'loading'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [deeplinkToast, setDeeplinkToast] = useState(false);
  // Hosting (creating an invite) makes this device the executor for whatever
  // pairs with it, and Windows has no sandbox to run a peer's code in yet.
  const [isWindows, setIsWindows] = useState(false);

  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteModal, setInviteModal] = useState<{
    invite: AcademyPeerInvite;
    hostIdentity: string | null;
  } | null>(null);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptText, setAcceptText] = useState('');
  const [acceptCode, setAcceptCode] = useState('');
  const [lockdownBusy, setLockdownBusy] = useState(false);
  const [lockdownConfirm, setLockdownConfirm] = useState(false);
  const [copied, flashCopied] = useFlash<string>();

  const refresh = useCallback(async () => {
    if (!window.academy?.peer) return;
    const id = await window.academy.peer.identity().catch(() => null);
    setIdentity(id);
  }, []);

  const [pairedPeers, setPairedPeers] = useState<AcademyPeerInfo[]>([]);
  const [pairedPeersLoaded, setPairedPeersLoaded] = useState(false);

  const refreshPeers = useCallback(async () => {
    if (!window.academy?.peer) return;
    const list = await window.academy.peer.list().catch(() => []);
    if (Array.isArray(list)) {
      setPairedPeers(list);
      setPairedPeersLoaded(true);
    }
  }, []);

  const applyDeeplink = useCallback((payload: { invite: string; hostIdentity: string | null }) => {
    setAcceptText(pairUrl(payload.invite, payload.hostIdentity ?? null));
    setDeeplinkToast(true);
    setTimeout(() => setDeeplinkToast(false), 8000);
  }, []);

  useEffect(() => {
    if (!window.academy?.peer) {
      setError('Peer layer unavailable in this build.');
      return;
    }
    refresh();
    refreshPeers();
    void window.academy?.device
      ?.info()
      .then((info) => setIsWindows(info.os === 'windows'))
      .catch(() => {});
    void window.academy.peer.takeDeeplink?.().then((payload) => {
      if (payload?.invite) applyDeeplink(payload);
    });
    const off = window.academy.peer.onEvent((msg) => {
      if (msg.event === 'peer:deeplink') {
        const payload = msg.payload as unknown as {
          invite: string;
          hostIdentity: string | null;
        };
        applyDeeplink(payload);
        void window.academy?.peer?.takeDeeplink?.();
      }
      if (msg.event === 'peer:paired') {
        setInviteModal(null);
        void refreshPeers();
      }
      if (msg.event === 'peer:dropped') {
        setInviteModal(null);
        setAcceptText('');
        setAcceptCode('');
        void refreshPeers();
      }
    });
    return () => {
      off();
    };
  }, [refresh, refreshPeers, applyDeeplink]);

  const onCreateInvite = useCallback(async () => {
    if (!window.academy?.peer) return;
    setInviteBusy(true);
    setError(null);
    try {
      const userData = await pairingUserData();
      const invite = await window.academy.peer.invite(userData ? { userData } : undefined);
      // The guest checks this against what the host proves during pairing.
      setInviteModal({ invite, hostIdentity: invite.hostIdentity ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setInviteBusy(false);
    }
  }, []);

  const onAccept = useCallback(async () => {
    if (!window.academy?.peer || !acceptText.trim()) return;
    setAcceptBusy(true);
    setError(null);
    try {
      const parsed = parsePairInput(acceptText);
      if (!parsed) {
        setError('Could not parse the invite. Paste a p2p-academy:// link or a raw invite.');
        return;
      }
      const code = acceptCode.trim();
      if (!code) {
        setError('Pairing code is required. Enter the code from the host separately.');
        return;
      }
      const userData = await pairingUserData();
      await window.academy.peer.accept(parsed.invite, {
        userData,
        code,
        hostIdentity: parsed.hostIdentity || undefined,
      });
      setAcceptText('');
      setAcceptCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pair failed');
    } finally {
      setAcceptBusy(false);
    }
  }, [acceptText, acceptCode]);

  const onLockdown = useCallback(async () => {
    if (!window.academy?.peer) return;
    setLockdownConfirm(false);
    setLockdownBusy(true);
    try {
      await window.academy.peer.lockdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lockdown failed');
    } finally {
      setLockdownBusy(false);
    }
  }, []);

  // `ephemeral` for the pairing code and invite link; the identity key is public and stays put.
  const onCopy = useCallback(async (text: string, key: string, ephemeral = false) => {
    await (ephemeral ? copyEphemeral(text) : copyText(text));
    flashCopied(key);
  }, [flashCopied]);

  if (error && identity === 'loading') {
    return (
      <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {deeplinkToast ? (
        <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
          Invite link opened. Enter the pairing code from the host, then click Pair.
        </div>
      ) : null}

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <SectionLabel>
              This device
            </SectionLabel>
            {identity === 'loading' ? (
              <p className="mt-1 text-sm text-canvas-muted-foreground">Loading…</p>
            ) : identity === null || !identity.publicKey ? (
              <p className="mt-1 text-sm text-canvas-muted-foreground">
                No profile yet, set one up under Settings → Profile.
              </p>
            ) : (
              <p
                className="mt-1 font-mono text-sm text-canvas-foreground"
                title={identity.publicKey ?? ''}
              >
                {shortHex(identity.publicKey, 12, 8)}
              </p>
            )}
            <ThisDeviceRoleSummary peers={pairedPeers} loaded={pairedPeersLoaded} />
          </div>
          {identity && identity !== 'loading' && identity.publicKey ? (
            <button
              type="button"
              onClick={() => {
                const id = identity.publicKey ?? '';
                if (id) onCopy(id, 'identity');
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-canvas-border bg-canvas-muted px-2.5 py-1 text-xs text-canvas-muted-foreground transition-colors hover:border-primary/40 hover:text-canvas-foreground"
            >
              {copied === 'identity' ? (
                <>
                  <Check className="size-3 text-primary" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3" /> Copy
                </>
              )}
            </button>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionLabel>
          Pair a new device
        </SectionLabel>
        {isWindows ? (
          <p className="mt-1 text-sm text-canvas-muted-foreground">
            Pairing as host is not supported on Windows: approving a device lets it run code
            on this machine, confined by the OS, and Windows has no sandbox for that yet.
            Pair by pasting an invite from a macOS or Linux device below instead.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-canvas-muted-foreground">
              Create a one-time invite. Share the link over chat or email, and the 6-character
              code separately. Approving a device lets it run code on this machine, confined by
              the OS. macOS and Linux only; peer exec is not available on Windows yet.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onCreateInvite}
                disabled={inviteBusy}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-canvas transition-colors hover:bg-primary disabled:opacity-50"
              >
                {inviteBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                Create invite
              </button>
            </div>
          </>
        )}

        <div className="mt-5 border-t border-canvas-border pt-4">
          <SectionLabel as="label"
            htmlFor="peer-accept-input"
          >
            Paste an invite link
          </SectionLabel>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="peer-accept-input"
              type="text"
              value={acceptText}
              onChange={(e) => setAcceptText(e.target.value)}
              placeholder="p2p-academy://pair?i=…"
              spellCheck={false}
              autoComplete="off"
              className="flex-1 rounded-md border border-canvas-border bg-canvas-muted px-3 py-2 font-mono text-xs text-canvas-foreground placeholder:text-canvas-muted-foreground/60 focus:border-primary/60 focus:outline-none"
            />
          </div>
          <SectionLabel as="label"
            htmlFor="peer-accept-code"
            className="mt-3 block"
          >
            Pairing code
          </SectionLabel>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="peer-accept-code"
              type="text"
              value={acceptCode}
              onChange={(e) => setAcceptCode(e.target.value)}
              placeholder="A3F2-9C"
              spellCheck={false}
              autoComplete="off"
              className="flex-1 rounded-md border border-canvas-border bg-canvas-muted px-3 py-2 font-mono text-xs uppercase tracking-widest text-canvas-foreground placeholder:text-canvas-muted-foreground/60 focus:border-primary/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={onAccept}
              disabled={acceptBusy || !acceptText.trim() || !acceptCode.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-canvas-border bg-canvas-muted px-3 py-2 text-sm font-semibold text-canvas-foreground transition-colors hover:border-primary/40 disabled:opacity-50"
            >
              {acceptBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Wifi className="size-3.5" />}
              {acceptBusy ? 'Pairing…' : 'Pair'}
            </button>
          </div>
          <p className="mt-2 text-caption text-canvas-muted-foreground/80">
            {acceptBusy
              ? 'Waiting for the other device to approve. Open Settings > Devices on the other side, then click Approve.'
              : 'Enter the code the host shows or reads to you. The invite link alone is not enough.'}
          </p>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>
            Lockdown
          </SectionLabel>
          {lockdownConfirm ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setLockdownConfirm(false)}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-canvas-muted-foreground hover:text-canvas-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onLockdown}
                disabled={lockdownBusy}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
              >
                {lockdownBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ShieldAlert className="size-3.5" />
                )}
                Drop em
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLockdownConfirm(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/20"
            >
              <Lock className="size-3.5" />
              Lockdown
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-canvas-muted-foreground">
          Drop every active pair and reject every pending request. You can re-pair afterwards.
        </p>
      </Card>

      {inviteModal ? (
        <InviteModal
          invite={inviteModal.invite}
          hostIdentity={inviteModal.hostIdentity}
          copied={copied}
          onCopy={onCopy}
          onClose={() => setInviteModal(null)}
        />
      ) : null}
    </div>
  );
}

function InviteModal({
  invite,
  hostIdentity,
  copied,
  onCopy,
  onClose,
}: {
  invite: AcademyPeerInvite;
  hostIdentity: string | null;
  copied: string | null;
  onCopy: (text: string, key: string, ephemeral?: boolean) => void;
  onClose: () => void;
}) {
  const url = pairUrl(invite.invite, hostIdentity);
  return (
    <Overlay onClose={onClose} role="dialog" aria-modal="true">
      <div
        className="w-full max-w-md overflow-y-auto rounded-xl border border-canvas-border bg-canvas p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-primary">
              Pair a device
            </p>
            <h2 className="mt-1 text-lg font-semibold text-canvas-foreground">
              Share the link and the code separately
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-canvas-muted-foreground transition-colors hover:bg-canvas-muted hover:text-canvas-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4">
          <PairingCodeDisplay
            code={invite.pairingCode}
            label="Pairing code (read aloud or share separately)"
          />
          <p className="text-caption text-canvas-muted-foreground/80">
            Send the invite link over chat or email. Give the code out of band; the link does not include it.
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onCopy(url, 'url', true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-canvas-border bg-canvas-muted px-3 py-2 text-xs text-canvas-foreground transition-colors hover:border-primary/40"
          >
            {copied === 'url' ? (
              <>
                <Check className="size-3 text-primary" /> Copied link
              </>
            ) : (
              <>
                <Copy className="size-3" /> Copy invite link
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => onCopy(invite.pairingCode, 'code', true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-canvas-border bg-canvas-muted px-3 py-2 text-xs text-canvas-foreground transition-colors hover:border-primary/40"
          >
            {copied === 'code' ? (
              <>
                <Check className="size-3 text-primary" /> Copied code
              </>
            ) : (
              <>
                <Copy className="size-3" /> Copy pairing code
              </>
            )}
          </button>
        </div>
        <p className="mt-4 break-all text-center font-mono text-micro text-canvas-muted-foreground/70">
          {url}
        </p>
      </div>
    </Overlay>
  );
}

function ThisDeviceRoleSummary({
  peers,
  loaded,
}: {
  peers: AcademyPeerInfo[];
  loaded: boolean;
}) {
  if (!loaded) return null;
  if (peers.length === 0) {
    return (
      <p className="mt-2 text-caption text-canvas-muted-foreground/80">
        No active pairings.
      </p>
    );
  }
  const hostCount = peers.filter((p) => p.role === 'host').length;
  const guestCount = peers.filter((p) => p.role === 'guest').length;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-micro font-medium uppercase tracking-wider text-canvas-muted-foreground/80">
        Acting as
      </span>
      {hostCount > 0 ? <RoleChip role="host" count={hostCount} /> : null}
      {guestCount > 0 ? <RoleChip role="guest" count={guestCount} /> : null}
    </div>
  );
}

function RoleChip({ role, count }: { role: 'host' | 'guest'; count: number }) {
  return (
    <Badge tone={role === 'host' ? 'primary' : 'info'}>
      {role}
      {count > 1 ? <span className="opacity-70">× {count}</span> : null}
    </Badge>
  );
}
