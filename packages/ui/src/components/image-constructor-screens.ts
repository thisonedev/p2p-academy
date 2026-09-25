// Devices that show a screenshot: laptops, browser windows and phones, straight or at an angle.
// Each is one art layer drawn around the layer's own screenshot, so an angled device skews as a
// whole and exports as vectors with the picture inside.

import type { ICArtDef } from './image-constructor-art.js';
import { SCREENSHOT } from './image-constructor-device.js';

/** The picture a device shows, with its width over height. */
export interface ICShot {
  url: string;
  ratio: number;
}

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** Stand-in for a wide screenshot, such as a web app or a terminal. */
export const WIDE_SHOT = svgUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">' +
    '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262a33"/><stop offset="1" stop-color="#15171c"/></linearGradient></defs>' +
    '<rect width="1600" height="1000" fill="url(#s)"/>' +
    '<g transform="translate(740 380)" fill="none" stroke="#8b90a0" stroke-width="8" stroke-linejoin="round"><rect width="120" height="96" rx="14"/><circle cx="38" cy="32" r="12"/><path d="M12 86l32-32 20 20 18-18 30 30"/></g>' +
    '<text x="800" y="560" text-anchor="middle" font-family="system-ui, sans-serif" font-size="40" font-weight="600" fill="#c3c7d1">Your screenshot</text>' +
    '<text x="800" y="612" text-anchor="middle" font-family="system-ui, sans-serif" font-size="30" fill="#8b90a0">Replace this image</text></svg>',
);

const WIDE: ICShot = { url: WIDE_SHOT, ratio: 1.6 };
const TALL: ICShot = { url: SCREENSHOT, ratio: 390 / 866 };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** The screenshot filling a box from the top, clipped to rounded corners. */
function picture(id: string, shot: ICShot, x: number, y: number, w: number, h: number, r: number) {
  return (
    `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#101114"/>` +
    `<image href="${esc(shot.url)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMin slice" clip-path="url(#${id})"/>`
  );
}

/** A soft shadow under a shape, for devices that float. */
const shadow = (id: string, d: string) =>
  `<filter id="${id}" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="18"/></filter>` +
  `<path d="${d}" fill="#000" opacity=".45" filter="url(#${id})" transform="translate(0 26)"/>`;

/** A browser window 900 by 580: title bar, three dots, address bar and the screenshot. */
function windowBody(id: string, shot: ICShot, w = 900, h = 580) {
  const bar = 44;
  return (
    `<rect width="${w}" height="${h}" rx="14" fill="#1b1d22" stroke="#343842" stroke-width="2"/>` +
    ['#ff5f57', '#febc2e', '#28c840']
      .map((c, i) => `<circle cx="${28 + i * 22}" cy="${bar / 2}" r="7" fill="${c}"/>`)
      .join('') +
    `<rect x="${w * 0.28}" y="11" width="${w * 0.44}" height="22" rx="11" fill="#2a2d34"/>` +
    picture(`${id}-p`, shot, 6, bar, w - 12, h - bar - 6, 10)
  );
}

/** A laptop 1000 wide: lid with the screenshot, then the base. */
function laptopBody(id: string, shot: ICShot) {
  return (
    '<rect x="70" y="10" width="860" height="556" rx="22" fill="#0c0d10" stroke="#3b3f47" stroke-width="3"/>' +
    '<circle cx="500" cy="24" r="4" fill="#2a2d33"/>' +
    picture(`${id}-p`, shot, 95, 38, 810, 506, 6) +
    '<path d="M0 566H1000L978 604Q972 618 950 618H50Q28 618 22 604Z" fill="#2b2e34"/>' +
    '<rect x="0" y="564" width="1000" height="8" rx="3" fill="#41454d"/>' +
    '<rect x="440" y="572" width="120" height="8" rx="4" fill="#1d1f23"/>'
  );
}

/** A phone 420 by 860 with the screenshot on its screen. */
function phoneBody(id: string, shot: ICShot) {
  return (
    '<rect width="420" height="860" rx="62" fill="#0c0d10" stroke="#454a53" stroke-width="4"/>' +
    picture(`${id}-p`, shot, 16, 16, 388, 828, 48) +
    '<rect x="160" y="30" width="100" height="28" rx="14" fill="#0c0d10"/>'
  );
}

interface Kind {
  id: string;
  name: string;
  wide: boolean;
  /** The drawing's size, and its body given an id prefix and the screenshot. */
  size: [number, number];
  draw: (id: string, shot: ICShot) => string;
}

/** A body drawn through an affine matrix, with its outline's shadow drawn the same way. */
const turned = (m: string, outline: string, body: string, id: string) =>
  `<g transform="matrix(${m})">${shadow(`${id}-s`, outline)}${body}</g>`;

const WINDOW_EDGE = 'M14 0H886Q900 0 900 14V566Q900 580 886 580H14Q0 580 0 566V14Q0 0 14 0Z';
const LAPTOP_EDGE =
  'M92 10H908Q930 10 930 32V566H1000L978 604Q972 618 950 618H50Q28 618 22 604L0 566H70V32Q70 10 92 10Z';
const PHONE_EDGE = 'M62 0H358Q420 0 420 62V798Q420 860 358 860H62Q0 860 0 798V62Q0 0 62 0Z';

const KINDS: Kind[] = [
  {
    id: 'screen-laptop',
    name: 'Laptop',
    wide: true,
    size: [1000, 660],
    draw: (id, shot) => `${shadow(`${id}-s`, LAPTOP_EDGE)}${laptopBody(id, shot)}`,
  },
  {
    id: 'screen-laptop-left',
    name: 'Laptop, turned left',
    wide: true,
    size: [1000, 800],
    draw: (id, shot) => turned('0.92 -0.14 0 1 40 150', LAPTOP_EDGE, laptopBody(id, shot), id),
  },
  {
    id: 'screen-laptop-right',
    name: 'Laptop, turned right',
    wide: true,
    size: [1000, 800],
    draw: (id, shot) => turned('0.92 0.14 0 1 40 10', LAPTOP_EDGE, laptopBody(id, shot), id),
  },
  {
    id: 'screen-window-left',
    name: 'Window, turned left',
    wide: true,
    size: [930, 760],
    draw: (id, shot) => turned('0.94 -0.12 0 1 40 130', WINDOW_EDGE, windowBody(id, shot), id),
  },
  {
    id: 'screen-window-right',
    name: 'Window, turned right',
    wide: true,
    size: [930, 760],
    draw: (id, shot) => turned('0.94 0.12 0 1 40 22', WINDOW_EDGE, windowBody(id, shot), id),
  },
  {
    id: 'screen-window-flat',
    name: 'Window, lying flat',
    wide: true,
    size: [1320, 830],
    // Isometric: the window lies on a table, seen from above and to the side.
    draw: (id, shot) =>
      turned('0.866 0.5 -0.866 0.5 520 20', WINDOW_EDGE, windowBody(id, shot, 900, 580), id),
  },
  {
    id: 'screen-window-stack',
    name: 'Window stack',
    wide: true,
    size: [1040, 700],
    draw: (id, shot) =>
      [
        [140, 0, 0.4],
        [70, 60, 0.7],
        [0, 120, 1],
      ]
        .map(
          ([x, y, op], i) =>
            `<g transform="translate(${x} ${y})" opacity="${op}">${i === 2 ? shadow(`${id}-s`, WINDOW_EDGE) : ''}${windowBody(`${id}-${i}`, shot)}</g>`,
        )
        .join(''),
  },
  {
    id: 'screen-phone',
    name: 'Phone',
    wide: false,
    size: [460, 920],
    draw: (id, shot) =>
      `<g transform="translate(20 10)">${shadow(`${id}-s`, PHONE_EDGE)}${phoneBody(id, shot)}</g>`,
  },
  {
    id: 'screen-phone-flat',
    name: 'Phone, lying flat',
    wide: false,
    size: [980, 620],
    // Isometric: the phone lies on a table, its top pointing back and to the right.
    draw: (id, shot) => turned('0.693 -0.4 0.693 0.4 40 200', PHONE_EDGE, phoneBody(id, shot), id),
  },
  {
    id: 'screen-phone-left',
    name: 'Phone, turned left',
    wide: false,
    size: [470, 960],
    draw: (id, shot) => turned('0.95 -0.1 0 1 20 60', PHONE_EDGE, phoneBody(id, shot), id),
  },
  {
    id: 'screen-phone-right',
    name: 'Phone, turned right',
    wide: false,
    size: [470, 960],
    draw: (id, shot) => turned('0.95 0.1 0 1 20 18', PHONE_EDGE, phoneBody(id, shot), id),
  },
];

export const isScreen = (id: string) => KINDS.some((k) => k.id === id);

/** The picture a device starts with: a wide or a tall stand-in. */
export const defaultShot = (id: string): ICShot =>
  KINDS.find((k) => k.id === id)?.wide === false ? TALL : WIDE;

/** The device drawn around its screenshot. Ids inside are made from the picture, so two devices
 *  with different pictures in one exported SVG don't share clip paths or shadows. */
export function screenDef(id: string, shot: ICShot): ICArtDef | undefined {
  const kind = KINDS.find((k) => k.id === id);
  if (!kind) return undefined;
  let hash = 0;
  for (let i = 0; i < shot.url.length; i += 97) hash = (hash * 31 + shot.url.charCodeAt(i)) | 0;
  const key = `${id}-${(hash >>> 0).toString(36)}`;
  const [w, h] = kind.size;
  return {
    id,
    name: kind.name,
    kind: 'shape',
    group: 'Devices',
    ratio: w / h,
    viewBox: `0 0 ${w} ${h}`,
    body: kind.draw(key, shot),
    slots: [],
  };
}

/** Every device with its stand-in picture, for the Elements tab. */
export const SCREENS: ICArtDef[] = KINDS.map((k) => screenDef(k.id, defaultShot(k.id)) as ICArtDef);
