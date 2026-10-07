import { inOut, type Paint, spring } from './design-motion.js';
import type { Cue } from './design-sound.js';

// A video is a list of scenes. A scene kind (hook, features, numbers) can be drawn in several
// ways, its variants. The design gives the look, a feel sets how things move. Any variant works
// with any design and feel, so one set of content can be shown many ways.

export type Media = HTMLCanvasElement | HTMLImageElement | HTMLVideoElement;

export interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
  r: number;
}

/** Every scene is drawn on this stage, whatever size the video is saved at. */
export const W = 1920;
export const H = 1080;
export const MID = { x: W / 2, y: H / 2 };

export const cl = (n: number) => Math.min(1, Math.max(0, n));
export const seg = (t: number, a: number, b: number) => cl((t - a) / (b - a));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const mix = (a: Box, b: Box, p: number): Box => ({
  cx: lerp(a.cx, b.cx, p),
  cy: lerp(a.cy, b.cy, p),
  w: lerp(a.w, b.w, p),
  h: lerp(a.h, b.h, p),
  r: lerp(a.r, b.r, p),
});
export const press = (t: number) => (t <= 0 || t >= 0.24 ? 0 : Math.sin((Math.PI * t) / 0.24));

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (hex: string, a: number) => `rgba(${rgb(hex).join(',')},${a})`;
export function blend(a: string, b: string, p: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x
    .map((v, i) =>
      Math.round(lerp(v, y[i], p))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

// ---------------------------------------------------------------- look

/** A video's colors, all six-digit hex so they can be mixed. */
export interface Tones {
  ground: string;
  ink: string;
  /** Text and marks drawn on an ink shape. */
  onInk: string;
  /** Panels, and a screenshot's window. Under From design it is the kit's own panel color. */
  panel: string;
  /** The fine line around a panel. Under From design it is the kit's card color. */
  edge: string;
  bar: string;
  chip: string;
  chipInk: string;
  /** The one loud color: accent words, progress, the flood between scenes. */
  hot: string;
  onHot: string;
  shadow: string;
}

interface Face {
  family: string;
  weight: number;
  /** Letter spacing as a share of the size. */
  track: number;
  /** Line height as a share of the size. */
  lead: number;
  upper: boolean;
}

/** What a video takes from the design it belongs to, so it looks like that design. */
export interface Skin {
  ground: string;
  ink: string;
  accent: string;
  onAccent: string;
  /** The headline's face. */
  family: string;
  weight: number;
  track: number;
  /** The design's own backdrop, drawn dimmed behind every slide. */
  backdrop: HTMLCanvasElement | null;
  /** The color of panels, when a look sets one. */
  panel?: string;
  /** A look's id from `LOOKS`. Absent, the video looks like the design. */
  look?: string;
}

export const PLAIN_SKIN: Skin = {
  ground: '#09090b',
  ink: '#f4f4f1',
  accent: '#ff5a36',
  onAccent: '#09090b',
  family: 'Geist, Inter, sans-serif',
  weight: 620,
  track: -0.035,
  backdrop: null,
};

export interface Look {
  /** Its id in `LOOKS`. Some slide styles are made for one look only. */
  id: string;
  c: Tones;
  display: Face;
  /** How faint secondary text is. */
  dim: number;
  dark: boolean;
  backdrop: (ctx: CanvasRenderingContext2D, T: number) => void;
}

/** A color as six-digit hex, or `fallback` when it is written another way. */
function hex(color: string | undefined, fallback: string): string {
  const m = color?.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (!m) return fallback;
  const h = m[1];
  return `#${h.length === 3 ? [...h].map((x) => x + x).join('') : h}`.toLowerCase();
}

const luma = (color: string) => {
  const [r, g, b] = rgb(color);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

const stills = new Map<string, HTMLCanvasElement>();

/** A layer that never changes, painted once: grid dots and the darkened edges. */
function still(key: string, dot: string, edge: string): HTMLCanvasElement {
  let c = stills.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = dot;
    for (let y = 30; y < H; y += 60) for (let x = 30; x < W; x += 60) g.fillRect(x, y, 2, 2);
    const v = g.createRadialGradient(MID.x, MID.y, 380, MID.x, MID.y, 1150);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, edge);
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    stills.set(key, c);
  }
  return c;
}

const blobs = new Map<string, HTMLCanvasElement>();

/** A soft round field of one color, painted once and then stretched to any size. Drawing it is a
 *  single picture a frame, where a fresh gradient over the whole frame costs several times that. */
function blob(color: string, top: number, mid: number): HTMLCanvasElement {
  const key = `${color}|${top}|${mid}`;
  let c = blobs.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    const fade = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    fade.addColorStop(0, rgba(color, top));
    fade.addColorStop(0.5, rgba(color, mid));
    fade.addColorStop(1, rgba(color, 0));
    g.fillStyle = fade;
    g.fillRect(0, 0, 512, 512);
    blobs.set(key, c);
  }
  return c;
}

function lights(
  ctx: CanvasRenderingContext2D,
  T: number,
  one: string,
  two: string,
  a: number,
): void {
  const light = (x: number, y: number, r: number, color: string, alpha: number) =>
    ctx.drawImage(blob(color, alpha, alpha / 2), x - r, y - r, r * 2, r * 2);
  light(W * (0.28 + 0.09 * Math.sin(T * 0.23)), H * (0.3 + 0.12 * Math.cos(T * 0.17)), 950, one, a);
  light(
    W * (0.76 + 0.07 * Math.cos(T * 0.19)),
    H * (0.74 + 0.1 * Math.sin(T * 0.27)),
    900,
    two,
    a * 0.75,
  );
}

/** Ways a video can be dressed. Each keeps the design's accent and its headline font. */
export const LOOKS = [
  { id: 'design', name: 'From design' },
  { id: 'glass', name: 'Glass' },
  { id: 'paper', name: 'Paper' },
  { id: 'block', name: 'Block' },
];

/** A look's id as it is now. A design saved with the Midnight look gets Glass, which replaced it. */
export const lookId = (id?: string) =>
  id === 'midnight' ? 'glass' : LOOKS.some((l) => l.id === id) ? (id as string) : LOOKS[0].id;

/** The design's colors and face as a look would set them. */
function dressed(skin: Skin): Skin & { upper: boolean } {
  const accent = hex(skin.accent, PLAIN_SKIN.accent);
  const look = lookId(skin.look);
  if (look === 'glass') {
    return {
      ...skin,
      ground: blend('#09090b', accent, 0.1),
      ink: '#ffffff',
      onAccent: '#09090b',
      backdrop: null,
      upper: false,
    };
  }
  if (look === 'paper') {
    return {
      ...skin,
      ground: '#f2f1ec',
      ink: '#0e0e10',
      onAccent: '#ffffff',
      backdrop: null,
      upper: false,
    };
  }
  if (look === 'block') {
    // The accent floods the frame and the headline is set heavy, in capitals.
    const bright = luma(accent) > 0.45;
    const [r, g, b] = rgb(accent);
    const vivid = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b, 1) > 0.6;
    // A bright, vivid accent is too loud as a whole frame. It floods in a deep tone of itself
    // and keeps its full strength for the slabs.
    if (bright && vivid) {
      const deep = blend(accent, '#000000', 0.66);
      return {
        ...skin,
        ground: deep,
        ink: '#f6f1e7',
        accent,
        onAccent: deep,
        backdrop: null,
        weight: Math.max(skin.weight, 800),
        track: -0.01,
        upper: true,
      };
    }
    return {
      ...skin,
      ground: accent,
      ink: bright ? '#0b0b0d' : '#f6f1e7',
      accent: bright ? '#f6f1e7' : '#0b0b0d',
      onAccent: accent,
      backdrop: null,
      weight: Math.max(skin.weight, 800),
      track: -0.01,
      upper: true,
    };
  }
  // From design keeps the design's own ground and sets the panels in the kit's text color, so
  // the two tones the kit already has meet at full contrast with no gray between them.
  return { ...skin, panel: skin.ink, upper: false };
}

/** The look a design gives its video: its colors and headline face, with the rest worked out. */
export function lookOf(raw: Skin): Look {
  const skin = dressed(raw);
  const ground = hex(skin.ground, PLAIN_SKIN.ground);
  const dark = luma(ground) < 0.5;
  const far = (a: string, b: string) => Math.abs(luma(a) - luma(b)) > 0.14;
  const plain = dark ? '#f4f4f1' : '#0e0e10';
  const given = hex(skin.ink, plain);
  // Text the design sets on a panel of its own may not read on the backdrop.
  const ink = Math.abs(luma(given) - luma(ground)) > 0.3 ? given : plain;
  // An accent too close to the backdrop would vanish on it, so the ink stands in.
  const accent = hex(skin.accent, ink);
  const hot = far(accent, ground) ? accent : ink;
  const onAccent = hex(skin.onAccent, ground);
  const id = lookId(raw.look);
  // Under From design the panels are the kit's text color, on the design's own ground.
  const own = id === 'design';
  const panel = own && skin.panel ? hex(skin.panel, ground) : blend(ground, ink, own ? 0.04 : 0.07);
  const edge = own ? panel : blend(ground, ink, 0.12);
  const c: Tones = {
    ground,
    ink,
    onInk: ground,
    panel,
    edge,
    bar: own ? blend(panel, ground, 0.12) : blend(ground, ink, 0.12),
    chip: dark ? blend(ground, ink, 0.14) : blend(ground, '#ffffff', 0.8),
    chipInk: ink,
    hot,
    onHot: far(onAccent, hot) ? onAccent : luma(hot) > 0.5 ? '#0b0b0d' : '#ffffff',
    shadow: dark ? 'rgba(0,0,0,0.55)' : 'rgba(30,30,45,0.2)',
  };
  const veil = still(
    dark ? 'dark' : 'light',
    dark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.06)',
    dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.05)',
  );
  return {
    id,
    c,
    display: {
      family: skin.family,
      weight: skin.weight,
      track: skin.track,
      lead: skin.upper ? 1.02 : 1.08,
      upper: skin.upper,
    },
    dim: dark ? 0.6 : 0.62,
    dark,
    backdrop(ctx, T) {
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, W, H);
      // A video that looks like its design keeps the design's own backdrop.
      if (skin.backdrop) {
        cover(ctx, skin.backdrop, 0, 0, W, H);
        return;
      }
      if (id === 'glass') {
        // Wide soft fields of the accent drift behind everything, so glass has color to sit on.
        const fields: [number, number, number, string][] = [
          [0.24, 0.3, 0.46, hot],
          [0.84, 0.76, 0.4, blend(hot, '#ffffff', 0.35)],
          [0.1, 0.94, 0.42, blend(hot, ground, 0.45)],
        ];
        fields.forEach(([x, y, r, color], i) => {
          const cx = (x + Math.sin(T * 0.35 + i * 2) * 0.05) * W;
          const cy = (y + Math.cos(T * 0.3 + i) * 0.06) * H;
          ctx.drawImage(blob(color, 0.62, 0.32), cx - r * W, cy - r * W, r * W * 2, r * W * 2);
        });
        return;
      }
      // A video that looks like its design keeps a flat ground, as the kit's own pages do.
      if (own) return;
      // Paper and Block are lit faintly in the brand's accent when it has one.
      if (hot !== ink) lights(ctx, T, hot, hot, dark ? 0.13 : 0.08);
      ctx.drawImage(veil, 0, 0);
    },
  };
}

// ---------------------------------------------------------------- feel

/** How things move. Each curve takes seconds since the move began and gives 0 to 1. */
export interface Feel {
  id: string;
  name: string;
  /** Words and small pieces arriving. */
  rise: (t: number) => number;
  /** Badges and buttons popping in. */
  pop: (t: number) => number;
  /** A big shape crossing the frame. */
  glide: (t: number) => number;
  /** Eases a 0 to 1 progress. */
  move: (p: number) => number;
  /** Stretches the gap between staggered pieces. */
  gap: number;
  /** Fast moves smear, as a camera would. */
  blur: boolean;
  /** Seconds at a scene's end spent turning into the next. */
  exit: number;
}

const snap = (t: number, d: number) => (t <= 0 ? 0 : 1 - (1 - cl(t / d)) ** 4);
const settled = (f: (t: number) => number) => (t: number) => (t <= 0 ? 0 : f(t));

export const FEELS: Feel[] = [
  {
    id: 'smooth',
    name: 'Smooth',
    rise: settled((t) => spring(t, 150, 20)),
    pop: settled((t) => spring(t, 190, 19)),
    glide: settled((t) => spring(t, 95, 17)),
    move: inOut,
    gap: 1,
    blur: true,
    exit: 0.55,
  },
  {
    id: 'snappy',
    name: 'Snappy',
    rise: (t) => snap(t, 0.13),
    pop: (t) => snap(t, 0.1),
    glide: (t) => snap(t, 0.26),
    move: (p) => (p < 0.5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2),
    gap: 0.6,
    blur: false,
    exit: 0.34,
  },
  {
    id: 'bouncy',
    name: 'Bouncy',
    rise: settled((t) => spring(t, 190, 14)),
    pop: settled((t) => spring(t, 280, 13)),
    glide: settled((t) => spring(t, 120, 13)),
    move: inOut,
    gap: 1.1,
    blur: true,
    exit: 0.55,
  },
];

// ---------------------------------------------------------------- scenes

/** The shape a scene starts from. The scene before it ends on this, so the cut is never hard. */
export interface Entry {
  box: Box;
  /** What fills the shape: the ink color (default), the hot color, or one of the pictures. */
  fill?: 'ink' | 'hot';
  media?: number;
  /** How much of a window's title bar the picture starts with, 0 to 1. */
  chrome?: number;
}

/** What a scene gets each frame. */
export interface Env {
  look: Look;
  feel: Feel;
  c: Tones;
  brand: string;
  media: (i: number) => Media;
  /** Seconds since the video began, for things that drift through every scene. */
  T: number;
  /** The frame's own time in the scene. Counters read this, so blur never mixes two values. */
  frame: number;
  /** 0 until the scene starts to end, 1 at its last frame. */
  out: number;
  /** Where the next scene starts, when it starts from a shape. */
  into: Entry | null;
  /** How far the frame runs above and below the slide, in a format taller than 16:9. A slide
   *  that floods the frame reaches this much further each way. */
  tall: number;
  /** How much of the slide's width the frame shows, centered. Less than `W` in a tall format,
   *  where a slide that can narrow itself is drawn larger. */
  wide: number;
  /** True when slides cross over or push each other out. A slide then does not shrink to a
   *  shape as it ends, since nothing grows from one. */
  plain: boolean;
  /** The color of the small shape one slide hands the next: the ink, or the accent. */
  dot: string;
  /** Lights that shape with a soft glow. */
  glow: boolean;
  /** How the pointer looks and how its click shows; see `POINTERS` and `CLICKS`. */
  pointer: string;
  click: string;
}

export interface Variant<C = unknown> {
  kind: string;
  id: string;
  name: string;
  entry?: Entry;
  /** Seconds at normal pace. */
  dur: (content: C) => number;
  draw: (ctx: CanvasRenderingContext2D, t: number, d: number, env: Env, content: C) => void;
  /** The sounds its motion makes, timed as `draw` is: the slide's own seconds at normal pace. */
  cues?: (content: C, feel: Feel) => Cue[];
  /** Keeps everything inside `env.wide`. A tall format then draws it larger than the 16:9 band
   *  the other slides play in. */
  narrow?: boolean;
  /** The entry for a frame that shows this much of the slide, when the slide lays itself out
   *  differently there. Takes the place of `entry`. */
  entryFor?: (wide: number, tall: number) => Entry;
  /** The one look it is made for. Absent, it goes with every look. */
  look?: string;
  /** What it is, whichever look draws it. A change of look swaps it for that look's own. */
  role?: string;
  /** A second role it stands in for, where its look has no variant of that role. */
  also?: string;
  /** Seconds its ending takes, where it starts to leave sooner than the feel's exit before its
   *  end: a tap, a done mark. No speed shortens that stretch. */
  leave?: (content: C) => number;
}

const REGISTRY: Variant[] = [];

/** Adds a way to draw a scene kind. Every template can then use it. */
export function register<C>(v: Variant<C>): void {
  REGISTRY.push(v as unknown as Variant);
}

/** The ways to draw a scene kind: all of them, or the ones that go with a look. */
export const variantsOf = (kind: string, look?: string): Variant[] =>
  REGISTRY.filter((v) => v.kind === kind && (!look || !v.look || v.look === look));

/** The variant a scene plays under a look: the one picked, or that look's own of the same role. */
export function fitted(kind: string, id: string | undefined, look: string): Variant | undefined {
  const fits = variantsOf(kind, look);
  const picked = variantsOf(kind).find((v) => v.id === id);
  if (!picked) return fits[0];
  if (!picked.look || picked.look === look) return picked;
  return (
    fits.find((v) => v.role === picked.role) ??
    fits.find((v) => v.also === picked.role) ??
    fits[0]
  );
}

export interface SceneSpec {
  kind: string;
  /** Tells apart two scenes of one kind. Absent, the kind is the id. */
  id?: string;
  /** Absent uses the kind's first variant. */
  variant?: string;
  content: unknown;
}

export interface VideoSpec {
  feel: string;
  /** Above 1 plays faster. */
  pace: number;
  skin: Skin;
  brand: string;
  scenes: SceneSpec[];
  /** How one slide gives way to the next; see `CUTS`. Absent is `shape`. */
  cut?: string;
  /** See `POINTERS` and `CLICKS`. Absent is the first of each. */
  pointer?: string;
  click?: string;
}

/** The ways one slide can give way to the next. `glow`: it shrinks to a small lit shape in the
 *  accent, which the next grows from. In the others the two slides overlap for a moment: `push`
 *  slides the next one in, `dissolve` crosses them over, and `zoom` flies through the old one. */
export const CUTS = [
  { id: 'glow', name: 'Glow' },
  { id: 'push', name: 'Push' },
  { id: 'dissolve', name: 'Dissolve' },
  { id: 'zoom', name: 'Zoom' },
] as const;

/** Seconds two slides share when they overlap, at normal pace. */
const LAP = 0.5;
/** Seconds a slide takes to grow out of the dot the one before left, which no speed shortens. */
const HEAD = 0.6;

export interface Shot {
  id: string;
  kind: string;
  variant: Variant;
  start: number;
  d: number;
}

export interface Video {
  shots: Shot[];
  length: number;
  blur: boolean;
  /** Every sound in the video, in the video's own seconds. */
  cues: Cue[];
  /** What paints the frame at `at` seconds. Blur samples around it stay on that frame's numbers. */
  frame: (at: number) => Paint;
}

/** The next slide's first shape. Its content may name the picture it opens on with `lead`. */
/** How much larger than the 16:9 band a frame of this shape draws a slide that can narrow
 *  itself: nothing up to square, and close to filling the width of a 9:16 frame. */
const zoomOf = (rh: number) => 1 + Math.max(0, rh - 1) * 0.96;

/** The next slide's first shape, as the slide before it must draw it. `scale` is the next slide's
 *  zoom over this one's, and `wide` and `tall` are what this slide sees of the frame. */
function nextEntry(
  entry: Entry | undefined,
  content: unknown,
  scale: number,
  wide: number,
  tall: number,
): Entry | null {
  if (!entry) return null;
  const lead = (content as { lead?: number } | undefined)?.lead;
  const b = entry.box;
  // An entry that fills the frame fills this slide's whole view of it.
  const box =
    b.h >= H
      ? { ...b, w: wide + 80, h: H + tall * 2 + 80 }
      : {
          cx: MID.x + (b.cx - MID.x) * scale,
          cy: MID.y + (b.cy - MID.y) * scale,
          w: b.w * scale,
          h: b.h * scale,
          r: b.r * scale,
        };
  return { ...entry, box, ...(entry.media !== undefined && lead !== undefined && { media: lead }) };
}

/** `rh` is the frame's height over its width. Slides are laid out for 16:9. In a taller format the
 *  backdrop fills the frame, and a slide plays across its middle: larger when it can narrow
 *  itself, else as a 16:9 band. */
export function compile(spec: VideoSpec, media: Media[], rh = H / W): Video {
  const look = lookOf(spec.skin);
  const feel = FEELS.find((f) => f.id === spec.feel) ?? FEELS[0];
  const c = look.c;
  const pace = spec.pace || 1;
  const cut = CUTS.find((x) => x.id === spec.cut)?.id ?? 'glow';
  const plain = cut !== 'glow';
  const lap = plain ? LAP / pace : 0;
  // Above normal speed only the body of a slide plays faster. Its first moments and the stretch
  // in which it shrinks to the dot keep normal pace, so the dot between two slides stays up as
  // long as it does at normal speed.
  const held = !plain && pace > 1;
  /** A slide's seconds at normal pace, cut into its opening, its body and its ending as played. */
  const span = (full: number, leave: number) => {
    const head = held ? Math.min(HEAD, full) : 0;
    const tail = held ? Math.min(Math.max(feel.exit, leave), full - head) : 0;
    return { full, head, tail, body: (full - head - tail) / pace };
  };
  type Span = ReturnType<typeof span>;
  /** The slide's own clock, `at` seconds after it starts. */
  const clock = ({ full, head, tail, body }: Span, at: number) => {
    if (at <= head) return at;
    if (at <= head + body) return head + (at - head) * pace;
    return full - tail + (at - head - body);
  };
  /** How long after it starts the slide reaches `t` on its own clock. */
  const played = ({ full, head, tail, body }: Span, t: number) => {
    if (t <= head) return t;
    if (t <= full - tail) return head + (t - head) / pace;
    return head + body + (t - (full - tail));
  };
  const shots: Shot[] = [];
  const spans: Span[] = [];
  let start = 0;
  for (const s of spec.scenes) {
    const variant = fitted(s.kind, s.variant, look.id);
    if (!variant) continue;
    const own = span(variant.dur(s.content), variant.leave?.(s.content) ?? 0);
    const d = played(own, own.full);
    spans.push(own);
    shots.push({ id: s.id ?? s.kind, kind: s.kind, variant, start, d });
    // Under a dissolve or a push the next slide starts while this one is still leaving.
    start += d - lap;
  }
  const length = shots.length ? start + lap : 0;
  const contents = spec.scenes.filter((s) => variantsOf(s.kind).length).map((s) => s.content);
  const zoom = (i: number) => (shots[i]?.variant.narrow ? zoomOf(rh) : 1);
  /** A slide's first shape in a frame of this size, in the slide's own coordinates. */
  const entryOf = (i: number, width: number, height: number): Entry | undefined => {
    const v = shots[i]?.variant;
    if (!v?.entryFor) return v?.entry;
    const k = (width / W) * zoom(i);
    return v.entryFor(W / zoom(i), Math.max(0, (height / k - H) / 2));
  };
  const pick = (i: number) => media[((i % media.length) + media.length) % media.length];
  /** Draws slide `i` as it is at `T` seconds into the video. */
  const slide = (ctx: CanvasRenderingContext2D, i: number, T: number, at: number): void => {
    const shot = shots[i];
    const { width, height } = ctx.canvas;
    // The slide is drawn around the frame's middle, at its own zoom.
    const z = zoom(i);
    const k = (width / W) * z;
    const wide = W / z;
    const tall = Math.max(0, (height / k - H) / 2);
    ctx.setTransform(k, 0, 0, k, (width - W * k) / 2, (height - H * k) / 2);
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    const d = spans[i].full;
    const t = Math.min(d, clock(spans[i], Math.max(0, T - shot.start)));
    const env: Env = {
      look,
      feel,
      c,
      brand: spec.brand,
      media: pick,
      T,
      frame: Math.min(d, clock(spans[i], Math.max(0, at - shot.start))),
      // A slide that crosses over or is pushed out holds still while the frame does the leaving.
      out: plain ? 0 : feel.move(seg(t, d - feel.exit, d)),
      into: plain
        ? null
        : nextEntry(entryOf(i + 1, width, height), contents[i + 1], zoom(i + 1) / z, wide, tall),
      tall,
      wide,
      plain,
      dot: c.hot,
      glow: !plain,
      pointer: spec.pointer ?? POINTERS[0].id,
      click: spec.click ?? CLICKS[0].id,
    };
    ctx.save();
    shot.variant.draw(ctx, t, d, env, contents[i]);
    ctx.restore();
  };
  // Two slides at once are each drawn on a sheet of their own, then laid over the backdrop.
  const sheets: HTMLCanvasElement[] = [];
  const sheet = (n: number, width: number, height: number) => {
    const made = sheets[n] ?? document.createElement('canvas');
    sheets[n] = made;
    if (made.width !== width || made.height !== height) {
      made.width = width;
      made.height = height;
    }
    const g = made.getContext('2d') as CanvasRenderingContext2D;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, width, height);
    return g;
  };
  const frame =
    (at: number): Paint =>
    (ctx, T) => {
      const { width, height } = ctx.canvas;
      ctx.setTransform(width / W, 0, 0, height / H, 0, 0);
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      look.backdrop(ctx, T);
      if (!shots.length) return;
      // The slide playing is the last one to have started.
      let i = shots.findLastIndex((s) => T >= s.start);
      if (i < 0) i = 0;
      const before = i > 0 && T < shots[i - 1].start + shots[i - 1].d ? i - 1 : -1;
      if (!plain || before < 0) {
        slide(ctx, i, T, at);
        return;
      }
      const p = feel.move(seg(T, shots[i].start, shots[i].start + lap));
      const going = sheet(0, width, height);
      slide(going, before, T, at);
      const coming = sheet(1, width, height);
      slide(coming, i, T, at);
      const lay = (g: CanvasRenderingContext2D, alpha: number, scale: number, dx: number) => {
        ctx.setTransform(
          scale,
          0,
          0,
          scale,
          (width * (1 - scale)) / 2 + dx,
          (height * (1 - scale)) / 2,
        );
        ctx.globalAlpha = alpha;
        ctx.drawImage(g.canvas, 0, 0);
      };
      const soft = (px: number) =>
        feel.blur && px > 0.5 ? `blur(${(px * (width / W)).toFixed(1)}px)` : 'none';
      if (cut === 'push') {
        lay(going, 1 - p * 0.5, 1, -p * width);
        lay(coming, 1, 1, (1 - p) * width);
      } else if (cut === 'zoom') {
        // The camera goes through the slide that is leaving and finds the next one behind it.
        ctx.filter = soft(p * 18);
        lay(going, 1 - p, 1 + 1.6 * p, 0);
        ctx.filter = soft((1 - p) * 14);
        lay(coming, p, 0.72 + 0.28 * p, 0);
        ctx.filter = 'none';
      } else {
        // The one leaving eases back and softens. The one arriving eases forward into focus.
        ctx.filter = soft(p * 10);
        lay(going, 1 - p, 1 - 0.05 * p, 0);
        ctx.filter = 'none';
        lay(coming, p, 1.05 - 0.05 * p, 0);
      }
      ctx.globalAlpha = 1;
    };
  const cues: Cue[] = [];
  shots.forEach((shot, i) => {
    const own = (shot.variant.cues?.(contents[i], feel) ?? []).map((q) => ({
      ...q,
      at: shot.start + played(spans[i], q.at),
    }));
    cues.push(...own);
    // A slide that has no whoosh of its own near its end gets one as it turns into the next.
    const leaves = shot.start + played(spans[i], spans[i].full - feel.exit);
    const said = own.some((q) => q.sound === 'whoosh' && q.at > leaves - 1.5 / pace);
    if (i < shots.length - 1 && !said) cues.push({ at: leaves, sound: 'whoosh', gain: 0.5 });
  });
  return { shots, length, blur: feel.blur, cues, frame };
}

function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** How fast a video plays, slowest first, and what each speed is called. */
export const PACES = [0.85, 1, 1.35, 1.8];
export const PACE_NAMES = ['Calm', 'Normal', 'Fast', 'Very fast'];

/** Another take on the same content: a look, a feel, a pace and a variant for each scene. */
export function shuffle(spec: VideoSpec, seed: number): VideoSpec {
  const rnd = seeded(seed * 2654435761);
  const any = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)];
  const look = any(LOOKS).id;
  return {
    ...spec,
    skin: { ...spec.skin, look },
    feel: any(FEELS).id,
    pace: any(PACES),
    scenes: spec.scenes.map((s) => ({ ...s, variant: any(variantsOf(s.kind, look))?.id })),
  };
}

// ---------------------------------------------------------------- kit

type Spaced = CanvasRenderingContext2D & { letterSpacing: string };
const track = (ctx: CanvasRenderingContext2D, px: number) => {
  (ctx as Spaced).letterSpacing = `${px}px`;
};

export type Voice = 'display' | 'text' | 'mono';

interface Set {
  font: string;
  track: number;
  lead: number;
  upper: boolean;
  size: number;
}

/** A voice at a size: the design's headline face, plain text, or mono labels. */
export function setting(env: Env, voice: Voice, size: number, weight?: number): Set {
  if (voice === 'mono') {
    return {
      font: `${weight ?? 500} ${size}px "Geist Mono", ui-monospace, monospace`,
      track: size * 0.14,
      lead: 1.3,
      upper: true,
      size,
    };
  }
  if (voice === 'text') {
    return {
      font: `${weight ?? 430} ${size}px Geist, Inter, sans-serif`,
      track: size * -0.01,
      lead: 1.38,
      upper: false,
      size,
    };
  }
  const f = env.look.display;
  return {
    font: `${weight ?? f.weight} ${size}px ${f.family}`,
    track: size * f.track,
    lead: f.lead,
    upper: f.upper,
    size,
  };
}

export function path(ctx: CanvasRenderingContext2D, b: Box): void {
  ctx.beginPath();
  ctx.roundRect(
    b.cx - b.w / 2,
    b.cy - b.h / 2,
    b.w,
    b.h,
    Math.max(0, Math.min(b.r, b.w / 2, b.h / 2)),
  );
}

const halves = new WeakMap<Media, HTMLCanvasElement[]>();

/** A picture at half its size, `n` times over, made once. Each is drawn from the one before. */
function halved(src: Media, sw: number, sh: number, n: number): Media {
  if (n <= 0) return src;
  const chain = halves.get(src) ?? [];
  halves.set(src, chain);
  while (chain.length < n) {
    const from: Media = chain[chain.length - 1] ?? src;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw / 2 ** (chain.length + 1)));
    c.height = Math.max(1, Math.round(sh / 2 ** (chain.length + 1)));
    const g = c.getContext('2d');
    if (g) {
      g.imageSmoothingQuality = 'high';
      g.drawImage(from, 0, 0, c.width, c.height);
    }
    chain.push(c);
  }
  return chain[n - 1];
}

const edges = new WeakMap<Media, string>();

/** The color at a picture's corner, read once, for filling the room around it. */
function edgeOf(src: Media, fallback: string): string {
  const known = edges.get(src);
  if (known) return known;
  let color = fallback;
  try {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 8;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (g) {
      g.drawImage(src, 0, 0, 8, 8);
      const px = g.getImageData(0, 0, 1, 1).data;
      if (px[3] > 200) color = `rgb(${px[0]},${px[1]},${px[2]})`;
    }
  } catch {
    // A picture the browser will not let us read keeps the fallback.
  }
  edges.set(src, color);
  return color;
}

/** The most of a picture, as a share of its width or height, that filling a box may cut off. */
const MAX_CROP = 0.05;

/**
 * Draws a picture to fill a box, cropped to its shape. A `still` picture drawn much smaller than
 * it is comes from a copy shrunk ahead of time: shrinking a lot in one step shimmers as the box
 * moves by parts of a pixel. A canvas that is repainted every frame must not ask for that.
 *
 * With `around` set, a picture whose shape is far from the box's is shown whole instead, so its
 * own margins are kept, and the room left over takes the picture's edge color (or `around`).
 */
export function cover(
  ctx: CanvasRenderingContext2D,
  src: Media,
  x: number,
  y: number,
  w: number,
  h: number,
  still = false,
  around?: string,
): void {
  const v = src as HTMLVideoElement;
  const i = src as HTMLImageElement;
  const sw = v.videoWidth || i.naturalWidth || src.width;
  const sh = v.videoHeight || i.naturalHeight || src.height;
  if (!sw || !sh || w <= 0 || h <= 0) return;
  const fill = Math.max(w / sw, h / sh);
  const fit = Math.min(w / sw, h / sh);
  const whole = around !== undefined && 1 - fit / fill > MAX_CROP;
  const s = whole ? fit : fill;
  const onScreen = s * Math.abs(ctx.getTransform().a);
  const n =
    still && !v.videoWidth ? Math.min(4, Math.max(0, Math.ceil(Math.log2(0.5 / onScreen)))) : 0;
  const k = 2 ** n;
  const from = halved(src, sw, sh, n);
  ctx.imageSmoothingQuality = 'high';
  if (whole) {
    ctx.fillStyle = edgeOf(src, around);
    ctx.fillRect(x, y, w, h);
    ctx.drawImage(from, x + (w - sw * s) / 2, y + (h - sh * s) / 2, sw * s, sh * s);
    return;
  }
  ctx.drawImage(from, (sw - w / s) / 2 / k, (sh - h / s) / 2 / k, w / s / k, h / s / k, x, y, w, h);
}

export interface Say {
  voice?: Voice;
  align?: 'left' | 'center';
  weight?: number;
  color?: string;
  start?: number;
  /** Seconds between words. */
  stagger?: number;
}

/** Words come up one by one out of a mask under each line. `*word*` takes the hot color. */
export function say(
  ctx: CanvasRenderingContext2D,
  env: Env,
  lines: string[],
  x: number,
  y: number,
  size: number,
  t: number,
  o: Say = {},
): void {
  const set = setting(env, o.voice ?? 'display', size, o.weight);
  const base = ctx.globalAlpha;
  ctx.font = set.font;
  track(ctx, set.track);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const space = ctx.measureText(' ').width;
  const stagger = (o.stagger ?? 0.08) * env.feel.gap;
  let k = 0;
  let hot = false;
  lines.forEach((line, li) => {
    const words = (set.upper ? line.toUpperCase() : line)
      .split(' ')
      .filter(Boolean)
      .map((raw) => {
        if (raw.startsWith('*')) hot = true;
        const word = { text: raw.replace(/\*/g, ''), hot, w: 0 };
        if (/\*[.,!?]?$/.test(raw)) hot = false;
        word.w = ctx.measureText(word.text).width;
        return word;
      });
    const total = words.reduce((n, w) => n + w.w, 0) + space * Math.max(0, words.length - 1);
    let px = o.align === 'left' ? x : x - total / 2;
    const by = y + li * set.size * set.lead;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px - set.size, by - set.size * 1.02, total + set.size * 2, set.size * 1.32);
    ctx.clip();
    for (const w of words) {
      const lt = t - (o.start ?? 0) - k * stagger;
      k++;
      if (lt > 0) {
        ctx.globalAlpha = base * seg(lt, 0, 0.14);
        ctx.fillStyle = w.hot ? env.c.hot : (o.color ?? env.c.ink);
        ctx.fillText(w.text, px, by + (1 - env.feel.rise(lt)) * set.size * 0.9);
      }
      px += w.w + space;
    }
    ctx.restore();
  });
  ctx.globalAlpha = base;
  track(ctx, 0);
}

/** How wide a line is in a voice, without its `*` marks. */
export function widthOf(
  ctx: CanvasRenderingContext2D,
  env: Env,
  text: string,
  size: number,
  voice: Voice = 'display',
): number {
  const set = setting(env, voice, size);
  ctx.font = set.font;
  track(ctx, set.track);
  const w = ctx.measureText((set.upper ? text.toUpperCase() : text).replace(/\*/g, '')).width;
  track(ctx, 0);
  return w;
}

export function wrap(
  ctx: CanvasRenderingContext2D,
  env: Env,
  text: string,
  size: number,
  max: number,
  voice: Voice = 'display',
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && widthOf(ctx, env, next, size, voice) > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export const dim = (env: Env) => rgba(env.c.ink, env.look.dim);

/** The ways the pointer can look. */
export const POINTERS = [
  { id: 'arrow', name: 'White arrow' },
  { id: 'dark', name: 'Dark arrow' },
  { id: 'wedge', name: 'Rounded wedge' },
  { id: 'tag', name: 'Wedge with a name' },
  { id: 'dot', name: 'Soft dot' },
  { id: 'ring', name: 'Ring' },
  { id: 'hand', name: 'Pointing hand' },
  { id: 'turn', name: 'Arrow, then hand' },
] as const;

/** The ways a click can show. */
export const CLICKS = [
  { id: 'dip', name: 'Dip' },
  { id: 'ripple', name: 'Ripple' },
  { id: 'ripples', name: 'Two ripples' },
  { id: 'spot', name: 'Tap spot' },
] as const;

/** The ways a Build-up's done disc can play out. */
export const ENDINGS = [
  { id: 'tick', name: 'Tick' },
  { id: 'ring', name: 'Ring closes' },
  { id: 'burst', name: 'Burst' },
  { id: 'ripple', name: 'Two rings' },
] as const;

/** The marks that can turn beside a Status word. */
export const MARKS = [
  { id: 'dot', name: 'Breathing dot' },
  { id: 'dots', name: 'Three dots' },
  { id: 'arc', name: 'Turning arc' },
] as const;

type G = CanvasRenderingContext2D;

/** Fills and edges the path already laid down, with a soft shadow under the fill. */
function inked(ctx: G, fill: string, edge: string, width: number): void {
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = edge;
  ctx.stroke();
}

/** The classic arrow with its tail. Its tip is at 0, 0. */
function arrowAt(ctx: G, fill: string, edge: string): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 19);
  ctx.lineTo(5, 14.5);
  ctx.lineTo(8.6, 22.5);
  ctx.lineTo(11.6, 21.2);
  ctx.lineTo(8.1, 13.4);
  ctx.lineTo(14.6, 13.4);
  ctx.closePath();
  inked(ctx, fill, edge, 1.3);
}

/** A plain triangle with soft corners and no tail. */
function wedgeAt(ctx: G, fill: string, edge: string): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(3.2, 19.5);
  ctx.lineTo(8.4, 12.6);
  ctx.lineTo(16.8, 10.4);
  ctx.closePath();
  inked(ctx, fill, edge, 2.2);
}

// The outline of the pointing hand a browser shows over a link, on a 24 by 24 grid.
const HAND = [
  'M22 14a8 8 0 0 1-8 8',
  'M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2',
  'M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1',
  'M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10',
  'M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
];
let handLines: Path2D[] | null = null;

/** The pointing hand, white with a dark outline. Its fingertip is at 0, 0. */
function handAt(ctx: G): void {
  handLines ??= HAND.map((d) => new Path2D(d));
  ctx.translate(-8, -2);
  ctx.beginPath();
  ctx.roundRect(6, 2, 4, 14, 2);
  ctx.roundRect(10, 7, 4, 9, 2);
  ctx.roundRect(14, 8, 4, 8, 2);
  ctx.roundRect(18, 9, 4, 8, 2);
  ctx.moveTo(6, 12);
  ctx.lineTo(22, 12);
  ctx.lineTo(22, 14);
  ctx.bezierCurveTo(22, 18.4, 18.4, 22, 14, 22);
  ctx.lineTo(12, 22);
  ctx.bezierCurveTo(9.2, 22, 7.5, 21.1, 6, 19.7);
  ctx.lineTo(2.4, 16.1);
  ctx.lineTo(3.2, 13.6);
  ctx.lineTo(5.2, 13.3);
  ctx.lineTo(7, 15);
  ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#0b0b0d';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const line of handLines) ctx.stroke(line);
}

/** What the click leaves around the pointer's tip, `p` being how far through it is. */
function clicked(ctx: G, env: Env, x: number, y: number, since: number): void {
  const ring = (lag: number, long: number, reach: number, color: string, width: number) => {
    const p = seg(since, lag, lag + long);
    if (p <= 0 || p >= 1) return;
    ctx.strokeStyle = rgba(color, 1 - p);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, 7 + (1 - (1 - p) ** 3) * reach, 0, 7);
    ctx.stroke();
  };
  if (env.click === 'ripple') ring(0, 0.5, 46, '#ffffff', 3.4);
  else if (env.click === 'ripples') {
    ring(0, 0.55, 52, env.c.hot, 4);
    ring(0.14, 0.55, 52, env.c.hot, 4);
  } else if (env.click === 'spot') {
    const p = seg(since, 0, 0.45);
    if (p <= 0 || p >= 1) return;
    ctx.fillStyle = rgba(env.c.hot, 0.75 * (1 - p));
    ctx.beginPath();
    ctx.arc(x, y, 25 * Math.sin((Math.PI / 2) * Math.min(1, p * 1.4)) * (1 - 0.3 * p), 0, 7);
    ctx.fill();
  }
}

/** The pointer with its tip at `x`, `y`, `since` seconds after its click (before it, below zero).
 *  The look and the click are the video's own; see `POINTERS` and `CLICKS`. */
export function pointer(
  ctx: CanvasRenderingContext2D,
  env: Env,
  x: number,
  y: number,
  since: number,
  alpha = 1,
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  clicked(ctx, env, x, y, since);
  // Under a tap spot the pointer holds still, and the spot does the pressing.
  const down = env.click === 'spot' ? 0 : press(since);
  const kind = env.pointer;
  if (kind === 'dot' || kind === 'ring') {
    ctx.beginPath();
    ctx.arc(x, y, 19 * (1 - 0.18 * down), 0, 7);
    if (kind === 'dot') {
      ctx.fillStyle = rgba('#ffffff', 0.32 + 0.25 * down);
      ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.85);
      ctx.lineWidth = 2.8;
    } else {
      if (down > 0) {
        ctx.fillStyle = rgba(env.c.hot, 0.6 * down);
        ctx.fill();
      }
      ctx.strokeStyle = env.c.hot;
      ctx.lineWidth = 3.4;
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (kind === 'tag') {
    // The name rides just under the wedge, as a teammate's does in a shared design file.
    ctx.font = setting(env, 'text', 17, 600).font;
    const w = ctx.measureText(env.brand).width + 20;
    ctx.fillStyle = env.c.hot;
    ctx.beginPath();
    ctx.roundRect(x + 25, y + 34, w, 27, 8);
    ctx.fill();
    ctx.fillStyle = env.c.onHot;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(env.brand, x + 35, y + 48);
  }
  // It travels as the arrow and is the hand by the time it is over what it clicks.
  const hand = kind === 'hand' ? 1 : kind === 'turn' ? seg(since, -0.42, -0.3) : 0;
  const s = 1.9 * (1 - 0.14 * down);
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (hand < 1) {
    ctx.save();
    ctx.globalAlpha *= 1 - hand;
    if (kind === 'wedge') wedgeAt(ctx, '#fff', '#0b0b0d');
    else if (kind === 'tag') wedgeAt(ctx, env.c.hot, env.c.onHot);
    else if (kind === 'dark') arrowAt(ctx, '#0b0b0d', '#fff');
    else arrowAt(ctx, '#fff', '#0b0b0d');
    ctx.restore();
  }
  if (hand > 0) {
    ctx.globalAlpha *= hand;
    handAt(ctx);
  }
  ctx.restore();
}

/** A pane of glass: a faint tint, a soft shadow, and an edge lit from above. */
export function pane(ctx: CanvasRenderingContext2D, env: Env, b: Box): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 26;
  path(ctx, b);
  ctx.fillStyle = env.look.dark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)';
  ctx.fill();
  ctx.restore();
  path(ctx, b);
  ctx.fillStyle = `rgba(255,255,255,${env.look.dark ? 0.13 : 0.34})`;
  ctx.fill();
  const edge = ctx.createLinearGradient(0, b.cy - b.h / 2, 0, b.cy + b.h / 2);
  edge.addColorStop(0, 'rgba(255,255,255,0.62)');
  edge.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  edge.addColorStop(1, 'rgba(255,255,255,0.06)');
  path(ctx, b);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = edge;
  ctx.stroke();
}

/** What panels are made of under the look: their color, the ink on them, and their roundest
 *  corner, which is small under every look. Matte under From design, glass, a sheet of paper,
 *  or a flat slab of the accent. */
export function stuff(env: Env): { fill: string; ink: string; r: number } {
  const { ground, ink, hot, onHot } = env.c;
  if (env.look.id === 'glass') return { fill: blend(ground, '#ffffff', 0.2), ink, r: 20 };
  if (env.look.id === 'block') return { fill: hot, ink: onHot, r: 14 };
  if (env.look.id === 'paper') {
    const fill = env.look.dark ? blend(ground, ink, 0.09) : blend(ground, '#ffffff', 0.75);
    return { fill, ink, r: 6 };
  }
  return { fill: env.c.panel, ink: ground, r: 20 };
}

/** A panel in the look's own material. */
export function panel(ctx: CanvasRenderingContext2D, env: Env, box: Box): void {
  const st = stuff(env);
  const b = { ...box, r: Math.min(box.r, st.r) };
  if (env.look.id === 'glass') {
    pane(ctx, env, b);
    return;
  }
  ctx.save();
  if (env.look.id === 'paper') {
    ctx.shadowColor = 'rgba(0,0,0,0.26)';
    ctx.shadowBlur = 54;
    ctx.shadowOffsetY = 28;
  }
  path(ctx, b);
  ctx.fillStyle = st.fill;
  ctx.fill();
  ctx.restore();
  if (env.look.id !== 'design') return;
  path(ctx, b);
  ctx.lineWidth = 2;
  ctx.strokeStyle = env.c.edge;
  ctx.stroke();
}

/** A screenshot in a window. `chrome` 0 is the bare picture, 1 has the title bar. */
export function card(
  ctx: CanvasRenderingContext2D,
  env: Env,
  box: Box,
  src: Media,
  chrome: number,
  alpha = 1,
): void {
  const b = { ...box, r: Math.min(box.r, stuff(env).r) };
  if (alpha <= 0 || b.w < 2) return;
  const c = env.c;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const flat = env.look.id === 'design';
  if (!flat) {
    ctx.shadowColor = c.shadow;
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 26;
  }
  // Under From design a screenshot's window stays dark, a step off the ground. The look's
  // panel color is the kit's text color there, which is for panels that hold words.
  const win = flat ? blend(c.ground, c.ink, 0.07) : c.panel;
  path(ctx, b);
  ctx.fillStyle = win;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  path(ctx, b);
  ctx.clip();
  const top = 46 * chrome;
  cover(ctx, src, b.cx - b.w / 2, b.cy - b.h / 2 + top, b.w, b.h - top, true, win);
  if (chrome > 0.01) {
    ctx.globalAlpha *= chrome;
    ctx.fillStyle = flat ? blend(c.ground, c.ink, 0.13) : c.bar;
    ctx.fillRect(b.cx - b.w / 2, b.cy - b.h / 2, b.w, top);
    ctx.fillStyle = rgba(c.chipInk, 0.22);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(b.cx - b.w / 2 + 26 + k * 20, b.cy - b.h / 2 + top / 2, 5.5, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = rgba(c.chipInk, 0.09);
    ctx.beginPath();
    ctx.roundRect(b.cx - 150, b.cy - b.h / 2 + top / 2 - 11, 300, 22, 11);
    ctx.fill();
  }
  ctx.restore();
  path(ctx, b);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = flat ? rgba(c.ink, 0.14) : rgba(c.chipInk, 0.12);
  ctx.stroke();
  ctx.restore();
}

/** A small floating badge. Leaves the context moved to its top left corner. */
export function chip(
  ctx: CanvasRenderingContext2D,
  env: Env,
  x: number,
  y: number,
  w: number,
  h: number,
  pop: number,
): void {
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(lerp(0.7, 1, pop), lerp(0.7, 1, pop));
  ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = env.c.shadow;
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = env.c.chip;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 22);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(env.c.chipInk, 0.14);
  ctx.stroke();
}

/** Where a scene's last shape is on its way to the next scene's first. */
export const toward = (env: Env, from: Box, p: number): Box =>
  env.into ? mix(from, env.into.box, cl(p)) : from;

/** Paints the next scene's first fill over `b`, more of it as `p` goes to 1. */
export function arrive(ctx: CanvasRenderingContext2D, env: Env, b: Box, p: number): void {
  const into = env.into;
  if (!into || p <= 0) return;
  if (into.media !== undefined) {
    card(ctx, env, b, env.media(into.media), into.chrome ?? 0, cl(p));
    return;
  }
  ctx.save();
  ctx.globalAlpha *= cl(p);
  if (env.glow) {
    ctx.shadowColor = rgba(env.dot, 0.7);
    ctx.shadowBlur = 70;
  }
  path(ctx, b);
  ctx.fillStyle = into.fill === 'hot' ? env.c.hot : env.dot;
  ctx.fill();
  ctx.restore();
}

/** Fades and softens everything drawn after it as the scene ends. Use inside save/restore. */
export function leave(ctx: CanvasRenderingContext2D, env: Env, lift = 0): void {
  if (env.out <= 0) return;
  ctx.globalAlpha *= 1 - env.out;
  if (lift) ctx.translate(0, -lift * env.out);
  if (env.feel.blur && env.out > 0.01) ctx.filter = `blur(${(14 * env.out).toFixed(1)}px)`;
}

/** A scene with no shape of its own grows the next scene's first shape from a point. */
export function seedOut(ctx: CanvasRenderingContext2D, env: Env, at = MID): void {
  if (!env.into || env.out <= 0) return;
  arrive(ctx, env, toward(env, { cx: at.x, cy: at.y, w: 0, h: 0, r: env.into.box.r }, env.out), 1);
}

/** A number counting up to its written value, keeping its prefix, suffix and separators. */
export function counted(value: string, p: number): string {
  const m = value.match(/^([^\d]*)([\d.,]+)(.*)$/);
  if (!m) return value;
  const dec = (m[2].split('.')[1] ?? '').length;
  const cur = Number.parseFloat(m[2].replace(/,/g, '')) * p;
  const text = m[2].includes(',')
    ? cur.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : cur.toFixed(dec);
  return m[1] + text + m[3];
}
