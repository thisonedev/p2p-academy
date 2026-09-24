// Web3 and AI shapes. Every piece has two slots: `main` takes the accent,
// `detail` the accent faded toward the background.

import type { ICArtDef, ICArtSlot } from './image-constructor-art.js';

export const WEB3_GROUPS = ['Blockchain', 'Tokens', 'Security', 'AI', 'Decor'] as const;
export type ICArtGroup = (typeof WEB3_GROUPS)[number];

const M = '{{main}}';
const D = '{{detail}}';
const fm = `fill="${M}"`;
const fd = `fill="${D}"`;
const sm = `fill="none" stroke="${M}"`;
const sd = `fill="none" stroke="${D}"`;
const round = 'stroke-linecap="round" stroke-linejoin="round"';

const SLOTS: ICArtSlot[] = [
  { key: 'main', label: 'Main', role: 'accent', color: '#6366f1' },
  { key: 'detail', label: 'Detail', role: 'accent', tint: 0.55, color: '#b3b5f8' },
];

const circles = (list: number[][], fill: string) =>
  list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${fill}/>`).join('');

function badge(): string {
  const pts = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 17.5 : 21;
    return `${i ? 'L' : 'M'}${(24 + r * Math.cos(a)).toFixed(1)} ${(24 + r * Math.sin(a)).toFixed(1)}`;
  });
  return `<path d="${pts.join('')}Z" ${fm}/><path d="m16 24 6 6 10-11" ${sd} stroke-width="4" ${round}/>`;
}

function neural(): string {
  const layers: [number, number[]][] = [
    [8, [12, 24, 36]],
    [24, [8, 19, 29, 40]],
    [40, [18, 30]],
  ];
  let d = '';
  for (let k = 0; k < 2; k++) {
    for (const y1 of layers[k][1])
      for (const y2 of layers[k + 1][1]) d += `M${layers[k][0]} ${y1}L${layers[k + 1][0]} ${y2}`;
  }
  const dots = layers.flatMap(([x, ys]) => ys.map((y) => [x, y, 3.6]));
  return `<path d="${d}" ${sd} stroke-width="1.3"/>${circles(dots, fm)}`;
}

function globe(): string {
  let out = '';
  for (let y = 6; y <= 42; y += 4.5) {
    for (let x = 6; x <= 42; x += 4.5) {
      const dist = Math.hypot(x - 24, y - 24);
      if (dist > 19.5) continue;
      out += `<circle cx="${x}" cy="${y}" r="${dist > 15 ? 1.1 : 1.6}" ${(x * 7 + y * 3) % 5 < 1.2 ? fd : fm}/>`;
    }
  }
  return out;
}

function dotGrid(): string {
  const big = new Set([7, 14, 22, 29]);
  return Array.from({ length: 36 }, (_, i) => {
    const on = big.has(i);
    return `<circle cx="${6.5 + (i % 6) * 7}" cy="${6.5 + Math.floor(i / 6) * 7}" r="${on ? 2.6 : 1.6}" ${on ? fd : fm}/>`;
  }).join('');
}

const HASH = '1011001110010111010110011';

const BODIES: [string, string, ICArtGroup, string][] = [
  [
    'cube',
    'Block',
    'Blockchain',
    `<path d="M24 6 40 15 24 24 8 15Z" ${fd}/><path d="M8 15 24 24v18L8 33Z" ${fm}/><path d="M40 15 24 24v18l16-9Z" ${fm} opacity=".72"/>`,
  ],
  [
    'chain',
    'Chain link',
    'Blockchain',
    `<rect x="4" y="17" width="23" height="14" rx="7" ${sm} stroke-width="4"/><rect x="21" y="17" width="23" height="14" rx="7" ${sd} stroke-width="4"/>`,
  ],
  [
    'hexagon',
    'Hexagon',
    'Blockchain',
    `<path d="M24 4 41 14v20L24 44 7 34V14Z" ${sm} stroke-width="3"/><path d="M24 14 32.7 19v10L24 34l-8.7-5V19Z" ${fd}/>`,
  ],
  [
    'blocks',
    'Blocks',
    'Blockchain',
    `<path d="M15 24h3M30 24h3" ${sd} stroke-width="3"/><rect x="3" y="18" width="12" height="12" rx="2" ${fm}/><rect x="18" y="18" width="12" height="12" rx="2" ${fm}/><rect x="33" y="18" width="12" height="12" rx="2" ${fd}/>`,
  ],
  [
    'merkle',
    'Merkle tree',
    'Blockchain',
    `<path d="M24 10 12 24M24 10l12 14M12 24 6 38M12 24l6 14M36 24l-6 14M36 24l6 14" ${sd} stroke-width="2"/>${circles(
      [
        [24, 10, 5],
        [12, 24, 4],
        [36, 24, 4],
      ],
      fm,
    )}${circles(
      [
        [6, 38, 3.5],
        [18, 38, 3.5],
        [30, 38, 3.5],
        [42, 38, 3.5],
      ],
      fd,
    )}`,
  ],
  [
    'network',
    'Network',
    'Blockchain',
    `<path d="M10 12 24 24 38 10M24 24 8 36M24 24l16 12M24 24l2 18M10 12l-2 24M38 10l2 26" ${sd} stroke-width="2"/>${circles(
      [
        [10, 12, 4],
        [38, 10, 4],
        [8, 36, 4],
        [40, 36, 4],
        [26, 42, 3.5],
        [24, 24, 6],
      ],
      fm,
    )}`,
  ],
  [
    'hash',
    'Hash grid',
    'Blockchain',
    [...HASH]
      .map(
        (b, i) =>
          `<rect x="${(4 + (i % 5) * 8.2).toFixed(1)}" y="${(4 + Math.floor(i / 5) * 8.2).toFixed(1)}" width="7" height="7" rx="1.2" ${b === '1' ? fm : fd}/>`,
      )
      .join(''),
  ],
  [
    'coin',
    'Coin',
    'Tokens',
    `<circle cx="24" cy="24" r="20" ${fm}/><circle cx="24" cy="24" r="15" ${sd} stroke-width="2"/><path d="M24 14l7 10-7 10-7-10Z" ${fd}/>`,
  ],
  [
    'coin-stack',
    'Coin stack',
    'Tokens',
    [34, 26, 18]
      .map(
        (y) =>
          `<path d="M8 ${y}v6a16 5 0 0 0 32 0v-6Z" ${fm}/><ellipse cx="24" cy="${y}" rx="16" ry="5" ${fd}/>`,
      )
      .join(''),
  ],
  [
    'token-orbit',
    'Token orbit',
    'Tokens',
    `<ellipse cx="24" cy="24" rx="21" ry="8" ${sd} stroke-width="2.5" transform="rotate(-25 24 24)"/>${circles(
      [
        [24, 24, 11],
        [42, 15.5, 3],
      ],
      fm,
    )}`,
  ],
  [
    'wallet',
    'Wallet',
    'Tokens',
    `<path d="M9 12 34 5l3 7Z" ${fd}/><rect x="5" y="12" width="38" height="28" rx="5" ${fm}/><rect x="30" y="21" width="13" height="10" rx="3" ${fd}/><circle cx="35" cy="26" r="2" ${fm}/>`,
  ],
  [
    'candles',
    'Candlesticks',
    'Tokens',
    (
      [
        [8, 26, 12, true],
        [18, 18, 14, false],
        [28, 22, 8, true],
        [38, 10, 16, true],
      ] as const
    )
      .map(
        ([x, y, h, up]) =>
          `<path d="M${x} ${y - 5}v${h + 10}" ${up ? sm : sd} stroke-width="2"/><rect x="${x - 3.5}" y="${y}" width="7" height="${h}" rx="1" ${up ? fm : fd}/>`,
      )
      .join(''),
  ],
  [
    'chart-up',
    'Rising chart',
    'Tokens',
    `<path d="M4 44h40" ${sd} stroke-width="2"/><path d="M5 36 17 24l8 7 14-16" ${sm} stroke-width="4" ${round}/><path d="M44 9v12L32 9Z" ${fm}/>`,
  ],
  [
    'donut',
    'Donut',
    'Tokens',
    `<circle cx="24" cy="24" r="16" ${sd} stroke-width="8"/><circle cx="24" cy="24" r="16" ${sm} stroke-width="8" stroke-dasharray="70 101" transform="rotate(-90 24 24)"/>`,
  ],
  [
    'bars',
    'Bars',
    'Tokens',
    [
      [5, 30],
      [15, 22],
      [25, 26],
      [35, 12],
    ]
      .map(
        ([x, y], i) =>
          `<rect x="${x}" y="${y}" width="8" height="${42 - y}" rx="1.5" ${i === 3 ? fm : fd}/>`,
      )
      .join(''),
  ],
  [
    'shield',
    'Shield',
    'Security',
    `<path d="M24 4 40 10v12c0 11-7 18-16 22C15 40 8 33 8 22V10Z" ${fm}/><path d="m16 24 6 6 11-12" ${sd} stroke-width="4" ${round}/>`,
  ],
  [
    'lock',
    'Lock',
    'Security',
    `<path d="M15 22v-6a9 9 0 0 1 18 0v6" ${sm} stroke-width="4"/><rect x="9" y="21" width="30" height="22" rx="4" ${fm}/><circle cx="24" cy="30" r="3" ${fd}/><rect x="22.5" y="30" width="3" height="7" rx="1" ${fd}/>`,
  ],
  [
    'key',
    'Key',
    'Security',
    `<circle cx="15" cy="24" r="8" ${sm} stroke-width="4"/><circle cx="15" cy="24" r="3" ${fd}/><path d="M23 24h20M37 24v7M43 24v5" ${sm} stroke-width="4" stroke-linecap="round"/>`,
  ],
  [
    'fingerprint',
    'Fingerprint',
    'Security',
    `<g stroke-width="2.6" stroke-linecap="round"><path d="M6 22c3-8 10-13 18-13s15 5 18 13" ${sd}/><path d="M12 32c0-9 5-15 12-15s12 6 12 15" ${sm}/><path d="M17 38c-1-3-1-6-1-9 0-5 4-8 8-8s8 3 8 8c0 4 0 8-2 12" ${sm}/><path d="M24 29c0 5 0 9-3 13" ${sd}/></g>`,
  ],
  ['verified', 'Verified badge', 'Security', badge()],
  [
    'sparkle',
    'Sparkle',
    'AI',
    `<path d="M22 4c1.5 9 6 13.5 15 15-9 1.5-13.5 6-15 15-1.5-9-6-13.5-15-15 9-1.5 13.5-6 15-15Z" ${fm}/><path d="M38 30c.7 4 2.6 6 6.6 6.6-4 .7-5.9 2.6-6.6 6.6-.7-4-2.6-5.9-6.6-6.6 4-.6 5.9-2.6 6.6-6.6Z" ${fd}/>`,
  ],
  ['neural-net', 'Neural net', 'AI', neural()],
  [
    'chip',
    'Chip',
    'AI',
    `<path d="${[15.5, 21.2, 26.8, 32.5].map((p) => `M${p} 5v7M${p} 36v7M5 ${p}h7M36 ${p}h7`).join('')}" ${sm} stroke-width="2.5" stroke-linecap="round"/><rect x="12" y="12" width="24" height="24" rx="3" ${fm}/><rect x="18" y="18" width="12" height="12" rx="1.5" ${fd}/>`,
  ],
  [
    'circuit',
    'Circuit',
    'AI',
    `<path d="M4 12h14l6 6v10M44 16H34l-6 6M4 36h10l6-6M44 34H30" ${sm} stroke-width="2.5" stroke-linejoin="round"/>${circles(
      [
        [24, 30, 3],
        [28, 22, 3],
        [20, 30, 3],
        [30, 34, 3],
        [4, 12, 3],
        [44, 16, 3],
        [4, 36, 3],
        [44, 34, 3],
      ],
      fd,
    )}`,
  ],
  [
    'waveform',
    'Waveform',
    'AI',
    [6, 14, 24, 34, 20, 30, 12, 22, 8]
      .map(
        (h, i) =>
          `<rect x="${3 + i * 5}" y="${24 - h / 2}" width="3" height="${h}" rx="1.5" ${i === 3 ? fd : fm}/>`,
      )
      .join(''),
  ],
  [
    'chat',
    'Chat',
    'AI',
    `<path d="M6 10a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H20l-9 8v-8h-1a4 4 0 0 1-4-4Z" ${fm}/>${circles(
      [
        [16, 20, 2.6],
        [24, 20, 2.6],
        [32, 20, 2.6],
      ],
      fd,
    )}`,
  ],
  [
    'atom',
    'Atom',
    'AI',
    `${[0, 60, 120].map((r) => `<ellipse cx="24" cy="24" rx="20" ry="7.5" ${sm} stroke-width="2.4" transform="rotate(${r} 24 24)"/>`).join('')}<circle cx="24" cy="24" r="4.5" ${fd}/>`,
  ],
  [
    'prompt',
    'Prompt',
    'AI',
    `<rect x="4" y="9" width="40" height="30" rx="4" ${fm}/><path d="m12 19 6 5-6 5" ${sd} stroke-width="3.2" ${round}/><rect x="22" y="28" width="12" height="3" rx="1" ${fd}/>`,
  ],
  ['dot-globe', 'Dot globe', 'Decor', globe()],
  ['dot-grid', 'Dot grid', 'Decor', dotGrid()],
  [
    'rings',
    'Rings',
    'Decor',
    `${[18, 12, 6].map((r, i) => `<circle cx="24" cy="24" r="${r}" ${sm} stroke-width="2" opacity="${0.35 + i * 0.3}"/>`).join('')}<circle cx="36.7" cy="11.3" r="3.4" ${fd}/>`,
  ],
  [
    'orb',
    'Orb',
    'Decor',
    `${[
      [21, 0.14],
      [16, 0.28],
      [11, 0.5],
    ]
      .map(([r, o]) => `<circle cx="24" cy="24" r="${r}" ${fm} opacity="${o}"/>`)
      .join('')}<circle cx="24" cy="24" r="6" ${fd}/>`,
  ],
  [
    'braces',
    'Braces',
    'Decor',
    `<g stroke-width="3.4" ${round}><path d="M18 6c-5 0-6 3-6 8s-2 10-7 10c5 0 7 5 7 10s1 8 6 8" ${sm}/><path d="M30 6c5 0 6 3 6 8s2 10 7 10c-5 0-7 5-7 10s-1 8-6 8" ${sd}/></g>`,
  ],
  [
    'pixels',
    'Pixel steps',
    'Decor',
    [
      [4, 36],
      [12, 36],
      [20, 36],
      [28, 36],
      [36, 36],
      [12, 28],
      [20, 28],
      [28, 28],
      [36, 28],
      [20, 20],
      [28, 20],
      [36, 20],
      [28, 12],
      [36, 12],
      [36, 4],
    ]
      .map(([x, y], i) => `<rect x="${x}" y="${y}" width="7" height="7" ${i % 4 === 0 ? fd : fm}/>`)
      .join(''),
  ],
  [
    'waves',
    'Waves',
    'Decor',
    [14, 24, 34]
      .map(
        (y, i) =>
          `<path d="M3 ${y}q5.25-7 10.5 0t10.5 0 10.5 0 10.5 0" ${i === 1 ? sd : sm} stroke-width="3" stroke-linecap="round"/>`,
      )
      .join(''),
  ],
  [
    'grid',
    'Grid',
    'Decor',
    `<path d="${[8, 16, 24, 32, 40].map((p) => `M${p} 4v40M4 ${p}h40`).join('')}" ${sd} stroke-width="1"/><rect x="4" y="4" width="40" height="40" ${sm} stroke-width="2"/>`,
  ],
];

/** Full-bleed grid lines, one per canvas shape, so a background grid stays a single layer. */
function gridLines(id: string, name: string, w: number, h: number): ICArtDef {
  let d = '';
  for (let x = 20; x < w; x += 20) d += `M${x} 0v${h}`;
  for (let y = 20; y < h; y += 20) d += `M0 ${y}h${w}`;
  return {
    id,
    name,
    kind: 'shape',
    group: 'Decor',
    ratio: w / h,
    viewBox: `0 0 ${w} ${h}`,
    body: `<path d="${d}" ${sd} stroke-width=".35" opacity=".45"/>`,
    slots: SLOTS,
  };
}

/** Corner brackets inset from the canvas edge, sized like `gridLines`. */
function cornerTicks(id: string, name: string, w: number, h: number): ICArtDef {
  const i = 6.4;
  const l = 7;
  const d =
    `M${i} ${i + l}V${i}H${i + l}M${w - i - l} ${i}H${w - i}V${i + l}` +
    `M${w - i} ${h - i - l}V${h - i}H${w - i - l}M${i + l} ${h - i}H${i}V${h - i - l}`;
  return {
    id,
    name,
    kind: 'shape',
    group: 'Decor',
    ratio: w / h,
    viewBox: `0 0 ${w} ${h}`,
    body: `<path d="${d}" ${sm} stroke-width=".9"/>`,
    slots: SLOTS,
  };
}

export const WEB3_SHAPES: ICArtDef[] = [
  ...BODIES.map(
    ([id, name, group, body]): ICArtDef => ({
      id,
      name,
      kind: 'shape',
      group,
      ratio: 1,
      viewBox: '0 0 48 48',
      body,
      slots: SLOTS,
    }),
  ),
  gridLines('grid-lines-wide', 'Grid lines, wide', 160, 90),
  gridLines('grid-lines', 'Grid lines', 160, 160),
  gridLines('grid-lines-tall', 'Grid lines, tall', 160, 284.4),
  cornerTicks('corner-ticks-wide', 'Corner ticks, wide', 160, 90),
  cornerTicks('corner-ticks', 'Corner ticks', 160, 160),
  cornerTicks('corner-ticks-tall', 'Corner ticks, tall', 160, 284.4),
];

const FRAME = /^(grid-lines|corner-ticks)(-wide|-tall)?$/;

/** A full-canvas grid or tick frame. The studio treats it as background, not a layer to drag. */
export const isFrameArt = (id: string): boolean => FRAME.test(id);

/** The picker lists one tile per frame; the wide and tall cuts are picked to match the canvas. */
export const isFrameVariant = (id: string): boolean => /-(wide|tall)$/.test(id) && isFrameArt(id);

export function frameFor(id: string, shape: 'landscape' | 'square' | 'portrait'): string {
  const base = id.replace(/-(wide|tall)$/, '');
  return shape === 'landscape' ? `${base}-wide` : shape === 'portrait' ? `${base}-tall` : base;
}
