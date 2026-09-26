import { lookPad, lookText } from './image-constructor-buttons.js';
import { IC_FONT_STACKS, isFixedWeight } from './image-constructor-font-list.js';
import type { ICPill, ICText } from './image-constructor-layout.js';

// Measured at a fixed reference width; sizes and widths are percent of the canvas width, so the ratio holds at any size.
const REF = 1000;

let ctx: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  if (ctx === undefined) {
    ctx =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  return ctx;
}

/** Widest line of a text or badge layer, in percent of the canvas width, or null outside a browser. */
export function textWidth(e: ICText | ICPill): number | null {
  const c = context();
  if (!c) return null;
  const px = (e.size / 100) * REF;
  c.font = `${e.italic ? 'italic ' : ''}${isFixedWeight(e.font) ? 400 : e.weight} ${px}px ${IC_FONT_STACKS[e.font]}`;
  (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${e.track * px}px`;
  const text = e.t === 'pill' ? lookText(e) : e.text;
  const widest = Math.max(...text.split('\n').map((line) => c.measureText(line).width));
  return (widest / REF) * 100;
}

/** Room for the words: the layer's box, less a badge's padding and marks, at least 1em a side. */
export function textRoom(e: ICText | ICPill): number {
  if (e.t !== 'pill') return e.w;
  const pad = lookPad(e.look);
  return e.w - e.size * (pad.left + pad.right);
}

/** Shrinks a layer whose words no longer fit its box, such as after a kit swaps in a wider font. Never grows it. */
export function shrinkToFit<T extends ICText | ICPill>(e: T): T {
  const width = textWidth(e);
  const room = textRoom(e);
  if (width === null || width <= room || room <= 0) return e;
  return { ...e, size: Math.floor(((e.size * room) / width) * 0.98 * 100) / 100 };
}
