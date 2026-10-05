import { type DesignCast, designCast } from './image-constructor-films.js';
import type { ICElement, ICLayout, ICVideo, ICVideoText } from './image-constructor-layout.js';
import type { Paint, Scene } from './image-constructor-motion.js';
import { type Media, PLAIN_SKIN, type SceneSpec, type Skin } from './image-constructor-video.js';
import type {
  DesignContent,
  FeaturesContent,
  HookContent,
  InputContent,
  OutroContent,
  StatsContent,
  WallContent,
  WorkingContent,
} from './image-constructor-video-scenes.js';

// A storyboard is the order of slides for one kind of story. Its words come from the design the
// video belongs to, so any template in the pack gets a video without one being made for it.

/** A new video's take, before the person shuffles or types anything. */
export const NEW_VIDEO: ICVideo = {
  text: {},
  media: [],
  slides: {},
  feel: 'smooth',
  pace: 1,
  variants: {},
  seed: 0,
};

type TextEl = Extract<ICElement, { t: 'text' }>;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const NUMBER = /^[^\d\s]{0,2}\d[\d.,]*\s?[%xkmb+]{0,2}$/i;
const VERSION = /\bv?\d+\.\d+(\.\d+)?\b/i;

/** Breaks a headline into at most three lines of about the same length. */
function lines(text: string, max = 3): string {
  const words = clean(text).split(' ');
  const per = Math.max(10, Math.ceil(clean(text).length / max));
  const out: string[] = [];
  for (const w of words) {
    const last = out[out.length - 1];
    if (last !== undefined && (last.length + w.length < per || out.length === max)) {
      out[out.length - 1] = `${last} ${w}`;
    } else out.push(w);
  }
  return out.join('\n');
}

/** The words a video starts with, read from the design's own layers. */
export function readDesign(layout: ICLayout, cast: DesignCast | null): ICVideoText {
  const texts = layout.els.filter((e): e is TextEl => e.t === 'text' && e.vis && !!clean(e.text));
  const pills = layout.els.flatMap((e) => (e.t === 'pill' && e.vis ? [clean(e.text)] : []));
  const byRole = (...roles: string[]) => texts.find((e) => roles.includes(e.role));
  const headline =
    cast?.headline || clean(byRole('headline', 'title')?.text ?? '') || 'Your update';
  const head = byRole('headline', 'title');
  const sub = byRole('sub', 'subtitle', 'tagline', 'detail', 'note');
  // Templates put the brand's name in a short line at the top left.
  const named = byRole('name', 'brand', 'product');
  const top = texts
    .filter((e) => e !== head && e.y < 18 && e.x < 40 && clean(e.text).split(' ').length <= 3)
    .sort((a, b) => a.x + a.y - (b.x + b.y))[0];
  const brand = clean((named ?? top)?.text ?? '') || 'Your Brand';
  const version =
    clean(byRole('version')?.text ?? '') ||
    [...pills, ...texts.map((e) => clean(e.text))]
      .map((t) => t.match(VERSION)?.[0])
      .find(Boolean) ||
    '';

  const numbers = texts.filter((e) => e !== head && NUMBER.test(clean(e.text))).slice(0, 3);
  const stats = numbers.map((n) => {
    const under = texts
      .filter(
        (e) => e !== n && !NUMBER.test(clean(e.text)) && e.y > n.y && Math.abs(e.x - n.x) < 12,
      )
      .sort((a, b) => a.y - b.y)[0];
    return { value: clean(n.text), label: under ? clean(under.text) : '' };
  });

  // Each line of the design's supporting text is one feature, with a badge from its pills.
  const points = (sub?.text ?? '')
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => clean(s).replace(/[.]$/, ''))
    .filter((s) => s.length > 2)
    .slice(0, 4);
  // Failing that, a run of short lines set at one size is a list of what is new.
  const bySize = new Map<number, TextEl[]>();
  for (const e of texts) {
    const words = clean(e.text).split(' ').length;
    if (e === head || e === sub || e === named || e === top || words > 4) continue;
    if (NUMBER.test(clean(e.text)) || VERSION.test(clean(e.text))) continue;
    bySize.set(e.size, [...(bySize.get(e.size) ?? []), e]);
  }
  const list = [...bySize.values()]
    .filter((g) => g.length >= 3)
    .sort((a, b) => b.length - a.length)[0];
  const titles = points.length
    ? points
    : (list ?? [])
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .slice(0, 4)
        .map((e) => clean(e.text));
  const tags = pills.filter((p) => !VERSION.test(p));
  const features = titles.map((title, i) => ({ title, body: '', tag: tags[i] ?? '' }));
  const about = version || brand;

  return {
    brand,
    version,
    hook: lines(headline),
    ask: `Ask ${brand}`,
    prompt: `What's new in ${about}?`,
    steps: ['Checking what changed', 'Pulling the highlights', 'Putting it together'],
    wall: `Everything new in ${about}`,
    features,
    stats,
    designLabel: cast?.kicker || brand,
    tagline: points[0] ?? cast?.kicker ?? '',
    link:
      clean(byRole('url')?.text ?? '') || `${brand.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
  };
}

/** The video's words: the person's own where they typed any, the design's for the rest. */
export const videoText = (layout: ICLayout, cast: DesignCast | null): ICVideoText => ({
  ...readDesign(layout, cast),
  ...layout.video?.text,
});

/** What the video takes from the design so it looks like it. */
export function skinOf(scene: Scene | null): Skin {
  if (!scene) return PLAIN_SKIN;
  const c = designCast(scene);
  return {
    ground: c.ground,
    // The headline is often set in the accent, so the kit's own ink comes first.
    ink: scene.roles?.ink ?? c.ink,
    accent: c.accent,
    onAccent: c.onAccent,
    family: c.family,
    weight: c.weight,
    // Big type reads tighter than the design's own setting once it fills a frame.
    track: Math.min(c.track, 0) - 0.02,
    backdrop: scene.base,
  };
}

/** The pictures a video shows: the person's own, else the design's, else the design itself. */
export function mediaOf(scene: Scene, own: Media[], still: HTMLCanvasElement): Media[] {
  if (own.length) return own;
  const area = scene.width * scene.height;
  const inDesign = scene.tracks
    .filter((t) => !t.stage && (t.e.t === 'image' || t.e.t === 'subject'))
    // A logo is a picture too, but not one to show as a screenshot.
    .filter((t) => !/logo/i.test(`${t.e.slot ?? ''}${t.e.part ?? ''}`))
    .map((t) => t.sprite.canvas)
    .filter((c) => c.width * c.height > area * 0.08);
  return inDesign.length ? inDesign : [still];
}

export interface Slide {
  kind: string;
  name: string;
  on: boolean;
  /** False when the design gives the slide nothing to show, so it cannot be switched on yet. */
  ready: boolean;
  content: unknown;
}

/** A slide as a storyboard lists it. `start` is whether it plays before the person has a say. */
interface SlideDef extends Omit<Slide, 'on'> {
  start: boolean;
}

export interface Storyboard {
  id: string;
  name: string;
  /** The template packs whose designs tell this kind of story. */
  packs: string[];
  slides: (
    text: ICVideoText,
    media: Media[],
    design: { canvas: HTMLCanvasElement; paint: Paint | null },
  ) => SlideDef[];
}

const UPDATE: Storyboard = {
  id: 'update',
  name: 'Product update',
  packs: ['Product Updates'],
  slides: (t, media, design) => [
    {
      kind: 'hook',
      name: 'Hook',
      ready: true,
      start: true,
      content: {
        kicker: [t.brand, t.version].filter(Boolean).join(' · '),
        lines: t.hook,
      } satisfies HookContent,
    },
    {
      kind: 'input',
      name: 'Typed input',
      ready: true,
      start: true,
      content: { label: t.ask, text: t.prompt } satisfies InputContent,
    },
    {
      kind: 'working',
      name: 'Working',
      ready: true,
      start: true,
      content: { steps: t.steps } satisfies WorkingContent,
    },
    {
      kind: 'wall',
      name: 'Picture wall',
      ready: media.length > 0,
      // One picture repeated across a wall is not worth showing.
      start: media.length >= 3,
      content: { label: t.wall } satisfies WallContent,
    },
    {
      kind: 'features',
      name: 'Features',
      ready: t.features.length > 0,
      start: t.features.length > 0,
      content: { items: t.features } satisfies FeaturesContent,
    },
    {
      kind: 'stats',
      name: 'Numbers',
      ready: t.stats.some((s) => s.value),
      start: t.stats.some((s) => s.value),
      content: { items: t.stats } satisfies StatsContent,
    },
    {
      kind: 'design',
      name: 'Your design',
      ready: true,
      start: true,
      content: { label: t.designLabel, ...design } satisfies DesignContent,
    },
    {
      kind: 'outro',
      name: 'Logo and link',
      ready: true,
      start: true,
      content: { tagline: t.tagline, link: t.link } satisfies OutroContent,
    },
  ],
};

export const STORYBOARDS: Storyboard[] = [UPDATE];

/** The storyboard for a design's pack. Packs without their own yet use the product update's. */
export const storyboardFor = (pack: string | undefined): Storyboard =>
  STORYBOARDS.find((s) => pack && s.packs.includes(pack)) ?? UPDATE;

/** A storyboard's slides for one design, each on or off as the person or the storyboard set it. */
export function slidesOf(
  board: Storyboard,
  video: ICVideo,
  text: ICVideoText,
  media: Media[],
  design: { canvas: HTMLCanvasElement; paint: Paint | null },
): Slide[] {
  return board.slides(text, media, design).map(({ start, ...s }) => ({
    ...s,
    on: s.ready && (video.slides[s.kind] ?? start),
  }));
}

/** The slides that play, as the engine takes them. */
export const scenesOf = (slides: Slide[], video: ICVideo): SceneSpec[] =>
  slides
    .filter((s) => s.on)
    .map((s) => ({ kind: s.kind, variant: video.variants[s.kind], content: s.content }));
