import {
  ART,
  artDef,
  artFit,
  artPalette,
  artUnpalette,
  type ICArtDef,
} from './image-constructor-art.js';
import { frameFor, isFrameArt } from './image-constructor-art-web3.js';
import type { ICAvatarConfig } from './image-constructor-avatar.js';
import { type BrandKit, LOGO_SLOT, rolesFrom } from './image-constructor-brand-kit.js';
import type { ICCutout } from './image-constructor-cutout.js';
import type { ICChartData } from './image-constructor-charts.js';
import { shrinkToFit } from './image-constructor-fit.js';
import { type ICFont, isMonoFont } from './image-constructor-font-list.js';
import { type ICRole, type ICRoles, legible, mix, PALETTES } from './image-constructor-palettes.js';
import {
  isPattern,
  PATTERN_STYLES,
  patternFor,
  patternId,
  patternSeed,
  type PatternStyle,
} from './image-constructor-patterns.js';
import { isSample, sampleUrl } from './image-constructor-samples.js';
import type { ICCodeData } from './image-constructor-code.js';

export { IC_FONT_LABELS, IC_FONT_STACKS, type ICFont } from './image-constructor-font-list.js';
export type { ICRole } from './image-constructor-palettes.js';

// The design document for the Create design node. The model paints only the scene.
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
  // IG Story and TikTok Story were two entries at the exact same 1080x1920, and
  // YouTube Thumbnail is gone (user), so this covers both story-shaped platforms.
  story: { width: 1080, height: 1920 },
} satisfies Record<string, { width: number; height: number }>;

/** '1:1'/'4:5'/'3:4' are the original generic ratios, and can still be a template's
 *  own native ratio. The rest are named post types with a real pixel size. 'custom'
 *  is a user-typed width/height, in `ICLayout.customSize`. */
export type ICRatio = '1:1' | '4:5' | '3:4' | 'custom' | keyof typeof NAMED_SIZES;

export const RATIO_DIMENSIONS: Partial<Record<ICRatio, { width: number; height: number }>> =
  NAMED_SIZES;

const RATIO_HEIGHT: Record<ICRatio, number> = {
  '1:1': 1,
  '4:5': 1.25,
  '3:4': 4 / 3,
  // No real size chosen yet reads as square; callers that know the actual
  // `ICLayout.customSize` pass it in as `custom` below instead of hitting this.
  custom: 1,
  ...(Object.fromEntries(
    Object.entries(NAMED_SIZES).map(([id, { width, height }]) => [id, height / width]),
  ) as Record<keyof typeof NAMED_SIZES, number>),
};

/** Canvas height over canvas width. `custom` is the layout's own typed size, since
 *  it has no fixed entry in the table above. */
export function ratioHeight(
  ratio: ICRatio | undefined,
  custom?: { width: number; height: number },
): number {
  if (ratio === 'custom' && custom && custom.width > 0) return custom.height / custom.width;
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
  pal?: { color?: ICRole; fill?: ICRole; stroke?: ICRole; side?: ICSide };
  /** Mirrored left to right. Only exposed in the UI for photo layers. */
  flip?: boolean;
  /** Blocks move, resize and crop dragging. Duplicate and delete still work. */
  lock?: boolean;
  /** Shared by every member of a Canva-style group. Selecting one selects them all. */
  groupId?: string;
  /** Names this layer as a slot a workflow can fill; see image-constructor-slots.ts. */
  slot?: string;
}

/** Brand details that belong to the person, not to one template. */
export interface ICShared {
  logo?: { url: string; ratio: number };
  partnerLogo?: { url: string; ratio: number };
  partner?: ICRoles;
  brandName?: string;
  partnerName?: string;
  url?: string;
}

/** A layer's place and scale on one canvas size; its content and style are shared by every size. */
export interface ICGeom {
  x: number;
  y: number;
  w?: number;
  h?: number;
  size?: number;
  rot?: number;
}

/** In a co-brand design, which brand a layer belongs to: `a` follows the kit, `b` the partner. */
export type ICSide = 'a' | 'b';

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
  /** Corner radius in percent of the canvas width. Absent means fully round. */
  radius?: number;
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
  /** A chart's numbers; see `image-constructor-charts.ts`. */
  data?: ICChartData;
  /** A code window's code; see `image-constructor-code.ts`. */
  code?: ICCodeData;
  /** The box a swapped shape fits in, in canvas-width units, and the width the last swap gave it.
   *  Kept so repeated swaps don't shrink the shape; a width change by hand starts a new box. */
  swapBox?: { w: number; h: number; last: number };
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
  /** With `h`: shown whole and centered in its box instead of cropped to fill it, so a logo of
   *  any shape can replace another without the layer changing size. `top` fills the box's width
   *  from the top down and crops only the bottom, as a phone shows a screenshot. */
  fit?: 'contain' | 'top';
  /** The photo as uploaded, kept while a background removal is applied to `url`. */
  original?: string;
  cut?: ICCutout;
  name: string;
  url: string;
  ratio: number;
  /** Set on an AI element, so Regenerate can paint another take of the same prompt. */
  gen?: { prompt: string; model: ICModel; seed: number };
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
  /** 1 once a partner logo saved by an older version has been cleared; see `cleanSession`. */
  partnerV?: 1;
  /** 2 once the layer ids match templates numbered by place; see `upgradeIds`. */
  idsV?: 2;
  /** Set when the person picked the partner color, directly or from a logo. Otherwise it follows
   *  the brand; see `brandPartner`. */
  partnerOwn?: boolean;
  templateId: string;
  /** Absent on layouts saved before portrait sizes existed. Absent means square. */
  ratio?: ICRatio;
  /** Only set, and only meaningful, when `ratio` is 'custom'. */
  customSize?: { width: number; height: number };
  /** The palette applied last, so it survives a template or ratio change. */
  palette?: string;
  /** A snapshot of the brand kit applied last. Replaces `palette` while set. */
  kit?: BrandKit;
  /** A co-brand design's second brand: the roles every layer on side `b` is colored with. */
  partner?: ICRoles;
  /** Where each layer sat in each size the design has been, by size key, so going back restores it. */
  sizes?: Record<string, Record<string, ICGeom>>;
  /** Extra sizes for exporting, beyond the named post types. */
  exportSizes?: { width: number; height: number }[];
  /** The person's own version of each template they left, by template id, so going back restores it. */
  drafts?: Record<string, ICLayout>;
  /** Brand details set once and used by every template opened after: see `captureShared`. */
  shared?: ICShared;
  /** The library entry this design was opened from or saved to, so Save updates it. */
  saved?: { id: string; name: string };
  /** A thread: several cards, one per post. This layout is page `at`; see image-constructor-thread.ts. */
  thread?: ICThread;
  prompt: string;
  model: ICModel;
  seed: number;
  /** `upload` replaces the generated scene with the user's own image. */
  scene: { on: boolean; upload: ICUpload | null };
  bg: ICBackground;
  subject: ICSubjectImage;
  els: ICElement[];
}

/** A thread's pages, each a design of its own. `pages[at]` is out of date while it's the open page. */
export interface ICThread {
  /** The thread template the pages came from, as listed in the picker. */
  root: string;
  pages: ICLayout[];
  at: number;
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
  /** The brand a template is drawn in. A design made from it starts with this kit applied. */
  kit?: BrandKit;
  /** Within a pack that comes in several brands: which brand, and which layout the brands share. */
  brand?: string;
  family?: string;
  /** A co-brand template's partner colors until the person picks their own. */
  partner?: ICRoles;
  /** A thread template: the pages it starts with, then the kinds of page Add page offers. Ids of
   *  templates; the first page is this template itself. */
  thread?: { pages: string[]; kinds: string[] };
  /** One page of a thread, opened through its thread and left out of the picker. */
  hidden?: boolean;
}

const SCENE_DIMS: Record<ICModel, Record<ICRatio, [number, number]>> = {
  'flux2-klein': {
    '1:1': [1024, 1024],
    '4:5': [832, 1024],
    '3:4': [768, 1024],
    // A custom canvas asks for a scene at the model's own square size; the scene
    // then covers/crops to the real custom aspect the same way an upload does.
    custom: [1024, 1024],
    'x-post': [1024, 576],
    'linkedin-post': [1024, 1024],
    'ig-post': [1024, 1024],
    story: [576, 1024],
  },
  'sd2.1': {
    '1:1': [768, 768],
    '4:5': [640, 768],
    '3:4': [576, 768],
    custom: [768, 768],
    'x-post': [768, 432],
    'linkedin-post': [768, 768],
    'ig-post': [768, 768],
    story: [432, 768],
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
export function refit(words: string, designed: string): string {
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
  // The previous template's own words at every size. Text that matches any of them, line breaks
  // and spacing aside, was never edited and stays behind.
  const flat = (text: string) => text.replace(/\s+/g, ' ').trim();
  const own = new Map<string, Set<string>>();
  const variants = previousTemplate
    ? [previousTemplate.els, ...Object.values(previousTemplate.variants ?? {})]
    : [];
  for (const els of variants) {
    const ownSeen = new Map<string, number>();
    for (const e of els ?? []) {
      const key = roleKey(e, ownSeen);
      if (!key || (e.t !== 'text' && e.t !== 'pill')) continue;
      if (!own.has(key)) own.set(key, new Set());
      own.get(key)?.add(flat(e.text));
    }
  }
  const words = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const e of previous?.els ?? []) {
    const key = roleKey(e, seen);
    if (key && !e.user && (e.t === 'text' || e.t === 'pill') && !own.get(key)?.has(flat(e.text))) {
      words.set(key, e.text);
    }
  }
  // Pictures swapped into a named slot, such as a partner's logo, carry over like words do.
  const ownImages = new Map(
    (previousTemplate?.els ?? []).flatMap((e) =>
      e.t === 'image' && e.slot ? [[e.slot, e.url]] : [],
    ),
  );
  const images = new Map(
    (previous?.els ?? []).flatMap((e) =>
      e.t === 'image' && e.slot && !e.user && e.url !== ownImages.get(e.slot) ? [[e.slot, e]] : [],
    ),
  );
  const fresh = new Map<string, number>();
  const els = structuredClone(sizeElements(template, ratio, previous?.customSize)).map((e) => {
    const key = roleKey(e, fresh);
    const typed = key ? words.get(key) : undefined;
    if (typed !== undefined && (e.t === 'text' || e.t === 'pill')) {
      return { ...e, text: refit(typed, e.text) };
    }
    const picked = e.t === 'image' && e.slot ? images.get(e.slot) : undefined;
    return picked?.t === 'image'
      ? { ...e, url: picked.url, ratio: picked.ratio, name: picked.name }
      : e;
  });
  const built: ICLayout = {
    v: 1,
    templateId: template.id,
    ratio,
    kit: template.kit,
    // A partner color the person picked carries to the next co-brand template; a default one does not.
    partner:
      template.partner &&
      previous?.partner &&
      previous.partner.accent !== previousTemplate?.partner?.accent
        ? previous.partner
        : template.partner,
    // Nothing else here carries a custom size, so it would otherwise vanish (ratio
    // staying 'custom' with no real dimensions) on the next ratio change, template
    // switch, or reset.
    customSize: ratio === 'custom' ? previous?.customSize : undefined,
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
  // A kit the person applied outlives a size or template change; a template's own kit does not.
  const chosenKit = previous?.kit?.id !== previousTemplate?.kit?.id ? previous?.kit : undefined;
  if (chosenKit && chosenKit.id !== template.kit?.id) return applyBrandKit(built, chosenKit);
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

/** The roles the design is colored with: its brand kit's, else its quick palette's. */
/** The design's roles, or ones read off its background when neither a kit nor a palette is on. */
export function designRoles(layout: ICLayout): ICRoles {
  const found = layoutRoles(layout);
  if (found) return found;
  const bg =
    layout.bg.mode === 'gradient'
      ? layout.bg.from
      : layout.bg.mode === 'solid'
        ? layout.bg.color
        : '#ffffff';
  return rolesFrom({ bg, surface: mix(bg, '#888888', 0.12), ink: '#111111', accent: '#6366f1' })
    .roles;
}

export const layoutRoles = (layout: ICLayout): ICRoles | undefined =>
  layout.kit?.roles ?? PALETTES.find((p) => p.id === layout.palette)?.roles;

/** The roles a layer is colored with: the partner's on side `b`, the design's everywhere else. */
const sideRoles = (e: ICElement, roles: ICRoles, partner?: ICRoles): ICRoles =>
  e.pal?.side === 'b' && partner ? partner : roles;

const recolor = (e: ICElement, all: ICRoles, partner?: ICRoles): ICElement => {
  const roles = sideRoles(e, all, partner);
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
  const roles = layoutRoles(layout);
  return {
    ...layout,
    subject: recolorSubject(layout.subject, roles, backdrop),
    els: layout.els.map((e) => {
      if (e.t !== 'art') return e;
      const def = artDef(e.art);
      if (!def) return e;
      const own = roles && sideRoles(e, roles, layout.partner);
      const base = own ? { ...e.colors, ...artPalette(def, own) } : e.colors;
      return { ...e, colors: artFit(def, base, backdrop, FIGURE_MIN) };
    }),
  };
}

function withRoles(layout: ICLayout, roles: ICRoles): ICLayout {
  return {
    ...layout,
    bg:
      layout.bg.mode === 'gradient'
        ? { ...layout.bg, color: roles.bg, from: roles.bg, to: roles.bg2 }
        : { ...layout.bg, mode: 'solid', color: roles.bg, from: roles.bg, to: roles.bg },
    els: layout.els.map((e) => {
      const next = recolor(e, roles, layout.partner);
      // Fixed-color text, such as a warning label, moves only as far as the new background needs.
      // Text sitting on its own neutral card opts out with an empty `pal`.
      return next.t === 'text' && !next.pal
        ? { ...next, color: legible(next.color, [roles.bg], 3) }
        : next;
    }),
  };
}

export function applyPalette(layout: ICLayout, paletteId: string): ICLayout {
  const palette = PALETTES.find((p) => p.id === paletteId);
  if (!palette) return layout;
  return followBrand(
    fitFigures({ ...withRoles(layout, palette.roles), palette: paletteId, kit: undefined }),
    palette.roles,
  );
}

const geomOf = (e: ICElement): ICGeom => ({
  x: e.x,
  y: e.y,
  rot: e.rot,
  ...('w' in e ? { w: e.w } : {}),
  ...((e.t === 'shape' || e.t === 'pill' || e.t === 'image') && e.h !== undefined
    ? { h: e.h }
    : {}),
  ...(e.t === 'text' || e.t === 'pill' ? { size: e.size } : {}),
});

/** One key per canvas size: the named ratio, or the typed width and height for a custom one. */
export const sizeKey = (ratio: ICRatio | undefined, custom?: { width: number; height: number }) =>
  ratio === 'custom' && custom ? `custom:${custom.width}x${custom.height}` : (ratio ?? '1:1');

/** Hand-made layouts a custom size can start from, with their height over width. */
const SOURCES: [ICRatio, number][] = [
  ['x-post', 900 / 1600],
  ['1:1', 1],
  ['story', 1920 / 1080],
];

/**
 * The hand-made layout a size starts from. A custom size uses one as it is only when its shape
 * matches exactly. Any other shape starts from X or square, whichever is closer, never story.
 */
function sourceFor(
  template: ICTemplate,
  ratio: ICRatio,
  custom?: { width: number; height: number },
): { ratio: ICRatio; adapt?: number } {
  if (ratio !== 'custom' || !custom?.width) return { ratio };
  const tall = custom.height / custom.width;
  const exact = SOURCES.find(([, t]) => Math.abs(t - tall) < 0.005);
  if (exact) return { ratio: exact[0] };
  const supported = supportedOrientations(template);
  const near = SOURCES.slice(0, 2)
    .filter(([r]) => supported.has(orientationOf(r)))
    .sort((p, q) => Math.abs(p[1] - tall) - Math.abs(q[1] - tall))[0];
  // A template with neither X nor square falls back to its closest layout, stretched.
  if (!near) return { ratio: tall < 0.8 ? 'x-post' : tall > 1.25 ? 'story' : '1:1' };
  return { ratio: near[0], adapt: tall };
}

/**
 * Fits a hand-made layout to a wider shape. Backdrops stretch to it. Everything else keeps its
 * proportions, shrunk to the new height, and moves with the side it starts on, or stays centered
 * if it is a card across the middle. Layers on a card move with the outermost card under them.
 */
function adaptLayout(els: ICElement[], from: number, to: number): ICElement[] {
  const k = to / from;
  const w = (e: ICElement) => ('w' in e ? e.w : 0);
  const backdrop = (e: ICElement) =>
    e.t === 'shape'
      ? e.h >= 90 || (w(e) >= 45 && (e.x <= 0.5 || e.x + w(e) >= 99.5))
      : (e.t === 'art' || e.t === 'image') &&
        (w(e) >= 80 || !!e.lock || (e.t === 'art' && isFrameArt(e.art)));
  const cards = els.filter((e) => e.t === 'shape' && !backdrop(e));
  const anchor = (e: ICElement) => {
    if (e.t === 'shape' && e.x < 40 && e.x + e.w > 60) return 50;
    if (e.t === 'text' && e.align === 'right') return e.x + e.w > 50 ? 100 : 0;
    return e.x < 50 ? 0 : 100;
  };
  return els.map((e) => {
    if (backdrop(e)) return e;
    const card = cards
      .filter(
        (c) =>
          c !== e &&
          c.t === 'shape' &&
          e.x >= c.x - 0.5 &&
          e.x + w(e) <= c.x + c.w + 0.5 &&
          e.y >= c.y - 0.5 &&
          e.y <= c.y + c.h,
      )
      .sort((p, q) => w(q) - w(p))[0];
    const at = anchor(card ?? e);
    const next = { ...e, x: at - (at - e.x) * k } as ICElement;
    if ('w' in next) next.w *= k;
    if ('size' in next) next.size *= k;
    if ('radius' in next && typeof next.radius === 'number') next.radius *= k;
    if ('sw' in next) next.sw *= k;
    if ('th' in next) next.th *= k;
    return next;
  });
}

/** The template's layers for a size: its hand-made layout, or one adapted to a custom shape. */
export function sizeElements(
  template: ICTemplate,
  ratio: ICRatio,
  custom?: { width: number; height: number },
): ICElement[] {
  const src = sourceFor(template, ratio, custom);
  const els = elementsFor(template, src.ratio);
  const from = SOURCES.find(([r]) => r === src.ratio)?.[1];
  // A taller shape spreads the rows out as they are; a wider one needs them shrunk to fit.
  return src.adapt !== undefined && from && src.adapt < from
    ? adaptLayout(els, from, src.adapt)
    : els;
}

/**
 * Moves the design to another canvas size, keeping everything the person did. Deleted layers stay
 * deleted and words, pictures, colors and styling carry over. Each layer goes where the template's
 * layout for that size puts it, unless the person placed it there themselves before, in that size.
 */
export function resizeLayout(
  layout: ICLayout,
  template: ICTemplate,
  ratio: ICRatio,
  custom: { width: number; height: number } | undefined = layout.customSize,
): ICLayout {
  const from = sizeKey(layout.ratio, layout.customSize);
  const to = sizeKey(ratio, custom);
  const sizes = {
    ...layout.sizes,
    [from]: Object.fromEntries(layout.els.map((e) => [e.id, geomOf(e)])),
  };
  const target = new Map(sizeElements(template, ratio, custom).map((e) => [e.id, e]));
  const here = new Map(
    sizeElements(template, layout.ratio ?? template.ratio, layout.customSize).map((e) => [e.id, e]),
  );
  const flat = (text: string) => text.replace(/\s+/g, ' ').trim();
  const shape: ICOrientation = orientationOf(sourceFor(template, ratio, custom).ratio);
  const els = layout.els.map((e): ICElement => {
    const remembered = sizes[to]?.[e.id];
    const planned = !remembered && !e.user ? target.get(e.id) : undefined;
    let next = { ...e, ...(remembered ?? (planned ? geomOf(planned) : {})) } as ICElement;
    // Words nobody edited take the new size's own line breaks; edited words stay as typed.
    const was = here.get(e.id);
    const will = target.get(e.id);
    if (
      (next.t === 'text' || next.t === 'pill') &&
      (was?.t === 'text' || was?.t === 'pill') &&
      (will?.t === 'text' || will?.t === 'pill') &&
      flat(next.text) === flat(was.text)
    ) {
      next = { ...next, text: will.text };
    }
    if (next.t === 'art' && isFrameArt(next.art))
      next = { ...next, art: frameFor(next.art, shape) };
    // A pattern swaps to its drawing for the new shape and covers it edge to edge.
    if (next.t === 'art' && isPattern(next.art))
      next = {
        ...next,
        art: patternFor(next.art, ratioHeight(ratio, custom) * 100),
        x: 0,
        y: 0,
        w: 100,
      };
    // The template sized its words for its own fonts; a kit's wider face may need them smaller.
    return planned && (next.t === 'text' || next.t === 'pill') ? shrinkToFit(next) : next;
  });
  return {
    ...layout,
    ratio,
    customSize: ratio === 'custom' ? custom : layout.customSize,
    sizes,
    els,
  };
}

// Whole words only, so "Partnership" stays as it is.
const PARTNER_WORD = /\bPartner\b/g;
const OWN_WORD = /\bYour Brand\b/g;

const slotEl = (els: ICElement[], slot: string) => els.find((e) => e.slot === slot);
const slotText = (els: ICElement[], slot: string) => {
  const e = slotEl(els, slot);
  return e && (e.t === 'text' || e.t === 'pill') ? e.text : undefined;
};
const slotPicture = (els: ICElement[], slot: string) => {
  const e = slotEl(els, slot);
  return e?.t === 'image' ? { url: e.url, ratio: e.ratio } : undefined;
};

/** Reads the brand details the person changed in this design, over what the session already had.
 *  `ownBrand: false` skips their own logo, name and address, for when they pick a different brand. */
export function captureShared(layout: ICLayout, template: ICTemplate, ownBrand = true): ICShared {
  const shared: ICShared = { ...layout.shared };
  const defaults = elementsFor(template, layout.ratio ?? template.ratio);
  const logo = slotPicture(layout.els, 'logo');
  if (
    ownBrand &&
    logo &&
    logo.url !== slotPicture(defaults, 'logo')?.url &&
    logo.url !== layout.kit?.logo
  ) {
    shared.logo = logo;
  }
  const partnerLogo = slotPicture(layout.els, 'partner_logo');
  if (partnerLogo && partnerLogo.url !== slotPicture(defaults, 'partner_logo')?.url)
    shared.partnerLogo = partnerLogo;
  const texts: [keyof ICShared, string, boolean][] = [
    ['brandName', 'brand_name', ownBrand],
    ['partnerName', 'partner_name', true],
    ['url', 'url', ownBrand],
  ];
  for (const [key, slot, take] of texts) {
    const now = slotText(layout.els, slot);
    if (take && now !== undefined && now !== slotText(defaults, slot))
      (shared[key] as string) = now;
  }
  if (layout.partner && template.partner && layout.partner.accent !== template.partner.accent) {
    shared.partner = layout.partner;
  }
  return shared;
}

/** Puts the session's brand details into a design: logos, names, address and partner color. Words the
 *  person hasn't touched get the real names in place of "Partner" and "Your Brand". */
export function applyShared(
  layout: ICLayout,
  template: ICTemplate,
  shared: ICShared | undefined,
): ICLayout {
  if (!shared) return layout;
  const defaults = new Map(
    elementsFor(template, layout.ratio ?? template.ratio).map((e) => [e.id, e]),
  );
  const picture = (e: ICImage, p: { url: string; ratio: number }): ICImage => ({
    ...e,
    url: p.url,
    ratio: p.ratio,
    crop: undefined,
    original: undefined,
    cut: undefined,
  });
  const els = layout.els.map((e): ICElement => {
    if (e.t === 'image' && e.slot === 'logo' && shared.logo) return picture(e, shared.logo);
    if (e.t === 'image' && e.slot === 'partner_logo' && shared.partnerLogo)
      return picture(e, shared.partnerLogo);
    if (e.t !== 'text' && e.t !== 'pill') return e;
    if (e.slot === 'brand_name' && shared.brandName !== undefined)
      return { ...e, text: shared.brandName };
    if (e.slot === 'partner_name' && shared.partnerName !== undefined)
      return { ...e, text: shared.partnerName };
    if (e.slot === 'url' && shared.url !== undefined) return { ...e, text: shared.url };
    const original = defaults.get(e.id);
    if (!original || (original.t !== 'text' && original.t !== 'pill') || original.text !== e.text)
      return e;
    let text = e.text;
    if (shared.partnerName) text = text.replaceAll(PARTNER_WORD, shared.partnerName);
    if (shared.brandName) text = text.replaceAll(OWN_WORD, shared.brandName);
    return text === e.text ? e : shrinkToFit({ ...e, text });
  });
  const out = { ...layout, els };
  return shared.partner && layout.partner ? applyPartner(out, shared.partner) : out;
}

/** How many templates keep a draft; the oldest is dropped past this, so a design stays small. */
const MAX_DRAFTS = 12;

/**
 * Opens another template without losing work: the current design is kept as that template's draft,
 * and a template visited before comes back as the person left it, at the size they're on now.
 * `build` makes a fresh layout for a template that has no draft yet.
 */
export function openTemplate(
  current: ICLayout,
  currentTemplate: ICTemplate,
  next: ICTemplate,
  build: (current: ICLayout) => ICLayout,
  ownBrand = true,
): ICLayout {
  const shared = captureShared(current, currentTemplate, ownBrand);
  if (!ownBrand) {
    shared.logo = undefined;
    shared.brandName = undefined;
    shared.url = undefined;
  }
  const { drafts: _drafts, ...snapshot } = current;
  const drafts = { ...current.drafts };
  // A thread is kept under its own template, whichever page was open.
  if (current.templateId !== 'blank') drafts[current.thread?.root ?? current.templateId] = snapshot;
  const draft = drafts[next.id];
  delete drafts[next.id];
  const keys = Object.keys(drafts);
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_DRAFTS))) delete drafts[key];
  const ratio = current.ratio ?? next.ratio;
  const sameSize =
    draft && sizeKey(draft.ratio, draft.customSize) === sizeKey(ratio, current.customSize);
  const opened = draft
    ? sameSize
      ? draft
      : resizeLayout(draft, next, ratio, current.customSize)
    : build(current);
  return { ...applyShared(opened, next, shared), drafts, shared, saved: current.saved };
}

/** Partner roles built around one brand color, as picked or read off the partner's logo. */
export const partnerRoles = (accent: string): ICRoles =>
  rolesFrom({ bg: '#0f1115', surface: '#1a1d24', ink: '#f5f6f8', accent }).roles;

/** The partner color a design starts with: a deeper shade of the brand's own accent, so the design
 *  stays in one brand's colors until the person adds a partner. */
export const brandPartner = (roles: ICRoles): ICRoles =>
  partnerRoles(mix(roles.accent, roles.bg, 0.4));

/** A partner color the person chose, which then stays when the brand changes. */
export const pickPartner = (layout: ICLayout, color: string): ICLayout =>
  layout.partner ? { ...applyPartner(layout, partnerRoles(color)), partnerOwn: true } : layout;

/** After a brand, kit or palette change, a partner color nobody picked follows the new colors. */
const followBrand = (layout: ICLayout, roles: ICRoles): ICLayout =>
  layout.partner && !layout.partnerOwn ? applyPartner(layout, brandPartner(roles)) : layout;

/** Recolors the partner's side only. */
export function applyPartner(layout: ICLayout, roles: ICRoles): ICLayout {
  return fitFigures({
    ...layout,
    partner: roles,
    els: layout.els.map((e) => (e.pal?.side === 'b' ? recolor(e, roles, roles) : e)),
  });
}

/**
 * Forgets the partner: their logo and color go back to the template's own, in this design, in
 * every draft, and in the brand details that new templates pick up.
 */
export function resetPartner(layout: ICLayout, template: ICTemplate): ICLayout {
  const own = slotPicture(elementsFor(template, layout.ratio ?? template.ratio), 'partner_logo');
  const reset = (l: ICLayout): ICLayout => {
    const els = own
      ? l.els.map((e) => (e.t === 'image' && e.slot === 'partner_logo' ? { ...e, ...own } : e))
      : l.els;
    const next = { ...l, els };
    return template.partner ? applyPartner(next, template.partner) : next;
  };
  const { partnerLogo: _logo, partner: _color, ...shared } = layout.shared ?? {};
  return {
    ...reset(layout),
    partnerOwn: false,
    shared,
    drafts:
      layout.drafts &&
      Object.fromEntries(Object.entries(layout.drafts).map(([id, d]) => [id, reset(d)])),
  };
}

/**
 * Shapes a template's main art can be swapped for: the classic shapes and every shape in Web3,
 * Data & AI and Accents. A shape added to one of those joins the list on its own; full-canvas
 * drawings (Backgrounds, frames), devices and charts stay out.
 */
const HERO_GROUPS = new Set([undefined, 'Web3', 'Data & AI', 'Accents']);

export const HERO_ART = ART.filter(
  (a) => a.kind === 'shape' && !isFrameArt(a.id) && HERO_GROUPS.has(a.group),
).map((a) => a.id);

export const isHero = (id: string) => HERO_ART.includes(id);

/** A shape's colors when it replaces `el`: the brand's, or the partner's on the partner side. */
export function swapColors(layout: ICLayout, el: ICElement, def: ICArtDef): Record<string, string> {
  const roles = layoutRoles(layout);
  return roles
    ? artPalette(def, sideRoles(el, roles, layout.partner))
    : Object.fromEntries(def.slots.map((sl) => [sl.key, sl.color]));
}

/**
 * Puts another shape in place of an art layer: same center, inside the same box, in the colors of
 * the side it sits on. With no `art`, picks any other centerpiece at random.
 */
export function swapArt(layout: ICLayout, id: string, art?: string): ICLayout {
  const el = layout.els.find((e) => e.id === id);
  if (!el || el.t !== 'art') return layout;
  const others = HERO_ART.filter((a) => a !== el.art);
  const next = art ?? others[Math.floor(Math.random() * others.length)];
  const from = artDef(el.art);
  const to = artDef(next);
  if (!to) return layout;
  const H = ratioHeight(layout.ratio, layout.customSize) * 100;
  // The new shape fits inside the old one's box, centered in it, so a tall shape never grows
  // past it. Widths are percent of the canvas width, heights percent of its height.
  const kept = el.swapBox && Math.abs(el.swapBox.last - el.w) < 0.01 ? el.swapBox : undefined;
  const box = kept ?? { w: el.w, h: from ? el.w / from.ratio : el.w };
  const w = Math.min(box.w, box.h * to.ratio);
  // Heights in percent of the canvas height, so the new shape keeps the same center.
  const oldH = ((from ? el.w / from.ratio : el.w) / H) * 100;
  const newH = (w / to.ratio / H) * 100;
  const colors = swapColors(layout, el, to);
  return {
    ...layout,
    els: layout.els.map((e) =>
      e === el
        ? {
            ...el,
            art: next,
            colors,
            w,
            x: el.x + (el.w - w) / 2,
            y: el.y + (oldH - newH) / 2,
            swapBox: { w: box.w, h: box.h, last: w },
          }
        : e,
    ),
  };
}

/** The background pattern layer, if the design has one. */
export const patternLayer = (layout: ICLayout) =>
  layout.els.find((e): e is ICArtEl => e.t === 'art' && isPattern(e.art));

/**
 * Turns the background pattern on in a style, switches its style, or turns it off with `null`.
 * A new pattern goes right above the design's full-size color blocks, faint and locked.
 */
export function setPattern(layout: ICLayout, style: PatternStyle | null, seed?: number): ICLayout {
  const current = patternLayer(layout);
  if (!style) return { ...layout, els: layout.els.filter((e) => e !== current) };
  const H = ratioHeight(layout.ratio, layout.customSize) * 100;
  const id = patternFor(
    patternId(style, seed ?? (current ? patternSeed(current.art) : 1)),
    H,
  );
  const def = artDef(id);
  const roles = layoutRoles(layout);
  const colors = def
    ? roles
      ? artPalette(def, roles)
      : Object.fromEntries(def.slots.map((sl) => [sl.key, sl.color]))
    : {};
  if (current) {
    return {
      ...layout,
      els: layout.els.map((e) =>
        e === current ? { ...current, art: id, colors, x: 0, y: 0, w: 100 } : e,
      ),
    };
  }
  // Drawn for this canvas's shape, so it lies exactly over it.
  const layer: ICArtEl = {
    id: `pattern-${Math.random().toString(36).slice(2, 9)}`,
    t: 'art',
    art: id,
    x: 0,
    y: 0,
    w: 100,
    colors,
    op: 0.22,
    lock: true,
    vis: true,
    user: true,
  };
  const at = layout.els.findIndex((e) => !(e.t === 'shape' && e.w >= 45));
  const els = layout.els.slice();
  els.splice(at < 0 ? els.length : at, 0, layer);
  return { ...layout, els };
}

/** Any style, any arrangement: each press can land anywhere in every pattern there is. */
export const shuffleAll = (layout: ICLayout): ICLayout =>
  setPattern(
    layout,
    PATTERN_STYLES[Math.floor(Math.random() * PATTERN_STYLES.length)][0],
    1 + Math.floor(Math.random() * 99999),
  );

/** What a layer is, apart from its id: its kind and name, and how many like it came before. */
function layerKeys(els: ICElement[]): string[] {
  const seen = new Map<string, number>();
  return els.map((e) => {
    const name = e.slot ?? ('role' in e && typeof e.role === 'string' ? e.role : '') ?? '';
    const base = `${e.t}:${name || (e.t === 'art' ? e.art : e.t === 'shape' ? e.kind : '')}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  });
}

/**
 * Designs saved before templates numbered their layers by place carry ids that now point at other
 * layers. Each template layer is matched to the current one by what it is and takes its position;
 * per-size positions made with the old ids are dropped. Layers the person added are left alone.
 */
export function upgradeIds(
  layout: ICLayout,
  find: (id: string) => ICTemplate | undefined,
): ICLayout {
  if (layout.idsV === 2) return layout;
  const one = (l: ICLayout): ICLayout => {
    const t = find(l.templateId);
    if (!t || l.templateId === 'blank') return { ...l, idsV: 2 };
    const current = sizeElements(t, l.ratio ?? t.ratio, l.customSize);
    const ids = new Map(layerKeys(current).map((k, i) => [k, current[i].id]));
    const keys = layerKeys(l.els);
    const taken = new Set<string>();
    const els = l.els.map((e, i) => {
      if (e.user) return e;
      const id = ids.get(keys[i]);
      if (!id || taken.has(id)) return { ...e, user: true };
      taken.add(id);
      // Positions set through the old ids may belong to another layer; the template's are safe.
      const planned = current.find((c) => c.id === id);
      return { ...e, ...(planned ? geomOf(planned) : {}), id } as ICElement;
    });
    return { ...l, els, sizes: undefined, idsV: 2 };
  };
  const next = one(layout);
  return {
    ...next,
    drafts:
      layout.drafts &&
      Object.fromEntries(Object.entries(layout.drafts).map(([id, d]) => [id, one(d)])),
  };
}

/**
 * Sessions saved before `partnerV` may carry a partner logo, name or color from an earlier test.
 * They go back to the template's own partner once, and the session is marked so it never repeats.
 */
export function cleanSession(layout: ICLayout, template: ICTemplate): ICLayout {
  if (layout.partnerV === 1) return layout;
  const { partnerName: old, ...shared } = layout.shared ?? {};
  const cleared = resetPartner({ ...layout, shared }, template);
  // The saved name went into headlines too, in place of "Partner"; put the word back.
  const word =
    old && old !== 'Partner'
      ? new RegExp(`\\b${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
      : null;
  const fix = (l: ICLayout): ICLayout =>
    word
      ? {
          ...l,
          els: l.els.map((e) =>
            e.t === 'text' || e.t === 'pill' ? { ...e, text: e.text.replace(word, 'Partner') } : e,
          ),
        }
      : l;
  return {
    ...fix(cleared),
    partnerV: 1,
    drafts:
      cleared.drafts &&
      Object.fromEntries(Object.entries(cleared.drafts).map(([id, d]) => [id, fix(d)])),
  };
}

/** Lays each background pattern exactly over its canvas, drawn for the canvas's shape. Patterns
 *  saved before they had shapes were a square laid over the whole canvas and cropped. */
export function fitPatterns(layout: ICLayout): ICLayout {
  const fit = (l: ICLayout): ICLayout => {
    const h = ratioHeight(l.ratio, l.customSize) * 100;
    return {
      ...l,
      els: l.els.map((e) =>
        e.t === 'art' && isPattern(e.art)
          ? { ...e, art: patternFor(e.art, h), x: 0, y: 0, w: 100 }
          : e,
      ),
    };
  };
  return {
    ...fit(layout),
    drafts:
      layout.drafts &&
      Object.fromEntries(Object.entries(layout.drafts).map(([id, d]) => [id, fitPatterns(d)])),
    thread: layout.thread && { ...layout.thread, pages: layout.thread.pages.map(fit) },
  };
}

/** Slots that trade places when the two brands swap sides. */
const SWAP_PAIRS: [string, string][] = [
  ['logo', 'partner_logo'],
  ['brand_name', 'partner_name'],
];

/** Puts each brand on the other side: colors flip, and logos and names trade places with their slots. */
export function swapSides(layout: ICLayout): ICLayout {
  if (!layout.partner) return layout;
  const own = designRoles(layout);
  const partner = layout.partner;
  const swapped = new Map<string, ICElement>();
  for (const [a, b] of SWAP_PAIRS) {
    const ea = layout.els.find((e) => e.slot === a);
    const eb = layout.els.find((e) => e.slot === b);
    if (!ea || !eb || ea.t !== eb.t) continue;
    const content = (e: ICElement) =>
      e.t === 'image'
        ? { url: e.url, ratio: e.ratio, name: e.name }
        : e.t === 'text'
          ? { text: e.text }
          : {};
    swapped.set(ea.id, { ...ea, ...content(eb), slot: b } as ICElement);
    swapped.set(eb.id, { ...eb, ...content(ea), slot: a } as ICElement);
  }
  const els = layout.els.map((e) => {
    const next = swapped.get(e.id) ?? e;
    const side = next.pal?.side;
    if (!side) return next;
    const flipped = { ...next, pal: { ...next.pal, side: side === 'a' ? 'b' : 'a' } } as ICElement;
    return recolor(flipped, own, partner);
  });
  return fitFigures({ ...layout, els });
}

/** Share of the largest text size at or above which a layer counts as a heading. */
const HEADING_SHARE = 0.6;

/** Recolors through the same role tags a palette uses, puts the heading font on the biggest
 *  text and the body font on the rest, and fills every layer slotted `logo` with the logo. */
export function applyBrandKit(layout: ICLayout, kit: BrandKit): ICLayout {
  const recolored = withRoles(layout, kit.roles);
  const sizes = recolored.els.flatMap((e) => (e.t === 'text' || e.t === 'pill' ? [e.size] : []));
  const headingFrom = Math.max(0, ...sizes) * HEADING_SHARE;
  let subject = recolored.subject;
  const els = recolored.els.map((e): ICElement => {
    // Kits have no mono font yet, so hashes, addresses and code keep theirs and stay aligned.
    if ((e.t === 'text' || e.t === 'pill') && !isMonoFont(e.font)) {
      const font = e.size >= headingFrom ? kit.fonts.heading : kit.fonts.body;
      return font === e.font ? e : shrinkToFit({ ...e, font });
    }
    if (kit.logo && e.slot === LOGO_SLOT && e.t === 'image') {
      return {
        ...e,
        url: kit.logo,
        ratio: kit.logoRatio,
        name: 'logo',
        crop: undefined,
        original: undefined,
        cut: undefined,
      };
    }
    if (kit.logo && e.slot === LOGO_SLOT && e.t === 'subject') {
      subject = { name: 'logo', url: kit.logo, ratio: kit.logoRatio };
    }
    return e;
  });
  return followBrand(
    fitFigures({ ...recolored, subject, els, palette: undefined, kit }),
    kit.roles,
  );
}

/** Puts the template's own colors back. */
export function resetPalette(layout: ICLayout, template: ICTemplate): ICLayout {
  const original = new Map(
    elementsFor(template, layout.ratio ?? template.ratio).map((e) => [e.id, e]),
  );
  return {
    ...layout,
    palette: undefined,
    kit: template.kit,
    partner: template.partner,
    bg: structuredClone(template.bg),
    subject: recolorSubject(layout.subject),
    els: layout.els.map((e) => {
      if (e.t === 'art') {
        const def = artDef(e.art);
        return def ? { ...e, colors: { ...e.colors, ...artUnpalette(def) } } : e;
      }
      if (isSampleImage(e)) return { ...e, url: sampleUrl(e.name) };
      const from = original.get(e.id);
      if (!from || e.user) return e;
      const next: Record<string, unknown> = {};
      // A kit also swapped fonts and shrank text to fit them, so taking it off puts both back.
      if (layout.kit && (from.t === 'text' || from.t === 'pill')) {
        next.font = from.font;
        next.size = from.size;
      }
      if (layout.kit && from.t === 'image' && from.slot === LOGO_SLOT) {
        Object.assign(next, { url: from.url, ratio: from.ratio, name: from.name });
      }
      if (from.t === 'text' && !from.pal?.color) next.color = from.color;
      for (const key of ['color', 'fill', 'stroke'] as const) {
        if (e.pal?.[key]) next[key] = (from as unknown as Record<string, unknown>)[key];
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
