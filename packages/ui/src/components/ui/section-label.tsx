import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

interface SectionLabelProps extends HTMLAttributes<HTMLElement> {
  as?: 'p' | 'label' | 'span' | 'h3';
  htmlFor?: string;
}

/** The small uppercase line that names a card or a field. */
export function SectionLabel({ as: Tag = 'p', className, ...rest }: SectionLabelProps) {
  return (
    <Tag
      className={cn(
        'text-[11px] font-semibold uppercase tracking-wider text-canvas-muted-foreground',
        className,
      )}
      {...rest}
    />
  );
}
