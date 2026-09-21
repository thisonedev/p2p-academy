// Placeholder product art that ships with the templates. Its colors follow the palette until
// the user replaces it with a photo.

import { type ICRole, type ICRoles, legible, mix } from './image-constructor-palettes.js';

interface SampleColor {
  color: string;
  role?: ICRole;
  /** Positive mixes in black, negative mixes in white. */
  shade?: number;
  /** Moved off the backdrop when it would blend in. */
  fit?: boolean;
  /** A slot this color is shaded from, so it follows that slot when it is moved. */
  like?: string;
}

interface Sample {
  body: string;
  colors: Record<string, SampleColor>;
}

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const SAMPLES: Record<string, Sample> = {
  'sample-trousers.svg': {
    body:
      '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="100" viewBox="0 0 50 100">' +
      '<circle cx="25" cy="7" r="4" fill="#8a5d45"/><path d="M15 13 Q25 10 35 13 L37 34 L13 34Z" fill="{{top}}"/>' +
      '<path d="M14 32 L36 32 L42 92 L27 92 L25 56 L23 92 L8 92Z" fill="{{bottom}}"/>' +
      '<path d="M25 33 l8 5 l-4 12 l-4 -5z M25 33 l-8 5 l3 11z" fill="{{pocket}}"/>' +
      '<ellipse cx="30" cy="94" rx="5" ry="2" fill="{{shoe}}"/></svg>',
    colors: {
      top: { color: '#efe3cf', role: 'card', fit: true },
      bottom: { color: '#a4623d', role: 'accent', fit: true },
      pocket: { color: '#8f532f', role: 'accent', shade: 0.13, like: 'bottom' },
      shoe: { color: '#e6d4be', role: 'panel', fit: true },
    },
  },
  'sample-clog.svg': {
    body:
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="96" viewBox="0 20 100 96">' +
      '<path d="M12 108 Q10 90 26 88 Q36 60 52 62 Q76 62 88 84 Q94 96 86 106 Q60 114 30 112 Q16 112 12 108Z" fill="{{sole}}"/>' +
      '<circle cx="34" cy="95" r="4.2" fill="{{sole2}}"/><g fill="{{sole3}}"><circle cx="58" cy="76" r="2"/><circle cx="66" cy="79" r="2"/><circle cx="73" cy="83" r="2"/><circle cx="62" cy="84" r="2"/></g>' +
      '<rect x="40" y="46" width="14" height="46" rx="6" fill="{{leg}}" transform="rotate(-6 47 70)"/>' +
      '<rect x="38" y="30" width="20" height="26" rx="8" fill="{{top}}"/><circle cx="46" cy="24" r="5.5" fill="#c99a7a"/>' +
      '<ellipse cx="44" cy="108" rx="8" ry="3" fill="{{sole}}"/></svg>',
    colors: {
      sole: { color: '#e8dfcf', role: 'accent', fit: true },
      sole2: { color: '#d9cfbd', role: 'accent', shade: 0.08, like: 'sole' },
      sole3: { color: '#cfc4b0', role: 'accent', shade: 0.16, like: 'sole' },
      leg: { color: '#f1e9da', role: 'card', fit: true },
      top: { color: '#f3ecdd', role: 'card', fit: true },
    },
  },
  'sample-detail.svg': {
    body:
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="135" viewBox="0 0 200 135">' +
      '<defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{{from}}"/><stop offset="1" stop-color="{{to}}"/></linearGradient></defs>' +
      '<rect width="200" height="135" fill="url(#f)"/><g stroke="{{line}}" stroke-opacity=".5" stroke-width="3"><path d="M40 0v135M80 0v135M120 0v135M160 0v135"/></g>' +
      '<path d="M110 30 q40 -18 70 0 q-30 8 -40 30 q-4 -20 -30 -30z" fill="{{fold}}"/></svg>',
    colors: {
      from: { color: '#9c5a36', role: 'accent', shade: 0.05 },
      to: { color: '#b8754a', role: 'accent', shade: -0.1 },
      line: { color: '#7d4525', role: 'accent', shade: 0.3 },
      fold: { color: '#8f532f', role: 'accent', shade: 0.16 },
    },
  },
};

export const isSample = (name: string): boolean => name in SAMPLES;

const shaded = (base: string, shade: number | undefined): string =>
  shade ? mix(base, shade > 0 ? '#000000' : '#ffffff', Math.abs(shade)) : base;

/**
 * A sample as an SVG image URL. With no roles it keeps its own colors. Slots marked `fit` are moved
 * off the backdrop colors when they would blend in, and slots shaded `like` another follow it.
 */
export function sampleUrl(
  name: string,
  roles?: ICRoles,
  backdrop: string[] = [],
  min = 1.6,
): string {
  const sample = SAMPLES[name];
  if (!sample) return '';
  const base: Record<string, string> = {};
  const final: Record<string, string> = {};
  for (const [key, c] of Object.entries(sample.colors)) {
    if (c.like) continue;
    base[key] = roles && c.role ? shaded(roles[c.role], c.shade) : c.color;
    final[key] = c.fit && backdrop.length > 0 ? legible(base[key], backdrop, min) : base[key];
  }
  for (const [key, c] of Object.entries(sample.colors)) {
    if (!c.like) continue;
    const moved = final[c.like] !== base[c.like];
    if (moved) final[key] = shaded(final[c.like], c.shade);
    else final[key] = roles && c.role ? shaded(roles[c.role], c.shade) : c.color;
  }
  const svg = sample.body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => final[key] ?? '#888888');
  return svgUrl(svg);
}
