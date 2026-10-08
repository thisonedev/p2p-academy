import { brandOfKit } from '../templates/announce.js';
import { type ICElement, type ICLayout, type ICTemplate, applyPalette, applyBrandKit } from '../render/layout.js';
import { type ICHandle, type ICRect, SIDES, CORNERS, ALL_HANDLES } from '../render/resize.js';

// The canvas is drawn at a fixed size and scaled by CSS, so dragging works in percentages.
export const DRAW = 1080;

/** Zoom steps, as a share of the size that fits the canvas area. 1 is Fit. */
export const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export const nextZoom = (z: number, dir: 1 | -1) =>
  dir === 1 ? (ZOOMS.find((s) => s > z + 1e-6) ?? z) : ([...ZOOMS].reverse().find((s) => s < z - 1e-6) ?? z);

export type PickTarget = 'add' | 'layer' | 'subject' | 'scene' | 'partner' | 'shot';

export interface DragState {
  id: string;
  mode: 'move' | 'resize' | 'crop' | 'pan' | 'rotate' | 'scale';
  handle?: ICHandle;
  /** The element's box in canvas pixels when the drag began. */
  box: ICRect;
  sx: number;
  sy: number;
  orig: ICElement;
  /** Other selected elements moving together with `id`, their starting x/y in percent. */
  group?: { id: string; x: number; y: number }[];
  /** Scaling a selection of several layers: each one as it was when the drag began. */
  members?: ICElement[];
  /** Rotating: the layer's center on screen and the pointer's angle around it when the drag began. */
  turn?: { cx: number; cy: number; from: number };
}

/** A drag angle as a layer's rotation: within ±180, pulled onto a straight angle when close to one,
 *  and onto 15° steps with Shift held. */
export function snapAngle(deg: number, fine: boolean): number {
  let a = ((((deg + 180) % 360) + 360) % 360) - 180;
  if (fine) a = Math.round(a / 15) * 15;
  else {
    const right = Math.round(a / 90) * 90;
    if (Math.abs(a - right) < 4) a = right;
  }
  const r = Math.round(a * 10) / 10;
  return r === -180 ? 180 : r || 0;
}

/** Every element sharing `id`'s group, or just `id` alone if it isn't grouped. */
export const groupMembers = (els: ICElement[], id: string): string[] => {
  const groupId = els.find((e) => e.id === id)?.groupId;
  return groupId ? els.filter((e) => e.groupId === groupId).map((e) => e.id) : [id];
};

/** A layer grown or shrunk by `k`, with its top-left corner moved to `x`, `y` (percent). */
export function scaleLayer(e: ICElement, k: number, x: number, y: number): ICElement {
  const next = { ...e, x, y } as ICElement;
  if ('w' in next) next.w *= k;
  if ('h' in next && typeof next.h === 'number') next.h *= k;
  if ('size' in next) next.size *= k;
  if ('radius' in next && typeof next.radius === 'number') next.radius *= k;
  if ('sw' in next) next.sw *= k;
  if ('th' in next) next.th *= k;
  return next;
}

/** Photos, art and text scale as a whole. Shapes and cropped photos stretch on each side. */
export const isLocked = (e: ICElement) =>
  e.t === 'subject' ||
  e.t === 'art' ||
  e.t === 'text' ||
  e.t === 'pill' ||
  (e.t === 'image' && e.h === undefined);

export const handlesFor = (e: ICElement): ICHandle[] =>
  e.lock ? [] : e.t === 'line' ? SIDES : isLocked(e) ? CORNERS : ALL_HANDLES;

export const signature = (url: string | undefined) => {
  if (!url) return '';
  // Recolored SVGs keep their length, so small ones are hashed whole. Photos use length and tail.
  if (!url.startsWith('data:image/svg')) return `${url.length}:${url.slice(-24)}`;
  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = (hash * 31 + url.charCodeAt(i)) | 0;
  return `${url.length}:${hash}`;
};

/**
 * A template opened from another design takes that design's look: its palette, or its own UI kit.
 * A draft of the template keeps its words and edits; its old colors are replaced.
 */
export function inLookOf(opened: ICLayout, from: ICLayout, t: ICTemplate): ICLayout {
  if (from.palette) {
    return opened.palette === from.palette ? opened : applyPalette(opened, from.palette);
  }
  if (from.kit && !brandOfKit(from.kit.id)) {
    return opened.kit?.id === from.kit.id && !opened.palette ? opened : applyBrandKit(opened, from.kit);
  }
  // Coming from a built-in brand: a draft left in a palette or a kit of your own goes back to the template's.
  const stale = opened.palette || (opened.kit && !brandOfKit(opened.kit.id));
  return stale && t.kit ? applyBrandKit(opened, t.kit) : opened;
}
