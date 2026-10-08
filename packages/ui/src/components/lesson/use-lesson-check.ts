import { normalizeLessonCode } from '@academy/validation/lesson-code';
import { type Dispatch, type RefObject, type SetStateAction, useCallback, useEffect, useMemo } from 'react';
import type { ConsoleEntry } from './console-types.js';
import type { LessonData } from './lesson-types.js';
import { PASSING_MATCH_STATUSES, runTests } from './run-helpers.js';
import '../../lib/academy.js';

/** The AI review a Check Answer click started: which request, and the console entry it fills in. */
export type PendingVerify = { requestId: string; entryId: string } | null;

/** Check Answer: the quick structural checks, then the AI review on the desktop app, and
 *  whether the latest check passed. */
export function useLessonCheck({
  data,
  userCode,
  isDesktop,
  entries,
  setEntries,
  pendingVerifyRef,
}: {
  data: LessonData;
  userCode: string;
  isDesktop: boolean;
  entries: ConsoleEntry[];
  setEntries: Dispatch<SetStateAction<ConsoleEntry[]>>;
  pendingVerifyRef: RefObject<PendingVerify>;
}) {
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

  return { latestCheck, structuralPassed, aiGate, check, stopCheck };
}
