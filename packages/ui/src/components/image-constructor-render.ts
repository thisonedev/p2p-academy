import { loadFonts } from './image-constructor-fonts.js';
import {
  IC_FONT_STACKS,
  IC_OUTPUT_SIZE,
  type ICElement,
  type ICFont,
  type ICLayout,
  ratioHeight,
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

/** Canvas height in pixels for a given width. */
export function canvasHeight(layout: ICLayout, width: number): number {
  return Math.round(width * ratioHeight(layout.ratio));
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  layout: ICLayout,
  w: number,
  h: number,
): void {
  const { bg } = layout;
  if (bg.mode === 'transparent') return;
  if (bg.mode === 'solid') {
    ctx.fillStyle = bg.color;
  } else {
    // CSS angle: 0deg points up, 90deg points right.
    const a = (bg.angle * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
    const g = ctx.createLinearGradient(
      w / 2 - dx * half,
      h / 2 - dy * half,
      w / 2 + dx * half,
      h / 2 + dy * half,
    );
    g.addColorStop(0, bg.from);
    g.addColorStop(1, bg.to);
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, w, h);
}

function setFont(
  ctx: SpacedContext,
  e: { size: number; weight: number; font: ICFont; track: number },
  width: number,
): number {
  const px = (e.size / 100) * width;
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

/** The layer's box before rotation, in pixels of a canvas `width` pixels wide. */
export function layerBox(e: ICElement, layout: ICLayout, width: number): ICBox {
  const height = width * ratioHeight(layout.ratio);
  const x = (e.x / 100) * width;
  const y = (e.y / 100) * height;
  const w = (e.w / 100) * width;
  switch (e.t) {
    case 'text':
      return { x, y, w, h: e.text.split('\n').length * e.lh * (e.size / 100) * width };
    case 'pill':
    case 'shape':
      return { x, y, w, h: (e.h / 100) * height };
    case 'line':
      return { x, y, w, h: Math.max((e.th / 100) * width, 6) };
    case 'subject':
      return { x, y, w, h: w / layout.subject.ratio };
    case 'image':
      return { x, y, w, h: e.h === undefined ? w / e.ratio : (e.h / 100) * height };
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

/** A mirrored copy under the product that fades out over 60% of its height. */
function drawReflection(ctx: CanvasRenderingContext2D, img: HTMLImageElement, box: ICBox): void {
  const rh = Math.ceil(box.h * 0.6);
  const layer = document.createElement('canvas');
  layer.width = Math.ceil(box.w);
  layer.height = rh;
  const lc = layer.getContext('2d');
  if (!lc) return;
  lc.scale(1, -1);
  lc.drawImage(img, 0, -box.h, box.w, box.h);
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.globalCompositeOperation = 'destination-in';
  const fade = lc.createLinearGradient(0, 0, 0, rh);
  fade.addColorStop(0, 'rgba(0,0,0,0.4)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  lc.fillStyle = fade;
  lc.fillRect(0, 0, layer.width, rh);
  ctx.drawImage(layer, box.x, box.y + box.h);
}

function drawPicture(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: ICBox,
  radius: number,
  cover: boolean,
): void {
  ctx.save();
  if (radius > 0 || cover) {
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, radius);
    ctx.clip();
  }
  if (cover) drawCover(ctx, img, box.x, box.y, box.w, box.h);
  else ctx.drawImage(img, box.x, box.y, box.w, box.h);
  ctx.restore();
}

function drawElement(
  ctx: SpacedContext,
  e: ICElement,
  layout: ICLayout,
  images: ICImages,
  width: number,
): void {
  const box = layerBox(e, layout, width);
  ctx.globalAlpha = e.op ?? 1;
  if (e.rot) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((e.rot * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  if (e.t === 'line') {
    ctx.fillStyle = e.color;
    ctx.fillRect(box.x, box.y, box.w, (e.th / 100) * width);
  } else if (e.t === 'shape') {
    ctx.beginPath();
    if (e.kind === 'ellipse') {
      ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
    } else {
      ctx.roundRect(box.x, box.y, box.w, box.h, (e.radius / 100) * width);
    }
    if (e.fill) {
      ctx.fillStyle = e.fill;
      ctx.fill();
    }
    if (e.stroke && e.sw > 0) {
      ctx.lineWidth = (e.sw / 100) * width;
      ctx.strokeStyle = e.stroke;
      ctx.stroke();
    }
  } else if (e.t === 'subject') {
    if (!images.subject) return;
    if (e.shadow) drawShadow(ctx, box);
    ctx.drawImage(images.subject, box.x, box.y, box.w, box.h);
    if (e.reflect && !e.rot) drawReflection(ctx, images.subject, box);
  } else if (e.t === 'image') {
    const img = images.layers.get(e.id);
    if (img) drawPicture(ctx, img, box, ((e.radius ?? 0) / 100) * width, e.h !== undefined);
  } else if (e.t === 'text') {
    const px = setFont(ctx, e, width);
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
      ctx.lineWidth = width * 0.0025;
      ctx.strokeStyle = e.stroke;
      ctx.stroke();
    }
    setFont(ctx, e, width);
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
  width: number,
  opts: ICDrawOptions = {},
): void {
  const ctx = raw as SpacedContext;
  const height = canvasHeight(layout, width);
  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, layout, width, height);
  if (layout.scene.on) {
    if (images.scene) {
      drawCover(ctx, images.scene, 0, 0, width, height);
    } else if (opts.placeholder) {
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, opts.placeholder.from);
      g.addColorStop(1, opts.placeholder.to);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
  }
  for (const e of layout.els) {
    if (!e.vis) continue;
    ctx.save();
    drawElement(ctx, e, layout, images, width);
    ctx.restore();
  }
}

/** Draws the finished design at export size and returns it as a PNG data URL. */
export async function composeLayout(
  layout: ICLayout,
  sceneUrl: string | null,
  width = IC_OUTPUT_SIZE,
): Promise<string> {
  const [images] = await Promise.all([loadImages(layout, sceneUrl), loadFonts()]);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = canvasHeight(layout, width);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the design.');
  drawLayout(ctx, layout, images, width);
  return canvas.toDataURL('image/png');
}
