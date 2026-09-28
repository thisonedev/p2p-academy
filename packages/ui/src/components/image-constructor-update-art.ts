// Art for the Product Updates pack: wires between nodes, generated from their id like patterns,
// and a small icon per product.

import type { ICArtDef } from './image-constructor-art.js';

/** Wire ids hold their own box: `wire-hd-400-120` runs 40 wide and 12 tall, top left to bottom right. */
const WIRE = /^wire-(hd|hu|vr|vl)-(\d+)-(\d+)$/;

export const isWire = (id: string) => WIRE.test(id);

/** Room around the path so the stroke isn't clipped at the box edge, in the same tenths. */
export const WIRE_PAD = 4;

/** The wire id for a path `dir` running `w` by `h` canvas-width units. */
export const wireId = (dir: 'hd' | 'hu' | 'vr' | 'vl', w: number, h: number) =>
  `wire-${dir}-${Math.round(w * 10)}-${Math.round(h * 10)}`;

export function wireDef(id: string): ICArtDef | undefined {
  const m = WIRE.exec(id);
  if (!m) return undefined;
  const dir = m[1];
  const w = Number(m[2]);
  const h = Number(m[3]);
  const p = WIRE_PAD;
  const d =
    dir === 'hd'
      ? `M0 0C${w / 2} 0 ${w / 2} ${h} ${w} ${h}`
      : dir === 'hu'
        ? `M0 ${h}C${w / 2} ${h} ${w / 2} 0 ${w} 0`
        : dir === 'vr'
          ? `M0 0C0 ${h / 2} ${w} ${h / 2} ${w} ${h}`
          : `M${w} 0C${w} ${h / 2} 0 ${h / 2} 0 ${h}`;
  return {
    id,
    name: 'Wire',
    kind: 'shape',
    group: 'Arrows',
    ratio: (w + 2 * p) / (h + 2 * p),
    viewBox: `${-p} ${-p} ${w + 2 * p} ${h + 2 * p}`,
    body: `<path d="${d}" fill="none" stroke="{{main}}" stroke-width="2.5" stroke-linecap="round"/>`,
    slots: [{ key: 'main', label: 'Color', role: 'accent', color: '#6ea8fe' }],
  };
}

const icon = (id: string, name: string, paths: string): ICArtDef => ({
  id,
  name,
  kind: 'shape',
  group: 'Accents',
  ratio: 1,
  viewBox: '0 0 24 24',
  body: `<g fill="none" stroke="{{main}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`,
  slots: [{ key: 'main', label: 'Color', role: 'accent', color: '#6ea8fe' }],
});

/** One icon per product slot, in the order products are added. */
export const PRODUCT_ICONS: ICArtDef[] = [
  icon('product-learn', 'Learn', '<path d="M2 8l10-4 10 4-10 4z"/><path d="M6 10v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>'),
  icon(
    'product-play',
    'Play',
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M10 6.5h4a3 3 0 0 1 3 3V14"/>',
  ),
  icon('product-design', 'Design', '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
  icon('product-docs', 'Docs', '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-4a3 3 0 0 0-3 3"/><path d="M20 4v14h-5"/>'),
  icon('product-wallet', 'Wallet', '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><path d="M16 15h2"/><path d="M6 6V5a2 2 0 0 1 2-2h8"/>'),
  icon('product-card', 'Payments', '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><path d="M7 15h4"/>'),
  icon('product-code', 'SDK', '<path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/><path d="m13.5 5-3 14"/>'),
  icon('product-chip', 'Models', '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M10 10h4v4h-4z"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>'),
  icon('product-window', 'App', '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18"/><path d="M6.5 6.5h.01M9 6.5h.01"/>'),
];
