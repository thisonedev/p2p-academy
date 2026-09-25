// Line art for product posts: isometric building blocks and a small flow diagram, drawn in the
// brand's accent over its background.

import type { ICArtDef, ICArtSlot } from './image-constructor-art.js';

const SLOTS: ICArtSlot[] = [
  { key: 'main', label: 'Lines', role: 'accent', color: '#35e0c1' },
  { key: 'face', label: 'Fill', role: 'bg', color: '#0f1010' },
];
const M = '{{main}}';
const F = '{{face}}';

const f = (n: number) => n.toFixed(1);

type P = [number, number];

/** A point in the block space, seen from the usual isometric angle, 60 pixels to a unit. */
const iso = (x: number, y: number, z: number): P => [(x - y) * 52, (x + y) * 30 - z * 60];

const poly = (pts: P[], attrs: string) =>
  `<path d="M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z" ${attrs}/>`;

const LINE = `fill="${F}" stroke="${M}" stroke-width="3" stroke-linejoin="round"`;

/** A stud: a short cylinder standing on a block's top at x, y, z. */
function stud(x: number, y: number, z: number, r: number, h: number): string {
  const [cx, cy] = iso(x, y, z);
  const rx = r * 73.5;
  const ry = r * 42.4;
  const top = cy - h * 60;
  return (
    `<path d="M${f(cx - rx)} ${f(cy)}V${f(top)}A${f(rx)} ${f(ry)} 0 0 1 ${f(cx + rx)} ${f(top)}V${f(cy)}A${f(rx)} ${f(ry)} 0 0 1 ${f(cx - rx)} ${f(cy)}Z" ${LINE}/>` +
    `<ellipse cx="${f(cx)}" cy="${f(top)}" rx="${f(rx)}" ry="${f(ry)}" ${LINE}/>` +
    `<ellipse cx="${f(cx)}" cy="${f(top)}" rx="${f(rx * 0.55)}" ry="${f(ry * 0.55)}" fill="none" stroke="${M}" stroke-width="2"/>`
  );
}

/** A block `w` by `d` units and `h` tall at x, y, with studs on top and a dashed footprint. */
function block(x: number, y: number, w: number, d: number, h: number): string {
  const m = 0.45;
  const foot = poly(
    [
      iso(x - m, y - m, 0),
      iso(x + w + m, y - m, 0),
      iso(x + w + m, y + d + m, 0),
      iso(x - m, y + d + m, 0),
    ],
    `fill="none" stroke="${M}" stroke-width="2.5" stroke-dasharray="9 8" opacity=".7"`,
  );
  const top = poly([iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)], LINE);
  const left = poly(
    [iso(x, y + d, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x, y + d, h)],
    LINE,
  );
  const right = poly(
    [iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x + w, y, h)],
    LINE,
  );
  let studs = '';
  for (let j = 0; j < d; j++)
    for (let i = 0; i < w; i++) studs += stud(x + i + 0.5, y + j + 0.5, h, 0.3, 0.22);
  return foot + left + right + top + studs;
}

/** Two bricks and a loose stud, the way a kit is laid out before building. */
function bricks(): ICArtDef {
  const body = block(0, 0, 4, 2, 1.2) + block(0.4, 3.3, 2, 1, 1.2) + stud(4, 4.2, 0, 0.45, 0.5);
  // The drawing spans about -275 to 330 across and -130 to 250 down; the view box adds room.
  return {
    id: 'iso-bricks',
    name: 'Building blocks',
    kind: 'shape',
    group: 'Data & AI',
    ratio: 640 / 420,
    viewBox: '-300 -150 640 420',
    body,
    slots: SLOTS,
  };
}

/** Sources on the left feeding a hexagon node, which feeds an answer card on the right. The
 *  node is left empty for a word laid on top, such as RAG. */
function flow(): ICArtDef {
  let rows = '';
  const hit = [1, 3, 5];
  for (let i = 0; i < 7; i++) {
    const y = 20 + i * 42;
    rows += hit.includes(i)
      ? `<rect x="20" y="${y}" width="280" height="30" rx="4" fill="${M}" fill-opacity=".85"/>` +
        `<path d="M300 ${y + 15}L432 160" stroke="${M}" stroke-width="2" opacity=".7"/>`
      : `<rect x="20" y="${y}" width="280" height="30" rx="4" fill="none" stroke="${M}" stroke-opacity=".35" stroke-width="2"/>` +
        `<path d="M44 ${y + 15}H270" stroke="${M}" stroke-opacity=".35" stroke-width="2"/>`;
  }
  const hex = [
    [430, 160],
    [465, 99],
    [535, 99],
    [570, 160],
    [535, 221],
    [465, 221],
  ] as P[];
  const bars = [240, 240, 190, 140]
    .map(
      (w, i) =>
        `<rect x="722" y="${92 + i * 32}" width="${w}" height="14" rx="3" fill="${M}" opacity="${i < 2 ? 1 : 0.6}"/>`,
    )
    .join('');
  return {
    id: 'flow-node',
    name: 'Flow diagram',
    kind: 'shape',
    group: 'Data & AI',
    ratio: 1000 / 320,
    viewBox: '0 0 1000 320',
    body:
      rows +
      poly(hex, `fill="${F}" stroke="${M}" stroke-width="2.5"`) +
      `<path d="M570 160H700" stroke="${M}" stroke-width="2"/>` +
      `<rect x="700" y="60" width="280" height="200" rx="14" fill="${F}" stroke="${M}" stroke-width="2.5"/>` +
      bars,
    slots: SLOTS,
  };
}

export const PRODUCT_ART: ICArtDef[] = [bricks(), flow()];
