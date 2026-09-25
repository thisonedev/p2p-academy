export type ICHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface ICRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SIGN: Record<ICHandle, [number, number]> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
};

export const handleSign = (handle: ICHandle): [number, number] => SIGN[handle];

/** A screen-space drag turned into the box's own axes, for a box rotated by `rot` degrees. */
export function toLocal(dx: number, dy: number, rot: number): [number, number] {
  const rad = (rot * Math.PI) / 180;
  return [dx * Math.cos(rad) + dy * Math.sin(rad), -dx * Math.sin(rad) + dy * Math.cos(rad)];
}

/** Where a handle sits on its box, as fractions of the width and height. */
export const HANDLE_AT: Record<ICHandle, [number, number]> = {
  nw: [0, 0],
  n: [0.5, 0],
  ne: [1, 0],
  e: [1, 0.5],
  se: [1, 1],
  s: [0.5, 1],
  sw: [0, 1],
  w: [0, 0.5],
};

export const CORNERS: ICHandle[] = ['nw', 'ne', 'se', 'sw'];
export const ALL_HANDLES: ICHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export const SIDES: ICHandle[] = ['w', 'e'];

/**
 * Resizes a box by dragging one handle, keeping the opposite edge or corner where it is on screen.
 * The drag (dx, dy) is in screen pixels and is turned into the box's own axes, so rotated boxes work.
 * `lock` keeps the aspect ratio on corner drags. `max` caps the size when a crop can grow only so far.
 */
export function resizeRect(
  rect: ICRect,
  rot: number,
  handle: ICHandle,
  dx: number,
  dy: number,
  lock: boolean,
  min: number,
  max?: { w: number; h: number },
): ICRect {
  const [sx, sy] = SIGN[handle];
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  let w = sx ? rect.w + sx * lx : rect.w;
  let h = sy ? rect.h + sy * ly : rect.h;
  if (lock && sx && sy) {
    const kw = w / rect.w;
    const kh = h / rect.h;
    const k = Math.max(Math.abs(kw - 1) >= Math.abs(kh - 1) ? kw : kh, min / rect.w, min / rect.h);
    w = rect.w * k;
    h = rect.h * k;
  } else {
    w = Math.min(max?.w ?? Number.POSITIVE_INFINITY, Math.max(min, w));
    h = Math.min(max?.h ?? Number.POSITIVE_INFINITY, Math.max(min, h));
  }
  // The opposite anchor keeps its screen position, so the center moves by the change in its offset.
  const ax = (-sx * (rect.w - w)) / 2;
  const ay = (-sy * (rect.h - h)) / 2;
  const cx = rect.x + rect.w / 2 + ax * cos - ay * sin;
  const cy = rect.y + rect.h / 2 + ax * sin + ay * cos;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
