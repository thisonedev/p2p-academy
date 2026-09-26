// Groups of layers that select and move together, shared by every template pack.

import type { ICElement } from './image-constructor-layout.js';

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
