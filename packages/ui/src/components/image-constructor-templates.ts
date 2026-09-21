import {
  type ICElement,
  type ICImage,
  type ICLine,
  type ICShape,
  type ICSubject,
  type ICTemplate,
  type ICText,
  layoutFromTemplate,
} from './image-constructor-layout.js';

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

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const CLOG_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="96" viewBox="0 20 100 96">' +
  '<path d="M12 108 Q10 90 26 88 Q36 60 52 62 Q76 62 88 84 Q94 96 86 106 Q60 114 30 112 Q16 112 12 108Z" fill="#e8dfcf"/>' +
  '<circle cx="34" cy="95" r="4.2" fill="#d9cfbd"/><g fill="#cfc4b0"><circle cx="58" cy="76" r="2"/><circle cx="66" cy="79" r="2"/><circle cx="73" cy="83" r="2"/><circle cx="62" cy="84" r="2"/></g>' +
  '<rect x="40" y="46" width="14" height="46" rx="6" fill="#f1e9da" transform="rotate(-6 47 70)"/>' +
  '<rect x="38" y="30" width="20" height="26" rx="8" fill="#f3ecdd"/><circle cx="46" cy="24" r="5.5" fill="#c99a7a"/>' +
  '<ellipse cx="44" cy="108" rx="8" ry="3" fill="#e8dfcf"/></svg>';

const TROUSERS_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="100" viewBox="0 0 50 100">' +
  '<circle cx="25" cy="7" r="4" fill="#8a5d45"/><path d="M15 13 Q25 10 35 13 L37 34 L13 34Z" fill="#efe3cf"/>' +
  '<path d="M14 32 L36 32 L42 92 L27 92 L25 56 L23 92 L8 92Z" fill="#a4623d"/>' +
  '<path d="M25 33 l8 5 l-4 12 l-4 -5z M25 33 l-8 5 l3 11z" fill="#8f532f"/>' +
  '<ellipse cx="30" cy="94" rx="5" ry="2" fill="#e6d4be"/></svg>';

const FABRIC_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="135" viewBox="0 0 200 135">' +
  '<defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9c5a36"/><stop offset="1" stop-color="#b8754a"/></linearGradient></defs>' +
  '<rect width="200" height="135" fill="url(#f)"/><g stroke="#7d4525" stroke-opacity=".5" stroke-width="3"><path d="M40 0v135M80 0v135M120 0v135M160 0v135"/></g>' +
  '<path d="M110 30 q40 -18 70 0 q-30 8 -40 30 q-4 -20 -30 -30z" fill="#8f532f"/></svg>';

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
  url: svgUrl(FABRIC_SVG),
  ratio: 1.48,
  x,
  y,
  w,
  h,
  radius,
  vis: true,
});

// Scene prompts ask for empty space and no lettering, so the model never paints words.
export const PRODUCT_PACK: ICTemplate[] = [
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
    subject: { name: 'sample-trousers.svg', url: svgUrl(TROUSERS_SVG), ratio: 0.5, sample: true },
    thumb: 'linear-gradient(180deg,#cdc0b0,#d9cebf)',
    bg: gradient('#cdc0b0', '#d9cebf', 180),
    source: { author: '', url: 'https://www.meigen.ai/prompt/2049403600594747482' },
    els: [
      shape('e1', 0, 0, 33.5, 92, '#e8ded1'),
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
        shape('e1', 0, 0, 33.5, 92, '#e8ded1'),
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
    subject: { name: 'sample-clog.svg', url: svgUrl(CLOG_SVG), ratio: 100 / 96, sample: true },
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
];

export function findTemplate(id: string): ICTemplate {
  return PRODUCT_PACK.find((t) => t.id === id) ?? PRODUCT_PACK[0];
}

export function defaultLayout() {
  return layoutFromTemplate(PRODUCT_PACK[0]);
}
