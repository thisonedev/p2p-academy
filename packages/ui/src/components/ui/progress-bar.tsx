import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 0 to 100. Null draws a short stub, for work whose size is not known yet. */
  percent: number | null;
  /** Classes for the filled part: its color, corners and how it animates. */
  barClassName?: string;
}

/** A track with a filled part. `className` sets the track's height, width and color. */
export function ProgressBar({ percent, className, barClassName, ...rest }: ProgressBarProps) {
  return (
    <div className={cn('overflow-hidden rounded-full', className)} {...rest}>
      <div
        className={cn('h-full bg-emerald-500', barClassName)}
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
