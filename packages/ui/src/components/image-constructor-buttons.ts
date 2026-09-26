// The looks a badge or button layer can take. Each draws from palette roles, so it recolors with
// the design, and the renderers add the marks a look has (brackets, a dot, an arrow, a cap).

import type { ICRole } from './image-constructor-palettes.js';

export const BUTTON_LOOKS = [
  ['outline', 'Outline'],
  ['solid', 'Solid'],
  ['soft', 'Soft pill'],
  ['bracket', 'Brackets'],
  ['dot', 'Status dot'],
  ['offset', 'Offset shadow'],
  ['link', 'Link'],
  ['tag', 'Icon tag'],
] as const;

export type ButtonLook = (typeof BUTTON_LOOKS)[number][0];

/** The roles a look fills, outlines and writes with. A dot look's stroke colors the dot itself. */
export const LOOK_ROLES: Record<ButtonLook, { fill?: ICRole; stroke?: ICRole; color: ICRole }> = {
  outline: { stroke: 'accent', color: 'accent' },
  solid: { fill: 'accent', color: 'onAccent' },
  soft: { fill: 'accent', color: 'accent' },
  bracket: { color: 'accent' },
  dot: { fill: 'ink', stroke: 'accent', color: 'ink' },
  offset: { fill: 'accent', color: 'onAccent' },
  link: { color: 'accent' },
  tag: { fill: 'accent', color: 'onAccent' },
};

/** Room each side of the words, in text sizes: padding plus whatever mark sits there. */
export function lookPad(look: ButtonLook | undefined): { left: number; right: number } {
  switch (look) {
    case 'bracket':
      return { left: 0, right: 0 };
    case 'dot':
      return { left: 2.1, right: 1 };
    case 'link':
      return { left: 0, right: 1.5 };
    case 'tag':
      return { left: 2.6, right: 1 };
    default:
      return { left: 1, right: 1 };
  }
}

/** The words as drawn: brackets are part of the text so they measure and fit with it. */
export const lookText = (e: { text: string; look?: ButtonLook }) =>
  e.look === 'bracket' ? `[ ${e.text} ]` : e.text;

/** The next look along, for Shuffle. */
export function nextLook(look: ButtonLook | undefined): ButtonLook {
  const i = BUTTON_LOOKS.findIndex(([id]) => id === look);
  return BUTTON_LOOKS[(i + 1) % BUTTON_LOOKS.length][0];
}
