import { brandUrl } from './design-cobrand.js';
import { type DesignCast, designCast } from './design-films.js';
import type { ICElement, ICLayout, ICVideo, ICVideoText } from './design-layout.js';
import type { Paint, Scene, Sprite } from './design-motion.js';
import {
  ENDINGS,
  MARKS,
  type Media,
  PLAIN_SKIN,
  type SceneSpec,
  type Skin,
} from './design-video.js';
import type {
  DesignContent,
  FeaturesContent,
  HookContent,
  InputContent,
  OutroContent,
  PairContent,
  StatsContent,
  WallContent,
  WorkingContent,
} from './design-video-scenes.js';

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
/** Roles of small labels, which are never a feature's title. */
const LABELS = new Set([
  'eyebrow',
  'badge',
  'tag',
  'label',
  'kicker',
  'counter',
  'count',
  'chip',
  'url',
]);
/** Built-in kits that are a visual style with no brand of their own. */
const STYLE_KITS = new Set(['Default', 'Glass', 'Degen']);
/** A figure worth showing big: it has a sign, a unit or a thousands comma. */
const FIGURE = /^[^\d\s]{0,2}\d[\d.,]*\s?[%xkmb+]{0,2}$/i;
const UNIT = /[$€£%+,]|\d\s?[xkmb]$/i;
/** Roles templates give a figure that is the point of the design, whatever it looks like. */
const FIGURES = new Set(['number', 'count', 'amount', 'price', 'stat', 'value', 'metric']);
/** A release's number: written with a v, or in three parts. A bare decimal is a measurement. */
const VERSION = /\bv\d+(\.\d+){1,2}\b|\b\d+\.\d+\.\d+\b/i;
/** A step or rank marker, or a year, which is a number but not a result. */
const MARKER = /^(0\d|\d|(19|20)\d\d)$/;
const isFigure = (e: TextEl) => {
  const t = clean(e.text);
  if (!FIGURE.test(t) || VERSION.test(t)) return false;
  return FIGURES.has(e.role) || (UNIT.test(t) && !MARKER.test(t));
};

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

/** Marks one line of a hook to take the brand's color: the figure when it opens on one, else the
 *  last line. A video with no color in its first seconds does not look like the brand's. */
function accented(hook: string, first: boolean): string {
  const rows = hook.split('\n');
  const at = first ? 0 : rows.length - 1;
  return rows.map((row, i) => (i === at ? `*${row}*` : row)).join('\n');
}

/** The words a video starts with, read from the design's own layers. */
// A Build-up's three steps: look, pick, assemble. A video draws one line for each from these.
const STEP_LINES = [
  [
    'Checking what changed',
    'Reading the changelog',
    'Scanning the release',
    'Going through the update',
    'Opening the release notes',
    'Looking over the update',
    'Reading what is new',
    'Checking the version notes',
    'Going over the release',
    'Comparing the two versions',
  ],
  [
    'Pulling the highlights',
    'Picking the best bits',
    'Choosing what to show',
    'Listing what is new',
    'Sorting the changes',
    'Gathering the new features',
    'Counting the changes',
    'Marking what is new',
    'Choosing the main changes',
    'Noting each new feature',
  ],
  [
    'Putting it together',
    'Cutting the video',
    'Ordering the slides',
    'Wrapping it up',
    'Rendering the video',
    'Building the slides',
    'Laying out the video',
    'Timing the slides',
    'Writing the captions',
    'Getting it ready',
  ],
];

/** The steps drawn for a video, one from each list. */
const stepsFor = (draw: number): string[] =>
  STEP_LINES.map((lines, i) => {
    // Stirred well, so draws that are close together or a fixed stride apart still pick apart.
    let h = Math.imul(draw + i * 0x9e3779b9, 2654435761);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    return lines[((h ^ (h >>> 13)) >>> 0) % lines.length];
  });

/** The design's words with the video's random picks added. The picks are drawn from its shuffle
 *  count and from the design's own words, so two designs do not open on the same ones. */
export function drawn(read: ICVideoText, video: ICVideo | undefined): ICVideoText {
  let h = 2166136261;
  for (const ch of `${read.brand}|${read.version}|${read.hook}`)
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  // The ending and the mark follow the video's own shuffles only, so new steps leave them be.
  const own = (h >>> 0) + (video?.seed ?? 0);
  const one = <T extends { id: string }>(list: readonly T[], salt: number) =>
    list[(Math.imul(own ^ salt, 2246822519) >>> 0) % list.length].id;
  // A shuffle of the steps alone moves the draw too, by a stride no count of video shuffles lands on.
  const draw = own + (video?.stepsTurn ?? 0) * 7919;
  return {
    ...read,
    steps: stepsFor(draw),
    draw,
    ending: video?.ending ?? one(ENDINGS, 0x51ed27),
    mark: video?.mark ?? one(MARKS, 0x2f6b),
  };
}

export function readDesign(layout: ICLayout, cast: DesignCast | null): ICVideoText {
  const texts = layout.els.filter((e): e is TextEl => e.t === 'text' && e.vis && !!clean(e.text));
  const pills = layout.els.flatMap((e) => (e.t === 'pill' && e.vis ? [clean(e.text)] : []));
  const byRole = (...roles: string[]) => texts.find((e) => roles.includes(e.role));
  const headline =
    cast?.headline || clean(byRole('headline', 'title')?.text ?? '') || 'Your update';
  const head = byRole('headline', 'title');
  const sub = byRole('sub', 'subtitle', 'tagline', 'detail', 'note');
  // The brand is what the person set, else the kit's own name. A style kit is not a brand, and
  // nothing on the canvas says which words are one, so the layers are not searched for it.
  const kit = layout.kit && !STYLE_KITS.has(layout.kit.name) ? layout.kit.name : '';
  const brand = clean(layout.shared?.brandName ?? '') || kit || 'Your Brand';
  const version =
    clean(byRole('version')?.text ?? '') ||
    [...pills, ...texts.map((e) => clean(e.text))]
      .map((t) => t.match(VERSION)?.[0])
      .find(Boolean) ||
    '';

  // A figure that is the headline opens the video with its label, so it is not counted again.
  const under = (n: TextEl) =>
    texts
      .filter(
        (e) => e !== n && !FIGURE.test(clean(e.text)) && e.y > n.y && Math.abs(e.x - n.x) < 12,
      )
      .sort((a, b) => a.y - b.y)[0];
  const lead = FIGURE.test(headline) ? texts.find((e) => clean(e.text) === headline) : undefined;
  const word = headline.length <= 6 ? texts.find((e) => clean(e.text) === headline) : undefined;
  const unit =
    word !== undefined &&
    texts.some(
      (e) =>
        e !== word &&
        FIGURE.test(clean(e.text)) &&
        Math.abs(e.y - word.y) < 26 &&
        Math.abs(e.x - word.x) < 12,
    );
  const leadLabel = lead ? clean(under(lead)?.text ?? '') : '';
  const numbers = texts.filter((e) => e !== head && e !== lead && isFigure(e)).slice(0, 3);
  const stats = numbers.map((n) => ({ value: clean(n.text), label: clean(under(n)?.text ?? '') }));

  // Two or more short sentences under the headline are each a feature. One sentence is the
  // design's tagline, and a line break inside it is only where the design wraps.
  const sentences = clean(sub?.text ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.replace(/[.]$/, ''))
    .filter((x) => x.length > 2);
  const points =
    sentences.length >= 2 && sentences.every((x) => x.split(' ').length <= 8)
      ? sentences.slice(0, 4)
      : [];
  // Failing that, a run of short lines set at one size is a list of what is new.
  const bySize = new Map<number, TextEl[]>();
  for (const e of texts) {
    const words = clean(e.text).split(' ').length;
    if (e === head || e === sub || LABELS.has(e.role) || words > 4) continue;
    // A list item names something, so it has a real word in it.
    if (FIGURE.test(clean(e.text)) || VERSION.test(clean(e.text)) || !/[a-z]{3}/i.test(e.text))
      continue;
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
  const url =
    layout.els.flatMap((e) =>
      e.t === 'pill' && e.vis && e.role === 'url' ? [clean(e.text)] : [],
    )[0] ?? '';

  return {
    brand,
    partner: clean(layout.shared?.partnerName ?? '') || 'Partner',
    version,
    hook: accented(
      lead
        ? [headline, leadLabel && lines(leadLabel, 2)].filter(Boolean).join('\n')
        : // A short word beside a figure is its unit, such as a ticker, so the line above opens instead.
          unit && cast?.kicker
          ? lines(cast.kicker)
          : lines(headline),
      lead !== undefined,
    ),
    bands: [brand, version].filter(Boolean).join(' '),
    // The design's own second line, so the hook does not say its headline twice.
    caption: sentences[0] ?? '',
    ask: `Ask ${brand}`,
    prompt: `What's new in ${about}?`,
    // The answer counts what the video goes on to show. With nothing to count, it is the tagline.
    reply: features.length
      ? `${features.length} new ${features.length === 1 ? 'thing' : 'things'}. Take a look.`
      : (sentences[0] ?? ''),
    steps: STEP_LINES.map((lines) => lines[0]),
    wall: `Everything new in ${about}`,
    features,
    stats,
    designLabel: cast?.kicker || brand,
    tagline: sentences[0] ?? cast?.kicker ?? '',
    // The person's own address, else the one on the design, else the kit's. None is made up.
    link:
      clean(layout.shared?.url ?? '') ||
      clean(byRole('url')?.text ?? '') ||
      url ||
      brandUrl(layout.kit?.name),
  };
}

/** The video's words: the person's own where they typed any, the design's for the rest. */
export const videoText = (layout: ICLayout, cast: DesignCast | null): ICVideoText => ({
  ...drawn(readDesign(layout, cast), layout.video),
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
    // The kit's accent, since a design's main button is often white or dark and not the brand's color.
    accent: scene.roles?.accent ?? c.accent,
    onAccent: scene.roles?.onAccent ?? c.onAccent,
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
    .filter((t) => t.sprite.canvas.width * t.sprite.canvas.height > area * 0.08)
    .map((t) => upright(t.sprite, t.e.rot ?? 0));
  return inDesign.length ? inDesign : [still];
}

const cuts = new WeakMap<Sprite, HTMLCanvasElement>();

/** A layer's own picture cut out of its sprite and set straight. A sprite has a wide clear
 *  margin for shadows and a turned layer's corners, which would show the picture small and
 *  tilted in a window. */
function upright(sprite: Sprite, rot: number): HTMLCanvasElement {
  const made = cuts.get(sprite);
  if (made) return made;
  const { canvas, box, ox, oy } = sprite;
  const cut = document.createElement('canvas');
  cut.width = Math.max(1, Math.round(box.w));
  cut.height = Math.max(1, Math.round(box.h));
  const ctx = cut.getContext('2d');
  if (ctx) {
    ctx.translate(box.w / 2, box.h / 2);
    ctx.rotate((-rot * Math.PI) / 180);
    ctx.drawImage(canvas, ox - (box.x + box.w / 2), oy - (box.y + box.h / 2));
  }
  cuts.set(sprite, cut);
  return cut;
}

export interface Slide {
  /** Its own name among the slides, since a thread has one slide a page. */
  id: string;
  kind: string;
  name: string;
  on: boolean;
  /** False when the design gives the slide nothing to show, so it cannot be switched on yet. */
  ready: boolean;
  content: unknown;
}

/** A design ready to play as a slide: where it is painted, and what paints it. */
export interface PageSlide {
  canvas: HTMLCanvasElement;
  paint: Paint | null;
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
  slides: (text: ICVideoText, media: Media[], pages: PageSlide[]) => SlideDef[];
}

// The slides storyboards share. Each takes its words from the same reading of the design.

const hookSlide = (t: ICVideoText): SlideDef => ({
  id: 'hook',
  kind: 'hook',
  name: 'Hook',
  ready: true,
  start: true,
  content: {
    kicker: [t.brand, t.version].filter(Boolean).join(' · '),
    lines: t.hook,
    bands: t.bands,
    caption: t.caption,
  } satisfies HookContent,
});

const featuresSlide = (t: ICVideoText): SlideDef => ({
  id: 'features',
  kind: 'features',
  name: 'Highlights',
  ready: t.features.length > 0,
  start: t.features.length > 0,
  content: { items: t.features, lead: t.features[0]?.pic ?? 0 } satisfies FeaturesContent,
});

const statsSlide = (t: ICVideoText): SlideDef => ({
  id: 'stats',
  kind: 'stats',
  name: 'Proof',
  ready: t.stats.some((s) => s.value),
  start: t.stats.some((s) => s.value),
  content: { items: t.stats } satisfies StatsContent,
});

/** The design itself as a slide, for stories where it is the point, such as a chart. */
const designSlideOf = (t: ICVideoText, design: PageSlide, name: string): SlideDef => ({
  id: 'design',
  kind: 'design',
  name,
  ready: true,
  start: true,
  content: { label: t.designLabel, ...design } satisfies DesignContent,
});

const outroSlide = (t: ICVideoText): SlideDef => ({
  id: 'outro',
  kind: 'outro',
  name: 'CTA',
  ready: true,
  start: true,
  content: { tagline: t.tagline, link: t.link } satisfies OutroContent,
});

const UPDATE: Storyboard = {
  id: 'update',
  name: 'Product update',
  packs: ['Product Updates'],
  slides: (t, media) => [
    hookSlide(t),
    {
      id: 'input',
      kind: 'input',
      name: 'Setup',
      ready: true,
      start: true,
      content: { label: t.ask, text: t.prompt, reply: t.reply } satisfies InputContent,
    },
    {
      id: 'working',
      kind: 'working',
      name: 'Build-up',
      ready: true,
      start: true,
      content: {
        steps: t.steps,
        draw: t.draw,
        count: t.features.length,
        ending: t.ending,
        mark: t.mark,
      } satisfies WorkingContent,
    },
    {
      id: 'wall',
      kind: 'wall',
      name: 'Reveal',
      ready: media.length > 0,
      // One picture repeated across a wall is not worth showing.
      start: media.length >= 3,
      content: { label: t.wall } satisfies WallContent,
    },
    featuresSlide(t),
    statsSlide(t),
    outroSlide(t),
  ],
};

// News is told straight: what happened, then any list or figure the design has.
const ANNOUNCE: Storyboard = {
  id: 'announce',
  name: 'Announcement',
  packs: ['Announcement'],
  slides: (t) => [hookSlide(t), featuresSlide(t), statsSlide(t), outroSlide(t)],
};

const PARTNER: Storyboard = {
  id: 'partner',
  name: 'Partnership',
  packs: ['Partnership'],
  slides: (t) => [
    {
      id: 'pair',
      kind: 'pair',
      name: 'Two brands',
      ready: true,
      start: true,
      content: { a: t.brand, b: t.partner } satisfies PairContent,
    },
    hookSlide(t),
    outroSlide(t),
  ],
};

const INFO: Storyboard = {
  id: 'info',
  name: 'Info',
  packs: ['Info'],
  slides: (t) => [hookSlide(t), statsSlide(t), outroSlide(t)],
};

// A benchmark's chart is the story, and its labels and cells are not features or results to
// read out, so the design plays on its own after the hook.
const BENCH: Storyboard = {
  id: 'bench',
  name: 'Benchmark',
  packs: ['Benchmarks'],
  slides: (t, _media, [design]) => [
    hookSlide(t),
    designSlideOf(t, design, 'Chart'),
    // The line under a chart is a footnote, which makes a poor closing line.
    outroSlide({ ...t, tagline: '' }),
  ],
};

const THREAD: Storyboard = {
  id: 'thread',
  name: 'Thread',
  packs: [],
  // A thread already tells its story page by page, so the pages are the slides.
  slides: (t, _media, pages) => [
    hookSlide(t),
    ...pages.map((page, i) => ({
      id: `page-${i + 1}`,
      kind: 'page',
      name: `Page ${i + 1}`,
      ready: true,
      start: true,
      content: { label: `${i + 1} / ${pages.length}`, ...page } satisfies DesignContent,
    })),
    outroSlide(t),
  ],
};

export const STORYBOARDS: Storyboard[] = [UPDATE, ANNOUNCE, PARTNER, INFO, BENCH, THREAD];

/** The storyboard for a design: a thread's own, else its pack's. Packs without one yet use the
 *  product update's. */
export const storyboardFor = (pack: string | undefined, pages: number): Storyboard =>
  pages > 1 ? THREAD : (STORYBOARDS.find((s) => pack && s.packs.includes(pack)) ?? UPDATE);

/** A storyboard's slides for one design, each on or off as the person or the storyboard set it. */
export function slidesOf(
  board: Storyboard,
  video: ICVideo,
  text: ICVideoText,
  media: Media[],
  pages: PageSlide[],
): Slide[] {
  return board.slides(text, media, pages).map(({ start, ...s }) => ({
    ...s,
    on: s.ready && (video.slides[s.id] ?? start),
  }));
}

/** The slides that play, as the engine takes them. */
export const scenesOf = (slides: Slide[], video: ICVideo): SceneSpec[] =>
  slides
    .filter((s) => s.on)
    .map((s) => ({ id: s.id, kind: s.kind, variant: video.variants[s.kind], content: s.content }));
