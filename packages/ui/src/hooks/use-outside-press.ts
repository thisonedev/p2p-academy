import { type RefObject, useEffect, useRef } from 'react';

type Target = RefObject<Element | null>;

/** Runs `onOutside` on a mouse press that lands outside every given element, while `active`.
 *  `capture` hears the press before the page does, for use over a canvas that stops it. */
export function useOutsidePress(
  targets: Target | Target[],
  onOutside: () => void,
  { active = true, capture = false }: { active?: boolean; capture?: boolean } = {},
): void {
  const latest = useRef({ targets, onOutside });
  latest.current = { targets, onOutside };
  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent) => {
      const { targets: now, onOutside: run } = latest.current;
      const inside = [now].flat().some((t) => e.target instanceof Node && t.current?.contains(e.target));
      if (!inside) run();
    };
    document.addEventListener('mousedown', onDown, capture);
    return () => document.removeEventListener('mousedown', onDown, capture);
  }, [active, capture]);
}
