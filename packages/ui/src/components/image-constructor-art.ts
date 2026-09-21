// Vector art layers. Each piece is an SVG with named color slots, so one drawing gives many variations.

export interface ICArtSlot {
  key: string;
  label: string;
  color: string;
}

export interface ICArtDef {
  id: string;
  name: string;
  kind: 'character' | 'shape';
  /** Width over height of the drawing. */
  ratio: number;
  viewBox: string;
  /** SVG content with `{{key}}` where a slot color goes. */
  body: string;
  slots: ICArtSlot[];
}

const SKIN = { key: 'skin', label: 'Skin' };
const HAIR = { key: 'hair', label: 'Hair' };
const TOP = { key: 'top', label: 'Top' };
const BOTTOM = { key: 'bottom', label: 'Bottom' };
const SHOES = { key: 'shoes', label: 'Shoes' };

const slots = (list: { key: string; label: string }[], colors: string[]): ICArtSlot[] =>
  list.map((s, i) => ({ ...s, color: colors[i] }));

const HEAD = '<circle cx="30" cy="14" r="9" fill="{{skin}}"/>';
const NECK = '<rect x="27" y="21" width="6" height="8" fill="{{skin}}"/>';
const SLIM_LEGS =
  '<rect x="22" y="98" width="6" height="32" rx="3" fill="{{skin}}"/><rect x="32" y="98" width="6" height="32" rx="3" fill="{{skin}}"/>';
const SLIM_SHOES =
  '<ellipse cx="25" cy="133" rx="6.5" ry="3" fill="{{shoes}}"/><ellipse cx="35" cy="133" rx="6.5" ry="3" fill="{{shoes}}"/>';

const CHARACTERS: ICArtDef[] = [
  {
    id: 'woman-long-hair',
    name: 'Long hair, wide trousers',
    kind: 'character',
    ratio: 60 / 140,
    viewBox: '0 0 60 140',
    body:
      '<path d="M19 13 Q19 2 30 2 Q41 2 41 13 L43 36 Q30 32 17 36Z" fill="{{hair}}"/>' +
      NECK +
      '<path d="M17 31 Q30 26 43 31 L46 70 L14 70Z" fill="{{top}}"/>' +
      '<path d="M16 32 L8 66 L13 68 L21 40Z" fill="{{top}}"/><path d="M44 32 L52 66 L47 68 L39 40Z" fill="{{top}}"/>' +
      '<circle cx="10.5" cy="69" r="2.4" fill="{{skin}}"/><circle cx="49.5" cy="69" r="2.4" fill="{{skin}}"/>' +
      '<path d="M14 68 L46 68 L53 131 L33 131 L30 86 L27 131 L7 131Z" fill="{{bottom}}"/>' +
      HEAD +
      '<path d="M20 12 Q21 4 30 4 Q39 4 40 12 Q32 7 20 12Z" fill="{{hair}}"/>' +
      '<ellipse cx="17" cy="134" rx="8" ry="3.2" fill="{{shoes}}"/><ellipse cx="43" cy="134" rx="8" ry="3.2" fill="{{shoes}}"/>',
    slots: slots(
      [SKIN, HAIR, TOP, BOTTOM, SHOES],
      ['#c99a7a', '#4a2f22', '#efe3cf', '#a4623d', '#e6d4be'],
    ),
  },
  {
    id: 'woman-bun-dress',
    name: 'Bun, dress',
    kind: 'character',
    ratio: 60 / 140,
    viewBox: '0 0 60 140',
    body:
      '<circle cx="30" cy="3.5" r="4.5" fill="{{hair}}"/>' +
      NECK +
      SLIM_LEGS +
      '<path d="M17 32 L9 64 L14 66 L21 40Z" fill="{{skin}}"/><path d="M43 32 L51 64 L46 66 L39 40Z" fill="{{skin}}"/>' +
      '<path d="M18 31 Q30 26 42 31 L49 100 Q30 108 11 100Z" fill="{{top}}"/>' +
      HEAD +
      '<path d="M21 13 Q21 4 30 4 Q39 4 39 13 Q30 8 21 13Z" fill="{{hair}}"/>' +
      SLIM_SHOES,
    slots: slots([SKIN, HAIR, TOP, SHOES], ['#f1c9a5', '#2b2119', '#c8553d', '#2a2a2a']),
  },
  {
    id: 'man-short-hair',
    name: 'Short hair, shirt and trousers',
    kind: 'character',
    ratio: 60 / 140,
    viewBox: '0 0 60 140',
    body:
      NECK +
      '<path d="M14 31 Q30 26 46 31 L48 74 L12 74Z" fill="{{top}}"/>' +
      '<path d="M13 32 L6 68 L12 70 L19 42Z" fill="{{top}}"/><path d="M47 32 L54 68 L48 70 L41 42Z" fill="{{top}}"/>' +
      '<circle cx="9" cy="71.5" r="2.5" fill="{{skin}}"/><circle cx="51" cy="71.5" r="2.5" fill="{{skin}}"/>' +
      '<path d="M13 72 L47 72 L45 131 L32 131 L30 92 L28 131 L15 131Z" fill="{{bottom}}"/>' +
      '<circle cx="30" cy="14" r="9.5" fill="{{skin}}"/>' +
      '<path d="M20.5 12 Q21 3.5 30 3.5 Q39 3.5 39.5 12 Q30 8.5 20.5 12Z" fill="{{hair}}"/>' +
      '<ellipse cx="22" cy="134" rx="7.5" ry="3" fill="{{shoes}}"/><ellipse cx="38" cy="134" rx="7.5" ry="3" fill="{{shoes}}"/>',
    slots: slots(
      [SKIN, HAIR, TOP, BOTTOM, SHOES],
      ['#e0ac86', '#3a2a1e', '#dfe6ee', '#2f3a52', '#1f1f1f'],
    ),
  },
  {
    id: 'man-beard-jacket',
    name: 'Beard, jacket and jeans',
    kind: 'character',
    ratio: 60 / 140,
    viewBox: '0 0 60 140',
    body:
      NECK +
      '<path d="M14 31 Q30 26 46 31 L48 76 L12 76Z" fill="{{top}}"/>' +
      '<path d="M25 30 L30 46 L35 30Z" fill="#f3f3f0"/><path d="M30 46 L30 76" stroke="#000" stroke-opacity=".25" stroke-width="1"/>' +
      '<path d="M13 32 L6 70 L12 72 L19 42Z" fill="{{top}}"/><path d="M47 32 L54 70 L48 72 L41 42Z" fill="{{top}}"/>' +
      '<circle cx="9" cy="73.5" r="2.5" fill="{{skin}}"/><circle cx="51" cy="73.5" r="2.5" fill="{{skin}}"/>' +
      '<path d="M13 74 L47 74 L45 131 L32 131 L30 94 L28 131 L15 131Z" fill="{{bottom}}"/>' +
      '<circle cx="30" cy="14" r="9.5" fill="{{skin}}"/>' +
      '<path d="M20.5 12 Q21 3.5 30 3.5 Q39 3.5 39.5 12 Q30 8.5 20.5 12Z" fill="{{hair}}"/>' +
      '<path d="M21.5 15 Q30 29 38.5 15 Q38.5 23 30 25 Q21.5 23 21.5 15Z" fill="{{hair}}"/>' +
      '<ellipse cx="22" cy="134" rx="7.5" ry="3" fill="{{shoes}}"/><ellipse cx="38" cy="134" rx="7.5" ry="3" fill="{{shoes}}"/>',
    slots: slots(
      [SKIN, HAIR, TOP, BOTTOM, SHOES],
      ['#8d5a3b', '#1c1c1c', '#5b3a25', '#3b5b8c', '#efe3cf'],
    ),
  },
  {
    id: 'woman-bob-skirt',
    name: 'Bob, top and skirt',
    kind: 'character',
    ratio: 60 / 140,
    viewBox: '0 0 60 140',
    body:
      '<path d="M19.5 13 Q19.5 3 30 3 Q40.5 3 40.5 13 L40.5 25 L19.5 25Z" fill="{{hair}}"/>' +
      NECK +
      SLIM_LEGS +
      '<path d="M17 32 L10 60 L15 62 L21 40Z" fill="{{skin}}"/><path d="M43 32 L50 60 L45 62 L39 40Z" fill="{{skin}}"/>' +
      '<path d="M18 31 Q30 26 42 31 L43 60 L17 60Z" fill="{{top}}"/>' +
      '<path d="M17 58 L43 58 L50 100 L10 100Z" fill="{{bottom}}"/>' +
      HEAD +
      '<path d="M20.5 12 Q21 5 30 5 Q39 5 39.5 12 Q30 9 20.5 12Z" fill="{{hair}}"/>' +
      SLIM_SHOES,
    slots: slots(
      [SKIN, HAIR, TOP, BOTTOM, SHOES],
      ['#f1c9a5', '#8a5a2b', '#f3ecdd', '#6b7f5a', '#7a5138'],
    ),
  },
  {
    id: 'person-hoodie',
    name: 'Curly hair, hoodie and joggers',
    kind: 'character',
    ratio: 60 / 140,
    viewBox: '0 0 60 140',
    body:
      '<g fill="{{hair}}"><circle cx="21" cy="9" r="4.6"/><circle cx="27" cy="4.5" r="4.6"/><circle cx="34" cy="4.5" r="4.6"/><circle cx="40" cy="9" r="4.6"/><circle cx="19" cy="15" r="4"/><circle cx="41" cy="15" r="4"/></g>' +
      NECK +
      '<path d="M14 32 Q30 27 46 32 L48 78 L12 78Z" fill="{{top}}"/>' +
      '<path d="M21 29 Q30 40 39 29" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="2.4"/>' +
      '<rect x="21" y="60" width="18" height="9" rx="3" fill="#000" fill-opacity=".12"/>' +
      '<path d="M13 33 L5 70 L12 72 L19 44Z" fill="{{top}}"/><path d="M47 33 L55 70 L48 72 L41 44Z" fill="{{top}}"/>' +
      '<circle cx="8.5" cy="73" r="2.5" fill="{{skin}}"/><circle cx="51.5" cy="73" r="2.5" fill="{{skin}}"/>' +
      '<path d="M13 76 L47 76 L43 128 L33 128 L30 96 L27 128 L17 128Z" fill="{{bottom}}"/>' +
      '<rect x="17" y="124" width="10" height="5" rx="2" fill="#000" fill-opacity=".18"/><rect x="33" y="124" width="10" height="5" rx="2" fill="#000" fill-opacity=".18"/>' +
      '<circle cx="30" cy="14" r="8.6" fill="{{skin}}"/>' +
      '<ellipse cx="22" cy="134" rx="8" ry="3.4" fill="{{shoes}}"/><ellipse cx="38" cy="134" rx="8" ry="3.4" fill="{{shoes}}"/>',
    slots: slots(
      [SKIN, HAIR, TOP, BOTTOM, SHOES],
      ['#a86f4c', '#2a1d16', '#7a8f6b', '#3a3f47', '#f3f3f0'],
    ),
  },
];

const FILL = { key: 'fill', label: 'Color' };
const SHADE = { key: 'shade', label: 'Shade' };

const SHAPES: ICArtDef[] = [
  {
    id: 'rock-wide',
    name: 'Rock',
    kind: 'shape',
    ratio: 100 / 60,
    viewBox: '0 0 100 60',
    body:
      '<path d="M4 44 Q2 24 20 14 Q38 4 62 12 Q88 20 94 40 Q96 52 84 56 L14 56 Q6 54 4 44Z" fill="{{fill}}"/>' +
      '<path d="M62 12 Q88 20 94 40 Q96 52 84 56 L50 56 Q78 46 62 12Z" fill="{{shade}}"/>',
    slots: slots([FILL, SHADE], ['#b8afa4', '#9a9186']),
  },
  {
    id: 'rock-tall',
    name: 'Tall rock',
    kind: 'shape',
    ratio: 0.8,
    viewBox: '0 0 80 100',
    body:
      '<path d="M12 96 Q4 60 18 34 Q28 12 46 6 Q66 2 72 30 Q80 60 70 96Z" fill="{{fill}}"/>' +
      '<path d="M46 6 Q66 2 72 30 Q80 60 70 96 L48 96 Q62 56 46 6Z" fill="{{shade}}"/>',
    slots: slots([FILL, SHADE], ['#c4b8a8', '#a39683']),
  },
  {
    id: 'pebbles',
    name: 'Pebbles',
    kind: 'shape',
    ratio: 2,
    viewBox: '0 0 100 50',
    body:
      '<ellipse cx="24" cy="34" rx="20" ry="12" fill="{{fill}}"/><ellipse cx="60" cy="30" rx="16" ry="10" fill="{{fill}}"/>' +
      '<ellipse cx="82" cy="38" rx="12" ry="8" fill="{{shade}}"/>',
    slots: slots([FILL, SHADE], ['#c9bfb2', '#a89d8f']),
  },
  {
    id: 'leaf',
    name: 'Leaf',
    kind: 'shape',
    ratio: 0.6,
    viewBox: '0 0 60 100',
    body:
      '<path d="M30 4 Q58 30 30 96 Q2 30 30 4Z" fill="{{fill}}"/>' +
      '<path d="M30 10 L30 92" stroke="{{shade}}" stroke-width="2" fill="none"/>',
    slots: slots([FILL, SHADE], ['#5c8a4e', '#3d6a34']),
  },
  {
    id: 'blob',
    name: 'Blob',
    kind: 'shape',
    ratio: 1,
    viewBox: '0 0 100 100',
    body: '<path d="M50 6 Q80 4 92 32 Q100 58 78 82 Q54 100 28 88 Q4 74 8 46 Q12 12 50 6Z" fill="{{fill}}"/>',
    slots: slots([FILL], ['#e9c9b4']),
  },
  {
    id: 'arch',
    name: 'Arch',
    kind: 'shape',
    ratio: 0.8,
    viewBox: '0 0 80 100',
    body:
      '<path d="M8 100 L8 44 Q8 6 40 6 Q72 6 72 44 L72 100Z" fill="{{fill}}"/>' +
      '<path d="M22 100 L22 48 Q22 22 40 22 Q58 22 58 48 L58 100Z" fill="{{shade}}"/>',
    slots: slots([FILL, SHADE], ['#d9cbb8', '#c4b39d']),
  },
  {
    id: 'ring',
    name: 'Ring',
    kind: 'shape',
    ratio: 1,
    viewBox: '0 0 100 100',
    body: '<circle cx="50" cy="50" r="40" fill="none" stroke="{{fill}}" stroke-width="12"/>',
    slots: slots([FILL], ['#c9a24a']),
  },
];

export const ART: ICArtDef[] = [...CHARACTERS, ...SHAPES];

export const artDef = (id: string): ICArtDef | undefined => ART.find((a) => a.id === id);

/** The colors a piece starts with. */
export const artDefaults = (def: ICArtDef): Record<string, string> =>
  Object.fromEntries(def.slots.map((s) => [s.key, s.color]));

/** The drawing as an SVG image URL, with the given colors filled into its slots. */
export function artUrl(def: ICArtDef, colors: Record<string, string>): string {
  const body = def.body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return colors[key] ?? def.slots.find((s) => s.key === key)?.color ?? '#888888';
  });
  const [, , w, h] = def.viewBox.split(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${def.viewBox}">${body}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
