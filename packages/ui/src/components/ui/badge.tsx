import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

const TONES = {
  emerald: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  sky: 'bg-sky-500/15 text-sky-400 ring-sky-500/30',
  amber: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone: keyof typeof TONES;
}

/** A small tinted tag for a state or a role, with room for an icon before the word. */
export function Badge({ tone, className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1',
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}
