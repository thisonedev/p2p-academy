// A config-driven character: independent part choices composed into one SVG, the same
// swap-a-part idea the rest of the art library already uses, just with a shape per part
// instead of only a color. Combinatorics alone puts this well past a million outputs.

import { fetchFontFace, fontFamily, type ICFont } from './image-constructor-font-list.js';

export type ICAvatarCategory = 'earth' | 'space';
export type ICAvatarGender = 'male' | 'female';

export interface ICAvatarConfig {
  category: ICAvatarCategory;
  gender: ICAvatarGender;
  skin: string;
  head: string;
  featureColor: string;
  expression: string;
  top: string;
  topColor: string;
  bottom: string;
  bottomColor: string;
  shoes: string;
  shoesColor: string;
  accessories: string[];
  text: string;
  textFont: ICFont;
  /** Percent of the 60-wide viewBox, same unit a text layer's own `size` uses. */
  textSize: number;
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

// A torso base under both top and bottom (y=29 is already inside every top's own
// shoulder coverage, so this stays hidden there): some tops end higher than some
// bottoms start (tee/tank hem at 68, some bottoms start at 72), and without this the
// gap between them showed whatever was behind the avatar instead of skin.
const torsoBase = (skin: string) => `<rect x="22" y="29" width="16" height="51" fill="${skin}"/>`;

// Shared across both categories, drawn in a fixed dark line color regardless of skin
// tone (matches how glasses/badge/etc. already use fixed accessory colors).
const FACE = '#1a1a1a';
export const EXPRESSIONS: Record<string, () => string> = {
  happy: () =>
    `<path d="M25 12.5 Q26.5 11 28 12.5" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M32 12.5 Q33.5 11 35 12.5" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M26 16.5 Q30 20 34 16.5" stroke="${FACE}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  excited: () =>
    `<circle cx="26.5" cy="12.5" r="1.4" fill="${FACE}"/><circle cx="33.5" cy="12.5" r="1.4" fill="${FACE}"/>` +
    `<path d="M25.5 16 Q30 21 34.5 16 Q30 18.8 25.5 16Z" fill="${FACE}"/>`,
  // Star- and heart-shaped pupils instead of a mood variation on round eyes, so neither
  // blends into excited or surprised the way an "angry"/"sad" pair would have skewed
  // negative anyway; every expression here now reads positive or neutral.
  starstruck: () =>
    `<path d="M26.5 10.9 L26.97 12 L28 12 L27.2 12.7 L27.5 13.7 L26.5 13.1 L25.5 13.7 L25.8 12.7 L25 12 L26.03 12Z" fill="${FACE}"/>` +
    `<path d="M33.5 10.9 L33.97 12 L35 12 L34.2 12.7 L34.5 13.7 L33.5 13.1 L32.5 13.7 L32.8 12.7 L32 12 L33.03 12Z" fill="${FACE}"/>` +
    `<path d="M26 16.5 Q30 20 34 16.5" stroke="${FACE}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  smitten: () =>
    `<path d="M26.5 13.82 C24.34 11.66 25.6 10.22 26.5 11.66 C27.4 10.22 28.66 11.66 26.5 13.82Z" fill="${FACE}"/>` +
    `<path d="M33.5 13.82 C31.34 11.66 32.6 10.22 33.5 11.66 C34.4 10.22 35.66 11.66 33.5 13.82Z" fill="${FACE}"/>` +
    `<path d="M26 16.5 Q30 20 34 16.5" stroke="${FACE}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  surprised: () =>
    `<circle cx="26.5" cy="12.5" r="1.3" fill="${FACE}"/><circle cx="33.5" cy="12.5" r="1.3" fill="${FACE}"/>` +
    `<circle cx="30" cy="17.5" r="1.4" fill="none" stroke="${FACE}" stroke-width="1"/>`,
  wink: () =>
    `<path d="M25 12.5 Q26.5 11.3 28 12.5" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<circle cx="33.5" cy="12.5" r="1" fill="${FACE}"/>` +
    `<path d="M26.5 16.5 Q30.5 18.8 34 16" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
  // Ten more, redrawn against real Telegram/iOS emoji shapes rather than another mood
  // variation on the six above (user's own reference list). 🤯 and 😱 are left out:
  // both need to break the head's own silhouette (an exploding top, hands over the
  // face), past what this eyes+mouth-on-an-unmodified-head model can draw.
  teary: () =>
    `<path d="M25.3 11 Q26.8 10.2 27.8 11.2" stroke="${FACE}" stroke-width="1" fill="none" stroke-linecap="round"/>` +
    `<path d="M32.2 11.2 Q33.2 10.2 34.7 11" stroke="${FACE}" stroke-width="1" fill="none" stroke-linecap="round"/>` +
    `<circle cx="26.5" cy="12.8" r="1" fill="${FACE}"/><circle cx="33.5" cy="12.8" r="1" fill="${FACE}"/>` +
    `<path d="M26.8 17.2 Q30 16.2 33.2 17.2 Q30 18.4 26.8 17.2Z" fill="${FACE}"/>` +
    `<path d="M25.6 14 Q24.7 15.6 25.6 16.6 Q26.5 15.6 25.6 14Z" fill="#6ab7ff"/>`,
  laughing: () =>
    `<path d="M25 12.7 Q26.5 10.7 28 12.7" stroke="${FACE}" stroke-width="1.2" fill="none" stroke-linecap="round"/>` +
    `<path d="M32 12.7 Q33.5 10.7 35 12.7" stroke="${FACE}" stroke-width="1.2" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="30" cy="18.2" rx="3.6" ry="3" fill="${FACE}"/>` +
    `<path d="M23.4 14 Q22.2 16 23.4 17.6 Q24.2 16 23.4 14Z" fill="#6ab7ff"/>` +
    `<path d="M36.6 14 Q37.8 16 36.6 17.6 Q35.8 16 36.6 14Z" fill="#6ab7ff"/>`,
  kiss: () =>
    `<path d="M25 12.6 Q26.5 10.8 28 12.6" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M32 12.6 Q33.5 10.8 35 12.6" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="31.5" cy="17.2" rx="1.6" ry="1.2" fill="${FACE}"/>` +
    `<path d="M36.5 14.5 C34.34 12.34 35.6 10.9 36.5 12.34 C37.4 10.9 38.66 12.34 36.5 14.5Z" fill="#ff5c8a"/>`,
  huff: () =>
    `<path d="M25.2 11.3 L27.8 12" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M34.8 11.3 L32.2 12" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M25.2 12.7 L27.8 12.7" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M32.2 12.7 L34.8 12.7" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M28.6 17 L31.4 17" stroke="${FACE}" stroke-width="1.2" fill="none" stroke-linecap="round"/>` +
    `<path d="M23.6 14.4 Q22 13.6 23 12.2" stroke="#b9c4cc" stroke-width="0.9" fill="none" stroke-linecap="round"/>` +
    `<path d="M36.4 14.4 Q38 13.6 37 12.2" stroke="#b9c4cc" stroke-width="0.9" fill="none" stroke-linecap="round"/>`,
  // Eyes shifted toward the center (a side glance) instead of centered dashes, so
  // this reads as unimpressed rather than just a paler copy of "blank" below.
  unamused: () =>
    `<path d="M26.3 12.5 L28.3 12.5" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M33.7 12.5 L35.7 12.5" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M26.5 17.3 Q30.5 16.2 33.8 17" stroke="${FACE}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
  cheeky: () =>
    `<path d="M25 12.5 Q26.5 11.3 28 12.5" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<circle cx="33.5" cy="12.4" r="1.3" fill="${FACE}"/>` +
    `<path d="M26 16.3 Q30 18.6 32.6 16.8" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M31 17.6 Q32.4 20.4 34.2 18.4 Q32.6 18.6 31 17.6Z" fill="#ff6f81"/>`,
  skeptical: () =>
    `<path d="M24.8 10.6 Q26.5 9.2 28.4 10.4" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M32.2 11.6 L34.8 11.6" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<circle cx="26.5" cy="12.6" r="1" fill="${FACE}"/><circle cx="33.5" cy="12.6" r="1" fill="${FACE}"/>` +
    `<path d="M27.4 17.1 L32.6 17.1" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
  smirk: () =>
    `<path d="M25 12.7 L28 12.5" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M32 12.5 L35 12.7" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M26.5 16.6 Q30 16.2 32.6 15 Q33 16.6 31 17.6 Q28.4 18 26.5 16.6Z" fill="${FACE}"/>`,
  blank: () =>
    `<path d="M25 12.5 L28 12.5" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M32 12.5 L35 12.5" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M27 17 L33 17" stroke="${FACE}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  monocle: () =>
    `<circle cx="26.5" cy="12.6" r="1" fill="${FACE}"/>` +
    `<circle cx="33.5" cy="12.6" r="2.4" fill="none" stroke="#c9a227" stroke-width="0.9"/><circle cx="33.5" cy="12.6" r="1" fill="${FACE}"/>` +
    `<path d="M35.9 12.6 L37.4 14" stroke="#c9a227" stroke-width="0.8" fill="none" stroke-linecap="round"/>` +
    `<path d="M23.8 10.8 Q26.5 9.4 28.6 10.8" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M27.4 17.1 L32.6 17.1" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
  angry: () =>
    `<path d="M24.8 11 L27.8 12.4" stroke="${FACE}" stroke-width="1.2" fill="none" stroke-linecap="round"/>` +
    `<path d="M35.2 11 L32.2 12.4" stroke="${FACE}" stroke-width="1.2" fill="none" stroke-linecap="round"/>` +
    `<circle cx="26.7" cy="13.1" r="1.1" fill="${FACE}"/><circle cx="33.3" cy="13.1" r="1.1" fill="${FACE}"/>` +
    `<path d="M26.5 17.4 Q30 16 33.5 17.4" stroke="${FACE}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  pensive: () =>
    `<path d="M25 12 Q26.5 13.4 28 12" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M32 12 Q33.5 13.4 35 12" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M27 17.6 Q30 16.4 33 17.6" stroke="${FACE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
};

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
    'headphones',
    'cap',
    'badge',
    'wallet',
    'vr',
    'laptop',
    'earbuds',
    'moonNecklace',
    'marsNecklace',
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
    // Visor removed (user), kept here commented rather than deleted.
    /* visor: (c) => `<rect x="19" y="12" width="22" height="4" rx="2" fill="${c}"/>`, */
    none: () => '',
  },
  accessories: [
    'glowMarks',
    'thirdEye',
    'badge',
    'star',
    'ledStrip',
    'core',
    'satDish',
    'moonNecklace',
    'marsNecklace',
  ],
};

export function avatarSetFor(category: ICAvatarCategory): AvatarSet {
  return category === 'earth' ? EARTH : SPACE;
}

// --- Shared across both categories: clothes don't need a different silhouette per world.
// Jacket, crewneck and blazer read as near-identical blobs and are gone; suit, pajamas,
// vest and robe replace them with genuinely different silhouettes (open front, bare arms,
// wide sleeves) instead of another variation on the same boxy long-sleeve shape.
export const TOP: Record<string, PartFn> = {
  hoodie: (c, skin) =>
    // Hood collar peeking up behind the neckline, a kangaroo pocket and drawstrings are
    // what actually read as "hoodie"; the old version was a long-sleeve tee in disguise.
    `<path d="M18 29 Q30 19 42 29 L40 33 Q30 26 20 33Z" fill="${c}"/>` +
    `<path d="M14 32 Q30 26 46 32 L49 76 L11 76Z" fill="${c}"/>` +
    `<path d="M13 33 L5 70 L12 72 L19 43Z" fill="${c}"/><path d="M47 33 L55 70 L48 72 L41 43Z" fill="${c}"/>` +
    `<circle cx="8" cy="71" r="2.6" fill="${skin}"/><circle cx="52" cy="71" r="2.6" fill="${skin}"/>` +
    `<rect x="20" y="52" width="20" height="14" rx="3" fill="#000" opacity=".18"/>` +
    `<path d="M27 33 L26 44 M33 33 L34 44" stroke="#000" stroke-width="1" opacity=".4"/>` +
    `<circle cx="26" cy="44" r="1" fill="#000" opacity=".4"/><circle cx="34" cy="44" r="1" fill="#000" opacity=".4"/>`,
  tee: (c, skin) =>
    // A short, colored sleeve cap over the bare arm: without it this was just a tank
    // top with a taller collar, no actual sleeve reading at the shoulder (user).
    // Hem at 74, past every bottom's own waistband (70-72): a shorter hem here left a
    // gap that only showed as bare midriff (torsoBase's skin fallback), reading as a
    // separate, disconnected body chunk (user: "why the girl is fat but look skinny").
    `<path d="M15 31 Q30 27 45 31 L47 74 L13 74Z" fill="${c}"/>` +
    `<path d="M14 32 L8 54 L13 56 L19 40Z" fill="${skin}"/><path d="M46 32 L52 54 L47 56 L41 40Z" fill="${skin}"/>` +
    `<path d="M14 32 L11.5 41 L16.5 46 L19 40Z" fill="${c}"/><path d="M46 32 L48.5 41 L43.5 46 L41 40Z" fill="${c}"/>`,
  tank: (c, skin) =>
    // Bare arms have to start right at the tank's own narrower shoulder edge (x 20/40):
    // borrowing the tee's wider x 14/46 start left a visible gap/step at the shoulder.
    // Hem at 74, same reasoning as tee above. Hem corners widened to 14/46: every
    // bottom's own waistband is 32-34 wide, so the narrower 18/42 hem this had before
    // let every pair of pants visibly flare out wider than the top right at the
    // beltline (user, two screenshots: "legs are huge in comparison to the small body").
    `<path d="M20 31 Q30 28 40 31 L46 74 L14 74Z" fill="${c}"/>` +
    `<path d="M19 32 L12 65 L17 67 L23 40Z" fill="${skin}"/><path d="M41 32 L48 65 L43 67 L37 40Z" fill="${skin}"/>`,
  // Shirt, suit and robe removed (user: "terrible"), kept here commented rather than
  // deleted in case they're worth a rebuild later.
  /* shirt: (c) =>
    `<path d="M15 31 Q30 27 45 31 L47 70 L13 70Z" fill="${c}"/>` +
    `<path d="M14 32 L8 58 L13 60 L19 40Z" fill="${c}"/><path d="M46 32 L52 58 L47 60 L41 40Z" fill="${c}"/>` +
    `<path d="M25 30 L30 40 L35 30 L30 27Z" fill="#f4efe4"/>` +
    `<line x1="30" y1="40" x2="30" y2="68" stroke="#000" stroke-width=".6" opacity=".3"/>`,
  suit: (c) =>
    `<path d="M14 31 L30 37 L46 31 L48 76 L12 76Z" fill="${c}"/>` +
    `<path d="M27 32 L30 46 L33 32 L30 29Z" fill="#f4efe4"/>` +
    `<path d="M29 32 L30 46 L27.5 33Z" fill="#1a1a1a"/>` +
    `<path d="M13 32 L6 70 L12 72 L19 42Z" fill="${c}"/><path d="M47 32 L54 70 L48 72 L41 42Z" fill="${c}"/>` +
    `<line x1="22" y1="33" x2="20" y2="76" stroke="#000" stroke-width=".6" opacity=".25"/>` +
    `<line x1="38" y1="33" x2="40" y2="76" stroke="#000" stroke-width=".6" opacity=".25"/>`,
  robe: (c) =>
    `<path d="M15 31 Q30 26 45 31 L46 78 L34 78 L30 60 L26 78 L14 78Z" fill="${c}"/>` +
    `<path d="M12 32 L2 62 L9 66 L18 40Z" fill="${c}"/><path d="M48 32 L58 62 L51 66 L42 40Z" fill="${c}"/>` +
    `<rect x="24" y="52" width="12" height="4" rx="2" fill="#000" opacity=".3"/>` +
    `<line x1="24" y1="32" x2="26" y2="78" stroke="#000" stroke-width=".7" opacity=".3"/>` +
    `<line x1="36" y1="32" x2="34" y2="78" stroke="#000" stroke-width=".7" opacity=".3"/>`, */
  // Pajamas paused (user: still doesn't look good after the collar/placket redesign),
  // kept here commented rather than deleted in case it's worth a third attempt later.
  /* pajamas: (c) =>
    `<path d="M15 31 Q30 27 45 31 L47 72 L13 72Z" fill="${c}"/>` +
    `<path d="M14 32 L8 60 L13 62 L19 42Z" fill="${c}"/><path d="M46 32 L52 60 L47 62 L41 42Z" fill="${c}"/>` +
    `<path d="M22 30 L30 38 L27 45 L22 34Z" fill="#f4efe4"/><path d="M38 30 L30 38 L33 45 L38 34Z" fill="#f4efe4"/>` +
    `<line x1="30" y1="38" x2="30" y2="70" stroke="#000" stroke-width=".6" opacity=".3"/>` +
    `<circle cx="30" cy="44" r="1" fill="#000" opacity=".4"/><circle cx="30" cy="52" r="1" fill="#000" opacity=".4"/><circle cx="30" cy="60" r="1" fill="#000" opacity=".4"/>` +
    `<line x1="15" y1="42" x2="45" y2="42" stroke="#000" stroke-width=".8" opacity=".18"/>` +
    `<line x1="14" y1="52" x2="46" y2="52" stroke="#000" stroke-width=".8" opacity=".18"/>` +
    `<line x1="13.5" y1="62" x2="46.5" y2="62" stroke="#000" stroke-width=".8" opacity=".18"/>`, */
  vest: (c, skin) =>
    // Sleeveless: bare skin-tone arms instead of a matching-color sleeve. Hem widened
    // to 14/46 same as tank above, to stop jeans/cargo's 34-wide waistband flaring
    // past this top's own hem.
    `<path d="M18 31 Q30 34 42 31 L46 74 L14 74Z" fill="${c}"/>` +
    `<path d="M27 32 L30 44 L33 32 L30 29Z" fill="#f4efe4"/>` +
    `<path d="M17 32 L10 68 L15 70 L21 42Z" fill="${skin}"/><path d="M43 32 L50 68 L45 70 L39 42Z" fill="${skin}"/>` +
    `<line x1="24" y1="32" x2="22" y2="74" stroke="#000" stroke-width=".6" opacity=".25"/>` +
    `<line x1="36" y1="32" x2="38" y2="74" stroke="#000" stroke-width=".6" opacity=".25"/>`,
};

export const BOTTOM: Record<string, PartFn> = {
  // Stitching, back pockets and belt loops so it reads as denim, not the same block as
  // trousers/cargo with a different name.
  jeans: (c) =>
    `<path d="M13 72 L47 72 L45 131 L32 131 L30 92 L28 131 L15 131Z" fill="${c}"/>` +
    `<line x1="15" y1="74" x2="14" y2="129" stroke="#fff" stroke-width=".6" opacity=".35"/>` +
    `<line x1="45" y1="74" x2="46" y2="129" stroke="#fff" stroke-width=".6" opacity=".35"/>` +
    `<path d="M18 78 L26 78 L25 84 L19 84Z" fill="#000" opacity=".2"/>` +
    `<path d="M34 78 L42 78 L41 84 L35 84Z" fill="#000" opacity=".2"/>` +
    `<rect x="20" y="71" width="2" height="4" fill="#000" opacity=".3"/><rect x="38" y="71" width="2" height="4" fill="#000" opacity=".3"/>`,
  trousers: (c) => `<path d="M14 70 L46 70 L44 132 L31 132 L30 90 L29 132 L16 132Z" fill="${c}"/>`,
  shorts: (c, skin) =>
    `<path d="M14 72 L46 72 L44 96 L31 96 L30 88 L29 96 L16 96Z" fill="${c}"/>` +
    `<rect x="22" y="96" width="6" height="34" rx="3" fill="${skin}"/><rect x="32" y="96" width="6" height="34" rx="3" fill="${skin}"/>`,
  skirt: (c, skin) =>
    // A-line, ends above the knee: bare legs continue down to the shoes, unlike every
    // other bottom, which covers to the ankle.
    `<path d="M14 72 L46 72 L50 104 L10 104Z" fill="${c}"/>` +
    `<rect x="19" y="104" width="7" height="27" rx="3" fill="${skin}"/><rect x="34" y="104" width="7" height="27" rx="3" fill="${skin}"/>`,
  joggers: (c) =>
    `<path d="M14 70 L46 70 L43 128 L33 128 L30 92 L27 128 L17 128Z" fill="${c}"/>` +
    `<rect x="16" y="126" width="12" height="5" rx="2.5" fill="${c}"/><rect x="32" y="126" width="12" height="5" rx="2.5" fill="${c}"/>`,
  cargo: (c) =>
    `<path d="M13 72 L47 72 L45 131 L32 131 L30 92 L28 131 L15 131Z" fill="${c}"/>` +
    `<rect x="10" y="90" width="7" height="10" rx="1.5" fill="${c}" stroke="#000" stroke-width=".5" stroke-opacity=".3"/>` +
    `<rect x="43" y="90" width="7" height="10" rx="1.5" fill="${c}" stroke="#000" stroke-width=".5" stroke-opacity=".3"/>`,
};

// Boots were a plain rounded rect and looked it, dropped rather than fixed. Every shape
// below has a distinct silhouette instead of the same blob resting under the ankle.
export const SHOES: Record<string, PartFn> = {
  sneakers: (c) =>
    `<path d="M15 130 Q15 125 22 125 Q29 125 29 130 L29 134 L15 134Z" fill="${c}"/>` +
    `<rect x="14" y="132.6" width="16" height="2.4" rx="1.2" fill="#fff" opacity=".85"/>` +
    `<path d="M31 130 Q31 125 38 125 Q45 125 45 130 L45 134 L31 134Z" fill="${c}"/>` +
    `<rect x="30" y="132.6" width="16" height="2.4" rx="1.2" fill="#fff" opacity=".85"/>` +
    `<line x1="19" y1="126" x2="19" y2="130" stroke="#000" stroke-width=".5" opacity=".3"/>` +
    `<line x1="35" y1="126" x2="35" y2="130" stroke="#000" stroke-width=".5" opacity=".3"/>`,
  // Heels paused (user: still doesn't look good after the low-cut-vamp redesign), kept
  // here commented rather than deleted in case it's worth a third attempt later.
  /* heels: (c, skin) =>
    `<path d="M16 127 Q16 133 22 133 Q28 133 28 127 L27 125 Q22 123 16 125Z" fill="${skin}"/>` +
    `<path d="M16 130 L28 130 L27 133 L17 133Z" fill="${c}"/>` +
    `<rect x="20.5" y="133" width="1.8" height="5" rx=".9" fill="${c}"/>` +
    `<path d="M32 127 Q32 133 38 133 Q44 133 44 127 L43 125 Q38 123 32 125Z" fill="${skin}"/>` +
    `<path d="M32 130 L44 130 L43 133 L33 133Z" fill="${c}"/>` +
    `<rect x="36.5" y="133" width="1.8" height="5" rx=".9" fill="${c}"/>`, */
  flipflops: (c, skin) =>
    `<ellipse cx="22" cy="133" rx="7.5" ry="2.4" fill="${c}"/><path d="M22 129 L19 132 M22 129 L25 132" stroke="${skin}" stroke-width="1.2" fill="none"/>` +
    `<ellipse cx="38" cy="133" rx="7.5" ry="2.4" fill="${c}"/><path d="M38 129 L35 132 M38 129 L41 132" stroke="${skin}" stroke-width="1.2" fill="none"/>`,
  loafers: (c) =>
    `<path d="M15 131 Q15 126 22 126 Q29 126 29 131 L29 134 L15 134Z" fill="${c}"/><rect x="19.5" y="128" width="5" height="2" rx="1" fill="#000" opacity=".25"/>` +
    `<path d="M31 131 Q31 126 38 126 Q45 126 45 131 L45 134 L31 134Z" fill="${c}"/><rect x="35.5" y="128" width="5" height="2" rx="1" fill="#000" opacity=".25"/>`,
  platforms: (c) =>
    `<path d="M15 128 Q15 124 22 124 Q29 124 29 128 L29 130 L15 130Z" fill="${c}"/><rect x="14" y="130" width="16" height="5" rx="1" fill="${c}" opacity=".85"/>` +
    `<path d="M31 128 Q31 124 38 124 Q45 124 45 128 L45 130 L31 130Z" fill="${c}"/><rect x="30" y="130" width="16" height="5" rx="1" fill="${c}" opacity=".85"/>`,
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
  // A gold chain arc, a crescent or a small ringed planet standing in for a plain
  // pendant circle: "to the moon" and "to Mars" as a wearable, not a headline.
  moonNecklace: () =>
    // A full circle minus an inner circle (evenodd), the inner one entirely inside the
    // outer one so no sliver of it pokes out the other side (user: "it doesn't need
    // that right curl" — the inner circle's first cut stuck out past the outer edge).
    `<path d="M20 30 Q30 40 40 30" fill="none" stroke="#e8c34a" stroke-width="1.6"/>` +
    `<path fill-rule="evenodd" d="M27.6 39 A2.4 2.4 0 1 0 32.4 39 A2.4 2.4 0 1 0 27.6 39 M28.9 39 A1.7 1.7 0 1 0 32.3 39 A1.7 1.7 0 1 0 28.9 39" fill="#e8c34a"/>`,
  marsNecklace: () =>
    `<path d="M20 30 Q30 40 40 30" fill="none" stroke="#e8c34a" stroke-width="1.6"/>` +
    `<circle cx="30" cy="40" r="2.6" fill="#c1440e"/><ellipse cx="30" cy="40" rx="4" ry="1" fill="none" stroke="#e8c34a" stroke-width=".6"/>`,
  headphones: () =>
    `<path d="M18 12 Q18 -2 30 -2 Q42 -2 42 12" fill="none" stroke="#222" stroke-width="2.4"/>` +
    `<rect x="14.5" y="9" width="5" height="9" rx="2" fill="#222"/><rect x="40.5" y="9" width="5" height="9" rx="2" fill="#222"/>`,
  cap: () =>
    `<path d="M20 8 Q20 1 30 1 Q40 1 40 8 L40 10 L20 10Z" fill="#1a1a1a"/><path d="M20 9 L10 12 L20 12Z" fill="#1a1a1a"/>`,
  badge: () =>
    `<circle cx="36" cy="45" r="4" fill="#5b8cff"/><path d="M34.3 45 L35.6 46.4 L37.8 43.8" stroke="#fff" stroke-width=".9" fill="none"/>`,
  wallet: () =>
    `<rect x="42" y="58" width="9" height="14" rx="1.5" fill="#1f2937" stroke="#9ca3af" stroke-width=".6"/><circle cx="46.5" cy="63" r="1.3" fill="#38bdf8"/>`,
  // Watch removed (user: often looks off, not worth more tokens on it), kept here
  // commented rather than deleted in case it's worth a rebuild later.
  /* watch: () =>
    `<rect x="6" y="63" width="6" height="5" rx="1" fill="#1a1a1a"/><circle cx="9" cy="65.5" r="1.6" fill="#e8c34a"/>`, */
  vr: () =>
    // Was 24 wide against an 18-wide head, sticking out both sides. Now sits inside it.
    `<rect x="22" y="10.5" width="16" height="7" rx="2.5" fill="#141414"/>` +
    `<rect x="23.5" y="12.2" width="5.5" height="3.2" rx="1" fill="#38bdf8" opacity=".7"/>` +
    `<rect x="31" y="12.2" width="5.5" height="3.2" rx="1" fill="#38bdf8" opacity=".7"/>`,
  laptop: () =>
    `<line x1="18" y1="30" x2="42" y2="68" stroke="#3a2a1e" stroke-width="1.6"/><rect x="36" y="60" width="12" height="9" rx="1.5" fill="#1f2937" stroke="#9ca3af" stroke-width=".5"/>`,
  earbuds: () =>
    `<circle cx="21.5" cy="14.5" r="1.1" fill="#fff"/><circle cx="38.5" cy="14.5" r="1.1" fill="#fff"/>` +
    `<rect x="20.9" y="15.3" width="1.1" height="2.2" fill="#fff"/><rect x="37.9" y="15.3" width="1.1" height="2.2" fill="#fff"/>`,
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
  moonNecklace: 'Moon necklace',
  marsNecklace: 'Mars necklace',
  headphones: 'Headphones',
  cap: 'Cap',
  badge: 'Badge',
  wallet: 'Hardware wallet',
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
    gender: 'male',
    skin: EARTH.skin[2],
    head: 'short',
    featureColor: EARTH.featureColors[1],
    expression: 'happy',
    top: 'hoodie',
    topColor: '#8c6bff',
    bottom: 'jeans',
    bottomColor: '#22252b',
    shoes: 'sneakers',
    shoesColor: '#1f1f1f',
    accessories: ['shades', 'moonNecklace'],
    text: '',
    textFont: 'sans',
    textSize: 5.5,
  };
}

function topTextSvg(text: string, font: ICFont, size: number): string {
  const t = text.trim().slice(0, 14);
  if (!t) return '';
  return (
    `<text x="30" y="52" font-size="${size}" font-weight="800" fill="#fff" stroke="#111" stroke-width="0.5" ` +
    `paint-order="stroke fill" text-anchor="middle" font-family="'${fontFamily(font)}'">${t}</text>`
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
  const expressionFn = EXPRESSIONS[config.expression] ?? EXPRESSIONS.happy;
  // A subtle shoulder-width scale on the whole top, not a separate shape per garment
  // per gender: broader for male, narrower for female, anchored at the torso's center.
  const shoulderScale = config.gender === 'male' ? 1.1 : 0.86;
  return (
    (isBehind ? headFn(config.featureColor, config.skin) : '') +
    headShape(config.skin) +
    expressionFn() +
    torsoBase(config.skin) +
    `<g transform="translate(30,50) scale(${shoulderScale},1) translate(-30,-50)">${topFn(config.topColor, config.skin)}</g>` +
    (isBehind ? '' : headFn(config.featureColor, config.skin)) +
    topTextSvg(config.text, config.textFont, config.textSize) +
    bottomFn(config.bottomColor, config.skin) +
    shoesFn(config.shoesColor, config.skin) +
    config.accessories
      .filter((a) => set.accessories.includes(a))
      .map((a) => ACCESSORIES[a]?.() ?? '')
      .join('')
  );
}

/** An `<img>` rasterizing this SVG can't see the page's own loaded web fonts, so the
 *  text-on-top font is embedded directly, the same way the full design's SVG export
 *  already embeds whichever fonts a design uses. Skipped when there's no text to draw. */
export async function avatarUrl(config: ICAvatarConfig): Promise<string> {
  const face = config.text.trim() ? await fetchFontFace(config.textFont) : null;
  const defs = face ? `<defs><style>${face}</style></defs>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">${defs}${avatarBody(config)}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface ICAvatarCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Head-and-shoulders square crop for a profile picture, in the same 0-to-60/0-to-140
 *  unit space every other part uses. Head features that reach above y=0 (antenna,
 *  crown) already clip there in every render, not just this one. */
export const AVATAR_PFP_CROP: ICAvatarCrop = { x: 5, y: 0, w: 50, h: 50 };
export const AVATAR_FULL_CROP: ICAvatarCrop = { x: 0, y: 0, w: 60, h: 140 };

async function rasterizeAvatar(
  config: ICAvatarConfig,
  pxWidth: number,
  pxHeight: number,
): Promise<HTMLImageElement> {
  const face = config.text.trim() ? await fetchFontFace(config.textFont) : null;
  const defs = face ? `<defs><style>${face}</style></defs>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pxWidth}" height="${pxHeight}" viewBox="${VIEWBOX}">${defs}${avatarBody(config)}</svg>`;
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not rasterize the avatar.'));
    img.src = url;
  });
}

export interface ICAvatarExportOptions {
  /** Pixels wide; height follows from the crop's own aspect ratio. */
  width?: number;
  format?: 'png' | 'jpeg';
  /** 0 to 1, JPEG only. */
  quality?: number;
  /** PNG only: JPEG has no transparency and always gets a white fill instead. */
  transparentBg?: boolean;
}

/** One element, cropped to `crop` (in the avatar's own 0-60/0-140 unit space), as a
 *  raster PNG or JPEG. The same crop rectangle also drives `avatarCropSvg` below, so
 *  the two stay in sync. */
export async function avatarCropPng(
  config: ICAvatarConfig,
  crop: ICAvatarCrop,
  opts: ICAvatarExportOptions = {},
): Promise<string> {
  const { width = 640, format = 'png', quality = 0.92, transparentBg = true } = opts;
  const outW = width;
  const outH = Math.round(width * (crop.h / crop.w));
  const scale = outW / crop.w;
  const img = await rasterizeAvatar(config, Math.round(60 * scale), Math.round(140 * scale));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the avatar.');
  if (format === 'jpeg' || !transparentBg) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, outW, outH);
  }
  const sx = crop.x * scale;
  const sy = crop.y * scale;
  ctx.drawImage(img, sx, sy, crop.w * scale, crop.h * scale, 0, 0, outW, outH);
  return format === 'jpeg'
    ? canvas.toDataURL('image/jpeg', quality)
    : canvas.toDataURL('image/png');
}

/** The same crop as real, editable SVG markup: text and shapes stay vector, the same
 *  way the full design's own SVG export works. */
export async function avatarCropSvg(config: ICAvatarConfig, crop: ICAvatarCrop): Promise<string> {
  const face = config.text.trim() ? await fetchFontFace(config.textFont) : null;
  const defs = face ? `<defs><style>${face}</style></defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}">${defs}${avatarBody(config)}</svg>`;
}

// --- Deterministic seeding: hash a string into a PRNG, then pick each part from it, so the
// same seed always regenerates the same avatar, useful for a shareable code or a per-wallet
// default. Plain random() alone already covers "millions of combinations", given the part count.
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
  const gender = pickWith(rand, ['male', 'female']) as ICAvatarGender;
  // Skirt reads as a real gendered garment, unlike hair/headwear (a deliberate
  // diversity axis, not a costume pick) - random male avatars skip it (user).
  const bottoms =
    gender === 'male' ? Object.keys(BOTTOM).filter((b) => b !== 'skirt') : Object.keys(BOTTOM);
  return {
    category: cat,
    gender,
    skin: pickWith(rand, set.skin),
    head: pickWith(rand, heads),
    featureColor: pickWith(rand, set.featureColors),
    expression: pickWith(rand, Object.keys(EXPRESSIONS)),
    top: pickWith(rand, Object.keys(TOP)),
    topColor: pickWith(rand, ['#3a4a63', '#c8553d', '#2f6b4f', '#efe3cf', '#1a1a1a', '#8c6bff']),
    bottom: pickWith(rand, bottoms),
    bottomColor: pickWith(rand, ['#22252b', '#4a2f22', '#7a5138', '#dfe6ee']),
    shoes: pickWith(rand, Object.keys(SHOES)),
    shoesColor: pickWith(rand, ['#1f1f1f', '#e6d4be', '#2a2a2a']),
    accessories: set.accessories.filter(() => rand() < 0.3),
    text: '',
    textFont: 'sans',
    textSize: 5.5,
  };
}

/** Plain random (not seeded), for a "Randomize" button, optionally scoped to one category. */
export function randomAvatarConfig(scope: ICAvatarCategory | 'both'): ICAvatarConfig {
  const category: ICAvatarCategory =
    scope === 'both' ? (Math.random() < 0.5 ? 'earth' : 'space') : scope;
  const set = avatarSetFor(category);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const gender = pick(['male', 'female'] as const);
  const bottoms =
    gender === 'male' ? Object.keys(BOTTOM).filter((b) => b !== 'skirt') : Object.keys(BOTTOM);
  return {
    category,
    gender,
    skin: pick(set.skin),
    head: pick(Object.keys(set.head)),
    featureColor: pick(set.featureColors),
    expression: pick(Object.keys(EXPRESSIONS)),
    top: pick(Object.keys(TOP)),
    topColor: pick(['#3a4a63', '#c8553d', '#2f6b4f', '#efe3cf', '#1a1a1a', '#8c6bff']),
    bottom: pick(bottoms),
    bottomColor: pick(['#22252b', '#4a2f22', '#7a5138', '#dfe6ee']),
    shoes: pick(Object.keys(SHOES)),
    shoesColor: pick(['#1f1f1f', '#e6d4be', '#2a2a2a']),
    accessories: set.accessories.filter(() => Math.random() < 0.3),
    text: '',
    textFont: 'sans',
    textSize: 5.5,
  };
}
