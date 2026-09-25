// Announcement templates for the built-in Tether and QVAC kits: eleven layout families, each laid out
// by hand for X, square and story. One builder per family keeps layer order and slots the same across sizes.

import { device } from './image-constructor-device.js';
import { artDef, artPalette } from './image-constructor-art.js';
import {
  SAMPLE_KIT,
  SAMPLE_LOGO,
  BRAND_LOGOS,
  DEGEN_KIT,
  GLASS_KIT,
  QVAC_KIT,
  TETHER_KIT,
} from './image-constructor-brand-builtin.js';
import { type BrandKit, brandBackground } from './image-constructor-brand-kit.js';
import type { ICFont } from './image-constructor-font-list.js';
import type { ICRoles } from './image-constructor-palettes.js';
import type {
  ICArtEl,
  ICBackground,
  ICElement,
  ICImage,
  ICPill,
  ICRatio,
  ICRole,
  ICShape,
  ICSide,
  ICTemplate,
  ICText,
} from './image-constructor-layout.js';

type Fmt = 'x' | 'sq' | 'st';

/** Canvas height in percent of the width, per format. */
const HEIGHT: Record<Fmt, number> = { x: 56.25, sq: 100, st: (1920 / 1080) * 100 };
const FMTS: [Fmt, ICRatio][] = [
  ['x', 'x-post'],
  ['sq', '1:1'],
  ['st', 'story'],
];

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** Stand-in partner logo: a mark and two bars, in a grey that reads on light and dark. */
export const PARTNER_LOGO = svgUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="40" viewBox="0 0 144 40">' +
    '<path d="M20 2c1.4 9.4 7.6 15.6 17 17-9.4 1.4-15.6 7.6-17 17-1.4-9.4-7.6-15.6-17-17 9.4-1.4 15.6-7.6 17-17Z" fill="#8b93a1"/>' +
    '<rect x="46" y="10" width="92" height="9" rx="4.5" fill="#8b93a1"/><rect x="46" y="24" width="58" height="7" rx="3.5" fill="#8b93a1" opacity=".6"/></svg>',
);

export const face = (bg: string, fg: string) =>
  svgUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100">' +
      `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="40" r="17" fill="${fg}"/>` +
      `<path d="M18 100c2-22 16-32 32-32s30 10 32 32Z" fill="${fg}"/></svg>`,
  );

const builder = (f: Fmt, kit: BrandKit) => layerBuilder(HEIGHT[f], kit.roles, f);

/** Places layers on a canvas `H` percent of its width tall, in the given colors. `y` and
 *  heights are in percent of the width and converted to percent of the height here, so
 *  blocks stack in one unit. */
export function layerBuilder(H: number, main: ICRoles, f: Fmt = 'sq', partner?: ICRoles) {
  const Y = (u: number) => (u / H) * 100;
  // A layer tagged with a side takes that brand's colors; everything else takes the main ones.
  const on = (side?: ICSide) => (side === 'b' && partner ? partner : main);
  const roles = main;
  let n = 0;
  const id = () => `a${++n}`;
  return {
    f,
    H,
    pick: <T>(x: T, sq: T, st: T): T => (f === 'x' ? x : f === 'sq' ? sq : st),
    text(
      role: string,
      x: number,
      y: number,
      w: number,
      text: string,
      size: number,
      o: Partial<ICText> & { tone?: ICRole; side?: ICSide } = {},
    ): ICText {
      const { tone = 'ink', side, ...rest } = o;
      return {
        id: id(),
        t: 'text',
        role,
        x,
        y: Y(y),
        w,
        text,
        size,
        weight: 400,
        font: 'sans',
        color: on(side)[tone],
        align: 'left',
        track: 0,
        lh: 1.1,
        vis: true,
        pal: { color: tone, ...(side ? { side } : {}) },
        slot: role,
        ...rest,
      };
    },
    rect(
      x: number,
      y: number,
      w: number,
      h: number,
      fill: ICRole | '',
      o: Partial<ICShape> & { line?: ICRole | string; side?: ICSide } = {},
    ): ICShape {
      const { line, side, ...rest } = o;
      const r = on(side);
      const lineRole = line && line in r ? (line as ICRole) : undefined;
      return {
        id: id(),
        t: 'shape',
        kind: 'rect',
        x,
        y: Y(y),
        w,
        h: Y(h),
        fill: fill ? r[fill] : '',
        stroke: lineRole ? r[lineRole] : (line ?? ''),
        sw: line ? 0.3 : 0.25,
        radius: 0,
        vis: true,
        pal: {
          ...(fill ? { fill } : {}),
          ...(lineRole ? { stroke: lineRole } : {}),
          ...(side ? { side } : {}),
        },
        ...rest,
      };
    },
    pill(
      role: string,
      x: number,
      y: number,
      w: number,
      h: number,
      text: string,
      size: number,
      style: 'solid' | 'outline',
      o: Partial<ICPill> = {},
    ): ICPill {
      const solid = style === 'solid';
      return {
        id: id(),
        t: 'pill',
        role,
        x,
        y: Y(y),
        w,
        h: Y(h),
        fill: solid ? roles.accent : roles.card,
        stroke: solid ? '' : roles.panel,
        text,
        size,
        weight: 600,
        font: 'sans',
        color: solid ? roles.onAccent : roles.ink,
        track: 0,
        vis: true,
        pal: solid
          ? { fill: 'accent', color: 'onAccent' }
          : { fill: 'card', stroke: 'panel', color: 'ink' },
        slot: role,
        ...o,
      };
    },
    image(
      slot: string,
      x: number,
      y: number,
      w: number,
      url: string,
      ratio: number,
      o: Partial<ICImage> = {},
    ): ICImage {
      return { id: id(), t: 'image', x, y: Y(y), w, name: slot, url, ratio, vis: true, slot, ...o };
    },
    /** A logo slot with a fixed `w` by `h` box; whatever logo goes in sits whole and centered in it. */
    logo(
      slot: string,
      x: number,
      y: number,
      w: number,
      h: number,
      url: string,
      ratio: number,
    ): ICImage {
      return {
        id: id(),
        t: 'image',
        x,
        y: Y(y),
        w,
        h: Y(h),
        fit: 'contain',
        name: slot,
        url,
        ratio,
        vis: true,
        slot,
      };
    },
    /** A photo slot cropped to a `w` by `w` box, round when `radius` is half of `w`. */
    photo(slot: string, x: number, y: number, w: number, url: string, radius: number): ICImage {
      return {
        id: id(),
        t: 'image',
        x,
        y: Y(y),
        w,
        h: Y(w),
        radius,
        name: slot,
        url,
        ratio: 1,
        vis: true,
        slot,
      };
    },
    art(
      artId: string,
      x: number,
      y: number,
      w: number,
      o: Partial<ICArtEl> & { side?: ICSide } = {},
    ): ICArtEl {
      const { side, ...rest } = o;
      const def = artDef(artId);
      return {
        id: id(),
        t: 'art',
        art: artId,
        x,
        y: Y(y),
        w,
        colors: def ? artPalette(def, on(side)) : {},
        vis: true,
        ...(side ? { pal: { side } } : {}),
        ...rest,
      };
    },
  };
}

export type LayerBuilder = ReturnType<typeof layerBuilder>;

/**
 * Numbers a size's layers by their place in the list, so the same layer has the same id in every
 * size. Ids from the builder count every layer made, including ones `pick` drops, so they drift.
 */
export const renumber = (els: ICElement[]): ICElement[] =>
  els.map((e, i) => ({ ...e, id: `a${i + 1}` }));
type B = LayerBuilder;
type Family = (b: B) => ICElement[];

// ---------------------------------------------------------------- Classic (Default, Glass, Degen, Tether)

/** A brand drawn in the classic system: light or dark gradient, rounded cards, full pills. */
interface ClassicBrand {
  logo: { url: string; ratio: number };
  heading: ICFont;
  warn: string;
  /** The launch word is sized for four letters; a longer one scales down by this. */
  nounScale: number;
  /** Layers behind every template, such as soft glows, given the family being drawn. */
  backdrop?: (b: B, family: string) => ICElement[];
  art: Record<
    | 'partnerBack'
    | 'partnerFront'
    | 'launchMain'
    | 'launchBack'
    | 'contract'
    | 'ama'
    | 'number'
    | 'recap',
    string
  >;
  copy: {
    partnerEyebrow: string;
    partnerHeadline: string;
    cta: string;
    url: string;
    launchEyebrow: string;
    noun: string;
    launchSub: string;
    tags: [string, string, string];
    contractEyebrow: string;
    contractHeadline: string;
    address: string;
    /** X, square, story. */
    warning: [string, string, string];
    badge: string;
    guest: string;
    name: string;
    role: string;
    amaHeadline: string;
    time: string;
    numberEyebrow: string;
    number: string;
    numberLabel: string;
    recapEyebrow: string;
    /** X, square, story. */
    recapTitle: [string, string, string];
    recapLines: string[];
    /** Listing: the line above, the ticker, and the line below. */
    listing: [string, string, string];
    /** API: the title and its colored second line, then three features with an icon each. */
    api: [string, string];
    features: [string, string][];
  };
}

const th = (c: ClassicBrand) => ({ font: c.heading, weight: 700, track: -0.035, lh: 1.08 });
const T_EYEBROW = { weight: 600, track: 0.02, tone: 'accent' as ICRole };
const T_SUB = { weight: 400, lh: 1.4, tone: 'muted' as ICRole };

/** Side and top margins. Story keeps clear of the app bars: top 13% and bottom 17%. */
const tPad = (b: B) => b.pick({ x: 5.5, top: 5.5 }, { x: 7, top: 7 }, { x: 8, top: 26 });

const tWordmark = (c: ClassicBrand, b: B, x: number, y: number, w: number) =>
  b.image('logo', x, y, w, c.logo.url, c.logo.ratio);

/** Inter-like badge width: about 0.58em a character, with 1.1em each side. */
const pillW = (text: string, size: number) => size * (0.58 * [...text].length + 2.2);

const classicPartner =
  (c: ClassicBrand): Family =>
  (b) => {
    const p = tPad(b);
    const s = b.pick(
      { logo: 14, hl: 4.8, hlY: 29, eyY: 25, pillY: 43, pillH: 5, pill: 2.3, url: 2.3 },
      {
        logo: 24,
        hl: 7.6,
        hlY: 62.5,
        eyY: 58,
        pillY: 84.5,
        pillH: 8,
        pill: 3.4,
        url: 3.3,
      },
      { logo: 30, hl: 9, hlY: 109.5, eyY: 104, pillY: 137, pillH: 9, pill: 4, url: 4 },
    );
    const logoH = s.logo / c.logo.ratio;
    const partnerW = s.logo * 0.85;
    return [
      b.pick(
        b.art(c.art.partnerBack, 60, 4, 38, { op: 0.1 }),
        b.art(c.art.partnerBack, 52, 50, 64, { op: 0.1 }),
        b.art(c.art.partnerBack, 30, 118, 96, { op: 0.08 }),
      ),
      b.pick(
        b.art(c.art.partnerFront, 66, 12, 26),
        b.art(c.art.partnerFront, 72, 20, 20),
        b.art(c.art.partnerFront, 24, 44, 52),
      ),
      tWordmark(c, b, p.x, p.top, s.logo),
      b.text(
        'x',
        p.x + s.logo + s.logo * 0.1,
        p.top + logoH / 2 - s.logo * 0.09,
        s.logo * 0.12,
        '×',
        s.logo * 0.18,
        { tone: 'muted', align: 'center', slot: undefined },
      ),
      b.image(
        'partner_logo',
        p.x + s.logo * 1.32,
        p.top + logoH / 2 - partnerW / 7.2,
        partnerW,
        PARTNER_LOGO,
        3.6,
      ),
      b.text('eyebrow', p.x, s.eyY, 60, c.copy.partnerEyebrow, s.hl * 0.44, T_EYEBROW),
      b.text('headline', p.x, s.hlY, b.pick(52, 86, 84), c.copy.partnerHeadline, s.hl, th(c)),
      b.pill('cta', p.x, s.pillY, pillW(c.copy.cta, s.pill), s.pillH, c.copy.cta, s.pill, 'solid'),
      b.text('url', 100 - p.x - 30, s.pillY + s.pillH / 2 - s.url * 0.55, 30, c.copy.url, s.url, {
        ...T_SUB,
        weight: 500,
        align: 'right',
      }),
    ];
  };

const classicLaunch =
  (c: ClassicBrand): Family =>
  (b) => {
    const p = tPad(b);
    const s = b.pick(
      {
        logo: 14,
        eb: 2.3,
        noun: 14,
        nounY: 15,
        sub: 2.9,
        subY: 30,
        pillY: 43,
        pillH: 5,
        pill: 2.3,
        gap: 1.2,
      },
      {
        logo: 24,
        eb: 3.3,
        noun: 21,
        nounY: 43,
        sub: 4.4,
        subY: 66,
        pillY: 84,
        pillH: 8,
        pill: 3.4,
        gap: 1.8,
      },
      {
        logo: 30,
        eb: 4,
        noun: 25,
        nounY: 88,
        sub: 5.2,
        subY: 115,
        pillY: 137,
        pillH: 9,
        pill: 4,
        gap: 2,
      },
    );
    const [w1, w2, w3] = c.copy.tags.map((tag) => pillW(tag, s.pill));
    return [
      b.pick(
        b.art(c.art.launchMain, 64, 11, 28),
        b.art(c.art.launchMain, 66, 17, 26),
        b.art(c.art.launchMain, 26, 40, 48),
      ),
      b.pick(
        b.art(c.art.launchBack, 84, 34, 18, { op: 0.22 }),
        b.art(c.art.launchBack, 76, 66, 28, { op: 0.22 }),
        b.art(c.art.launchBack, 70, 126, 30, { op: 0.2 }),
      ),
      tWordmark(c, b, p.x, p.top, s.logo),
      b.text(
        'eyebrow',
        100 - p.x - 30,
        p.top + (s.logo / c.logo.ratio - s.eb) / 2,
        30,
        c.copy.launchEyebrow,
        s.eb,
        { ...T_EYEBROW, align: 'right' },
      ),
      b.text('noun', p.x, s.nounY, 84, c.copy.noun, s.noun * c.nounScale, {
        ...th(c),
        weight: 800,
        track: -0.05,
        lh: 1,
        tone: 'accent',
      }),
      b.text('sub', p.x, s.subY, b.pick(50, 86, 84), c.copy.launchSub, s.sub, T_SUB),
      b.pill('tag', p.x, s.pillY, w1, s.pillH, c.copy.tags[0], s.pill, 'solid'),
      b.pill('tag', p.x + w1 + s.gap, s.pillY, w2, s.pillH, c.copy.tags[1], s.pill, 'outline'),
      b.pill(
        'tag',
        p.x + w1 + w2 + s.gap * 2,
        s.pillY,
        w3,
        s.pillH,
        c.copy.tags[2],
        s.pill,
        'outline',
      ),
    ];
  };

const classicContract =
  (c: ClassicBrand): Family =>
  (b) => {
    const p = tPad(b);
    const s = b.pick(
      {
        logo: 14,
        eb: 2.3,
        ebY: 15,
        hl: 4.4,
        hlY: 18.5,
        cardY: 27,
        cardW: 50,
        cardH: 12,
        addr: 3.2,
        warn: 2.3,
        warnY: 42,
        warnW: 52,
      },
      {
        logo: 24,
        eb: 3.3,
        ebY: 45,
        hl: 7,
        hlY: 49.5,
        cardY: 61,
        cardW: 86,
        cardH: 17,
        addr: 4.6,
        warn: 3.5,
        warnY: 82.5,
        warnW: 86,
      },
      {
        logo: 30,
        eb: 4,
        ebY: 84,
        hl: 8.4,
        hlY: 89.5,
        cardY: 102.5,
        cardW: 84,
        cardH: 21,
        addr: 5.4,
        warn: 4.2,
        warnY: 129,
        warnW: 84,
      },
    );
    const inset = s.addr * 0.95;
    const warn = b.pick(...c.copy.warning);
    return [
      b.pick(
        b.art(c.art.contract, 66, 10, 26),
        b.art(c.art.contract, 73, 7, 20),
        b.art(c.art.contract, 30, 38, 40),
      ),
      tWordmark(c, b, p.x, p.top, s.logo),
      b.text('eyebrow', p.x, s.ebY, 60, c.copy.contractEyebrow, s.eb, {
        ...T_EYEBROW,
        color: c.warn,
        pal: undefined,
      }),
      b.text('headline', p.x, s.hlY, b.pick(55, 86, 84), c.copy.contractHeadline, s.hl, th(c)),
      b.rect(p.x, s.cardY, s.cardW, s.cardH, 'card', {
        line: '#f4c7a8',
        radius: s.addr * 0.8,
        sw: 0.35,
      }),
      b.text(
        'address',
        p.x + inset,
        s.cardY + (s.cardH - s.addr * 2.7) / 2,
        s.cardW - inset * 2,
        c.copy.address,
        s.addr,
        {
          font: 'geist-mono',
          weight: 500,
          lh: 1.35,
        },
      ),
      b.text('warning', p.x, s.warnY, s.warnW, warn, s.warn, { ...T_SUB, lh: 1.45 }),
    ];
  };

const classicAma =
  (c: ClassicBrand): Family =>
  (b) => {
    const p = tPad(b);
    const s = b.pick(
      {
        logo: 14,
        pill: 2.3,
        pillH: 5,
        face: 27,
        faceX: 64,
        faceY: 15,
        eb: 2.3,
        ebY: 14,
        name: 3.6,
        hl: 4.4,
        hlY: 29.5,
        time: 3.2,
        timeY: 41.5,
      },
      {
        logo: 24,
        pill: 3.4,
        pillH: 8,
        face: 23,
        faceX: 7,
        faceY: 43,
        eb: 3.2,
        ebY: 46.5,
        name: 5.4,
        hl: 6.6,
        hlY: 70,
        time: 5,
        timeY: 86.5,
      },
      {
        logo: 30,
        pill: 4,
        pillH: 9,
        face: 44,
        faceX: 28,
        faceY: 40,
        eb: 3.8,
        ebY: 92,
        name: 6.6,
        hl: 8,
        hlY: 114,
        time: 5.8,
        timeY: 136,
      },
    );
    // Square puts the name beside the photo; X and story stack it in the text column.
    const nameX = b.pick(p.x, p.x + s.face + 4, p.x);
    const ebY = s.ebY;
    const ring = s.face * 0.035;
    return [
      b.pick(
        b.art(c.art.ama, 56, 11, 11),
        b.art(c.art.ama, 69, 22, 24),
        b.art(c.art.ama, 70, 36, 20),
      ),
      tWordmark(c, b, p.x, p.top, s.logo),
      b.pill(
        'badge',
        100 - p.x - pillW(c.copy.badge, s.pill),
        p.top - s.pillH * 0.12,
        pillW(c.copy.badge, s.pill),
        s.pillH,
        c.copy.badge,
        s.pill,
        'solid',
      ),
      {
        ...b.rect(s.faceX - ring, s.faceY - ring, s.face + ring * 2, s.face + ring * 2, 'accent'),
        kind: 'ellipse',
      },
      b.photo('face', s.faceX, s.faceY, s.face, face('#e4e7eb', '#b8bec6'), s.face / 2),
      b.text('eyebrow', nameX, ebY, 40, c.copy.guest, s.eb, T_EYEBROW),
      b.text('name', nameX, ebY + s.eb * 1.45, 50, c.copy.name, s.name, {
        ...th(c),
        track: -0.02,
      }),
      b.text('role', nameX, ebY + s.eb * 1.45 + s.name * 1.3, 50, c.copy.role, s.eb * 1.02, {
        ...T_SUB,
        weight: 500,
      }),
      b.text('headline', p.x, s.hlY, b.pick(55, 86, 84), c.copy.amaHeadline, s.hl, th(c)),
      b.text('time', p.x, s.timeY, 60, c.copy.time, s.time, {
        ...th(c),
        track: -0.01,
        tone: 'accent',
      }),
    ];
  };

const classicNumber =
  (c: ClassicBrand): Family =>
  (b) => {
    const p = tPad(b);
    const s = b.pick(
      { logo: 14, eb: 2.3, num: 15, numY: 16, label: 3.1, labelY: 33 },
      { logo: 24, eb: 3.3, num: 23, numY: 27, label: 4.8, labelY: 53 },
      { logo: 30, eb: 4, num: 28, numY: 46, label: 5.8, labelY: 77 },
    );
    return [
      b.pick(
        b.art(c.art.number, 58, 10, 36),
        b.art(c.art.number, 46, 44, 49),
        b.art(c.art.number, 22, 96, 56),
      ),
      tWordmark(c, b, p.x, p.top, s.logo),
      b.text(
        'eyebrow',
        100 - p.x - 30,
        p.top + (s.logo / c.logo.ratio - s.eb) / 2,
        30,
        c.copy.numberEyebrow,
        s.eb,
        { ...T_EYEBROW, align: 'right' },
      ),
      b.text('number', p.x, s.numY, 100 - p.x * 2, c.copy.number, s.num, {
        ...th(c),
        weight: 800,
        track: -0.05,
        lh: 1,
        tone: 'accent',
      }),
      b.text('label', p.x, s.labelY, b.pick(45, 50, 80), c.copy.numberLabel, s.label, {
        weight: 500,
        lh: 1.3,
      }),
    ];
  };

const classicRecap =
  (c: ClassicBrand): Family =>
  (b) => {
    const p = tPad(b);
    const lines = c.copy.recapLines;
    const s = b.pick(
      {
        logo: 14,
        eb: 2.3,
        ebY: 17,
        title: 5,
        titleY: 20.5,
        titleText: c.copy.recapTitle[0],
        lx: 50,
        ly: 10.5,
        gap: 6.2,
        line: 2.9,
      },
      {
        logo: 24,
        eb: 3.3,
        ebY: 23,
        title: 8.4,
        titleY: 27.5,
        titleText: c.copy.recapTitle[1],
        lx: 7,
        ly: 42.5,
        gap: 8.2,
        line: 4.3,
      },
      {
        logo: 30,
        eb: 4,
        ebY: 40,
        title: 9.4,
        titleY: 45.5,
        titleText: c.copy.recapTitle[2],
        lx: 8,
        ly: 74,
        gap: 11.2,
        line: 5.2,
      },
    );
    const dot = s.line * 1.15;
    return [
      b.pick(
        b.art(c.art.recap, -6, 36, 24, { op: 0.2 }),
        b.art(c.art.recap, 74, -6, 32, { op: 0.22 }),
        b.art(c.art.recap, 66, 140, 42, { op: 0.18 }),
      ),
      tWordmark(c, b, p.x, p.top, s.logo),
      b.text('eyebrow', p.x, s.ebY, 40, c.copy.recapEyebrow, s.eb, T_EYEBROW),
      b.text('title', p.x, s.titleY, b.pick(40, 86, 84), s.titleText, s.title, th(c)),
      ...lines.flatMap((line, i) => {
        const y = s.ly + i * s.gap;
        return [
          b.art('verified', s.lx, y + (s.line * 1.2 - dot) / 2, dot),
          b.text(`line_${i + 1}`, s.lx + dot + s.line * 0.6, y, b.pick(44, 76, 76), line, s.line, {
            weight: 500,
            lh: 1.2,
            role: 'line',
          }),
        ];
      }),
    ];
  };

// ---------------------------------------------------------------- QVAC

const Q_HEAD = { font: 'geist' as ICFont, weight: 600, track: -0.03, lh: 1.1 };
const Q_LABEL = {
  font: 'geist-mono' as ICFont,
  weight: 500,
  track: 0.08,
  tone: 'accent' as ICRole,
};
const Q_SUB = { font: 'geist' as ICFont, weight: 400, lh: 1.45, tone: 'muted' as ICRole };
const Q_MONO = { font: 'geist-mono' as ICFont, weight: 400, tone: 'muted' as ICRole };
const Q_WARN = '#fdca40';

const qPad = (b: B) => b.pick({ x: 7, top: 6.5 }, { x: 9, top: 9 }, { x: 10, top: 26 });

/** QVAC's backdrop is its flat page gray, like its posts; the grid is a texture to pick instead. */
const qFrame = (_b: B): ICElement[] => [];

const qWordmark = (b: B, x: number, y: number, w: number) =>
  b.image('logo', x, y, w, BRAND_LOGOS.qvacWordmark.url(), BRAND_LOGOS.qvacWordmark.ratio);

const qLogoW = (b: B) => b.pick(17, 24, 30);
const qLogoH = (b: B) => qLogoW(b) / BRAND_LOGOS.qvacWordmark.ratio;

/** A mono label on the logo's line, right-aligned. */
const qTopLabel = (b: B, text: string, size: number, o: Partial<ICText> = {}) => {
  const p = qPad(b);
  return b.text('eyebrow', 100 - p.x - 40, p.top + (qLogoH(b) - size * 1.1) / 2, 40, text, size, {
    ...Q_LABEL,
    align: 'right',
    ...o,
  });
};

/** Geist Mono is 0.6em a character, so a tag fits its words exactly, with 1.1em each side. */
const tagW = (text: string, size: number) => size * (0.6 * [...text].length + 2.2);

const qTag = (
  b: B,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  size: number,
  solid: boolean,
  role = 'tag',
) =>
  b.pill(role, x, y, w, h, text, size, solid ? 'solid' : 'outline', {
    font: 'geist-mono',
    weight: 500,
    radius: 0,
    ...(solid
      ? {}
      : {
          fill: QVAC_KIT.roles.panel,
          stroke: QVAC_KIT.roles.card,
          pal: { fill: 'panel', stroke: 'card', color: 'ink' },
        }),
  });

const qvacPartner: Family = (b) => {
  const p = qPad(b);
  const s = b.pick(
    { eb: 2.1, ebY: 21, hl: 4.4, hlY: 24.5, tagY: 41.5, tagH: 4.8, tag: 2.1 },
    { eb: 3.1, ebY: 49, hl: 6.8, hlY: 54, tagY: 80, tagH: 7.2, tag: 3.1 },
    { eb: 3.8, ebY: 99, hl: 8.2, hlY: 105, tagY: 137, tagH: 8.5, tag: 3.8 },
  );
  const lw = qLogoW(b);
  const lh = qLogoH(b);
  const partnerW = lw * 0.85;
  return [
    ...qFrame(b),
    b.pick(
      b.art('neural-net', 60, 9, 32),
      b.art('neural-net', 56, 12, 36),
      b.art('neural-net', 20, 42, 60),
    ),
    qWordmark(b, p.x, p.top, lw),
    b.text('x', p.x + lw * 1.08, p.top + lh / 2 - lw * 0.09, lw * 0.12, '×', lw * 0.18, {
      ...Q_MONO,
      align: 'center',
      slot: undefined,
    }),
    b.image(
      'partner_logo',
      p.x + lw * 1.3,
      p.top + lh / 2 - partnerW / 7.2,
      partnerW,
      PARTNER_LOGO,
      3.6,
    ),
    b.text('eyebrow', p.x, s.ebY, 60, '[ INTEGRATION ]', s.eb, Q_LABEL),
    b.text(
      'headline',
      p.x,
      s.hlY,
      b.pick(52, 82, 80),
      'Partner now runs\nQVAC models,\nfully on-device',
      s.hl,
      Q_HEAD,
    ),
    qTag(
      b,
      p.x,
      s.tagY,
      tagW('> AVAILABLE NOW', s.tag),
      s.tagH,
      '> AVAILABLE NOW',
      s.tag,
      true,
      'cta',
    ),
    b.text('url', 100 - p.x - 36, s.tagY + s.tagH / 2 - s.tag * 0.55, 36, 'qvac.tether.io', s.tag, {
      ...Q_MONO,
      align: 'right',
    }),
  ];
};

const qvacLaunch: Family = (b) => {
  const p = qPad(b);
  const s = b.pick(
    {
      eb: 2.1,
      noun: 11,
      nounY: 16,
      sub: 2.8,
      subY: 29,
      tagY: 41.5,
      tagH: 4.8,
      tag: 2.1,
      gap: 1,
    },
    {
      eb: 3.1,
      noun: 17,
      nounY: 44,
      sub: 4.3,
      subY: 64,
      tagY: 81,
      tagH: 7.2,
      tag: 3.1,
      gap: 1.5,
    },
    {
      eb: 3.8,
      noun: 21,
      nounY: 92,
      sub: 5.1,
      subY: 117,
      tagY: 137,
      tagH: 8.5,
      tag: 3.8,
      gap: 1.8,
    },
  );
  const [w1, w2, w3] = ['macOS', 'Linux', 'Windows'].map((t) => tagW(t, s.tag));
  return [
    ...qFrame(b),
    b.pick(b.art('chip', 66, 12, 24), b.art('chip', 62, 17, 28), b.art('chip', 30, 42, 40)),
    b.pick(
      b.art('circuit', 80, 36, 16, { op: 0.4 }),
      b.art('circuit', 76, 62, 22, { op: 0.4 }),
      b.art('circuit', 72, 68, 20, { op: 0.4 }),
    ),
    qWordmark(b, p.x, p.top, qLogoW(b)),
    qTopLabel(b, '[ NOW LIVE ]', s.eb),
    b.text('noun', p.x, s.nounY, 80, 'SDK 1.0', s.noun, {
      ...Q_HEAD,
      track: -0.05,
      lh: 1,
      tone: 'accent',
    }),
    b.text(
      'sub',
      p.x,
      s.subY,
      b.pick(50, 82, 80),
      'Run LLMs on your own machine.\nNo cloud, no API keys.',
      s.sub,
      Q_SUB,
    ),
    qTag(b, p.x, s.tagY, w1, s.tagH, 'macOS', s.tag, true),
    qTag(b, p.x + w1 + s.gap, s.tagY, w2, s.tagH, 'Linux', s.tag, false),
    qTag(b, p.x + w1 + w2 + s.gap * 2, s.tagY, w3, s.tagH, 'Windows', s.tag, false),
  ];
};

const HASH = '9f2c4e71b0a85d3e6c19f47a2b8e0d5c3a61f9e2d74b8c05e1a3f6d92c7b4e18';
const HASH_2 = HASH.match(/.{32}/g)?.join('\n') ?? HASH;
const HASH_4 = HASH.match(/.{16}/g)?.join('\n') ?? HASH;

const qvacChecksum: Family = (b) => {
  const p = qPad(b);
  const s = b.pick(
    {
      eb: 2.1,
      ebY: 14.5,
      hl: 4.2,
      hlY: 18,
      cardY: 28.5,
      cardW: 56,
      hash: 2.4,
      warn: 2.2,
      warnY: 44.5,
    },
    {
      eb: 3.1,
      ebY: 36,
      hl: 6.4,
      hlY: 41,
      cardY: 57.5,
      cardW: 82,
      hash: 3.5,
      warn: 3,
      warnY: 81.5,
    },
    {
      eb: 3.8,
      ebY: 64,
      hl: 7.8,
      hlY: 70,
      cardY: 93,
      cardW: 80,
      hash: 4.6,
      warn: 3.8,
      warnY: 136,
    },
  );
  const inset = s.hash * 1.1;
  // Story is too narrow for 32 characters a line, so the hash breaks into four.
  const hash = b.pick(HASH_2, HASH_2, HASH_4);
  const cardH = inset * 1.6 + s.hash * (1.5 + hash.split('\n').length * 1.4);
  return [
    ...qFrame(b),
    b.pick(
      b.art('fingerprint', 70, 14, 20),
      b.art('fingerprint', 72, 8, 18),
      b.art('fingerprint', 35, 34, 30),
    ),
    qWordmark(b, p.x, p.top, qLogoW(b)),
    b.text('eyebrow', p.x, s.ebY, 70, '[ VERIFY YOUR DOWNLOAD ]', s.eb, {
      ...Q_LABEL,
      color: Q_WARN,
      pal: undefined,
    }),
    b.text(
      'headline',
      p.x,
      s.hlY,
      b.pick(55, 82, 80),
      'Official QVAC\nWorkbench build',
      s.hl,
      Q_HEAD,
    ),
    b.rect(p.x, s.cardY, s.cardW, cardH, 'panel', { line: '#6b5a1e', sw: 0.3 }),
    b.text('hash_label', p.x + inset, s.cardY + inset * 0.8, 20, 'SHA256', s.hash * 0.8, {
      ...Q_MONO,
      slot: undefined,
    }),
    b.text(
      'address',
      p.x + inset,
      s.cardY + inset * 0.8 + s.hash * 1.5,
      s.cardW - inset * 2,
      hash,
      s.hash,
      {
        font: 'geist-mono',
        weight: 500,
        lh: 1.4,
      },
    ),
    b.text(
      'warning',
      p.x,
      s.warnY,
      80,
      b.pick(
        'Install only builds whose checksum matches.',
        'Install only builds whose checksum matches.',
        'Install only builds whose\nchecksum matches.',
      ),
      s.warn,
      { ...Q_MONO, lh: 1.4 },
    ),
  ];
};

const qvacOfficeHours: Family = (b) => {
  const p = qPad(b);
  const s = b.pick(
    {
      tag: 2.1,
      tagH: 4.8,
      face: 24,
      faceX: 66,
      faceY: 16,
      eb: 2.1,
      ebY: 14.5,
      name: 3.4,
      hl: 4.4,
      hlY: 29.5,
      time: 2.6,
      timeY: 41,
    },
    {
      tag: 3.1,
      tagH: 7.2,
      face: 22,
      faceX: 9,
      faceY: 44,
      eb: 3.1,
      ebY: 47.5,
      name: 5.2,
      hl: 6.6,
      hlY: 72,
      time: 4.2,
      timeY: 83,
    },
    {
      tag: 3.8,
      tagH: 8.5,
      face: 40,
      faceX: 10,
      faceY: 40,
      eb: 3.8,
      ebY: 90,
      name: 6.4,
      hl: 8,
      hlY: 114,
      time: 4.8,
      timeY: 128,
    },
  );
  const nameX = b.pick(p.x, p.x + s.face + 4, p.x);
  return [
    ...qFrame(b),
    b.pick(
      b.art('waveform', 42, 11, 18, { op: 0.6 }),
      b.art('waveform', 62, 20, 28),
      b.art('waveform', 56, 43, 34),
    ),
    qWordmark(b, p.x, p.top, qLogoW(b)),
    qTag(
      b,
      100 - p.x - tagW('● LIVE', s.tag),
      p.top + qLogoH(b) / 2 - s.tagH / 2,
      tagW('● LIVE', s.tag),
      s.tagH,
      '● LIVE',
      s.tag,
      true,
      'badge',
    ),
    b.photo('face', s.faceX, s.faceY, s.face, face('#1f2122', '#3a3d3f'), 0),
    b.rect(s.faceX, s.faceY, s.face, s.face, '', { line: 'accent', sw: s.face * 0.02 }),
    b.text('eyebrow', nameX, s.ebY, 40, '[ HOST ]', s.eb, Q_LABEL),
    b.text('name', nameX, s.ebY + s.eb * 1.6, 50, 'Sam Okafor', s.name, {
      ...Q_HEAD,
      track: -0.02,
    }),
    b.text(
      'role',
      nameX,
      s.ebY + s.eb * 1.6 + s.name * 1.35,
      50,
      'Research engineer',
      s.eb,
      Q_MONO,
    ),
    b.text('headline', p.x, s.hlY, b.pick(55, 82, 80), 'Local AI office hours', s.hl, Q_HEAD),
    b.text('time', p.x, s.timeY, 80, 'THU 18:00 UTC · DISCORD', s.time, {
      ...Q_LABEL,
      track: 0.04,
    }),
  ];
};

const qvacBenchmark: Family = (b) => {
  const p = qPad(b);
  const s = b.pick(
    { eb: 2.1, num: 15, numY: 15, unit: 4, label: 2.8, labelY: 33 },
    { eb: 3.1, num: 21, numY: 28, unit: 5.6, label: 4.3, labelY: 54 },
    { eb: 3.8, num: 27, numY: 46, unit: 7, label: 5.1, labelY: 80 },
  );
  const numW = s.num * 1.14;
  return [
    ...qFrame(b),
    b.pick(b.art('bars', 64, 12, 28), b.art('bars', 52, 50, 40), b.art('bars', 26, 98, 48)),
    b.pick(b.art('sparkle', 88, 12, 6), b.art('sparkle', 82, 36, 9), b.art('sparkle', 70, 94, 12)),
    qWordmark(b, p.x, p.top, qLogoW(b)),
    qTopLabel(b, '[ BENCHMARK ]', s.eb),
    b.text('number', p.x, s.numY, numW + 2, '42', s.num, {
      ...Q_HEAD,
      track: -0.05,
      lh: 1,
      tone: 'accent',
    }),
    b.text('unit', p.x + numW + s.unit * 0.3, s.numY + s.num * 0.62, 30, 'tok/s', s.unit, {
      font: 'geist-mono',
      weight: 500,
      // Not a slot, so every brand's Milestone offers the same inputs to a workflow.
      slot: undefined,
    }),
    b.text(
      'label',
      p.x,
      s.labelY,
      b.pick(45, 45, 80),
      '8B model on a laptop,\nno GPU needed',
      s.label,
      { ...Q_SUB, tone: 'ink' },
    ),
  ];
};

const qvacChangelog: Family = (b) => {
  const p = qPad(b);
  const lines = [
    'Vision models',
    'Faster cold start',
    'Speech to text',
    'Lower RAM use',
    'P2P model sharing',
    'New docs',
  ];
  const s = b.pick(
    {
      eb: 2.1,
      ebY: 17,
      title: 5,
      titleY: 20.5,
      titleText: "What's\nnew",
      lx: 50,
      ly: 11,
      gap: 6,
      line: 2.7,
    },
    {
      eb: 3.1,
      ebY: 22,
      title: 8,
      titleY: 26.5,
      titleText: "What's new",
      lx: 9,
      ly: 41,
      gap: 7.8,
      line: 4,
    },
    {
      eb: 3.8,
      ebY: 40,
      title: 9.4,
      titleY: 46,
      titleText: "What's\nnew",
      lx: 10,
      ly: 74,
      gap: 10.8,
      line: 4.8,
    },
  );
  return [
    ...qFrame(b),
    b.pick(b.art('prompt', 26, 38, 11), b.art('prompt', 70, 8, 20), b.art('prompt', 66, 22, 22)),
    qWordmark(b, p.x, p.top, qLogoW(b)),
    b.text('eyebrow', p.x, s.ebY, 60, '[ CHANGELOG V0.9 ]', s.eb, Q_LABEL),
    b.text('title', p.x, s.titleY, b.pick(40, 82, 80), s.titleText, s.title, Q_HEAD),
    ...lines.flatMap((line, i) => {
      const y = s.ly + i * s.gap;
      return [
        b.text('bullet', s.lx, y, s.line * 1.4, '+', s.line, { ...Q_LABEL, slot: undefined }),
        b.text(`line_${i + 1}`, s.lx + s.line * 1.6, y, 60, line, s.line, {
          font: 'geist-mono',
          weight: 400,
          role: 'line',
        }),
      ];
    }),
  ];
};

// ---------------------------------------------------------------- packs

// Each brand's own background, the same one every other pack uses.
const T_BG = brandBackground(TETHER_KIT);
const A_BG = brandBackground(SAMPLE_KIT);
const G_BG = brandBackground(GLASS_KIT);
const D_BG = brandBackground(DEGEN_KIT);
const Q_BG = brandBackground(QVAC_KIT);

/** The six layouts every brand fills, in the order the Templates tab shows them. */
const FAMILY_TITLES: Record<string, string> = {
  partner: 'Partnership',
  launch: 'Launch',
  contract: 'Official address',
  ama: 'Live AMA',
  milestone: 'Milestone',
  recap: 'Recap',
  news: 'Breaking news',
  ecosystem: 'Ecosystem',
  listing: 'Listing',
  api: 'API',
  app: 'In the app',
};

/** One brand's take on one family. The id keeps its original prefix, so saved designs still find it. */
function template(
  prefix: string,
  brand: string,
  kit: BrandKit,
  bg: ICBackground,
  key: string,
  family: keyof typeof FAMILY_TITLES,
  build: Family,
): ICTemplate {
  const [[, base], ...rest] = FMTS.map(
    ([f, ratio]) => [ratio, renumber(build(builder(f, kit)))] as const,
  );
  return {
    id: `${prefix}-${key}`,
    title: FAMILY_TITLES[family],
    pack: 'Announcement',
    brand,
    family,
    ratio: 'x-post',
    scene: false,
    scenePrompt: '',
    seed: 1,
    model: 'flux2-klein',
    thumb: kit.roles.bg,
    bg,
    els: base,
    variants: Object.fromEntries(rest),
    source: null,
    kit,
  };
}

const TETHER: ClassicBrand = {
  logo: { url: BRAND_LOGOS.tetherWordmark.url(), ratio: BRAND_LOGOS.tetherWordmark.ratio },
  heading: 'sans',
  warn: '#c2410c',
  nounScale: 1,
  art: {
    partnerBack: 'coin',
    partnerFront: 'token-orbit',
    launchMain: 'coin-stack',
    launchBack: 'network',
    contract: 'shield',
    ama: 'chat',
    number: 'chart-up',
    recap: 'hexagon',
  },
  copy: {
    partnerEyebrow: 'Partnership',
    partnerHeadline: 'USDT is now live\non Partner',
    cta: 'Live today',
    url: 'tether.to',
    launchEyebrow: 'Now live',
    noun: 'USDT',
    launchSub: 'Now on three more networks.\nSame token, same reserves.',
    tags: ['Ethereum', 'Tron', '+3'],
    contractEyebrow: 'Official contract',
    contractHeadline: 'USDT on Ethereum',
    address: '0xdAC17F958D2ee523a22\n06206994597C13D831ec7',
    warning: [
      'Any other address calling itself USDT is a scam.\nCheck it on tether.to before you send.',
      'Any other address calling itself USDT is a scam.\nCheck it on tether.to before you send.',
      'Any other address calling itself\nUSDT is a scam. Check it on\ntether.to before you send.',
    ],
    badge: 'X Spaces',
    guest: 'Guest',
    name: 'Alex Rivera',
    role: 'Head of Payments',
    amaHeadline: 'Stablecoins for\neveryday payments',
    time: 'Thu · 18:00 UTC',
    numberEyebrow: 'Milestone',
    number: '$1.2B',
    numberLabel: 'total value settled\nthis quarter',
    recapEyebrow: 'Quarter recap',
    recapTitle: ['What we\nshipped', 'What we shipped', 'What we\nshipped'],
    recapLines: [
      'New network support',
      'Faster redemptions',
      'Attestation report out',
      'Wallet SDK update',
      'Two new partners',
      'Docs rewrite',
    ],
    listing: ['New trading pair', '$USDT', 'is live on Partner'],
    api: ['Tether API', 'Transfer data'],
    features: [
      ['Transfer\nhistory', 'chain'],
      ['Chain\nbalances', 'blocks'],
      ['Proof of\nreserves', 'key'],
    ],
  },
};

const SAMPLE: ClassicBrand = {
  logo: SAMPLE_LOGO,
  heading: 'grotesk',
  warn: '#fbbf24',
  nounScale: 0.72,
  art: {
    partnerBack: 'orb',
    partnerFront: 'token-orbit',
    launchMain: 'cube',
    launchBack: 'dot-grid',
    contract: 'verified',
    ama: 'chat',
    number: 'bars',
    recap: 'rings',
  },
  copy: {
    partnerEyebrow: 'Partnership',
    partnerHeadline: 'Your Brand\nintegrates Partner',
    cta: 'Live today',
    url: 'yourbrand.xyz',
    launchEyebrow: 'Now live',
    noun: 'Vaults',
    launchSub: 'Earn on idle balances.\nWithdraw any time, no lockups.',
    tags: ['Mainnet', 'v2.0', 'Beta'],
    contractEyebrow: 'Official contract',
    contractHeadline: 'The only BRAND token',
    address: '0x7a3f19C0b82e4D1a5F0\n6c9E2b41d8A3E57fC20b9',
    warning: [
      'Any other address named BRAND is a scam.\nWe never DM first.',
      'Any other address named BRAND is a scam.\nWe never DM first.',
      'Any other address calling itself\nBRAND is a scam. We never\nDM first.',
    ],
    badge: 'Live AMA',
    guest: 'Guest',
    name: 'Jordan Lee',
    role: 'Head of Research',
    amaHeadline: "What's next\nfor vaults",
    time: 'Thu · 18:00 UTC',
    numberEyebrow: 'Milestone',
    number: '$1.2B',
    numberLabel: 'total value settled\non Your Brand',
    recapEyebrow: 'Q3 recap',
    recapTitle: ['What we\nshipped', 'What we shipped', 'What we\nshipped'],
    recapLines: [
      'Vaults on mainnet',
      'Partner settlement',
      'Audit #3 published',
      'Fees cut by 40%',
      'Mobile app beta',
      '12 new integrations',
    ],
    listing: ['New trading pair', '$BRAND', 'is live on Partner'],
    api: ['Your Brand API', 'Market data'],
    features: [
      ['Live\nprices', 'candles'],
      ['Market\npairs', 'blocks'],
      ['Proof of\nreserves', 'key'],
    ],
  },
};

/**
 * Breaking news: a glow in the brand's color from the top, a label, a big graphic, the logo, and a
 * big line at the bottom. Shared by every brand, QVAC included.
 */
const news =
  (logo: { url: string; ratio: number }, heading: ICFont, headline: string, art: string): Family =>
  (b) => {
    const H = HEIGHT[b.f as Fmt];
    const glow = Math.max(100, H * 2);
    const small = b.pick(2.4, 3.4, 3.8);
    const top = b.pick(4, 6, 26);
    const head = b.pick(6, 9.4, 10);
    const hy = H - b.pick(4, 6, 34) - head * 1.08 * 2;
    const lw = b.pick(16, 22, 26);
    const lh = lw / logo.ratio;
    const ly = hy - b.pick(5, 8, 12) - lh;
    // The shape fills the space between the label and the logo, with room left above the logo.
    const from = top + small * 1.2 + b.pick(2.5, 4, 6);
    const to = ly - b.pick(4, 7, 10);
    const size = Math.min(b.pick(46, 70, 84), (to - from) * 1.25);
    return [
      b.art('sky', 50 - glow / 2, 0, glow, { lock: true }),
      b.text('eyebrow', 10, top, 80, 'Breaking news', small, {
        weight: 600,
        align: 'center',
      }),
      b.art(art, 50 - size / 2, from + (to - from - size / 1.25) / 2, size),
      b.image('logo', 50 - lw / 2, ly, lw, logo.url, logo.ratio),
      b.text('headline', 5, hy, 90, headline, head, {
        font: heading,
        weight: 700,
        track: -0.03,
        lh: 1.08,
        align: 'center',
      }),
    ];
  };

/** A new feature in the app: the logo and words beside or above a phone showing a screenshot. */
const appFeature =
  (logo: { url: string; ratio: number }, heading: ICFont, headline: string): Family =>
  (b) => {
    const wide = b.f === 'x';
    const head = b.pick(5.4, 8, 8.6);
    const lw = b.pick(16, 22, 26);
    const pw = b.pick(28, 42, 60);
    const [px, py] = b.pick<[number, number]>([62, 6], [50 - 21, 44], [50 - 30, 68]);
    const tx = wide ? 7 : 6;
    const tw = wide ? 50 : 88;
    const align = wide ? 'left' : 'center';
    const ty = b.pick(20, 13, 34);
    return [
      b.art('glow', px - pw * 0.5, py + pw * 0.1, pw * 2, { op: 0.45, lock: true }),
      ...device(b, 'phone', px, py, pw),
      b.image('logo', wide ? tx : 50 - lw / 2, b.pick(7, 6, 26), lw, logo.url, logo.ratio),
      b.text('eyebrow', tx, ty, tw, 'New in the app', head * 0.42, { ...T_EYEBROW, align }),
      b.text('headline', tx, ty + head * 0.42 * 1.3 + 1.5, tw, headline, head, {
        font: heading,
        weight: 700,
        track: -0.03,
        lh: 1.08,
        align,
      }),
    ];
  };

const newsLine = (noun: string) => `${noun} ${noun.endsWith('s') ? 'are' : 'is'} live\non mainnet`;

/** What the ecosystem, listing and API layouts need from a brand. QVAC passes its own. */
interface Look {
  logo: { url: string; ratio: number };
  heading: ICFont;
  url: string;
  listing: [string, string, string];
  api: [string, string];
  features: [string, string][];
}

const lookOf = (c: ClassicBrand): Look => ({
  logo: c.logo,
  heading: c.heading,
  url: c.copy.url,
  listing: c.copy.listing,
  api: c.copy.api,
  features: c.copy.features,
});

const ECO_LABELS = [
  'ASSETS',
  'AI',
  'RISK',
  'YIELD',
  'PAYMENTS',
  'INFRA',
  'TOKENS',
  'DATA',
  'WALLETS',
  'SECURITY',
];
const ECO_ART = [
  'coin',
  'chip',
  'shield',
  'bars',
  'wallet',
  'network',
  'hexagon',
  'atom',
  'key',
  'lock',
];

/** Ecosystem adoption: the logo and a dated title over a grid of new partners, one per category. */
const ecosystem =
  (look: Look): Family =>
  (b) => {
    const H = HEIGHT[b.f as Fmt];
    const g = b.pick(
      {
        cols: 5,
        rows: 2,
        x: 4,
        y: 15,
        pad: 1.6,
        label: 1.5,
        tile: 8.5,
        name: 1.9,
        lw: 16,
        ty: 5.5,
        title: 2.6,
      },
      {
        cols: 5,
        rows: 2,
        x: 6,
        y: 22,
        pad: 1.8,
        label: 1.8,
        tile: 10,
        name: 2.2,
        lw: 22,
        ty: 7,
        title: 2.9,
      },
      {
        cols: 2,
        rows: 5,
        x: 8,
        y: 33,
        pad: 2.6,
        label: 2.2,
        tile: 8.5,
        name: 2.8,
        lw: 26,
        ty: 24,
        title: 3,
      },
    );
    const W = 100 - g.x * 2;
    const cw = W / g.cols;
    const ch = (b.pick(H - 4, 94, 146) - g.y) / g.rows;
    const tall = b.f === 'st';
    const title = 'New ecosystem adoption  |  Aug 10-23';
    const cells = Array.from({ length: g.cols * g.rows }, (_, i) => {
      const cx = g.x + (i % g.cols) * cw;
      const cy = g.y + Math.floor(i / g.cols) * ch;
      const ty = cy + g.pad + g.label * 2.2;
      const art = g.tile * 0.6;
      return [
        b.rect(cx, cy, cw, ch, '', { line: 'panel', sw: 0.2 }),
        b.text(
          `category_${i + 1}`,
          cx + g.pad,
          cy + g.pad,
          cw - g.pad * 2,
          ECO_LABELS[i],
          g.label,
          {
            font: 'geist-mono',
            weight: 500,
            track: 0.15,
            tone: 'muted',
            role: 'category',
          },
        ),
        b.rect(cx + g.pad, ty, g.tile, g.tile, 'card', {
          line: 'panel',
          sw: 0.15,
          radius: g.tile * 0.08,
        }),
        b.art(ECO_ART[i], cx + g.pad + (g.tile - art) / 2, ty + (g.tile - art) / 2, art),
        b.text(
          `name_${i + 1}`,
          cx + g.pad,
          ty + g.tile + g.pad * 0.6,
          cw - g.pad * 2,
          `Partner ${'ABCDEFGHIJ'[i]}`,
          g.name,
          {
            weight: 500,
            role: 'name',
          },
        ),
      ];
    }).flat();
    return [
      b.image('logo', g.x, g.ty, g.lw, look.logo.url, look.logo.ratio),
      tall
        ? b.text('title', g.x, g.ty + g.lw / look.logo.ratio + 2, W, title, g.title, {
            tone: 'muted',
            weight: 500,
          })
        : b.text(
            'title',
            100 - g.x - 64,
            g.ty + (g.lw / look.logo.ratio - g.title * 1.1) / 2,
            64,
            title,
            g.title,
            {
              tone: 'muted',
              weight: 500,
              align: 'right',
            },
          ),
      ...cells,
    ];
  };

/** A listing: the ticker big in the brand color, next to a token tile carrying the partner's logo. */
const listing =
  (look: Look): Family =>
  (b) => {
    const s = b.pick(
      {
        lw: 16,
        ly: 6,
        x: 6,
        ey: 16,
        eb: 3.4,
        ty: 25.5,
        tk: 10,
        tl: 37,
        tail: 3.6,
        w: 44,
        ax: 50,
        ay: 4,
        aw: 48,
      },
      {
        lw: 22,
        ly: 7,
        x: 7,
        ey: 36,
        eb: 5,
        ty: 48.5,
        tk: 11,
        tl: 63,
        tail: 4.8,
        w: 50,
        ax: 44,
        ay: 22,
        aw: 54,
      },
      {
        lw: 26,
        ly: 26,
        x: 8,
        ey: 108,
        eb: 5,
        ty: 120,
        tk: 13,
        tl: 134,
        tail: 5.4,
        w: 84,
        ax: 14,
        ay: 32,
        aw: 72,
      },
    );
    // The tile in the drawing: 29, 29 and 42 across, in a 100-wide box.
    const fx = s.ax + s.aw * 0.29;
    const fy = s.ay + s.aw * 0.29;
    const fs = s.aw * 0.42;
    return [
      b.art('token-stage', s.ax, s.ay, s.aw, { lock: true }),
      b.logo(
        'partner_logo',
        fx + fs * 0.12,
        fy + fs * 0.38,
        fs * 0.76,
        fs * 0.24,
        PARTNER_LOGO,
        3.6,
      ),
      b.image('logo', s.x, s.ly, s.lw, look.logo.url, look.logo.ratio),
      b.text('eyebrow', s.x, s.ey, s.w, look.listing[0], s.eb, { weight: 700, lh: 1.15 }),
      b.text('ticker', s.x, s.ty, s.w, look.listing[1], s.tk, {
        font: look.heading,
        weight: 800,
        track: -0.04,
        lh: 1,
        tone: 'accent',
      }),
      b.text('tail', s.x, s.tl, s.w, look.listing[2], s.tail, { weight: 700 }),
    ];
  };

/** An API or SDK: a two-tone title, three features with icon tiles, the address, and a glowing
 *  network drawing. */
const api =
  (look: Look): Family =>
  (b) => {
    const s = b.pick(
      {
        lw: 16,
        ly: 6,
        x: 6,
        t1: 15,
        t: 6.2,
        fy: 34,
        iw: 17,
        tile: 6,
        fs: 2,
        uy: 45,
        uh: 5,
        us: 2.2,
        glow: [52, -4, 56],
        net: [60, 8, 36],
      },
      {
        lw: 22,
        ly: 7,
        x: 7,
        t1: 42,
        t: 9.4,
        fy: 68,
        iw: 29,
        tile: 10,
        fs: 3,
        uy: 86,
        uh: 7,
        us: 3.2,
        glow: [36, -6, 76],
        net: [56, 12, 36],
      },
      {
        lw: 26,
        ly: 26,
        x: 8,
        t1: 98,
        t: 10,
        fy: 124,
        iw: 28,
        tile: 9,
        fs: 2.9,
        uy: 138,
        uh: 7,
        us: 3.2,
        glow: [0, 26, 100],
        net: [22, 36, 56],
      },
    );
    const heading = { font: look.heading, weight: 800, track: -0.04, lh: 1 };
    const features = look.features.flatMap(([label, art], i) => {
      const fx = s.x + i * s.iw;
      const icon = s.tile * 0.58;
      return [
        b.rect(fx, s.fy, s.tile, s.tile, 'card', { line: 'panel', sw: 0.2, radius: s.tile * 0.2 }),
        b.art(art, fx + (s.tile - icon) / 2, s.fy + (s.tile - icon) / 2, icon),
        b.text(
          `feature_${i + 1}`,
          fx + s.tile * 1.25,
          s.fy + (s.tile - s.fs * 2.4) / 2,
          s.iw - s.tile * 1.4,
          label,
          s.fs,
          {
            weight: 500,
            lh: 1.2,
            role: 'feature',
          },
        ),
      ];
    });
    return [
      b.art('glow', s.glow[0], s.glow[1], s.glow[2], { op: 0.45, lock: true }),
      b.art('network', s.net[0], s.net[1], s.net[2]),
      b.image('logo', s.x, s.ly, s.lw, look.logo.url, look.logo.ratio),
      b.text('title', s.x, s.t1, 88, look.api[0], s.t, heading),
      b.text('subtitle', s.x, s.t1 + s.t * 1.12, 88, look.api[1], s.t, {
        ...heading,
        tone: 'accent',
      }),
      ...features,
      b.pill('url', s.x, s.uy, pillW(look.url, s.us) + s.us * 2, s.uh, look.url, s.us, 'outline'),
    ];
  };

const CLASSIC_FAMILIES: [string, (c: ClassicBrand) => Family][] = [
  ['partner', classicPartner],
  ['launch', classicLaunch],
  ['contract', classicContract],
  ['ama', classicAma],
  ['milestone', classicNumber],
  ['recap', classicRecap],
  ['news', (c) => news(c.logo, c.heading, newsLine(c.copy.noun), 'layers')],
  ['ecosystem', (c) => ecosystem(lookOf(c))],
  ['listing', (c) => listing(lookOf(c))],
  ['api', (c) => api(lookOf(c))],
  ['app', (c) => appFeature(c.logo, c.heading, `${c.copy.noun}, now\nin the app`)],
];

const QVAC_LOOK: Look = {
  logo: { url: BRAND_LOGOS.qvacWordmark.url(), ratio: BRAND_LOGOS.qvacWordmark.ratio },
  heading: 'geist',
  url: 'qvac.tether.io',
  listing: ['New model', '8B chat', 'runs on QVAC'],
  api: ['QVAC SDK', 'Local AI'],
  features: [
    ['Local\nmodels', 'chip'],
    ['Offline\nsearch', 'atom'],
    ['Peer\nsharing', 'network'],
  ],
};

const classicPack = (
  prefix: string,
  id: string,
  c: ClassicBrand,
  kit: BrandKit,
  bg: ICBackground,
) =>
  CLASSIC_FAMILIES.map(([family, build]) =>
    template(prefix, id, kit, bg, family, family, (b) => [
      // Breaking news brings its own glow, so it skips the brand's.
      ...(family === 'news' ? [] : (c.backdrop?.(b, family) ?? [])),
      ...build(c)(b),
    ]),
  );

type Spot = [x: number, y: number, w: number];

const GLASS: ClassicBrand = {
  ...SAMPLE,
  art: {
    partnerBack: 'glass-orb',
    partnerFront: 'token-orbit',
    launchMain: 'cube',
    launchBack: 'glass-orb',
    contract: 'shield',
    ama: 'chat',
    number: 'bars',
    recap: 'glass-orb',
  },
  // Blue light from the top left and violet from the bottom right, as in the Glass mockup.
  backdrop: (b) => [
    b.art('glow', ...b.pick<Spot>([-18, -30, 70], [-28, -28, 90], [-40, -20, 130]), {
      op: 0.35,
      colors: { main: '#3d5bbd', detail: '#3d5bbd' },
    }),
    b.art('glow', ...b.pick<Spot>([62, 18, 70], [50, 48, 90], [30, 120, 130]), {
      op: 0.4,
      colors: { main: '#b9a4ff', detail: '#b9a4ff' },
    }),
  ],
};

// Each Degen template gets its own loud pair of blurred blobs, as each mockup poster did.
const DEGEN_GLOWS: Record<string, [string, string]> = {
  partner: ['#f472b6', '#c084fc'],
  launch: ['#fb923c', '#f472b6'],
  contract: ['#c084fc', '#f472b6'],
  ama: ['#c084fc', '#f472b6'],
  milestone: ['#c084fc', '#fb923c'],
  recap: ['#c084fc', '#f472b6'],
  ecosystem: ['#c084fc', '#f472b6'],
  listing: ['#fb923c', '#f472b6'],
  api: ['#c084fc', '#fb923c'],
  app: ['#f472b6', '#c084fc'],
};

const DEGEN: ClassicBrand = {
  ...SAMPLE,
  heading: 'archivo-black',
  warn: '#fde047',
  art: {
    partnerBack: 'splat',
    partnerFront: 'sparkle',
    launchMain: 'coin-stack',
    launchBack: 'splat',
    contract: 'verified',
    ama: 'chat',
    number: 'bars',
    recap: 'goo',
  },
  copy: {
    ...SAMPLE.copy,
    partnerEyebrow: 'Collab',
    launchEyebrow: 'LFG',
    badge: 'Space',
    // Archivo Black runs wide, so these lines are kept short enough for a story.
    contractHeadline: 'The BRAND token',
    partnerHeadline: 'Your Brand ×\nPartner',
  },
  backdrop: (b, family) => {
    const [main, detail] = DEGEN_GLOWS[family];
    return [
      b.art('glow-duo', ...b.pick<Spot>([-10, -45, 120], [-25, -25, 150], [-50, -10, 200]), {
        op: 0.85,
        colors: { main, detail },
      }),
    ];
  },
};

/** The brands the Announcement pack comes in. All but QVAC share the classic layouts; QVAC has its own. */
export const ANNOUNCE_BRANDS = [
  { id: 'acme', name: 'Default', kit: SAMPLE_KIT },
  { id: 'glass', name: 'Glass', kit: GLASS_KIT },
  { id: 'degen', name: 'Degen', kit: DEGEN_KIT },
  { id: 'tether', name: 'Tether', kit: TETHER_KIT },
  { id: 'qvac', name: 'QVAC', kit: QVAC_KIT },
];

/** Eleven families in each brand: Partnership, Launch, Official address, Live AMA, Milestone, Recap,
 *  Breaking news, Ecosystem, Listing, API and In the app. */
export const ANNOUNCE_PACK: ICTemplate[] = [
  ...classicPack('announcement', 'acme', SAMPLE, SAMPLE_KIT, A_BG),
  ...classicPack('tether', 'tether', TETHER, TETHER_KIT, T_BG),
  template('qvac', 'qvac', QVAC_KIT, Q_BG, 'partner', 'partner', qvacPartner),
  template('qvac', 'qvac', QVAC_KIT, Q_BG, 'launch', 'launch', qvacLaunch),
  template('qvac', 'qvac', QVAC_KIT, Q_BG, 'checksum', 'contract', qvacChecksum),
  template('qvac', 'qvac', QVAC_KIT, Q_BG, 'office-hours', 'ama', qvacOfficeHours),
  template('qvac', 'qvac', QVAC_KIT, Q_BG, 'benchmark', 'milestone', qvacBenchmark),
  template('qvac', 'qvac', QVAC_KIT, Q_BG, 'changelog', 'recap', qvacChangelog),
  template(
    'qvac',
    'qvac',
    QVAC_KIT,
    Q_BG,
    'news',
    'news',
    news(
      { url: BRAND_LOGOS.qvacWordmark.url(), ratio: BRAND_LOGOS.qvacWordmark.ratio },
      'geist',
      'SDK 1.0 is\nout now',
      'layers',
    ),
  ),
  template('qvac', 'qvac', QVAC_KIT, Q_BG, 'ecosystem', 'ecosystem', ecosystem(QVAC_LOOK)),
  template('qvac', 'qvac', QVAC_KIT, Q_BG, 'listing', 'listing', listing(QVAC_LOOK)),
  template('qvac', 'qvac', QVAC_KIT, Q_BG, 'api', 'api', api(QVAC_LOOK)),
  template(
    'qvac',
    'qvac',
    QVAC_KIT,
    Q_BG,
    'app',
    'app',
    appFeature(QVAC_LOOK.logo, 'geist', 'QVAC, now\non your phone'),
  ),
  ...classicPack('glass', 'glass', GLASS, GLASS_KIT, G_BG),
  ...classicPack('degen', 'degen', DEGEN, DEGEN_KIT, D_BG),
];

/** Which brand a kit belongs to, so applying a brand's kit and picking the brand are one choice. */
export const brandOfKit = (kitId: string | undefined): string | undefined =>
  ANNOUNCE_BRANDS.find((b) => b.kit.id === kitId)?.id;
