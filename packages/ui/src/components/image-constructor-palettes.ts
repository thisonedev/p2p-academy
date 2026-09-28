// Popular community palettes: the top 3 of all time, of the year and of the month.

export type ICRole = 'bg' | 'bg2' | 'panel' | 'card' | 'ink' | 'muted' | 'accent' | 'onAccent';
export type ICRoles = Record<ICRole, string>;

export interface ICPalette {
  id: string;
  name: string;
  /** The four colors as published. */
  colors: string[];
  /** The colors mapped onto design roles, with text colors adjusted until they are legible. */
  roles: ICRoles;
}

const toRgb = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

const toHex = (rgb: number[]): string =>
  `#${rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

export const luminance = (hex: string): number => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two colors. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const mix = (a: string, b: string, t: number): string =>
  toHex(toRgb(a).map((v, i) => v + (toRgb(b)[i] - v) * t));

/** Moves a color toward black or white, whichever needs the smaller shift, until it reads on every background. */
export function legible(color: string, backgrounds: string[], min: number): string {
  const worst = (c: string) => Math.min(...backgrounds.map((bg) => contrast(c, bg)));
  if (worst(color) >= min) return color;
  let pass: { step: number; color: string } | null = null;
  let best = color;
  let bestScore = worst(color);
  for (const target of ['#000000', '#ffffff']) {
    for (let step = 1; step <= 20; step++) {
      const candidate = mix(color, target, step * 0.05);
      const score = worst(candidate);
      if (score >= min) {
        if (!pass || step < pass.step) pass = { step, color: candidate };
        break;
      }
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }
  return pass?.color ?? best;
}

interface Pick {
  bg: number;
  bg2: number;
  panel: number;
  card: number;
  accent: number;
  ink: number;
}

function build(id: string, name: string, code: string, pick: Pick): ICPalette {
  const colors = [0, 1, 2, 3].map((i) => `#${code.slice(i * 6, i * 6 + 6)}`);
  const [bg, bg2, panel, card] = [pick.bg, pick.bg2, pick.panel, pick.card].map((i) => colors[i]);
  // The accent also colors large headings, so a pale one is deepened to read on the background.
  const accent = legible(colors[pick.accent], [bg], 3);
  const surfaces = [bg, panel, card];
  const ink = legible(colors[pick.ink], surfaces, 4.5);
  const muted = legible(mix(ink, bg, 0.3), surfaces, 4);
  const onAccent =
    contrast('#ffffff', accent) >= contrast('#111111', accent) ? '#ffffff' : '#111111';
  return { id, name, colors, roles: { bg, bg2, panel, card, ink, muted, accent, onAccent } };
}

export const PALETTES: ICPalette[] = [
  // All time.
  build('aqua-mist', 'Aqua mist', 'e3fdfdcbf1f5a6e3e971c9ce', {
    bg: 0,
    bg2: 1,
    panel: 1,
    card: 1,
    accent: 3,
    ink: 3,
  }),
  build('navy-ice', 'Navy and ice', 'f9f7f7dbe2ef3f72af112d4e', {
    bg: 0,
    bg2: 1,
    panel: 1,
    card: 1,
    accent: 2,
    ink: 3,
  }),
  build('peach-blush', 'Peach blush', 'fff5e4ffe3e1ffd1d1ff9494', {
    bg: 0,
    bg2: 1,
    panel: 1,
    card: 1,
    accent: 3,
    ink: 3,
  }),
  // This year.
  build('linen', 'Linen', 'f9f8f6efe9e3d9cfc7c9b59c', {
    bg: 0,
    bg2: 1,
    panel: 1,
    card: 1,
    accent: 3,
    ink: 3,
  }),
  build('rose-milk', 'Rose milk', 'fcf8f8fbefeff9dfdff5afaf', {
    bg: 0,
    bg2: 1,
    panel: 2,
    card: 1,
    accent: 3,
    ink: 3,
  }),
  build('mint-coral', 'Mint and coral', 'fcf9eabadfdbffa4a4ffbdbd', {
    bg: 0,
    bg2: 1,
    panel: 1,
    card: 1,
    accent: 2,
    ink: 1,
  }),
  // This month.
  build('sage-sand', 'Sage and sand', '8b9a6ef7f2ebeae2d6eeeeee', {
    bg: 2,
    bg2: 3,
    panel: 1,
    card: 1,
    accent: 0,
    ink: 0,
  }),
  build('petal-mint', 'Petal and mint', 'f29191f7adadb1e5e6ccfbfa', {
    bg: 2,
    bg2: 1,
    panel: 1,
    card: 3,
    accent: 0,
    ink: 0,
  }),
  build('burgundy-ivory', 'Burgundy and ivory', '800020f3e6d5fff9f2d45060', {
    bg: 1,
    bg2: 2,
    panel: 2,
    card: 2,
    accent: 3,
    ink: 0,
  }),
];

/** Palettes no longer listed, still found for designs that were made with one. */
const RETIRED: ICPalette[] = [
  build('blush-charcoal', 'Blush and charcoal', 'fff5f5f7d6d0e2b4bd4a4a4a', {
    bg: 1,
    bg2: 0,
    panel: 0,
    card: 0,
    accent: 2,
    ink: 3,
  }),
  build('deep-forest', 'Deep forest', '09232812544f2a835f8bbb92', {
    bg: 0,
    bg2: 1,
    panel: 1,
    card: 1,
    accent: 3,
    ink: 3,
  }),
  build('plum-cream', 'Plum and cream', '601d49bd5579ea9d9dffebb8', {
    bg: 0,
    bg2: 1,
    panel: 1,
    card: 1,
    accent: 2,
    ink: 3,
  }),
  build('lavender-sky', 'Lavender sky', 'fdf4d2b0cde6a290b7946d6d', {
    bg: 0,
    bg2: 1,
    panel: 1,
    card: 1,
    accent: 2,
    ink: 3,
  }),
  build('sunset-cream', 'Sunset cream', 'ffedb9ffcb56ffa259ff7e7e', {
    bg: 0,
    bg2: 1,
    panel: 1,
    card: 1,
    accent: 3,
    ink: 2,
  }),
  build('wine-cellar', 'Wine cellar', '6d08082d0000757d6feeead7', {
    bg: 1,
    bg2: 0,
    panel: 0,
    card: 0,
    accent: 2,
    ink: 3,
  }),
  build('meadow-coral', 'Meadow and coral', 'd96868f2f2f291ae6e689d4b', {
    bg: 1,
    bg2: 1,
    panel: 2,
    card: 2,
    accent: 0,
    ink: 3,
  }),
];

/** Every palette a design might name, listed or retired. */
export const findPalette = (id: string | undefined): ICPalette | undefined =>
  id === undefined ? undefined : [...PALETTES, ...RETIRED].find((p) => p.id === id);
