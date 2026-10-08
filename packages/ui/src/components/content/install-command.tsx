'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { copyText, scrubClipboardLater } from '../../lib/clipboard.js';

interface CopyButtonProps {
  command: string;
  className?: string;
}

/**
 * Small icon-only copy button with "Copied" feedback. Copies to the system
 * clipboard and scrubs after a delay so the command does not linger in the
 * paste buffer after the user has run it.
 */
export function CopyButton({ command, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(id);
  }, [copied]);

  const onCopy = async () => {
    try {
      const scrub = !!navigator.clipboard?.writeText;
      await copyText(command);
      setCopied(true);
      if (scrub) scrubClipboardLater(command);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? 'Copied' : 'Copy install command'}
      title={copied ? 'Copied' : 'Copy'}
      className={`inline-flex shrink-0 items-center justify-center rounded border border-canvas-border bg-canvas-muted p-1.5 text-canvas-foreground transition-colors hover:border-emerald-500/40 hover:text-emerald-400 ${className ?? ''}`}
    >
      {copied ? <Check className="size-3.5" strokeWidth={2.5} /> : <Copy className="size-3.5" />}
    </button>
  );
}
