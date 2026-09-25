import type { ICLayout } from './image-constructor-layout.js';
import { composeLayout } from './image-constructor-render.js';
import { applySlots, cleanSlotName, type ICSlot } from './image-constructor-slots.js';
import { dataUrlToBytes } from './playground-files.js';
import type { PlaygroundTable } from './playground-table.js';

/** A run past this many rows stops there, so a stray large sheet can't render for hours. */
export const MAX_BULK_ROWS = 200;
/** How many results the output feed shows; the zip always holds every image. */
export const BULK_PREVIEWS = 8;

/** Which table column fills each slot: a column matches when its header equals the slot name after the same cleanup. */
export function slotColumns(slots: ICSlot[], headers: string[]): Map<string, number> {
  const byName = new Map(headers.map((h, i) => [cleanSlotName(h), i]));
  const out = new Map<string, number>();
  for (const slot of slots) {
    const col = byName.get(slot.name);
    if (col !== undefined) out.set(slot.name, col);
  }
  return out;
}

/** One image per row. A row's own column value wins over a value wired into the slot's port. */
export async function renderRows(
  layout: ICLayout,
  sceneUrl: string | null,
  table: PlaygroundTable,
  columns: Map<string, number>,
  wired: Record<string, string>,
  shouldStop: () => boolean,
  onRow: (index: number, dataUrl: string) => void,
): Promise<string[]> {
  const urls: string[] = [];
  for (const [i, row] of table.rows.slice(0, MAX_BULK_ROWS).entries()) {
    if (shouldStop()) break;
    const values = { ...wired };
    for (const [slot, col] of columns) values[slot] = row[col] ?? '';
    const url = await composeLayout(await applySlots(layout, values), sceneUrl);
    urls.push(url);
    onRow(i, url);
  }
  return urls;
}

export async function zipImages(urls: string[]): Promise<string> {
  const { zipSync } = await import('fflate');
  const width = String(urls.length).length;
  const files = Object.fromEntries(
    urls.map((url, i) => [`design-${String(i + 1).padStart(width, '0')}.png`, dataUrlToBytes(url)]),
  );
  const bytes = zipSync(files, { level: 0 });
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:application/zip;base64,${btoa(binary)}`;
}
