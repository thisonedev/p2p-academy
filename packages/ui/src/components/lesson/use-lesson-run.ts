import { normalizeLessonCode } from '@academy/validation/lesson-code';
import type { ChatSecurityResult } from '@academy/validation';
import { type Dispatch, type SetStateAction, useCallback, useState } from 'react';
import type { ConsoleEntry } from './console-types.js';
import type { LessonData, OutputLine } from './lesson-types.js';
import {
  CAPTURE_MARKERS,
  appendChunkLines,
  capturedKey,
  delay,
  peerDisplayName,
  runFileName,
  runLabel,
  runTests,
  unstreamed,
  type RunMode,
} from './run-helpers.js';
import type { PairedPeers } from './use-paired-peers.js';
import '../../lib/academy.js';

/** Run and Stop: on this device, on a paired one, or the simulated output on the web. Writes
 *  the run's lines into its console entry as they come in. */
export function useLessonRun({
  data,
  userCode,
  runMode,
  isDesktop,
  peers,
  resolveArgv,
  setArgvCaptured,
  setEntries,
  check,
}: {
  data: LessonData;
  userCode: string;
  runMode: RunMode;
  isDesktop: boolean;
  peers: PairedPeers;
  resolveArgv: () => Promise<string[]>;
  setArgvCaptured: Dispatch<SetStateAction<Record<string, string>>>;
  setEntries: Dispatch<SetStateAction<ConsoleEntry[]>>;
  check: () => void;
}) {
  const { realRemotePeers, selfPairCount, localIsOnlyHost, selectedPeerId } = peers;
  const [isAnimating, setIsAnimating] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
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

  const stopRun = useCallback(() => {
    if (!isAnimating) return;
    setStopRequested(true);
    void window.academy?.stop?.();
  }, [isAnimating]);

  return { run, stopRun, isAnimating, stopRequested, lastRemoteRun, setLastRemoteRun };
}
