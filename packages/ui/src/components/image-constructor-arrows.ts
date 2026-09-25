// Hand-drawn arrows and marks for pointing at part of a card: one stroke color that follows the ink.

import type { ICArtDef } from './image-constructor-art.js';

const stroke = (width: number, d: string) =>
  `<g fill="none" stroke="{{main}}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>`;

const arrow = (
  id: string,
  name: string,
  w: number,
  h: number,
  width: number,
  d: string,
): ICArtDef => ({
  id,
  name,
  kind: 'shape',
  group: 'Arrows',
  ratio: w / h,
  viewBox: `0 0 ${w} ${h}`,
  body: stroke(width, d),
  slots: [{ key: 'main', label: 'Color', role: 'ink', color: '#ffffff' }],
});

export const ARROWS: ICArtDef[] = [
  arrow('arrow-curve', 'Curved arrow', 140, 100, 5, 'M10 90C40 90 90 70 118 22M100 27l18-5 3 18'),
  arrow(
    'arrow-hook',
    'Hook arrow',
    100,
    140,
    5,
    'M8 128C70 130 95 90 90 60 85 30 55 15 16 16M30 5 16 16l13 12',
  ),
  arrow(
    'arrow-loop',
    'Loop arrow',
    160,
    90,
    5,
    'M8 70c32 2 52-10 62-30 8-20-10-30-18-14-8 18 28 34 58 26 18-5 30-14 40-26m-16 0h16l-2 16',
  ),
  arrow('arrow-down', 'Down arrow', 80, 120, 5, 'M20 8c35 12 45 52 25 100M34 93l11 15 15-11'),
  arrow('arrow-straight', 'Straight arrow', 140, 30, 5, 'M8 15h120M114 4l16 11-16 11'),
  arrow(
    'scribble-circle',
    'Circle mark',
    160,
    90,
    4,
    'M20 45C20 15 140 8 148 40c7 32-108 48-130 18-8-13 22-38 72-40',
  ),
  arrow(
    'scribble-underline',
    'Underline mark',
    160,
    30,
    4.5,
    'M6 18C50 8 110 6 154 12M24 25c36-6 80-8 116-4',
  ),
];
