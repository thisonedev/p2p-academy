// Reusable pieces lifted from the announcement templates. Each one is added as a single group,
// drawn in the design's own colors, fonts and logo.

import { face, type LayerBuilder, PARTNER_LOGO } from './image-constructor-announce.js';
import type { BrandKit } from './image-constructor-brand-kit.js';
import type { ICFont } from './image-constructor-font-list.js';
import type { ICElement } from './image-constructor-layout.js';

export interface ICBlockStyle {
  heading: ICFont;
  body: ICFont;
  logo: { url: string; ratio: number } | null;
}

export interface ICBlock {
  id: string;
  name: string;
  /** Layers from the top-left corner, plus the block's width and height, all in percent of the canvas width. */
  build: (b: LayerBuilder, style: ICBlockStyle) => { els: ICElement[]; w: number; h: number };
}

export const blockStyle = (kit: BrandKit | undefined): ICBlockStyle => ({
  heading: kit?.fonts.heading ?? 'sans',
  body: kit?.fonts.body ?? 'sans',
  logo: kit?.logo ? { url: kit.logo, ratio: kit.logoRatio } : null,
});

export const BLOCKS: ICBlock[] = [
  {
    id: 'label-headline',
    name: 'Label and headline',
    build: (b, s) => ({
      els: [
        b.text('eyebrow', 0, 0, 70, 'Now live', 3.2, { font: s.body, weight: 600, tone: 'accent' }),
        b.text('headline', 0, 4.8, 70, 'Your headline\ngoes here', 7, {
          font: s.heading,
          weight: 700,
          track: -0.03,
          lh: 1.08,
        }),
      ],
      w: 70,
      h: 4.8 + 7 * 1.08 * 2,
    }),
  },
  {
    id: 'logo-lockup',
    name: 'Logo lockup',
    build: (b, s) => {
      const logo = s.logo ?? { url: PARTNER_LOGO, ratio: 3.6 };
      const lw = Math.min(24, 6 * logo.ratio);
      const lh = lw / logo.ratio;
      const pw = 20;
      const ph = pw / 3.6;
      const h = Math.max(lh, ph);
      return {
        els: [
          b.image('logo', 0, (h - lh) / 2, lw, logo.url, logo.ratio),
          b.text('x', lw + 1.6, h / 2 - 2.2, 4, '×', 4, {
            tone: 'muted',
            align: 'center',
            slot: undefined,
          }),
          b.image('partner_logo', lw + 7.2, (h - ph) / 2, pw, PARTNER_LOGO, 3.6),
        ],
        w: lw + 7.2 + pw,
        h,
      };
    },
  },
  {
    id: 'address-card',
    name: 'Address card',
    build: (b, s) => ({
      els: [
        b.rect(0, 0, 72, 16, 'card', { line: 'panel', radius: 3, sw: 0.35 }),
        b.text(
          'address',
          4,
          (16 - 4.4 * 2.7) / 2,
          64,
          '0x0000000000000000000\n000000000000000000000',
          4.4,
          {
            font: 'geist-mono',
            weight: 500,
            lh: 1.35,
          },
        ),
        b.text('note', 0, 18.5, 72, 'Check the address before you send.', 3.3, {
          font: s.body,
          tone: 'muted',
        }),
      ],
      w: 72,
      h: 18.5 + 3.3 * 1.1,
    }),
  },
  {
    id: 'photo-ring',
    name: 'Photo with ring',
    build: (b) => {
      const size = 24;
      const ring = size * 0.035;
      return {
        els: [
          { ...b.rect(0, 0, size + ring * 2, size + ring * 2, 'accent'), kind: 'ellipse' },
          b.photo('face', ring, ring, size, face('#e4e7eb', '#b8bec6'), size / 2),
        ],
        w: size + ring * 2,
        h: size + ring * 2,
      };
    },
  },
  {
    id: 'checklist',
    name: 'Checklist',
    build: (b, s) => {
      const lines = ['First thing we shipped', 'Second thing', 'Third thing', 'Fourth thing'];
      const size = 4.2;
      const gap = 7.4;
      const dot = size * 1.15;
      return {
        els: lines.flatMap((line, i) => [
          b.art('verified', 0, i * gap + (size * 1.2 - dot) / 2, dot),
          b.text(`line_${i + 1}`, dot + size * 0.6, i * gap, 60, line, size, {
            font: s.body,
            weight: 500,
            lh: 1.2,
            role: 'line',
          }),
        ]),
        w: 66,
        h: (lines.length - 1) * gap + size * 1.2,
      };
    },
  },
  {
    id: 'big-stat',
    name: 'Big stat',
    build: (b, s) => ({
      els: [
        b.text('number', 0, 0, 60, '$1.2B', 20, {
          font: s.heading,
          weight: 800,
          track: -0.05,
          lh: 1,
          tone: 'accent',
        }),
        b.text('label', 0, 22, 50, 'what the number\nmeasures', 4.6, {
          font: s.body,
          weight: 500,
          lh: 1.3,
        }),
      ],
      w: 60,
      h: 22 + 4.6 * 1.3 * 2,
    }),
  },
  {
    id: 'tag-row',
    name: 'Tag row',
    build: (b, s) => {
      const size = 3.3;
      const h = 7.6;
      const widths = [20, 14, 14];
      const words = ['Mainnet', 'v2.0', 'Beta'];
      let x = 0;
      const els = words.map((word, i) => {
        const pill = b.pill('tag', x, 0, widths[i], h, word, size, i === 0 ? 'solid' : 'outline', {
          font: s.body,
        });
        x += widths[i] + 1.6;
        return pill;
      });
      return { els, w: x - 1.6, h };
    },
  },
];

export const findBlock = (id: string) => BLOCKS.find((block) => block.id === id);

/** One layer of a block scaled around the block's corner and moved, for a preview that fits its tile.
 *  `x` offsets are percent of the width, `y` offsets percent of the height. */
export function fitBlockLayer(e: ICElement, scale: number, dx: number, dy: number): ICElement {
  const moved = { ...e, x: e.x * scale + dx, y: e.y * scale + dy };
  if ('w' in moved) moved.w *= scale;
  if ('h' in moved && typeof moved.h === 'number') moved.h *= scale;
  if ('size' in moved) moved.size *= scale;
  if ('radius' in moved && typeof moved.radius === 'number') moved.radius *= scale;
  if ('sw' in moved) moved.sw *= scale;
  if ('th' in moved) moved.th *= scale;
  return moved;
}
