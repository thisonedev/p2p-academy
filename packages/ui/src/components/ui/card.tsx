import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section';
  /** Sits on the muted surface instead of the page's own. */
  muted?: boolean;
}

/** The bordered box that settings, devices and profile sections sit in. */
export function Card({ as: Tag = 'div', muted, className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-xl border border-canvas-border p-5 sm:p-6',
        muted ? 'bg-canvas-muted' : 'bg-canvas',
        className,
      )}
      {...rest}
    />
  );
}
