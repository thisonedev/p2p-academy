'use client';

import { Check, Copy } from 'lucide-react';
import { type HTMLAttributes, useCallback, useRef, useState } from 'react';
import { copyText } from '../../lib/clipboard.js';
import { useFlash } from '../../hooks/use-flash.js';

type RehypePreProps = HTMLAttributes<HTMLPreElement> & {
  // rehype-pretty-code attaches a stringified SVG for the language icon.
  icon?: string;
};

/** Custom MDX `pre` override: wraps the shiki-highlighted code in a figure
 *  with a visible copy button, matching the right-side editor's UX. */
export function MdxPre({
  className,
  style,
  tabIndex,
  icon: _icon,
  children,
  ...rest
}: RehypePreProps) {
  const [copied, flashCopied] = useFlash<true>();
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = useCallback(async () => {
    const node = preRef.current;
    if (!node) return;
    const code = node.textContent ?? '';
    try {
      await copyText(code);
      flashCopied(true);
    } catch {
      // No-op: visual feedback just won't fire.
    }
  }, []);

  return (
    <figure className="mdx-code-figure relative my-5 rounded-lg border border-canvas-border bg-canvas not-prose">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy code'}
        title={copied ? 'Copied!' : 'Copy code'}
        className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas/80 px-2 py-1 text-xs font-medium backdrop-blur transition-colors ${
          copied
            ? 'border-emerald-500/60 text-emerald-400'
            : 'text-canvas-muted-foreground hover:bg-canvas-muted hover:text-canvas-foreground'
        }`}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      <pre
        ref={preRef}
        className={`mdx-code-pre overflow-x-auto text-sm leading-relaxed ${className ?? ''}`}
        style={style}
        tabIndex={tabIndex}
        {...rest}
      >
        {children}
      </pre>
    </figure>
  );
}
