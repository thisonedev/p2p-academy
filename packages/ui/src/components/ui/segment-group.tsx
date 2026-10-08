import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

/** A bordered run of choices side by side. Holds `SegmentButton`s. */
export function SegmentGroup({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex rounded-md border border-canvas-border p-0.5', className)} {...rest} />
  );
}

interface SegmentButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  on: boolean;
  /** The surface that marks the choice that is on. Use `canvas` on a muted panel. */
  lit?: 'muted' | 'canvas';
}

export function SegmentButton({ on, lit = 'muted', className, ...rest }: SegmentButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        'rounded px-2 py-1',
        on
          ? `${lit === 'canvas' ? 'bg-canvas' : 'bg-canvas-muted'} text-canvas-foreground`
          : 'text-canvas-muted-foreground hover:text-canvas-foreground',
        className,
      )}
      {...rest}
    />
  );
}
