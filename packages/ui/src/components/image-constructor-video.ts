import { inOut, type Paint, spring } from './image-constructor-motion.js';

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
  /** A screenshot's window and the small badges on it. */
  panel: string;
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

function lights(
  ctx: CanvasRenderingContext2D,
  T: number,
  one: string,
  two: string,
  a: number,
): void {
  const light = (x: number, y: number, r: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  light(W * (0.28 + 0.09 * Math.sin(T * 0.23)), H * (0.3 + 0.12 * Math.cos(T * 0.17)), 950, one, a);
  light(
    W * (0.76 + 0.07 * Math.cos(T * 0.19)),
    H * (0.74 + 0.1 * Math.sin(T * 0.27)),
    900,
    two,
    a * 0.75,
  );
}

/** The look a design gives its video: its colors and headline face, with the rest worked out. */
export function lookOf(skin: Skin): Look {
  const ground = hex(skin.ground, PLAIN_SKIN.ground);
  const dark = luma(ground) < 0.5;
  const ink = hex(skin.ink, dark ? '#f4f4f1' : '#0e0e10');
  const far = (a: string, b: string) => Math.abs(luma(a) - luma(b)) > 0.14;
  // An accent too close to the backdrop would vanish on it, so the ink stands in.
  const accent = hex(skin.accent, ink);
  const hot = far(accent, ground) ? accent : ink;
  const onAccent = hex(skin.onAccent, ground);
  const c: Tones = {
    ground,
    ink,
    onInk: ground,
    panel: blend(ground, ink, 0.07),
    bar: blend(ground, ink, 0.12),
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
    c,
    display: { family: skin.family, weight: skin.weight, track: skin.track, lead: 1.08 },
    dim: dark ? 0.6 : 0.62,
    dark,
    backdrop(ctx, T) {
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, W, H);
      if (skin.backdrop) {
        cover(ctx, skin.backdrop, 0, 0, W, H);
        ctx.fillStyle = rgba(ground, 0.5);
        ctx.fillRect(0, 0, W, H);
      }
      lights(ctx, T, hot, dark ? '#5b5bff' : '#7a7aff', dark ? 0.18 : 0.1);
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
}

export interface Variant<C = unknown> {
  kind: string;
  id: string;
  name: string;
  entry?: Entry;
  /** Seconds at normal pace. */
  dur: (content: C) => number;
  draw: (ctx: CanvasRenderingContext2D, t: number, d: number, env: Env, content: C) => void;
}

const REGISTRY: Variant[] = [];

/** Adds a way to draw a scene kind. Every template can then use it. */
export function register<C>(v: Variant<C>): void {
  REGISTRY.push(v as unknown as Variant);
}

export const variantsOf = (kind: string): Variant[] => REGISTRY.filter((v) => v.kind === kind);

export interface SceneSpec {
  kind: string;
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
}

export interface Shot {
  kind: string;
  variant: Variant;
  start: number;
  d: number;
}

export interface Video {
  shots: Shot[];
  length: number;
  blur: boolean;
  /** What paints the frame at `at` seconds. Blur samples around it stay on that frame's numbers. */
  frame: (at: number) => Paint;
}

export function compile(spec: VideoSpec, media: Media[]): Video {
  const look = lookOf(spec.skin);
  const feel = FEELS.find((f) => f.id === spec.feel) ?? FEELS[0];
  const c = look.c;
  const pace = spec.pace || 1;
  const shots: Shot[] = [];
  let start = 0;
  for (const s of spec.scenes) {
    const all = variantsOf(s.kind);
    const variant = all.find((v) => v.id === s.variant) ?? all[0];
    if (!variant) continue;
    const d = variant.dur(s.content) / pace;
    shots.push({ kind: s.kind, variant, start, d });
    start += d;
  }
  const contents = spec.scenes.filter((s) => variantsOf(s.kind).length).map((s) => s.content);
  const pick = (i: number) => media[((i % media.length) + media.length) % media.length];
  const frame =
    (at: number): Paint =>
    (ctx, T) => {
      const k = ctx.canvas.width / W;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      look.backdrop(ctx, T);
      let i = shots.findIndex((s) => T < s.start + s.d);
      if (i < 0) i = shots.length - 1;
      const shot = shots[i];
      if (!shot) return;
      const d = shot.d * pace;
      const t = Math.min(d, Math.max(0, (T - shot.start) * pace));
      const env: Env = {
        look,
        feel,
        c,
        brand: spec.brand,
        media: pick,
        T,
        frame: Math.min(d, Math.max(0, (at - shot.start) * pace)),
        out: feel.move(seg(t, d - feel.exit, d)),
        into: shots[i + 1]?.variant.entry ?? null,
      };
      ctx.save();
      shot.variant.draw(ctx, t, d, env, contents[i]);
      ctx.restore();
    };
  return { shots, length: start, blur: feel.blur, frame };
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

export const PACES = [0.9, 1, 1.15];

/** Another take on the same content: a feel, a pace and a variant for each scene. */
export function shuffle(spec: VideoSpec, seed: number): VideoSpec {
  const rnd = seeded(seed * 2654435761);
  const any = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)];
  return {
    ...spec,
    feel: any(FEELS).id,
    pace: any(PACES),
    scenes: spec.scenes.map((s) => ({ ...s, variant: any(variantsOf(s.kind))?.id })),
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
    upper: false,
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

export function cover(
  ctx: CanvasRenderingContext2D,
  src: Media,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const v = src as HTMLVideoElement;
  const i = src as HTMLImageElement;
  const sw = v.videoWidth || i.naturalWidth || src.width;
  const sh = v.videoHeight || i.naturalHeight || src.height;
  if (!sw || !sh || w <= 0 || h <= 0) return;
  const s = Math.max(w / sw, h / sh);
  ctx.drawImage(src, (sw - w / s) / 2, (sh - h / s) / 2, w / s, h / s, x, y, w, h);
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

export function pointer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  down: number,
  alpha = 1,
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  const s = 1.9 * (1 - 0.14 * down);
  ctx.scale(s, s);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 19);
  ctx.lineTo(5, 14.5);
  ctx.lineTo(8.6, 22.5);
  ctx.lineTo(11.6, 21.2);
  ctx.lineTo(8.1, 13.4);
  ctx.lineTo(14.6, 13.4);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#0b0b0d';
  ctx.stroke();
  ctx.restore();
}

/** A screenshot in a window. `chrome` 0 is the bare picture, 1 has the title bar. */
export function card(
  ctx: CanvasRenderingContext2D,
  env: Env,
  b: Box,
  src: Media,
  chrome: number,
  alpha = 1,
  ring = 0,
): void {
  if (alpha <= 0 || b.w < 2) return;
  const c = env.c;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = c.shadow;
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 26;
  path(ctx, b);
  ctx.fillStyle = c.panel;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  path(ctx, b);
  ctx.clip();
  const top = 46 * chrome;
  cover(ctx, src, b.cx - b.w / 2, b.cy - b.h / 2 + top, b.w, b.h - top);
  if (chrome > 0.01) {
    ctx.globalAlpha *= chrome;
    ctx.fillStyle = c.bar;
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
  ctx.strokeStyle = rgba(c.chipInk, 0.12);
  ctx.stroke();
  if (ring > 0) {
    path(ctx, { ...b, w: b.w + 14, h: b.h + 14, r: b.r + 7 });
    ctx.lineWidth = 5;
    ctx.strokeStyle = rgba(c.hot, ring);
    ctx.stroke();
  }
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
    card(ctx, env, b, env.media(into.media), 0, cl(p));
    return;
  }
  ctx.save();
  ctx.globalAlpha *= cl(p);
  path(ctx, b);
  ctx.fillStyle = into.fill === 'hot' ? env.c.hot : env.c.ink;
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
