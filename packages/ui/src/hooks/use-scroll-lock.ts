import { useEffect } from 'react';

/** Stops the page behind a dialog from scrolling, while `active`. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [active]);
}
