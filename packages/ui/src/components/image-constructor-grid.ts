// Layout grids over the canvas while editing: columns, rows for a modular grid, and a baseline.
// They only guide and snap, and never show in an export.

/** Sizes are in percent of the canvas width, so a grid keeps its proportions at every export size. */
export interface ICGrid {
  on: boolean;
  snap: boolean;
  cols: number;
  /** 0 for columns only; more for a modular grid. */
  rows: number;
  gutter: number;
  margin: number;
  /** 0 for no baseline. */
  baseline: number;
}

// 12 columns with 24 px gutters and 65 px margins at 1080 wide. The baseline starts off: at 8 px
// it draws a line every few screen pixels, so it's there to turn on when setting type.
export const DEFAULT_GRID: ICGrid = {
  on: true,
  snap: true,
  cols: 12,
  rows: 0,
  gutter: 2.2,
  margin: 6,
  baseline: 0,
};

/** Where a series of equal tracks with gutters starts and ends, from `margin` to `size - margin`. */
function tracks(count: number, size: number, gutter: number, margin: number): [number, number][] {
  if (count < 1) return [];
  const track = (size - margin * 2 - gutter * (count - 1)) / count;
  if (track <= 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const start = margin + i * (track + gutter);
    return [start, start + track];
  });
}

/** The grid's columns and rows, and its baseline, all in width units. `H` is the canvas height. */
export function gridLines(grid: ICGrid, H: number) {
  const baseline: number[] = [];
  if (grid.baseline > 0) {
    for (let y = grid.margin; y <= H - grid.margin + 0.001; y += grid.baseline) baseline.push(y);
  }
  return {
    cols: tracks(grid.cols, 100, grid.gutter, grid.margin),
    rows: tracks(grid.rows, H, grid.gutter, grid.margin),
    baseline,
  };
}

/** How far to move a box so its nearest edge or middle lands on a line within `reach`, and which
 *  line it lands on. */
function pull(edges: number[], lines: number[], reach: number): { d: number; at?: number } {
  let best: { d: number; at?: number } = { d: 0 };
  let gap = reach;
  for (const edge of edges) {
    for (const line of lines) {
      const d = line - edge;
      if (Math.abs(d) < gap) {
        gap = Math.abs(d);
        best = { d, at: line };
      }
    }
  }
  return best;
}

/** How far in from the canvas edges the safe margin sits, in percent of the width. */
export const SAFE_MARGIN = 5;

/** Lines every drag catches on: the canvas edges, its middle and the safe margin. */
export const canvasLines = (H: number) => ({
  xs: [0, SAFE_MARGIN, 50, 100 - SAFE_MARGIN, 100],
  ys: [0, SAFE_MARGIN, H / 2, H - SAFE_MARGIN, H],
});

/** The grid's column and row edges and baseline, as lines to catch on. */
export function gridSnapLines(grid: ICGrid, H: number) {
  const { cols, rows, baseline } = gridLines(grid, H);
  return {
    xs: cols.flat(),
    ys: [grid.margin, H - grid.margin, ...rows.flat(), ...baseline],
  };
}

/**
 * The nudge that snaps a box being dragged, in width units: its sides and center catch on `xs`, its
 * top, middle and bottom on `ys`. `x` and `y` are the lines it caught, to draw as guides.
 */
export function snapBox(
  box: { x: number; y: number; w: number; h: number },
  xs: number[],
  ys: number[],
  reach = 0.9,
): { dx: number; dy: number; x?: number; y?: number } {
  const sx = pull([box.x, box.x + box.w / 2, box.x + box.w], xs, reach);
  const sy = pull([box.y, box.y + box.h / 2, box.y + box.h], ys, reach);
  return { dx: sx.d, dy: sy.d, x: sx.at, y: sy.at };
}
