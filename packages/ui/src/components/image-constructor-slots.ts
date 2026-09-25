import { chartCsv, isChart, parseChartData, sampleData } from './image-constructor-charts.js';
import { shrinkToFit } from './image-constructor-fit.js';
import {
  type ICElement,
  type ICLayout,
  type ICPill,
  type ICText,
  refit,
} from './image-constructor-layout.js';

/** New words for a text slot: kept as typed when they have line breaks, otherwise split into
 *  the lines the box was drawn for, then shrunk if they run wider than the box. */
function withWords<T extends ICText | ICPill>(el: T, value: string): T {
  const text = el.t === 'pill' || value.includes('\n') ? value : refit(value, el.text);
  return shrinkToFit({ ...el, text });
}

/** A named placeholder in a design that a workflow can fill: a text layer's words, a photo's
 *  image, a shape's fill color, or a chart's data as CSV or JSON. The design keeps its own value
 *  as the default. */
export type ICSlotType = 'text' | 'image' | 'color' | 'data';

export interface ICSlot {
  name: string;
  type: ICSlotType;
  /** The layer's current value, used whenever nothing is wired in. */
  value: string;
}

export const SLOT_HANDLE_PREFIX = 'slot:';
export const slotHandle = (name: string) => `${SLOT_HANDLE_PREFIX}${name}`;
export const slotFromHandle = (handle: string | null | undefined): string | null =>
  handle?.startsWith(SLOT_HANDLE_PREFIX) ? handle.slice(SLOT_HANDLE_PREFIX.length) : null;

const SLOT_NAME = /^[a-z][a-z0-9_]{0,31}$/;

/** Lowercase, underscores for spaces, and nothing a port id or a spreadsheet column would trip on. */
export function cleanSlotName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 32);
}

export const isSlotName = (name: string) => SLOT_NAME.test(name);

export function slotTypeOf(el: ICElement): ICSlotType | null {
  if (el.t === 'text' || el.t === 'pill') return 'text';
  if (el.t === 'image' || el.t === 'subject') return 'image';
  if (el.t === 'shape') return 'color';
  if (el.t === 'art' && isChart(el.art)) return 'data';
  return null;
}

function valueOf(el: ICElement, layout: ICLayout): string {
  if (el.t === 'text' || el.t === 'pill') return el.text;
  if (el.t === 'image') return el.url;
  if (el.t === 'subject') return layout.subject.url;
  if (el.t === 'shape') return el.fill;
  if (el.t === 'art' && isChart(el.art)) return chartCsv(el.data ?? sampleData(el.art));
  return '';
}

/** One entry per name, in layer order. Layers sharing a name all take the same value. */
export function listSlots(layout: ICLayout): ICSlot[] {
  const seen = new Map<string, ICSlot>();
  for (const el of layout.els) {
    const type = slotTypeOf(el);
    if (!el.slot || !type || seen.has(el.slot)) continue;
    seen.set(el.slot, { name: el.slot, type, value: valueOf(el, layout) });
  }
  return [...seen.values()];
}

function imageRatio(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalHeight ? img.naturalWidth / img.naturalHeight : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** A copy of `layout` with each named slot's layers set to its value. The saved design is never touched. */
export async function applySlots(
  layout: ICLayout,
  values: Record<string, string>,
): Promise<ICLayout> {
  if (Object.keys(values).length === 0) return layout;
  let subject = layout.subject;
  const ratios = new Map<string, number | null>();
  for (const el of layout.els) {
    const v = el.slot ? values[el.slot] : undefined;
    if (v !== undefined && slotTypeOf(el) === 'image' && !ratios.has(v))
      ratios.set(v, await imageRatio(v));
  }
  const els = layout.els.map((el): ICElement => {
    const v = el.slot ? values[el.slot] : undefined;
    if (v === undefined) return el;
    if (el.t === 'text' || el.t === 'pill') return withWords(el, v);
    if (el.t === 'shape') return { ...el, fill: v };
    if (el.t === 'art' && isChart(el.art)) {
      const data = parseChartData(v);
      return data ? { ...el, data } : el;
    }
    if (el.t === 'image') {
      const ratio = ratios.get(v);
      return {
        ...el,
        url: v,
        original: undefined,
        cut: undefined,
        crop: undefined,
        ...(ratio ? { ratio } : {}),
      };
    }
    if (el.t === 'subject') {
      subject = { name: el.slot ?? 'slot', url: v, ratio: ratios.get(v) ?? subject.ratio };
      return { ...el, crop: undefined };
    }
    return el;
  });
  return { ...layout, subject, els };
}

/** Writes a default straight into the design, so the studio and the node's popup show the same value.
 *  An image passes its own width over height, so the layer keeps the new picture's proportions. */
export function setSlotDefault(
  layout: ICLayout,
  name: string,
  value: string,
  ratio?: number,
): ICLayout {
  let subject = layout.subject;
  const els = layout.els.map((el): ICElement => {
    if (el.slot !== name) return el;
    if (el.t === 'text' || el.t === 'pill') return withWords(el, value);
    if (el.t === 'shape') return { ...el, fill: value };
    if (el.t === 'art' && isChart(el.art)) {
      const data = parseChartData(value);
      return data ? { ...el, data } : el;
    }
    if (el.t === 'image') {
      return {
        ...el,
        url: value,
        original: undefined,
        cut: undefined,
        crop: undefined,
        ...(ratio ? { ratio } : {}),
      };
    }
    if (el.t === 'subject') subject = { name, url: value, ratio: ratio ?? subject.ratio };
    return el;
  });
  return { ...layout, subject, els };
}
