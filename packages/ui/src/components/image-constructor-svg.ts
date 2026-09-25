import { artBody, artFor } from './image-constructor-art.js';
import { avatarBody } from './image-constructor-avatar.js';
import { isCode } from './image-constructor-code.js';
import { fetchFontFace, fontFamily, isFixedWeight } from './image-constructor-font-list.js';
import {
  FULL_CROP,
  IC_FONT_STACKS,
  IC_OUTPUT_SIZE,
  type ICCrop,
  type ICElement,
  type ICFont,
  type ICLayout,
} from './image-constructor-layout.js';
import { canvasHeight, isTop, layerBox, topPlacement } from './image-constructor-render.js';

// A second renderer next to image-constructor-render.ts's canvas one: real <text>,
// <rect>, <ellipse> and <line>, so text and shapes stay editable in whatever the
// design opens in next. Photos and the AI background stay raster: they already are.

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string,
  );
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** The 'H' cap-height ascent for a font, the same metric image-constructor-render.ts
 *  centers a text line on, so a multi-line block lands in the same place either way. */
function capAscent(font: ICFont, weight: number, sizePx: number): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return sizePx * 0.35;
  measureCtx.font = `${isFixedWeight(font) ? 400 : weight} ${sizePx}px ${IC_FONT_STACKS[font]}`;
  return measureCtx.measureText('H').actualBoundingBoxAscent;
}

function svgTransform(e: ICElement, box: { x: number; y: number; w: number; h: number }): string {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const parts: string[] = [];
  if (e.rot) parts.push(`rotate(${e.rot} ${cx} ${cy})`);
  if (e.flip) parts.push(`translate(${cx} 0) scale(-1 1) translate(${-cx} 0)`);
  return parts.length ? ` transform="${parts.join(' ')}"` : '';
}

/** Where an image element (in a box of `crop`'s fraction of the source) needs to be
 *  drawn and sized so the crop lines up, without ever needing the source's own pixel
 *  size: only the crop fractions and the box `layerBox` already worked out. */
function cropPlacement(
  box: { x: number; y: number; w: number; h: number },
  crop: ICCrop | undefined,
) {
  const c = crop ?? FULL_CROP;
  const w = box.w / c.w;
  const h = box.h / c.h;
  return { x: box.x - c.x * w, y: box.y - c.y * h, w, h };
}

/** Same result as image-constructor-render.ts's drawCover, worked out from the box
 *  and the source's aspect ratio alone: a `cover` fit never needs its pixel size either. */
function coverPlacement(box: { x: number; y: number; w: number; h: number }, ratio: number) {
  const w = Math.max(box.w, box.h * ratio);
  const h = Math.max(box.w / ratio, box.h);
  return { x: box.x - (w - box.w) / 2, y: box.y - (h - box.h) / 2, w, h };
}

function svgText(
  e: {
    text: string;
    size: number;
    weight: number;
    font: ICFont;
    color: string;
    align: 'left' | 'center' | 'right';
    track: number;
    lh: number;
  },
  box: { x: number; y: number; w: number },
  width: number,
): string {
  const px = (e.size / 100) * width;
  const anchor = e.align === 'center' ? 'middle' : e.align === 'right' ? 'end' : 'start';
  const x = e.align === 'center' ? box.x + box.w / 2 : e.align === 'right' ? box.x + box.w : box.x;
  const ascent = capAscent(e.font, e.weight, px);
  const lines = e.text.split('\n');
  const firstBaseline = box.y + (e.lh * px) / 2 + ascent / 2;
  const tspans = lines
    .map((line, i) => `<tspan x="${x}"${i > 0 ? ` dy="${e.lh * px}"` : ''}>${esc(line)}</tspan>`)
    .join('');
  const weightAttr = isFixedWeight(e.font) ? 400 : e.weight;
  return `<text x="${x}" y="${firstBaseline}" text-anchor="${anchor}" font-family="'${fontFamily(e.font)}'" font-size="${px}" font-weight="${weightAttr}" letter-spacing="${e.track * px}" fill="${e.color}">${tspans}</text>`;
}

function svgElement(e: ICElement, layout: ICLayout, width: number): string {
  const box = layerBox(e, layout, width);
  const opacity = e.op ?? 1;
  const opAttr = opacity < 1 ? ` opacity="${opacity}"` : '';
  const transform = svgTransform(e, box);

  if (e.t === 'line') {
    const h = Math.max((e.th / 100) * width, 6);
    return `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${h}" fill="${e.color}"${opAttr}${transform}/>`;
  }
  if (e.t === 'shape') {
    const common = `fill="${e.fill || 'none'}"${e.stroke && e.sw > 0 ? ` stroke="${e.stroke}" stroke-width="${(e.sw / 100) * width}"` : ''}${opAttr}${transform}`;
    if (e.kind === 'ellipse') {
      return `<ellipse cx="${box.x + box.w / 2}" cy="${box.y + box.h / 2}" rx="${box.w / 2}" ry="${box.h / 2}" ${common}/>`;
    }
    return `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${(e.radius / 100) * width}" ${common}/>`;
  }
  if (e.t === 'subject') {
    const p = cropPlacement(box, e.crop);
    const parts: string[] = [];
    if (e.shadow) {
      const rx = box.w * 0.62;
      const ry = rx * 0.09;
      parts.push(
        `<defs><radialGradient id="shadow-${e.id}"><stop offset="0%" stop-color="#000" stop-opacity="0.45"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient></defs>` +
          `<ellipse cx="${box.x + box.w / 2}" cy="${box.y + box.h * 0.97}" rx="${rx}" ry="${ry}" fill="url(#shadow-${e.id})"${opAttr}${transform}/>`,
      );
    }
    parts.push(
      `<clipPath id="clip-${e.id}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"/></clipPath>` +
        `<image href="${esc(layout.subject.url)}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" preserveAspectRatio="none" clip-path="url(#clip-${e.id})"${opAttr}${transform}/>`,
    );
    // The floor reflection is not carried over: it needs a fade mask this
    // renderer does not build yet, so a reflective design loses it in SVG.
    return parts.join('');
  }
  if (e.t === 'image' && e.fit === 'contain' && e.h !== undefined) {
    const w = Math.min(box.w, box.h * e.ratio);
    const h = w / e.ratio;
    return `<image href="${esc(e.url)}" x="${box.x + (box.w - w) / 2}" y="${box.y + (box.h - h) / 2}" width="${w}" height="${h}" preserveAspectRatio="none"${opAttr}${transform}/>`;
  }
  if (e.t === 'image') {
    const cover = e.h !== undefined;
    const p = cover
      ? isTop(e)
        ? topPlacement(box, e.ratio)
        : coverPlacement(box, e.ratio)
      : cropPlacement(box, e.crop);
    const radius = ((e.radius ?? 0) / 100) * width;
    return (
      `<clipPath id="clip-${e.id}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${radius}"/></clipPath>` +
      (cover && isTop(e)
        ? `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${radius}" fill="#000"${opAttr}${transform}/>`
        : '') +
      `<image href="${esc(e.url)}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" preserveAspectRatio="none" clip-path="url(#clip-${e.id})"${opAttr}${transform}/>`
    );
  }
  if (e.t === 'art') {
    const def = artFor(e);
    if (!def) return '';
    const [, , vw, vh] = def.viewBox.split(' ');
    const sx = box.w / Number(vw);
    const sy = box.h / Number(vh);
    return `<g${opAttr}${transform}><g transform="translate(${box.x} ${box.y}) scale(${sx} ${sy})">${artBody(def, e.colors)}</g></g>`;
  }
  if (e.t === 'avatar') {
    const sx = box.w / 60;
    const sy = box.h / 140;
    return `<g${opAttr}${transform}><g transform="translate(${box.x} ${box.y}) scale(${sx} ${sy})">${avatarBody(e.config)}</g></g>`;
  }
  if (e.t === 'text') {
    return `<g${opAttr}${transform}>${svgText(e, box, width)}</g>`;
  }
  // Pill: a rounded rect, fully round unless `radius` is set, with one centered line of text.
  const ascent = capAscent(e.font, e.weight, (e.size / 100) * width);
  const baseline = box.y + box.h / 2 + ascent / 2;
  const px = (e.size / 100) * width;
  const weightAttr = isFixedWeight(e.font) ? 400 : e.weight;
  return (
    `<g${opAttr}${transform}>` +
    `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${e.radius === undefined ? box.h / 2 : (e.radius / 100) * width}" fill="${e.fill || 'none'}"${e.stroke ? ` stroke="${e.stroke}"` : ''}/>` +
    `<text x="${box.x + box.w / 2}" y="${baseline}" text-anchor="middle" font-family="'${fontFamily(e.font)}'" font-size="${px}" font-weight="${weightAttr}" letter-spacing="${e.track * px}" fill="${e.color}">${esc(e.text)}</text>` +
    `</g>`
  );
}

function svgBackground(layout: ICLayout, w: number, h: number): string {
  const { bg } = layout;
  if (bg.mode === 'transparent') return '';
  if (bg.mode === 'solid')
    return `<rect x="0" y="0" width="${w}" height="${h}" fill="${bg.color}"/>`;
  // Same angle convention as image-constructor-render.ts's drawBackground: 0deg points up.
  const a = (bg.angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  return (
    `<defs><linearGradient id="bg-grad" gradientUnits="userSpaceOnUse" x1="${w / 2 - dx * half}" y1="${h / 2 - dy * half}" x2="${w / 2 + dx * half}" y2="${h / 2 + dy * half}">` +
    `<stop offset="0%" stop-color="${bg.from}"/><stop offset="100%" stop-color="${bg.to}"/></linearGradient></defs>` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#bg-grad)"/>`
  );
}

function collectUsedFonts(layout: ICLayout): ICFont[] {
  const used = new Set<ICFont>();
  for (const e of layout.els) {
    if (e.t === 'text' || e.t === 'pill') used.add(e.font);
    else if (e.t === 'avatar' && e.config.text.trim()) used.add(e.config.textFont);
    else if (e.t === 'art' && isCode(e.art)) used.add('geist-mono');
  }
  return [...used];
}

/** Embeds only the faces the design actually uses, so the SVG renders with the
 *  right font on a machine that never installed it, the same as the studio's own
 *  bundled faces (apps/web/public/fonts). A face that fails to fetch is skipped. */
async function embedFontFaces(fonts: ICFont[]): Promise<string> {
  const faces = await Promise.all(fonts.map(fetchFontFace));
  return faces.filter((f): f is string => f !== null).join('');
}

/** A real vector SVG of the design: editable text and shapes, embedded photos and
 *  scene, fonts embedded as base64 so it renders the same on a machine without them. */
export async function composeLayoutSvg(
  layout: ICLayout,
  sceneUrl: string | null,
  width = IC_OUTPUT_SIZE,
): Promise<string> {
  const height = canvasHeight(layout, width);
  const fontCss = await embedFontFaces(collectUsedFonts(layout));
  const body: string[] = [svgBackground(layout, width, height)];
  if (layout.scene.on) {
    const src = layout.scene.upload?.url ?? sceneUrl;
    if (src) {
      body.push(
        `<image href="${esc(src)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`,
      );
    }
  }
  for (const e of layout.els) {
    if (!e.vis) continue;
    body.push(svgElement(e, layout, width));
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    (fontCss ? `<defs><style>${fontCss}</style></defs>` : '') +
    body.join('') +
    `</svg>`
  );
}
