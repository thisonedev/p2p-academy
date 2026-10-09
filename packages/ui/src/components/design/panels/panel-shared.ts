import { IC_FONT_STACKS, type ICFont, IC_FONT_LABELS } from '../render/layout.js';

export const LABEL =
  'mb-2 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70';

export const INPUT =
  'w-full rounded-lg border border-canvas-border bg-canvas-muted px-2.5 py-2 text-[12.5px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-primary/60';

export const SMALL =
  'rounded-md border border-canvas-border bg-canvas px-2.5 py-1 text-[12px] text-canvas-foreground hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-40';

export const SWATCH =
  'h-5 min-w-0 cursor-pointer rounded border border-canvas-border hover:border-canvas-foreground';

export const TILE =
  'flex h-24 items-center justify-center rounded-lg border border-canvas-border bg-canvas-muted p-2 hover:border-canvas-muted-foreground';

export const FONT_OPTIONS = (Object.keys(IC_FONT_STACKS) as ICFont[]).map((value) => ({
  value,
  label: IC_FONT_LABELS[value],
}));
