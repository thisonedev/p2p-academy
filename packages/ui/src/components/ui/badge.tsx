import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

const TONES = {
  primary: 'bg-primary/15 text-primary ring-primary/30',
  info: 'bg-info-strong/15 text-info ring-info-strong/30',
  warning: 'bg-warning-strong/15 text-warning ring-warning-strong/30',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone: keyof typeof TONES;
}

/** A small tinted tag for a state or a role, with room for an icon before the word. */
export function Badge({ tone, className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wider ring-1',
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}
