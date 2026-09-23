'use client';

import { Info } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const WIDTH = 224;

/** A small "i" beside a label: hover or click it for the explanation, instead of a paragraph under every control.
 *  The bubble is portaled and fixed-positioned, so a scrolling panel or popup never clips it. */
export function InfoHint({ text, label = 'What is this?' }: { text: string; label?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setPos({ left: Math.max(8, Math.min(rect.left, window.innerWidth - WIDTH - 8)), top: rect.bottom + 6 });
  };
  const hide = () => setPos(null);
  return (
    <span className="ml-1 inline-flex align-middle" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-expanded={pos !== null}
        onClick={() => (pos ? hide() : show())}
        onBlur={hide}
        className="text-canvas-muted-foreground hover:text-canvas-foreground"
      >
        <Info className="size-3" />
      </button>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ left: pos.left, top: pos.top, width: WIDTH }}
            className="pointer-events-none fixed z-[80] rounded-md border border-canvas-border bg-canvas-raised p-2 font-mono text-[11px] font-normal normal-case leading-relaxed tracking-normal text-canvas-foreground shadow-xl"
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
