'use client';

import { Shuffle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ICON } from '../panels/controls.js';
import { press } from './video.js';
import { Dropdown } from '../../ui/dropdown.js';

// Small previews of the video's little things: a Build-up's ending, the pointer, its click
// and the Status word's mark. They show what a name in a list looks like before it is picked.

type G = CanvasRenderingContext2D;
type Paint = (g: G, t: number) => void;

const HOT = '#8fbf8a';
const ON = '#0e1710';
const INK = '238,241,240';
/** A preview is drawn in a box this wide around `C`, and loops every `LOOP` seconds. */
const BOX = 44;
const C = BOX / 2;
const LOOP = 1.8;
/** When the pointer in a preview clicks. */
const TAP = 0.9;

const cl = (x: number) => Math.max(0, Math.min(1, x));
const seg = (t: number, a: number, b: number) => cl((t - a) / (b - a));
const ease = (x: number) => 1 - (1 - cl(x)) ** 3;
const pop = (x: number) => {
  const p = cl(x) - 1;
  return 1 + 2.4 * p * p * p + 1.4 * p * p;
};

function arrow(g: G, x: number, y: number, s: number, fill: string, edge: string): void {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 19);
  g.lineTo(5, 14.5);
  g.lineTo(8.6, 22.5);
  g.lineTo(11.6, 21.2);
  g.lineTo(8.1, 13.4);
  g.lineTo(14.6, 13.4);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 1.3;
  g.lineJoin = 'round';
  g.strokeStyle = edge;
  g.stroke();
  g.restore();
}

function wedge(g: G, x: number, y: number, s: number, fill: string, edge: string): void {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(3.2, 19.5);
  g.lineTo(8.4, 12.6);
  g.lineTo(16.8, 10.4);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 2.2;
  g.lineJoin = 'round';
  g.strokeStyle = edge;
  g.stroke();
  g.restore();
}

const HAND = [
  'M22 14a8 8 0 0 1-8 8',
  'M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2',
  'M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1',
  'M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10',
  'M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
];
let handLines: Path2D[] | null = null;

function hand(g: G, x: number, y: number, s: number, alpha = 1): void {
  handLines ??= HAND.map((d) => new Path2D(d));
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x - 8 * s, y - 2 * s);
  g.scale(s, s);
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(6, 2, 4, 14, 2);
  g.roundRect(10, 7, 4, 9, 2);
  g.roundRect(14, 8, 4, 8, 2);
  g.roundRect(18, 9, 4, 8, 2);
  g.moveTo(6, 12);
  g.lineTo(22, 12);
  g.lineTo(22, 14);
  g.bezierCurveTo(22, 18.4, 18.4, 22, 14, 22);
  g.lineTo(12, 22);
  g.bezierCurveTo(9.2, 22, 7.5, 21.1, 6, 19.7);
  g.lineTo(2.4, 16.1);
  g.lineTo(3.2, 13.6);
  g.lineTo(5.2, 13.3);
  g.lineTo(7, 15);
  g.closePath();
  g.fill();
  g.strokeStyle = '#0b0b0d';
  g.lineWidth = 1.5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const line of handLines) g.stroke(line);
  g.restore();
}

function disc(g: G, t: number, r = 11): void {
  g.fillStyle = HOT;
  g.beginPath();
  g.arc(C, C, r * pop(seg(t, 0.15, 0.4)), 0, 7);
  g.fill();
}

function ring(g: G, x: number, y: number, p: number, reach: number, color: string): void {
  if (p <= 0 || p >= 1) return;
  g.strokeStyle = color;
  g.globalAlpha = 1 - p;
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(x, y, 3 + ease(p) * reach, 0, 7);
  g.stroke();
  g.globalAlpha = 1;
}

const dip = (t: number) => 1 - 0.14 * press(t - TAP);

const PAINT = {
  ending: {
    tick(g, t) {
      disc(g, t);
      const p = seg(t, 0.3, 0.6);
      if (p <= 0) return;
      g.strokeStyle = ON;
      g.lineWidth = 2.4;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(C - 5, C + 0.5);
      const q = Math.min(1, p * 2.2);
      g.lineTo(C - 5 + 3.4 * q, C + 0.5 + 3.4 * q);
      if (p > 0.45) {
        const k = (p - 0.45) / 0.55;
        g.lineTo(C - 1.6 + 6.8 * k, C + 3.9 - 7.5 * k);
      }
      g.stroke();
    },
    ring(g, t) {
      if (t < 0.6) {
        g.lineWidth = 1.6;
        g.strokeStyle = `rgba(${INK},0.16)`;
        g.beginPath();
        g.arc(C, C, 11, 0, 7);
        g.stroke();
        g.strokeStyle = HOT;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(C, C, 11, -Math.PI / 2, -Math.PI / 2 + ease(seg(t, 0.1, 0.55)) * Math.PI * 2);
        g.stroke();
      }
      const filled = ease(seg(t, 0.55, 0.8));
      if (filled <= 0) return;
      g.fillStyle = HOT;
      g.beginPath();
      g.arc(C, C, 11 * filled, 0, 7);
      g.fill();
    },
    burst(g, t) {
      disc(g, t, 9);
      const p = seg(t, 0.3, 0.9);
      if (p <= 0 || p >= 1) return;
      g.strokeStyle = HOT;
      g.lineWidth = 1.6;
      g.lineCap = 'round';
      g.globalAlpha = 1 - p;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.3;
        const from = 12 + ease(p) * 4;
        const to = from + 3.5 * (1 - p);
        g.beginPath();
        g.moveTo(C + Math.cos(a) * from, C + Math.sin(a) * from);
        g.lineTo(C + Math.cos(a) * to, C + Math.sin(a) * to);
        g.stroke();
      }
      g.globalAlpha = 1;
    },
    ripple(g, t) {
      disc(g, t, 8);
      ring(g, C, C, seg(t, 0.35, 1.15), 16, HOT);
      ring(g, C, C, seg(t, 0.55, 1.35), 16, HOT);
    },
  },
  pointer: {
    arrow: (g, t) => arrow(g, 15, 11, 0.95 * dip(t), '#fff', '#0b0b0d'),
    dark: (g, t) => arrow(g, 15, 11, 0.95 * dip(t), '#0b0b0d', '#fff'),
    wedge: (g, t) => wedge(g, 14, 12, dip(t), '#fff', '#0b0b0d'),
    tag(g) {
      wedge(g, 8, 8, 0.85, HOT, ON);
      // The name is too small to read here, so the tag shows as a bar.
      g.fillStyle = HOT;
      g.beginPath();
      g.roundRect(17, 24, 21, 9, 3);
      g.fill();
      g.fillStyle = ON;
      g.fillRect(20, 27.5, 15, 2);
    },
    dot(g, t) {
      const down = press(t - TAP);
      g.fillStyle = `rgba(255,255,255,${0.32 + 0.25 * down})`;
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(C, C, 9 * (1 - 0.2 * down), 0, 7);
      g.fill();
      g.stroke();
    },
    ring(g, t) {
      const down = press(t - TAP);
      g.strokeStyle = HOT;
      g.lineWidth = 1.8;
      g.beginPath();
      g.arc(C, C, 9 * (1 - 0.15 * down), 0, 7);
      g.stroke();
      if (down <= 0) return;
      g.fillStyle = `rgba(143,191,138,${0.6 * down})`;
      g.fill();
    },
    hand: (g, t) => hand(g, 18, 10, 1.05 * (1 - 0.12 * press(t - TAP))),
    turn(g, t) {
      const over = seg(t, 0.45, 0.65) * (1 - seg(t, 1.5, 1.7));
      if (over < 1) {
        g.save();
        g.globalAlpha = 1 - over;
        arrow(g, 15, 11, 0.95, '#fff', '#0b0b0d');
        g.restore();
      }
      if (over > 0) hand(g, 18, 10, 1.05, over);
    },
  },
  click: {
    dip: (g, t) => arrow(g, 17, 13, 0.9 * (1 - 0.22 * press(t - TAP)), '#fff', '#0b0b0d'),
    ripple(g, t) {
      ring(g, 17, 13, seg(t, TAP, TAP + 0.5), 14, '#ffffff');
      arrow(g, 17, 13, 0.9 * dip(t), '#fff', '#0b0b0d');
    },
    ripples(g, t) {
      ring(g, 17, 13, seg(t, TAP, TAP + 0.55), 15, HOT);
      ring(g, 17, 13, seg(t, TAP + 0.14, TAP + 0.69), 15, HOT);
      arrow(g, 17, 13, 0.9 * dip(t), '#fff', '#0b0b0d');
    },
    spot(g, t) {
      const p = seg(t, TAP, TAP + 0.45);
      if (p > 0 && p < 1) {
        g.fillStyle = `rgba(143,191,138,${0.75 * (1 - p)})`;
        g.beginPath();
        g.arc(17, 13, 10 * Math.sin((Math.PI / 2) * Math.min(1, p * 1.4)) * (1 - 0.3 * p), 0, 7);
        g.fill();
      }
      arrow(g, 17, 13, 0.9, '#fff', '#0b0b0d');
    },
  },
  mark: {
    dot(g, t) {
      const beat = 0.75 + 0.25 * Math.sin(t * 5);
      g.fillStyle = 'rgba(143,191,138,0.22)';
      g.beginPath();
      g.arc(C, C, 10 * beat, 0, 7);
      g.fill();
      g.fillStyle = HOT;
      g.beginPath();
      g.arc(C, C, 5.8 * beat, 0, 7);
      g.fill();
    },
    dots(g, t) {
      for (let i = 0; i < 3; i++) {
        const up = Math.max(0, Math.sin(t * 6.5 - i * 0.9));
        g.fillStyle = `rgba(143,191,138,${0.45 + 0.55 * up})`;
        g.beginPath();
        g.arc(C + (i - 1) * 8, C - up * 4, 2.6, 0, 7);
        g.fill();
      }
    },
    arc(g, t) {
      g.lineWidth = 2;
      g.strokeStyle = `rgba(${INK},0.16)`;
      g.beginPath();
      g.arc(C, C, 9, 0, 7);
      g.stroke();
      g.strokeStyle = HOT;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(C, C, 9, t * 6, t * 6 + 1.7);
      g.stroke();
    },
  },
} satisfies Record<string, Record<string, Paint>>;

export type PreviewSet = keyof typeof PAINT;

/** The moment of its loop a preview rests on: the one that shows what it is. */
const STILL: Record<PreviewSet, number | Record<string, number>> = {
  ending: { tick: 1, ring: 0.5, burst: 0.5, ripple: 0.8 },
  pointer: { turn: 0.55 },
  click: TAP + 0.18,
  mark: 0.4,
};
const stillAt = (set: PreviewSet, id: string) => {
  const at = STILL[set];
  return typeof at === 'number' ? at : (at[id] ?? 0.3);
};

function draw(canvas: HTMLCanvasElement, paint: Paint, t: number): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  g.setTransform(canvas.width / BOX, 0, 0, canvas.width / BOX, 0, 0);
  g.clearRect(0, 0, BOX, BOX);
  g.lineCap = 'butt';
  g.globalAlpha = 1;
  paint(g, t);
}

// One clock draws every preview that is moving, each from the start of its own loop. With none
// moving the clock stops, so a panel at rest costs nothing.
const LIVE = new Map<HTMLCanvasElement, { paint: Paint; from: number }>();
let ticking = 0;
function tick(now: number): void {
  for (const [canvas, { paint, from }] of LIVE) draw(canvas, paint, ((now - from) / 1000) % LOOP);
  ticking = LIVE.size ? requestAnimationFrame(tick) : 0;
}

/** Still until `live`, which is while the pointer is on its row or its list is open. */
function Preview({ set, id, live }: { set: PreviewSet; id: string; live: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const paint = (PAINT[set] as Record<string, Paint>)[id];
    if (!canvas || !paint) return;
    if (!live) {
      draw(canvas, paint, stillAt(set, id));
      return;
    }
    LIVE.set(canvas, { paint, from: performance.now() });
    if (!ticking) ticking = requestAnimationFrame(tick);
    return () => {
      LIVE.delete(canvas);
    };
  }, [set, id, live]);
  return (
    <canvas
      ref={ref}
      width={BOX * 2}
      height={BOX * 2}
      aria-hidden
      className="size-6 shrink-0 rounded bg-canvas"
    />
  );
}

/** A dropdown whose button and every line show a preview, with a shuffle beside it. The button's
 *  preview plays under the pointer, and the list's previews play while the list is open. */
export function PreviewSelect({
  set,
  what,
  value,
  list,
  onPick,
}: {
  set: PreviewSet;
  /** What is being picked, in lower case, for the shuffle's label. */
  what: string;
  value: string;
  list: readonly { id: string; name: string }[];
  onPick: (id: string) => void;
}) {
  const now = list.find((x) => x.id === value) ?? list[0];
  const [over, setOver] = useState(false);
  return (
    <span
      className="flex w-full min-w-0 items-center gap-1.5"
      onPointerEnter={() => setOver(true)}
      onPointerLeave={() => setOver(false)}
    >
      <span className="min-w-0 flex-1">
        <Dropdown
          value={now.name}
          lead={<Preview set={set} id={now.id} live={over} />}
          sections={[
            {
              items: list.map((x) => ({
                id: x.id,
                label: x.name,
                lead: <Preview set={set} id={x.id} live />,
                on: x.id === now.id,
                onPick: () => onPick(x.id),
              })),
            },
          ]}
        />
      </span>
      <button
        type="button"
        title={`Another ${what}`}
        aria-label={`Another ${what}`}
        onClick={() => {
          const rest = list.filter((x) => x.id !== now.id);
          onPick(rest[Math.floor(Math.random() * rest.length)].id);
        }}
        className={ICON}
      >
        <Shuffle className="size-3.5" />
      </button>
    </span>
  );
}
