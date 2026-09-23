import { artDef, artFit, artPalette, artUnpalette } from './image-constructor-art.js';
import type { ICAvatarConfig } from './image-constructor-avatar.js';
import type { ICCutout } from './image-constructor-cutout.js';
import type { ICFont } from './image-constructor-font-list.js';
import { type ICRole, type ICRoles, PALETTES } from './image-constructor-palettes.js';
import { isSample, sampleUrl } from './image-constructor-samples.js';

export { IC_FONT_LABELS, IC_FONT_STACKS, type ICFont } from './image-constructor-font-list.js';
export type { ICRole } from './image-constructor-palettes.js';

// The design document for the Compose image node. The model paints only the scene.
// Text, shapes and the product are layers stored here.

export type ICModel = 'flux2-klein' | 'sd2.1';

export const IC_OUTPUT_SIZE = 1080;

/** Real recommended pixel size for a named social post type. The canvas itself only
 *  uses the aspect ratio derived from this below; actual export resolution is a
 *  separate choice in the Export popover's own Size picker. */
const NAMED_SIZES = {
  'x-post': { width: 1600, height: 900 },
  'linkedin-post': { width: 1200, height: 1200 },
  'ig-post': { width: 1080, height: 1080 },
  'ig-story': { width: 1080, height: 1920 },
  'tiktok-story': { width: 1080, height: 1920 },
  'yt-thumbnail': { width: 1280, height: 720 },
} satisfies Record<string, { width: number; height: number }>;

/** '1:1'/'4:5'/'3:4' are the original generic ratios, and can still be a template's
 *  own native ratio. The rest are named post types with a real pixel size. */
export type ICRatio = '1:1' | '4:5' | '3:4' | keyof typeof NAMED_SIZES;

export const RATIO_DIMENSIONS: Partial<Record<ICRatio, { width: number; height: number }>> =
  NAMED_SIZES;

const RATIO_HEIGHT: Record<ICRatio, number> = {
  '1:1': 1,
  '4:5': 1.25,
  '3:4': 4 / 3,
  ...(Object.fromEntries(
    Object.entries(NAMED_SIZES).map(([id, { width, height }]) => [id, height / width]),
  ) as Record<keyof typeof NAMED_SIZES, number>),
};

/** Canvas height over canvas width. */
export function ratioHeight(ratio: ICRatio | undefined): number {
  return RATIO_HEIGHT[ratio ?? '1:1'];
}

interface ICBase {
  id: string;
  /** Percent of the canvas width for x, percent of the canvas height for y. */
  x: number;
  y: number;
  vis: boolean;
  /** Degrees, turning around the layer's center. */
  rot?: number;
  /** Opacity from 0 to 1. */
  op?: number;
  /** Template layers are rebuilt on a template switch, user layers are kept. */
  user?: boolean;
  /** The palette role each color plays, so choosing a palette recolors the design. */
  pal?: { color?: ICRole; fill?: ICRole; stroke?: ICRole };
  /** Mirrored left to right. Only exposed in the UI for photo layers. */
  flip?: boolean;
  /** Blocks move, resize and crop dragging. Duplicate and delete still work. */
  lock?: boolean;
  /** Shared by every member of a Canva-style group. Selecting one selects them all. */
  groupId?: string;
}

export interface ICText extends ICBase {
  t: 'text';
  role: string;
  w: number;
  text: string;
  /** Percent of the canvas width. Lines break only where `text` has a newline. */
  size: number;
  weight: number;
  font: ICFont;
  color: string;
  align: 'left' | 'center' | 'right';
  /** Letter spacing in em. */
  track: number;
  lh: number;
}

export interface ICPill extends ICBase {
  t: 'pill';
  role: string;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  text: string;
  size: number;
  weight: number;
  font: ICFont;
  color: string;
  track: number;
}

export interface ICLine extends ICBase {
  t: 'line';
  w: number;
  /** Thickness in percent of the canvas width. */
  th: number;
  color: string;
}

export interface ICShape extends ICBase {
  t: 'shape';
  kind: 'rect' | 'ellipse';
  w: number;
  /** Percent of the canvas height. */
  h: number;
  fill: string;
  stroke: string;
  /** Stroke width and corner radius, in percent of the canvas width. */
  sw: number;
  radius: number;
}

export interface ICArtEl extends ICBase {
  t: 'art';
  /** An id from the art library. */
  art: string;
  w: number;
  /** A color for each slot the drawing has. */
  colors: Record<string, string>;
}

/** A config-driven character: skin, head feature, top, bottom, shoes, accessories, a text
 *  line, composed into one SVG. See `image-constructor-avatar.ts`. */
export interface ICAvatarEl extends ICBase {
  t: 'avatar';
  w: number;
  config: ICAvatarConfig;
}

/** The visible part of a picture, as fractions of the whole picture. */
export interface ICCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_CROP: ICCrop = { x: 0, y: 0, w: 1, h: 1 };

/** How much wider than tall a crop makes a picture, relative to the uncropped one. */
export const cropRatio = (crop: ICCrop | undefined): number => (crop ? crop.w / crop.h : 1);

export interface ICSubject extends ICBase {
  t: 'subject';
  w: number;
  crop?: ICCrop;
  shadow: boolean;
  /** A faded mirror image under the product, for a glossy floor. */
  reflect?: boolean;
}

export interface ICImage extends ICBase {
  t: 'image';
  w: number;
  crop?: ICCrop;
  /** When set, the image fills a box of this height and is cropped to cover it. Percent of the canvas height. */
  h?: number;
  /** Corner radius in percent of the canvas width. */
  radius?: number;
  /** The photo as uploaded, kept while a background removal is applied to `url`. */
  original?: string;
  cut?: ICCutout;
  name: string;
  url: string;
  ratio: number;
}

export type ICElement =
  | ICText
  | ICPill
  | ICLine
  | ICShape
  | ICSubject
  | ICImage
  | ICArtEl
  | ICAvatarEl;

/** A photo whose crop can be adjusted: the product photo, or an image layer sized by its own ratio. */
export function isCroppable(e: ICElement): boolean {
  return e.t === 'subject' || (e.t === 'image' && e.h === undefined);
}

export interface ICBackground {
  mode: 'solid' | 'gradient' | 'transparent';
  color: string;
  from: string;
  to: string;
  angle: number;
}

export interface ICUpload {
  name: string;
  url: string;
}

export interface ICSubjectImage extends ICUpload {
  /** Width over height. */
  ratio: number;
  /** Placeholder art included with a template, replaced by the user's photo. */
  sample?: boolean;
  /** The photo as uploaded, kept while a background removal is applied to `url`. */
  original?: string;
  cut?: ICCutout;
}

export interface ICLayout {
  v: 1;
  templateId: string;
  /** Absent on layouts saved before portrait sizes existed. Absent means square. */
  ratio?: ICRatio;
  /** The palette applied last, so it survives a template or ratio change. */
  palette?: string;
  prompt: string;
  model: ICModel;
  seed: number;
  /** `upload` replaces the generated scene with the user's own image. */
  scene: { on: boolean; upload: ICUpload | null };
  bg: ICBackground;
  subject: ICSubjectImage;
  els: ICElement[];
}

/** The generated scene kept on the node so the studio and later runs reuse the same pixels. */
export interface ICSceneCache {
  key: string;
  url: string;
}

export interface ICTemplate {
  id: string;
  title: string;
  /** Pack name, such as Product. A new category is a new pack of templates. */
  pack: string;
  ratio: ICRatio;
  /** Whether the template starts with a generated scene. Type-led designs use the background alone. */
  scene: boolean;
  scenePrompt: string;
  seed: number;
  model: ICModel;
  /** Placeholder art for this product type. */
  subject?: ICSubjectImage;
  /** Backdrop shown while there is no scene, also the card thumbnail color. */
  thumb: string;
  bg: ICBackground;
  els: ICElement[];
  /** Hand-made layouts for the other ratios. Roles and order match `els`, so typed words stay in place. */
  variants?: Partial<Record<ICRatio, ICElement[]>>;
  source: { author: string; url: string } | null;
}

const SCENE_DIMS: Record<ICModel, Record<ICRatio, [number, number]>> = {
  'flux2-klein': {
    '1:1': [1024, 1024],
    '4:5': [832, 1024],
    '3:4': [768, 1024],
    'x-post': [1024, 576],
    'linkedin-post': [1024, 1024],
    'ig-post': [1024, 1024],
    'ig-story': [576, 1024],
    'tiktok-story': [576, 1024],
    'yt-thumbnail': [1024, 576],
  },
  'sd2.1': {
    '1:1': [768, 768],
    '4:5': [640, 768],
    '3:4': [576, 768],
    'x-post': [768, 432],
    'linkedin-post': [768, 768],
    'ig-post': [768, 768],
    'ig-story': [432, 768],
    'tiktok-story': [432, 768],
    'yt-thumbnail': [768, 432],
  },
};

/** Generation size for a model and ratio, in multiples the models accept. */
export function sceneSize(
  model: ICModel,
  ratio: ICRatio | undefined,
): { width: number; height: number } {
  const [width, height] = SCENE_DIMS[model][ratio ?? '1:1'];
  return { width, height };
}

export function sceneKey(layout: ICLayout): string {
  const { width, height } = sceneSize(layout.model, layout.ratio);
  return JSON.stringify([layout.model, layout.seed, width, height, layout.prompt]);
}

let counter = 0;
export function newElementId(): string {
  counter += 1;
  return `u${Date.now().toString(36)}${counter}`;
}

const roleKey = (e: ICElement, seen: Map<string, number>): string | null => {
  if (e.t !== 'text' && e.t !== 'pill') return null;
  const n = seen.get(e.role) ?? 0;
  seen.set(e.role, n + 1);
  return `${e.role}#${n}`;
};

export type ICOrientation = 'square' | 'portrait' | 'landscape';

export function orientationOf(ratio: ICRatio): ICOrientation {
  const h = ratioHeight(ratio);
  if (Math.abs(h - 1) < 0.01) return 'square';
  return h > 1 ? 'portrait' : 'landscape';
}

/** The hand-made layout for a ratio. An exact variant wins; otherwise any variant
 *  sharing the wanted square, portrait, or landscape orientation. A new named post
 *  type needs no code change here to land on the nearest layout a template has. */
export function elementsFor(template: ICTemplate, ratio: ICRatio): ICElement[] {
  if (ratio === template.ratio) return template.els;
  const exact = template.variants?.[ratio];
  if (exact) return exact;
  const want = orientationOf(ratio);
  if (want === orientationOf(template.ratio)) return template.els;
  for (const [r, els] of Object.entries(template.variants ?? {})) {
    if (orientationOf(r as ICRatio) === want) return els as ICElement[];
  }
  return template.els;
}

/** Orientations a template actually has a hand-made layout for, so the ratio picker
 *  can grey out a size it would only render as a squeezed, unoptimized fallback. */
export function supportedOrientations(template: ICTemplate): Set<ICOrientation> {
  const set = new Set<ICOrientation>([orientationOf(template.ratio)]);
  for (const r of Object.keys(template.variants ?? {})) set.add(orientationOf(r as ICRatio));
  return set;
}

/** X when a template has a landscape layout, IG Post otherwise. Real post sizes only,
 *  never the template's own generic native ratio (e.g. '3:4'). */
export function defaultRatio(template: ICTemplate): ICRatio {
  const supported = supportedOrientations(template);
  return supported.has(orientationOf('x-post')) ? 'x-post' : 'ig-post';
}

/** Re-breaks the words you typed into the number of lines the box was designed for. */
function refit(words: string, designed: string): string {
  const lines = designed.split('\n').length;
  const flat = words.replace(/\s*\n\s*/g, ' ').trim();
  if (lines === 1) return flat;
  const parts = flat.split(' ');
  const per = Math.ceil(parts.length / lines);
  return Array.from({ length: lines }, (_, i) => parts.slice(i * per, (i + 1) * per).join(' '))
    .filter(Boolean)
    .join('\n');
}

/**
 * Builds a layout from a template, keeping the previous layout's product and user layers.
 * Words you typed are kept only where you changed the previous template's own copy.
 */
export function layoutFromTemplate(
  template: ICTemplate,
  previous?: ICLayout,
  previousTemplate?: ICTemplate,
  ratio: ICRatio = template.ratio,
): ICLayout {
  const own = new Map<string, string>();
  const ownSeen = new Map<string, number>();
  for (const e of previousTemplate?.els ?? []) {
    const key = roleKey(e, ownSeen);
    if (key && (e.t === 'text' || e.t === 'pill')) own.set(key, e.text);
  }
  const words = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const e of previous?.els ?? []) {
    const key = roleKey(e, seen);
    if (key && !e.user && (e.t === 'text' || e.t === 'pill') && e.text !== own.get(key)) {
      words.set(key, e.text);
    }
  }
  const fresh = new Map<string, number>();
  const els = structuredClone(elementsFor(template, ratio)).map((e) => {
    const key = roleKey(e, fresh);
    const typed = key ? words.get(key) : undefined;
    return typed !== undefined && (e.t === 'text' || e.t === 'pill')
      ? { ...e, text: refit(typed, e.text) }
      : e;
  });
  const built: ICLayout = {
    v: 1,
    templateId: template.id,
    ratio,
    prompt: template.scenePrompt,
    model: previous?.model ?? template.model,
    seed: template.seed,
    scene: { on: template.scene, upload: previous?.scene.upload ?? null },
    bg: structuredClone(template.bg),
    subject:
      previous && !previous.subject.sample
        ? previous.subject
        : (template.subject ?? SAMPLE_SUBJECT),
    // Layers the user added belong to that design. A ratio change keeps them, another template does not.
    els: [
      ...els,
      ...(previousTemplate?.id === template.id ? (previous?.els.filter((e) => e.user) ?? []) : []),
    ],
  };
  return previous?.palette ? applyPalette(built, previous.palette) : built;
}

/** The placeholder product follows the palette. A photo the user chose keeps its own pixels. */
const recolorSubject = (s: ICSubjectImage, roles?: ICRoles, backdrop?: string[]): ICSubjectImage =>
  s.sample && !s.original && isSample(s.name)
    ? { ...s, url: sampleUrl(s.name, roles, backdrop) }
    : s;

/** Contrast a figure needs against the background so it does not blend in. */
export const FIGURE_MIN = 1.6;

/** The background colors figures must stand out from. A scene image hides the background. */
export function figureBackdrop(layout: ICLayout): string[] {
  if (layout.scene.on) return [];
  const { bg } = layout;
  if (bg.mode === 'gradient') return [bg.from, bg.to];
  return bg.mode === 'solid' ? [bg.color] : [];
}

const isSampleImage = (e: ICElement): e is ICImage =>
  e.t === 'image' && !e.user && !e.original && isSample(e.name);

export const paletteRoles = (id: string | undefined): ICRoles | undefined =>
  PALETTES.find((p) => p.id === id)?.roles;

const recolor = (e: ICElement, roles: ICRoles): ICElement => {
  if (e.t === 'art') {
    const def = artDef(e.art);
    return def ? { ...e, colors: { ...e.colors, ...artPalette(def, roles) } } : e;
  }
  if (isSampleImage(e)) return { ...e, url: sampleUrl(e.name, roles) };
  if (!e.pal) return e;
  const next: Record<string, string> = {};
  for (const key of ['color', 'fill', 'stroke'] as const) {
    const role = e.pal[key];
    if (role) next[key] = roles[role];
  }
  return { ...e, ...next } as ICElement;
};

/** Recolors the background and every layer tagged with a palette role. */
/**
 * Keeps characters and the sample product readable on the current background. With a palette on,
 * character colors are rebuilt from it first, so a background that changes back restores them.
 */
export function fitFigures(layout: ICLayout): ICLayout {
  const backdrop = figureBackdrop(layout);
  const roles = paletteRoles(layout.palette);
  return {
    ...layout,
    subject: recolorSubject(layout.subject, roles, backdrop),
    els: layout.els.map((e) => {
      if (e.t !== 'art') return e;
      const def = artDef(e.art);
      if (!def) return e;
      const base = roles ? { ...e.colors, ...artPalette(def, roles) } : e.colors;
      return { ...e, colors: artFit(def, base, backdrop, FIGURE_MIN) };
    }),
  };
}

export function applyPalette(layout: ICLayout, paletteId: string): ICLayout {
  const palette = PALETTES.find((p) => p.id === paletteId);
  if (!palette) return layout;
  const { roles } = palette;
  return fitFigures({
    ...layout,
    palette: paletteId,
    bg:
      layout.bg.mode === 'gradient'
        ? { ...layout.bg, color: roles.bg, from: roles.bg, to: roles.bg2 }
        : { ...layout.bg, mode: 'solid', color: roles.bg, from: roles.bg, to: roles.bg },
    els: layout.els.map((e) => recolor(e, roles)),
  });
}

/** Puts the template's own colors back. */
export function resetPalette(layout: ICLayout, template: ICTemplate): ICLayout {
  const original = new Map(
    elementsFor(template, layout.ratio ?? template.ratio).map((e) => [e.id, e]),
  );
  return {
    ...layout,
    palette: undefined,
    bg: structuredClone(template.bg),
    subject: recolorSubject(layout.subject),
    els: layout.els.map((e) => {
      if (e.t === 'art') {
        const def = artDef(e.art);
        return def ? { ...e, colors: { ...e.colors, ...artUnpalette(def) } } : e;
      }
      if (isSampleImage(e)) return { ...e, url: sampleUrl(e.name) };
      const from = original.get(e.id);
      if (!from || !e.pal || e.user) return e;
      const next: Record<string, unknown> = {};
      for (const key of ['color', 'fill', 'stroke'] as const) {
        if (e.pal[key]) next[key] = (from as unknown as Record<string, unknown>)[key];
      }
      return { ...e, ...next } as ICElement;
    }),
  };
}

const SAMPLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="160" viewBox="0 0 100 160">' +
  '<rect x="34" y="6" width="32" height="30" rx="8" fill="#d9dde3"/><rect x="42" y="30" width="16" height="14" fill="#9aa1ab"/>' +
  '<rect x="20" y="42" width="60" height="112" rx="16" fill="#8fd6a2"/><rect x="28" y="70" width="44" height="46" rx="6" fill="#fff" opacity=".9"/>' +
  '<rect x="34" y="80" width="32" height="5" fill="#333"/><rect x="34" y="92" width="22" height="4" fill="#999"/>' +
  '<rect x="26" y="50" width="8" height="94" rx="4" fill="#fff" opacity=".28"/></svg>';

/** A transparent sample so a fresh node works before anyone uploads a product. */
export const SAMPLE_SUBJECT: ICSubjectImage = {
  name: 'sample-bottle.svg',
  url: `data:image/svg+xml;utf8,${encodeURIComponent(SAMPLE_SVG)}`,
  ratio: 0.625,
  sample: true,
};

export function parseLayout(raw: string | undefined): ICLayout | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ICLayout>;
    return value.v === 1 && Array.isArray(value.els) && value.scene && value.bg && value.subject
      ? (value as ICLayout)
      : null;
  } catch {
    return null;
  }
}

export function parseSceneCache(raw: string | undefined): ICSceneCache | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ICSceneCache>;
    return typeof value.key === 'string' && typeof value.url === 'string'
      ? (value as ICSceneCache)
      : null;
  } catch {
    return null;
  }
}
