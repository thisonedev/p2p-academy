// Thread templates: posts for an X thread, in each built-in brand.

import {
  ANNOUNCE_BRANDS,
  type LayerBuilder,
  layerBuilder,
  renumber,
} from './image-constructor-announce.js';
import { SAMPLE_LOGO } from './image-constructor-brand-builtin.js';
import { patternFor } from './image-constructor-patterns.js';
import { type BrandKit, brandBackground } from './image-constructor-brand-kit.js';
import type { ICElement, ICRatio, ICTemplate } from './image-constructor-layout.js';

type Fmt = 'x' | 'sq' | 'st';

const HEIGHT: Record<Fmt, number> = { x: 56.25, sq: 100, st: (1920 / 1080) * 100 };
const FMTS: [Fmt, ICRatio][] = [
  ['x', 'x-post'],
  ['sq', '1:1'],
  ['st', 'story'],
];

interface Brand {
  id: string;
  kit: BrandKit;
  logo: { url: string; ratio: number };
}

const BRANDS: Brand[] = ANNOUNCE_BRANDS.map((b) => ({
  id: b.id,
  kit: b.kit,
  logo: b.kit.logo ? { url: b.kit.logo, ratio: b.kit.logoRatio } : SAMPLE_LOGO,
}));

interface Ctx {
  b: LayerBuilder;
  H: number;
  c: Brand;
}

type Layout = (x: Ctx) => ICElement[];

/** A faint pattern across the whole canvas, under everything else. */
const pattern = (b: LayerBuilder, H: number, art: string) =>
  b.art(patternFor(art, H), 0, 0, 100, { op: 0.22, lock: true });

const heading = (c: Brand) => ({ font: c.kit.fonts.heading, weight: 800, track: -0.02 });

/** The thread's closing post: the logo, a big caps headline and a warning that replies below are fake. */
const last: Layout = ({ b, H, c }) => {
  const [lx, ly, lw] = b.pick<[number, number, number]>([6, 6, 13], [7, 7, 18], [8, 26, 22]);
  const [hs, ss, gap, bottom] = b.pick<[number, number, number, number]>(
    [7.2, 2.3, 2.6, 6],
    [10, 3, 4, 7],
    [12, 3.4, 5, 30],
  );
  const headline = b.pick(
    'THIS IS THE\nLAST TWEET IN\nTHIS THREAD.',
    'THIS IS THE\nLAST TWEET IN\nTHIS THREAD.',
    'THIS IS THE\nLAST TWEET\nIN THIS\nTHREAD.',
  );
  const note = b.pick(
    'Any replies below that claim to be from us are scams.\nOnly trust links shared on our official channels.',
    'Any replies below that claim to be from us\nare scams. Only trust links shared on our\nofficial channels.',
    'Any replies below that claim\nto be from us are scams. Only\ntrust links shared on our\nofficial channels.',
  );
  const sy = H - bottom - note.split('\n').length * ss * 1.35;
  const hy = sy - gap - headline.split('\n').length * hs * 0.95;
  return [
    pattern(b, H, 'pattern-arcs-2'),
    b.image('logo', lx, ly, lw, c.logo.url, c.logo.ratio),
    b.text('headline', lx, hy, 100 - lx * 2, headline, hs, { ...heading(c), lh: 0.95 }),
    b.text('note', lx, sy, 100 - lx * 2, note, ss, { tone: 'muted', lh: 1.35 }),
  ];
};

/** Everything centered over a soft glow: the logo on top, then the headline and a short note. */
const end: Layout = ({ b, H, c }) => {
  const [ly, lw] = b.pick<[number, number]>([7, 16], [12, 24], [30, 28]);
  const [hs, ss, gap, mid] = b.pick<[number, number, number, number]>(
    [7, 2.3, 3, 32],
    [9.5, 3, 4, 55],
    [11, 3.4, 5, 90],
  );
  const headline = b.pick(
    'This is the end\nof the thread.',
    'This is the end\nof the thread.',
    'This is\nthe end of\nthe thread.',
  );
  const note = b.pick(
    "This is the last post in the thread. We won't post\nofficial updates below it.",
    "This is the last post in the thread.\nWe won't post official\nupdates below it.",
    "This is the last post in\nthe thread. We won't post\nofficial updates\nbelow it.",
  );
  const hh = headline.split('\n').length * hs * 1.05;
  const hy = mid - (hh + gap + note.split('\n').length * ss * 1.35) / 2;
  const glow = b.pick(70, 100, 130);
  return [
    pattern(b, H, 'pattern-arcs-7'),
    // Faint, so the muted note under the headline stays readable over it.
    b.art('glow', 50 - glow / 2, mid - glow / 2, glow, { op: 0.13, lock: true }),
    b.image('logo', 50 - lw / 2, ly, lw, c.logo.url, c.logo.ratio),
    b.text('headline', 5, hy, 90, headline, hs, { ...heading(c), lh: 1.05, align: 'center' }),
    b.text('note', 5, hy + hh + gap, 90, note, ss, { tone: 'muted', lh: 1.35, align: 'center' }),
  ];
};

/** A reply line running down past earlier posts to a lit final dot, with the count, headline and note. */
const counter: Layout = ({ b, c }) => {
  const [lx, dy, d, cs] = b.pick<[number, number, number, number]>(
    [8, 18, 3.2, 2.6],
    [9, 46, 4.4, 3.4],
    [10, 80, 5, 4],
  );
  const [hs, ss, gap] = b.pick<[number, number, number]>([8, 2.3, 3], [10, 3, 4], [12, 3.4, 5]);
  const [rx, ry, rw] = b.pick<[number, number, number]>([80, 6, 14], [75, 7, 18], [70, 26, 22]);
  const tx = lx + d * 1.6;
  const headline = b.pick('End of thread.', 'End of\nthread.', 'End of\nthread.');
  const note = b.pick(
    'Replies below that claim to be us are scams.\nCheck links on our official channels first.',
    'Replies below that claim to be us\nare scams. Check links on our\nofficial channels first.',
    'Replies below that claim\nto be us are scams. Check\nlinks on our official\nchannels first.',
  );
  const hy = dy + d;
  const hh = headline.split('\n').length * hs;
  const dot = (y: number, size: number, fill: 'accent' | 'muted') =>
    b.rect(lx - size / 2, y - size / 2, size, size, fill, { radius: size / 2 });
  return [
    b.rect(lx - 0.25, 0, 0.5, dy, 'muted', { op: 0.6 }),
    dot(dy * 0.3, d * 0.45, 'muted'),
    dot(dy * 0.62, d * 0.45, 'muted'),
    dot(dy, d, 'accent'),
    b.image('logo', rx, ry, rw, c.logo.url, c.logo.ratio),
    b.text('count', tx, dy - cs * 0.55, 30, '12/12', cs, {
      font: 'geist-mono',
      weight: 500,
      track: 0.1,
      tone: 'accent',
    }),
    b.text('headline', tx, hy, 100 - tx - 5, headline, hs, { ...heading(c), lh: 1 }),
    b.text('note', tx, hy + hh + gap, 100 - tx - 5, note, ss, { tone: 'muted', lh: 1.35 }),
  ];
};

const LAYOUTS: [key: string, title: string, layout: Layout][] = [
  ['last', 'Last tweet', last],
  ['end', 'End of thread', end],
  ['counter', 'Thread counter', counter],
];

function template(c: Brand, key: string, title: string, layout: Layout): ICTemplate {
  const [[, base], ...rest] = FMTS.map(([f, ratio]) => {
    const b = layerBuilder(HEIGHT[f], c.kit.roles, f);
    return [ratio, renumber(layout({ b, H: HEIGHT[f], c }))] as const;
  });
  const bg = brandBackground(c.kit);
  return {
    id: c.id === 'acme' ? `thread-${key}` : `thread-${c.id}-${key}`,
    title,
    pack: 'Threads',
    brand: c.id,
    family: key,
    ratio: 'x-post',
    scene: false,
    scenePrompt: '',
    seed: 1,
    model: 'flux2-klein',
    thumb: c.kit.roles.bg,
    bg,
    els: base,
    variants: Object.fromEntries(rest),
    source: null,
    kit: c.kit,
  };
}

export const THREADS_PACK: ICTemplate[] = BRANDS.flatMap((c) =>
  LAYOUTS.map(([key, title, layout]) => template(c, key, title, layout)),
);
