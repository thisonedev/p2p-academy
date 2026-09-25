// Co-brand templates: two brands share one canvas. Side `a` layers follow the design's kit, side `b`
// layers follow the partner's colors, and each layout sets its words its own way: a card, a band,
// a ticket, a frame. Every layout comes in each brand; the partner starts in a deeper shade of the
// brand's accent and takes the partner logo's color once one is added.

import {
  layerBuilder,
  type LayerBuilder,
  PARTNER_LOGO,
  renumber,
} from './image-constructor-announce.js';
import { device } from './image-constructor-device.js';
import {
  BRAND_LOGOS,
  DEGEN_KIT,
  GLASS_KIT,
  QVAC_KIT,
  SAMPLE_KIT,
  SAMPLE_LOGO,
  SAMPLE_LOGO_ON_LIGHT,
  TETHER_KIT,
} from './image-constructor-brand-builtin.js';
import type { BrandKit } from './image-constructor-brand-kit.js';
import type { ICFont } from './image-constructor-font-list.js';
import type {
  ICBackground,
  ICElement,
  ICRatio,
  ICSide,
  ICTemplate,
} from './image-constructor-layout.js';
import { brandPartner } from './image-constructor-layout.js';
import { patternFor } from './image-constructor-patterns.js';

type Fmt = 'x' | 'sq' | 'st';
type B = LayerBuilder;

const HEIGHT: Record<Fmt, number> = { x: 56.25, sq: 100, st: (1920 / 1080) * 100 };
const FMTS: [Fmt, ICRatio][] = [
  ['x', 'x-post'],
  ['sq', '1:1'],
  ['st', 'story'],
];

const INK = '#10131c';
const GREY = '#6b7185';
const WHITE = '#ffffff';
const NIGHT = '#0f1115';
// An empty `pal` keeps neutral words and cards as they are, whatever kit or partner is on.
const NEUTRAL = { pal: {} };

/** One brand's side of every co-brand layout: its kit and how its logo sits. */
interface CoBrand {
  id: string;
  name: string;
  kit: BrandKit;
  logo: { url: string; ratio: number };
  /** The pill behind each logo. White suits most marks; a light mark needs a dark one. */
  plate: string;
  /** The logo that reads straight on the brand's own background, for layouts without plates. */
  bare: { url: string; ratio: number };
  heading: ICFont;
  url: string;
}

const BRANDS: CoBrand[] = [
  {
    id: 'acme',
    name: 'Your Brand',
    kit: SAMPLE_KIT,
    logo: SAMPLE_LOGO_ON_LIGHT,
    plate: WHITE,
    bare: SAMPLE_LOGO,
    heading: 'grotesk',
    url: 'yourbrand.xyz',
  },
  {
    id: 'glass',
    name: 'Your Brand',
    kit: GLASS_KIT,
    logo: SAMPLE_LOGO_ON_LIGHT,
    plate: WHITE,
    bare: SAMPLE_LOGO,
    heading: 'grotesk',
    url: 'yourbrand.xyz',
  },
  {
    id: 'degen',
    name: 'Your Brand',
    kit: DEGEN_KIT,
    logo: SAMPLE_LOGO_ON_LIGHT,
    plate: WHITE,
    bare: SAMPLE_LOGO,
    heading: 'archivo-black',
    url: 'yourbrand.xyz',
  },
  {
    id: 'tether',
    name: 'Tether',
    kit: TETHER_KIT,
    logo: { url: BRAND_LOGOS.tetherWordmark.url(), ratio: BRAND_LOGOS.tetherWordmark.ratio },
    plate: WHITE,
    bare: { url: BRAND_LOGOS.tetherWordmark.url(), ratio: BRAND_LOGOS.tetherWordmark.ratio },
    heading: 'sans',
    url: 'tether.to',
  },
  {
    id: 'qvac',
    name: 'QVAC',
    kit: QVAC_KIT,
    logo: { url: BRAND_LOGOS.qvacWordmark.url(), ratio: BRAND_LOGOS.qvacWordmark.ratio },
    plate: '#0f1010',
    bare: { url: BRAND_LOGOS.qvacWordmark.url(), ratio: BRAND_LOGOS.qvacWordmark.ratio },
    heading: 'geist',
    url: 'qvac.tether.io',
  },
];

const PARTNER = { name: 'Partner', url: PARTNER_LOGO, ratio: 3.6 };

/** What one layout says. `{a}` is the brand's own name and `{url}` its address. */
interface Copy {
  eyebrow: string;
  headline: string;
  cta: string;
  url: string;
}

const fill = (text: string, c: CoBrand) =>
  text.replaceAll('{a}', c.name).replaceAll('{url}', c.url);

/** One brand in one format: the builder, the canvas height and a type scale. */
interface Ctx {
  b: B;
  H: number;
  c: CoBrand;
  k: number;
}

/** A logo on a pill, so any mark reads on either brand's color. Every plate is the same size, and the
 *  logo sits whole and centered in a fixed box on it, so a square or a wide logo both fit when swapped in. */
function plate(x: Ctx, side: ICSide, px: number, py: number, logoW: number) {
  const { b, c } = x;
  const own = side === 'a';
  const { url, ratio } = own ? c.logo : PARTNER;
  const padX = logoW * 0.16;
  const padY = logoW * 0.1;
  const boxH = logoW * 0.36;
  const w = logoW + padX * 2;
  const h = boxH + padY * 2;
  return {
    w,
    h,
    els: [
      b.rect(px, py, w, h, '', { fill: own ? c.plate : WHITE, radius: h / 2, ...NEUTRAL }),
      b.logo(own ? 'logo' : 'partner_logo', px + padX, py + padY, logoW, boxH, url, ratio),
    ],
  };
}

const NAME_SLOT: Record<ICSide, string> = { a: 'brand_name', b: 'partner_name' };

function brandName(
  x: Ctx,
  side: ICSide,
  px: number,
  py: number,
  w: number,
  align: 'left' | 'center' | 'right' = 'left',
) {
  return x.b.text(NAME_SLOT[side], px, py, w, side === 'a' ? x.c.name : PARTNER.name, 4.4 * x.k, {
    side,
    tone: 'onAccent',
    font: x.c.heading,
    weight: 700,
    track: -0.01,
    align,
    role: NAME_SLOT[side],
  });
}

/** Inter-like badge width: about 0.58em a character, with 1.1em each side. Capitals run wider. */
const pillW = (text: string, size: number) =>
  size * ((text === text.toUpperCase() ? 0.74 : 0.58) * [...text].length + 2.2);

/** The height `words` takes. */
const wordsHeight = (k: number) =>
  10 * k + 3 * k * 1.1 + 1.6 * k + 5.8 * k * 1.12 * 2 + 4 * k + 7 * k;

/** Label, two-line headline, a button and the address, on a white card or straight on a dark band. */
function words(x: Ctx, copy: Copy, wx: number, wy: number, w: number, dark: boolean): ICElement[] {
  const { b, c, k } = x;
  const pad = 5 * k;
  const head = 5.8 * k;
  const small = 3 * k;
  const pillH = 7 * k;
  const h = wordsHeight(k);
  const top = wy + pad;
  const rowY = top + small * 1.1 + 1.6 * k + head * 1.12 * 2 + 4 * k;
  const ink = dark ? '#f3f5fb' : INK;
  const soft = dark ? '#8a90a6' : GREY;
  return [
    ...(dark ? [] : [b.rect(wx, wy, w, h, '', { fill: WHITE, radius: 3.5 * k, ...NEUTRAL })]),
    b.text('eyebrow', wx + pad, top, w - pad * 2, copy.eyebrow, small, {
      color: soft,
      weight: 600,
      ...NEUTRAL,
    }),
    b.text(
      'headline',
      wx + pad,
      top + small * 1.1 + 1.6 * k,
      w - pad * 2,
      fill(copy.headline, c),
      head,
      {
        color: ink,
        font: c.heading,
        weight: 700,
        track: -0.03,
        lh: 1.12,
        ...NEUTRAL,
      },
    ),
    b.pill('cta', wx + pad, rowY, pillW(copy.cta, small), pillH, copy.cta, small, 'solid', {
      fill: dark ? '#f3f5fb' : INK,
      color: dark ? INK : WHITE,
      ...NEUTRAL,
    }),
    b.text(
      'url',
      wx + w - pad - 30,
      rowY + pillH / 2 - small * 0.55,
      30,
      fill(copy.url, c),
      small,
      {
        color: soft,
        align: 'right',
        font: 'geist-mono',
        ...NEUTRAL,
      },
    ),
  ];
}

type Layout = (x: Ctx, copy: Copy) => ICElement[];

const logoW = (b: B) => b.pick(13, 20, 26);
/** Plate height for a logo width; the same for every logo. */
const plateH = (w: number) => w * 0.56;
const ellipse = (el: ICElement) => ({ ...el, kind: 'ellipse' as const }) as ICElement;

/** Your brand fills the canvas and the partner's color cuts in on a slant from the bottom right. */
const diagonal: Layout = (x, copy) => {
  const { b, H, k } = x;
  const m = b.pick(5.5, 7, 8);
  const top = b.pick(5.5, 7, 22);
  const bottom = b.pick(5.5, 7, 30);
  const lw = logoW(b);
  const pa = plate(x, 'a', m, top, lw);
  const pb = plate(x, 'b', 100 - m - lw * 1.32, H - bottom - plateH(lw), lw);
  const cw = b.pick(52, 84, 84);
  return [
    b.rect(0, 0, 100, H, 'accent', { side: 'a' }),
    b.rect(-30, H * b.pick(0.52, 0.6, 0.58), 160, H, 'accent', {
      side: 'b',
      rot: b.pick(-11, -18, -24),
    }),
    ...pa.els,
    brandName(x, 'a', m + pa.w + 2.5 * k, top + pa.h / 2 - 2.4 * k, 40),
    ...pb.els,
    brandName(x, 'b', 100 - m - pb.w - 42.5 * k, H - bottom - pb.h / 2 - 2.4 * k, 40 * k, 'right'),
    ...words(x, copy, (100 - cw) / 2, H / 2 - wordsHeight(k) / 2, cw, false),
  ];
};

/** Two halves side by side above a dark band that holds the words. */
const split: Layout = (x, copy) => {
  const { b, H, c, k } = x;
  // The band is as tall as its words need, and the halves take the rest.
  const top = Math.min(H * 0.58, H - wordsHeight(k) - b.pick(1.5, 4, 10));
  const lw = logoW(b) * 1.15;
  const ph = plateH(lw);
  const py = top / 2 - ph / 2 - 3 * k;
  const pa = plate(x, 'a', 25 - (lw * 1.32) / 2, py, lw);
  const pb = plate(x, 'b', 75 - (lw * 1.32) / 2, py, lw);
  const dot = 9 * k;
  return [
    b.rect(0, 0, 50, top, 'accent', { side: 'a' }),
    b.rect(50, 0, 50, top, 'accent', { side: 'b' }),
    ...pa.els,
    ...pb.els,
    brandName(x, 'a', 0, py + ph + 3 * k, 50, 'center'),
    brandName(x, 'b', 50, py + ph + 3 * k, 50, 'center'),
    ellipse(
      b.rect(50 - dot / 2, top / 2 - dot / 2 - 3 * k, dot, dot, '', {
        fill: NIGHT,
        line: WHITE,
        sw: 0.6 * k,
        ...NEUTRAL,
      }),
    ),
    b.text('x', 50 - dot / 2, top / 2 - 3 * k - 2.4 * k, dot, '×', 4.4 * k, {
      color: WHITE,
      align: 'center',
      weight: 600,
      slot: undefined,
      ...NEUTRAL,
    }),
    b.rect(0, top, 100, H - top, '', { fill: NIGHT, ...NEUTRAL }),
    // Story words sit at the top of the band, above the app's caption bar.
    ...words(
      x,
      copy,
      b.pick(1.5, 2, 3),
      b.pick(top + (H - top - wordsHeight(k)) / 2, top + (H - top - wordsHeight(k)) / 2, top),
      96,
      true,
    ),
  ];
};

/** Your brand on top, the partner's below, with the words on a card over the seam. */
const stacked: Layout = (x, copy) => {
  const { b, H, k } = x;
  const m = b.pick(5.5, 7, 8);
  const top = b.pick(5.5, 7, 22);
  const bottom = b.pick(5.5, 7, 30);
  const lw = logoW(b);
  const pa = plate(x, 'a', m, top, lw);
  const ph = plateH(lw);
  const pb = plate(x, 'b', 100 - m - lw * 1.32, H - bottom - ph, lw);
  const cw = b.pick(56, 84, 84);
  return [
    b.rect(0, 0, 100, H / 2, 'accent', { side: 'a' }),
    b.rect(0, H / 2, 100, H / 2, 'accent', { side: 'b' }),
    ...pa.els,
    brandName(x, 'a', m + pa.w + 2.5 * k, top + pa.h / 2 - 2.4 * k, 40),
    ...pb.els,
    brandName(x, 'b', 100 - m - pb.w - 42.5 * k, H - bottom - ph / 2 - 2.4 * k, 40 * k, 'right'),
    ...words(x, copy, (100 - cw) / 2, H / 2 - wordsHeight(k) / 2, cw, false),
  ];
};

/** Two overlapping circles, one per brand, and a big lockup caption with no card. */
const overlap: Layout = (x, copy) => {
  const { b, H, c, k } = x;
  const d = b.pick(30, 48, 58);
  const cy = b.pick(H / 2 - 15, 8, 30);
  const ax = b.pick(5, (100 - d * 1.68) / 2, (100 - d * 1.68) / 2);
  const bx = ax + d * 0.68;
  const lw = d * 0.46;
  const pa = plate(x, 'a', ax + d / 2 - (lw * 1.32) / 2 - d * 0.1, cy + d / 2 - plateH(lw) / 2, lw);
  const pb = plate(x, 'b', bx + d / 2 - (lw * 1.32) / 2 + d * 0.1, cy + d / 2 - plateH(lw) / 2, lw);
  const tx = b.pick(ax + d * 1.68 + 5, 8, 8);
  const tw = 100 - tx - b.pick(5, 8, 8);
  const ty = b.pick(H / 2 - 9, cy + d + 7, cy + d + 12);
  const head = b.pick(4.2, 6.6, 7.6);
  const align = b.pick<'left' | 'center'>('left', 'center', 'center');
  return [
    ellipse(b.rect(ax, cy, d, d, 'accent', { side: 'a' })),
    ellipse(b.rect(bx, cy, d, d, 'accent', { side: 'b', op: 0.92 })),
    ...pa.els,
    ...pb.els,
    b.text('eyebrow', tx, ty, tw, copy.eyebrow, 3 * k, { tone: 'muted', weight: 600, align }),
    // X is short and wide, so the lockup line breaks after the ×.
    b.text(
      'headline',
      tx,
      ty + 3 * k * 1.1 + 1.6 * k,
      tw,
      fill(copy.headline, c).replace(' × ', b.pick(' ×\n', ' × ', ' × ')),
      head,
      {
        font: c.heading,
        weight: 700,
        track: -0.03,
        lh: 1.1,
        align,
      },
    ),
  ];
};

/** Your color frames the canvas; the partner's panel sits inside and carries the words in its own colors. */
const frame: Layout = (x, copy) => {
  const { b, H, c, k } = x;
  const m = b.pick(5, 6, 7);
  const band = b.pick(15, 24, 64);
  const lw = logoW(b);
  const pa = plate(x, 'a', m, band / 2 - plateH(lw) / 2, lw);
  const inner = { x: m, y: band, w: 100 - m * 2, h: H - band - m };
  const pb = plate(x, 'b', inner.x + 5 * k, inner.y + 5 * k, lw);
  const pad = 6 * k;
  const head = b.pick(4.4, 7, 8);
  const small = 3 * k;
  const pillH = 7 * k;
  const blockH = small * 1.1 + 1.6 * k + head * 1.1 * 2 + 4 * k + pillH;
  const ty = inner.y + inner.h - pad - blockH - b.pick(0, 0, 17);
  return [
    b.rect(0, 0, 100, H, 'accent', { side: 'a' }),
    b.rect(inner.x, inner.y, inner.w, inner.h, 'accent', { side: 'b', radius: 3 * k }),
    ...pa.els,
    brandName(x, 'a', m + pa.w + 2.5 * k, band / 2 - 2.4 * k, 40),
    ...pb.els,
    brandName(x, 'b', inner.x + 5 * k + pb.w + 2.5 * k, inner.y + 5 * k + pb.h / 2 - 2.4 * k, 40),
    b.text('eyebrow', inner.x + pad, ty, inner.w - pad * 2, copy.eyebrow, small, {
      side: 'b',
      tone: 'onAccent',
      weight: 600,
    }),
    b.text(
      'headline',
      inner.x + pad,
      ty + small * 1.1 + 1.6 * k,
      inner.w - pad * 2,
      fill(copy.headline, c),
      head,
      {
        side: 'b',
        tone: 'onAccent',
        font: c.heading,
        weight: 700,
        track: -0.03,
        lh: 1.1,
      },
    ),
    b.pill(
      'cta',
      inner.x + pad,
      ty + blockH - pillH,
      pillW(copy.cta, small),
      pillH,
      copy.cta,
      small,
      'solid',
      {
        fill: WHITE,
        color: INK,
        ...NEUTRAL,
      },
    ),
  ];
};

/** Two tilted brand cards, like trading cards, with sticker tags and the words on your background. */
const fan: Layout = (x, copy) => {
  const { b, H, c, k } = x;
  const cw = b.pick(24, 32, 42);
  const ch = cw * 1.22;
  const cy = b.pick(H / 2 - ch / 2 - 2, 7, 26);
  const ax = b.pick(7, 18, 10);
  const bx = ax + cw * 0.72;
  const lw = cw * 0.62;
  const pa = plate(x, 'a', ax + cw / 2 - (lw * 1.32) / 2, cy + ch * 0.36 - plateH(lw) / 2, lw);
  const pb = plate(x, 'b', bx + cw / 2 - (lw * 1.32) / 2, cy + ch * 0.58 - plateH(lw) / 2, lw);
  const tag = 3 * k;
  const tagH = 6.4 * k;
  const tx = b.pick(bx + cw + 7, 8, 8);
  const tw = 100 - tx - b.pick(5, 8, 8);
  const ty = b.pick(H / 2 - 12, cy + ch + 9, cy + ch + 16);
  const head = b.pick(4.4, 6.4, 7.4);
  return [
    b.rect(ax, cy, cw, ch, 'accent', { side: 'a', radius: 3 * k, rot: -8 }),
    b.rect(bx, cy + ch * 0.1, cw, ch, 'accent', { side: 'b', radius: 3 * k, rot: 7 }),
    ...pa.els,
    ...pb.els,
    b.pill('tag', ax - 2 * k, cy - 2 * k, pillW('NEW', tag), tagH, 'NEW', tag, 'solid', {
      rot: -10,
    }),
    b.pill(
      'tag',
      bx + cw - 10 * k,
      cy + ch * 0.95,
      pillW('COLLAB', tag),
      tagH,
      'COLLAB',
      tag,
      'solid',
      {
        rot: 8,
        fill: WHITE,
        color: INK,
        ...NEUTRAL,
      },
    ),
    b.text('headline', tx, ty, tw, fill(copy.headline, c), head, {
      font: c.heading,
      weight: 700,
      track: -0.03,
      lh: 1.1,
    }),
    b.pill(
      'cta',
      tx,
      ty + head * 1.1 * 2 + 4 * k,
      pillW(copy.cta, tag),
      7 * k,
      copy.cta,
      tag,
      'solid',
    ),
  ];
};

/** An event ticket: your part with the words, the partner's stub with the time, a perforation between. */
const ticket: Layout = (x, copy) => {
  const { b, H, c, k } = x;
  const tall = b.f === 'st';
  const m = b.pick(8, 7, 8);
  const tw = 100 - m * 2;
  const th = b.pick(38, 56, 118);
  const ty = tall ? 26 : (H - th) / 2;
  const cut = tall ? th * 0.7 : tw * 0.64;
  const notch = 6 * k;
  const lw = logoW(b) * 0.9;
  const pad = 5.5 * k;
  const head = b.pick(4, 5.6, 7.6);
  const small = 3 * k;
  // The same number of holes in every size, spaced to fit, so the layers line up between sizes.
  const holes = 24;
  const step = (tall ? tw : th) / holes;
  const stub = tall
    ? { x: m, y: ty + cut, w: tw, h: th - cut }
    : { x: m + cut, y: ty, w: tw - cut, h: th };
  const pa = plate(x, 'a', m + pad, ty + pad, lw);
  const pb = plate(x, 'b', stub.x + pad, stub.y + pad, lw);
  const hy = ty + pad + pa.h + 4 * k;
  const hole = (px: number, py: number, size: number) =>
    ellipse(b.rect(px - size / 2, py - size / 2, size, size, 'bg'));
  return [
    b.rect(m, ty, tw, th, 'accent', { side: 'a', radius: 3 * k }),
    b.rect(stub.x, stub.y, stub.w, stub.h, 'accent', { side: 'b', radius: 3 * k }),
    // The perforation: a row of small holes in the background color, and a notch at each end.
    ...Array.from({ length: holes }, (_, i) =>
      tall
        ? hole(m + step * (i + 0.5), stub.y, 1.2 * k)
        : hole(stub.x, ty + step * (i + 0.5), 1.2 * k),
    ),
    ...(tall
      ? [hole(m, stub.y, notch), hole(m + tw, stub.y, notch)]
      : [hole(stub.x, ty, notch), hole(stub.x, ty + th, notch)]),
    ...pa.els,
    ...pb.els,
    b.text('eyebrow', m + pad, hy, cut - pad * 2, copy.eyebrow, small, {
      side: 'a',
      tone: 'onAccent',
      weight: 600,
    }),
    b.text(
      'headline',
      m + pad,
      hy + small * 1.1 + 1.6 * k,
      (tall ? tw : cut) - pad * 2,
      fill(copy.headline, c),
      head,
      {
        side: 'a',
        tone: 'onAccent',
        font: c.heading,
        weight: 700,
        track: -0.03,
        lh: 1.1,
      },
    ),
    b.text('time', stub.x + pad, stub.y + pad + pb.h + 3 * k, stub.w - pad * 2, copy.cta, small, {
      side: 'b',
      tone: 'onAccent',
      font: 'geist-mono',
      weight: 600,
      lh: 1.35,
    }),
  ];
};

/** Both logos stacked on the background with a thin cross between, over lines that flow from your
 *  color into the partner's. */
const wave: Layout = (x) => {
  const { b, H, c, k } = x;
  const lw = b.pick(30, 44, 56);
  const lh = lw * 0.3;
  const cross = b.pick(6, 9, 11);
  const gap = b.pick(4, 6, 8);
  const line = 0.35 * k;
  const top = H * b.pick(0.4, 0.42, 0.42) - (lh * 2 + cross + gap * 2) / 2;
  const cy = top + lh + gap + cross / 2;
  const silkW = 130;
  const silkH = silkW / 2.4;
  // The lines sit in the lower part of the drawing; this puts them along the bottom of the canvas.
  const lines = H * b.pick(0.78, 0.72, 0.78) - silkH * 0.6;
  return [
    b.art('silk', -15, lines, silkW, { side: 'a', lock: true }),
    b.art('silk', -15, lines + 3 * k, silkW, { side: 'b', flip: true, op: 0.85, lock: true }),
    b.logo('logo', 50 - lw / 2, top, lw, lh, c.bare.url, c.bare.ratio),
    b.rect(50 - cross / 2, cy - line / 2, cross, line, 'muted'),
    b.rect(50 - line / 2, cy - cross / 2, line, cross, 'muted'),
    b.logo('partner_logo', 50 - lw / 2, cy + cross / 2 + gap, lw, lh, PARTNER.url, PARTNER.ratio),
  ];
};

/** A light border with a running tagline down each side and a corner in each brand's color,
 *  around both logos split by a thin rule. */
const border: Layout = (x, copy) => {
  const { b, H, c } = x;
  const tall = b.f === 'st';
  const f = b.pick(4.2, 6, 7);
  const size = f * 0.28;
  const run = H - f * 2;
  // Mono capitals with wide tracking take about 0.9em each; repeat the tagline to fill the side.
  const seg = `${fill(copy.eyebrow, c).toUpperCase()}   ·   `;
  const tag = seg.repeat(Math.max(1, Math.floor(run / (size * 0.9 * seg.length)))).trim();
  const side = (sx: number) =>
    b.text('tagline', sx - run / 2, H / 2 - (size * 1.1) / 2, run, tag, size, {
      tone: 'bg',
      font: 'geist-mono',
      weight: 500,
      track: 0.3,
      align: 'center',
      rot: 90,
      role: 'tagline',
    });
  const lw = b.pick(28, 30, 50);
  const lh = lw * 0.3;
  const g = b.pick(5, 6, 8);
  const line = b.pick(0.25, 0.3, 0.35);
  const logos = tall
    ? [
        b.logo('logo', 50 - lw / 2, H / 2 - g - lh, lw, lh, c.bare.url, c.bare.ratio),
        b.rect(50 - lw / 4, H / 2 - line / 2, lw / 2, line, 'ink'),
        b.logo('partner_logo', 50 - lw / 2, H / 2 + g, lw, lh, PARTNER.url, PARTNER.ratio),
      ]
    : [
        b.logo('logo', 50 - g - line / 2 - lw, H / 2 - lh / 2, lw, lh, c.bare.url, c.bare.ratio),
        b.rect(50 - line / 2, H / 2 - lh * 0.7, line, lh * 1.4, 'ink'),
        b.logo(
          'partner_logo',
          50 + g + line / 2,
          H / 2 - lh / 2,
          lw,
          lh,
          PARTNER.url,
          PARTNER.ratio,
        ),
      ];
  return [
    b.rect(0, 0, 100, f, 'ink'),
    b.rect(0, H - f, 100, f, 'ink'),
    b.rect(0, 0, f, H, 'ink'),
    b.rect(100 - f, 0, f, H, 'ink'),
    b.rect(0, 0, f, f, 'accent', { side: 'a' }),
    b.rect(100 - f, 0, f, f, 'accent', { side: 'b' }),
    b.rect(0, H - f, f, f, 'accent', { side: 'b' }),
    b.rect(100 - f, H - f, f, f, 'accent', { side: 'a' }),
    side(f / 2),
    side(100 - f / 2),
    ...logos,
  ];
};

/** A huge date as the hero, both logos small above it, and a strip of the partner's color under it. */
const bigDate: Layout = (x, copy) => {
  const { b, H, c, k } = x;
  const m = b.pick(6, 8, 8);
  const top = b.pick(6, 8, 24);
  const lw = logoW(b) * 0.9;
  const pa = plate(x, 'a', m, top, lw);
  const pb = plate(x, 'b', m + pa.w + 8 * k, top + (pa.h - plateH(lw)) / 2, lw);
  const date = b.pick(15, 19, 21);
  const dy = b.pick(H / 2 - date * 0.55, H * 0.3, H * 0.34);
  const head = b.pick(4, 6, 7);
  return [
    ...pa.els,
    b.text('x', m + pa.w + 2 * k, top + pa.h / 2 - 2.4 * k, 4 * k, '×', 4.4 * k, {
      tone: 'muted',
      align: 'center',
      slot: undefined,
    }),
    ...pb.els,
    b.text('date', m, dy, 100 - m * 2, 'MAR 12', date, {
      tone: 'accent',
      side: 'a',
      font: c.heading,
      weight: 800,
      track: -0.04,
      lh: 1,
    }),
    b.rect(m, dy + date + 3 * k, b.pick(24, 30, 34), 1.6 * k, 'accent', {
      side: 'b',
      radius: 0.8 * k,
    }),
    b.text('headline', m, dy + date + 9 * k, 100 - m * 2, fill(copy.headline, c), head, {
      font: c.heading,
      weight: 700,
      track: -0.03,
      lh: 1.1,
    }),
    b.text(
      'time',
      m,
      dy + date + 9 * k + head * 1.1 * 2 + 3 * k,
      100 - m * 2,
      fill(copy.cta, c),
      3.2 * k,
      {
        tone: 'muted',
        font: 'geist-mono',
      },
    ),
  ];
};

/** Both logos in a row from the left, split by a thin rule. */
function lockup(x: Ctx, lx: number, ly: number, lw: number) {
  const { b, c } = x;
  const lh = lw * 0.3;
  const g = lw * 0.2;
  const line = Math.max(0.2, lw * 0.009);
  return [
    b.logo('logo', lx, ly, lw, lh, c.bare.url, c.bare.ratio),
    b.rect(lx + lw + g, ly - lh * 0.2, line, lh * 1.4, 'muted'),
    b.logo('partner_logo', lx + lw + g * 2 + line, ly, lw, lh, PARTNER.url, PARTNER.ratio),
  ];
}

/** An app update: the partner's coin in a phone feed, a big line saying it's live, and both logos. */
const app: Layout = (x, copy) => {
  const { b, H, c } = x;
  const f = b.f;
  const head = b.pick(4.6, 7.4, 8);
  const lw = b.pick(15, 20, 24);
  // X puts the phone on the right and the words on the left; square and story stack them, with the
  // top of the phone cut off by the canvas.
  const pw = b.pick(30, 44, 58);
  const px = f === 'x' ? 60 : 50 - pw / 2;
  const bottom = b.pick(H - 5, 58, 104);
  const hy = b.pick(11, 64, 110);
  const align = f === 'x' ? 'left' : 'center';
  const ly = b.pick(H - 7 - lw * 0.3, 88, 136);
  const lx = f === 'x' ? 7 : 50 - lw * 1.2;
  return [
    b.art('glow', px - pw * 0.4, bottom - pw * 1.6, pw * 1.8, { side: 'a', op: 0.45, lock: true }),
    ...device(b, 'phone', px, bottom - pw * 2.05, pw),
    b.text('headline', f === 'x' ? 7 : 6, hy, f === 'x' ? 46 : 88, fill(copy.headline, c), head, {
      font: c.heading,
      weight: 700,
      track: -0.03,
      lh: 1.1,
      align,
    }),
    ...lockup(x, lx, ly, lw),
  ];
};

/** A title block: a small label and a two-line headline. */
function titleBlock(
  x: Ctx,
  copy: Copy,
  wx: number,
  wy: number,
  w: number,
  head: number,
  align: 'left' | 'center',
) {
  const { b, c, k } = x;
  const small = 3 * k;
  return [
    b.text('eyebrow', wx, wy, w, copy.eyebrow, small, { tone: 'accent', weight: 600, align }),
    b.text('headline', wx, wy + small * 1.2 + 1.5 * k, w, fill(copy.headline, c), head, {
      font: c.heading,
      weight: 700,
      track: -0.03,
      lh: 1.1,
      align,
    }),
  ];
}

/** The phone in the middle, cut off at the bottom, under the logos and headline. */
const phoneCenter: Layout = (x, copy) => {
  const { b } = x;
  const pw = b.pick(24, 40, 62);
  const py = b.pick(24, 38, 62);
  return [
    b.art('glow', 50 - pw, py - pw * 0.2, pw * 2, { side: 'a', op: 0.45, lock: true }),
    ...device(b, 'phone', 50 - pw / 2, py, pw),
    ...logoRow(x, b.pick(5, 8, 28), b.pick(13, 17, 22)),
    ...titleBlock(x, copy, 5, b.pick(8.5, 13, 34), 90, b.pick(4.4, 7, 7.6), 'center'),
  ];
};

/** Words and logos on the left, the phone on the right. */
const phoneRight: Layout = (x, copy) => {
  const { b } = x;
  const pw = b.pick(26, 34, 60);
  const [px, py] = b.pick<[number, number]>([64, 5], [62, 12], [34, 60]);
  const lw = b.pick(14, 18, 22);
  return [
    b.art('glow', px - pw * 0.5, py + pw * 0.2, pw * 2, { side: 'a', op: 0.4, lock: true }),
    ...device(b, 'phone', px, py, pw),
    ...titleBlock(x, copy, 7, b.pick(12, 26, 26), b.pick(50, 58, 84), b.pick(4.6, 6, 7.6), 'left'),
    ...lockup(x, 7, b.pick(44, 84, 52), lw),
  ];
};

/** A glow in your color from the top, fading out a little before the middle. */
const sky = (x: Ctx) => {
  const { b, H } = x;
  // The drawing is twice as wide as tall; this makes it about as tall as the canvas.
  const w = Math.max(100, H * 2);
  return [b.art('sky', 50 - w / 2, 0, w, { side: 'a', lock: true })];
};

/** Both logos in a row, split by a thin rule. */
function logoRow(x: Ctx, cy: number, lw: number) {
  const { b, c } = x;
  const lh = lw * 0.3;
  const g = lw * 0.2;
  const line = Math.max(0.2, lw * 0.009);
  const left = 50 - g - line / 2 - lw;
  return [
    b.logo('logo', left, cy - lh / 2, lw, lh, c.bare.url, c.bare.ratio),
    b.rect(50 - line / 2, cy - lh * 0.6, line, lh * 1.2, 'muted'),
    b.logo('partner_logo', 50 + g + line / 2, cy - lh / 2, lw, lh, PARTNER.url, PARTNER.ratio),
  ];
}

/** Just the two logos, under a glow from the top. */
const glow: Layout = (x) => {
  const { b, H } = x;
  return [...sky(x), ...logoRow(x, H * b.pick(0.56, 0.54, 0.52), b.pick(26, 32, 36))];
};

/** Breaking news: a label on the glow, a layer stack in the partner's color, then both logos and
 *  a big line at the bottom. */
const headlineGlow: Layout = (x, copy) => {
  const { b, H, c, k } = x;
  const head = b.pick(6, 9.4, 10);
  const small = 3.4 * k;
  const hy = H - b.pick(4, 6, 34) - head * 1.08 * 2;
  const lw = b.pick(16, 20, 24);
  const ly = hy - b.pick(5, 8, 12);
  const top = b.pick(4, 6, 26);
  // The shape fills the space between the label and the logos, with room left above the logos.
  const from = top + small * 1.2 + b.pick(2.5, 4, 6);
  const to = ly - lw * 0.15 - b.pick(4, 7, 10);
  const size = Math.min(b.pick(46, 70, 84), (to - from) * 1.25);
  return [
    ...sky(x),
    b.text('eyebrow', 10, top, 80, copy.eyebrow, small, {
      tone: 'ink',
      weight: 600,
      align: 'center',
    }),
    b.art('layers', 50 - size / 2, from + (to - from - size / 1.25) / 2, size, { side: 'b' }),
    ...logoRow(x, ly, lw),
    b.text('headline', 5, hy, 90, fill(copy.headline, c), head, {
      font: c.heading,
      weight: 600,
      track: -0.03,
      lh: 1.08,
      align: 'center',
    }),
  ];
};

/** The layouts, with the words each one says by default. */
const LAYOUTS: [key: string, title: string, layout: Layout, copy: Copy][] = [
  ['glow', 'Glow', glow, { eyebrow: '', headline: '', cta: '', url: '' }],
  [
    'news',
    'Headline',
    headlineGlow,
    { eyebrow: 'Breaking news', headline: 'Partner is live\non {a}', cta: '', url: '' },
  ],
  ['wave', 'Wave', wave, { eyebrow: '', headline: '', cta: '', url: '' }],
  [
    'app',
    'App update',
    app,
    { eyebrow: '', headline: 'Partner is now\nlive on {a}', cta: '', url: '' },
  ],
  [
    'phone',
    'Phone',
    phoneCenter,
    { eyebrow: 'New in the app', headline: 'Partner is now\nlive on {a}', cta: '', url: '' },
  ],
  [
    'phone-right',
    'Phone right',
    phoneRight,
    { eyebrow: 'New in the app', headline: 'Partner is now\nlive on {a}', cta: '', url: '' },
  ],
  [
    'diagonal',
    'Diagonal',
    diagonal,
    {
      eyebrow: 'Partnership',
      headline: '{a} now\nworks with Partner',
      cta: 'Live today',
      url: '{url}',
    },
  ],
  [
    'split',
    'Split + band',
    split,
    {
      eyebrow: 'Integration',
      headline: 'Partner now\nsupports {a}',
      cta: 'Try it now',
      url: '{url}',
    },
  ],
  [
    'stacked',
    'Stacked',
    stacked,
    {
      eyebrow: 'Joint launch',
      headline: 'Two teams,\none launch',
      cta: 'Mar 12 · 18:00 UTC',
      url: '{url}',
    },
  ],
  [
    'overlap',
    'Overlap',
    overlap,
    { eyebrow: 'Partnership', headline: '{a} × Partner', cta: '', url: '' },
  ],
  [
    'frame',
    'Frame',
    frame,
    { eyebrow: 'Coming soon', headline: "Something's\ncoming", cta: 'Join the waitlist', url: '' },
  ],
  [
    'fan',
    'Fan',
    fan,
    { eyebrow: '', headline: 'The {a} ×\nPartner drop', cta: 'Claim yours', url: '' },
  ],
  [
    'ticket',
    'Ticket',
    ticket,
    {
      eyebrow: 'Live on X Spaces',
      headline: '{a} ×\nPartner AMA',
      cta: 'THU\nMAR 12\n18:00 UTC',
      url: '',
    },
  ],
  [
    'border',
    'Border',
    border,
    { eyebrow: 'New integration · {a} × Partner', headline: '', cta: '', url: '' },
  ],
  [
    'date',
    'Big date',
    bigDate,
    { eyebrow: '', headline: 'Save the date', cta: '18:00 UTC · {url}', url: '' },
  ],
];

/** A faint pattern for the layouts made of flat color blocks, so they don't look empty. */
const TEXTURE: Record<string, string> = {
  diagonal: 'pattern-lattice-3',
  split: 'pattern-dots-5',
  stacked: 'pattern-arcs-2',
  overlap: 'pattern-lattice-8',
  frame: 'pattern-lines-4',
  fan: 'pattern-plus-6',
  ticket: 'pattern-dots-9',
  date: 'pattern-arcs-7',
};

/** Puts the texture right above the layout's full-size color blocks and under everything else. */
function textured(els: ICElement[], b: B, H: number, art: string | undefined): ICElement[] {
  if (!art) return els;
  const at = els.findIndex((e) => !(e.t === 'shape' && e.w >= 45));
  const layer = b.art(patternFor(art, H), 0, 0, 100, { op: 0.22, lock: true });
  return [...els.slice(0, at), layer, ...els.slice(at)];
}

function template(c: CoBrand, key: string, title: string, layout: Layout, copy: Copy): ICTemplate {
  const partner = brandPartner(c.kit.roles);
  const [[, base], ...rest] = FMTS.map(([f, ratio]) => {
    const b = layerBuilder(HEIGHT[f], c.kit.roles, f, partner);
    const els = layout({ b, H: HEIGHT[f], c, k: b.pick(0.62, 1, 1.12) }, copy);
    return [ratio, renumber(textured(els, b, HEIGHT[f], TEXTURE[key]))] as const;
  });
  // A soft gradient in the kit's own two background colors, under every layout.
  const bg: ICBackground = {
    mode: 'gradient',
    color: c.kit.roles.bg,
    from: c.kit.roles.bg,
    to: c.kit.roles.bg2,
    angle: 160,
  };
  return {
    // The first brand keeps the original ids, so designs made from them still open.
    id: c.id === 'acme' ? `cobrand-${key}` : `cobrand-${c.id}-${key}`,
    title,
    pack: 'Co-brand',
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
    partner,
  };
}

export const COBRAND_PACK: ICTemplate[] = BRANDS.flatMap((c) =>
  LAYOUTS.map(([key, title, layout, copy]) => template(c, key, title, layout, copy)),
);
