// Web3 and AI shapes. Every piece has two slots: `main` takes the accent,
// `detail` the accent faded toward the background.

import type { ICArtDef, ICArtSlot } from './image-constructor-art.js';

export const WEB3_GROUPS = [
  'Web3',
  'Data & AI',
  'Accents',
  'Backgrounds',
  'Devices',
  'Charts',
] as const;
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
    'Web3',
    `<path d="M24 6 40 15 24 24 8 15Z" ${fd}/><path d="M8 15 24 24v18L8 33Z" ${fm}/><path d="M40 15 24 24v18l16-9Z" ${fm} opacity=".72"/>`,
  ],
  [
    'chain',
    'Chain link',
    'Web3',
    `<rect x="4" y="17" width="23" height="14" rx="7" ${sm} stroke-width="4"/><rect x="21" y="17" width="23" height="14" rx="7" ${sd} stroke-width="4"/>`,
  ],
  [
    'hexagon',
    'Hexagon',
    'Web3',
    `<path d="M24 4 41 14v20L24 44 7 34V14Z" ${sm} stroke-width="3"/><path d="M24 14 32.7 19v10L24 34l-8.7-5V19Z" ${fd}/>`,
  ],
  [
    'blocks',
    'Blocks',
    'Web3',
    `<path d="M15 24h3M30 24h3" ${sd} stroke-width="3"/><rect x="3" y="18" width="12" height="12" rx="2" ${fm}/><rect x="18" y="18" width="12" height="12" rx="2" ${fm}/><rect x="33" y="18" width="12" height="12" rx="2" ${fd}/>`,
  ],
  [
    'merkle',
    'Merkle tree',
    'Web3',
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
    'Web3',
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
    'Web3',
    [...HASH]
      .map(
        (b, i) =>
          `<rect x="${(4 + (i % 5) * 8.2).toFixed(1)}" y="${(4 + Math.floor(i / 5) * 8.2).toFixed(1)}" width="7" height="7" rx="1.2" ${b === '1' ? fm : fd}/>`,
      )
      .join(''),
  ],
  [
    'coin',
    'Ethereum',
    'Web3',
    `<circle cx="24" cy="24" r="20" ${fm}/><path d="M24 8.5 33 23.6 24 29 15 23.6Z" ${fd}/><path d="M24 30.8 33 25.4 24 38.5 15 25.4Z" ${fd} opacity=".75"/>`,
  ],
  [
    'bitcoin',
    'Bitcoin',
    'Web3',
    `<circle cx="24" cy="24" r="20" ${fm}/><g transform="translate(-1.1 0)" ${sd} stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 14.5h6.2a4.6 4.6 0 0 1 0 9.2h-6.2ZM19.5 23.7h7.3a4.9 4.9 0 0 1 0 9.8h-7.3ZM19.5 14.5v19" stroke-width="3.2"/><path d="M22 11v3.5M26 11v3.5M22 33.5V37M26 33.5V37" stroke-width="2.4"/></g>`,
  ],
  [
    'tether-coin',
    'Tether (USDT)',
    'Web3',
    `<circle cx="24" cy="24" r="20" ${fm}/><rect x="14.5" y="13.5" width="19" height="4.6" rx=".6" ${fd}/><rect x="21.6" y="17.5" width="4.8" height="17.5" rx=".6" ${fd}/><ellipse cx="24" cy="23" rx="10" ry="3.2" ${sd} stroke-width="2"/>`,
  ],
  [
    'coin-stack',
    'Coin stack',
    'Web3',
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
    'Web3',
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
    'Web3',
    `<path d="M9 12 34 5l3 7Z" ${fd}/><rect x="5" y="12" width="38" height="28" rx="5" ${fm}/><rect x="30" y="21" width="13" height="10" rx="3" ${fd}/><circle cx="35" cy="26" r="2" ${fm}/>`,
  ],
  [
    'candles',
    'Candlesticks',
    'Web3',
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
    'Web3',
    `<path d="M4 44h40" ${sd} stroke-width="2"/><path d="M5 36 17 24l8 7 14-16" ${sm} stroke-width="4" ${round}/><path d="M44 9v12L32 9Z" ${fm}/>`,
  ],
  [
    'donut',
    'Donut',
    'Web3',
    `<circle cx="24" cy="24" r="16" ${sd} stroke-width="8"/><circle cx="24" cy="24" r="16" ${sm} stroke-width="8" stroke-dasharray="70 101" transform="rotate(-90 24 24)"/>`,
  ],
  [
    'bars',
    'Bars',
    'Web3',
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
    'Data & AI',
    `<path d="M24 4 40 10v12c0 11-7 18-16 22C15 40 8 33 8 22V10Z" ${fm}/><path d="m16 24 6 6 11-12" ${sd} stroke-width="4" ${round}/>`,
  ],
  [
    'lock',
    'Lock',
    'Data & AI',
    `<path d="M15 22v-6a9 9 0 0 1 18 0v6" ${sm} stroke-width="4"/><rect x="9" y="21" width="30" height="22" rx="4" ${fm}/><circle cx="24" cy="30" r="3" ${fd}/><rect x="22.5" y="30" width="3" height="7" rx="1" ${fd}/>`,
  ],
  [
    'key',
    'Key',
    'Data & AI',
    `<circle cx="15" cy="24" r="8" ${sm} stroke-width="4"/><circle cx="15" cy="24" r="3" ${fd}/><path d="M23 24h20M37 24v7M43 24v5" ${sm} stroke-width="4" stroke-linecap="round"/>`,
  ],
  [
    'fingerprint',
    'Fingerprint',
    'Data & AI',
    `<g stroke-width="2.6" stroke-linecap="round"><path d="M6 22c3-8 10-13 18-13s15 5 18 13" ${sd}/><path d="M12 32c0-9 5-15 12-15s12 6 12 15" ${sm}/><path d="M17 38c-1-3-1-6-1-9 0-5 4-8 8-8s8 3 8 8c0 4 0 8-2 12" ${sm}/><path d="M24 29c0 5 0 9-3 13" ${sd}/></g>`,
  ],
  ['verified', 'Verified badge', 'Data & AI', badge()],
  [
    'sparkle',
    'Sparkle',
    'Data & AI',
    `<path d="M22 4c1.5 9 6 13.5 15 15-9 1.5-13.5 6-15 15-1.5-9-6-13.5-15-15 9-1.5 13.5-6 15-15Z" ${fm}/><path d="M38 30c.7 4 2.6 6 6.6 6.6-4 .7-5.9 2.6-6.6 6.6-.7-4-2.6-5.9-6.6-6.6 4-.6 5.9-2.6 6.6-6.6Z" ${fd}/>`,
  ],
  ['neural-net', 'Neural net', 'Data & AI', neural()],
  [
    'chip',
    'Chip',
    'Data & AI',
    `<path d="${[15.5, 21.2, 26.8, 32.5].map((p) => `M${p} 5v7M${p} 36v7M5 ${p}h7M36 ${p}h7`).join('')}" ${sm} stroke-width="2.5" stroke-linecap="round"/><rect x="12" y="12" width="24" height="24" rx="3" ${fm}/><rect x="18" y="18" width="12" height="12" rx="1.5" ${fd}/>`,
  ],
  [
    'circuit',
    'Circuit',
    'Data & AI',
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
    'Data & AI',
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
    'Data & AI',
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
    'Data & AI',
    `${[0, 60, 120].map((r) => `<ellipse cx="24" cy="24" rx="20" ry="7.5" ${sm} stroke-width="2.4" transform="rotate(${r} 24 24)"/>`).join('')}<circle cx="24" cy="24" r="4.5" ${fd}/>`,
  ],
  [
    'prompt',
    'Prompt',
    'Data & AI',
    `<rect x="4" y="9" width="40" height="30" rx="4" ${fm}/><path d="m12 19 6 5-6 5" ${sd} stroke-width="3.2" ${round}/><rect x="22" y="28" width="12" height="3" rx="1" ${fd}/>`,
  ],
  ['dot-globe', 'Dot globe', 'Accents', globe()],
  ['dot-grid', 'Dot grid', 'Accents', dotGrid()],
  [
    'rings',
    'Rings',
    'Accents',
    `${[18, 12, 6].map((r, i) => `<circle cx="24" cy="24" r="${r}" ${sm} stroke-width="2" opacity="${0.35 + i * 0.3}"/>`).join('')}<circle cx="36.7" cy="11.3" r="3.4" ${fd}/>`,
  ],
  [
    'orb',
    'Orb',
    'Accents',
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
    'Accents',
    `<g stroke-width="3.4" ${round}><path d="M18 6c-5 0-6 3-6 8s-2 10-7 10c5 0 7 5 7 10s1 8 6 8" ${sm}/><path d="M30 6c5 0 6 3 6 8s2 10 7 10c-5 0-7 5-7 10s-1 8-6 8" ${sd}/></g>`,
  ],
  [
    'pixels',
    'Pixel steps',
    'Accents',
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
    'Accents',
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
    'Accents',
    `<path d="${[8, 16, 24, 32, 40].map((p) => `M${p} 4v40M4 ${p}h40`).join('')}" ${sd} stroke-width="1"/><rect x="4" y="4" width="40" height="40" ${sm} stroke-width="2"/>`,
  ],
];

// A shared blur, so soft glows are real gradients of light rather than hard-edged ellipses.
const soft = (sd: number) =>
  `<defs><filter id="soft-${sd}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter></defs>`;

/** Free-form shapes that sit behind a design: soft glows and sticker blobs, in the kit's colors. */
const BACKDROPS: [string, string, number, string][] = [
  [
    'glow',
    'Glow',
    1,
    `${soft(7)}<path d="M52 18c16 1 30 12 31 28s-10 32-27 36-36-2-40-18 4-30 14-38 12-9 22-8Z" ${fm} filter="url(#soft-7)"/>`,
  ],
  [
    'glow-duo',
    'Two glows',
    1,
    `${soft(8)}<circle cx="36" cy="38" r="22" ${fm} filter="url(#soft-8)"/><circle cx="66" cy="64" r="20" ${fd} filter="url(#soft-8)"/>`,
  ],
  [
    'aurora',
    'Aurora',
    2,
    `${soft(5)}<path d="M-10 60C30 30 60 80 100 50S170 20 210 45V70C170 45 140 90 100 75S30 60-10 85Z" ${fm} filter="url(#soft-5)"/><path d="M-10 40C40 20 70 55 110 35S175 10 210 25V38C170 25 140 60 105 50S40 35-10 55Z" ${fd} opacity=".8" filter="url(#soft-5)"/>`,
  ],
  [
    'goo',
    'Blob',
    1,
    `<path d="M50 8c14 0 30 6 36 20s2 26-6 36-18 20-32 22S16 80 11 66 6 38 16 24 36 8 50 8Z" ${fm}/><path d="M36 22c8-4 20-3 24 3s-3 12-11 13-18 0-19-6 2-8 6-10Z" ${fd} opacity=".7"/>`,
  ],
  ['splat', 'Splat', 1, ''],
  [
    'drip',
    'Drip',
    1,
    `<path d="M10 16h80v36c0 6-4 9-8 9s-7-3-7-9v-4c0-4-3-7-7-7s-6 3-6 7v24c0 6-4 9-8 9s-8-3-8-9V56c0-4-3-7-7-7s-7 3-7 7v4c0 5-3 8-8 8s-7-3-7-8Z" ${fm}/><rect x="16" y="22" width="30" height="5" rx="2.5" ${fd} opacity=".7"/>`,
  ],
  ['silk', 'Silk lines', 2.4, silk()],
  ['layers', 'Layer stack', 1.25, layers()],
  ['sky', 'Sky glow', 2, sky()],
  [
    'glass-orb',
    'Glass orb',
    1,
    `<circle cx="50" cy="50" r="40" ${fm} opacity=".22"/><circle cx="50" cy="50" r="40" ${sd} stroke-width="1.2" opacity=".8"/><ellipse cx="36" cy="30" rx="14" ry="7" transform="rotate(-30 36 30)" ${fd} opacity=".55"/>`,
  ],
];

/** A phone frame with its screen cut out, `w` wide at `x`, `y` in a drawing's own units. An image
 *  layer under the drawing shows through the screen; see `PHONE_SCREEN`. */
function phoneFrame(x: number, y: number): string {
  const o = (px: number, py: number) => `${x + px} ${y + py}`;
  const body =
    `M${o(2, 19)}a17 17 0 0 1 17-17h62a17 17 0 0 1 17 17v167a17 17 0 0 1-17 17H${x + 19}a17 17 0 0 1-17-17Z` +
    `M${o(7, 19.5)}a12.5 12.5 0 0 1 12.5-12.5h61a12.5 12.5 0 0 1 12.5 12.5v166a12.5 12.5 0 0 1-12.5 12.5h-61a12.5 12.5 0 0 1-12.5-12.5Z`;
  return (
    `<path d="${body}" fill="{{body}}" fill-rule="evenodd" stroke="{{edge}}" stroke-width=".8"/>` +
    `<rect x="${x + 38}" y="${y + 12}" width="24" height="6.5" rx="3.25" fill="{{body}}"/>` +
    `<rect x="${x + 98}" y="${y + 52}" width="1.6" height="22" rx=".8" fill="{{edge}}"/>` +
    `<rect x="${x + 0.4}" y="${y + 44}" width="1.6" height="14" rx=".8" fill="{{edge}}"/>`
  );
}

/** Where the screen sits in each device drawing, in its own units, and the drawing's width. */
export const PHONE_SCREEN: Record<
  string,
  { x: number; y: number; w: number; h: number; r: number; vw: number }
> = {
  phone: { x: 7, y: 7, w: 86, h: 191, r: 12.5, vw: 100 },
};

const DEVICE_SLOTS: ICArtSlot[] = [
  { key: 'body', label: 'Phone', color: '#16181d' },
  { key: 'edge', label: 'Edge', color: '#4a4f5c' },
];
const DEVICES: ICArtDef[] = [
  {
    id: 'phone',
    name: 'Phone',
    kind: 'shape',
    group: 'Devices',
    ratio: 100 / 205,
    viewBox: '0 0 100 205',
    body: phoneFrame(0, 0),
    slots: DEVICE_SLOTS,
  },
];

/** Three isometric plates floating one above the other: the top one solid with a light edge, the
 *  ones below fading, over a soft glow. */
function layers(): string {
  const plate = (cy: number, fill: string, op: number, edge: boolean) => {
    const top = `M62.5 ${cy - 17}L108 ${cy}L62.5 ${cy + 17}L17 ${cy}Z`;
    const side = `M17 ${cy}L62.5 ${cy + 17}L108 ${cy}V${cy + 4}L62.5 ${cy + 21}L17 ${cy + 4}Z`;
    return (
      `<path d="${side}" fill="${M}" opacity="${(op * 0.55).toFixed(2)}"/>` +
      `<path d="${top}" fill="${fill}" opacity="${op}"/>` +
      (edge
        ? `<path d="${top}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".6"/>`
        : '')
    );
  };
  return (
    `${soft(8)}<defs><linearGradient id="layers-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${D}"/><stop offset="1" stop-color="${M}"/></linearGradient></defs>` +
    `<ellipse cx="62.5" cy="86" rx="40" ry="10" fill="${M}" opacity=".35" filter="url(#soft-8)"/>` +
    plate(76, M, 0.28, false) +
    plate(53, M, 0.55, false) +
    plate(30, 'url(#layers-g)', 1, true)
  );
}

/** Line-drawn blocks around one solid block, the kind of stack a listing post shows a token on.
 *  Each block is a square front with a top and a side going up and to the right. */
function blockStack(): string {
  const F = '{{face}}';
  const block = (x: number, y: number, size: number, hero = false) => {
    const dx = size * 0.39;
    const dy = -size * 0.22;
    const line = `stroke="${D}" stroke-width=".45" stroke-linejoin="round"`;
    return (
      `<path d="M${x} ${y}l${dx} ${dy}h${size}l${-dx} ${-dy}Z" fill="${F}" ${line}/>` +
      `<path d="M${x + size} ${y}l${dx} ${dy}v${size}l${-dx} ${-dy}Z" fill="${F}" ${line}/>` +
      `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${hero ? M : F}" ${line}/>`
    );
  };
  // Back to front, so nearer blocks cover the lines of the ones behind.
  return [
    block(56, 12, 28),
    block(66, 44, 24),
    block(20, 28, 42, true),
    block(0, 72, 26),
    block(28, 76, 23),
    block(54, 70, 29),
  ].join('');
}

/** A ribbon of fine lines between two curves, twisting as it crosses, fading in from the left. */
function silk(): string {
  const top = [-10, 58, 60, 30, 150, 96, 250, 52];
  const bottom = [-10, 96, 70, 88, 160, 62, 250, 92];
  const n = 40;
  const lines = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const p = top.map((v, k) => (v + (bottom[k] - v) * t).toFixed(1));
    // Lines near the edges of the ribbon are fainter, so it reads as a soft band.
    const op = (0.25 + 0.6 * Math.sin(Math.PI * t)).toFixed(2);
    return `<path d="M${p[0]} ${p[1]}C${p[2]} ${p[3]} ${p[4]} ${p[5]} ${p[6]} ${p[7]}" stroke-opacity="${op}"/>`;
  });
  return (
    `<defs><linearGradient id="silk-g" x1="0" x2="1"><stop offset="0" stop-color="${M}" stop-opacity="0"/><stop offset=".3" stop-color="${M}"/><stop offset=".75" stop-color="${D}"/><stop offset="1" stop-color="${D}" stop-opacity=".4"/></linearGradient></defs>` +
    `<g fill="none" stroke="url(#silk-g)" stroke-width=".28">${lines.join('')}</g>`
  );
}

/** A glow from the top: a light edge easing into the main color and out to nothing, in small
 *  steps so the fade stays smooth. */
function sky(): string {
  const stops = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const at = (t * 0.62).toFixed(3);
    const op = ((1 - t) ** 2.2).toFixed(3);
    return `<stop offset="${at}" stop-color="${M}" stop-opacity="${op}"/>`;
  });
  const edge = [0, 0.06, 0.12, 0.2].map(
    (at, i) => `<stop offset="${at}" stop-color="${D}" stop-opacity="${[0.7, 0.4, 0.15, 0][i]}"/>`,
  );
  return (
    `<defs><linearGradient id="sky-g" x1="0" y1="0" x2="0" y2="1">${stops.join('')}</linearGradient>` +
    `<linearGradient id="sky-e" x1="0" y1="0" x2="0" y2="1">${edge.join('')}</linearGradient></defs>` +
    '<rect width="200" height="100" fill="url(#sky-g)"/><rect width="200" height="100" fill="url(#sky-e)"/>'
  );
}

/** A spiky sticker splat: alternating long and short points, rounded by a thick stroke of the same color. */
function splat(): string {
  const pts = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2;
    const r = i % 2 ? 26 + (i % 3) * 3 : 40 - (i % 4) * 2;
    return `${i ? 'L' : 'M'}${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`;
  });
  return `<path d="${pts.join('')}Z" ${fm} stroke="${M}" stroke-width="5" stroke-linejoin="round"/><circle cx="50" cy="50" r="15" ${fd}/>`;
}

/** Full-bleed grid lines, one per canvas shape, so a background grid stays a single layer. */
function gridLines(id: string, name: string, w: number, h: number): ICArtDef {
  let d = '';
  for (let x = 20; x < w; x += 20) d += `M${x} 0v${h}`;
  for (let y = 20; y < h; y += 20) d += `M0 ${y}h${w}`;
  return {
    id,
    name,
    kind: 'shape',
    group: 'Accents',
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
    group: 'Accents',
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
  ...BACKDROPS.map(
    ([id, name, ratio, body]): ICArtDef => ({
      id,
      name,
      kind: 'shape',
      group: 'Backgrounds',
      ratio,
      viewBox: `0 0 ${100 * ratio} 100`,
      body: id === 'splat' ? splat() : body,
      slots: SLOTS,
    }),
  ),
  {
    id: 'blocks-iso',
    name: 'Block stack',
    kind: 'shape',
    group: 'Backgrounds',
    ratio: 1,
    viewBox: '0 0 100 100',
    body: blockStack(),
    slots: [...SLOTS, { key: 'face', label: 'Faces', role: 'bg', color: '#ffffff' }],
  },
  ...DEVICES,
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
