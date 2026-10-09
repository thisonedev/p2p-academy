'use client';

import { House } from 'lucide-react';
import { SAFE_MARGIN, type ICGrid, gridLines } from '../render/grid.js';

/** The lines a drag snapped to, in magenta. The safe margin shows as a dashed frame. */
export function GuideLines({ x, y, H }: { x?: number; y?: number; H: number }) {
  const safe =
    [SAFE_MARGIN, 100 - SAFE_MARGIN].includes(x ?? -1) ||
    [SAFE_MARGIN, H - SAFE_MARGIN].includes(y ?? -1);
  const line = {
    stroke: 'rgb(217 70 239)',
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      viewBox={`0 0 100 ${H}`}
      preserveAspectRatio="none"
    >
      {safe && (
        <rect
          x={SAFE_MARGIN}
          y={SAFE_MARGIN}
          width={100 - SAFE_MARGIN * 2}
          height={H - SAFE_MARGIN * 2}
          fill="none"
          {...line}
          strokeDasharray="4 4"
          strokeOpacity={0.7}
        />
      )}
      {x !== undefined && <line x1={x} x2={x} y1={0} y2={H} {...line} />}
      {y !== undefined && <line x1={0} x2={100} y1={y} y2={y} {...line} />}
    </svg>
  );
}

/** The layout grid over the stage: columns and rows as soft bands, the baseline as hairlines. */
export function GridOverlay({ grid, H }: { grid: ICGrid; H: number }) {
  const { cols, rows, baseline } = gridLines(grid, H);
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      viewBox={`0 0 100 ${H}`}
      preserveAspectRatio="none"
    >
      {cols.map(([a, b]) => (
        <rect key={`c${a}`} x={a} y={0} width={b - a} height={H} fill="rgb(236 72 153 / 0.1)" />
      ))}
      {rows.map(([a, b]) => (
        <rect key={`r${a}`} x={0} y={a} width={100} height={b - a} fill="rgb(236 72 153 / 0.1)" />
      ))}
      {baseline.map((y) => (
        <line
          key={`b${y}`}
          x1={0}
          x2={100}
          y1={y}
          y2={y}
          stroke="rgb(34 211 238 / 0.25)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

// Rail items are tinted tiles like the playground's block palette, in its colors from the bottom up.
const RAIL_ITEM =
  'group flex w-[56px] flex-col items-center gap-1 py-1 text-center text-[10px] leading-tight';

const RAIL_TILE = 'flex size-9 items-center justify-center rounded-lg border transition';

// The border stays faint whether or not the tab is open: full strength and a white label mark it.
const RAIL_TINT = {
  home: 'text-node-voice bg-node-voice/15 border-node-voice/40',
  templates: 'text-node-logic bg-node-logic/15 border-node-logic/40',
  elements: 'text-node-data bg-node-data/15 border-node-data/40',
  avatar: 'text-node-trigger bg-node-trigger/15 border-node-trigger/40',
};

export function RailButton({
  on,
  tint,
  Icon,
  label,
  title,
  onClick,
}: {
  on: boolean;
  tint: keyof typeof RAIL_TINT;
  Icon: typeof House;
  label: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} title={title ?? label} className={RAIL_ITEM}>
      <span
        className={`${RAIL_TILE} ${RAIL_TINT[tint]} ${on ? '' : 'opacity-75 group-hover:opacity-100'}`}
      >
        <Icon className="size-3.5" />
      </span>
      <span className={on ? 'text-canvas-foreground' : 'text-canvas-muted-foreground group-hover:text-canvas-foreground'}>
        {label}
      </span>
    </button>
  );
}
