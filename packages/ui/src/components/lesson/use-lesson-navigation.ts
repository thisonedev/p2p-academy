import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ConsoleEntry } from './console-types.js';
import type { LessonData } from './lesson-types.js';
import { parseProgress } from './progress.js';

/** Moving between lessons: the arrow keys, and asking before leaving while a run is still
 *  downloading its model. */
export function useLessonNavigation({
  data,
  entries,
  isAnimating,
  allPassed,
  showCompleteModal,
}: {
  data: Pick<LessonData, 'prevUrl' | 'nextUrl'>;
  entries: ConsoleEntry[];
  isAnimating: boolean;
  allPassed: boolean;
  showCompleteModal: boolean;
}) {
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

  return { router, leaveTo, setLeaveTo, navigate };
}
