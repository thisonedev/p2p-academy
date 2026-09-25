// Product announcements in the style of QVAC's own: a release with angled phones, a feature drop
// with a laptop, and a version drop with building blocks. Each comes in every built-in brand, drawn
// in its colors and fonts, with mono type for labels and versions. They join the Announcement pack.

import {
  ANNOUNCE_BRANDS,
  type LayerBuilder,
  layerBuilder,
  renumber,
} from './image-constructor-announce.js';
import { SAMPLE_LOGO } from './image-constructor-brand-builtin.js';
import { type BrandKit, brandBackground } from './image-constructor-brand-kit.js';
import type { ICElement, ICRatio, ICTemplate } from './image-constructor-layout.js';
import { patternFor } from './image-constructor-patterns.js';

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
  name: string;
  logo: { url: string; ratio: number };
}

const BRANDS: Brand[] = ANNOUNCE_BRANDS.map((b) => ({
  id: b.id,
  kit: b.kit,
  name: b.id === 'tether' ? 'Tether' : b.id === 'qvac' ? 'QVAC' : 'Your Brand',
  logo: b.kit.logo ? { url: b.kit.logo, ratio: b.kit.logoRatio } : SAMPLE_LOGO,
}));

interface Ctx {
  b: LayerBuilder;
  H: number;
  c: Brand;
}

type Layout = (x: Ctx) => ICElement[];

const MONO = { font: 'geist-mono' as const, weight: 500 };
const head = (c: Brand) => ({ font: c.kit.fonts.heading, weight: 700, track: -0.02, lh: 1.08 });

/** The logo `w` wide at x, y, and the height it takes. */
function logo(x: Ctx, lx: number, ly: number, w: number) {
  const { url, ratio } = x.c.logo;
  return { el: x.b.image('logo', lx, ly, w, url, ratio), h: w / ratio };
}

/** A mono label in an accent outline, like a terminal button. */
function outlinePill(x: Ctx, px: number, py: number, text: string, size: number) {
  const r = x.c.kit.roles;
  const w = size * (text.length * 0.62 + 3.2);
  const h = size * 2.4;
  return x.b.pill('badge', px, py, w, h, text, size, 'outline', {
    ...MONO,
    fill: '',
    stroke: r.accent,
    color: r.accent,
    track: 0.06,
    radius: h * 0.18,
    pal: { stroke: 'accent', color: 'accent' },
  });
}

/** A faint plus grid spreading from a corner, the texture behind QVAC's product shots. */
const texture = (x: Ctx, seed: number) =>
  x.b.art(patternFor(`pattern-plus-${seed}`, x.H), 0, 0, 100, { op: 0.3, lock: true });

/** The big logo, the product name and its version on the left; two phones at an angle. */
const release: Layout = (x) => {
  const { b } = x;
  const [lx, ly, lw] = b.pick<[number, number, number]>([6, 16, 42], [8, 11, 50], [10, 26, 62]);
  const lg = logo(x, lx, ly, lw);
  const ps = b.pick(4.6, 6, 7);
  const vs = b.pick(4, 5.2, 6);
  const py = ly + lg.h + b.pick(4, 4, 5);
  const glow = b.pick(80, 110, 140);
  const phones = b.pick<[number, number, number, number, number, number]>(
    [60, 9, 19, 74, 5, 21],
    [40, 45, 25, 62, 40, 27],
    [10, 84, 40, 44, 76, 44],
  );
  return [
    b.art('glow', lx + lw / 2 - glow / 2, b.pick(28, 30, 50) - glow / 2, glow, {
      op: 0.22,
      lock: true,
    }),
    lg.el,
    b.text('product', lx, py, 60, 'Workbench', ps, { ...MONO, weight: 400, lh: 1.1 }),
    b.text('version', lx, py + ps * 1.1 + b.pick(4, 4, 5), 40, '0.7.0', vs, {
      ...MONO,
      tone: 'accent',
      lh: 1.1,
    }),
    b.art('screen-phone-left', phones[0], phones[1], phones[2]),
    b.art('screen-phone-right', phones[3], phones[4], phones[5]),
  ];
};

/** The logo and product name, a big accent headline and a New Feature tag; a laptop to the right. */
const feature: Layout = (x) => {
  const { b, c } = x;
  const [lx, ly, lw] = b.pick<[number, number, number]>([6, 8, 30], [7, 8, 40], [8, 26, 44]);
  const lg = logo(x, lx, ly, lw);
  const ps = b.pick(5, 6.4, 7);
  const py = ly + lg.h + b.pick(1.5, 2, 2.5);
  const hs = b.pick(4.8, 6.8, 7.4);
  const hy = py + ps * 1.2 + b.pick(5, 5, 7);
  const headline = 'Batch prompts\nand run them\nconcurrently.';
  const lap = b.pick<[number, number, number]>([50, 9, 62], [30, 64, 82], [8, 104, 100]);
  return [
    texture(x, 12),
    lg.el,
    b.text('product', lx, py, 40, 'SDK', ps, { ...MONO, lh: 1.1 }),
    b.text('headline', lx, hy, b.pick(44, 86, 84), headline, hs, { ...head(c), tone: 'accent' }),
    outlinePill(x, lx, hy + 3 * hs * 1.08 + b.pick(4, 5, 6), 'New Feature', b.pick(2, 2.6, 3)),
    b.art('screen-laptop', ...lap),
  ];
};

/** Building blocks in line art, the product name, a feature tag, a tagline and the version. */
const drop: Layout = (x) => {
  const { b } = x;
  const [bx, by, bw] = b.pick<[number, number, number]>([3, 5, 44], [3, 20, 54], [6, 44, 80]);
  const [lx, ly, lw] = b.pick<[number, number, number]>([58, 7, 30], [56, 8, 36], [10, 26, 44]);
  const lg = logo(x, lx, ly, lw);
  const tag = b.pick(2.4, 2.8, 3.2);
  const [tx, ty] = b.pick<[number, number]>([54, 19], [56, ly + lg.h + 5], [10, ly + lg.h + 5]);
  const [gx, gy, gs] = b.pick<[number, number, number]>([48, 31, 3], [7, 76, 3.8], [10, 117, 4.4]);
  const tagline = b.pick(
    'Voice, vision, agents on\nhardware you already own',
    'Voice, vision, agents on\nhardware you already own',
    'Voice, vision, agents\non hardware you\nalready own',
  );
  const [sx, sy, ss] = b.pick<[number, number, number]>([12, 43, 8], [60, 52, 10], [10, 100, 12]);
  return [
    texture(x, 31),
    b.art('iso-bricks', bx, by, bw),
    lg.el,
    outlinePill(x, tx, ty, 'New Feature Drops', tag),
    b.text('tagline', gx, gy, b.pick(48, 86, 80), tagline, gs, {
      ...MONO,
      tone: 'accent',
      lh: 1.3,
    }),
    b.text(
      'version',
      gx,
      gy + tagline.split('\n').length * gs * 1.3 + b.pick(3, 3, 4),
      50,
      'Version 0.15.0',
      gs * 0.9,
      { ...MONO, lh: 1.1 },
    ),
    b.text('product', sx, sy, 40, 'SDK', ss, { ...MONO, tone: 'accent', track: 0.12, lh: 1 }),
  ];
};

/** One upright phone in the middle, with a title, a short caption and where to get it. */
const spotlight: Layout = (x) => {
  const { b, c } = x;
  const [pw, py] = b.pick<[number, number]>([15, 4], [25, 7], [38, 28]);
  const ph = pw * 2;
  const ts = b.pick(3.6, 5, 6);
  const cs = b.pick(1.9, 2.7, 3.2);
  const ms = b.pick(1.6, 2.2, 2.6);
  const ty = py + ph + b.pick(3, 4.5, 6);
  const cy = ty + ts * 1.2 + b.pick(1.2, 1.8, 2.2);
  const glow = b.pick(70, 100, 130);
  return [
    b.art('glow', 50 - glow / 2, py + ph / 2 - glow / 2, glow, { op: 0.18, lock: true }),
    b.art('screen-phone', 50 - pw / 2 - pw * 0.05, py - pw * 0.02, pw * 1.1),
    b.text('headline', 5, ty, 90, 'Your AI, your way', ts, { ...head(c), align: 'center' }),
    b.text('sub', 5, cy, 90, `Meet the new ${c.name} app. Private by default.`, cs, {
      tone: 'muted',
      align: 'center',
      lh: 1.3,
    }),
    b.text(
      'store',
      5,
      cy + cs * 1.3 + b.pick(1.4, 2, 2.4),
      90,
      'AVAILABLE ON iOS AND ANDROID',
      ms,
      {
        ...MONO,
        tone: 'accent',
        track: 0.16,
        align: 'center',
      },
    ),
  ];
};

/** Three phones tilted the same way and staggered, as if floating, beside the headline. */
const floating: Layout = (x) => {
  const { b, c } = x;
  const es = b.pick(1.8, 2.4, 2.8);
  const hs = b.pick(4.6, 7, 7.6);
  const [hx, ey, hw] = b.pick<[number, number, number]>([6, 12, 37], [7, 7, 86], [8, 26, 84]);
  const hy = ey + es * 1.2 + b.pick(1.5, 2, 2.5);
  const headline = b.pick(
    'Three screens,\none flow',
    'Three screens, one flow',
    'Three screens,\none flow',
  );
  const sub = b.pick(
    'Swap, track and send\nwithout leaving the app.',
    'Swap, track and send without leaving the app.',
    'Swap, track and send\nwithout leaving the app.',
  );
  const ss = b.pick(2.2, 3, 3.4);
  const sy = hy + headline.split('\n').length * hs * 1.08 + b.pick(2, 2.5, 3);
  const w = b.pick(13, 21, 24);
  const spots = b.pick<[number, number][]>(
    [
      [45, 12],
      [62, 6],
      [79, 14],
    ],
    [
      [6, 42],
      [38, 34],
      [70, 46],
    ],
    [
      [4, 80],
      [37, 72],
      [69, 86],
    ],
  );
  return [
    b.text('eyebrow', hx, ey, hw, 'NEW IN THE APP', es, { ...MONO, tone: 'accent', track: 0.16 }),
    b.text('headline', hx, hy, hw, headline, hs, head(c)),
    b.text('sub', hx, sy, hw, sub, ss, { tone: 'muted', lh: 1.35 }),
    ...b.pick(
      [outlinePill(x, hx, sy + sub.split('\n').length * ss * 1.35 + 3, 'Update now', 2.1)],
      [],
      [],
    ),
    ...spots.map(([px, py]) => b.art('screen-phone', px, py, w * 1.1, { rot: -16 })),
  ];
};

/** A phone lying flat on a textured surface, seen from above, with the headline, a tag and ratings. */
const surface: Layout = (x) => {
  const { b, c, H } = x;
  const hs = b.pick(4.8, 7.2, 8);
  const [hx, hy, hw] = b.pick<[number, number, number]>([6, 11, 40], [7, 8, 86], [8, 26, 84]);
  const headline = b.pick(
    'Your whole team,\nin your pocket',
    'Your whole team,\nin your pocket',
    'Your whole\nteam, in\nyour pocket',
  );
  const ss = b.pick(2.2, 3, 3.4);
  const sy = hy + headline.split('\n').length * hs * 1.08 + b.pick(2, 2.5, 3);
  const sub = b.pick(
    'Chat, share files and plan\ntogether, all on-device.',
    'Chat, share files and plan together, all on-device.',
    'Chat, share files and plan\ntogether, all on-device.',
  );
  const py = sy + sub.split('\n').length * ss * 1.35 + b.pick(3, 3.5, 4);
  const ps = b.pick(2.2, 2.8, 3.2);
  const [ax, ay, aw] = b.pick<[number, number, number]>([47, 12, 53], [10, 46, 86], [0, 78, 104]);
  return [
    b.art(patternFor('pattern-dots-3', H), 0, 0, 100, { op: 0.35, lock: true }),
    b.text('headline', hx, hy, hw, headline, hs, head(c)),
    b.text('sub', hx, sy, hw, sub, ss, { tone: 'muted', lh: 1.35 }),
    outlinePill(x, hx, py, 'New app', ps),
    b.text(
      'rating',
      hx,
      py + ps * 2.4 + b.pick(2.5, 3, 3.5),
      hw,
      '4.9 RATING · 100K+ DOWNLOADS',
      ps * 0.8,
      {
        ...MONO,
        tone: 'muted',
        track: 0.12,
      },
    ),
    b.art('screen-phone-flat', ax, ay, aw),
  ];
};

const LAYOUTS: [key: string, title: string, layout: Layout][] = [
  ['release', 'Release', release],
  ['feature', 'Feature drop', feature],
  ['drop', 'Version drop', drop],
  ['spotlight', 'Phone spotlight', spotlight],
  ['floating', 'Floating screens', floating],
  ['surface', 'Phone on a surface', surface],
];

function template(c: Brand, key: string, title: string, layout: Layout): ICTemplate {
  const [[, base], ...rest] = FMTS.map(([f, ratio]) => {
    const b = layerBuilder(HEIGHT[f], c.kit.roles, f);
    return [ratio, renumber(layout({ b, H: HEIGHT[f], c }))] as const;
  });
  const bg = brandBackground(c.kit);
  return {
    id: c.id === 'acme' ? `product-${key}` : `product-${c.id}-${key}`,
    title,
    pack: 'Announcement',
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

export const PRODUCT_PACK: ICTemplate[] = BRANDS.flatMap((c) =>
  LAYOUTS.map(([key, title, layout]) => template(c, key, title, layout)),
);
