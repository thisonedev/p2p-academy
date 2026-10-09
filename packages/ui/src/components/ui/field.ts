import { cn } from '../../lib/cn.js';

// One look for every text box and textarea, in three sizes: sm for dense studio rows,
// md for panels and popups, lg for account and settings forms. Callers add layout only.
const BASE =
  'w-full min-w-0 border border-canvas-border bg-canvas text-canvas-foreground placeholder:text-canvas-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-40';

const SIZES = {
  sm: 'rounded-md px-2 py-1 text-label',
  md: 'rounded-lg px-2.5 py-2 text-label',
  lg: 'rounded-md px-3 py-2 font-mono text-lead',
} as const;

export type FieldSize = keyof typeof SIZES;

export function fieldClass(size: FieldSize = 'md', className?: string): string {
  return cn(BASE, SIZES[size], className);
}

/** A native color picker. Callers set its size. */
export const COLOR_FIELD = 'cursor-pointer rounded-md border border-canvas-border bg-canvas p-0.5';
