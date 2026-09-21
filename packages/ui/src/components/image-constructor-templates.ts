import {
  type ICLine,
  type ICPill,
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

const pill = (
  id: string,
  role: string,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  size: number,
  o: Partial<ICPill> = {},
): ICPill => ({
  id,
  t: 'pill',
  role,
  x,
  y,
  w,
  h,
  text: value,
  size,
  weight: 600,
  font: 'sans',
  color: '#ffffff',
  fill: '',
  stroke: '',
  track: 0,
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

// Scene prompts ask for empty space and no lettering, so the model never paints words.
export const PRODUCT_PACK: ICTemplate[] = [
  {
    id: 'product-minimal-ad',
    title: 'Minimal ad',
    pack: 'Product',
    model: 'flux2-klein',
    seed: 42,
    scenePrompt:
      'Minimalist warm studio scene, textured beige plaster wall, soft directional sunlight casting long soft shadows across a simple light wooden tabletop, the center of the table left empty for a product, a small dried grass stem in a ceramic vase at the far left edge, calm empty space above, photorealistic, no text, no logos.',
    thumb: 'linear-gradient(160deg,#d9b99a,#8a6a4c)',
    bg: gradient('#d9b99a', '#8a6a4c', 160),
    source: { author: 'azed_ai', url: 'https://x.com/azed_ai/status/2027021107015143498' },
    els: [
      text('e1', 'eyebrow', 8, 7, 50, 'NEW ARRIVAL', 2.8, {
        weight: 600,
        track: 0.32,
        color: '#7a6250',
      }),
      line('e2', 8, 12.5, 9, 0.45, '#7a6250'),
      text('e3', 'headline', 8, 15, 52, 'Glow\nSerum', 13, {
        weight: 600,
        lh: 0.95,
        font: 'serif',
        color: '#3a2a1c',
      }),
      text('e4', 'subline', 8, 43, 34, 'Vitamin C brightening\nserum, 30 ml', 3.2, {
        lh: 1.35,
        color: '#6a5644',
      }),
      subject('e5', 58, 37, 24),
      pill('e6', 'cta', 8, 80, 29, 8.5, 'Shop now  →', 3, { fill: '#3a2a1c' }),
      text('e7', 'price', 64, 82, 30, '$29', 8, {
        weight: 600,
        font: 'serif',
        color: '#3a2a1c',
        align: 'right',
      }),
    ],
  },
  {
    id: 'product-centered-card',
    title: 'Centered product card',
    pack: 'Product',
    model: 'flux2-klein',
    seed: 7,
    scenePrompt:
      'Direct top-down photograph of an empty textured stone surface that looks gently disturbed as if something was just placed and lifted, a few small scattered props only near the edges, bare empty center, soft even daylight, high-end editorial style, wide clean margins, no text, no logos.',
    thumb: 'linear-gradient(160deg,#a39a8e,#6f675c)',
    bg: gradient('#a39a8e', '#6f675c', 160),
    source: { author: 'Kerroudjm', url: 'https://x.com/Kerroudjm/status/2008559850968473671' },
    els: [
      text('e1', 'brand', 0, 6, 100, 'LUMEN', 3.4, {
        weight: 700,
        track: 0.55,
        color: '#1c1c1c',
        align: 'center',
      }),
      text('e2', 'headline', 0, 12, 100, 'Glow Serum', 9.5, {
        weight: 600,
        font: 'serif',
        color: '#1c1c1c',
        align: 'center',
      }),
      subject('e3', 38, 30, 24),
      pill('e4', 'feature', 12, 77, 24, 7, 'Vitamin C', 2.7, {
        stroke: '#1c1c1c',
        color: '#1c1c1c',
      }),
      pill('e5', 'feature', 38, 77, 24, 7, 'Hyaluronic', 2.7, {
        stroke: '#1c1c1c',
        color: '#1c1c1c',
      }),
      pill('e6', 'feature', 64, 77, 24, 7, '30 ml', 2.7, { stroke: '#1c1c1c', color: '#1c1c1c' }),
      text('e7', 'footer', 0, 90, 100, 'FREE SHIPPING OVER $40', 2.5, {
        weight: 600,
        track: 0.25,
        color: '#333333',
        align: 'center',
      }),
    ],
  },
  {
    id: 'product-studio-hero',
    title: 'Studio hero',
    pack: 'Product',
    model: 'flux2-klein',
    seed: 21,
    scenePrompt:
      'Premium studio product photography backdrop: a smooth dark blue studio wall with a soft gradient and a glossy reflective floor, soft rim light from the left, shallow depth of field, clean empty space above and below the center, no objects, no text, no logos.',
    thumb: 'linear-gradient(160deg,#20304a,#0b1220)',
    bg: gradient('#20304a', '#0b1220', 160),
    source: null,
    els: [
      text('e1', 'headline', 8, 6, 84, 'Glow Serum', 11, { weight: 800, color: '#ffffff' }),
      text('e2', 'subline', 8, 19, 60, 'Vitamin C · 30 ml', 3.6, { weight: 500, color: '#dfe6ee' }),
      subject('e3', 33, 26, 34),
      pill('e4', 'badge', 8, 84, 26, 7, '-30% today', 3.4, {
        weight: 800,
        fill: '#34d399',
        color: '#111111',
      }),
      text('e5', 'price', 66, 81, 26, '$29', 8, { weight: 800, color: '#ffffff', align: 'right' }),
    ],
  },
  {
    id: 'product-split-promo',
    title: 'Split promo',
    pack: 'Product',
    model: 'flux2-klein',
    seed: 33,
    scenePrompt:
      'Smooth purple to deep violet studio gradient backdrop with a soft light bloom on the right side, the left side left completely empty, subtle glossy floor reflection, no objects, no text, no logos.',
    thumb: 'linear-gradient(120deg,#3b1f4a,#14101f)',
    bg: gradient('#3b1f4a', '#14101f', 120),
    source: null,
    els: [
      subject('e1', 58, 16, 30),
      text('e2', 'headline', 7, 28, 48, 'Glow\nSerum', 12, {
        weight: 800,
        lh: 0.95,
        color: '#ffffff',
      }),
      text('e3', 'subline', 7, 58, 40, 'Vitamin C · 30 ml', 3.4, { color: '#e6dcf0' }),
      pill('e4', 'badge', 7, 70, 26, 7, '-30% today', 3.4, {
        weight: 800,
        fill: '#fbbf24',
        color: '#1a1024',
      }),
      text('e5', 'price', 7, 81, 30, '$29', 8, { weight: 800, color: '#ffffff' }),
    ],
  },
  {
    id: 'product-sale-poster',
    title: 'Sale poster',
    pack: 'Product',
    model: 'flux2-klein',
    seed: 58,
    scenePrompt:
      'Deep emerald green studio backdrop with a glossy reflective floor and soft warm highlights, calm empty corners, no objects, no text, no logos.',
    thumb: 'linear-gradient(200deg,#1d4a3a,#0a1a14)',
    bg: gradient('#1d4a3a', '#0a1a14', 200),
    source: null,
    els: [
      text('e1', 'headline', 7, 4, 60, 'SALE', 22, { font: 'cond', track: 0.04, color: '#ffffff' }),
      text('e2', 'subline', 7, 26, 60, 'UP TO 30% OFF', 4, {
        weight: 700,
        track: 0.2,
        color: '#b8f5d8',
      }),
      subject('e3', 28, 34, 44),
      pill('e4', 'badge', 66, 6, 28, 9, '-30%', 4.6, {
        weight: 800,
        fill: '#fbbf24',
        color: '#111111',
      }),
      text('e5', 'price', 7, 86, 30, '$29', 8, { weight: 800, color: '#ffffff' }),
      pill('e6', 'cta', 64, 85, 28, 8, 'Shop now', 3.2, { fill: '#ffffff', color: '#0a1a14' }),
    ],
  },
];

export function findTemplate(id: string): ICTemplate {
  return PRODUCT_PACK.find((t) => t.id === id) ?? PRODUCT_PACK[0];
}

export function defaultLayout() {
  return layoutFromTemplate(PRODUCT_PACK[0]);
}
