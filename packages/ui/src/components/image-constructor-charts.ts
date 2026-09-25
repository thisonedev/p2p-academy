// Charts drawn from data the person types, pastes or loads from a file. A chart is an art layer whose
// drawing is built from the layer's own `data`, in the design's colors.

import type { ICArtDef, ICArtSlot } from './image-constructor-art.js';
import { mix } from './image-constructor-palettes.js';

export interface ICChartData {
  /** One label per point, along the bottom. */
  labels: string[];
  series: { name: string; values: number[] }[];
  /** Points marked with a dot, by index, on a line chart. */
  marks?: number[];
  /** Put before each axis value, such as "$". */
  prefix?: string;
}

export const CHART_KINDS = [
  ['chart-line', 'Line'],
  ['chart-lines', 'Lines'],
  ['chart-glow', 'Glowing line'],
  ['chart-area', 'Stacked area'],
  ['chart-bars', 'Bars'],
  ['chart-columns', 'Grouped bars'],
  ['chart-hbars', 'Horizontal bars'],
  ['chart-donut', 'Donut'],
  ['chart-candles', 'Candles'],
] as const;

export type ChartKind = (typeof CHART_KINDS)[number][0];

export const isChart = (id: string): id is ChartKind => CHART_KINDS.some(([k]) => k === id);

const SLOTS: ICArtSlot[] = [
  { key: 'main', label: 'Main', role: 'accent', color: '#6366f1' },
  { key: 'detail', label: 'Labels', role: 'muted', color: '#6b7185' },
  { key: 'line', label: 'Line', role: 'ink', color: '#10131c' },
];

const W = 160;
const H = 100;
const PLOT = { x0: 20, x1: 156, y0: 8, y1: 84 };
const FONT = 'font-family="Inter, Helvetica, Arial, sans-serif"';
const f = (n: number) => n.toFixed(2);

/** 1234567 → 1.2M, with the data's prefix. */
export function short(n: number, prefix = ''): string {
  const a = Math.abs(n);
  const [d, s] = a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'K'] : [1, ''];
  const v = n / d;
  return `${prefix}${Number.isInteger(v) ? v : v.toFixed(1)}${s}`;
}

/** Axis steps that land on round numbers. */
function niceMax(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 0.25 };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return { top: step * Math.ceil(max / step), step };
}

/** Gridlines and value labels from `base` up to `base + top`, then the point labels below. */
function axes(data: ICChartData, top: number, step: number, dashed: boolean, base = 0): string {
  let out = '';
  for (let v = 0; v <= top + 1e-9; v += step) {
    const y = PLOT.y1 - (v / top) * (PLOT.y1 - PLOT.y0);
    out += `<path d="M${PLOT.x0} ${f(y)}H${PLOT.x1}" stroke="{{detail}}" stroke-width=".25" opacity=".45"${dashed ? ' stroke-dasharray="1.2 1.2"' : ''}/>`;
    out += `<text x="${PLOT.x0 - 2}" y="${f(y + 1.3)}" text-anchor="end" font-size="3.6" fill="{{detail}}" ${FONT}>${short(base + v, data.prefix)}</text>`;
  }
  const n = data.labels.length;
  // Every label that has text, thinned out past seven so they never crowd.
  const shown = data.labels.map((label, i) => [label, i] as const).filter(([label]) => label);
  const every = Math.max(1, Math.ceil(shown.length / 7));
  shown.forEach(([label, i], k) => {
    if (k % every && k !== shown.length - 1) return;
    const x = PLOT.x0 + (n > 1 ? (i / (n - 1)) * (PLOT.x1 - PLOT.x0) : 0);
    const anchor = x < PLOT.x0 + 6 ? 'start' : x > PLOT.x1 - 6 ? 'end' : 'middle';
    out += `<text x="${f(x)}" y="${PLOT.y1 + 7}" text-anchor="${anchor}" font-size="3.6" fill="{{detail}}" ${FONT}>${esc(label)}</text>`;
  });
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function points(values: number[], top: number): [number, number][] {
  const n = values.length;
  return values.map((v, i) => [
    PLOT.x0 + (n > 1 ? (i / (n - 1)) * (PLOT.x1 - PLOT.x0) : 0),
    PLOT.y1 - (Math.max(0, v) / top) * (PLOT.y1 - PLOT.y0),
  ]);
}

/** A smooth path through points, with control points a third of the way to each neighbor. */
function smooth(pts: [number, number][]): string {
  if (!pts.length) return '';
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const dx = (x1 - x0) / 3;
    d += `C${f(x0 + dx)} ${f(y0)} ${f(x1 - dx)} ${f(y1)} ${f(x1)} ${f(y1)}`;
  }
  return d;
}

function line(data: ICChartData): string {
  const values = data.series[0]?.values ?? [];
  const { top, step } = niceMax(Math.max(...values, 0));
  const pts = points(values, top);
  const d = smooth(pts);
  const last = pts[pts.length - 1];
  const marks = (data.marks ?? [])
    .filter((i) => pts[i])
    .map(
      (i) =>
        `<circle cx="${f(pts[i][0])}" cy="${f(pts[i][1])}" r="1.6" fill="#fff" stroke="{{line}}" stroke-width=".45"/>`,
    )
    .join('');
  return (
    `<defs><linearGradient id="cl-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{main}}" stop-opacity=".28"/><stop offset="1" stop-color="{{main}}" stop-opacity="0"/></linearGradient></defs>` +
    axes(data, top, step, false) +
    (last
      ? `<path d="${d}L${f(last[0])} ${PLOT.y1}L${PLOT.x0} ${PLOT.y1}Z" fill="url(#cl-g)"/>`
      : '') +
    `<path d="${d}" fill="none" stroke="{{line}}" stroke-width=".6" stroke-linejoin="round"/>` +
    marks +
    (last ? `<circle cx="${f(last[0])}" cy="${f(last[1])}" r="1.2" fill="{{line}}"/>` : '')
  );
}

function glow(data: ICChartData): string {
  const values = data.series[0]?.values ?? [];
  const { top, step } = niceMax(Math.max(...values, 0));
  const pts = points(values, top);
  // Steps, like a price that moves in jumps.
  const d = pts.map(([x, y], i) => (i ? `H${f(x)}V${f(y)}` : `M${f(x)} ${f(y)}`)).join('');
  const last = pts[pts.length - 1];
  return (
    `<defs><filter id="cg-b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>` +
    axes(data, top, step, true) +
    `<path d="${d}" fill="none" stroke="{{main}}" stroke-width="2.4" opacity=".8" filter="url(#cg-b)"/>` +
    `<path d="${d}" fill="none" stroke="#fff" stroke-width=".7" stroke-linejoin="round"/>` +
    (last
      ? `<circle cx="${f(last[0])}" cy="${f(last[1])}" r="4" fill="{{main}}" opacity=".45" filter="url(#cg-b)"/><circle cx="${f(last[0])}" cy="${f(last[1])}" r="1.8" fill="#fff"/>`
      : '')
  );
}

/** Colors for stacked series: from the main color toward the labels color and back through ink. */
export function seriesColors(n: number, main: string, detail: string, ink: string): string[] {
  return Array.from({ length: n }, (_, i) => {
    const t = n > 1 ? i / (n - 1) : 0;
    return t < 0.5 ? mix(main, detail, t * 1.4) : mix(detail, ink, (t - 0.5) * 1.2);
  });
}

function area(data: ICChartData, colors: Record<string, string>): string {
  const n = data.labels.length;
  const totals = Array.from({ length: n }, (_, i) =>
    data.series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0),
  );
  const { top, step } = niceMax(Math.max(...totals, 0));
  const shades = seriesColors(
    data.series.length,
    colors.main ?? '#6366f1',
    colors.detail ?? '#6b7185',
    colors.line ?? '#10131c',
  );
  const base = new Array(n).fill(0);
  const bands = data.series.map((s, k) => {
    const lower = points(base.slice(), top);
    s.values.forEach((v, i) => {
      base[i] += v ?? 0;
    });
    const upper = points(base.slice(), top);
    const d = `M${upper.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}L${lower
      .reverse()
      .map(([x, y]) => `${f(x)} ${f(y)}`)
      .join('L')}Z`;
    return `<path d="${d}" fill="${shades[k]}"/>`;
  });
  return axes(data, top, step, true) + bands.reverse().join('');
}

function bars(data: ICChartData): string {
  const values = data.series[0]?.values ?? [];
  const { top, step } = niceMax(Math.max(...values, 0));
  const n = values.length;
  const slot = (PLOT.x1 - PLOT.x0) / Math.max(1, n);
  const out = values
    .map((v, i) => {
      const h = (Math.max(0, v) / top) * (PLOT.y1 - PLOT.y0);
      const x = PLOT.x0 + i * slot + slot * 0.18;
      return `<rect x="${f(x)}" y="${f(PLOT.y1 - h)}" width="${f(slot * 0.64)}" height="${f(h)}" rx="1" fill="{{main}}" opacity="${i === n - 1 ? 1 : 0.55}"/>`;
    })
    .join('');
  // Bar labels sit under each bar, so the axis draws values only.
  return (
    axes({ ...data, labels: [] }, top, step, false) +
    out +
    data.labels
      .map(
        (label, i) =>
          `<text x="${f(PLOT.x0 + (i + 0.5) * slot)}" y="${PLOT.y1 + 7}" text-anchor="middle" font-size="3.6" fill="{{detail}}" ${FONT}>${esc(label)}</text>`,
      )
      .join('')
  );
}

/** A small legend in the top left: a swatch and a name per series. */
function legend(names: string[], colors: string[]): string {
  return names
    .map(
      (name, i) =>
        `<rect x="${PLOT.x0 + 2 + i * 26}" y="1" width="2.6" height="2.6" rx=".6" fill="${colors[i]}"/>` +
        `<text x="${PLOT.x0 + 6 + i * 26}" y="3.3" font-size="3.2" fill="{{detail}}" ${FONT}>${esc(name.slice(0, 12))}</text>`,
    )
    .join('');
}

const shades = (data: ICChartData, colors: Record<string, string>) =>
  seriesColors(
    data.series.length,
    colors.main ?? '#6366f1',
    colors.detail ?? '#6b7185',
    colors.line ?? '#10131c',
  );

function lines(data: ICChartData, colors: Record<string, string>): string {
  const all = data.series.flatMap((s) => s.values);
  const { top, step } = niceMax(Math.max(...all, 0));
  const c = shades(data, colors);
  const paths = data.series
    .map(
      (s, k) =>
        `<path d="${smooth(points(s.values, top))}" fill="none" stroke="${c[k]}" stroke-width=".8" stroke-linejoin="round"/>`,
    )
    .join('');
  return (
    axes(data, top, step, true) +
    paths +
    legend(
      data.series.map((s) => s.name),
      c,
    )
  );
}

function columns(data: ICChartData, colors: Record<string, string>): string {
  const all = data.series.flatMap((s) => s.values);
  const { top, step } = niceMax(Math.max(...all, 0));
  const c = shades(data, colors);
  const n = data.labels.length;
  const slot = (PLOT.x1 - PLOT.x0) / Math.max(1, n);
  const bw = (slot * 0.7) / Math.max(1, data.series.length);
  const rects = data.labels
    .map((_, i) =>
      data.series
        .map((s, k) => {
          const h = (Math.max(0, s.values[i] ?? 0) / top) * (PLOT.y1 - PLOT.y0);
          const x = PLOT.x0 + i * slot + slot * 0.15 + k * bw;
          return `<rect x="${f(x)}" y="${f(PLOT.y1 - h)}" width="${f(bw * 0.9)}" height="${f(h)}" rx=".6" fill="${c[k]}"/>`;
        })
        .join(''),
    )
    .join('');
  const labels = data.labels
    .map(
      (label, i) =>
        `<text x="${f(PLOT.x0 + (i + 0.5) * slot)}" y="${PLOT.y1 + 7}" text-anchor="middle" font-size="3.6" fill="{{detail}}" ${FONT}>${esc(label)}</text>`,
    )
    .join('');
  return (
    axes({ ...data, labels: [] }, top, step, false) +
    rects +
    labels +
    legend(
      data.series.map((s) => s.name),
      c,
    )
  );
}

function hbars(data: ICChartData): string {
  const values = data.series[0]?.values ?? [];
  const max = Math.max(...values, 1);
  const n = values.length;
  const row = 88 / Math.max(1, n);
  const x0 = 36;
  return values
    .map((v, i) => {
      const y = 6 + i * row;
      const w = (Math.max(0, v) / max) * (W - x0 - 26);
      return (
        `<text x="${x0 - 3}" y="${f(y + row * 0.5 + 1.3)}" text-anchor="end" font-size="3.8" fill="{{detail}}" ${FONT}>${esc(data.labels[i] ?? '')}</text>` +
        `<rect x="${x0}" y="${f(y + row * 0.18)}" width="${f(w)}" height="${f(row * 0.64)}" rx="1" fill="{{main}}" opacity="${i === 0 ? 1 : 0.6}"/>` +
        `<text x="${f(x0 + w + 2)}" y="${f(y + row * 0.5 + 1.3)}" font-size="3.8" fill="{{line}}" ${FONT}>${short(v, data.prefix)}</text>`
      );
    })
    .join('');
}

function donut(full: ICChartData, colors: Record<string, string>): string {
  // More than six slices stop reading; the biggest five stay and the rest become Other.
  const rows = full.labels.map(
    (label, i) => [label, Math.max(0, full.series[0]?.values[i] ?? 0)] as const,
  );
  const kept = rows.length > 6 ? [...rows].sort((a, b) => b[1] - a[1]).slice(0, 5) : rows;
  const rest =
    rows.length > 6
      ? rows.filter((row) => !kept.includes(row)).reduce((sum, row) => sum + row[1], 0)
      : 0;
  const slices = rest ? [...kept, ['Other', rest] as const] : kept;
  const data = {
    labels: slices.map(([label]) => label || '—'),
    series: [{ name: '', values: slices.map(([, v]) => v) }],
  };
  const values = data.series[0].values;
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const c = seriesColors(
    values.length,
    colors.main ?? '#6366f1',
    colors.detail ?? '#6b7185',
    colors.line ?? '#10131c',
  );
  const cx = 50;
  const cy = 50;
  const rr = 36;
  let a = -Math.PI / 2;
  const arcs = values
    .map((v, i) => {
      const sweep = (v / total) * Math.PI * 2;
      const a2 = a + sweep;
      const large = sweep > Math.PI ? 1 : 0;
      const d = `M${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}A${rr} ${rr} 0 ${large} 1 ${f(cx + rr * Math.cos(a2 - 0.001))} ${f(cy + rr * Math.sin(a2 - 0.001))}`;
      a = a2;
      return `<path d="${d}" fill="none" stroke="${c[i]}" stroke-width="14"/>`;
    })
    .join('');
  const key = data.labels
    .map(
      (label, i) =>
        `<rect x="100" y="${f(18 + i * 9)}" width="4" height="4" rx="1" fill="${c[i]}"/>` +
        `<text x="107" y="${f(21.4 + i * 9)}" font-size="4" fill="{{line}}" ${FONT}>${esc(label.slice(0, 14))}</text>` +
        `<text x="156" y="${f(21.4 + i * 9)}" text-anchor="end" font-size="4" fill="{{detail}}" ${FONT}>${Math.round(((values[i] ?? 0) / total) * 100)}%</text>`,
    )
    .join('');
  return arcs + key;
}

/** Open, high, low and close, one candle per label: the main color going up, the labels color down. */
function candles(data: ICChartData): string {
  const [open, high, low, close] = [0, 1, 2, 3].map((k) => data.series[k]?.values ?? []);
  // Prices sit far from zero, so the axis spans only their own range.
  const hi = Math.max(...high, ...open, ...close);
  const lo = Math.min(...(low.length ? low : [...open, ...close]));
  const { step: s0 } = niceMax(Math.max(hi - lo, 1e-9));
  const base = Math.floor(lo / s0) * s0;
  const { top, step } = niceMax(hi - base);
  const n = data.labels.length;
  const slot = (PLOT.x1 - PLOT.x0) / Math.max(1, n);
  const y = (v: number) => PLOT.y1 - (Math.max(0, v - base) / top) * (PLOT.y1 - PLOT.y0);
  const body = data.labels
    .map((_, i) => {
      const o = open[i] ?? 0;
      const cl = close[i] ?? o;
      const color = cl >= o ? '{{main}}' : '{{detail}}';
      const x = PLOT.x0 + (i + 0.5) * slot;
      const h = Math.max(0.6, Math.abs(y(o) - y(cl)));
      return (
        `<path d="M${f(x)} ${f(y(high[i] ?? Math.max(o, cl)))}V${f(y(low[i] ?? Math.min(o, cl)))}" stroke="${color}" stroke-width=".5"/>` +
        `<rect x="${f(x - slot * 0.3)}" y="${f(y(Math.max(o, cl)))}" width="${f(slot * 0.6)}" height="${f(h)}" fill="${color}"/>`
      );
    })
    .join('');
  return axes(data, top, step, true, base) + body;
}

/** Sample data each kind starts with. */
export function sampleData(kind: ChartKind): ICChartData {
  const years = ['2022', '2023', '2024', '2025', '2026'];
  const months = Array.from({ length: 25 }, (_, i) =>
    i % 6 === 0 ? `Q${((i / 6) % 4) + 1} '${24 + Math.floor(i / 12)}` : '',
  );
  if (kind === 'chart-area') {
    return {
      labels: months,
      prefix: '$',
      series: ['Treasuries', 'Commodities', 'Credit', 'Stocks', 'Other'].map((name, k) => ({
        name,
        values: months.map((_, i) => Math.round((1 + i ** 1.6 / 4) * (5 - k) * 0.4 * 1e9)),
      })),
    };
  }
  if (kind === 'chart-lines' || kind === 'chart-columns') {
    const labels = kind === 'chart-lines' ? months : ['Q1', 'Q2', 'Q3', 'Q4'];
    const len = labels.length;
    return {
      labels,
      prefix: '$',
      series: ['Your Brand', 'Partner', 'Market'].map((name, k) => ({
        name,
        values: Array.from({ length: len }, (_, i) =>
          Math.round((1 + (i / len) * (3 - k) + (i % 3) * 0.2) * 1e8),
        ),
      })),
    };
  }
  if (kind === 'chart-hbars') {
    return {
      labels: ['Ethereum', 'Tron', 'Solana', 'Base', 'Arbitrum'],
      prefix: '$',
      series: [{ name: 'Volume', values: [82, 64, 41, 23, 12].map((v) => v * 1e9) }],
    };
  }
  if (kind === 'chart-donut') {
    return {
      labels: ['Treasuries', 'Commodities', 'Credit', 'Stocks'],
      series: [{ name: 'Share', values: [52, 21, 17, 10] }],
    };
  }
  if (kind === 'chart-candles') {
    let price = 60;
    const rows = Array.from({ length: 24 }, (_, i) => {
      const o = price;
      const c = o + Math.sin(i * 1.7) * 6 + i * 0.6;
      price = c;
      return [o, Math.max(o, c) + 3, Math.min(o, c) - 3, c];
    });
    return {
      labels: rows.map((_, i) => (i % 6 === 0 ? `W${i / 6 + 1}` : '')),
      prefix: '$',
      series: ['Open', 'High', 'Low', 'Close'].map((name, k) => ({
        name,
        values: rows.map((row) => Math.round(row[k] * 10) / 10),
      })),
    };
  }
  if (kind === 'chart-bars') {
    return {
      labels: years,
      prefix: '$',
      series: [{ name: 'Volume', values: [12, 28, 64, 118, 210].map((v) => v * 1e9) }],
    };
  }
  if (kind === 'chart-glow') {
    const values = months.map((_, i) =>
      Math.round((0.05 + (i / 24) ** 2.3 * 4.6 + (i % 3 === 1 ? 0.12 : 0)) * 1e9),
    );
    return { labels: months, prefix: '$', series: [{ name: 'Value', values }] };
  }
  const values = Array.from({ length: 21 }, (_, i) => Math.round((i / 20) ** 2.4 * 300 * 1e9));
  return {
    labels: Array.from({ length: 21 }, (_, i) => (i % 5 === 0 ? years[i / 5] : '')),
    prefix: '$',
    series: [{ name: 'Volume', values }],
    marks: [6, 9, 11, 13, 15, 17, 19],
  };
}

const cache = new Map<string, ICArtDef>();

/** The drawing for a chart layer, from its kind, data and colors. */
export function chartDef(
  kind: ChartKind,
  data: ICChartData,
  colors: Record<string, string> = {},
): ICArtDef {
  const key = `${kind}|${JSON.stringify(data)}|${JSON.stringify(colors)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const draw: Record<ChartKind, () => string> = {
    'chart-line': () => line(data),
    'chart-lines': () => lines(data, colors),
    'chart-glow': () => glow(data),
    'chart-area': () => area(data, colors),
    'chart-bars': () => bars(data),
    'chart-columns': () => columns(data, colors),
    'chart-hbars': () => hbars(data),
    'chart-donut': () => donut(data, colors),
    'chart-candles': () => candles(data),
  };
  const body = draw[kind]();
  const def: ICArtDef = {
    id: kind,
    name: CHART_KINDS.find(([k]) => k === kind)?.[1] ?? kind,
    kind: 'shape',
    group: 'Charts',
    ratio: W / H,
    viewBox: `0 0 ${W} ${H}`,
    body,
    slots: SLOTS,
  };
  if (cache.size > 200) cache.clear();
  cache.set(key, def);
  return def;
}

/** Library entries, drawn from sample data, for the Elements tab. */
export const CHARTS: ICArtDef[] = CHART_KINDS.map(([kind]) => chartDef(kind, sampleData(kind)));

/** 12.5, "$1.2B", "3,400" or "40%" as a number. */
export function num(raw: string): number {
  const s = raw.trim().replace(/[$,%\s]/g, '');
  const m = /^(-?[\d.]+)([kKmMbBtT]?)$/.exec(s);
  if (!m) return Number.NaN;
  const mult = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[m[2].toLowerCase()] ?? 1;
  return Number(m[1]) * mult;
}

/**
 * Chart data from pasted or loaded text. CSV: one row per point, the first column the label and
 * each other column a series, with an optional header row of names. JSON: `{ labels, series }`,
 * or a list of `{ label, value }` rows.
 */
export function parseChartData(text: string): ICChartData | null {
  const t = text.trim();
  if (!t) return null;
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const v = JSON.parse(t) as unknown;
      if (Array.isArray(v)) {
        // Rows of objects, as most APIs return them: the first text field labels each point and
        // every numeric field becomes a series.
        const rows = v.filter(
          (row): row is Record<string, unknown> => !!row && typeof row === 'object',
        );
        if (!rows.length) return null;
        const keys = Object.keys(rows[0]);
        const numeric = keys.filter((k) =>
          rows.every((row) => !Number.isNaN(num(String(row[k] ?? '')))),
        );
        const labelKey = keys.find((k) => !numeric.includes(k)) ?? 'label';
        const seriesKeys = numeric.filter((k) => k !== labelKey);
        if (!seriesKeys.length) return null;
        return {
          labels: rows.map((row) => String(row[labelKey] ?? '')),
          series: seriesKeys.map((k) => ({
            name: k,
            values: rows.map((row) => num(String(row[k] ?? 0)) || 0),
          })),
        };
      }
      const o = v as Partial<ICChartData>;
      if (Array.isArray(o.labels) && Array.isArray(o.series)) return o as ICChartData;
    } catch {
      return null;
    }
    return null;
  }
  const rows = t.split(/\r?\n/).map((line) => line.split(/[,\t;]/).map((c) => c.trim()));
  const header = rows[0].slice(1).every((c) => Number.isNaN(num(c))) ? rows.shift() : undefined;
  const cols = Math.max(...rows.map((r) => r.length)) - 1;
  if (cols < 1 || !rows.length) return null;
  return {
    labels: rows.map((r) => r[0] ?? ''),
    series: Array.from({ length: cols }, (_, k) => ({
      name: header?.[k + 1] || `Series ${k + 1}`,
      values: rows.map((r) => {
        const n = num(r[k + 1] ?? '');
        return Number.isNaN(n) ? 0 : n;
      }),
    })),
    prefix: /\$/.test(t) ? '$' : undefined,
  };
}

/** The data as CSV, for the editor. */
export function chartCsv(data: ICChartData): string {
  const head = ['label', ...data.series.map((s) => s.name)].join(',');
  const rows = data.labels.map((label, i) =>
    [label, ...data.series.map((s) => s.values[i] ?? 0)].join(','),
  );
  return [head, ...rows].join('\n');
}

const PICTO_SLOTS: ICArtSlot[] = [
  { key: 'main', label: 'Main', role: 'accent', color: '#6366f1' },
  { key: 'detail', label: 'Shade', role: 'ink', color: '#10131c' },
];

/** A grid of coins, `cols` across, `count` in all, filling from the bottom row up. */
function coinGrid(cols: number, count: number): ICArtDef {
  const rows = Math.ceil(count / cols);
  const cell = 10;
  const w = cols * cell;
  const h = rows * cell;
  let body = '';
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = rows - 1 - Math.floor(i / cols);
    const cx = c * cell + cell / 2;
    const cy = r * cell + cell / 2;
    body += `<circle cx="${cx}" cy="${cy}" r="4.3" fill="{{main}}"/><circle cx="${cx}" cy="${cy}" r="2.6" fill="none" stroke="{{detail}}" stroke-width=".7" opacity=".45"/>`;
  }
  return {
    id: `coins-${cols}-${count}`,
    name: `${count} coins`,
    kind: 'shape',
    group: 'Charts',
    ratio: w / h,
    viewBox: `0 0 ${w} ${h}`,
    body,
    slots: PICTO_SLOTS,
  };
}

const COINS = /^coins-(\d+)-(\d+)$/;

/** A generated drawing for an id like `coins-5-50`, or nothing. */
export function generatedDef(id: string): ICArtDef | undefined {
  const m = COINS.exec(id);
  if (!m) return undefined;
  const cols = Math.min(20, Math.max(1, Number(m[1])));
  const count = Math.min(400, Math.max(1, Number(m[2])));
  return coinGrid(cols, count);
}

/** Drawings for the Info, On this day and Report templates, also listed in Elements. */
export const INFO_ART: ICArtDef[] = [
  coinGrid(5, 25),
  {
    id: 'pyramid-up',
    name: 'Pyramid',
    kind: 'shape',
    group: 'Charts',
    ratio: 1.2,
    viewBox: '0 0 120 100',
    body: '<path d="M60 2L118 98H2Z" fill="{{main}}"/><path d="M60 2L80 35H40Z" fill="{{detail}}" opacity=".35"/>',
    slots: PICTO_SLOTS,
  },
  {
    id: 'pyramid-down',
    name: 'Pyramid, upside down',
    kind: 'shape',
    group: 'Charts',
    ratio: 1.2,
    viewBox: '0 0 120 100',
    body: '<path d="M2 2H118L60 98Z" fill="{{main}}"/><path d="M40 65H80L60 98Z" fill="{{detail}}" opacity=".35"/>',
    slots: PICTO_SLOTS,
  },
  {
    id: 'lanes',
    name: 'Merging lanes',
    kind: 'shape',
    group: 'Charts',
    ratio: 2,
    viewBox: '0 0 200 100',
    body:
      '<defs><linearGradient id="ln-a" x1="0" x2="1"><stop offset="0" stop-color="{{main}}" stop-opacity="0"/><stop offset=".35" stop-color="{{main}}"/></linearGradient>' +
      '<linearGradient id="ln-b" x1="0" x2="1"><stop offset="0" stop-color="{{detail}}" stop-opacity="0"/><stop offset=".35" stop-color="{{detail}}"/></linearGradient></defs>' +
      '<path d="M0 18H92C104 18 110 24 114 34L120 50" fill="none" stroke="url(#ln-a)" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M0 36H86C98 36 104 40 108 48L112 56" fill="none" stroke="url(#ln-a)" stroke-width="9" stroke-linecap="round" opacity=".75"/>' +
      '<path d="M0 66H104" fill="none" stroke="url(#ln-b)" stroke-width="22"/>' +
      '<path d="M112 60C116 64 120 66 128 66H200" fill="none" stroke="{{main}}" stroke-width="12"/>',
    slots: [
      { key: 'main', label: 'New', role: 'accent', color: '#38bdf8' },
      { key: 'detail', label: 'Old', role: 'muted', color: '#65a30d' },
    ],
  },
  {
    id: 'streaks',
    name: 'Light streaks',
    kind: 'shape',
    group: 'Backgrounds',
    ratio: 1,
    viewBox: '0 0 100 100',
    body: (() => {
      let rays = '';
      for (let i = 0; i < 26; i++) {
        const x = 4 + i * 3.7 + ((i * 7) % 5) * 0.4;
        const top = 10 + ((i * 13) % 40);
        rays += `<rect x="${x.toFixed(1)}" y="${top}" width=".5" height="${100 - top}" fill="url(#st-r)" opacity="${(0.25 + ((i * 11) % 7) / 10).toFixed(2)}"/>`;
      }
      return (
        '<defs><linearGradient id="st-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{detail}}" stop-opacity="0"/><stop offset=".5" stop-color="{{detail}}" stop-opacity=".5"/><stop offset="1" stop-color="{{detail}}" stop-opacity="0"/></linearGradient>' +
        '<filter id="st-b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter></defs>' +
        '<path d="M-10 70C20 40 50 50 110 20V60C60 80 30 80-10 100Z" fill="{{main}}" opacity=".55" filter="url(#st-b)"/>' +
        rays
      );
    })(),
    slots: [
      { key: 'main', label: 'Light', role: 'accent', color: '#65a30d' },
      { key: 'detail', label: 'Rays', role: 'ink', color: '#d9f99d' },
    ],
  },
];
