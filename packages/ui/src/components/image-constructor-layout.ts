// The design document for the Compose image node. The model paints only the scene.
// Text, shapes and the product are layers stored here.

export type ICFont = 'serif' | 'sans' | 'cond';
export type ICModel = 'flux2-klein' | 'sd2.1';

/** Font stacks for the canvas. Each name falls back to a system face. */
export const IC_FONT_STACKS: Record<ICFont, string> = {
  serif: 'Didot, "Playfair Display", Georgia, serif',
  sans: '"Helvetica Neue", Inter, Arial, sans-serif',
  cond: '"Bebas Neue", "Avenir Next Condensed", "Arial Narrow", Impact, sans-serif',
};

export const IC_OUTPUT_SIZE = 1080;

interface ICBase {
  id: string;
  /** Percent of the canvas. */
  x: number;
  y: number;
  vis: boolean;
  /** Template layers are rebuilt on a template switch, user layers are kept. */
  user?: boolean;
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

export interface ICSubject extends ICBase {
  t: 'subject';
  w: number;
  shadow: boolean;
}

export interface ICImage extends ICBase {
  t: 'image';
  w: number;
  name: string;
  url: string;
  ratio: number;
}

export type ICElement = ICText | ICPill | ICLine | ICSubject | ICImage;

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
}

export interface ICLayout {
  v: 1;
  templateId: string;
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
  scenePrompt: string;
  seed: number;
  model: ICModel;
  /** Backdrop shown while there is no scene, also the card thumbnail color. */
  thumb: string;
  bg: ICBackground;
  els: ICElement[];
  source: { author: string; url: string } | null;
}

export function sceneSize(model: ICModel): number {
  return model === 'sd2.1' ? 768 : 1024;
}

export function sceneKey(layout: ICLayout): string {
  return JSON.stringify([layout.model, layout.seed, sceneSize(layout.model), layout.prompt]);
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

/** Builds a layout from a template, keeping the previous layout's words, product and user layers. */
export function layoutFromTemplate(template: ICTemplate, previous?: ICLayout): ICLayout {
  const words = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const e of previous?.els ?? []) {
    const key = roleKey(e, seen);
    if (key && !e.user && (e.t === 'text' || e.t === 'pill')) words.set(key, e.text);
  }
  const fresh = new Map<string, number>();
  const els = structuredClone(template.els).map((e) => {
    const key = roleKey(e, fresh);
    const carried = key ? words.get(key) : undefined;
    return carried !== undefined && (e.t === 'text' || e.t === 'pill')
      ? { ...e, text: refit(carried, e.text) }
      : e;
  });
  return {
    v: 1,
    templateId: template.id,
    prompt: template.scenePrompt,
    model: previous?.model ?? template.model,
    seed: template.seed,
    scene: { on: true, upload: previous?.scene.upload ?? null },
    bg: structuredClone(template.bg),
    subject: previous?.subject ?? SAMPLE_SUBJECT,
    els: [...els, ...(previous?.els.filter((e) => e.user) ?? [])],
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
