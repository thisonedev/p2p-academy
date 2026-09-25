import { loadImage } from './image-constructor-render.js';

export interface ICCutout {
  /** 0 to 100. How far a color may differ from the edge color and still count as background. */
  tolerance: number;
  /** Edge softness in pixels. */
  feather: number;
}

export const DEFAULT_CUTOUT: ICCutout = { tolerance: 38, feather: 1.5 };

const median = (values: number[]): number => {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

/** Averages each pixel with its neighbors along one axis. Used twice to soften a mask. */
function boxBlur(
  src: Uint8Array,
  w: number,
  h: number,
  radius: number,
  vertical: boolean,
): Uint8Array {
  const out = new Uint8Array(src.length);
  const lines = vertical ? w : h;
  const length = vertical ? h : w;
  const stride = vertical ? w : 1;
  const step = vertical ? 1 : w;
  for (let line = 0; line < lines; line++) {
    const base = line * step;
    let sum = 0;
    for (let i = -radius; i <= radius; i++)
      sum += src[base + Math.min(length - 1, Math.max(0, i)) * stride];
    for (let i = 0; i < length; i++) {
      out[base + i * stride] = Math.round(sum / (radius * 2 + 1));
      sum += src[base + Math.min(length - 1, i + radius + 1) * stride];
      sum -= src[base + Math.max(0, i - radius) * stride];
    }
  }
  return out;
}

/** Removes a plain background: finds the edge color, clears what connects to the edges, softens the rim. */
export async function removeBackground(
  src: string,
  { tolerance, feather }: ICCutout,
): Promise<string> {
  const img = await loadImage(src);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser cannot edit images.');
  ctx.drawImage(img, 0, 0);
  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;

  const ring: number[][] = [[], [], []];
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (px[i + 3] < 16) return;
    for (let c = 0; c < 3; c++) ring[c].push(px[i + c]);
  };
  for (let x = 0; x < w; x++) {
    sample(x, 0);
    sample(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    sample(0, y);
    sample(w - 1, y);
  }
  const [br, bg, bb] = ring.map(median);
  const limit = tolerance * 1.6;
  const isBackground = (p: number) => {
    const i = p * 4;
    if (px[i + 3] < 16) return true;
    const dr = px[i] - br;
    const dg = px[i + 1] - bg;
    const db = px[i + 2] - bb;
    return dr * dr + dg * dg + db * db <= limit * limit;
  };

  const cleared = new Uint8Array(w * h);
  const stack: number[] = [];
  const visit = (p: number) => {
    if (cleared[p] === 0 && isBackground(p)) {
      cleared[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    visit(x);
    visit((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    visit(y * w);
    visit(y * w + w - 1);
  }
  while (stack.length > 0) {
    const p = stack.pop() as number;
    const x = p % w;
    if (x > 0) visit(p - 1);
    if (x < w - 1) visit(p + 1);
    if (p >= w) visit(p - w);
    if (p < w * (h - 1)) visit(p + w);
  }

  // Trim one pixel off the rim, where the background color still bleeds into the edge.
  let alpha: Uint8Array = new Uint8Array(w * h);
  for (let p = 0; p < alpha.length; p++) {
    const x = p % w;
    const nearBackground =
      (x > 0 && cleared[p - 1] === 1) ||
      (x < w - 1 && cleared[p + 1] === 1) ||
      (p >= w && cleared[p - w] === 1) ||
      (p < w * (h - 1) && cleared[p + w] === 1);
    alpha[p] = cleared[p] === 1 || nearBackground ? 0 : 255;
  }
  const radius = Math.round(feather);
  if (radius > 0) alpha = boxBlur(boxBlur(alpha, w, h, radius, false), w, h, radius, true);

  for (let p = 0; p < alpha.length; p++)
    px[p * 4 + 3] = Math.round((px[p * 4 + 3] * alpha[p]) / 255);
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
