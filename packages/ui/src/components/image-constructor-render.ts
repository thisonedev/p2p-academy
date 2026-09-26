import { artFor, artUrl } from './image-constructor-art.js';
import { AVATAR_RATIO, avatarUrl } from './image-constructor-avatar.js';
import { lookPad, lookText } from './image-constructor-buttons.js';
import { isCode } from './image-constructor-code.js';
import { fetchFontFace, isFixedWeight } from './image-constructor-font-list.js';
import { loadFonts } from './image-constructor-fonts.js';
import {
  cropRatio,
  FULL_CROP,
  IC_FONT_STACKS,
  IC_OUTPUT_SIZE,
  type ICCrop,
  type ICElement,
  type ICFont,
  type ICLayout,
  type ICPill,
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

/** The picture behind an image, art or avatar layer. Async only because an avatar with
 *  text on top needs to fetch and embed that font first (see `avatarUrl`). */
export async function pictureUrl(e: ICElement): Promise<string> {
  if (e.t === 'image') return e.url;
  if (e.t === 'avatar') return avatarUrl(e.config);
  const def = e.t === 'art' ? artFor(e) : undefined;
  if (e.t !== 'art' || !def) return '';
  const url = artUrl(def, e.colors);
  // Code is set in Geist Mono, which an SVG drawn through <img> can't see unless it's embedded.
  if (!isCode(e.art)) return url;
  const face = await fetchFontFace('geist-mono');
  return face
    ? url.replace('%3E', `%3E${encodeURIComponent(`<defs><style>${face}</style></defs>`)}`)
    : url;
}

export async function loadImages(layout: ICLayout, sceneUrl: string | null): Promise<ICImages> {
  const sceneSource = layout.scene.upload?.url ?? sceneUrl;
  const layerImages = layout.els.filter(
    (e) => e.t === 'image' || e.t === 'art' || e.t === 'avatar',
  );
  const [scene, subject, ...layers] = await Promise.all([
    sceneSource ? loadImage(sceneSource).catch(() => null) : null,
    loadImage(layout.subject.url).catch(() => null),
    ...layerImages.map((e) =>
      pictureUrl(e)
        .then(loadImage)
        .catch(() => null),
    ),
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
  return Math.round(width * ratioHeight(layout.ratio, layout.customSize));
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
  e: { size: number; weight: number; font: ICFont; track: number; italic?: boolean },
  width: number,
): number {
  const px = (e.size / 100) * width;
  ctx.font = `${e.italic ? 'italic ' : ''}${isFixedWeight(e.font) ? 400 : e.weight} ${px}px ${IC_FONT_STACKS[e.font]}`;
  ctx.letterSpacing = `${e.track * px}px`;
  return px;
}

/** Baseline that centers a capital letter in the line box, so the position does not depend on the font's own metrics. */
function baselineFor(ctx: CanvasRenderingContext2D, top: number, lineHeight: number): number {
  return top + lineHeight / 2 + ctx.measureText('H').actualBoundingBoxAscent / 2;
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
  // The canvas is a whole number of pixels tall. Boxes use that same height,
  // so layers drawn to the bottom edge reach it instead of stopping half a pixel short.
  const height = canvasHeight(layout, width);
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
      return { x, y, w, h: w / (layout.subject.ratio * cropRatio(e.crop)) };
    case 'image':
      return {
        x,
        y,
        w,
        h: e.h === undefined ? w / (e.ratio * cropRatio(e.crop)) : (e.h / 100) * height,
      };
    case 'art':
      return { x, y, w, h: w / (artFor(e)?.ratio ?? 1) };
    case 'avatar':
      return { x, y, w, h: w / AVATAR_RATIO };
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
/** Draws the visible part of a picture into a box. */
function drawCropped(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  crop: ICCrop | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const c = crop ?? FULL_CROP;
  const [sw, sh] = [img.naturalWidth, img.naturalHeight];
  ctx.drawImage(img, c.x * sw, c.y * sh, c.w * sw, c.h * sh, x, y, w, h);
}

function drawReflection(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: ICBox,
  crop?: ICCrop,
): void {
  const rh = Math.ceil(box.h * 0.6);
  const layer = document.createElement('canvas');
  layer.width = Math.ceil(box.w);
  layer.height = rh;
  const lc = layer.getContext('2d');
  if (!lc) return;
  lc.scale(1, -1);
  drawCropped(lc, img, crop, 0, -box.h, box.w, box.h);
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.globalCompositeOperation = 'destination-in';
  const fade = lc.createLinearGradient(0, 0, 0, rh);
  fade.addColorStop(0, 'rgba(0,0,0,0.4)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  lc.fillStyle = fade;
  lc.fillRect(0, 0, layer.width, rh);
  ctx.drawImage(layer, box.x, box.y + box.h);
}

/** Screenshots fill the width from the top; phone screens made before `fit: 'top'` are too. */
export const isTop = (e: { fit?: string; slot?: string }) =>
  e.fit === 'top' || e.slot === 'screenshot';

/** Full width from the top, cropping the bottom. The sides are never cut: a picture shorter than
 *  the box leaves black below it, like an app whose page ends. */
export function topPlacement(box: ICBox, ratio: number): ICBox {
  return { x: box.x, y: box.y, w: box.w, h: box.w / ratio };
}

function drawPicture(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: ICBox,
  radius: number,
  cover: boolean,
  crop?: ICCrop,
  top = false,
): void {
  ctx.save();
  if (radius > 0 || cover) {
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, radius);
    ctx.clip();
  }
  if (cover && top) {
    const p = topPlacement(box, img.naturalWidth / img.naturalHeight);
    ctx.fillStyle = '#000000';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.drawImage(img, p.x, p.y, p.w, p.h);
  } else if (cover) drawCover(ctx, img, box.x, box.y, box.w, box.h);
  else drawCropped(ctx, img, crop, box.x, box.y, box.w, box.h);
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
  if (e.flip) {
    const cx = box.x + box.w / 2;
    ctx.translate(cx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-cx, 0);
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
    drawCropped(ctx, images.subject, e.crop, box.x, box.y, box.w, box.h);
    if (e.reflect && !e.rot) drawReflection(ctx, images.subject, box, e.crop);
  } else if (e.t === 'art' || e.t === 'avatar') {
    const img = images.layers.get(e.id);
    if (img) ctx.drawImage(img, box.x, box.y, box.w, box.h);
  } else if (e.t === 'image') {
    const img = images.layers.get(e.id);
    if (img && e.fit === 'contain' && e.h !== undefined) {
      const w = Math.min(box.w, box.h * e.ratio);
      const h = w / e.ratio;
      ctx.drawImage(img, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
    } else if (img) {
      drawPicture(
        ctx,
        img,
        box,
        ((e.radius ?? 0) / 100) * width,
        e.h !== undefined,
        e.crop,
        isTop(e),
      );
    }
  } else if (e.t === 'text') {
    const px = setFont(ctx, e, width);
    ctx.fillStyle = e.color;
    ctx.textBaseline = 'alphabetic';
    e.text.split('\n').forEach((lineText, i) => {
      const top = box.y + i * e.lh * px;
      const lw = ctx.measureText(lineText).width;
      const left = alignedX(e.align, box.x, box.w, lw);
      const base = baselineFor(ctx, top, e.lh * px);
      ctx.fillText(lineText, left, base);
      if (e.underline && lineText) ctx.fillRect(left, base + px * 0.12, lw, Math.max(1, px * 0.06));
    });
  } else {
    drawPill(ctx, e, box, width);
  }
}

/** A badge in its look: the box, then the words centered between the look's marks. */
function drawPill(ctx: SpacedContext, e: ICPill, box: ICBox, width: number): void {
  const r = e.radius === undefined ? box.h / 2 : (e.radius / 100) * width;
  const px = setFont(ctx, e, width);
  const look = e.look;
  const shape = (dx = 0, dy = 0) => {
    ctx.beginPath();
    ctx.roundRect(box.x + dx, box.y + dy, box.w, box.h, r);
  };
  if (look === 'offset' && e.fill) {
    shape(px * 0.3, px * 0.3);
    ctx.globalAlpha *= 0.4;
    ctx.fillStyle = e.fill;
    ctx.fill();
    ctx.globalAlpha /= 0.4;
  }
  if (e.fill && look !== 'bracket' && look !== 'link') {
    shape();
    // Soft and dot looks tint the box instead of filling it.
    const tint = look === 'soft' ? 0.16 : look === 'dot' ? 0.08 : 1;
    ctx.globalAlpha *= tint;
    ctx.fillStyle = e.fill;
    ctx.fill();
    ctx.globalAlpha /= tint;
    if (look === 'dot') {
      ctx.globalAlpha *= 0.14;
      ctx.lineWidth = width * 0.0015;
      ctx.strokeStyle = e.fill;
      ctx.stroke();
      ctx.globalAlpha /= 0.14;
    }
  }
  if (e.stroke && look !== 'dot') {
    shape();
    ctx.lineWidth = width * 0.0025;
    ctx.strokeStyle = e.stroke;
    ctx.stroke();
  }
  if (look === 'tag') {
    // A darker cap on the left holding a plus.
    ctx.save();
    shape();
    ctx.clip();
    ctx.globalAlpha *= 0.22;
    ctx.fillStyle = e.color;
    ctx.fillRect(box.x, box.y, px * 2.1, box.h);
    ctx.restore();
    ctx.fillStyle = e.color;
    ctx.textBaseline = 'alphabetic';
    const plus = ctx.measureText('+').width;
    ctx.fillText('+', box.x + px * 1.05 - plus / 2, baselineFor(ctx, box.y, box.h));
  }
  const pad = lookPad(look);
  const text = lookText(e);
  const tw = ctx.measureText(text).width;
  const from = box.x + pad.left * px;
  const room = box.w - (pad.left + pad.right) * px;
  const left = from + (room - tw) / 2;
  const base = baselineFor(ctx, box.y, box.h);
  if (look === 'dot' && e.stroke) {
    const cx = box.x + px * 1.25;
    const cy = box.y + box.h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, px * 0.5, 0, Math.PI * 2);
    ctx.globalAlpha *= 0.25;
    ctx.fillStyle = e.stroke;
    ctx.fill();
    ctx.globalAlpha /= 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, px * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = e.stroke;
    ctx.fill();
  }
  ctx.fillStyle = e.color;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, left, base);
  if (e.underline && look !== 'link')
    ctx.fillRect(left, base + px * 0.12, tw, Math.max(1, px * 0.06));
  if (look === 'link') {
    ctx.fillRect(left, base + px * 0.3, tw, Math.max(1, px * 0.08));
    ctx.fillText('\u2192', left + tw + px * 0.4, base);
  }
}

export interface ICDrawOptions {
  /** Skips the background fill and the scene image, regardless of the design's
   *  own settings: an export-time override, not a change to the saved design. */
  transparentBg?: boolean;
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
  if (!opts.transparentBg) drawBackground(ctx, layout, width, height);
  if (layout.scene.on && !opts.transparentBg && images.scene)
    drawCover(ctx, images.scene, 0, 0, width, height);
  for (const e of layout.els) {
    if (!e.vis) continue;
    ctx.save();
    drawElement(ctx, e, layout, images, width);
    ctx.restore();
  }
}

export interface ICExportOptions {
  width?: number;
  format?: 'png' | 'jpeg';
  /** 0 to 1, JPEG only. */
  quality?: number;
  /** PNG only: drops the background and scene for this export, keeping the saved design as is. */
  transparentBg?: boolean;
}

/** Draws the finished design at export size and returns it as a PNG or JPEG data URL. */
export async function composeLayout(
  layout: ICLayout,
  sceneUrl: string | null,
  opts: ICExportOptions = {},
): Promise<string> {
  const { width = IC_OUTPUT_SIZE, format = 'png', quality = 0.92, transparentBg = false } = opts;
  const [images] = await Promise.all([loadImages(layout, sceneUrl), loadFonts()]);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = canvasHeight(layout, width);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the design.');
  // JPEG has no transparency; without this a transparent background exports black.
  if (format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawLayout(ctx, layout, images, width, { transparentBg: format === 'png' && transparentBg });
  return format === 'jpeg'
    ? canvas.toDataURL('image/jpeg', quality)
    : canvas.toDataURL('image/png');
}
