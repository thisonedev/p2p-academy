// A config-driven character: independent part choices composed into one SVG, the same
// swap-a-part idea the rest of the art library already uses, just with a shape per part
// instead of only a color. Combinatorics alone puts this well past a million outputs.

export type ICAvatarCategory = 'earth' | 'space';

export interface ICAvatarConfig {
  category: ICAvatarCategory;
  skin: string;
  head: string;
  featureColor: string;
  top: string;
  topColor: string;
  bottom: string;
  bottomColor: string;
  shoes: string;
  shoesColor: string;
  accessories: string[];
  text: string;
}

type PartFn = (color: string, skin: string) => string;

interface AvatarSet {
  skin: string[];
  featureColors: string[];
  head: Record<string, PartFn>;
  /** Head styles drawn before the head shape (a frame effect: hair/headwear visible around
   *  the edge), everything else draws after (over the top of the head/clothes). */
  behind: Set<string>;
  accessories: string[];
}

export const AVATAR_RATIO = 60 / 140;
const VIEWBOX = '0 0 60 140';

const headShape = (skin: string) =>
  `<circle cx="30" cy="14" r="9" fill="${skin}"/><rect x="27" y="21" width="6" height="8" fill="${skin}"/>`;

// --- Earth: deep diversity. Skin spans a wide real-world range; hair covers texture, not
// just length. Hijab/turban are opt-in headwear, a personal style choice, not a "pick your
// nationality" costume list, which would read as caricature instead of representation.
const EARTH: AvatarSet = {
  skin: [
    '#ffe0bd',
    '#f1cfab',
    '#e0ac86',
    '#c99a7a',
    '#a4693f',
    '#8a5a3c',
    '#7a4b2c',
    '#5c3a22',
    '#4a2f1f',
    '#2e1c12',
  ],
  featureColors: [
    '#1c1410',
    '#3a2a1e',
    '#6b4226',
    '#a56b3a',
    '#d4b483',
    '#c2c2c2',
    '#8c6bff',
    '#e8c34a',
  ],
  behind: new Set(['long', 'afro', 'locs', 'braids', 'hijab', 'turban']),
  head: {
    short: (c) =>
      `<path d="M20.5 12 Q21 3.5 30 3.5 Q39 3.5 39.5 12 Q30 8.5 20.5 12Z" fill="${c}"/>`,
    long: (c) =>
      `<path d="M19 13 Q19 2 30 2 Q41 2 41 13 L43 34 Q30 30 17 34Z" fill="${c}"/>` +
      `<path d="M16 32 L10 60 L14 62 L20 38Z" fill="${c}"/><path d="M44 32 L50 60 L46 62 L40 38Z" fill="${c}"/>`,
    bun: (c) =>
      `<path d="M21 13 Q21 4 30 4 Q39 4 39 13 Q30 8 21 13Z" fill="${c}"/><circle cx="30" cy="3.5" r="4.5" fill="${c}"/>`,
    afro: (c) => `<circle cx="30" cy="11" r="13" fill="${c}"/>`,
    locs: (c) =>
      `<path d="M20.5 12 Q21 3.5 30 3.5 Q39 3.5 39.5 12 Q30 8.5 20.5 12Z" fill="${c}"/>` +
      `<path d="M21 10 Q19 26 21 48" stroke="${c}" stroke-width="2" fill="none"/>` +
      `<path d="M27 8 Q26 28 27 52" stroke="${c}" stroke-width="2" fill="none"/>` +
      `<path d="M33 8 Q34 28 33 52" stroke="${c}" stroke-width="2" fill="none"/>` +
      `<path d="M39 10 Q41 26 39 48" stroke="${c}" stroke-width="2" fill="none"/>`,
    braids: (c) =>
      `<path d="M20.5 12 Q21 3.5 30 3.5 Q39 3.5 39.5 12 Q30 8.5 20.5 12Z" fill="${c}"/>` +
      `<path d="M18 12 Q15 30 17 55" stroke="${c}" stroke-width="3" fill="none"/>` +
      `<path d="M42 12 Q45 30 43 55" stroke="${c}" stroke-width="3" fill="none"/>`,
    hijab: (c) => `<path d="M17 11 Q17 0 30 0 Q43 0 43 11 L46 40 Q30 46 14 40Z" fill="${c}"/>`,
    turban: (c) =>
      `<ellipse cx="30" cy="6" rx="12" ry="7" fill="${c}"/><circle cx="30" cy="1.5" r="2" fill="${c}"/>`,
    bald: () => '',
  },
  accessories: [
    'glasses',
    'shades',
    'chain',
    'headphones',
    'cap',
    'badge',
    'wallet',
    'watch',
    'vr',
    'laptop',
    'earbuds',
  ],
};

// --- Space: one flat pool of friendly-being features, no sub-picker. Whimsical on purpose,
// nothing hostile or menacing drawn.
const SPACE: AvatarSet = {
  skin: [
    '#8b5cf6',
    '#22d3ee',
    '#34d399',
    '#f472b6',
    '#a3e635',
    '#c084fc',
    '#fdf6e3',
    '#3fa9c9',
    '#e3b58a',
    '#6fae5a',
    '#9ca3af',
    '#facc15',
  ],
  featureColors: [
    '#ffffff',
    '#ffe9a8',
    '#c7f9ff',
    '#ffd6ec',
    '#e8c34a',
    '#3a2a1e',
    '#38bdf8',
    '#a3e635',
    '#f87171',
    '#9ca3af',
  ],
  behind: new Set(['mane', 'fronds']),
  head: {
    halo: (c) =>
      `<ellipse cx="30" cy="2" rx="9" ry="2.4" fill="none" stroke="${c}" stroke-width="1.4"/>`,
    crown: (c) => `<path d="M20 8 L23 1 L27 6 L30 0 L33 6 L37 1 L40 8Z" fill="${c}" opacity=".9"/>`,
    crest: (c) => `<path d="M25 7 Q30 -5 35 7 L32 10 Q30 6 28 10Z" fill="${c}"/>`,
    feathers: (c) =>
      `<path d="M20 9 Q17 2 22 3 Q22 8 24 9Z" fill="${c}"/><path d="M40 9 Q43 2 38 3 Q38 8 36 9Z" fill="${c}"/>` +
      `<path d="M27 6 Q27 -2 30 0 Q31 4 30 7Z" fill="${c}"/>`,
    ears: (c) =>
      `<path d="M19 6 L23 -1 L26 7Z" fill="${c}"/><path d="M41 6 L37 -1 L34 7Z" fill="${c}"/>`,
    mane: (c) => `<circle cx="30" cy="13" r="12.5" fill="${c}"/>`,
    fronds: (c) =>
      `<path d="M22 8 Q18 16 22 23" stroke="${c}" stroke-width="2.2" fill="none"/>` +
      `<path d="M27 5 Q24 14 27 21" stroke="${c}" stroke-width="2.2" fill="none"/>` +
      `<path d="M33 5 Q36 14 33 21" stroke="${c}" stroke-width="2.2" fill="none"/>` +
      `<path d="M38 8 Q42 16 38 23" stroke="${c}" stroke-width="2.2" fill="none"/>`,
    bud: (c) =>
      `<circle cx="30" cy="0" r="3.2" fill="${c}"/><line x1="30" y1="3" x2="30" y2="6" stroke="${c}" stroke-width="1.4"/>`,
    dome: (c) =>
      `<path d="M19 13 Q19 2 30 2 Q41 2 41 13Z" fill="${c}" opacity=".92"/><circle cx="26" cy="7" r="1.3" fill="#fff" opacity=".8"/>`,
    antenna: (c) =>
      `<line x1="30" y1="5" x2="30" y2="-3" stroke="${c}" stroke-width="1.6"/><circle cx="30" cy="-3" r="2" fill="${c}"/>`,
    visor: (c) => `<rect x="19" y="12" width="22" height="4" rx="2" fill="${c}"/>`,
    none: () => '',
  },
  accessories: ['glowMarks', 'thirdEye', 'badge', 'star', 'chain', 'ledStrip', 'core', 'satDish'],
};

export function avatarSetFor(category: ICAvatarCategory): AvatarSet {
  return category === 'earth' ? EARTH : SPACE;
}

// --- Shared across both categories: clothes don't need a different silhouette per world.
export const TOP: Record<string, PartFn> = {
  hoodie: (c, skin) =>
    `<path d="M14 31 Q30 25 46 31 L49 76 L11 76Z" fill="${c}"/>` +
    `<path d="M13 32 L5 70 L12 72 L19 42Z" fill="${c}"/><path d="M47 32 L55 70 L48 72 L41 42Z" fill="${c}"/>` +
    `<circle cx="8" cy="71" r="2.6" fill="${skin}"/><circle cx="52" cy="71" r="2.6" fill="${skin}"/>` +
    `<path d="M22 30 Q30 36 38 30 L36 40 Q30 44 24 40Z" fill="${c}" opacity=".6"/>`,
  tee: (c, skin) =>
    `<path d="M15 31 Q30 27 45 31 L47 68 L13 68Z" fill="${c}"/>` +
    `<path d="M14 32 L8 54 L13 56 L19 40Z" fill="${skin}"/><path d="M46 32 L52 54 L47 56 L41 40Z" fill="${skin}"/>`,
  blazer: (c) =>
    `<path d="M14 31 L30 36 L46 31 L48 74 L12 74Z" fill="${c}"/>` +
    `<path d="M27 33 L30 45 L33 33 L30 30Z" fill="#f4efe4"/>` +
    `<path d="M13 32 L6 70 L12 72 L19 42Z" fill="${c}"/><path d="M47 32 L54 70 L48 72 L41 42Z" fill="${c}"/>`,
  tank: (c, skin) =>
    `<path d="M20 31 Q30 28 40 31 L42 68 L18 68Z" fill="${c}"/>` +
    `<path d="M14 33 L8 66 L13 68 L20 42Z" fill="${skin}"/><path d="M46 33 L52 66 L47 68 L40 42Z" fill="${skin}"/>`,
  jacket: (c) =>
    `<path d="M14 31 Q30 26 46 31 L48 74 L12 74Z" fill="${c}"/>` +
    `<path d="M13 32 L6 70 L12 72 L19 42Z" fill="${c}"/><path d="M47 32 L54 70 L48 72 L41 42Z" fill="${c}"/>` +
    `<rect x="13" y="70" width="34" height="4" fill="#000" opacity=".25"/>` +
    `<rect x="6" y="67" width="7" height="4" fill="#000" opacity=".25"/><rect x="47" y="67" width="7" height="4" fill="#000" opacity=".25"/>` +
    `<line x1="24" y1="31" x2="24" y2="74" stroke="#000" stroke-width=".8" opacity=".3"/>` +
    `<line x1="36" y1="31" x2="36" y2="74" stroke="#000" stroke-width=".8" opacity=".3"/>`,
  crewneck: (c) =>
    `<path d="M15 31 Q30 26 45 31 L47 74 L13 74Z" fill="${c}"/>` +
    `<path d="M14 32 L7 70 L13 72 L20 42Z" fill="${c}"/><path d="M46 32 L53 70 L47 72 L40 42Z" fill="${c}"/>` +
    `<ellipse cx="30" cy="30" rx="6" ry="2" fill="#000" opacity=".2"/>`,
  shirt: (c) =>
    `<path d="M15 31 Q30 27 45 31 L47 70 L13 70Z" fill="${c}"/>` +
    `<path d="M14 32 L8 58 L13 60 L19 40Z" fill="${c}"/><path d="M46 32 L52 58 L47 60 L41 40Z" fill="${c}"/>` +
    `<path d="M25 30 L30 40 L35 30 L30 27Z" fill="#f4efe4"/>` +
    `<line x1="30" y1="40" x2="30" y2="68" stroke="#000" stroke-width=".6" opacity=".3"/>`,
};

export const BOTTOM: Record<string, PartFn> = {
  jeans: (c) => `<path d="M13 72 L47 72 L45 131 L32 131 L30 92 L28 131 L15 131Z" fill="${c}"/>`,
  trousers: (c) => `<path d="M14 70 L46 70 L44 132 L31 132 L30 90 L29 132 L16 132Z" fill="${c}"/>`,
  shorts: (c, skin) =>
    `<path d="M14 72 L46 72 L44 96 L31 96 L30 88 L29 96 L16 96Z" fill="${c}"/>` +
    `<rect x="22" y="96" width="6" height="34" rx="3" fill="${skin}"/><rect x="32" y="96" width="6" height="34" rx="3" fill="${skin}"/>`,
  joggers: (c) =>
    `<path d="M14 70 L46 70 L43 128 L33 128 L30 92 L27 128 L17 128Z" fill="${c}"/>` +
    `<rect x="16" y="126" width="12" height="5" rx="2.5" fill="${c}"/><rect x="32" y="126" width="12" height="5" rx="2.5" fill="${c}"/>`,
  cargo: (c) =>
    `<path d="M13 72 L47 72 L45 131 L32 131 L30 92 L28 131 L15 131Z" fill="${c}"/>` +
    `<rect x="10" y="90" width="7" height="10" rx="1.5" fill="${c}" stroke="#000" stroke-width=".5" stroke-opacity=".3"/>` +
    `<rect x="43" y="90" width="7" height="10" rx="1.5" fill="${c}" stroke="#000" stroke-width=".5" stroke-opacity=".3"/>`,
};

export const SHOES: Record<string, PartFn> = {
  sneakers: (c) =>
    `<ellipse cx="22" cy="133" rx="7" ry="3" fill="${c}"/><ellipse cx="38" cy="133" rx="7" ry="3" fill="${c}"/>`,
  boots: (c) =>
    `<rect x="16" y="126" width="12" height="9" rx="2" fill="${c}"/><rect x="32" y="126" width="12" height="9" rx="2" fill="${c}"/>`,
};

const ACCESSORIES: Record<string, () => string> = {
  glasses: () =>
    `<rect x="21" y="12" width="8" height="5" rx="1.5" fill="none" stroke="#111" stroke-width="1.3"/>` +
    `<rect x="31" y="12" width="8" height="5" rx="1.5" fill="none" stroke="#111" stroke-width="1.3"/>` +
    `<line x1="29" y1="14" x2="31" y2="14" stroke="#111" stroke-width="1.3"/>`,
  shades: () =>
    `<rect x="20.5" y="11.5" width="8.5" height="5.5" rx="1.5" fill="#141414"/>` +
    `<rect x="30.5" y="11.5" width="8.5" height="5.5" rx="1.5" fill="#141414"/>` +
    `<line x1="29" y1="14" x2="31" y2="14" stroke="#141414" stroke-width="1.3"/>`,
  chain: () =>
    `<path d="M20 30 Q30 40 40 30" fill="none" stroke="#e8c34a" stroke-width="1.6"/><circle cx="30" cy="39" r="2.2" fill="#e8c34a"/>`,
  headphones: () =>
    `<path d="M18 12 Q18 -2 30 -2 Q42 -2 42 12" fill="none" stroke="#222" stroke-width="2.4"/>` +
    `<rect x="14.5" y="9" width="5" height="9" rx="2" fill="#222"/><rect x="40.5" y="9" width="5" height="9" rx="2" fill="#222"/>`,
  cap: () =>
    `<path d="M20 8 Q20 1 30 1 Q40 1 40 8 L40 10 L20 10Z" fill="#1a1a1a"/><path d="M20 9 L10 12 L20 12Z" fill="#1a1a1a"/>`,
  badge: () =>
    `<circle cx="36" cy="45" r="4" fill="#5b8cff"/><path d="M34.3 45 L35.6 46.4 L37.8 43.8" stroke="#fff" stroke-width=".9" fill="none"/>`,
  wallet: () =>
    `<rect x="42" y="58" width="9" height="14" rx="1.5" fill="#1f2937" stroke="#9ca3af" stroke-width=".6"/><circle cx="46.5" cy="63" r="1.3" fill="#38bdf8"/>`,
  watch: () =>
    `<rect x="6" y="63" width="6" height="5" rx="1" fill="#1a1a1a"/><circle cx="9" cy="65.5" r="1.6" fill="#e8c34a"/>`,
  vr: () =>
    `<rect x="18" y="10" width="24" height="9" rx="3" fill="#141414"/>` +
    `<rect x="21" y="12.5" width="8" height="4" rx="1.5" fill="#38bdf8" opacity=".7"/>` +
    `<rect x="31" y="12.5" width="8" height="4" rx="1.5" fill="#38bdf8" opacity=".7"/>`,
  laptop: () =>
    `<line x1="18" y1="30" x2="42" y2="68" stroke="#3a2a1e" stroke-width="1.6"/><rect x="36" y="60" width="12" height="9" rx="1.5" fill="#1f2937" stroke="#9ca3af" stroke-width=".5"/>`,
  earbuds: () =>
    `<circle cx="20" cy="15" r="1.6" fill="#fff"/><circle cx="40" cy="15" r="1.6" fill="#fff"/>` +
    `<rect x="19.3" y="16" width="1.4" height="3" fill="#fff"/><rect x="39.3" y="16" width="1.4" height="3" fill="#fff"/>`,
  thirdEye: () =>
    `<ellipse cx="30" cy="9.5" rx="2.2" ry="1.4" fill="#fff"/><circle cx="30" cy="9.5" r="0.8" fill="#111"/>`,
  glowMarks: () =>
    `<circle cx="24" cy="16" r="1" fill="#a3e635"/><circle cx="36" cy="16" r="1" fill="#a3e635"/>`,
  ledStrip: () => `<rect x="24" y="45" width="12" height="2.2" rx="1" fill="#38bdf8"/>`,
  core: () =>
    `<circle cx="30" cy="50" r="3.5" fill="#facc15" opacity=".9"/><circle cx="30" cy="50" r="1.6" fill="#fff"/>`,
  satDish: () =>
    `<circle cx="46" cy="34" r="3" fill="none" stroke="#9ca3af" stroke-width="1.2"/><line x1="46" y1="34" x2="49" y2="31" stroke="#9ca3af" stroke-width="1"/>`,
  star: () =>
    `<path d="M30 42 L31.2 45.4 L34.8 45.4 L31.9 47.6 L33 51 L30 48.8 L27 51 L28.1 47.6 L25.2 45.4 L28.8 45.4Z" fill="#ffd25c"/>`,
};

export const ACCESSORY_LABELS: Record<string, string> = {
  glasses: 'Glasses',
  shades: 'Shades',
  chain: 'Chain',
  headphones: 'Headphones',
  cap: 'Cap',
  badge: 'Badge',
  wallet: 'Hardware wallet',
  watch: 'Watch',
  vr: 'VR headset',
  laptop: 'Laptop bag',
  earbuds: 'Earbuds',
  thirdEye: 'Third eye',
  glowMarks: 'Glow marks',
  ledStrip: 'LED strip',
  core: 'Power core',
  satDish: 'Sat dish',
  star: 'Star pin',
};

export function defaultAvatarConfig(): ICAvatarConfig {
  return {
    category: 'earth',
    skin: EARTH.skin[2],
    head: 'short',
    featureColor: EARTH.featureColors[1],
    top: 'hoodie',
    topColor: '#8c6bff',
    bottom: 'jeans',
    bottomColor: '#22252b',
    shoes: 'sneakers',
    shoesColor: '#1f1f1f',
    accessories: ['shades', 'chain'],
    text: '',
  };
}

function topTextSvg(text: string): string {
  const t = text.trim().slice(0, 14);
  if (!t) return '';
  const size = Math.max(3.6, 6.4 - t.length * 0.18);
  return (
    `<text x="30" y="52" font-size="${size}" font-weight="800" fill="#fff" stroke="#111" stroke-width="0.5" ` +
    `paint-order="stroke fill" text-anchor="middle" font-family="ui-monospace, monospace">${t}</text>`
  );
}

/** The composed character as inner SVG markup, no wrapping `<svg>`, so it can be inlined
 *  (real vector export) or wrapped for rasterizing (canvas preview/export). */
export function avatarBody(config: ICAvatarConfig): string {
  const set = avatarSetFor(config.category);
  const headFn = set.head[config.head] ?? (() => '');
  const isBehind = set.behind.has(config.head);
  const topFn = TOP[config.top] ?? TOP.hoodie;
  const bottomFn = BOTTOM[config.bottom] ?? BOTTOM.jeans;
  const shoesFn = SHOES[config.shoes] ?? SHOES.sneakers;
  return (
    (isBehind ? headFn(config.featureColor, config.skin) : '') +
    headShape(config.skin) +
    topFn(config.topColor, config.skin) +
    (isBehind ? '' : headFn(config.featureColor, config.skin)) +
    topTextSvg(config.text) +
    bottomFn(config.bottomColor, config.skin) +
    shoesFn(config.shoesColor, config.skin) +
    config.accessories
      .filter((a) => set.accessories.includes(a))
      .map((a) => ACCESSORIES[a]?.() ?? '')
      .join('')
  );
}

export function avatarUrl(config: ICAvatarConfig): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">${avatarBody(config)}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// --- Deterministic seeding: hash a string into a PRNG, then pick each part from it, so the
// same seed always regenerates the same avatar (a shareable code, or a per-wallet default),
// the one genuinely different technique behind Multiavatar's "billions of variations" claim.
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWith(rand: () => number, arr: readonly string[]): string {
  return arr[Math.floor(rand() * arr.length)];
}

export function avatarFromSeed(seed: string, category?: ICAvatarCategory): ICAvatarConfig {
  const rand = mulberry32(hashSeed(seed));
  const cat: ICAvatarCategory = category ?? (rand() < 0.5 ? 'earth' : 'space');
  const set = avatarSetFor(cat);
  const heads = Object.keys(set.head);
  return {
    category: cat,
    skin: pickWith(rand, set.skin),
    head: pickWith(rand, heads),
    featureColor: pickWith(rand, set.featureColors),
    top: pickWith(rand, Object.keys(TOP)),
    topColor: pickWith(rand, ['#3a4a63', '#c8553d', '#2f6b4f', '#efe3cf', '#1a1a1a', '#8c6bff']),
    bottom: pickWith(rand, Object.keys(BOTTOM)),
    bottomColor: pickWith(rand, ['#22252b', '#4a2f22', '#7a5138', '#dfe6ee']),
    shoes: pickWith(rand, Object.keys(SHOES)),
    shoesColor: pickWith(rand, ['#1f1f1f', '#e6d4be', '#2a2a2a']),
    accessories: set.accessories.filter(() => rand() < 0.3),
    text: '',
  };
}

/** Plain random (not seeded), for a "Randomize" button, optionally scoped to one category. */
export function randomAvatarConfig(scope: ICAvatarCategory | 'both'): ICAvatarConfig {
  const category: ICAvatarCategory =
    scope === 'both' ? (Math.random() < 0.5 ? 'earth' : 'space') : scope;
  const set = avatarSetFor(category);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  return {
    category,
    skin: pick(set.skin),
    head: pick(Object.keys(set.head)),
    featureColor: pick(set.featureColors),
    top: pick(Object.keys(TOP)),
    topColor: pick(['#3a4a63', '#c8553d', '#2f6b4f', '#efe3cf', '#1a1a1a', '#8c6bff']),
    bottom: pick(Object.keys(BOTTOM)),
    bottomColor: pick(['#22252b', '#4a2f22', '#7a5138', '#dfe6ee']),
    shoes: pick(Object.keys(SHOES)),
    shoesColor: pick(['#1f1f1f', '#e6d4be', '#2a2a2a']),
    accessories: set.accessories.filter(() => Math.random() < 0.3),
    text: '',
  };
}
