import { useEffect, useMemo, useState } from 'react';
import { peerIsWindows, type RunMode } from './run-helpers.js';
import '../../lib/academy.js';

/** The devices paired with this one that a lesson can run on, and which of them is picked. */
export function usePairedPeers(isDesktop: boolean, runMode: RunMode) {
  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    const fetchPeers = async () => {
      try {
        const peers = await window.academy?.peer?.list?.();
        if (!cancelled && Array.isArray(peers)) {
          setRemotePeers(
            peers.map((p) => ({
              discoveryKey: p.discoveryKey,
              userData: p.userData,
              role: p.role,
              pairedAt: p.pairedAt,
              hostIdentity: p.hostIdentity ?? null,
            })),
          );
        }
      } catch {
        // silent; UI shows the empty state
      }
    };
    fetchPeers();
    const unsubscribe = window.academy?.peer?.onEvent?.(() => {
      fetchPeers();
    });
    return () => {
      cancelled = true;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isDesktop]);
  // Poll identity briefly: peer.init runs after app.whenReady, so an early-mounted workspace may see null for a beat.
  const [localPublicKey, setLocalPublicKey] = useState<string | null>(null);
  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    const fetchIdentity = async () => {
      try {
        const id = await window.academy?.peer?.identity?.();
        if (cancelled) return;
        if (id?.publicKey) {
          setLocalPublicKey(id.publicKey);
          if (pollId) {
            clearInterval(pollId);
            pollId = null;
          }
        }
      } catch {
        // silent; treat as no identity until it loads
      }
    };
    fetchIdentity();
    pollId = setInterval(fetchIdentity, 500);
    const unsubscribe = window.academy?.peer?.onEvent?.(() => {
      fetchIdentity();
    });
    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isDesktop]);
  const [remotePeers, setRemotePeers] = useState<
    Array<{
      discoveryKey: string;
      userData: unknown;
      role: string;
      pairedAt: number;
      hostIdentity: string | null;
    }>
  >([]);
  // Two app instances sharing a userData dir pair as the same identity, and the exec channel
  // can't route between matching keys, so filter self-pairs and keep only guest-role peers.
  const realRemotePeers = useMemo(() => {
    const notSelf = localPublicKey
      ? remotePeers.filter((p) => p.hostIdentity !== localPublicKey)
      : remotePeers;
    return notSelf.filter((p) => p.role === 'guest');
  }, [remotePeers, localPublicKey]);
  const selfPairCount = remotePeers.length - realRemotePeers.length;
  const localIsOnlyHost = remotePeers.length > 0 && remotePeers.every((p) => p.role === 'host');
  const [selectedPeerId, setSelectedPeerId] = useState<string>('');
  useEffect(() => {
    if (runMode !== 'remote') return;
    if (realRemotePeers.length === 0) return;
    if (realRemotePeers.some((p) => p.discoveryKey === selectedPeerId)) return;
    // A Windows peer is a disabled option in the picker below, so defaulting
    // to one would auto-select something the user can't actually run against.
    const executable = realRemotePeers.filter((p) => !peerIsWindows(p.userData));
    const candidates = executable.length > 0 ? executable : realRemotePeers;
    const latest = candidates.reduce((a, b) => (a.pairedAt >= b.pairedAt ? a : b));
    setSelectedPeerId(latest.discoveryKey);
  }, [runMode, realRemotePeers, selectedPeerId]);

  return { remotePeers, realRemotePeers, selfPairCount, localIsOnlyHost, selectedPeerId, setSelectedPeerId };
}

export type PairedPeers = ReturnType<typeof usePairedPeers>;
