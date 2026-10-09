import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 0 to 100. Null draws a short stub, for work whose size is not known yet. */
  percent: number | null;
  /** Amber instead of green, for a level that is running low. */
  warn?: boolean;
}

/** A track with a filled part. `className` sets the track's width and its color, which
 *  depends on the surface it sits on. */
export function ProgressBar({ percent, warn, className, ...rest }: ProgressBarProps) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full', className)} {...rest}>
      <div
        className={cn('h-full transition-[width] duration-300', warn ? 'bg-warning-strong' : 'bg-primary')}
        style={{ width: percent != null ? `${percent}%` : '15%' }}
      />
    </div>
  );
}

/** How far along a download is, as a whole percent. Null until its size is known. */
export function percentOf(progress?: { loaded: number; total: number } | null): number | null {
  if (!progress || progress.total <= 0) return null;
  return Math.min(100, Math.round((progress.loaded / progress.total) * 100));
}
