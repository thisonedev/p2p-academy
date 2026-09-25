// Groups of layers that select and move together, shared by every template pack.

import type { ICElement } from './image-constructor-layout.js';

let groups = 0;

/** Marks a piece's layers as one group, so they select and move together. */
export const grouped = (els: ICElement[]): ICElement[] => {
  const groupId = `part-${++groups}`;
  return els.map((e) => ({ ...e, groupId }));
};

/** Draws a row for each item, each row's layers grouped, such as a card with its icon and text. */
export const rows = <T>(items: T[], draw: (item: T, i: number) => ICElement[]): ICElement[] =>
  items.flatMap((item, i) => grouped(draw(item, i)));
