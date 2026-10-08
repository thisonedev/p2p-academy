// Groups of layers that select and move together, shared by every template pack.

import type { ICElement } from '../render/layout.js';

let groups = 0;

/** Marks a piece's layers as one group, so they select and move together. */
export const grouped = (els: ICElement[]): ICElement[] => {
  const groupId = `part-${++groups}`;
  return els.map((e) => ({ ...e, groupId }));
};

/** Draws a row for each item, such as a card with its icon and text. The rows form one group, so
 *  a list moves as a whole until it is ungrouped. */
export const rows = <T>(items: T[], draw: (item: T, i: number) => ICElement[]): ICElement[] =>
  grouped(items.flatMap((item, i) => draw(item, i)));

/** Names each unnamed layer after the first labelled words in its group, so a row or column keeps
 *  its layer ids in every size, however many rows or columns that size draws. */
export function nameParts(els: ICElement[]): ICElement[] {
  const label = new Map<string, string>();
  for (const e of els)
    if (e.groupId && !label.has(e.groupId) && e.t === 'text' && e.role) label.set(e.groupId, e.role);
  return els.map((e) =>
    e.slot || e.part || !e.groupId || !label.has(e.groupId) ? e : { ...e, part: `${label.get(e.groupId)}_${e.t}` },
  );
}
