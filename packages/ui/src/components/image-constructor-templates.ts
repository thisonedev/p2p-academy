// biome-ignore lint/correctness/noUnusedImports: only used by the "Avatar" template, commented out below
import { defaultAvatarConfig } from './image-constructor-avatar.js';
import {
  type ICElement,
  type ICImage,
  type ICLayout,
  type ICLine,
  type ICRole,
  type ICShape,
  type ICSubject,
  type ICTemplate,
  type ICText,
  SAMPLE_SUBJECT,
} from './image-constructor-layout.js';
import { ANNOUNCE_PACK } from './image-constructor-announce.js';
import { COBRAND_PACK } from './image-constructor-cobrand.js';
import { sampleUrl } from './image-constructor-samples.js';

const text = (
  id: string,
  role: string,
  x: number,
  y: number,
  w: number,
  value: string,
  size: number,
  o: Partial<ICText> = {},
): ICText => ({
  id,
  t: 'text',
  role,
  x,
  y,
  w,
  text: value,
  size,
  weight: 400,
  font: 'sans',
  color: '#111111',
  align: 'left',
  track: 0,
  lh: 1.1,
  vis: true,
  ...o,
});

const line = (id: string, x: number, y: number, w: number, th: number, color: string): ICLine => ({
  id,
  t: 'line',
  x,
  y,
  w,
  th,
  color,
  vis: true,
});

const subject = (id: string, x: number, y: number, w: number): ICSubject => ({
  id,
  t: 'subject',
  x,
  y,
  w,
  shadow: true,
  vis: true,
});

// biome-ignore lint/correctness/noUnusedVariables: unused while "Big type poster" is commented out below, other gradient-bg templates will need this again
const gradient = (from: string, to: string, angle: number) => ({
  mode: 'gradient' as const,
  color: from,
  from,
  to,
  angle,
});

const shape = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  o: Partial<ICShape> = {},
): ICShape => ({
  id,
  t: 'shape',
  kind: 'rect',
  x,
  y,
  w,
  h,
  fill,
  stroke: '',
  sw: 0.25,
  radius: 0,
  vis: true,
  ...o,
});

// Templates author each ratio by hand: text sizes are percent of the width, y is percent of the height.
const PORTRAIT = 4 / 3;
const SQUARE = 1;

/** Text turned on its side, placed by its center so the position on the canvas is easy to read. */
const vtext = (
  hw: number,
  id: string,
  role: string,
  cx: number,
  cy: number,
  len: number,
  value: string,
  size: number,
  o: Partial<ICText> = {},
): ICText =>
  text(id, role, cx - len / 2, cy - (size * (o.lh ?? 1.1)) / 2 / hw, len, value, size, {
    rot: -90,
    align: 'center',
    ...o,
  });

/** A size chip: a rounded square with its label centered on top. */
const chip = (
  hw: number,
  id: string,
  x: number,
  y: number,
  label: string,
  selected: boolean,
): ICElement[] => {
  const h = 4.4 / hw;
  return [
    shape(`${id}a`, x, y, 4.4, h, selected ? '#7a5138' : '', {
      stroke: selected ? '' : '#3a2a1e',
      sw: 0.18,
      radius: 0.7,
    }),
    text(`${id}b`, 'chip', x, y + h / 2 - 1.1 / hw, 4.4, label, 2, {
      weight: 600,
      color: selected ? '#ffffff' : '#3a2a1e',
      align: 'center',
    }),
  ];
};

const detailImage = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): ICImage => ({
  id,
  t: 'image',
  name: 'sample-detail.svg',
  url: sampleUrl('sample-detail.svg'),
  ratio: 1.48,
  x,
  y,
  w,
  h,
  radius,
  vis: true,
});

/** Tags each color a design already uses with the palette role it plays. */
const bindRoles = (els: ICElement[], roles: Record<string, ICRole>): ICElement[] =>
  els.map((e) => {
    const pal: NonNullable<ICElement['pal']> = {};
    for (const key of ['color', 'fill', 'stroke'] as const) {
      const value = (e as unknown as Record<string, unknown>)[key];
      const role = typeof value === 'string' ? roles[value.toLowerCase()] : undefined;
      if (role) pal[key] = role;
    }
    return Object.keys(pal).length > 0 ? { ...e, pal } : e;
  });

const CATALOG_ROLES: Record<string, ICRole> = {
  '#e8ded1': 'panel',
  '#e9dfd2': 'card',
  '#5b3a25': 'ink',
  '#2b1c12': 'ink',
  '#3a2a1e': 'ink',
  '#7a5138': 'accent',
  '#ffffff': 'onAccent',
};

// biome-ignore lint/correctness/noUnusedVariables: only used by "Big type poster", commented out below
const POSTER_ROLES: Record<string, ICRole> = { '#ffffff': 'ink' };

// Scene prompts ask for empty space and no lettering, so the model never paints words.
const RAW_PACK: ICTemplate[] = [
  {
    id: 'blank',
    title: 'Blank',
    pack: 'Product',
    ratio: 'ig-post',
    scene: false,
    model: 'sd2.1',
    seed: 1,
    scenePrompt: '',
    thumb: 'linear-gradient(180deg,#f4f4f4,#ffffff)',
    bg: { mode: 'solid', color: '#ffffff', from: '#ffffff', to: '#ffffff', angle: 0 },
    source: null,
    els: [],
  },
  {
    id: 'product-catalog-page',
    title: 'Catalog page',
    pack: 'Product',
    ratio: '3:4',
    scene: false,
    model: 'flux2-klein',
    seed: 19,
    scenePrompt:
      'Warm beige studio wall with soft daylight and a light floor, calm empty space, no objects, no text, no logos.',
    subject: {
      name: 'sample-trousers.svg',
      url: sampleUrl('sample-trousers.svg'),
      ratio: 0.5,
      sample: true,
    },
    thumb: 'linear-gradient(180deg,#cdc0b0,#d9cebf)',
    bg: { mode: 'solid', color: '#cdc0b0', from: '#cdc0b0', to: '#cdc0b0', angle: 180 },
    source: null,
    els: [
      shape('e1', 0, 0, 33.5, 100, '#e8ded1'),
      vtext(PORTRAIT, 'e2', 'headline', 14.5, 46, 105, 'TROUSERS', 18, {
        font: 'serif',
        color: '#5b3a25',
        lh: 1,
      }),
      vtext(PORTRAIT, 'e3', 'subline', 25.2, 62, 66, 'EFFORTLESS STYLE. PERFECT FIT.', 2.2, {
        weight: 500,
        track: 0.34,
        color: '#5b3a25',
      }),
      shape('e4', 23.4, 11, 0.18, 27, '#5b3a25'),
      subject('e5', 34, 14, 42),
      shape('e6', 69, 8.4, 29.5, 29.5, '#e9dfd2', { radius: 2.4, op: 0.95 }),
      detailImage('e7', 70.4, 9.4, 26.7, 13.5, 1.4),
      text('e8', 'detail', 69, 25, 29.5, 'HIGH WAIST', 3.6, {
        font: 'serif',
        weight: 500,
        track: 0.09,
        color: '#2b1c12',
        align: 'center',
      }),
      line('e9', 78, 28.4, 11.5, 0.12, '#5b3a25'),
      text('e10', 'features', 69, 29.5, 29.5, 'Flattering Fit\nAll-Day Comfort', 2.4, {
        lh: 1.45,
        color: '#3a2a1e',
        align: 'center',
      }),
      text('e11', 'label', 79, 66, 20, 'COLORS', 2.1, {
        weight: 600,
        track: 0.12,
        color: '#3a2a1e',
      }),
      shape('e12', 79, 69.5, 4, 3, '#1f2a6b', { radius: 0.6 }),
      shape('e13', 84.4, 69.5, 4, 3, '#a9826a', { radius: 0.6 }),
      shape('e14', 89.8, 69.5, 4, 3, '#7b7873', { radius: 0.6 }),
      shape('e15', 95.2, 69.5, 4, 3, '#1a1a1a', { radius: 0.6 }),
      line('e16', 79, 76.2, 19.5, 0.12, '#5b3a25'),
      text('e17', 'label', 79, 80.6, 20, 'SIZES', 2.1, {
        weight: 600,
        track: 0.12,
        color: '#3a2a1e',
      }),
      ...chip(PORTRAIT, 'e18', 79, 84, 'XS', false),
      ...chip(PORTRAIT, 'e19', 84.2, 84, 'S', true),
      ...chip(PORTRAIT, 'e20', 89.4, 84, 'M', false),
      ...chip(PORTRAIT, 'e21', 94.6, 84, 'L', false),
    ],
    variants: {
      '1:1': [
        shape('e1', 0, 0, 33.5, 100, '#e8ded1'),
        vtext(SQUARE, 'e2', 'headline', 14.5, 46, 78, 'TROUSERS', 13.5, {
          font: 'serif',
          color: '#5b3a25',
          lh: 1,
        }),
        vtext(SQUARE, 'e3', 'subline', 25.2, 60, 55, 'EFFORTLESS STYLE. PERFECT FIT.', 1.8, {
          weight: 500,
          track: 0.34,
          color: '#5b3a25',
        }),
        shape('e4', 23.4, 11, 0.18, 36, '#5b3a25'),
        subject('e5', 35, 12, 32),
        shape('e6', 69, 8.4, 29.5, 33, '#e9dfd2', { radius: 2.4, op: 0.95 }),
        detailImage('e7', 70.4, 9.6, 26.7, 14.2, 1.4),
        text('e8', 'detail', 69, 25, 29.5, 'HIGH WAIST', 3.6, {
          font: 'serif',
          weight: 500,
          track: 0.09,
          color: '#2b1c12',
          align: 'center',
        }),
        line('e9', 78, 29.6, 11.5, 0.12, '#5b3a25'),
        text('e10', 'features', 69, 30.8, 29.5, 'Flattering Fit\nAll-Day Comfort', 2.4, {
          lh: 1.45,
          color: '#3a2a1e',
          align: 'center',
        }),
        text('e11', 'label', 79, 49, 20, 'COLORS', 2.1, {
          weight: 600,
          track: 0.12,
          color: '#3a2a1e',
        }),
        shape('e12', 79, 53.5, 4, 4, '#1f2a6b', { radius: 0.6 }),
        shape('e13', 84.4, 53.5, 4, 4, '#a9826a', { radius: 0.6 }),
        shape('e14', 89.8, 53.5, 4, 4, '#7b7873', { radius: 0.6 }),
        shape('e15', 95.2, 53.5, 4, 4, '#1a1a1a', { radius: 0.6 }),
        line('e16', 79, 61, 19.5, 0.12, '#5b3a25'),
        text('e17', 'label', 79, 64.5, 20, 'SIZES', 2.1, {
          weight: 600,
          track: 0.12,
          color: '#3a2a1e',
        }),
        ...chip(SQUARE, 'e18', 79, 68.5, 'XS', false),
        ...chip(SQUARE, 'e19', 84.2, 68.5, 'S', true),
        ...chip(SQUARE, 'e20', 89.4, 68.5, 'M', false),
        ...chip(SQUARE, 'e21', 94.6, 68.5, 'L', false),
      ],
    },
  },
  // "Big type poster" is on hold (user is going to rework it later), commented out
  // rather than deleted so its hand-made layout isn't lost in the meantime.
  /*
  {
    id: 'product-step-into-ease',
    title: 'Big type poster',
    pack: 'Product',
    ratio: '3:4',
    scene: false,
    model: 'flux2-klein',
    seed: 11,
    scenePrompt:
      'Smooth blue to lavender studio gradient backdrop with a glossy reflective floor, soft even light, no objects, no text, no logos.',
    subject: {
      name: 'sample-clog.svg',
      url: sampleUrl('sample-clog.svg'),
      ratio: 100 / 96,
      sample: true,
    },
    thumb: 'linear-gradient(172deg,#3f66b2,#e0c8ee)',
    bg: gradient('#3f66b2', '#e0c8ee', 175),
    source: {
      author: 'Strength04_X',
      url: 'https://x.com/Strength04_X/status/2047729312384901449',
    },
    els: [
      text('e1', 'headline', 14, 1, 72, 'STEP', 40, {
        font: 'cond',
        color: '#ffffff',
        op: 0.9,
        lh: 0.9,
      }),
      text('e2', 'headline2', 14, 29, 40, 'INTO', 17, {
        font: 'cond',
        color: '#ffffff',
        op: 0.9,
        lh: 0.9,
      }),
      text('e3', 'headline3', 14, 36, 72, 'EASE', 40, {
        font: 'cond',
        color: '#ffffff',
        op: 0.9,
        lh: 0.9,
      }),
      { ...subject('e4', 12, 27, 84), reflect: true },
      text(
        'e5',
        'footer',
        0,
        92.5,
        100,
        'Designed for all-day comfort.\nMade to move with you.',
        2.7,
        {
          color: '#ffffff',
          align: 'center',
          lh: 1.35,
        },
      ),
    ],
    variants: {
      '1:1': [
        text('e1', 'headline', 14, 1, 72, 'STEP', 30, {
          font: 'cond',
          color: '#ffffff',
          op: 0.9,
          lh: 0.9,
        }),
        text('e2', 'headline2', 14, 28, 40, 'INTO', 13, {
          font: 'cond',
          color: '#ffffff',
          op: 0.9,
          lh: 0.9,
        }),
        text('e3', 'headline3', 14, 38, 72, 'EASE', 30, {
          font: 'cond',
          color: '#ffffff',
          op: 0.9,
          lh: 0.9,
        }),
        { ...subject('e4', 20, 30, 64), reflect: true },
        text(
          'e5',
          'footer',
          0,
          93,
          100,
          'Designed for all-day comfort.\nMade to move with you.',
          2.4,
          {
            color: '#ffffff',
            align: 'center',
            lh: 1.35,
          },
        ),
      ],
    },
  },
  */
  // Avatar has its own rail tab now (auto-creates and selects one directly), not a
  // template card: this duplicated that entry point and confused the two (user).
  /* {
    id: 'avatar-pfp',
    title: 'Avatar',
    pack: 'Product',
    ratio: '1:1',
    scene: false,
    model: 'flux2-klein',
    seed: 1,
    scenePrompt: '',
    thumb: 'linear-gradient(135deg,#2b2140,#161a2e)',
    bg: { mode: 'solid', color: '#1c1c2a', from: '#1c1c2a', to: '#1c1c2a', angle: 180 },
    source: null,
    els: [{ id: 'e1', t: 'avatar', x: 31, y: 6, w: 38, config: defaultAvatarConfig(), vis: true }],
  }, */
];

const ROLE_MAPS: Record<string, Record<string, ICRole>> = {
  'product-catalog-page': CATALOG_ROLES,
  // 'product-step-into-ease': POSTER_ROLES, // template on hold, see RAW_PACK above.
};

const bindTemplate = (t: ICTemplate): ICTemplate => {
  const roles = ROLE_MAPS[t.id];
  if (!roles) return t;
  return {
    ...t,
    els: bindRoles(t.els, roles),
    variants:
      t.variants &&
      Object.fromEntries(
        Object.entries(t.variants).map(([ratio, els]) => [ratio, bindRoles(els, roles)]),
      ),
  };
};

export const PRODUCT_PACK: ICTemplate[] = RAW_PACK.map(bindTemplate);

/** Every template, in the order the pack picker lists the packs. */
export const ALL_TEMPLATES: ICTemplate[] = [...ANNOUNCE_PACK, ...COBRAND_PACK, ...PRODUCT_PACK];

export const TEMPLATE_PACKS = [...new Set(ALL_TEMPLATES.map((t) => t.pack))];

/** The same layout in another brand, within the same pack, for switching brand without losing it. */
export const siblingTemplate = (t: ICTemplate, brand: string): ICTemplate | undefined =>
  ALL_TEMPLATES.find((x) => x.pack === t.pack && x.family === t.family && x.brand === brand);

export function findTemplate(id: string): ICTemplate {
  return ALL_TEMPLATES.find((t) => t.id === id) ?? PRODUCT_PACK[0];
}

/** A brand new design starts genuinely empty (user), not the Catalog template
 *  pre-populated. "Blank" is a real, selectable template entry (`id: 'blank'`),
 *  so it needs no special-casing anywhere else: `findTemplate` resolves it for real. */
export function defaultLayout(): ICLayout {
  const blank = findTemplate('blank');
  return {
    v: 1,
    partnerV: 1,
    templateId: blank.id,
    ratio: blank.ratio,
    prompt: '',
    model: blank.model,
    seed: blank.seed,
    scene: { on: false, upload: null },
    bg: structuredClone(blank.bg),
    subject: SAMPLE_SUBJECT,
    els: [],
  };
}
