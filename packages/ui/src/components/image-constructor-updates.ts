// The Product Updates pack: release posts that list many features, each with an optional screenshot.
// A list template's item setup is stored in its id after a `~` (`update-bento~7`), so the one id
// keeps the design through sizes, brands, reset and saves, and + / x only change the id.

import { BENCH_PACK_NAME, benchWithSpec, parseRanked, rankedSpec } from './image-constructor-bench.js';
import {
  ANNOUNCE_BRANDS,
  type LayerBuilder,
  layerBuilder,
  renumber,
} from './image-constructor-announce.js';
import { artDef } from './image-constructor-art.js';
import { SAMPLE_LOGO } from './image-constructor-brand-builtin.js';
import { grouped, nameParts } from './image-constructor-groups.js';
import { type BrandKit, brandBackground } from './image-constructor-brand-kit.js';
import {
  type ICElement,
  type ICFont,
  type ICLayout,
  type ICRatio,
  type ICShape,
  type ICTemplate,
  withCards,
} from './image-constructor-layout.js';
import { luminance, mix } from './image-constructor-palettes.js';
import { PRODUCT_ICONS, wireBox } from './image-constructor-update-art.js';

export const UPDATES_PACK = 'Product Updates';

type Fmt = 'x' | 'sq' | 'st';
const HEIGHT: Record<Fmt, number> = { x: 56.25, sq: 100, st: (1920 / 1080) * 100 };
const FMTS: [Fmt, ICRatio][] = [
  ['x', 'x-post'],
  ['sq', '1:1'],
  ['st', 'story'],
];

// ---------- placeholder screenshots ----------

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
const SHOT_RATIO = 1.6;
// Stand-in app screens: crisp neutrals and one color, the kit's accent, so a post reads as one piece.
const INK = '#eef1f0';
const LINE = '#3a434e';
const PANEL = '#1b1f27';
const frame = (inner: string) =>
  svgUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">' +
      '<rect width="800" height="500" fill="#0b0e12"/><rect width="800" height="44" fill="#14181e"/>' +
      '<circle cx="28" cy="22" r="7" fill="#3a434e"/><circle cx="52" cy="22" r="7" fill="#3a434e"/><circle cx="76" cy="22" r="7" fill="#3a434e"/>' +
      `<rect y="44" width="800" height="2" fill="#262d36"/>${inner}</svg>`,
  );
const bar = (x: number, y: number, w: number, c = LINE, h = 16) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${c}"/>`;
const box = (x: number, y: number, w: number, h: number, stroke = LINE, fill = PANEL, sw = 2) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

const SCREENS: ((a: string) => string)[] = [
  // A kit editor: accent swatches and a card in the kit.
  (a) =>
    `${[1, 0.72, 0.45, 0.22].map((o, k) => `<rect x="${48 + k * 62}" y="90" width="50" height="50" rx="12" fill="${a}" fill-opacity="${o}"/>`).join('')}` +
    `${bar(48, 170, 200)}${bar(48, 202, 150)}${bar(48, 234, 176)}` +
    `${box(320, 80, 432, 376)}${bar(352, 112, 96, a, 28)}<rect x="352" y="164" width="240" height="46" rx="10" fill="${INK}"/>${bar(352, 236, 280)}${bar(352, 268, 200)}${bar(352, 392, 140, a, 36)}`,
  // Pages of a thread.
  (a) =>
    `<g transform="rotate(-7 220 250)">${box(120, 120, 200, 260)}</g><g transform="rotate(3 390 226)">${box(290, 96, 200, 260)}</g>` +
    `${box(460, 116, 220, 290, a, PANEL, 4)}${bar(492, 150, 120, INK, 20)}${bar(492, 186, 150)}<rect x="492" y="356" width="72" height="24" rx="8" fill="${a}"/>`,
  // Snapping guides.
  (a) =>
    `${box(40, 76, 720, 392, '#262d36', '#0f1318')}${box(220, 180, 220, 170, a, PANEL, 4)}` +
    `<rect x="329" y="76" width="3" height="392" fill="${a}" fill-opacity=".7"/><rect x="40" y="264" width="720" height="3" fill="${a}" fill-opacity=".7"/>${box(490, 228, 150, 74)}`,
  // A layers list.
  (a) =>
    [0, 1, 2, 3, 4]
      .map(
        (k) =>
          `${k === 2 ? `<rect x="36" y="${88 + k * 72}" width="728" height="58" rx="14" fill="${a}" fill-opacity=".16"/>` : ''}<rect x="62" y="${105 + k * 72}" width="24" height="24" rx="6" fill="none" stroke="${k === 2 ? a : LINE}" stroke-width="3"/>${bar(108, 109 + k * 72, 170 + ((k * 53) % 120), k === 2 ? INK : LINE)}`,
      )
      .join(''),
  // A bar chart.
  (a) =>
    [30, 48, 40, 66, 96]
      .map((h, k) => `<rect x="${84 + k * 136}" y="${462 - h * 3.6}" width="96" height="${h * 3.6}" rx="12" fill="${k === 4 ? a : LINE}"/>`)
      .join('') + '<rect x="60" y="464" width="680" height="2" fill="#262d36"/>',
  // Code.
  (a) =>
    `${bar(60, 100, 88, a)}${bar(164, 100, 120, INK)}${bar(300, 100, 72, a)}${bar(388, 100, 150, INK)}` +
    `${bar(104, 150, 72)}${bar(192, 150, 150, a)}${bar(104, 200, 72)}${bar(192, 200, 130, a)}${bar(60, 250, 52, INK)}` +
    `${bar(60, 330, 480)}${bar(60, 370, 360)}`,
  // An export dialog.
  (a) =>
    `${box(130, 88, 540, 344)}${bar(170, 128, 120, INK, 20)}` +
    ['', '', '', ''].map((_, k) => `<rect x="${170 + k * 112}" y="190" width="96" height="52" rx="12" fill="${k === 2 ? a : 'none'}" fill-opacity="${k === 2 ? 0.16 : 1}" stroke="${k === 2 ? a : LINE}" stroke-width="3"/>`).join('') +
    `<rect x="500" y="352" width="130" height="50" rx="12" fill="${a}"/>`,
  // A lesson beside its code.
  (a) =>
    `<rect x="40" y="80" width="300" height="38" rx="10" fill="${INK}"/>${bar(40, 144, 290)}${bar(40, 176, 250)}${bar(40, 208, 280)}${bar(40, 240, 190)}` +
    `${box(380, 76, 380, 392, '#262d36', '#0f1318')}${bar(408, 110, 90, a)}${bar(514, 110, 160, INK)}${bar(408, 150, 200)}${bar(408, 190, 150)}` +
    `<rect x="408" y="410" width="320" height="14" rx="7" fill="${LINE}"/><rect x="408" y="410" width="200" height="14" rx="7" fill="${a}"/>`,
  // A flow of blocks.
  (a) =>
    `<path d="M250 190C330 190 330 300 410 300" stroke="${a}" stroke-width="5" fill="none"/><path d="M590 300C640 300 640 170 690 170" stroke="${a}" stroke-width="5" fill="none"/>` +
    [
      [80, 170, 170],
      [410, 280, 180],
      [560, 150, 150],
    ]
      .map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="44" rx="10" fill="${PANEL}" stroke="${LINE}" stroke-width="2"/>${bar(x + 18, y + 14, w - 36, INK)}`)
      .join(''),
];
const shots = new Map<string, string>();
const shot = (i: number, accent: string) => {
  const key = `${i % SCREENS.length}|${accent}`;
  if (!shots.has(key)) shots.set(key, frame(SCREENS[i % SCREENS.length](accent)));
  return shots.get(key) as string;
};

// ---------- default copy ----------

const FEATURES: [title: string, desc: string][] = [
  ['UI kits', 'Your colors, fonts and logo on every template.'],
  ['Threads', 'Multi-page posts with a shared look.'],
  ['Smart guides', 'Snap to edges and centers as you drag.'],
  ['Layers', 'Reorder, lock and hide every layer.'],
  ['Charts', 'Bars, lines and donuts from a CSV.'],
  ['Code blocks', 'Syntax colors in your kit.'],
  ['PDF export', 'One file for a whole thread.'],
  ['Custom fonts', 'Upload your own font files.'],
  ['Brand logos', 'Light and dark logo variants.'],
  ['Faster export', 'PNG export is 3x quicker.'],
  ['Color picker', 'Recent colors and an eyedropper.'],
  ['Undo history', 'Up to 200 steps back.'],
  ['Grid snapping', 'Snap to a 12-column grid.'],
  ['Image crop', 'Crop from any corner.'],
  ['Story size', 'Safe areas on 9:16 posts.'],
];

const PRODUCTS: { name: string; shot: number; items: string[] }[] = [
  {
    name: 'Learn',
    shot: 7,
    items: ['Fine-tuning course', 'Smarter hints', 'Device sync', 'Offline docs', 'Faster runs', 'New quizzes', 'Code review', 'Streaks', 'Certificates', 'Notes', 'Bookmarks', 'Leaderboard'],
  },
  {
    name: 'Play',
    shot: 8,
    items: ['XLS export', 'Folder loops', 'Voice blocks', 'Run history', 'Templates', 'Schedules', 'Webhooks', 'Shared flows', 'Retries', 'Variables', 'Logs', 'Block search'],
  },
  {
    name: 'Design',
    shot: 0,
    items: ['UI kits', 'Threads', 'Orbit pattern', 'Sharper thumbnails', 'Size presets', 'Partner row', 'Charts', 'PDF export', 'Custom fonts', 'Grid snapping', 'Image crop', 'Layers'],
  },
  {
    name: 'Docs',
    shot: 5,
    items: ['API reference', 'Guides', 'Search', 'Dark mode', 'Examples', 'Changelog', 'Versioning', 'Feedback', 'Glossary', 'Diagrams', 'Tutorials', 'Migration guide'],
  },
];
const DOCS = ['API reference', 'Guides', 'Search', 'Dark mode', 'Examples', 'Changelog', 'Versioning', 'Feedback', 'Glossary', 'Diagrams', 'Tutorials', 'Migration guide'];

interface Copy {
  features: [title: string, desc: string][];
  products: { name: string; shot: number; items: string[]; icon?: string }[];
}

// Tether and QVAC get copy from their own products; every other kit uses the studio's own.
const COPY: Record<string, Copy> = {
  tether: {
    features: [
      ['Gasless transfers', 'Send USDT without holding gas tokens.'],
      ['Self-custody', 'Your keys stay on your device.'],
      ['Instant swaps', 'Swap between assets in one tap.'],
      ['Payment links', 'Request USDT with a link.'],
      ['Address book', 'Save the addresses you pay often.'],
      ['Fee estimates', 'See the fee before you send.'],
      ['Recovery backup', 'An encrypted backup of your phrase.'],
      ['Merchant checkout', 'Accept USDT in your store.'],
      ['Payment history', 'Search and export past payments.'],
      ['Hardware wallets', 'Sign with a hardware device.'],
      ['Batch payouts', 'Pay many addresses at once.'],
      ['Spending limits', 'Daily limits per wallet.'],
    ],
    products: [
      {
        name: 'Wallet',
        icon: 'product-wallet',
        shot: 3,
        items: ['Self-custody', 'Gasless transfers', 'Swaps', 'Address book', 'Recovery backup', 'Hardware wallets', 'Price alerts', 'Fee estimates', 'Spending limits', 'Widgets', 'Dark mode', 'Face unlock'],
      },
      {
        name: 'Payments',
        icon: 'product-card',
        shot: 4,
        items: ['Payment links', 'Merchant checkout', 'Batch payouts', 'Invoices', 'Refunds', 'Webhooks', 'Settlement reports', 'Subscriptions', 'QR codes', 'Receipts', 'Payouts API', 'Test mode'],
      },
      {
        name: 'WDK',
        icon: 'product-code',
        shot: 5,
        items: ['New chain modules', 'TypeScript types', 'Key management', 'Fee estimation', 'React Native', 'Examples', 'Testnet tools', 'Smaller bundle', 'Error codes', 'Signing API', 'Plugins', 'Account recovery'],
      },
      { name: 'Docs', icon: 'product-docs', shot: 7, items: DOCS },
    ],
  },
  qvac: {
    features: [
      ['Local LLMs', 'Run chat models on your own device.'],
      ['Speech to text', 'Transcribe audio without the cloud.'],
      ['Translation', 'Translate text on device.'],
      ['Embeddings', 'Vector search over your own files.'],
      ['Image generation', 'Images from a prompt, locally.'],
      ['Fine-tuning', 'Train adapters on your own data.'],
      ['Streaming', 'Tokens as they are generated.'],
      ['GPU acceleration', 'Faster inference on supported GPUs.'],
      ['Model downloads', 'Resumable peer-to-peer downloads.'],
      ['Text to speech', 'Natural voices, fully offline.'],
      ['OCR', 'Read text from images.'],
      ['Tool calling', 'Let models call your functions.'],
    ],
    products: [
      {
        name: 'SDK',
        icon: 'product-code',
        shot: 5,
        items: ['Streaming API', 'Tool calling', 'Embeddings', 'Fine-tuning', 'Speech to text', 'Translation', 'OCR', 'Text to speech', 'Error types', 'Logging', 'Cancellation', 'Typed configs'],
      },
      {
        name: 'Workbench',
        icon: 'product-window',
        shot: 0,
        items: ['Model picker', 'Chat playground', 'Prompt library', 'Benchmarks', 'Dataset viewer', 'Run history', 'Export chats', 'Compare models', 'Token counter', 'Shortcuts', 'Themes', 'Settings sync'],
      },
      {
        name: 'Models',
        icon: 'product-chip',
        shot: 4,
        items: ['Qwen3 support', 'Whisper models', 'Image models', 'Quantized builds', 'Faster downloads', 'Model cards', 'Embedding models', 'TTS voices', 'OCR models', 'Translation models', 'Vision models', 'Checksums'],
      },
      { name: 'Docs', icon: 'product-docs', shot: 7, items: DOCS },
    ],
  },
};
const copyFor = (brand: string | undefined): Copy =>
  COPY[brand ?? ''] ?? { features: FEATURES, products: PRODUCTS };

const COUNT_WORDS = ['One', 'Two', 'Three', 'Four'];

// ---------- item specs ----------

export type Kind = 'new' | 'imp' | 'fix';
export interface ChangeItem {
  kind: Kind;
  photo: boolean;
}

/** How a family's items are set: a plain count, a changelog of typed items, or items per product. */
export type ListShape = 'count' | 'changelog' | 'products' | 'ranked';

export interface ListInfo {
  shape: ListShape;
  spec: string;
  min: number;
  max: number;
  /** Products: most items one product can list. */
  perMax?: number;
  /** Changelog: most items with a screenshot. */
  photoMax?: number;
}

const KIND_OF: Record<string, Kind> = { n: 'new', i: 'imp', f: 'fix' };
const LETTER: Record<Kind, string> = { new: 'n', imp: 'i', fix: 'f' };

export const parseChanges = (spec: string): ChangeItem[] =>
  [...spec].map((ch) => ({ kind: KIND_OF[ch.toLowerCase()] ?? 'new', photo: ch !== ch.toLowerCase() }));
export const changesSpec = (items: ChangeItem[]) =>
  items.map((it) => (it.photo ? LETTER[it.kind].toUpperCase() : LETTER[it.kind])).join('');
export const parseProducts = (spec: string): number[] => spec.split('.').map((n) => Math.max(1, Number(n) || 1));
export const productsSpec = (counts: number[]) => counts.join('.');

// ---------- building blocks ----------

interface Brand {
  id: string;
  kit: BrandKit;
  logo: { url: string; ratio: number };
}

const BRANDS: Brand[] = ANNOUNCE_BRANDS.map((b) => ({
  id: b.id,
  kit: b.kit,
  logo: b.kit.logo ? { url: b.kit.logo, ratio: b.kit.logoRatio } : SAMPLE_LOGO,
}));

interface Ctx {
  b: LayerBuilder;
  H: number;
  f: Fmt;
  c: Brand;
  /** A light background, where the kind and product tints need darker shades. */
  light: boolean;
  copy: Copy;
}

const MONO = { font: 'geist-mono' as const, weight: 600 };
const head = (x: Ctx) => ({ font: x.c.kit.fonts.heading, weight: 800, track: -0.02, lh: 1.08 });

// "v2.4.1" at weight 900 in each kit's heading font, in ems. Templates are built before fonts
// load, so a big version is sized from these instead of measured.
const VERSION_EM: Partial<Record<ICFont, number>> = { grotesk: 2.54, geist: 2.73, sans: 2.82, 'archivo-black': 3.04 };

/** A big version's size, capped so it fits `room` in the kit's heading font. */
const versionSize = (x: Ctx, size: number, room: number) =>
  Math.min(size, room / (VERSION_EM[x.c.kit.fonts.heading] ?? 3.1));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pick = <T>(x: Ctx, a: T, b: T, c: T) => x.b.pick(a, b, c);

/** Kind colors: new takes the accent; improved and fixed get fixed tints that read on the background. */
function kindColor(x: Ctx, k: Kind): string {
  if (k === 'new') return x.c.kit.roles.accent;
  if (k === 'imp') return x.light ? '#0f766e' : '#5eead4';
  return x.light ? '#be123c' : '#ff8fa3';
}
const KIND_LABEL: Record<Kind, string> = { new: 'New', imp: 'Improved', fix: 'Fixed' };
const KIND_GLYPH: Record<Kind, string> = { new: '+', imp: '↑', fix: '✓' };

/** A product's tint: the first takes the accent, the rest fixed hues that read on the background. */
function productColor(x: Ctx, p: number): string {
  if (p === 0) return x.c.kit.roles.accent;
  const dark = ['#5eead4', '#c9a5f8', '#fbbf24'];
  const light = ['#0f766e', '#7c3aed', '#b45309'];
  return (x.light ? light : dark)[(p - 1) % 3];
}

/** A screenshot slot filling a `w` by `h` box, cropped to cover it. */
const photo = (x: Ctx, role: string, px: number, py: number, w: number, h: number, i: number, radius = 1) =>
  x.b.image(role, px, py, w, shot(i, x.c.kit.roles.accent), SHOT_RATIO, {
    h: (h / x.H) * 100,
    radius,
    // A box wider than the screenshot shows its top, window bar and all, as a real crop would.
    ...(w / h > SHOT_RATIO ? { fit: 'top' as const } : {}),
  });

const card = (x: Ctx, px: number, py: number, w: number, h: number, radius: number) =>
  x.b.rect(px, py, w, h, 'card', { line: 'panel', sw: 0.12, radius });

const ellipse = (s: ICShape): ICShape => ({ ...s, kind: 'ellipse' });

/** The brand's logo `w` wide, and the height it takes. */
function logo(x: Ctx, lx: number, ly: number, w: number) {
  const { url, ratio } = x.c.logo;
  return { el: x.b.image('logo', lx, ly, w, url, ratio), h: w / ratio };
}

/** Logo, a mono eyebrow and the headline across the top; returns the layers and where they end. */
function header(x: Ctx, eyebrow: string, headline: string, m: number) {
  const lw = pick(x, 13, 20, 26);
  const lg = logo(x, m, m * 0.85, lw);
  const es = pick(x, 1.25, 1.9, 2.3);
  const hs = pick(x, 3.8, 5.8, 7.2);
  const ey = m * 0.85 + lg.h + pick(x, 1.6, 2.6, 3.4);
  const hy = ey + es * 1.2 + pick(x, 0.6, 1, 1.4);
  return {
    els: [
      lg.el,
      x.b.text('eyebrow', m, ey, 70, eyebrow, es, { ...MONO, tone: 'accent', track: 0.14 }),
      x.b.text('headline', m, hy, 100 - 2 * m, headline, hs, head(x)),
    ],
    bottom: hy + hs * 1.1,
  };
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** `n` boxes filling `area`, with the column count whose cells come closest to `aspect`. */
function cells(n: number, area: Box, gap: number, aspect: number, maxCols = n): Box[] {
  let best: { cols: number; score: number } = { cols: 1, score: Number.POSITIVE_INFINITY };
  for (let cols = 1; cols <= Math.min(n, maxCols); cols++) {
    const rows = Math.ceil(n / cols);
    const cw = (area.w - gap * (cols - 1)) / cols;
    const ch = (area.h - gap * (rows - 1)) / rows;
    const score = Math.abs(Math.log(cw / ch / aspect));
    if (score < best.score) best = { cols, score };
  }
  const cols = best.cols;
  const rows = Math.ceil(n / cols);
  const cw = (area.w - gap * (cols - 1)) / cols;
  const ch = (area.h - gap * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - cols * (rows - 1) : cols;
    const shift = ((cols - inRow) * (cw + gap)) / 2;
    return { x: area.x + shift + (i % cols) * (cw + gap), y: area.y + r * (ch + gap), w: cw, h: ch };
  });
}

/** Height of a layer in canvas-width units, so a group can turn around one center. */
function heightOf(e: ICElement, H: number): number {
  switch (e.t) {
    case 'text':
      return e.text.split('\n').length * e.lh * e.size;
    case 'image':
      return e.h === undefined ? e.w / e.ratio : (e.h * H) / 100;
    case 'art':
      return e.w / (artDef(e.art)?.ratio ?? 1);
    case 'shape':
    case 'pill':
      return (e.h * H) / 100;
    default:
      return 0;
  }
}

/** Turns a group of layers `deg` degrees around (ox, oy), each keeping its place in the group. */
function spin(els: ICElement[], ox: number, oy: number, deg: number, H: number): ICElement[] {
  const a = (deg * Math.PI) / 180;
  return els.map((e) => {
    const h = heightOf(e, H);
    const cx = e.x + e.w / 2;
    const cy = (e.y * H) / 100 + h / 2;
    const nx = ox + (cx - ox) * Math.cos(a) - (cy - oy) * Math.sin(a);
    const ny = oy + (cx - ox) * Math.sin(a) + (cy - oy) * Math.cos(a);
    return { ...e, x: nx - e.w / 2, y: ((ny - h / 2) / H) * 100, rot: (e.rot ?? 0) + deg };
  });
}

/** A curved wire from one dot to another, running across (`h`) or down (`v`). It stays joined to
 *  both dots when either one moves. */
function wire(x: Ctx, from: ICShape, to: ICShape, flow: 'h' | 'v', color: string) {
  const c = (e: ICShape) => [e.x + e.w / 2, ((e.y + e.h / 2) / 100) * x.H];
  const [x1, y1] = c(from);
  const [x2, y2] = c(to);
  const box = wireBox(x1, y1, x2, y2, flow);
  return x.b.art(box.art, box.x, box.y, box.w, {
    colors: { main: color },
    lock: true,
    link: { from: from.id, to: to.id, flow },
  });
}

const port = (x: Ctx, cx: number, cy: number, r: number, color: string) =>
  ellipse(x.b.rect(cx - r, cy - r, r * 2, r * 2, 'card', { line: color, sw: r * 0.45, pal: { fill: 'card' } }));

/** A product's icon on a tinted tile. */
function productTile(x: Ctx, p: number, px: number, py: number, s: number) {
  const icon = x.copy.products[p]?.icon ?? PRODUCT_ICONS[p % PRODUCT_ICONS.length].id;
  const color = productColor(x, p);
  const tint = mix(color, x.c.kit.roles.card, 0.84);
  return [
    x.b.rect(px, py, s, s, '', { fill: tint, line: mix(color, x.c.kit.roles.card, 0.5), sw: s * 0.035, radius: s * 0.24, pal: {} }),
    x.b.art(icon, px + s * 0.22, py + s * 0.22, s * 0.56, {
      colors: { main: color },
      pal: {},
    }),
  ];
}

// ---------- families ----------

type Build = (x: Ctx, spec: string) => ICElement[];

/** A: one hero tile and a grid of feature tiles, each with a screenshot. */
const bento: Build = (x, spec) => {
  const n = clamp(Number(spec) || 7, 3, 12);
  const m = pick(x, 4, 6, 7);
  const hd = header(x, 'V2.4.1 · SEPT 2026', "What's new", m);
  const top = hd.bottom + pick(x, 2.4, 3.4, 4);
  const area = { x: m, y: top, w: 100 - 2 * m, h: x.H - top - m };
  const gap = pick(x, 1.2, 1.6, 1.8);
  // The first feature leads: a tall column in X, a wide band on top in a square or story.
  // Past nine, every feature gets an even tile.
  const heroShare = n <= 3 || n > 9 ? 0 : x.f === 'x' ? 0.36 : x.f === 'sq' ? 0.5 : 0.34;
  const hero: Box =
    x.f === 'x'
      ? { x: area.x, y: area.y, w: area.w * heroShare, h: area.h }
      : { x: area.x, y: area.y, w: area.w, h: area.h * heroShare };
  const rest: Box =
    heroShare === 0
      ? area
      : x.f === 'x'
        ? { x: area.x + hero.w + gap, y: area.y, w: area.w - hero.w - gap, h: area.h }
        : { x: area.x, y: area.y + hero.h + gap, w: area.w, h: area.h - hero.h - gap };
  const boxes = [...(heroShare ? [hero] : []), ...cells(heroShare ? n - 1 : n, rest, gap, 1.15, x.f === 'st' ? 3 : heroShare ? 4 : 6)];
  return [
    ...hd.els,
    ...boxes.flatMap((bx, i) => {
      const lead = heroShare > 0 && i === 0;
      const pad = clamp(Math.min(bx.w, bx.h) * 0.05, 0.7, 1.6);
      const ts = lead ? pick(x, 2.4, 3.6, 4.2) : clamp(bx.w * 0.085, 0.9, pick(x, 1.9, 2.8, 3.4));
      const ds = ts * 0.55;
      const band = ts * 1.5 + (lead ? ds * 2.8 : 0) + pad;
      const [title, desc] = x.copy.features[i];
      return grouped([
        card(x, bx.x, bx.y, bx.w, bx.h, pad * 1.4),
        photo(x, `item${i + 1}_image`, bx.x + pad, bx.y + pad, bx.w - 2 * pad, bx.h - 2 * pad - band, i, pad * 0.8),
        ...(lead
          ? [
              x.b.pill(`item${i + 1}_tag`, bx.x + pad * 2, bx.y + pad * 2, ts * 1.9, ts * 0.78, 'NEW', ts * 0.32, 'solid', {
                ...MONO,
                track: 0.1,
                radius: ts * 0.2,
              }),
            ]
          : []),
        x.b.text(`item${i + 1}_title`, bx.x + pad, bx.y + bx.h - band, bx.w - 2 * pad, title, ts, head(x)),
        ...(lead
          ? [x.b.text(`item${i + 1}_desc`, bx.x + pad, bx.y + bx.h - band + ts * 1.4, bx.w - 2 * pad, desc, ds, { tone: 'muted', lh: 1.35 })]
          : []),
      ]);
    }),
  ];
};

const TILTS = [-4, 3, -2, 2.5, -3.5, 4, -1.5, 3.2];

/** B: screenshots pinned like printed cards around a big version number. */
const pinboard: Build = (x, spec) => {
  const n = clamp(Number(spec) || 6, 3, 12);
  const m = pick(x, 4.5, 6, 7);
  // Left of the photos in X, left of the words in a square, the full width in a story.
  const room = (x.f === 'x' ? 32 : x.f === 'sq' ? 50 : 100 - m) - m;
  const vs = versionSize(x, pick(x, 11, 13, 20), room);
  const lg = logo(x, m, pick(x, 0, m, m), pick(x, 15, 20, 26));
  const blockH = lg.h + 2.4 + vs + 1 + pick(x, 3.4, 3.8, 5) * 2.4 + 5;
  const by = x.f === 'x' ? (x.H - blockH) / 2 : m;
  const vy = by + lg.h + 2.4;
  const sy = vy + vs * 0.95 + 1;
  const ss = pick(x, 3.2, 3.8, 5);
  // Beside the number in a square; under it in X and a story.
  const [sx, subY] = x.f === 'sq' ? [52, vy + 1] : [m, sy];
  const tagY = subY + ss * 2.3 + pick(x, 1, 1.4, 1.8);
  const words = [
    { ...lg.el, y: (by / x.H) * 100 },
    x.b.text('version', m, vy, room, 'v2.4.1', vs, {
      ...head(x),
      weight: 900,
      track: -0.04,
      lh: 0.95,
      tone: 'accent',
    }),
    x.b.text('headline', sx, subY, x.f === 'x' ? 30 : 44, 'Fresh off\nthe board', ss, head(x)),
    x.b.pill('badge', sx, tagY, ss * 4.6, ss * 0.95, 'RELEASE NOTES', ss * 0.3, 'solid', { ...MONO, track: 0.1 }),
  ];
  const area =
    x.f === 'x'
      ? { x: 34, y: 2.5, w: 64, h: x.H - 5 }
      : { x: m, y: tagY + ss + pick(x, 4, 6, 8), w: 100 - 2 * m, h: 0 };
  if (x.f !== 'x') area.h = x.H - area.y - m;
  const boxes = cells(n, area, 2, 1.05, x.f === 'st' ? 3 : 5);
  const cardsEls = boxes.flatMap((bx, i) => {
    const w = Math.min(bx.w * 0.92, bx.h * 0.92 * 1.08);
    const pad = w * 0.04;
    const imgH = (w - 2 * pad) / 1.55;
    const ts = clamp(w * 0.075, 0.8, 3.6);
    const h = pad + imgH + ts * 1.9;
    const cx = bx.x + bx.w / 2;
    const cy = bx.y + bx.h / 2;
    const px = cx - w / 2;
    const py = cy - h / 2;
    const group: ICElement[] = [
      x.b.rect(px, py, w, h, 'ink', { radius: w * 0.025 }),
      photo(x, `item${i + 1}_image`, px + pad, py + pad, w - 2 * pad, imgH, i, w * 0.015),
      x.b.text(`item${i + 1}_title`, px + pad * 1.2, py + pad + imgH + ts * 0.42, w - 2 * pad, x.copy.features[i][0], ts, {
        ...head(x),
        tone: 'bg',
      }),
      // Numbers follow the position, so their role is one renumbering skips. Every other card is taped.
      ...(i % 2 === 0
        ? [x.b.rect(cx - w * 0.14, py - ts * 0.35, w * 0.28, ts * 0.8, 'accent', { op: 0.6, rot: -3 })]
        : []),
      ellipse(x.b.rect(px - ts * 0.7, py - ts * 0.7, ts * 1.9, ts * 1.9, 'accent')),
      x.b.text(`number${i + 1}`, px - ts * 0.7, py - ts * 0.7 + ts * 0.47, ts * 1.9, String(i + 1).padStart(2, '0'), ts * 0.7, {
        ...MONO,
        weight: 800,
        tone: 'onAccent',
        align: 'center',
        lh: 1,
      }),
    ];
    return grouped(spin(group, cx, cy, TILTS[i % TILTS.length], x.H));
  });
  return [...words, ...cardsEls];
};

/** C: the release as a node in the middle, wired to feature cards like a playground flow. */
const graph: Build = (x, spec) => {
  const n = clamp(Number(spec) || 6, 2, 10);
  const m = pick(x, 3.5, 5, 6);
  const accent = x.c.kit.roles.accent;
  const second = x.light ? '#0f766e' : '#5eead4';
  const pr = pick(x, 0.45, 0.7, 0.85);
  const els: ICElement[] = [];
  // The hub: centered in X and a square, at the top of a story with cards below.
  const hw = pick(x, 24, 30, 58);
  const hh = pick(x, 15, 20, 30);
  const hx = (100 - hw) / 2;
  const hy = x.f === 'st' ? m + 2 : (x.H - hh) / 2;
  const hubPad = hw * 0.08;
  const lg = logo(x, hx + hubPad, hy + hubPad, hw * 0.46);
  const vs = hh * 0.34;
  // The hub and its end of every wire move as one piece.
  const hub: ICElement[] = [
    x.b.rect(hx - 0.6, hy - 0.6, hw + 1.2, hh + 1.2, 'accent', { op: 0.08, radius: hw * 0.09 }),
    x.b.rect(hx, hy, hw, hh, 'card', { line: 'accent', sw: 0.18, radius: hw * 0.075 }),
    lg.el,
    x.b.text('version', hx + hubPad, hy + hubPad + lg.h + hh * 0.05, hw - 2 * hubPad, 'v2.4.1', versionSize(x, vs, hw - 2 * hubPad), {
      ...head(x),
      weight: 900,
      tone: 'accent',
      track: -0.04,
      lh: 1,
    }),
    x.b.text('count', hx + hubPad, hy + hh - hubPad - vs * 0.3, hw - 2 * hubPad, `${n} NEW FEATURES`, vs * 0.2, {
      ...MONO,
      tone: 'muted',
      track: 0.12,
      lh: 1,
    }),
  ];
  const cardOf = (i: number, bx: Box) => {
    const pad = bx.w * 0.035;
    const ts = clamp(Math.min(bx.w * 0.065, bx.h * 0.16), 0.9, 3);
    const imgH = bx.h - 2 * pad - ts * 1.7;
    return [
      card(x, bx.x, bx.y, bx.w, bx.h, bx.w * 0.05),
      photo(x, `item${i + 1}_image`, bx.x + pad, bx.y + pad, bx.w - 2 * pad, imgH, i, bx.w * 0.03),
      x.b.rect(bx.x + pad * 1.4, bx.y + bx.h - pad - ts * 1.05, ts * 0.55, ts * 0.55, '', {
        fill: i % 2 ? second : accent,
        radius: ts * 0.12,
        pal: i % 2 ? {} : { fill: 'accent' },
      }),
      x.b.text(`item${i + 1}_title`, bx.x + pad * 1.4 + ts * 0.9, bx.y + bx.h - pad - ts * 1.3, bx.w - 2 * pad - ts, x.copy.features[i][0], ts, head(x)),
    ];
  };
  if (x.f === 'st') {
    // The hub feeds the first row; each card below hangs off the one above, so no wire crosses a card.
    const area = { x: m, y: hy + hh + 10, w: 100 - 2 * m, h: x.H - hy - hh - 10 - m };
    const boxes = cells(n, area, 5, 1.25, 2);
    const cards = boxes.map((bx, i) => cardOf(i, bx));
    boxes.forEach((bx, i) => {
      const color = i % 2 ? second : accent;
      const ex = bx.x + bx.w / 2;
      const end = port(x, ex, bx.y, pr, color);
      if (i < 2) {
        const sx = hx + hw * (n === 1 ? 0.5 : i === 0 ? 0.3 : 0.7);
        const start = port(x, sx, hy + hh, pr, color);
        els.push(wire(x, start, end, 'v', color));
        hub.push(start);
      } else {
        const up = boxes[i - 2];
        const start = port(x, up.x + up.w / 2, up.y + up.h, pr, color);
        els.push(wire(x, start, end, 'v', color));
        cards[i - 2].push(start);
      }
      cards[i].push(end);
    });
    return [...els, ...cards.flatMap((c) => grouped(c)), ...grouped(hub)];
  }
  const left = Math.ceil(n / 2);
  // Leaves room between the cards and the hub for the wires to curve.
  const cw = pick(x, 21, 22, 0);
  const colH = x.H - 2 * m;
  const place = (count: number, side: 'l' | 'r', offset: number) => {
    const gap = pick(x, 1.8, 2.4, 0);
    const ch = Math.min((colH - gap * (count - 1)) / count, cw * 0.72);
    const total = count * ch + gap * (count - 1);
    for (let k = 0; k < count; k++) {
      const i = offset + k;
      const bx = { x: side === 'l' ? m : 100 - m - cw, y: m + (colH - total) / 2 + k * (ch + gap), w: cw, h: ch };
      const color = i % 2 ? second : accent;
      const py = bx.y + bx.h / 2;
      const px = side === 'l' ? bx.x + bx.w : bx.x;
      const qx = side === 'l' ? hx : hx + hw;
      const qy = hy + hh * 0.2 + ((hh * 0.6) * (k + 0.5)) / count;
      const own = port(x, px, py, pr, color);
      const hubEnd = port(x, qx, qy, pr, color);
      els.push(
        side === 'l' ? wire(x, own, hubEnd, 'h', color) : wire(x, hubEnd, own, 'h', color),
        ...grouped([...cardOf(i, bx), own]),
      );
      hub.push(hubEnd);
    }
  };
  place(left, 'l', 0);
  place(n - left, 'r', left);
  return [...els, ...grouped(hub)];
};

/** D1 and D2: featured items with a screenshot, the rest as text, grouped by kind or marked. */
function changelog(style: 'grouped' | 'markers'): Build {
  return (x, spec) => {
    const items = parseChanges(spec || 'NNIniiiifnif').slice(0, 12);
    const m = pick(x, 4, 6, 7);
    const hd = header(x, 'V2.4.1 · SEPT 2026', 'Release notes', m);
    const els: ICElement[] = [...hd.els];
    const top = hd.bottom + pick(x, 2.6, 3.4, 4);
    const featured = items.map((it, i) => ({ ...it, i })).filter((it) => it.photo).slice(0, 4);
    const plain = items.map((it, i) => ({ ...it, i })).filter((it) => !featured.some((f) => f.i === it.i));
    const ts = pick(x, 1.35, 2, 2.6);
    // A kind label for featured items and grouped headings, a glyph square for markers.
    const mark = (k: Kind, i: number, px: number, py: number, s: number) => {
      const color = kindColor(x, k);
      return [
        x.b.rect(px, py, s, s, '', { fill: mix(color, x.c.kit.roles.bg, 0.84), radius: s * 0.28, pal: {} }),
        x.b.text(`item${i + 1}_mark`, px, py + s * 0.14, s, KIND_GLYPH[k], s * 0.62, { ...MONO, weight: 800, color, align: 'center', lh: 1, pal: {} }),
      ];
    };
    const label = (k: Kind, i: number, px: number, py: number, s: number) =>
      x.b.text(`item${i + 1}_kind`, px, py, 30, KIND_LABEL[k].toUpperCase(), s, { ...MONO, color: kindColor(x, k), track: 0.14, pal: {} });

    // Featured: a column on the left in X, a row on top in a square, stacked in a story.
    let text: Box = { x: m, y: top, w: 100 - 2 * m, h: x.H - top - m };
    if (featured.length) {
      const fa: Box =
        x.f === 'x'
          ? { x: m, y: top, w: 38, h: x.H - top - m }
          : x.f === 'sq'
            ? { x: m, y: top, w: 100 - 2 * m, h: 32 }
            : { x: m, y: top, w: 100 - 2 * m, h: Math.min(featured.length * 22, 70) };
      const gap = pick(x, 1.2, 1.6, 2);
      const fb =
        x.f === 'sq'
          ? cells(featured.length, fa, gap, 0.9, 4)
          : cells(featured.length, fa, gap, 99, 1);
      featured.forEach((it, k) => {
        const bx = fb[k];
        const pad = Math.min(bx.h * 0.07, 1.2);
        const iw = x.f === 'sq' ? bx.w - 2 * pad : Math.min((bx.h - 2 * pad) * 1.45, bx.w * 0.45);
        const ih = x.f === 'sq' ? bx.h * 0.55 : bx.h - 2 * pad;
        const tx = x.f === 'sq' ? bx.x + pad : bx.x + pad * 2 + iw;
        const ty = x.f === 'sq' ? bx.y + pad * 2 + ih : bx.y + pad * 1.6;
        const fts = clamp(Math.min(bx.h * 0.16, bx.w * 0.06), 1.2, ts * 1.4);
        const [title, desc] = x.copy.features[it.i];
        els.push(
          ...grouped([
          card(x, bx.x, bx.y, bx.w, bx.h, pad * 1.4),
          photo(x, `item${it.i + 1}_image`, bx.x + pad, bx.y + pad, iw, ih, it.i, pad * 0.7),
          ...(style === 'markers' ? mark(it.kind, it.i, tx, ty, fts * 1.3) : [label(it.kind, it.i, tx, ty, fts * 0.5)]),
          x.b.text(`item${it.i + 1}_title`, style === 'markers' ? tx + fts * 1.8 : tx, style === 'markers' ? ty + fts * 0.08 : ty + fts * 0.9, bx.x + bx.w - tx - pad, title, fts, head(x)),
          x.b.text(`item${it.i + 1}_desc`, tx, ty + fts * (style === 'markers' ? 1.9 : 2.3), bx.x + bx.w - tx - pad, desc, fts * 0.6, { tone: 'muted', lh: 1.3 }),
          ]),
        );
      });
      text =
        x.f === 'x'
          ? { x: m + fa.w + 3, y: top, w: 100 - 2 * m - fa.w - 3, h: x.H - top - m }
          : { x: m, y: fa.y + fa.h + pick(x, 3, 4, 5), w: 100 - 2 * m, h: x.H - (fa.y + fa.h + pick(x, 3, 4, 5)) - m };
    }
    if (!plain.length) return els;
    const cols = x.f === 'st' ? (plain.length > 7 ? 2 : 1) : featured.length ? 2 : plain.length > 8 ? 3 : 2;
    const colGap = pick(x, 3, 4, 4);
    const cw = (text.w - colGap * (cols - 1)) / cols;
    if (style === 'markers') {
      const per = Math.ceil(plain.length / cols);
      const rh = Math.min(text.h / per, ts * 4.2);
      const rs = clamp(rh * 0.3, 1, ts);
      plain.forEach((it, k) => {
        const col = Math.floor(k / per);
        const px = text.x + col * (cw + colGap);
        const py = text.y + (k % per) * rh;
        const [title, desc] = x.copy.features[it.i];
        els.push(
          x.b.rect(px, py, cw, 0.08, 'panel'),
          ...grouped([
            ...mark(it.kind, it.i, px, py + rh * 0.2, rs * 1.3),
            x.b.text(`item${it.i + 1}_title`, px + rs * 1.9, py + rh * 0.2, cw - rs * 2, title, rs, head(x)),
            x.b.text(`item${it.i + 1}_desc`, px + rs * 1.9, py + rh * 0.2 + rs * 1.25, cw - rs * 2, desc, rs * 0.72, { tone: 'muted' }),
          ]),
        );
      });
      return els;
    }
    // Grouped: New, Improved, Fixed, each a heading then its items, flowed down the columns.
    const groups = (['new', 'imp', 'fix'] as Kind[])
      .map((k) => ({ k, its: plain.filter((it) => it.kind === k) }))
      .filter((g) => g.its.length);
    const units = groups.reduce((s, g) => s + g.its.length + 0.8, 0) + (groups.length - 1) * 0.6;
    const perCol = Math.ceil(units / cols);
    const rh = Math.min((text.h / perCol) * 0.98, ts * 3.6);
    const rs = clamp(rh * 0.36, 1, ts);
    let col = 0;
    let used = 0;
    const at = () => ({ px: text.x + col * (cw + colGap), py: text.y + used * rh });
    for (const g of groups) {
      if (used > 0 && used + 0.8 + Math.min(g.its.length, 2) > perCol && col < cols - 1) {
        col += 1;
        used = 0;
      } else if (used > 0) used += 0.6;
      const h0 = at();
      els.push(
        x.b.text(`group_${g.k}`, h0.px, h0.py, cw * 0.7, `${KIND_LABEL[g.k].toUpperCase()}  ${g.its.length}`, rs * 0.62, {
          ...MONO,
          color: kindColor(x, g.k),
          track: 0.14,
          pal: {},
        }),
        x.b.rect(h0.px, h0.py + rs * 0.95, cw, 0.08, 'panel'),
      );
      used += 0.8;
      for (const it of g.its) {
        if (used + 1 > perCol + 0.01 && col < cols - 1) {
          col += 1;
          used = 0;
        }
        const p = at();
        const [title, desc] = x.copy.features[it.i];
        els.push(
          ...grouped([
            x.b.text(`item${it.i + 1}_title`, p.px, p.py + rh * 0.08, cw, title, rs, head(x)),
            x.b.text(`item${it.i + 1}_desc`, p.px, p.py + rh * 0.08 + rs * 1.2, cw, desc, rs * 0.72, { tone: 'muted' }),
          ]),
        );
        used += 1;
      }
    }
    return els;
  };
}

/** E: one lane per product with its icon, a screenshot and its top changes. */
const lanes: Build = (x, spec) => {
  const counts = parseProducts(spec || '3.3.3').slice(0, 4);
  const k = counts.length;
  const total = counts.reduce((a, b) => a + b, 0);
  const m = pick(x, 4, 5, 6);
  const hd = header(x, `V2.4.1 · ${k} PRODUCTS · ${total} UPDATES`, 'September update', m);
  const top = hd.bottom + pick(x, 2.4, 3.4, 4);
  const area = { x: m, y: top, w: 100 - 2 * m, h: x.H - top - m };
  const gap = pick(x, 1.6, 2, 2.4);
  const boxes = x.f === 'st' ? cells(k, area, gap, 99, 1) : cells(k, area, gap, 0.01, k);
  const els: ICElement[] = [...hd.els];
  counts.forEach((cnt, p) => {
    const lane: ICElement[] = [];
    const bx = boxes[p];
    const pad = pick(x, 1.2, 1.8, 2.2);
    const s = pick(x, 3, 4.6, 5.6);
    const pr = x.copy.products[p];
    const color = productColor(x, p);
    lane.push(
      card(x, bx.x, bx.y, bx.w, bx.h, pad * 1.4),
      ...productTile(x, p, bx.x + pad, bx.y + pad, s),
      x.b.text(`product${p + 1}_name`, bx.x + pad * 1.6 + s, bx.y + pad + s * 0.18, bx.w * 0.6, pr.name, s * 0.62, head(x)),
      x.b.text(`product${p + 1}_count`, bx.x + pad, bx.y + pad + s * 0.36, bx.w - 2 * pad, `${cnt} updates`, s * 0.26, {
        ...MONO,
        tone: 'muted',
        align: 'right',
      }),
    );
    // Screenshot under the header in lanes side by side; on the left of a row in a story.
    const st = x.f === 'st';
    const iy = bx.y + pad * 2 + s;
    const iw = st ? bx.w * 0.42 : bx.w - 2 * pad;
    const ih = st ? bx.y + bx.h - pad - iy : Math.min((bx.h - (iy - bx.y)) * 0.56, iw / 1.3);
    lane.push(photo(x, `product${p + 1}_image`, bx.x + pad, iy, iw, ih, pr.shot, pad * 0.6));
    const lx = st ? bx.x + pad * 2 + iw : bx.x + pad;
    const ly = st ? iy : iy + ih + pad;
    const lw = st ? bx.w - iw - pad * 3 : bx.w - 2 * pad;
    const rows = Math.min(cnt, 8);
    const rh = Math.min((bx.y + bx.h - pad - ly) / rows, pick(x, 3.6, 5.4, 6.4));
    const fs = clamp(rh * 0.42, 1, pick(x, 1.5, 2.3, 2.8));
    for (let j = 0; j < rows; j++) {
      const ry = ly + j * rh;
      lane.push(
        x.b.rect(lx, ry, lw, 0.08, 'panel'),
        ellipse(x.b.rect(lx, ry + rh / 2 - fs * 0.22, fs * 0.44, fs * 0.44, '', { fill: color, pal: p === 0 ? { fill: 'accent' } : {} })),
        x.b.text(`product${p + 1}_item${j + 1}`, lx + fs * 1.1, ry + rh / 2 - fs * 0.6, lw - fs * 1.2, pr.items[j], fs, {
          weight: 600,
          lh: 1.1,
        }),
      );
    }
    els.push(...grouped(lane));
  });
  return els;
};

const FAN_TILTS: Record<number, number[]> = { 2: [-5, 5], 3: [-7, 1, 7], 4: [-9, -3, 3, 9] };

/** F: the products fanned out like cards on a table beside a big headline. */
const fan: Build = (x, spec) => {
  const counts = parseProducts(spec || '5.4.6').slice(0, 4);
  const k = counts.length;
  const m = pick(x, 4.5, 6, 7);
  const hs = pick(x, 5.8, 8, 10);
  const lg = logo(x, m, 0, pick(x, 14, 20, 26));
  const blockH = lg.h + 3 + hs * 2.1 + 3 + 3.4;
  const by = x.f === 'x' ? (x.H - blockH) / 2 : m;
  const hy = by + lg.h + 3;
  const s = pick(x, 2.8, 4, 5);
  const iy = hy + hs * 2.1 + 3;
  const els: ICElement[] = [
    { ...lg.el, y: (by / x.H) * 100 },
    x.b.text('headline', m, hy, x.f === 'x' ? 36 : 88, 'One update.', hs, { ...head(x), weight: 900, track: -0.04, lh: 1.02 }),
    x.b.text('headline2', m, hy + hs * 1.05, x.f === 'x' ? 36 : 88, `${COUNT_WORDS[k - 1]} tools.`, hs, {
      ...head(x),
      weight: 900,
      track: -0.04,
      lh: 1.02,
      tone: 'accent',
    }),
    ...counts.flatMap((_, p) => productTile(x, p, m + p * (s + 1), iy, s)),
    x.b.text('meta', m + k * (s + 1) + 0.6, iy + s * 0.3, 30, 'v2.4.1 is out', s * 0.38, { ...MONO, tone: 'muted' }),
  ];
  const cw = pick(x, 25, 38, 58) * (k === 4 ? 0.85 : 1);
  const pad = cw * 0.03;
  const ih = (cw - 2 * pad) / 1.6;
  const ts = cw * 0.075;
  const ch = pad + ih + ts * 2;
  const tilts = FAN_TILTS[k] ?? FAN_TILTS[3];
  // Across the right side in X, below the headline in a square, down the page in a story.
  const cx0 = pick(x, 69, 50, 50);
  const cy0 = x.f === 'x' ? x.H / 2 : x.f === 'sq' ? (iy + s + x.H) / 2 + 2 : (iy + s + x.H) / 2;
  counts.forEach((cnt, p) => {
    const t = p - (k - 1) / 2;
    const cx = x.f === 'st' ? cx0 + t * 8 : cx0 + t * pick(x, k === 4 ? 13 : 17, k === 4 ? 17 : 22, 0);
    const cy = x.f === 'st' ? cy0 + t * (ch * 0.62) : cy0 + Math.abs(t) * 2.5 - (t === 0 ? 1.5 : 0);
    const px = cx - cw / 2;
    const py = cy - ch / 2;
    const pr = x.copy.products[p];
    const group: ICElement[] = [
      x.b.rect(px, py, cw, ch, 'card', { line: 'panel', sw: 0.12, radius: cw * 0.04 }),
      photo(x, `product${p + 1}_image`, px + pad, py + pad, cw - 2 * pad, ih, pr.shot, cw * 0.025),
      ...productTile(x, p, px + pad * 1.4, py + pad + ih + ts * 0.35, ts * 1.3),
      x.b.text(`product${p + 1}_name`, px + pad * 1.4 + ts * 1.7, py + pad + ih + ts * 0.5, cw * 0.5, pr.name, ts, head(x)),
      x.b.text(`product${p + 1}_count`, px + pad, py + pad + ih + ts * 0.8, cw - 2 * pad * 1.4, `${cnt} updates`, ts * 0.42, {
        ...MONO,
        tone: 'muted',
        align: 'right',
      }),
    ];
    els.push(...grouped(spin(group, cx, cy, tilts[p] ?? 0, x.H)));
  });
  return els;
};

interface Family {
  key: string;
  title: string;
  shape: ListShape;
  min: number;
  max: number;
  perMax?: number;
  photoMax?: number;
  spec: string;
  build: Build;
}

const FAMILIES: Family[] = [
  { key: 'bento', title: 'Feature bento', shape: 'count', min: 3, max: 12, spec: '7', build: bento },
  { key: 'pinboard', title: 'Feature pinboard', shape: 'count', min: 3, max: 12, spec: '6', build: pinboard },
  { key: 'graph', title: 'Feature graph', shape: 'count', min: 2, max: 10, spec: '6', build: graph },
  {
    key: 'notes',
    title: 'Release notes',
    shape: 'changelog',
    min: 3,
    max: 12,
    photoMax: 4,
    spec: 'NNIniiiifnif',
    build: changelog('grouped'),
  },
  {
    key: 'changelog',
    title: 'Changelog',
    shape: 'changelog',
    min: 3,
    max: 12,
    photoMax: 4,
    spec: 'NNIniiiifnif',
    build: changelog('markers'),
  },
  { key: 'lanes', title: 'Product lanes', shape: 'products', min: 2, max: 4, perMax: 8, spec: '3.3.3', build: lanes },
  { key: 'fan', title: 'Product fan', shape: 'products', min: 2, max: 4, perMax: 12, spec: '5.4.6', build: fan },
];

// ---------- templates ----------

const baseId = (brand: string, key: string) => (brand === 'acme' ? `update-${key}` : `update-${brand}-${key}`);

function build(c: Brand, fam: Family, spec: string): ICTemplate {
  const light = luminance(c.kit.roles.bg) > 0.5;
  const [[, base], ...rest] = FMTS.map(([f, ratio]) => {
    const b = layerBuilder(HEIGHT[f], c.kit.roles, f);
    const els = fam.build({ b, H: HEIGHT[f], f, c, light, copy: copyFor(c.id) }, spec);
    // The graph groups its dots differently in each size, so they take names from their groups.
    return [ratio, renumber(fam.key === 'graph' ? nameParts(els) : els)] as const;
  });
  const id = baseId(c.id, fam.key);
  return {
    id: spec === fam.spec ? id : `${id}~${spec}`,
    title: fam.title,
    pack: UPDATES_PACK,
    brand: c.id,
    family: `update-${fam.key}`,
    ratio: 'x-post',
    scene: false,
    scenePrompt: '',
    seed: 1,
    model: 'flux2-klein',
    thumb: c.kit.roles.bg,
    bg: brandBackground(c.kit),
    els: base,
    variants: Object.fromEntries(rest),
    source: null,
    kit: c.kit,
    list: {
      shape: fam.shape,
      spec,
      min: fam.min,
      max: fam.max,
      perMax: fam.perMax,
      photoMax: fam.photoMax,
    },
  };
}

export const UPDATES_TEMPLATES: ICTemplate[] = BRANDS.flatMap((c) => FAMILIES.map((fam) => build(c, fam, fam.spec)));

const cache = new Map<string, ICTemplate>();

/** The same list template with another item setup. Built once per setup. */
export function withSpec(t: ICTemplate, spec: string): ICTemplate {
  if (t.pack === BENCH_PACK_NAME) return benchWithSpec(t, spec);
  const fam = FAMILIES.find((f) => `update-${f.key}` === t.family);
  const c = BRANDS.find((b) => b.id === t.brand);
  if (!fam || !c || !t.list) return t;
  const key = `${c.id}|${fam.key}|${spec}`;
  let built = cache.get(key);
  if (!built) {
    built = withCards(build(c, fam, spec));
    cache.set(key, built);
  }
  return built;
}

// ---------- changing the items ----------

const ITEM = /^(item|product)(\d+)(_.*)$/;
const PRODUCT_ITEM = /^(product\d+_item)(\d+)$/;

/** Renames item layers' roles and slots with `rename`, dropping the ones it returns null for, so a
 *  rebuild puts each item's words where its new number goes. */
function renameItems(els: ICElement[], rename: (prefix: string, n: number, rest: string) => string | null): ICElement[] {
  return els.flatMap((e) => {
    const name = e.t === 'text' || e.t === 'pill' ? e.role : e.t === 'image' ? e.slot : undefined;
    if (!name) return [e];
    const m = ITEM.exec(name);
    if (!m) return [e];
    const next = rename(m[1], Number(m[2]), m[3]);
    if (next === null) return [];
    if (next === name) return [e];
    if (e.t === 'text' || e.t === 'pill') return [{ ...e, role: next, slot: next }];
    if (e.t === 'image') return [{ ...e, slot: next, name: next }];
    return [e];
  });
}

export type ListEdit =
  | { op: 'add' }
  | { op: 'remove'; index: number }
  | { op: 'kind'; index: number; kind: Kind }
  | { op: 'photo'; index: number; photo: boolean }
  | { op: 'add-item'; product: number }
  | { op: 'remove-item'; product: number }
  | { op: 'active'; index: number };

/** The new spec for an edit, and how the current layers renumber to match it. */
export function editSpec(
  info: ListInfo,
  edit: ListEdit,
): { spec: string; rename?: (prefix: string, n: number, rest: string) => string | null } | null {
  if (info.shape === 'ranked') {
    const { n, active } = parseRanked(info.spec);
    if (edit.op === 'add' && n < info.max) return { spec: rankedSpec(n + 1, active) };
    if (edit.op === 'active') return { spec: rankedSpec(n, edit.index) };
    if (edit.op === 'remove' && n > info.min) {
      const at = edit.index + 1;
      // Removing the active item makes the first one active; one before it moves it up a place.
      const next = edit.index === active ? 0 : edit.index < active ? active - 1 : active;
      return {
        spec: rankedSpec(n - 1, next),
        rename: (p, k, rest) => (p !== 'item' ? `${p}${k}${rest}` : k === at ? null : `item${k > at ? k - 1 : k}${rest}`),
      };
    }
    return null;
  }
  if (info.shape === 'count') {
    const n = Number(info.spec);
    if (edit.op === 'add' && n < info.max) return { spec: String(n + 1) };
    if (edit.op === 'remove' && n > info.min) {
      const at = edit.index + 1;
      return {
        spec: String(n - 1),
        rename: (p, k, rest) => (p !== 'item' ? `${p}${k}${rest}` : k === at ? null : `item${k > at ? k - 1 : k}${rest}`),
      };
    }
    return null;
  }
  if (info.shape === 'changelog') {
    const items = parseChanges(info.spec);
    const photos = items.filter((i) => i.photo).length;
    if (edit.op === 'add' && items.length < info.max)
      return { spec: changesSpec([...items, { kind: 'new', photo: false }]) };
    if (edit.op === 'remove' && items.length > info.min) {
      const at = edit.index + 1;
      return {
        spec: changesSpec(items.filter((_, i) => i !== edit.index)),
        rename: (p, k, rest) => (p !== 'item' ? `${p}${k}${rest}` : k === at ? null : `item${k > at ? k - 1 : k}${rest}`),
      };
    }
    if (edit.op === 'kind')
      return { spec: changesSpec(items.map((it, i) => (i === edit.index ? { ...it, kind: edit.kind } : it))) };
    if (edit.op === 'photo' && (!edit.photo || photos < (info.photoMax ?? 4)))
      return { spec: changesSpec(items.map((it, i) => (i === edit.index ? { ...it, photo: edit.photo } : it))) };
    return null;
  }
  const counts = parseProducts(info.spec);
  if (edit.op === 'add' && counts.length < info.max) return { spec: productsSpec([...counts, 3]) };
  if (edit.op === 'remove' && counts.length > info.min) {
    const at = edit.index + 1;
    return {
      spec: productsSpec(counts.filter((_, i) => i !== edit.index)),
      rename: (p, k, rest) => (p !== 'product' ? `${p}${k}${rest}` : k === at ? null : `product${k > at ? k - 1 : k}${rest}`),
    };
  }
  if (edit.op === 'add-item' && counts[edit.product] < (info.perMax ?? 8))
    return { spec: productsSpec(counts.map((c, i) => (i === edit.product ? c + 1 : c))) };
  if (edit.op === 'remove-item' && counts[edit.product] > 1) {
    const last = counts[edit.product];
    return {
      spec: productsSpec(counts.map((c, i) => (i === edit.product ? c - 1 : c))),
      rename: (p, k, rest) => {
        const m = PRODUCT_ITEM.exec(`${p}${k}${rest}`);
        return p === 'product' && k === edit.product + 1 && m && Number(m[2]) === last ? null : `${p}${k}${rest}`;
      },
    };
  }
  return null;
}

/** Applies an item edit: renumbers the layers the edit shifts, then rebuilds with the new setup. */
export function editList(
  layout: ICLayout,
  current: ICTemplate,
  edit: ListEdit,
  rebuild: (next: ICTemplate, previous: ICLayout, previousTemplate: ICTemplate) => ICLayout,
): ICLayout {
  if (!current.list) return layout;
  const change = editSpec(current.list, edit);
  if (!change) return layout;
  const next = withSpec(current, change.spec);
  // The removed item's words and pictures leave and the ones after it move up a place. Compared
  // with the template as it was, moved placeholder copy reads as changed, so it moves too.
  const previous = change.rename ? { ...layout, els: renameItems(layout.els, change.rename) } : layout;
  const built = rebuild(next, previous, current);
  if (edit.op === 'add' || edit.op === 'add-item') fillNew(built.els, current.list, edit, copyFor(current.brand));
  // The design's own background, grid, thread and added layers stay; only the list changes.
  return {
    ...layout,
    templateId: next.id,
    els: [...built.els.filter((e) => !e.user), ...layout.els.filter((e) => e.user)],
    // Positions remembered for other sizes belong to the old list and would mix with the new one.
    sizes: undefined,
  };
}

/** A new item's copy is its position's placeholder, which an earlier item may already show after a
 *  removal. It takes the first placeholder no other item uses instead. */
function fillNew(els: ICElement[], info: ListInfo, edit: ListEdit, { features, products }: Copy) {
  // A ranked list's new item keeps its own placeholder name and score.
  if (info.shape === 'ranked') return;
  const texts = (re: RegExp) =>
    els.flatMap((e) => ((e.t === 'text' || e.t === 'pill') && re.test(e.role) ? [e] : []));
  const setText = (role: string, text: string) => {
    for (const e of els) if ((e.t === 'text' || e.t === 'pill') && e.role === role) e.text = text;
  };
  if (info.shape === 'products') {
    if (edit.op === 'add') {
      const k = parseProducts(info.spec).length + 1;
      const used = new Set(texts(/^product\d+_name$/).filter((e) => e.role !== `product${k}_name`).map((e) => e.text));
      const name = products.map((p) => p.name).find((nm) => !used.has(nm));
      if (name) setText(`product${k}_name`, name);
    } else if (edit.op === 'add-item') {
      const p = edit.product;
      const j = parseProducts(info.spec)[p] + 1;
      const role = `product${p + 1}_item${j}`;
      const used = new Set(texts(new RegExp(`^product${p + 1}_item\\d+$`)).filter((e) => e.role !== role).map((e) => e.text));
      const pool = [...(products[p]?.items ?? []), ...products.flatMap((x) => x.items)];
      const name = pool.find((nm) => !used.has(nm));
      if (name) setText(role, name);
    }
    return;
  }
  const n = (info.shape === 'count' ? Number(info.spec) : parseChanges(info.spec).length) + 1;
  const used = new Set(texts(/^item\d+_title$/).filter((e) => e.role !== `item${n}_title`).map((e) => e.text));
  const next = features.find(([title]) => !used.has(title));
  if (!next) return;
  setText(`item${n}_title`, next[0]);
  setText(`item${n}_desc`, next[1]);
}

/** Each item's title as typed, for the Items list in the panel. */
export function itemTitles(layout: ICLayout, info: ListInfo): string[] {
  const text = (role: string) => {
    const e = layout.els.find((x) => (x.t === 'text' || x.t === 'pill') && x.role === role);
    return e && (e.t === 'text' || e.t === 'pill') ? e.text.replace(/\s+/g, ' ').trim() : '';
  };
  if (info.shape === 'products') return parseProducts(info.spec).map((_, p) => text(`product${p + 1}_name`));
  if (info.shape === 'ranked')
    return Array.from({ length: parseRanked(info.spec).n }, (_, i) => text(`item${i + 1}_name`));
  const n = info.shape === 'count' ? Number(info.spec) : parseChanges(info.spec).length;
  return Array.from({ length: n }, (_, i) => text(`item${i + 1}_title`));
}
