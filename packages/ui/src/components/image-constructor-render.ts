import {
  IC_FONT_STACKS,
  IC_OUTPUT_SIZE,
  type ICElement,
  type ICFont,
  type ICLayout,
} from './image-constructor-layout.js';

// One drawing function serves the studio preview and the exported PNG, so the two always match.

export interface ICImages {
  scene: HTMLImageElement | null;
  subject: HTMLImageElement | null;
  /** User-added image layers by element id. */
  layers: Map<string, HTMLImageElement>;
}

export interface ICBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type SpacedContext = CanvasRenderingContext2D & { letterSpacing: string };

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let pending = imageCache.get(url);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load an image for the design.'));
      img.src = url;
    });
    imageCache.set(url, pending);
  }
  return pending;
}

export async function loadImages(layout: ICLayout, sceneUrl: string | null): Promise<ICImages> {
  const sceneSource = layout.scene.upload?.url ?? sceneUrl;
  const layerImages = layout.els.filter((e) => e.t === 'image');
  const [scene, subject, ...layers] = await Promise.all([
    sceneSource ? loadImage(sceneSource).catch(() => null) : null,
    loadImage(layout.subject.url).catch(() => null),
    ...layerImages.map((e) => loadImage(e.t === 'image' ? e.url : '').catch(() => null)),
  ]);
  const byId = new Map<string, HTMLImageElement>();
  layerImages.forEach((e, i) => {
    const img = layers[i];
    if (img) byId.set(e.id, img);
  });
  return { scene, subject, layers: byId };
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number): void {
  const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
}

function drawBackground(ctx: CanvasRenderingContext2D, layout: ICLayout, size: number): void {
  const { bg } = layout;
  if (bg.mode === 'transparent') return;
  if (bg.mode === 'solid') {
    ctx.fillStyle = bg.color;
  } else {
    // CSS angle: 0deg points up, 90deg points right.
    const a = (bg.angle * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const half = (size * (Math.abs(dx) + Math.abs(dy))) / 2;
    const c = size / 2;
    const g = ctx.createLinearGradient(c - dx * half, c - dy * half, c + dx * half, c + dy * half);
    g.addColorStop(0, bg.from);
    g.addColorStop(1, bg.to);
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, size, size);
}

function setFont(
  ctx: SpacedContext,
  e: { size: number; weight: number; font: ICFont; track: number },
  size: number,
): number {
  const px = (e.size / 100) * size;
  ctx.font = `${e.weight} ${px}px ${IC_FONT_STACKS[e.font]}`;
  ctx.letterSpacing = `${e.track * px}px`;
  return px;
}

/** Baseline that centers the font's ascent and descent in a line box, as CSS does. */
function baselineFor(ctx: CanvasRenderingContext2D, top: number, lineHeight: number): number {
  const m = ctx.measureText('Hg');
  return (
    top +
    (lineHeight - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 +
    m.fontBoundingBoxAscent
  );
}

function alignedX(
  align: 'left' | 'center' | 'right',
  x: number,
  w: number,
  textWidth: number,
): number {
  if (align === 'center') return x + (w - textWidth) / 2;
  return align === 'right' ? x + w - textWidth : x;
}

export function layerBox(e: ICElement, layout: ICLayout, size: number): ICBox {
  const x = (e.x / 100) * size;
  const y = (e.y / 100) * size;
  const w = (e.w / 100) * size;
  switch (e.t) {
    case 'text':
      return { x, y, w, h: e.text.split('\n').length * e.lh * (e.size / 100) * size };
    case 'pill':
      return { x, y, w, h: (e.h / 100) * size };
    case 'line':
      return { x, y, w, h: Math.max((e.th / 100) * size, 6) };
    case 'subject':
      return { x, y, w, h: w / layout.subject.ratio };
    case 'image':
      return { x, y, w, h: w / e.ratio };
  }
}

function drawShadow(ctx: CanvasRenderingContext2D, box: ICBox): void {
  const rx = box.w * 0.62;
  const ry = box.w * 0.09;
  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h * 0.97);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawElement(
  ctx: SpacedContext,
  e: ICElement,
  layout: ICLayout,
  images: ICImages,
  size: number,
): void {
  const box = layerBox(e, layout, size);
  if (e.t === 'line') {
    ctx.fillStyle = e.color;
    ctx.fillRect(box.x, box.y, box.w, (e.th / 100) * size);
  } else if (e.t === 'subject' || e.t === 'image') {
    const img = e.t === 'subject' ? images.subject : images.layers.get(e.id);
    if (!img) return;
    if (e.t === 'subject' && e.shadow) drawShadow(ctx, box);
    ctx.drawImage(img, box.x, box.y, box.w, box.h);
  } else if (e.t === 'text') {
    const px = setFont(ctx, e, size);
    ctx.fillStyle = e.color;
    ctx.textBaseline = 'alphabetic';
    e.text.split('\n').forEach((lineText, i) => {
      const top = box.y + i * e.lh * px;
      const left = alignedX(e.align, box.x, box.w, ctx.measureText(lineText).width);
      ctx.fillText(lineText, left, baselineFor(ctx, top, e.lh * px));
    });
  } else {
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, box.h / 2);
    if (e.fill) {
      ctx.fillStyle = e.fill;
      ctx.fill();
    }
    if (e.stroke) {
      ctx.lineWidth = size * 0.0025;
      ctx.strokeStyle = e.stroke;
      ctx.stroke();
    }
    setFont(ctx, e, size);
    ctx.fillStyle = e.color;
    ctx.textBaseline = 'alphabetic';
    const left = alignedX('center', box.x, box.w, ctx.measureText(e.text).width);
    ctx.fillText(e.text, left, baselineFor(ctx, box.y, box.h));
  }
}

export interface ICDrawOptions {
  /** Gradient colors drawn in place of a scene that has not been generated yet. */
  placeholder?: { from: string; to: string };
}

export function drawLayout(
  raw: CanvasRenderingContext2D,
  layout: ICLayout,
  images: ICImages,
  size: number,
  opts: ICDrawOptions = {},
): void {
  const ctx = raw as SpacedContext;
  ctx.clearRect(0, 0, size, size);
  drawBackground(ctx, layout, size);
  if (layout.scene.on) {
    if (images.scene) {
      drawCover(ctx, images.scene, size);
    } else if (opts.placeholder) {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, opts.placeholder.from);
      g.addColorStop(1, opts.placeholder.to);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
  }
  for (const e of layout.els) {
    if (!e.vis) continue;
    ctx.save();
    drawElement(ctx, e, layout, images, size);
    ctx.restore();
  }
}

/** Draws the finished design at export size and returns it as a PNG data URL. */
export async function composeLayout(
  layout: ICLayout,
  sceneUrl: string | null,
  size = IC_OUTPUT_SIZE,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the design.');
  drawLayout(ctx, layout, await loadImages(layout, sceneUrl), size);
  return canvas.toDataURL('image/png');
}
