// A phone drawing with a screenshot slot lined up behind its screen, shared by every template pack.

import type { LayerBuilder } from './image-constructor-announce.js';
import { PHONE_SCREEN } from './image-constructor-art-web3.js';
import { grouped } from './image-constructor-groups.js';

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** Stand-in for a phone screenshot: replace it with a real one and it fills the screen. */
export const SCREENSHOT = svgUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" width="390" height="866" viewBox="0 0 390 866">' +
    '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262a33"/><stop offset="1" stop-color="#15171c"/></linearGradient></defs>' +
    '<rect width="390" height="866" fill="url(#s)"/>' +
    '<g transform="translate(155 360)" fill="none" stroke="#8b90a0" stroke-width="5" stroke-linejoin="round"><rect width="80" height="64" rx="10"/><circle cx="26" cy="22" r="8"/><path d="M8 58l22-22 14 14 12-12 20 20"/></g>' +
    '<text x="195" y="480" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" font-weight="600" fill="#c3c7d1">Your screenshot</text>' +
    '<text x="195" y="514" text-anchor="middle" font-family="system-ui, sans-serif" font-size="19" fill="#8b90a0">Replace this image</text></svg>',
);

/** A device drawing `aw` wide at `x`, `y`, with the screenshot slot lined up in its screen. Its
 *  layers are grouped so they move as one. */
export function device(b: LayerBuilder, art: 'phone', x: number, y: number, aw: number) {
  const s = PHONE_SCREEN[art];
  const k = aw / s.vw;
  const screen = {
    ...b.logo('screenshot', x + s.x * k, y + s.y * k, s.w * k, s.h * k, SCREENSHOT, 390 / 866),
    fit: 'top' as const,
    radius: s.r * k,
  };
  // The screenshot sits on top of the frame, so a click or a dropped image reaches it; the notch
  // is drawn again above it.
  const notch = b.rect(x + 38 * k, y + 12 * k, 24 * k, 6.5 * k, '', {
    fill: '#0b0c0f',
    radius: 3.25 * k,
    pal: {},
  });
  return grouped([b.art(art, x, y, aw), screen, notch]);
}
