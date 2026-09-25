// Pieces for thread cards: quotes, a wallet picker, an explorer transaction, a browser window, a
// price chart card, step badges and an author line. Each is drawn at a place and width, so the
// thread templates and the Elements tab's blocks share them.

import { face, type LayerBuilder } from './image-constructor-announce.js';
import { artDef } from './image-constructor-art.js';
import type { ICBlock, ICBlockStyle } from './image-constructor-blocks.js';
import type { ICElement } from './image-constructor-layout.js';

type B = LayerBuilder;
type S = ICBlockStyle;

/** Layers and the height they take, in percent of the canvas width. */
export interface Part {
  els: ICElement[];
  h: number;
}

let groups = 0;

/** Marks a piece's layers as one group, so they select and move together. */
export const grouped = (els: ICElement[]): ICElement[] => {
  const groupId = `part-${++groups}`;
  return els.map((e) => ({ ...e, groupId }));
};

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** Stand-in for a wide screenshot, such as a web app or an explorer page. */
export const WIDE_SHOT = svgUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">' +
    '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262a33"/><stop offset="1" stop-color="#15171c"/></linearGradient></defs>' +
    '<rect width="1600" height="1000" fill="url(#s)"/>' +
    '<g transform="translate(740 380)" fill="none" stroke="#8b90a0" stroke-width="8" stroke-linejoin="round"><rect width="120" height="96" rx="14"/><circle cx="38" cy="32" r="12"/><path d="M12 86l32-32 20 20 18-18 30 30"/></g>' +
    '<text x="800" y="560" text-anchor="middle" font-family="system-ui, sans-serif" font-size="40" font-weight="600" fill="#c3c7d1">Your screenshot</text>' +
    '<text x="800" y="612" text-anchor="middle" font-family="system-ui, sans-serif" font-size="30" fill="#8b90a0">Replace this image</text></svg>',
);

export const FACE = face('#e4e7eb', '#b8bec6');

const GREEN = '#16a34a';

const tagSize = (text: string, size: number) => ({
  w: size * (text.length * 0.62 + 2),
  h: size * 2,
});

/** A small filled label in a fixed color, such as a green Success. */
function tag(b: B, s: S, x: number, y: number, text: string, size: number, color: string) {
  const { w, h } = tagSize(text, size);
  return [
    b.rect(x, y, w, h, '', { fill: color, radius: h / 2, pal: {} }),
    b.text('status', x, y + (h - size * 1.15) / 2, w, text, size, {
      font: s.body,
      weight: 600,
      color: '#ffffff',
      align: 'center',
      pal: {},
    }),
  ];
}

/** A person's quote on a card: a big quote mark, their words, then their photo, name and handle. */
export function quoteCard(
  b: B,
  s: S,
  x: number,
  y: number,
  w: number,
  q = {
    text: 'We moved our whole payout flow\non-chain in a weekend. Fees went\nfrom dollars to cents.',
    name: 'Alex Rivera',
    handle: '@alexbuilds',
  },
): Part {
  const pad = w * 0.07;
  const qs = w * 0.05;
  const mark = w * 0.14;
  const ph = w * 0.11;
  const qy = y + pad + mark * 0.5;
  const after = qy + q.text.split('\n').length * qs * 1.4 + pad * 0.7;
  const h = after + ph + pad - y;
  const nx = x + pad + ph + pad * 0.45;
  return {
    els: grouped([
      b.rect(x, y, w, h, 'card', { line: 'panel', sw: 0.25, radius: w * 0.04 }),
      b.text('quote_mark', x + pad, y + pad * 0.5, mark, '“', mark, {
        font: s.heading,
        weight: 800,
        tone: 'accent',
        lh: 1,
      }),
      b.text('quote', x + pad, qy, w - pad * 2, q.text, qs, {
        font: s.body,
        weight: 500,
        lh: 1.4,
      }),
      b.photo('quote_photo', x + pad, after, ph, FACE, ph / 2),
      b.text('quote_name', nx, after + ph * 0.08, w - (nx - x) - pad, q.name, qs * 0.9, {
        font: s.heading,
        weight: 700,
      }),
      b.text(
        'quote_handle',
        nx,
        after + ph * 0.08 + qs * 1.2,
        w - (nx - x) - pad,
        q.handle,
        qs * 0.8,
        {
          font: s.body,
          tone: 'muted',
        },
      ),
    ]),
    h,
  };
}

const WALLETS: [string, string][] = [
  ['Browser wallet', 'wallet'],
  ['Mobile wallet', 'fingerprint'],
  ['Hardware wallet', 'key'],
  ['Smart wallet', 'shield'],
];

/** A "Connect a wallet" window listing wallet types, the first one picked out. */
export function walletConnect(b: B, s: S, x: number, y: number, w: number, rows = 4): Part {
  const pad = w * 0.065;
  const ts = w * 0.058;
  const rh = w * 0.13;
  const gap = w * 0.028;
  const top = y + pad + ts * 1.25 + pad * 0.6;
  const h = top - y + rows * (rh + gap) - gap + pad;
  const is = rh * 0.62;
  return {
    els: grouped([
      b.rect(x, y, w, h, 'card', { line: 'panel', sw: 0.25, radius: w * 0.05 }),
      b.text('wallet_title', x + pad, y + pad, w * 0.7, 'Connect a wallet', ts, {
        font: s.heading,
        weight: 700,
      }),
      b.text('wallet_close', x + w - pad - ts, y + pad - ts * 0.1, ts, '×', ts * 1.2, {
        font: s.body,
        tone: 'muted',
        align: 'right',
      }),
      ...WALLETS.slice(0, rows).flatMap(([name, icon], i) => {
        const ry = top + i * (rh + gap);
        return [
          b.rect(x + pad, ry, w - pad * 2, rh, 'panel', {
            radius: rh * 0.25,
            ...(i === 0 ? { line: 'accent', sw: w * 0.006 } : {}),
          }),
          b.art(icon, x + pad + rh * 0.2, ry + (rh - is) / 2, is),
          b.text(
            `wallet_${i + 1}`,
            x + pad + rh * 0.2 + is + rh * 0.25,
            ry + (rh - ts * 0.9 * 1.15) / 2,
            w * 0.55,
            name,
            ts * 0.9,
            {
              font: s.body,
              weight: 600,
            },
          ),
        ];
      }),
    ]),
    h,
  };
}

const TX_ROWS: [string, string][] = [
  ['Tx hash', '0x8f3c2e71b0a8…d5c3a91e'],
  ['Block', '21,480,112'],
  ['From', '0x71C7656E…c8976F'],
  ['To', '0x3fE9b2D1…04aB7e'],
  ['Value', '0.42 ETH'],
  ['Fee', '0.00061 ETH'],
];

/** An explorer's transaction page as a card: a Success label, then hash, block, sender and more. */
export function txCard(b: B, s: S, x: number, y: number, w: number, rows = 6): Part {
  const pad = w * 0.06;
  const ts = w * 0.05;
  const ls = w * 0.034;
  const rh = ls * 2.7;
  const top = y + pad + ts * 1.3 + pad * 0.5;
  const h = top - y + rows * rh + pad * 0.6;
  const ok = tagSize('Success', ls * 0.9);
  return {
    els: grouped([
      b.rect(x, y, w, h, 'card', {
        line: 'panel',
        sw: 0.25,
        radius: w * 0.035,
      }),
      b.text('tx_title', x + pad, y + pad, w * 0.6, 'Transaction details', ts, {
        font: s.heading,
        weight: 700,
      }),
      ...tag(
        b,
        s,
        x + w - pad - ok.w,
        y + pad + (ts * 1.15 - ok.h) / 2,
        'Success',
        ls * 0.9,
        GREEN,
      ),
      ...TX_ROWS.slice(0, rows).flatMap(([label, value], i) => {
        const ry = top + i * rh;
        return [
          b.rect(x + pad, ry, w - pad * 2, 0.2, 'panel'),
          b.text(`tx_label_${i + 1}`, x + pad, ry + (rh - ls * 1.15) / 2, w * 0.25, label, ls, {
            font: s.body,
            tone: 'muted',
          }),
          b.text(`tx_value_${i + 1}`, x + w * 0.34, ry + (rh - ls * 1.15) / 2, w * 0.6, value, ls, {
            font: 'geist-mono',
            weight: 500,
            tone: i === 0 ? 'accent' : 'ink',
          }),
        ];
      }),
    ]),
    h,
  };
}

/** A browser window with an address bar and a screenshot slot filling the page area. */
export function browserWindow(
  b: B,
  s: S,
  x: number,
  y: number,
  w: number,
  h: number,
  url = 'app.yourbrand.xyz',
): Part {
  const bar = w * 0.065;
  const m = w * 0.012;
  const dot = bar * 0.26;
  const us = bar * 0.34;
  return {
    els: grouped([
      b.rect(x, y, w, h, 'panel', { radius: w * 0.022 }),
      ...['#ff5f57', '#febc2e', '#28c840'].map((c, i) => ({
        ...b.rect(x + bar * 0.45 + i * dot * 1.7, y + (bar - dot) / 2, dot, dot, '', {
          fill: c,
          radius: dot / 2,
          pal: {},
        }),
        kind: 'ellipse' as const,
      })),
      b.rect(x + w * 0.22, y + bar * 0.2, w * 0.56, bar * 0.6, 'card', {
        radius: bar * 0.3,
      }),
      b.text('url', x + w * 0.22, y + (bar - us * 1.15) / 2, w * 0.56, url, us, {
        font: s.body,
        tone: 'muted',
        align: 'center',
      }),
      {
        ...b.logo('screenshot', x + m, y + bar, w - m * 2, h - bar - m, WIDE_SHOT, 1.6),
        fit: 'top' as const,
        radius: w * 0.012,
      },
    ]),
    h,
  };
}

/** A trading chart card: the pair, price and change, timeframe tabs and a candle chart. */
export function priceCard(b: B, s: S, x: number, y: number, w: number): Part {
  const pad = w * 0.055;
  const ps = w * 0.042;
  const big = w * 0.085;
  const chartW = w - pad * 2;
  const chartH = chartW / (artDef('chart-candles')?.ratio ?? 1.6);
  const cy = y + pad + ps * 1.4 + big * 1.15 + pad * 0.6;
  const h = cy - y + chartH + pad * 0.6;
  const change = tagSize('+2.41%', ps * 0.8);
  const tabs = ['1H', '4H', '1D', '1W'];
  const tw = ps * 2.4;
  return {
    els: grouped([
      b.rect(x, y, w, h, 'card', {
        line: 'panel',
        sw: 0.25,
        radius: w * 0.035,
      }),
      b.text('pair', x + pad, y + pad, w * 0.5, 'BTC / USDT', ps, {
        font: s.body,
        weight: 600,
        tone: 'muted',
      }),
      b.text('price', x + pad, y + pad + ps * 1.4, w * 0.6, '$67,420.18', big, {
        font: s.heading,
        weight: 700,
        track: -0.02,
      }),
      ...tag(
        b,
        s,
        x + pad + big * 5.6,
        y + pad + ps * 1.4 + (big * 1.15 - change.h) / 2,
        '+2.41%',
        ps * 0.8,
        GREEN,
      ),
      ...tabs.flatMap((t, i) => {
        const tx = x + w - pad - (tabs.length - i) * (tw + ps * 0.3);
        return [
          ...(t === '1D'
            ? [
                b.rect(tx, y + pad - ps * 0.35, tw, ps * 1.85, 'accent', {
                  radius: ps * 0.4,
                }),
              ]
            : []),
          b.text(`tf_${i + 1}`, tx, y + pad, tw, t, ps * 0.85, {
            font: s.body,
            weight: 600,
            tone: t === '1D' ? 'onAccent' : 'muted',
            align: 'center',
          }),
        ];
      }),
      b.art('chart-candles', x + pad, cy, chartW),
    ]),
    h,
  };
}

/**
 * The curved arrow drawn from one point to another, in canvas-width units: scaled, turned and
 * placed so its tail sits on `from` and its head on `to`. `bend: -1` curves it the other way.
 */
export function pointer(
  b: B,
  [fx, fy]: [number, number],
  [tx, ty]: [number, number],
  bend: 1 | -1 = 1,
): ICElement {
  // Where the tail and the head sit in the drawing's 140 by 100 box; mirrored when bent the other way.
  const tail = bend > 0 ? [10, 90] : [130, 90];
  const head = bend > 0 ? [118, 22] : [22, 22];
  const k = Math.hypot(tx - fx, ty - fy) / Math.hypot(head[0] - tail[0], head[1] - tail[1]);
  const turn = Math.atan2(ty - fy, tx - fx) - Math.atan2(head[1] - tail[1], head[0] - tail[0]);
  const ox = (tail[0] - 70) * k;
  const oy = (tail[1] - 50) * k;
  const cx = fx - (ox * Math.cos(turn) - oy * Math.sin(turn));
  const cy = fy - (ox * Math.sin(turn) + oy * Math.cos(turn));
  return b.art('arrow-curve', cx - 70 * k, cy - 50 * k, 140 * k, {
    rot: (turn * 180) / Math.PI,
    ...(bend < 0 ? { flip: true } : {}),
  });
}

/** A numbered badge. The number is in the `step_no` slot, which a thread numbers in order. */
export function stepBadge(b: B, s: S, x: number, y: number, size: number, n = '01'): Part {
  const ts = size * 0.44;
  return {
    els: grouped([
      b.rect(x, y, size, size, 'accent', { radius: size * 0.28 }),
      b.text('step_no', x, y + (size - ts * 1.15) / 2, size, n, ts, {
        font: s.heading,
        weight: 800,
        tone: 'onAccent',
        align: 'center',
        lh: 1.15,
      }),
    ]),
    h: size,
  };
}

/** The author of the thread: a round photo, the name with a check, and the handle. */
export function authorLine(
  b: B,
  s: S,
  x: number,
  y: number,
  size: number,
  name = 'Your Brand',
  handle = '@yourbrand',
): Part {
  const ns = size * 0.36;
  const tx = x + size * 1.3;
  return {
    els: grouped([
      b.photo('author_photo', x, y, size, FACE, size / 2),
      b.text('author_name', tx, y + size * 0.08, 40, name, ns, {
        font: s.heading,
        weight: 700,
      }),
      b.art('verified', tx + name.length * ns * 0.58 + ns * 0.3, y + size * 0.08 + ns * 0.08, ns),
      b.text('author_handle', tx, y + size * 0.1 + ns * 1.3, 40, handle, ns * 0.85, {
        font: s.body,
        tone: 'muted',
      }),
    ]),
    h: size,
  };
}

/** A tag in the thread's own accent, such as a date or a section name. */
export function chip(b: B, s: S, x: number, y: number, text: string, size: number, solid = true) {
  const h = size * 2.1;
  const w = size * (text.length * 0.68 + 2.8);
  return {
    els: grouped([
      b.pill('chip', x, y, w, h, text, size, solid ? 'solid' : 'outline', {
        font: s.body,
      }),
    ]),
    w,
    h,
  };
}

const at0 =
  (build: (b: B, s: S) => Part, w: number): ICBlock['build'] =>
  (b, s) => {
    const part = build(b, s);
    return { els: part.els, w, h: part.h };
  };

/** The same pieces, offered one at a time in the Elements tab. */
export const THREAD_BLOCKS: ICBlock[] = [
  {
    id: 'quote-card',
    name: 'Quote',
    build: at0((b, s) => quoteCard(b, s, 0, 0, 70), 70),
  },
  {
    id: 'wallet-connect',
    name: 'Connect wallet',
    build: at0((b, s) => walletConnect(b, s, 0, 0, 56), 56),
  },
  {
    id: 'tx-card',
    name: 'Explorer transaction',
    build: at0((b, s) => txCard(b, s, 0, 0, 72), 72),
  },
  {
    id: 'browser-window',
    name: 'Browser window',
    build: at0((b, s) => browserWindow(b, s, 0, 0, 72, 72 / 1.45), 72),
  },
  {
    id: 'price-card',
    name: 'Price chart',
    build: at0((b, s) => priceCard(b, s, 0, 0, 72), 72),
  },
  {
    id: 'step-badge',
    name: 'Step number',
    build: at0((b, s) => stepBadge(b, s, 0, 0, 12), 12),
  },
  {
    id: 'author-line',
    name: 'Author',
    build: at0((b, s) => authorLine(b, s, 0, 0, 12), 50),
  },
];
