import {
  type ICElement,
  type ICFilmCast,
  type ICLayerMotion,
  type ICLayout,
  isTexture,
} from './image-constructor-layout.js';
import {
  canvasHeight,
  drawGlow,
  drawLayout,
  glassGlows,
  type ICBox,
  type ICGlow,
  type ICImages,
  layerBox,
} from './image-constructor-render.js';

// Each layer is painted once into its own small canvas. A frame only places those pictures, so
// playback stays smooth and the last frame is the still design, pixel for pixel.

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Where the picture's top left sits on the design. */
  ox: number;
  oy: number;
  box: ICBox;
  /** Lines of text, when the layer is upright text. */
  rows: number;
  /** A chart, which draws itself on from the left whatever the style. */
  chart: boolean;
  /** A filled button, which can catch the light once the design has settled. */
  button: boolean;
}

export interface Track {
  sprite: Sprite;
  e: ICElement;
  /** Seconds after the first layer, at normal pace. */
  start: number;
  /** The box the move turns around: the layer's own, or its group's. */
  pivot: ICBox;
  /** Part of the backdrop, there from the first frame. */
  stage: boolean;
  glass: boolean;
  /** Font size when the layer is text, else 0. */
  size: number;
}

export interface Scene {
  width: number;
  height: number;
  base: HTMLCanvasElement;
  glows: ICGlow[];
  tracks: Track[];
  /** The one button that catches the light. */
  cta: Track | null;
  /** The brand's colors, when the design has a kit. */
  roles?: Record<string, string>;
  /** The person's own words and picture for a film. */
  cast?: ICFilmCast;
  /** What the person set for single layers, by layer id, in place of the style's. */
  motion: Map<string, ICLayerMotion>;
}

interface Pose {
  dx: number;
  dy: number;
  s: number;
  a: number;
  blur: number;
  /** Share of the layer uncovered from the left. 1 is all of it. */
  wipe: number;
}

/** An entrance: how one layer arrives. A style applies it to every layer in reading order. */
export interface Preset {
  id: string;
  name: string;
  blurb: string;
  /** Seconds one layer takes to arrive. */
  dur: number;
  /** Headlines come up line by line out of a mask. */
  lines?: boolean;
  /** A slow push in across the whole video, as a share of the picture's size. */
  push?: number;
  pose: (p: number, unit: number) => Pose;
}

export const clamp = (n: number) => Math.min(1, Math.max(0, n));

/** A CSS cubic-bezier as a function. */
function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const at = (a: number, b: number, t: number) =>
    3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

/** A damped spring's path from 0 to 1, as a plain function of time so any frame can be drawn. */
export function spring(t: number, k: number, d: number): number {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k);
  const z = d / (2 * w0);
  if (z >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const wd = w0 * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
}

// Settles within the layer's own time, with an overshoot too small to read as a bounce.
const settle = (p: number) => (p >= 1 ? 1 : spring(p, 120, 20));
const snap = (p: number) => (p >= 1 ? 1 : spring(p, 200, 21));
export const out = bezier(0.22, 0.61, 0.36, 1);
export const inOut = bezier(0.65, 0, 0.35, 1);
const still: Pose = { dx: 0, dy: 0, s: 1, a: 1, blur: 0, wipe: 1 };

export const PRESETS: Preset[] = [
  {
    id: 'rise',
    name: 'Rise',
    blurb: 'Lines lift out of a mask, the rest floats up.',
    dur: 0.9,
    lines: true,
    pose: (p, u) => ({ ...still, dy: (1 - settle(p)) * u * 4.5, a: out(clamp(p / 0.45)) }),
  },
  {
    id: 'focus',
    name: 'Focus',
    blurb: 'Soft blur pulls into focus with a slow push in.',
    dur: 1.0,
    push: 0.035,
    pose: (p, u) => ({
      ...still,
      s: 1.08 - 0.08 * settle(p),
      blur: (1 - out(p)) * u * 1.3,
      a: out(clamp(p / 0.6)),
    }),
  },
  {
    id: 'reveal',
    name: 'Reveal',
    blurb: 'Each piece wipes on from the left.',
    dur: 0.85,
    lines: true,
    pose: (p, u) => ({ ...still, wipe: inOut(p), dx: -(1 - out(p)) * u * 2, a: clamp(p * 8) }),
  },
  {
    id: 'slide',
    name: 'Slide',
    blurb: 'Layers glide in from the side and settle.',
    dur: 1.0,
    pose: (p, u) => ({ ...still, dx: -(1 - settle(p)) * u * 9, a: out(clamp(p / 0.4)) }),
  },
  {
    id: 'pop',
    name: 'Pop',
    blurb: 'A quick scale with a small overshoot.',
    dur: 0.65,
    pose: (p) => ({ ...still, s: 0.82 + 0.18 * snap(p), a: out(clamp(p / 0.3)) }),
  },
];

const byId = (id: string) => PRESETS.find((p) => p.id === id);

const union = (a: ICBox, b: ICBox): ICBox => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
};

function paintSprite(
  e: ICElement,
  layout: ICLayout,
  images: ICImages,
  width: number,
  height: number,
): Sprite | null {
  const box = layerBox(e, layout, width);
  // Room for shadows, a turned layer's corners and a product's reflection.
  let pad = width * 0.1;
  if (e.rot) pad += (Math.hypot(box.w, box.h) - Math.min(box.w, box.h)) / 2;
  const below = e.t === 'subject' ? box.h : 0;
  const x0 = Math.max(0, Math.floor(box.x - pad));
  const y0 = Math.max(0, Math.floor(box.y - pad));
  const x1 = Math.min(width, Math.ceil(box.x + box.w + pad));
  const y1 = Math.min(height, Math.ceil(box.y + box.h + pad + below));
  if (x1 <= x0 || y1 <= y0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = x1 - x0;
  canvas.height = y1 - y0;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.translate(-x0, -y0);
  const one = { ...layout, els: [e], scene: { ...layout.scene, on: false } };
  drawLayout(ctx, one, images, width, { transparentBg: true, glows: false });
  const rows =
    e.t === 'text' && !e.rot ? Math.max(1, Math.round(box.h / (e.lh * (e.size / 100) * width))) : 0;
  return {
    canvas,
    ox: x0,
    oy: y0,
    box,
    rows,
    chart: e.t === 'art' && !!e.data,
    button: e.t === 'pill' && !!e.fill && !e.rot && (!e.look || e.look === 'offset'),
  };
}

/** Paints every layer once and works out the order they arrive in. */
export function buildScene(layout: ICLayout, images: ICImages, width: number): Scene {
  const height = canvasHeight(layout, width);
  const base = document.createElement('canvas');
  base.width = width;
  base.height = height;
  const bctx = base.getContext('2d');
  if (bctx) {
    // A video has no transparency, so a see-through background is filled.
    bctx.fillStyle = '#000';
    bctx.fillRect(0, 0, width, height);
    drawLayout(bctx, { ...layout, els: [] }, images, width);
  }

  const tracks: Track[] = [];
  const units = new Map<string, { box: ICBox; z: number; members: Track[]; holds: boolean }>();
  layout.els.forEach((e, z) => {
    if (!e.vis) return;
    const sprite = paintSprite(e, layout, images, width, height);
    if (!sprite) return;
    const { box } = sprite;
    const seen =
      Math.max(0, Math.min(width, box.x + box.w) - Math.max(0, box.x)) *
      Math.max(0, Math.min(height, box.y + box.h) - Math.max(0, box.y));
    const stage = isTexture(e) || seen > width * height * 0.6;
    const track: Track = {
      sprite,
      e,
      start: 0,
      pivot: box,
      stage,
      glass: e.t === 'shape' && e.look === 'glass',
      size: e.t === 'text' ? e.size : 0,
    };
    tracks.push(track);
    if (stage) return;
    // A group moves as one.
    const key = e.groupId ?? e.id;
    const unit = units.get(key);
    const holds = e.t === 'shape' || e.t === 'image';
    if (unit) {
      unit.box = union(unit.box, box);
      unit.members.push(track);
      unit.holds ||= holds;
    } else units.set(key, { box, z, members: [track], holds });
  });

  // Reading order: rows from the top, each row left to right.
  const list = [...units.values()].sort((a, b) => a.box.y - b.box.y || a.z - b.z);
  const rows = new Map<(typeof list)[number], number>();
  let row = 0;
  let rowTop = list[0]?.box.y ?? 0;
  for (const u of list) {
    if (u.box.y - rowTop > height * 0.035) {
      row++;
      rowTop = u.box.y;
    }
    rows.set(u, row);
  }
  list.sort((a, b) => (rows.get(a) ?? 0) - (rows.get(b) ?? 0) || a.box.x - b.box.x || a.z - b.z);
  // Many layers share about a second between them, so a busy chart still finishes on time.
  const step = Math.min(0.07, 1 / Math.max(1, list.length));
  const starts = new Map(list.map((u, i) => [u, i * step]));
  const area = (b: ICBox) => b.w * b.h;
  // A card arrives before what sits on it.
  for (const u of [...list].sort((a, b) => area(b.box) - area(a.box))) {
    const cx = u.box.x + u.box.w / 2;
    const cy = u.box.y + u.box.h / 2;
    const card = list
      .filter(
        (c) =>
          c !== u &&
          c.holds &&
          area(c.box) > area(u.box) * 1.5 &&
          cx > c.box.x &&
          cx < c.box.x + c.box.w &&
          cy > c.box.y &&
          cy < c.box.y + c.box.h,
      )
      .sort((a, b) => area(a.box) - area(b.box))[0];
    if (card) starts.set(u, Math.max(starts.get(u) ?? 0, (starts.get(card) ?? 0) + 0.08));
  }
  for (const u of list) {
    for (const t of u.members) {
      t.start = starts.get(u) ?? 0;
      t.pivot = u.box;
    }
  }
  const cta =
    tracks
      .filter((t) => t.sprite.button && !t.stage)
      .sort((a, b) => area(b.sprite.box) - area(a.sprite.box))[0] ?? null;
  return {
    width,
    height,
    base,
    glows: glassGlows(layout, width),
    tracks,
    cta,
    roles: layout.kit?.roles,
    cast: layout.motion?.cast,
    motion: new Map(Object.entries(layout.motion?.layers ?? {})),
  };
}

export interface Timing {
  /** Whole video, in seconds. */
  seconds: number;
  /** Stretches every move: above 1 is calmer, below 1 is snappier. */
  pace: number;
  /** Fades the design out at the end so the video loops cleanly. */
  outro: boolean;
  /** False leaves the cursor to a film that draws its own. */
  cursor?: boolean;
}

/** Seconds of bare backdrop before the first layer moves. */
const LEAD = 0.2;
const OUTRO = 0.5;

/** One layer's turn: when it starts, how long it takes, and which animation it plays. */
export interface Cue {
  start: number;
  dur: number;
  /** An entrance's id, or `draw` for a wipe from the left, or `type` for text typed out. */
  anim: string;
}

/**
 * The cue a style gives a layer, unless the layer has an animation of its own. Every frame and
 * the timeline both read this, so what the timeline shows is what plays.
 */
export function cueOf(scene: Scene, preset: Preset, timing: Timing, track: Track): Cue {
  const { pace } = timing;
  const own = scene.motion.get(track.e.id);
  const anim = own?.anim ?? (track.sprite.chart ? 'draw' : preset.id);
  const base = (byId(anim) ?? preset).dur * pace;
  const dur =
    anim === 'draw'
      ? preset.dur * pace * 1.7
      : anim === 'type'
        ? base * 0.5 + track.sprite.rows * 0.45 * pace
        : base;
  return { start: LEAD + track.start * pace, dur, anim };
}

/** Points the canvas at the scene's own coordinates, with nothing left over from the last draw. */
export function begin(ctx: CanvasRenderingContext2D, scene: Scene): void {
  // A scene painted larger than the canvas stays sharp when a shot moves in. Each side is fitted
  // on its own: a canvas rounded a fraction taller would keep a stale last row of pixels.
  ctx.setTransform(ctx.canvas.width / scene.width, 0, 0, ctx.canvas.height / scene.height, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
}

/** The backdrop alone: background, texture and anything that spans the canvas. */
export function drawStage(ctx: CanvasRenderingContext2D, scene: Scene): void {
  begin(ctx, scene);
  ctx.drawImage(scene.base, 0, 0);
  for (const t of scene.tracks)
    if (t.stage) ctx.drawImage(t.sprite.canvas, t.sprite.ox, t.sprite.oy);
}

/** The design at `t` seconds, each layer where its cue puts it. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  preset: Preset,
  t: number,
  timing: Timing,
  /** A film can hold a layer back, or have it already in place. */
  part?: (track: Track) => 'hide' | 'still' | undefined,
): void {
  const { width, height } = scene;
  const unit = width / 100;
  const { pace } = timing;
  const leave = timing.outro ? inOut(clamp((t - (timing.seconds - OUTRO - 0.1)) / OUTRO)) : 0;
  begin(ctx, scene);
  const push = 1 + (preset.push ?? 0) * clamp(t / timing.seconds);
  ctx.translate(width / 2, height / 2);
  ctx.scale(push, push);
  ctx.translate(-width / 2, -height / 2);
  ctx.drawImage(scene.base, 0, 0);
  let glows = scene.glows;
  // The moment the last layer has landed.
  let settled = 0;
  for (const track of scene.tracks) {
    if (track.stage) continue;
    const c = cueOf(scene, preset, timing, track);
    settled = Math.max(settled, c.start + c.dur);
  }
  // What each layer does after that, one after another in the order they are stacked.
  const acts = scene.tracks
    .filter((track) => !track.stage && effectOf(scene, track) !== 'none')
    .map((track) => ({ track, kind: effectOf(scene, track), at: settled + 0.35 * pace }));
  // Everything that shines or pulses does so together, as one item. A cursor then presses
  // whatever it is to press, one after another.
  const clicks = timing.cursor === false ? [] : acts.filter((a) => a.kind === 'click');
  const lead = acts.some((a) => a.kind !== 'click') ? 0.7 : 0;
  clicks.forEach((click, n) => {
    click.at += (lead + n * 0.7) * pace;
  });
  for (const track of scene.tracks) {
    const { sprite, pivot } = track;
    if (track.stage) {
      ctx.drawImage(sprite.canvas, sprite.ox, sprite.oy);
      continue;
    }
    const say = part?.(track);
    if (say === 'hide') continue;
    const cue = cueOf(scene, preset, timing, track);
    const at = say === 'still' ? 99 : t - cue.start;
    const p = clamp(at / cue.dur);
    if (p <= 0) continue;
    const own = byId(cue.anim) ?? preset;
    const pose =
      p >= 1 ? still : cue.anim === 'draw' ? { ...still, wipe: inOut(p) } : own.pose(p, unit);
    const alpha = pose.a * (1 - leave);
    // The light goes under the first glass card, as in the still design.
    if (glows.length && track.glass) {
      ctx.globalAlpha = alpha;
      for (const g of glows) drawGlow(ctx, g);
      glows = [];
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, -leave * unit * 2);
    if (cue.anim === 'type' && sprite.rows && p < 1) {
      drawTyped(ctx, sprite, p, track.e.t === 'text' ? track.e.color : '#ffffff');
      ctx.restore();
      continue;
    }
    if (cue.anim !== 'draw' && own.lines && sprite.rows && p < 1 + sprite.rows * 0.12) {
      drawLines(ctx, sprite, at, cue.dur, pace, 1 - leave);
      ctx.restore();
      continue;
    }
    const act = acts.find((a) => a.track === track);
    const turn = act ? (t - act.at) / (0.75 * pace) : -1;
    // A pulse swells once. A click dips as the cursor presses, a little after it arrives.
    const beat =
      act?.kind === 'pulse'
        ? 1 + 0.06 * Math.sin(Math.PI * clamp(turn))
        : clicks.includes(act as (typeof acts)[number])
          ? 1 - 0.04 * press(t - (act?.at ?? 0) - CLICK_AFTER * pace)
          : 1;
    const cx = pivot.x + pivot.w / 2;
    const cy = pivot.y + pivot.h / 2;
    ctx.translate(cx + pose.dx, cy + pose.dy);
    ctx.scale(pose.s * beat, pose.s * beat);
    ctx.translate(-cx, -cy);
    if (pose.blur > 0.3) ctx.filter = `blur(${pose.blur.toFixed(2)}px)`;
    if (pose.wipe < 1) {
      const pad = unit * 4;
      ctx.beginPath();
      ctx.rect(pivot.x - pad, pivot.y - pad, (pivot.w + pad * 2) * pose.wipe, pivot.h + pad * 2);
      ctx.clip();
    }
    if (act?.kind === 'shine' && turn > 0 && turn < 1)
      ctx.drawImage(lit(sprite, turn), sprite.ox, sprite.oy);
    else ctx.drawImage(sprite.canvas, sprite.ox, sprite.oy);
    ctx.restore();
  }
  if (!clicks.length || t < clicks[0].at) return;
  // One cursor comes in from below and visits each layer it is to press, in turn.
  const spot = (track: Track) => ({
    x: track.sprite.box.x + track.sprite.box.w * 0.62,
    y: track.sprite.box.y + track.sprite.box.h * 0.6,
  });
  const cursor = { x: width * 0.8, y: height + unit * 8 };
  let from = { ...cursor };
  let pressed = 0;
  for (const click of clicks) {
    const to = spot(click.track);
    const p = spring((t - click.at) / pace, 62, 15);
    cursor.x += (to.x - from.x) * p;
    cursor.y += (to.y - from.y) * p;
    from = to;
    const since = t - click.at - CLICK_AFTER * pace;
    pressed = Math.max(pressed, press(since));
    const ring = clamp(since / 0.5);
    if (since > 0 && ring < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - ring) * 0.55 * (1 - leave);
      ctx.lineWidth = unit * 0.35;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(to.x, to.y, unit * (1 + 6 * out(ring)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1 - leave;
  drawCursor(ctx, cursor.x, cursor.y, unit * 3.6, pressed);
  ctx.globalAlpha = 1;
}

/** Seconds from a cursor setting off to its press, at normal pace. */
const CLICK_AFTER = 0.85;

/** A quick press and release. */
export const press = (t: number) => (t <= 0 || t >= 0.24 ? 0 : Math.sin((Math.PI * t) / 0.24));

/** What a layer does once the design has settled; see `ICLayerMotion.after`. */
export const effectOf = (scene: Scene, track: Track): string =>
  scene.motion.get(track.e.id)?.after ?? (track === scene.cta ? 'shine' : 'none');

/** An arrow cursor with its tip at the point, a little smaller while it presses. */
export function drawCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  pressed: number,
): void {
  const s = (size / 20) * (1 - 0.16 * pressed);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  for (const [px, py] of [
    [0, 0],
    [0, 17],
    [4.6, 13],
    [7.6, 20],
    [10.2, 18.9],
    [7.3, 12],
    [13, 12],
  ]) {
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = size * 0.4;
  ctx.shadowOffsetY = size * 0.12;
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111111';
  ctx.stroke();
  ctx.restore();
}

let lamp: HTMLCanvasElement | null = null;

/** The button with a soft band of light partway across it. */
function lit(sprite: Sprite, p: number): HTMLCanvasElement {
  lamp ??= document.createElement('canvas');
  const { canvas, box, ox, oy } = sprite;
  lamp.width = canvas.width;
  lamp.height = canvas.height;
  const ctx = lamp.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(canvas, 0, 0);
  // Only where the button is already painted.
  ctx.globalCompositeOperation = 'source-atop';
  const band = box.h * 1.6;
  const x = box.x - ox - band + (box.w + band * 2) * inOut(p);
  const light = ctx.createLinearGradient(x - band / 2, 0, x + band / 2, box.h * 0.35);
  light.addColorStop(0, 'rgba(255,255,255,0)');
  light.addColorStop(0.5, 'rgba(255,255,255,0.38)');
  light.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = light;
  ctx.fillRect(box.x - ox, box.y - oy, box.w, box.h);
  return lamp;
}

/** A headline line by line: each row slides up from behind its own bottom edge. */
function drawLines(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  at: number,
  dur: number,
  pace: number,
  alpha: number,
): void {
  const { canvas, ox, oy, box, rows } = sprite;
  const lineH = box.h / rows;
  for (let i = 0; i < rows; i++) {
    const p = clamp((at - i * 0.09 * pace) / dur);
    if (p <= 0) continue;
    // The first and last rows take the picture's spare room above and below.
    const top = i === 0 ? oy : box.y + i * lineH;
    const bottom = i === rows - 1 ? oy + canvas.height : box.y + (i + 1) * lineH;
    ctx.save();
    ctx.globalAlpha = alpha * clamp(p * 4);
    if (p < 1) {
      ctx.beginPath();
      ctx.rect(ox, top, canvas.width, box.y + (i + 1) * lineH + lineH * 0.1 - top);
      ctx.clip();
    }
    const rise = (1 - settle(p)) * lineH * 1.1;
    ctx.drawImage(
      canvas,
      0,
      top - oy,
      canvas.width,
      bottom - top,
      ox,
      top + rise,
      canvas.width,
      bottom - top,
    );
    ctx.restore();
  }
}

/** Text typed out: each row uncovers in steps from the left, with a caret at the edge. */
function drawTyped(ctx: CanvasRenderingContext2D, sprite: Sprite, p: number, color: string): void {
  const { canvas, ox, oy, box, rows } = sprite;
  const lineH = box.h / rows;
  for (let i = 0; i < rows; i++) {
    const shown = Math.floor(clamp(p * rows - i) * 22) / 22;
    if (shown <= 0) continue;
    const top = i === 0 ? oy : box.y + i * lineH;
    const bottom = i === rows - 1 ? oy + canvas.height : box.y + (i + 1) * lineH;
    const edge = shown >= 1 ? ox + canvas.width : box.x + box.w * shown;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, top, edge - ox, bottom - top);
    ctx.clip();
    ctx.drawImage(canvas, ox, oy);
    ctx.restore();
    if (shown < 1) {
      ctx.fillStyle = color;
      ctx.fillRect(
        edge + lineH * 0.06,
        box.y + i * lineH + lineH * 0.12,
        lineH * 0.07,
        lineH * 0.76,
      );
    }
  }
}

/** How much larger than the output a scene is painted, so a film's close shots stay sharp. */
export const SHARP = 1.6;

export type Paint = (ctx: CanvasRenderingContext2D, t: number) => void;

/**
 * One frame with motion blur: a few moments from while the shutter is open, averaged. `scratch`
 * is a spare canvas the size of the output.
 */
export function drawBlurred(
  ctx: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  paint: Paint,
  t: number,
  fps: number,
  samples = 5,
): void {
  const sctx = scratch.getContext('2d');
  if (!sctx) return;
  for (let i = 0; i < samples; i++) {
    // Half of the frame's time, like a film camera's shutter.
    paint(sctx, Math.max(0, t + ((i / (samples - 1) - 0.5) * 0.5) / fps));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1 / (i + 1);
    ctx.drawImage(scratch, 0, 0);
  }
  ctx.globalAlpha = 1;
}
