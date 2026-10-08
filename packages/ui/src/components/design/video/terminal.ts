import { IC_FONT_STACKS } from '../render/font-list.js';

// The command line window that the Video tab's Command line slide and the Motion tab's Terminal
// film both draw, so the two look the same. Every size follows `px`, the height of its type.

export const TERM = {
  /** The window's fill on a light design. A dark design uses its own panel color. */
  fill: '#101014',
  bar: 'rgba(255,255,255,0.07)',
  dot: 'rgba(255,255,255,0.25)',
  text: '#f4f4f1',
};

export const termFont = (px: number) => `500 ${px}px ${IC_FONT_STACKS['geist-mono']}`;
export const termRadius = (px: number) => px * 0.7;
/** How far down the window its first line sits, and how far apart lines are. */
export const termFirst = (px: number) => px * 3.5;
export const termStep = (px: number) => px * 1.85;
/** Where a line's words start, from the window's left edge. */
export const termInset = (px: number) => px * 2.4;

/** The title bar and its three dots. `x` and `y` are the window's corner. The caller clips to
 *  the window's own outline first, so the bar takes its rounded corners. */
export function termBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  px: number,
): void {
  ctx.fillStyle = TERM.bar;
  ctx.fillRect(x, y, w, px * 1.45);
  ctx.fillStyle = TERM.dot;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.arc(x + px * 0.9 + k * px * 0.65, y + px * 0.725, px * 0.175, 0, 7);
    ctx.fill();
  }
}

/** One line: its prompt in the accent, then the words, then a block caret when it has one. `x` is
 *  the window's left edge and `y` the line's middle. */
export function termLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  prompt: string,
  text: string,
  o: { accent: string; color?: string; caret?: boolean },
): void {
  ctx.font = termFont(px);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = o.accent;
  ctx.fillText(prompt, x + px * 1.35, y);
  ctx.fillStyle = o.color ?? TERM.text;
  ctx.fillText(text, x + termInset(px), y);
  if (o.caret) {
    const at = text
      ? x + termInset(px) + ctx.measureText(text).width + px * 0.1
      : x + termInset(px);
    ctx.fillRect(at, y - px * 0.55, px * 0.5, px * 1.1);
  }
}
