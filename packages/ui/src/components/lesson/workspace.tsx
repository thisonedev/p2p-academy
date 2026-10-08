'use client';

import { useUserStore } from '@academy/core';
import { normalizeLessonCode } from '@academy/validation/lesson-code';
import type { ChatSecurityResult } from '@academy/validation';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type ReactNode,
  useLayoutEffect,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { CurriculumStrip } from '../course/curriculum-strip.js';
import { LessonCompleteModal } from './complete-modal.js';
import { parseProgress } from './progress.js';
import { QuestionCheck } from './question-check.js';
import { ChatInputBar } from './chat-input-bar.js';
import type { ConsoleEntry } from './console-types.js';
import { Overlay } from '../ui/overlay.js';
import type { LessonData, OutputLine } from './lesson-types.js';
import {
  CAPTURE_MARKERS,
  PASSING_MATCH_STATUSES,
  appendChunkLines,
  capturedKey,
  delay,
  overrideKey,
  peerDisplayName,
  peerIsWindows,
  runFileName,
  runLabel,
  runTests,
  sourceFromArgvFrom,
  unstreamed,
  type RunMode,
} from './run-helpers.js';
import { Runner } from './runner.js';
import '../../lib/academy.js';

export function LessonWorkspace({ data, children }: { data: LessonData; children: ReactNode }) {
  // Next's own scroll-to-top-on-navigate runs after this page's content has
  // already painted at the previous page's scroll offset, which reads as a
  // jump once anything (e.g. a sticky bar) stays put through it. Resetting
  // here, before paint, lands on the new lesson's top with nothing to see.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [data.currentLesson?.slug]);

  const [userCode, setUserCode] = useState(data.startingCode);
  const [questionsCorrect, setQuestionsCorrect] = useState(false);
  const [platform, setPlatform] = useState<LessonData['platforms'][number]>('node');
  // Deferred to useEffect so the first client render matches the SSR'd HTML.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    setIsDesktop(typeof window !== 'undefined' && typeof window.academy?.run === 'function');
  }, []);

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
  const [runMode, setRunMode] = useState<RunMode>('simulated');
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
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  // Tracks the AI verify call the most recent Check Answer kicked off, so a
  // later click can cancel a still-running review instead of leaving it
  // orphaned, and so onVerifyResult knows which entry to update.
  const pendingVerifyRef = useRef<{ requestId: string; entryId: string } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [chapterReady, setChapterReady] = useState(false);
  const [argvOverrides, setArgvOverrides] = useState<Record<string, string>>({});
  const [argvCaptured, setArgvCaptured] = useState<Record<string, string>>({});
  const [lastRemoteRun, setLastRemoteRun] = useState<
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
    | null
  >(null);

  useEffect(() => {
    if (data.readOnly) {
      setUserCode(data.startingCode || '// This section is informational. No code to run here.\n');
    } else {
      setUserCode(data.startingCode);
    }
    setEntries([]);
    pendingVerifyRef.current = null;
    setRunMode(isDesktop ? 'this-device' : 'simulated');
    setShowCompleteModal(false);
    setChapterReady(false);
    setQuestionsCorrect(false);
  }, [data.startingCode, data.readOnly, isDesktop]);

  useEffect(() => {
    if (!isDesktop || !data.argv || data.argv.length === 0) return;
    let cancelled = false;
    (async () => {
      const nextOverrides: Record<string, string> = {};
      const nextCaptured: Record<string, string> = {};
      for (const slot of data.argv ?? []) {
        const overrideValue = await window.academy?.state?.get(overrideKey(slot.name));
        if (cancelled) return;
        if (typeof overrideValue === 'string' && overrideValue.length > 0) {
          nextOverrides[slot.name] = overrideValue;
        }
        const source = sourceFromArgvFrom(slot.from);
        if (source) {
          const capturedValue = await window.academy?.state?.get(capturedKey(source));
          if (cancelled) return;
          if (typeof capturedValue === 'string' && capturedValue.length > 0) {
            nextCaptured[source] = capturedValue;
          }
        }
      }
      if (!cancelled) {
        setArgvOverrides(nextOverrides);
        setArgvCaptured(nextCaptured);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDesktop, data.argv]);

  // An empty value keeps the override session active. Only non-empty values persist.
  const setArgvOverrideValue = useCallback(
    (name: string, value: string) => {
      setArgvOverrides((prev) => {
        if (!(name in prev) && value.length === 0) return prev;
        return { ...prev, [name]: value };
      });
      if (isDesktop && value.length > 0) {
        void window.academy?.state?.set(overrideKey(name), value);
      }
    },
    [isDesktop],
  );

  const startArgvOverride = useCallback((name: string) => {
    setArgvOverrides((prev) => {
      if (name in prev) return prev;
      return { ...prev, [name]: '' };
    });
  }, []);

  const clearArgvOverride = useCallback(
    (name: string) => {
      setArgvOverrides((prev) => {
        if (!(name in prev)) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
      if (isDesktop) {
        void window.academy?.state?.remove(overrideKey(name));
      }
    },
    [isDesktop],
  );

  const resolveArgv = useCallback(async (): Promise<string[]> => {
    if (!data.argv || data.argv.length === 0) return [];
    const out: string[] = [];
    for (const slot of data.argv) {
      const override = argvOverrides[slot.name];
      if (override && override.length > 0) {
        out.push(override);
        continue;
      }
      const source = sourceFromArgvFrom(slot.from);
      if (source && isDesktop) {
        const captured = await window.academy?.state?.get(capturedKey(source));
        if (typeof captured === 'string' && captured.length > 0) {
          out.push(captured);
          continue;
        }
      }
      out.push(slot.default ?? '');
    }
    return out;
  }, [data.argv, argvOverrides, isDesktop]);

  // The most recent 'check' entry drives completion; earlier ones (from a
  // prior Check Answer click) are history, not the gate.
  const latestCheck = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e.kind === 'check') return e;
    }
    return null;
  }, [entries]);

  const structuralPassed = latestCheck?.structural.every((r) => r.passed) ?? false;
  // AI review gates completion, but never blocks it when unavailable (no
  // model, web build, error); otherwise it'd brick lessons outright.
  const aiGate =
    !latestCheck || latestCheck.ai === 'unavailable' || latestCheck.ai === 'error'
      ? true
      : latestCheck.ai === 'done'
        ? PASSING_MATCH_STATUSES.has(latestCheck.aiVerdict ?? 'wrong')
        : false;
  const hasTests = data.tests.length > 0;
  const hasQuestions = (data.questions?.length ?? 0) > 0;
  const codeCheckPassed = hasTests ? structuralPassed && aiGate : true;
  const allPassed = codeCheckPassed && (!hasQuestions || questionsCorrect);
  const blockedReason =
    hasQuestions && hasTests
      ? 'Pass the code check and answer the questions to continue'
      : hasQuestions
        ? 'Answer the questions to continue'
        : 'Pass the code check to continue';

  // Subscribed for the workspace's lifetime (not just while checking) so a
  // review that's still running when the user navigates away is ignored
  // cleanly rather than updating a stale entry.
  useEffect(() => {
    const off = window.academy?.chat?.onVerifyResult?.((payload) => {
      const pending = pendingVerifyRef.current;
      if (!pending || pending.requestId !== payload.requestId) return;
      pendingVerifyRef.current = null;
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== pending.entryId || e.kind !== 'check') return e;
          if (payload.error || !payload.result) {
            return { ...e, ai: 'error', aiError: payload.error ?? 'AI review failed.' };
          }
          return { ...e, ai: 'done', aiVerdict: payload.result.verdict, aiReason: payload.result.reason };
        }),
      );
    });
    return () => {
      off?.();
    };
  }, []);

  // Section = the chapter. The modal only fires on the last lesson of a chapter.
  const isLastLessonOfChapter =
    !!data.currentChapter &&
    !!data.currentLesson &&
    data.currentChapter.lessons.at(-1)?.num === data.currentLesson.num;

  const markLessonComplete = useUserStore((s) => s.markLessonComplete);

  useEffect(() => {
    if (!allPassed || !data.currentChapter || !data.currentLesson) return;
    // Deduped in the store, so re-runs on the same lesson are no-ops.
    markLessonComplete(data.currentChapter.slug, data.currentLesson.slug);
    // Best-effort mirror to the host's progress blob (desktop only); the
    // local store stays the source of truth for UI if this fails.
    if (typeof window !== 'undefined' && window.academy?.identity?.setProgress) {
      const chapterSlug = data.currentChapter.slug;
      const lessonSlug = data.currentLesson.slug;
      const lessonKey = `${chapterSlug}-${lessonSlug}`;
      void (async () => {
        let hostProgress: Record<string, unknown> = {};
        try {
          const cur = await window.academy!.identity!.getProgress();
          if (cur?.progress && typeof cur.progress === 'object') {
            hostProgress = cur.progress as Record<string, unknown>;
          }
        } catch {
        }
        const next = {
          ...hostProgress,
          [lessonKey]: { completedAt: Date.now() },
        };
        try {
          await window.academy!.identity!.setProgress({ progress: next });
        } catch {
        }
      })();
    }
    if (isLastLessonOfChapter) {
      // Don't auto-pop the celebration modal; let the reader check the run
      // first. The Next button shows it on click, and a small badge on the
      // run output flags that the chapter is done.
      setChapterReady(true);
    }
  }, [
    allPassed,
    isLastLessonOfChapter,
    data.currentChapter,
    data.currentLesson,
    markLessonComplete,
  ]);

  const check = useCallback(() => {
    // A second click while one's already loading orphaned the first entry.
    if (latestCheck?.ai === 'loading') return;
    const structural = runTests(userCode, data.tests).map((r) => ({
      id: r.id,
      description: r.description,
      passed: r.passed,
    }));
    const entryId = crypto.randomUUID();
    setEntries((prev) => [...prev, { kind: 'check', id: entryId, structural, ai: 'idle' }]);

    // Only worth a semantic review once the cheap structural checks already
    // pass. That's the case that can currently go green while being wrong.
    if (!structural.every((r) => r.passed)) return;

    // A formatting-only match is real; skip the AI call entirely for it.
    const hasAnswer = typeof data.answer === 'string' && data.answer.length > 0;
    if (hasAnswer && normalizeLessonCode(userCode) === normalizeLessonCode(data.answer)) {
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId && e.kind === 'check' ? { ...e, ai: 'done', aiVerdict: 'match', aiReason: '' } : e)),
      );
      return;
    }

    // A leftover numbered TODO is a free, reliable "unfinished" signal even
    // when the structural checks above only cover an earlier TODO.
    if (/^\s*\/\/\s*\d+:/m.test(userCode)) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId && e.kind === 'check'
            ? {
                ...e,
                ai: 'done',
                aiVerdict: 'unfinished',
                aiReason: "There's still a numbered TODO comment in the code.",
              }
            : e,
        ),
      );
      return;
    }

    const canVerify = isDesktop && typeof window !== 'undefined' && !!window.academy?.chat;
    if (!canVerify) {
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId && e.kind === 'check' ? { ...e, ai: 'unavailable' } : e)),
      );
      return;
    }
    setEntries((prev) => prev.map((e) => (e.id === entryId && e.kind === 'check' ? { ...e, ai: 'loading' } : e)));

    // Cancel any review still running from a previous Check Answer click.
    if (pendingVerifyRef.current) {
      void window.academy?.chat?.stop?.(pendingVerifyRef.current.requestId).catch(() => undefined);
      pendingVerifyRef.current = null;
    }

    void (async () => {
      try {
        const { requestId } = await window.academy!.chat!.verify({
          code: userCode,
          tests: data.tests.map((t) => ({ id: t.id, description: t.description })),
          lessonKey:
            data.currentChapter && data.currentLesson
              ? { chapter: data.currentChapter.slug, lesson: data.currentLesson.slug }
              : null,
          lessonReference: data.lessonReference,
          answer: data.answer || undefined,
        });
        pendingVerifyRef.current = { requestId, entryId };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not reach the local model.';
        setEntries((prev) =>
          prev.map((e) => (e.id === entryId && e.kind === 'check' ? { ...e, ai: 'error', aiError: message } : e)),
        );
      }
    })();
  }, [
    userCode,
    data.tests,
    data.currentChapter,
    data.currentLesson,
    data.lessonReference,
    data.answer,
    isDesktop,
    latestCheck,
  ]);

  const stopCheck = useCallback((entryId: string) => {
    const pending = pendingVerifyRef.current;
    if (!pending || pending.entryId !== entryId) return;
    void window.academy?.chat?.stop?.(pending.requestId).catch(() => undefined);
    pendingVerifyRef.current = null;
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId && e.kind === 'check' ? { ...e, ai: 'error', aiError: 'Stopped.' } : e)),
    );
  }, []);

  // Advisory only; null (unavailable/timeout/error) is treated as 'clean'.
  // The receiving device's own scan is the actual gate.
  const awaitSecurityScan = useCallback(
    async (code: string): Promise<ChatSecurityResult | null> => {
      if (typeof window === 'undefined' || !window.academy?.chat?.securityScan || !window.academy.chat.onSecurityResult) {
        return null;
      }
      const chatApi = window.academy.chat;
      return new Promise<ChatSecurityResult | null>((resolve) => {
        let settled = false;
        // Subscribed before the call, not inside its .then: a review that
        // answers without loading a model emits its result before the
        // requestId crosses the bridge, and a later listener misses it and
        // waits out the timeout below with the run held up behind it.
        let requestId: string | null = null;
        let early: { requestId: string; error: string | null; result: ChatSecurityResult | null } | null = null;
        const timer = setTimeout(() => settle(null), 20_000);
        const off = chatApi.onSecurityResult((payload) => {
          if (requestId === null) {
            early = payload;
            return;
          }
          if (payload.requestId !== requestId) return;
          settle(payload.error ? null : payload.result);
        });
        function settle(value: ChatSecurityResult | null) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          off?.();
          resolve(value);
        }
        chatApi
          .securityScan({
            code,
            lessonKey:
              data.currentChapter && data.currentLesson
                ? { chapter: data.currentChapter.slug, lesson: data.currentLesson.slug }
                : null,
            lessonReference: data.lessonReference,
          })
          .then(({ requestId: id }) => {
            requestId = id;
            if (early && early.requestId === id) settle(early.error ? null : early.result);
          })
          .catch(() => settle(null));
      });
    },
    [data.currentChapter, data.currentLesson, data.lessonReference],
  );

  const run = useCallback(async () => {
    const runEntryId = crypto.randomUUID();
    // Null when this isn't a resolved remote run (this-device, or remote
    // with no device picked yet). RunCard reads that as "this device".
    const targetPeer =
      runMode === 'remote' && selectedPeerId
        ? realRemotePeers.find((p) => p.discoveryKey === selectedPeerId)
        : undefined;
    const deviceLabel = targetPeer ? peerDisplayName(targetPeer) : null;
    setEntries((prev) => [
      ...prev,
      { kind: 'run', id: runEntryId, lines: [], status: 'running', deviceLabel },
    ]);
    const finalizeRunEntry = (lines: OutputLine[], status: 'ok' | 'err' | 'stopped') => {
      setEntries((prev) =>
        prev.map((e) => (e.id === runEntryId && e.kind === 'run' ? { ...e, lines, status } : e)),
      );
    };

    // Whitespace-normalized, not a leftover-TODO heuristic: finishing TODO 1
    // but not 2 is a real change even with boilerplate still present.
    const unchangedFromStarter = normalizeLessonCode(userCode) === normalizeLessonCode(data.startingCode);
    if (unchangedFromStarter) {
      finalizeRunEntry(
        [
          { stream: 'stdout', line: 'Looks like you haven\u2019t made any changes yet.' },
          {
            stream: 'stdout',
            line: 'The starting code has numbered TODOs. Follow the lesson to write the code for each one, then click Run again.',
          },
        ],
        'ok',
      );
      return;
    }

    if (runMode === 'remote') {
      if (data.pairedMode === false) {
        finalizeRunEntry(
          [
            {
              stream: 'stdout',
              line: '[paired] This lesson serves a port on the machine it runs on, which a paired device cannot reach. Switch the picker to This device.',
            },
          ],
          'ok',
        );
        return;
      }
      if (realRemotePeers.length === 0) {
        const lines: OutputLine[] = localIsOnlyHost
          ? [
              {
                stream: 'stdout',
                line: "[paired] This device is the host in every pair. Hosts accept runs from guests; they don't forward them.",
              },
              {
                stream: 'stdout',
                line: 'Pair a second device and have it accept the invite (or `pnpm dev:host` in another terminal), then come back.',
              },
            ]
          : selfPairCount > 0
            ? [
                {
                  stream: 'stdout',
                  line: "[paired] The only paired device is this device. Two app instances sharing a userData directory end up paired as the same identity, but the exec channel can't route between matching keys.",
                },
                {
                  stream: 'stdout',
                  line: 'Run `pnpm --filter @p2p-academy/desktop dev:host` in a second terminal to launch an isolated host, then pair it from Settings > Devices.',
                },
              ]
            : [
                {
                  stream: 'stdout',
                  line: '[paired] No paired devices. Open Settings to pair one, then come back.',
                },
              ];
        finalizeRunEntry(lines, 'ok');
        return;
      }
      if (!selectedPeerId) {
        finalizeRunEntry(
          [
            {
              stream: 'stdout',
              line: '[paired] Pick a paired device from the picker next to Run, then click Run again.',
            },
          ],
          'ok',
        );
        return;
      }
      // Remote run: same downstream path as this-device, with peerId set below.
    }

    const canRunForReal =
      (runMode === 'this-device' || (runMode === 'remote' && !!selectedPeerId)) &&
      typeof window !== 'undefined' &&
      window.academy?.run;

    const resolvedArgv = await resolveArgv();

    // The "no output produced" fallback below reads this, not a stale state read.
    let producedOutput: OutputLine[] = [];
    let runStatus: 'ok' | 'err' | 'stopped' = 'ok';

    if (canRunForReal) {
      setIsAnimating(true);
      setStopRequested(false);
      const runStartedAt = Date.now();
      const isRemoteRun = runMode === 'remote' && !!selectedPeerId;
      if (isRemoteRun && selectedPeerId) {
        setLastRemoteRun({ kind: 'running', peerId: selectedPeerId, startedAt: runStartedAt });
      }
      // Streamed as chunks arrive so 30-60s finetune runs don't look frozen.
      const streamBuffer: OutputLine[] = [];

      // Fed through the same path a real chunk takes, so the review reads as a
      // stage on the rail. Trailing newline included: without it the next real
      // chunk merges into this line instead of starting its own.
      const noteStage = (line: string) => {
        const chunk = { stream: 'stderr' as const, data: `${line}\n` };
        streamBuffer.splice(0, streamBuffer.length, ...appendChunkLines(streamBuffer, chunk));
        setEntries((prev) =>
          prev.map((e) =>
            e.id === runEntryId && e.kind === 'run' ? { ...e, lines: appendChunkLines(e.lines, chunk) } : e,
          ),
        );
      };

      // Advisory only; the paired device runs its own authoritative scan.
      if (isRemoteRun) {
        // Nothing reaches the peer until this answers, so without a row of its
        // own the panel sat empty and then filled all at once.
        noteStage('→ Reviewing the code on this device...');
        const reviewStartedAt = Date.now();
        const scan = await awaitSecurityScan(userCode);
        const reviewSecs = (Date.now() - reviewStartedAt) / 1000;
        noteStage(`  ✓ Reviewed on this device${reviewSecs >= 1 ? ` (${reviewSecs.toFixed(1)}s)` : ''}`);
        if (scan?.verdict === 'malicious') {
          const lines: OutputLine[] = [
            ...streamBuffer,
            { stream: 'stderr', line: '[security] This code was not sent to the paired device.' },
            ...scan.concerns.map((c) => ({ stream: 'stderr' as const, line: `  - ${c.summary}` })),
            { stream: 'stdout', line: 'Edit the code to remove the flagged content, then click Run again.' },
          ];
          finalizeRunEntry(lines, 'err');
          if (selectedPeerId) {
            setLastRemoteRun({
              kind: 'err',
              peerId: selectedPeerId,
              startedAt: runStartedAt,
              endedAt: Date.now(),
              code: null,
              signal: null,
              message: 'blocked by security review',
            });
          }
          setIsAnimating(false);
          return;
        }
        // 'suspicious' doesn't warn here either; only 'malicious' above is reliable.
      }

      const captured = new Set<string>();
      const scanForCaptures = (text: string) => {
        if (!isDesktop || !text) return;
        for (const { pattern, target } of CAPTURE_MARKERS) {
          if (captured.has(target)) continue;
          const m = text.match(pattern);
          if (m && m[1]) {
            captured.add(target);
            const value = m[1];
            void window.academy?.state?.set(capturedKey(target), value);
            setArgvCaptured((prev) => ({ ...prev, [target]: value }));
            void window.academy?.stop?.();
          }
        }
      };
      const unsubscribe = window.academy?.onRunChunk?.((chunk) => {
        streamBuffer.splice(0, streamBuffer.length, ...appendChunkLines(streamBuffer, chunk));
        setEntries((prev) =>
          prev.map((e) => (e.id === runEntryId && e.kind === 'run' ? { ...e, lines: appendChunkLines(e.lines, chunk) } : e)),
        );
        if (chunk.stream === 'stdout') scanForCaptures(chunk.data);
      });
      try {
        const result = await window.academy?.run({
          source: userCode,
          language: 'typescript',
          argv: resolvedArgv,
          fileName: runFileName(data),
          label: runLabel(data),
          ...(isRemoteRun && selectedPeerId ? { peerId: selectedPeerId } : {}),
        });
        if (!result) {
          producedOutput = [
            ...streamBuffer,
            { stream: 'stdout', line: '[error] no run result returned' },
          ];
          runStatus = 'err';
          if (isRemoteRun && selectedPeerId) {
            setLastRemoteRun({
              kind: 'err',
              peerId: selectedPeerId,
              startedAt: runStartedAt,
              endedAt: Date.now(),
              code: null,
              signal: null,
              message: 'no result returned from peer',
            });
          }
        } else if (result.ok) {
          producedOutput = streamBuffer;
          if (isRemoteRun && selectedPeerId) {
            setLastRemoteRun({
              kind: 'ok',
              peerId: selectedPeerId,
              startedAt: runStartedAt,
              endedAt: Date.now(),
            });
          }
        } else {
          // A native abort kills the child without printing anything, so the signal is all the student has to go on.
          // A user-initiated Stop should not look like a crash; the host flags `stopRequested` on the result when
          // the abort came from `academy:stop` rather than an actual non-zero exit.
          const note = result.stopRequested
            ? '[stopped]'
            : result.remoteExit?.signal
              ? `[stopped by ${result.remoteExit.signal}]`
              : '[exit non-zero]';
          const tail = unstreamed(result.output ?? '', streamBuffer) || note;
          producedOutput = [...streamBuffer, { stream: 'stdout', line: tail }];
          runStatus = result.stopRequested ? 'stopped' : 'err';
          if (isRemoteRun && selectedPeerId) {
            setLastRemoteRun({
              kind: 'err',
              peerId: selectedPeerId,
              startedAt: runStartedAt,
              endedAt: Date.now(),
              code: result.remoteExit?.code ?? null,
              signal: result.remoteExit?.signal ?? null,
              message: note.split('\n').pop() ?? null,
            });
          }
        }
        // In case a marker was split across chunk boundaries.
        scanForCaptures(result?.output ?? '');
      } catch (err) {
        producedOutput = [
          ...streamBuffer,
          {
            stream: 'stdout',
            line: `[error] ${err instanceof Error ? err.message : String(err)}`,
          },
        ];
        runStatus = 'err';
        if (isRemoteRun && selectedPeerId) {
          setLastRemoteRun({
            kind: 'err',
            peerId: selectedPeerId,
            startedAt: runStartedAt,
            endedAt: Date.now(),
            code: null,
            signal: null,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        unsubscribe?.();
        setIsAnimating(false);
        setStopRequested(false);
      }
    } else {
      // Simulated mode, or this-device on the web where the academy bridge isn't available.
      setIsAnimating(true);
      await delay(900);
      producedOutput = data.expectedOutput.map((line) => ({ stream: 'stdout', line }));
      if (
        (runMode === 'this-device' || runMode === 'remote') &&
        typeof window !== 'undefined' &&
        !window.academy?.run
      ) {
        producedOutput = [
          ...producedOutput,
          { stream: 'stdout', line: '' },
          { stream: 'stdout', line: '[hint] Open in the desktop app to run this code for real.' },
        ];
      }
      setIsAnimating(false);
    }

    // Fall back to test results so the panel isn't blank when the run produces nothing.
    if (producedOutput.length === 0 && data.tests.length > 0) {
      const results = runTests(userCode, data.tests);
      const allPassed = results.every((r) => r.passed);
      const summary = results.map((r) =>
        r.passed ? `  \u2713 ${r.description}` : `  \u2717 ${r.description}`,
      );
      producedOutput = [
        {
          stream: 'stdout',
          line: allPassed
            ? "No output produced by the run, even though the checks below matched. These checks only cover part of the lesson. The code that would actually produce output is probably still missing or unreachable."
            : 'No output produced by the run. The checks below tell you which part is missing:',
        },
        // A blank line between items keeps OutputView's paragraph mode from space-joining them.
        ...summary.flatMap((line) => [{ stream: 'stdout' as const, line: '' }, { stream: 'stdout' as const, line }]),
      ];
    }

    finalizeRunEntry(producedOutput, runStatus);
  }, [
    runMode,
    userCode,
    data.expectedOutput,
    data.tests,
    data.readOnly,
    data.pairedMode,
    resolveArgv,
    isDesktop,
    check,
    realRemotePeers,
    selfPairCount,
    localIsOnlyHost,
    selectedPeerId,
    awaitSecurityScan,
  ]);

  const reset = useCallback(() => {
    setUserCode(data.startingCode);
    setEntries([]);
  }, [data.startingCode]);

  const stopRun = useCallback(() => {
    if (!isAnimating) return;
    setStopRequested(true);
    void window.academy?.stop?.();
  }, [isAnimating]);

  // The chevrons' shortcut. Anywhere a key means something else (the editor,
  // the chat box, the completion modal) the arrow belongs to that, not here.
  const router = useRouter();

  // A run still downloading its model keeps going after the page changes and
  // holds the registry lock, so leaving asks first and stops it on yes.
  const downloading = useMemo(() => {
    if (!isAnimating) return false;
    const run = entries.findLast((e) => e.kind === 'run');
    if (run?.kind !== 'run' || run.status !== 'running') return false;
    const progress = parseProgress(run.lines);
    return progress?.label === 'Downloading a model' && !progress.completed;
  }, [entries, isAnimating]);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const navigate = useCallback(
    (href: string) => (downloading ? setLeaveTo(href) : router.push(href)),
    [downloading, router],
  );
  useEffect(() => {
    if (!downloading) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank') return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [downloading]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (showCompleteModal) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"], .monaco-editor')) return;
      const href = e.key === 'ArrowLeft' ? data.prevUrl : allPassed ? data.nextUrl : undefined;
      if (!href) return;
      e.preventDefault();
      navigate(href);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate, data.prevUrl, data.nextUrl, allPassed, showCompleteModal]);

  // A lesson is exactly one viewport, the editor and console its only scroll
  // regions. Narrow layouts still scroll as a page, so the rule is a media
  // query in global.css rather than a style set from here.
  const isLessonPage = !!data.currentLesson;
  useEffect(() => {
    if (!isLessonPage) return;
    document.documentElement.classList.add('lesson-viewport');
    return () => document.documentElement.classList.remove('lesson-viewport');
  }, [isLessonPage]);

  return (
    <div className="workspace-root flex w-full flex-col lg:h-[calc(100vh-3.5rem)]">
      <div
        className={`workspace-row flex min-h-0 flex-col gap-4 overflow-x-auto px-4 pt-4 sm:px-6 sm:pt-6 lg:flex-1 lg:flex-row lg:gap-6 lg:overflow-hidden lg:pb-0 lg:overflow-x-hidden ${
          data.currentLesson ? 'pb-4' : 'pb-24'
        }`}
      >
        <section className="workspace-sidebar min-w-0 lg:max-w-[42%] lg:min-w-[360px] lg:flex-shrink-0 lg:h-full lg:overflow-y-auto lg:pb-[9px] lg:pr-2">
          <CurriculumStrip
            chapter={data.currentChapter}
            currentLesson={data.currentLesson}
            prevUrl={data.prevUrl}
            nextUrl={data.nextUrl}
            nextBlockedReason={allPassed ? undefined : blockedReason}
            onFinish={chapterReady ? () => setShowCompleteModal(true) : undefined}
            finishLabel={data.nextUrl ? 'Finish chapter' : 'Course complete'}
          />

          <header className="mb-5">
            <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-canvas-foreground sm:text-4xl">
              {data.title}
            </h1>
            {data.description ? (
              <p className="text-base leading-relaxed text-canvas-muted-foreground sm:text-lg">
                {data.description}
              </p>
            ) : null}
            {data.sourceExample ? (
              <a
                href={`https://github.com/tetherto/qvac/blob/main/${data.sourceExample}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-mono text-emerald-400 hover:text-emerald-300"
              >
                <span>Example on GitHub</span>
                <span aria-hidden>↗</span>
                <span className="text-canvas-muted-foreground">({data.sourceExample})</span>
              </a>
            ) : null}
          </header>

          <div className="prose-md">{children}</div>

          {data.questions && data.questions.length > 0 ? (
            <QuestionCheck questions={data.questions} onAllCorrectChange={setQuestionsCorrect} />
          ) : null}
        </section>

        <section className="workspace-runner-section flex min-h-[560px] flex-col pb-[9px] lg:h-full lg:min-h-0 lg:flex-1 lg:min-w-[640px]">
          <Runner
            userCode={userCode}
            setUserCode={setUserCode}
            platform={platform}
            setPlatform={setPlatform}
            runMode={runMode}
            setRunMode={setRunMode}
            isDesktop={isDesktop}
            entries={entries}
            onStopCheck={stopCheck}
            isAnimating={isAnimating}
            onRun={run}
            onStop={stopRun}
            stopRequested={stopRequested}
            onCheck={check}
            checkDisabled={data.tests.length === 0 || latestCheck?.ai === 'loading'}
            onReset={reset}
            platforms={data.platforms}
            pairedMode={data.pairedMode}
            requirements={data.requirements}
            readOnly={data.readOnly}
            hints={data.hints}
            answer={data.answer}
            argv={data.argv}
            argvOverrides={argvOverrides}
            argvCaptured={argvCaptured}
            onArgvOverrideValue={setArgvOverrideValue}
            onArgvOverrideStart={startArgvOverride}
            onArgvOverrideClear={clearArgvOverride}
            remotePeers={realRemotePeers}
            selectedPeerId={selectedPeerId}
            setSelectedPeerId={setSelectedPeerId}
            selfPairCount={selfPairCount}
            localIsOnlyHost={localIsOnlyHost}
            lastRemoteRun={lastRemoteRun}
            clearLastRemoteRun={() => setLastRemoteRun(null)}
            footer={
              data.currentLesson ? (
                data.readOnly ? (
                  <p className="py-1 text-center text-sm text-canvas-muted-foreground">
                    No code in this section
                  </p>
                ) : (
                  <ChatInputBar
                    entries={entries}
                    setEntries={setEntries}
                    lessonContext={
                      data.currentChapter
                        ? {
                            chapter: data.currentChapter.slug,
                            lesson: data.currentLesson.slug,
                            title: data.currentLesson.title,
                            reference: data.lessonReference,
                          }
                        : null
                    }
                    readOnly={data.readOnly}
                  />
                )
              ) : undefined
            }
          />
        </section>
      </div>

      {/* Only a chapter landing page still needs a row of its own: on a lesson
          the chat is docked in the runner column and navigation is on the
          stepper, so the page ends at the workspace. */}
      {data.currentChapter && !data.currentLesson ? (
        <nav className="sticky bottom-0 z-10 shrink-0 border-t border-canvas-border bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/85 lg:static">
          <div className="flex items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:py-3.5">
            {data.firstLessonHref ? (
              <Link
                href={data.firstLessonHref}
                className="mx-auto inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-emerald-400"
              >
                <span>Start Lesson 1</span>
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <span className="mx-auto inline-flex items-center gap-1.5 rounded-md bg-canvas-muted px-4 py-2 text-sm font-medium text-canvas-muted-foreground">
                No lessons shipped yet
              </span>
            )}
          </div>
        </nav>
      ) : null}

      {leaveTo ? (
        <Overlay onClose={() => setLeaveTo(null)}>
          <div
            role="dialog"
            aria-label="Leave this lesson"
            className="w-full max-w-sm rounded-xl border border-canvas-border bg-canvas-muted p-5 shadow-2xl"
          >
            <p className="text-sm text-canvas-foreground">
              You're leaving this lesson. This will cancel the current download. Proceed?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLeaveTo(null)}
                className="rounded-md border border-canvas-border px-3 py-1.5 text-sm text-canvas-muted-foreground hover:text-canvas-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const href = leaveTo;
                  setLeaveTo(null);
                  stopRun();
                  router.push(href);
                }}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-400 hover:bg-emerald-500/20"
              >
                Yes, leave
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}

      <LessonCompleteModal
        open={showCompleteModal}
        lessonTitle={data.title}
        chapterLabel={data.currentChapter?.label}
        chapterNum={data.currentChapter?.num}
        chapterLessonCount={data.currentChapter?.lessons.length}
        nextUrl={data.nextUrl}
        courseUrl={`/courses`}
        onClose={() => setShowCompleteModal(false)}
      />
    </div>
  );
}
