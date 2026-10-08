import { useEffect, useRef } from 'react';

/** Runs `onEscape` when the Escape key is pressed anywhere on the page, while `active`. */
export function useEscape(onEscape: () => void, active = true): void {
  const latest = useRef(onEscape);
  latest.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latest.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
}
