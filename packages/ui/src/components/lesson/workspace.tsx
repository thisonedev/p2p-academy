'use client';

import { PRODUCTS } from '@academy/constants';
import { useUserStore } from '@academy/core';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import {
  type ReactNode,
  useLayoutEffect,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { CurriculumStrip } from '../course/curriculum-strip.js';
import { LessonCompleteModal } from './complete-modal.js';
import { QuestionCheck } from './question-check.js';
import { ChatInputBar } from './chat-input-bar.js';
import type { ConsoleEntry } from './console-types.js';
import { Overlay } from '../ui/overlay.js';
import type { LessonData } from './lesson-types.js';
import type { RunMode } from './run-helpers.js';
import { Runner } from './runner.js';
import { useArgvSlots } from './use-argv-slots.js';
import { useLessonCheck, type PendingVerify } from './use-lesson-check.js';
import { useLessonNavigation } from './use-lesson-navigation.js';
import { useLessonRun } from './use-lesson-run.js';
import { usePairedPeers } from './use-paired-peers.js';
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
  const [runMode, setRunMode] = useState<RunMode>('simulated');
  const peers = usePairedPeers(isDesktop, runMode);
  const { realRemotePeers, selfPairCount, localIsOnlyHost, selectedPeerId, setSelectedPeerId } = peers;
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  // Tracks the AI verify call the most recent Check Answer kicked off, so a
  // later click can cancel a still-running review instead of leaving it
  // orphaned, and so onVerifyResult knows which entry to update.
  const pendingVerifyRef = useRef<PendingVerify>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [chapterReady, setChapterReady] = useState(false);

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

  const {
    argvOverrides,
    argvCaptured,
    setArgvCaptured,
    setArgvOverrideValue,
    startArgvOverride,
    clearArgvOverride,
    resolveArgv,
  } = useArgvSlots(data, isDesktop);

  const { latestCheck, structuralPassed, aiGate, check, stopCheck } = useLessonCheck({
    data,
    userCode,
    isDesktop,
    entries,
    setEntries,
    pendingVerifyRef,
  });
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

  const { run, stopRun, isAnimating, stopRequested, lastRemoteRun, setLastRemoteRun } = useLessonRun({
    data,
    userCode,
    runMode,
    isDesktop,
    peers,
    resolveArgv,
    setArgvCaptured,
    setEntries,
    check,
  });

  const reset = useCallback(() => {
    setUserCode(data.startingCode);
    setEntries([]);
  }, [data.startingCode]);

  const { router, leaveTo, setLeaveTo } = useLessonNavigation({
    data,
    entries,
    isAnimating,
    allPassed,
    showCompleteModal,
  });

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
                className="mt-2 inline-flex items-center gap-1 text-xs font-mono text-primary hover:text-primary-soft"
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
                className="mx-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-primary"
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
                className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/20"
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
        courseUrl={PRODUCTS.academy.href}
        onClose={() => setShowCompleteModal(false)}
      />
    </div>
  );
}
