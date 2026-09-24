// Announcement templates for the built-in Tether and QVAC kits: six layout families, each laid out
// by hand for X, square and story. One builder per family keeps layer order and slots the same across sizes.

import { artDef, artPalette } from './image-constructor-art.js';
import { BRAND_LOGOS, QVAC_KIT, TETHER_KIT } from './image-constructor-brand-builtin.js';
import type { BrandKit } from './image-constructor-brand-kit.js';
import type { ICFont } from './image-constructor-font-list.js';
import type {
  ICArtEl,
  ICBackground,
  ICElement,
  ICImage,
  ICPill,
  ICRatio,
  ICRole,
  ICShape,
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
const PARTNER_LOGO = svgUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="40" viewBox="0 0 144 40">' +
    '<path d="M20 2c1.4 9.4 7.6 15.6 17 17-9.4 1.4-15.6 7.6-17 17-1.4-9.4-7.6-15.6-17-17 9.4-1.4 15.6-7.6 17-17Z" fill="#8b93a1"/>' +
    '<rect x="46" y="10" width="92" height="9" rx="4.5" fill="#8b93a1"/><rect x="46" y="24" width="58" height="7" rx="3.5" fill="#8b93a1" opacity=".6"/></svg>',
);

const face = (bg: string, fg: string) =>
  svgUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100">' +
      `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="40" r="17" fill="${fg}"/>` +
      `<path d="M18 100c2-22 16-32 32-32s30 10 32 32Z" fill="${fg}"/></svg>`,
  );

/** Places layers for one format and brand. `y` and heights are in percent of the width and
 *  converted to percent of the height here, so every family can stack blocks in one unit. */
function builder(f: Fmt, kit: BrandKit) {
  const H = HEIGHT[f];
  const Y = (u: number) => (u / H) * 100;
  const roles = kit.roles;
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
      o: Partial<ICText> & { tone?: ICRole } = {},
    ): ICText {
      const { tone = 'ink', ...rest } = o;
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
        color: roles[tone],
        align: 'left',
        track: 0,
        lh: 1.1,
        vis: true,
        pal: { color: tone },
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
      o: Partial<ICShape> & { line?: ICRole | string } = {},
    ): ICShape {
      const { line, ...rest } = o;
      const lineRole = line && line in roles ? (line as ICRole) : undefined;
      return {
        id: id(),
        t: 'shape',
        kind: 'rect',
        x,
        y: Y(y),
        w,
        h: Y(h),
        fill: fill ? roles[fill] : '',
        stroke: lineRole ? roles[lineRole] : (line ?? ''),
        sw: line ? 0.3 : 0.25,
        radius: 0,
        vis: true,
        pal: { ...(fill ? { fill } : {}), ...(lineRole ? { stroke: lineRole } : {}) },
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
    art(artId: string, x: number, y: number, w: number, o: Partial<ICArtEl> = {}): ICArtEl {
      const def = artDef(artId);
      return {
        id: id(),
        t: 'art',
        art: artId,
        x,
        y: Y(y),
        w,
        colors: def ? artPalette(def, roles) : {},
        vis: true,
        ...o,
      };
    },
  };
}

type B = ReturnType<typeof builder>;
type Family = (b: B) => ICElement[];

// ---------------------------------------------------------------- Tether

const T_HEAD = { font: 'sans' as ICFont, weight: 700, track: -0.035, lh: 1.08 };
const T_EYEBROW = { weight: 600, track: 0.02, tone: 'accent' as ICRole };
const T_SUB = { weight: 400, lh: 1.4, tone: 'muted' as ICRole };
const T_WARN = '#c2410c';

/** Side and top margins. Story starts lower to stay clear of the app's own top bar. */
const tPad = (b: B) => b.pick({ x: 5.5, top: 5.5 }, { x: 7, top: 7 }, { x: 8, top: 22 });

const tWordmark = (b: B, x: number, y: number, w: number) =>
  b.image('logo', x, y, w, BRAND_LOGOS.tetherWordmark.url(), BRAND_LOGOS.tetherWordmark.ratio);

const tetherPartner: Family = (b) => {
  const p = tPad(b);
  const s = b.pick(
    { logo: 14, hl: 4.8, hlY: 29, eyY: 25, pillY: 43, pillH: 5, pillW: 16.5, pill: 2.3, url: 2.3 },
    {
      logo: 24,
      hl: 7.6,
      hlY: 62.5,
      eyY: 58,
      pillY: 84.5,
      pillH: 8,
      pillW: 24.5,
      pill: 3.4,
      url: 3.3,
    },
    { logo: 30, hl: 9, hlY: 116, eyY: 110.5, pillY: 139, pillH: 9, pillW: 29, pill: 4, url: 4 },
  );
  const logoH = s.logo / BRAND_LOGOS.tetherWordmark.ratio;
  const partnerW = s.logo * 0.85;
  return [
    b.pick(
      b.art('coin', 60, 4, 38, { op: 0.1 }),
      b.art('coin', 52, 50, 64, { op: 0.1 }),
      b.art('coin', 30, 118, 96, { op: 0.08 }),
    ),
    b.pick(
      b.art('token-orbit', 66, 12, 26),
      b.art('token-orbit', 72, 20, 20),
      b.art('token-orbit', 24, 44, 52),
    ),
    tWordmark(b, p.x, p.top, s.logo),
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
    b.text('eyebrow', p.x, s.eyY, 60, 'Partnership', s.hl * 0.44, T_EYEBROW),
    b.text(
      'headline',
      p.x,
      s.hlY,
      b.pick(52, 86, 84),
      'USDT is now live\non Nova Labs',
      s.hl,
      T_HEAD,
    ),
    b.pill('cta', p.x, s.pillY, s.pillW, s.pillH, 'Live today', s.pill, 'solid'),
    b.text('url', 100 - p.x - 30, s.pillY + s.pillH / 2 - s.url * 0.55, 30, 'tether.to', s.url, {
      ...T_SUB,
      weight: 500,
      align: 'right',
    }),
  ];
};

const tetherLaunch: Family = (b) => {
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
      w: [16, 10.5, 8],
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
      w: [23.5, 15, 12],
      gap: 1.8,
    },
    {
      logo: 30,
      eb: 4,
      noun: 25,
      nounY: 94,
      sub: 5.2,
      subY: 121,
      pillY: 139,
      pillH: 9,
      pill: 4,
      w: [27.5, 17.5, 14],
      gap: 2,
    },
  );
  const [w1, w2, w3] = s.w;
  return [
    b.pick(
      b.art('coin-stack', 64, 11, 28),
      b.art('coin-stack', 66, 17, 26),
      b.art('coin-stack', 26, 40, 48),
    ),
    b.pick(
      b.art('network', 84, 34, 18, { op: 0.22 }),
      b.art('network', 76, 66, 28, { op: 0.22 }),
      b.art('network', 70, 126, 30, { op: 0.2 }),
    ),
    tWordmark(b, p.x, p.top, s.logo),
    b.text(
      'eyebrow',
      100 - p.x - 30,
      p.top + (s.logo / BRAND_LOGOS.tetherWordmark.ratio - s.eb) / 2,
      30,
      'Now live',
      s.eb,
      { ...T_EYEBROW, align: 'right' },
    ),
    b.text('noun', p.x, s.nounY, 84, 'USDT', s.noun, {
      ...T_HEAD,
      weight: 800,
      track: -0.05,
      lh: 1,
      tone: 'accent',
    }),
    b.text(
      'sub',
      p.x,
      s.subY,
      b.pick(50, 86, 84),
      'Now on three more networks.\nSame token, same reserves.',
      s.sub,
      T_SUB,
    ),
    b.pill('tag', p.x, s.pillY, w1, s.pillH, 'Ethereum', s.pill, 'solid'),
    b.pill('tag', p.x + w1 + s.gap, s.pillY, w2, s.pillH, 'Tron', s.pill, 'outline'),
    b.pill('tag', p.x + w1 + w2 + s.gap * 2, s.pillY, w3, s.pillH, '+3', s.pill, 'outline'),
  ];
};

const tetherContract: Family = (b) => {
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
  const warn = b.pick(
    'Any other address calling itself USDT is a scam.\nCheck it on tether.to before you send.',
    'Any other address calling itself USDT is a scam.\nCheck it on tether.to before you send.',
    'Any other address calling itself\nUSDT is a scam. Check it on\ntether.to before you send.',
  );
  return [
    b.pick(b.art('shield', 66, 10, 26), b.art('shield', 73, 7, 20), b.art('shield', 30, 38, 40)),
    tWordmark(b, p.x, p.top, s.logo),
    b.text('eyebrow', p.x, s.ebY, 60, 'Official contract', s.eb, {
      ...T_EYEBROW,
      color: T_WARN,
      pal: undefined,
    }),
    b.text('headline', p.x, s.hlY, b.pick(55, 86, 84), 'USDT on Ethereum', s.hl, T_HEAD),
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
      '0xdAC17F958D2ee523a22\n06206994597C13D831ec7',
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

const tetherAma: Family = (b) => {
  const p = tPad(b);
  const s = b.pick(
    {
      logo: 14,
      pill: 2.3,
      pillW: 15,
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
      pillW: 22.5,
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
      pillW: 26.5,
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
    b.pick(b.art('chat', 56, 11, 11), b.art('chat', 69, 22, 24), b.art('chat', 70, 36, 20)),
    tWordmark(b, p.x, p.top, s.logo),
    b.pill(
      'badge',
      100 - p.x - s.pillW,
      p.top - s.pillH * 0.12,
      s.pillW,
      s.pillH,
      'X Spaces',
      s.pill,
      'solid',
    ),
    {
      ...b.rect(s.faceX - ring, s.faceY - ring, s.face + ring * 2, s.face + ring * 2, 'accent'),
      kind: 'ellipse',
    },
    b.photo('face', s.faceX, s.faceY, s.face, face('#e4e7eb', '#b8bec6'), s.face / 2),
    b.text('eyebrow', nameX, ebY, 40, 'Guest', s.eb, T_EYEBROW),
    b.text('name', nameX, ebY + s.eb * 1.45, 50, 'Alex Rivera', s.name, {
      ...T_HEAD,
      track: -0.02,
    }),
    b.text('role', nameX, ebY + s.eb * 1.45 + s.name * 1.3, 50, 'Head of Payments', s.eb * 1.02, {
      ...T_SUB,
      weight: 500,
    }),
    b.text(
      'headline',
      p.x,
      s.hlY,
      b.pick(55, 86, 84),
      'Stablecoins for\neveryday payments',
      s.hl,
      T_HEAD,
    ),
    b.text('time', p.x, s.timeY, 60, 'Thu · 18:00 UTC', s.time, {
      ...T_HEAD,
      track: -0.01,
      tone: 'accent',
    }),
  ];
};

const tetherNumber: Family = (b) => {
  const p = tPad(b);
  const s = b.pick(
    { logo: 14, eb: 2.3, num: 15, numY: 16, label: 3.1, labelY: 33 },
    { logo: 24, eb: 3.3, num: 23, numY: 27, label: 4.8, labelY: 53 },
    { logo: 30, eb: 4, num: 28, numY: 46, label: 5.8, labelY: 77 },
  );
  return [
    b.pick(
      b.art('chart-up', 58, 10, 36),
      b.art('chart-up', 46, 44, 49),
      b.art('chart-up', 22, 96, 56),
    ),
    tWordmark(b, p.x, p.top, s.logo),
    b.text(
      'eyebrow',
      100 - p.x - 30,
      p.top + (s.logo / BRAND_LOGOS.tetherWordmark.ratio - s.eb) / 2,
      30,
      'Milestone',
      s.eb,
      { ...T_EYEBROW, align: 'right' },
    ),
    b.text('number', p.x, s.numY, 70, '$1.2B', s.num, {
      ...T_HEAD,
      weight: 800,
      track: -0.05,
      lh: 1,
      tone: 'accent',
    }),
    b.text(
      'label',
      p.x,
      s.labelY,
      b.pick(45, 50, 80),
      'total value settled\nthis quarter',
      s.label,
      { weight: 500, lh: 1.3 },
    ),
  ];
};

const tetherRecap: Family = (b) => {
  const p = tPad(b);
  const lines = [
    'New network support',
    'Faster redemptions',
    'Attestation report out',
    'Wallet SDK update',
    'Two new partners',
    'Docs rewrite',
  ];
  const s = b.pick(
    {
      logo: 14,
      eb: 2.3,
      ebY: 17,
      title: 5,
      titleY: 20.5,
      titleText: 'What we\nshipped',
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
      titleText: 'What we shipped',
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
      titleText: 'What we\nshipped',
      lx: 8,
      ly: 74,
      gap: 11.2,
      line: 5.2,
    },
  );
  const dot = s.line * 1.15;
  return [
    b.pick(
      b.art('hexagon', -6, 36, 24, { op: 0.2 }),
      b.art('hexagon', 74, -6, 32, { op: 0.22 }),
      b.art('hexagon', 66, 140, 42, { op: 0.18 }),
    ),
    tWordmark(b, p.x, p.top, s.logo),
    b.text('eyebrow', p.x, s.ebY, 40, 'Quarter recap', s.eb, T_EYEBROW),
    b.text('title', p.x, s.titleY, b.pick(40, 86, 84), s.titleText, s.title, T_HEAD),
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

const qPad = (b: B) => b.pick({ x: 7, top: 6.5 }, { x: 9, top: 9 }, { x: 10, top: 22 });

/** Full-bleed grid and corner ticks, drawn for the current canvas shape. */
const qFrame = (b: B) => [
  b.art(b.pick('grid-lines-wide', 'grid-lines', 'grid-lines-tall'), 0, 0, 100, { lock: true }),
  b.art(b.pick('corner-ticks-wide', 'corner-ticks', 'corner-ticks-tall'), 0, 0, 100, {
    lock: true,
  }),
];

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
) =>
  b.pill('tag', x, y, w, h, text, size, solid ? 'solid' : 'outline', {
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
      'QVAC now runs\ninside Nova Labs,\nfully on-device',
      s.hl,
      Q_HEAD,
    ),
    qTag(b, p.x, s.tagY, tagW('> AVAILABLE NOW', s.tag), s.tagH, '> AVAILABLE NOW', s.tag, true),
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
      ebY: 70,
      hl: 7.8,
      hlY: 76,
      cardY: 99,
      cardW: 80,
      hash: 4.6,
      warn: 3.8,
      warnY: 144,
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
      'hash',
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

const T_BG: ICBackground = {
  mode: 'gradient',
  color: '#ffffff',
  from: '#ffffff',
  to: '#e6f5f4',
  angle: 170,
};
const Q_BG: ICBackground = {
  mode: 'solid',
  color: '#0f1010',
  from: '#0f1010',
  to: '#0f1010',
  angle: 180,
};

function template(
  pack: string,
  kit: BrandKit,
  bg: ICBackground,
  key: string,
  title: string,
  family: Family,
): ICTemplate {
  const [[, base], ...rest] = FMTS.map(([f, ratio]) => [ratio, family(builder(f, kit))] as const);
  return {
    id: `${pack.toLowerCase()}-${key}`,
    title,
    pack,
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

export const TETHER_PACK: ICTemplate[] = [
  template('Tether', TETHER_KIT, T_BG, 'partner', 'Partnership', tetherPartner),
  template('Tether', TETHER_KIT, T_BG, 'launch', 'Launch', tetherLaunch),
  template('Tether', TETHER_KIT, T_BG, 'contract', 'Official address', tetherContract),
  template('Tether', TETHER_KIT, T_BG, 'ama', 'Live AMA', tetherAma),
  template('Tether', TETHER_KIT, T_BG, 'milestone', 'Milestone', tetherNumber),
  template('Tether', TETHER_KIT, T_BG, 'recap', 'Recap', tetherRecap),
];

export const QVAC_PACK: ICTemplate[] = [
  template('QVAC', QVAC_KIT, Q_BG, 'partner', 'Integration', qvacPartner),
  template('QVAC', QVAC_KIT, Q_BG, 'launch', 'Launch', qvacLaunch),
  template('QVAC', QVAC_KIT, Q_BG, 'checksum', 'Verified download', qvacChecksum),
  template('QVAC', QVAC_KIT, Q_BG, 'office-hours', 'Office hours', qvacOfficeHours),
  template('QVAC', QVAC_KIT, Q_BG, 'benchmark', 'Benchmark', qvacBenchmark),
  template('QVAC', QVAC_KIT, Q_BG, 'changelog', 'Changelog', qvacChangelog),
];
