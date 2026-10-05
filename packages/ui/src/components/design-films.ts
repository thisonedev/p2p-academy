import { IC_FONT_STACKS, isFixedWeight } from './design-font-list.js';
import { loadFonts } from './design-fonts.js';
import {
  IC_OUTPUT_SIZE,
  type ICClip,
  type ICFilmCast,
  type ICLayerMotion,
  type ICLayout,
  type ICMotion,
  RATIO_DIMENSIONS,
} from './design-layout.js';
import {
  begin,
  buildScene,
  clamp,
  drawBlurred,
  drawCursor,
  drawFrame,
  drawStage,
  effectOf,
  inOut,
  out,
  type Paint,
  PRESETS,
  type Preset,
  press,
  type Scene,
  SHARP,
  spring,
  type Timing,
  type Track,
} from './design-motion.js';
import { encodeMp4 } from './design-mp4.js';
import { withAlpha } from './design-palettes.js';
import { canvasHeight, type ICBox, loadImages } from './design-render.js';

// A film is a short directed sequence made from the design's own words, button, picture and
// colors. It always ends on the finished design.

type Ctx = CanvasRenderingContext2D & { letterSpacing: string };

export interface Film {
  id: string;
  name: string;
  blurb: string;
  length: (scene: Scene) => number;
  /** When the film's own shots end, and the entrance the design's layers then use. */
  land: (scene: Scene) => number;
  lands: string;
  /** What of its content the person can set, in the order the film shows it. */
  fields: (keyof ICFilmCast)[];
  draw: (ctx: CanvasRenderingContext2D, scene: Scene, t: number) => void;
}

/** One beat at 120 beats a minute. Cuts and hits sit on this grid. */
const B = 0.5;

interface Face {
  family: string;
  weight: number;
  italic: boolean;
  track: number;
}

interface Cast {
  words: string[];
  face: Face;
  kicker: string | null;
  /** The button's label, or a stand-in when the design has no button. */
  label: string;
  /** What the Terminal film types at its prompt. */
  command: string;
  cta: Track | null;
  headline: Track | null;
  picture: Track[];
  pictureBox: ICBox | null;
  ink: string;
  accent: string;
  onAccent: string;
}

const casts = new WeakMap<Scene, Cast>();

/** A film's words and picture: the person's own where they gave any, else read from the design. */
function castOf(scene: Scene): Cast {
  const known = casts.get(scene);
  if (known) return known;
  const cast = readCast(scene, scene.cast ?? {});
  casts.set(scene, cast);
  return cast;
}

const grounds = new WeakMap<Scene, string>();

/** The backdrop's color at its corner, read once a scene: reading pixels back is slow. */
function groundOf(scene: Scene): string {
  const known = grounds.get(scene);
  if (known) return known;
  const px = scene.base.getContext('2d')?.getImageData(4, 4, 1, 1).data;
  const color = px
    ? `#${[px[0], px[1], px[2]].map((n) => n.toString(16).padStart(2, '0')).join('')}`
    : '#000000';
  grounds.set(scene, color);
  return color;
}

function readCast(scene: Scene, own: ICFilmCast): Cast {
  const live = scene.tracks.filter((t) => !t.stage);
  const texts = live.filter((t) => t.e.t === 'text');
  // The layer the template calls its headline, or failing that its largest words. The largest
  // alone can be a product's name set big, which is not what the design says.
  const named = (role: string) => texts.find((t) => t.e.t === 'text' && t.e.role === role);
  const headline =
    named('headline') ?? named('title') ?? [...texts].sort((a, b) => b.size - a.size)[0] ?? null;
  const he = headline?.e.t === 'text' ? headline.e : null;
  const hb = headline?.sprite.box;
  const above = texts
    .filter(
      (t) =>
        t !== headline && hb && t.sprite.box.y < hb.y && hb.y - t.sprite.box.y < scene.height * 0.2,
    )
    .sort((a, b) => b.sprite.box.y - a.sprite.box.y)[0];
  const eyebrow =
    texts.find((t) => t !== headline && t.e.t === 'text' && t.e.role === 'eyebrow') ?? above;
  const groups = new Map<ICBox, Track[]>();
  for (const t of live) groups.set(t.pivot, [...(groups.get(t.pivot) ?? []), t]);
  const area = (b: ICBox) => b.w * b.h;
  const picture = [...groups.entries()]
    .filter(
      ([box, members]) =>
        members.every((m) => m.e.t !== 'text' && m.e.t !== 'pill') &&
        area(box) > scene.width * scene.height * 0.04,
    )
    .sort((a, b) => area(b[0]) - area(a[0]))[0];
  // The picture is everything sitting on its largest piece, so a card keeps what is on it.
  const chosen = live.find((t) => t.e.id === own.picture);
  const stageBox = chosen?.pivot ?? picture?.[0];
  const inside = (b: ICBox, o: ICBox) =>
    b.x + b.w / 2 > o.x &&
    b.x + b.w / 2 < o.x + o.w &&
    b.y + b.h / 2 > o.y &&
    b.y + b.h / 2 < o.y + o.h;
  const hero =
    stageBox && !(hb && inside(hb, stageBox))
      ? live.filter((t) => t !== headline && inside(t.sprite.box, stageBox))
      : [];
  const cta = scene.cta;
  const pill = cta?.e.t === 'pill' ? cta.e : null;
  const bg = groundOf(scene);
  const ink = he?.color ?? scene.roles?.ink ?? '#ffffff';
  const accent = pill?.fill || scene.roles?.accent || ink;
  const read = eyebrow?.e.t === 'text' ? eyebrow.e.text.replace(/\s+/g, ' ').trim() : null;
  // The main button's words, or any badge's, before falling back to the kicker.
  const badge = live.find((t) => t.e.t === 'pill')?.e;
  const label =
    own.label?.trim() || pill?.text || (badge?.t === 'pill' ? badge.text : '') || read || 'New';
  const cast: Cast = {
    words: (own.headline?.trim() || he?.text || 'Hello').split(/\s+/).filter(Boolean),
    face: he
      ? {
          family: IC_FONT_STACKS[he.font],
          weight: isFixedWeight(he.font) ? 400 : he.weight,
          italic: !!he.italic,
          track: he.track,
        }
      : { family: 'Inter, sans-serif', weight: 700, italic: false, track: 0 },
    kicker: own.kicker?.trim() || read,
    label,
    command: own.command?.trim() || `launch "${label.toLowerCase()}"`,
    cta,
    headline,
    picture: hero,
    pictureBox: hero.length ? stageBox : null,
    ink,
    accent,
    onAccent: pill?.color || scene.roles?.onAccent || bg,
  };
  return cast;
}

/** What a multi-slide video takes from the design: its main words, colors and headline face. */
export interface DesignCast {
  headline: string;
  kicker: string | null;
  ground: string;
  ink: string;
  accent: string;
  onAccent: string;
  family: string;
  weight: number;
  /** Letter spacing in em. */
  track: number;
}

export function designCast(scene: Scene): DesignCast {
  const c = castOf(scene);
  return {
    headline: c.words.join(' '),
    kicker: c.kicker,
    ground: groundOf(scene),
    ink: c.ink,
    accent: c.accent,
    onAccent: c.onAccent,
    family: c.face.family,
    weight: c.face.weight,
    track: c.face.track,
  };
}

/** A hundredth of the width, larger on tall canvases so a story's shots fill the frame. */
const unit = (s: Scene) => (s.width / 100) * (s.height > s.width * 1.2 ? 1.45 : 1);
/** A color at an opacity. Anything that is not a hex color is left as it is. */
const tint = (color: string, a: number) => (color.startsWith('#') ? withAlpha(color, a) : color);
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

function setFace(ctx: Ctx, face: Face, px: number, weight = face.weight): void {
  ctx.font = `${face.italic ? 'italic ' : ''}${weight} ${px}px ${face.family}`;
  ctx.letterSpacing = `${face.track * px}px`;
}

/** Breaks words into lines no wider than `max`. */
function wrap(ctx: Ctx, words: string[], max: number): { text: string; width: number }[][] {
  const space = ctx.measureText(' ').width;
  const lines: { text: string; width: number }[][] = [[]];
  let used = 0;
  for (const text of words) {
    const width = ctx.measureText(text).width;
    const line = lines[lines.length - 1];
    if (line.length && used + space + width > max) {
      lines.push([{ text, width }]);
      used = width;
    } else {
      used += (line.length ? space : 0) + width;
      line.push({ text, width });
    }
  }
  return lines;
}

const lineWidth = (ctx: Ctx, line: { width: number }[]) =>
  line.reduce((n, w) => n + w.width, 0) + ctx.measureText(' ').width * (line.length - 1);

/** The largest size, from `top` down, at which the words fit the box. */
function fitBlock(ctx: Ctx, face: Face, words: string[], maxW: number, maxH: number, top: number) {
  let px = top;
  for (;;) {
    setFace(ctx, face, px);
    const lines = wrap(ctx, words, maxW);
    const wide = Math.max(...lines.map((l) => lineWidth(ctx, l)));
    if ((lines.length * px * 1.12 <= maxH && wide <= maxW) || px < top * 0.3)
      return { px, lines, wide };
    px *= 0.93;
  }
}

const resolve = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];
const LAND = { seconds: 99, pace: 0.85, outro: false };

// Kinetic: one word a beat, as large as the frame allows.

function beats(words: string[]): string[] {
  const size = Math.ceil(words.length / 7);
  const groups: string[] = [];
  for (let i = 0; i < words.length; i += size) groups.push(words.slice(i, i + size).join(' '));
  return groups;
}

const kineticEnd = (scene: Scene) => 0.3 + (beats(castOf(scene).words).length + 1) * B;

function kinetic(raw: CanvasRenderingContext2D, scene: Scene, t: number): void {
  const ctx = raw as Ctx;
  const c = castOf(scene);
  const { width: W, height: H } = scene;
  const list = beats(c.words);
  const end = kineticEnd(scene);
  const landing = end + 0.25;
  if (t >= landing) drawFrame(ctx, scene, resolve('pop'), t - landing, LAND);
  else drawStage(ctx, scene);
  begin(ctx, scene);
  const from = (i: number) => 0.3 + i * B;
  // The last word holds for two beats.
  const until = (i: number) => (i === list.length - 1 ? end : from(i + 1));
  const flood = (enter: number, leave: number) => {
    const top = H * (1 - inOut(seg(t, enter, enter + 0.22)));
    const bottom = H * (1 - inOut(seg(t, leave, leave + 0.26)));
    if (bottom > top) {
      ctx.fillStyle = c.accent;
      ctx.fillRect(0, top, W, bottom - top);
    }
  };
  for (let i = 2; i < list.length; i += 3) flood(from(i), until(i));
  list.forEach((word, i) => {
    const at = t - from(i);
    const gone = seg(t, until(i) - 0.1, until(i) + 0.06);
    if (at <= 0 || gone >= 1) return;
    const last = i === list.length - 1;
    const kind = i % 3;
    setFace(ctx, c.face, 100);
    const px = Math.min((W * 0.8 * 100) / ctx.measureText(word).width, H * 0.3, W * 0.3);
    setFace(ctx, c.face, px);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hit = spring(at, 260, 24);
    let scale =
      (kind === 0 ? 1.5 - 0.5 * hit : kind === 2 ? 0.72 + 0.28 * hit : 1) * (1 + 0.035 * at);
    let dy = kind === 1 ? (1 - spring(at, 220, 24)) * px * 1.05 : 0;
    dy -= gone * px * 0.6;
    scale *= 1 + gone * 0.05;
    ctx.save();
    if (kind === 1 && !gone) {
      ctx.beginPath();
      ctx.rect(0, H / 2 - px * 0.7, W, px * 1.3);
      ctx.clip();
    }
    ctx.globalAlpha = clamp(at / 0.07) * (1 - gone);
    ctx.translate(W / 2, H / 2 + dy);
    ctx.scale(scale, scale);
    ctx.fillStyle = kind === 2 ? c.onAccent : last ? c.accent : c.ink;
    ctx.fillText(word, 0, 0);
    ctx.restore();
  });
  // A sweep of the accent color covers the cut to the design.
  flood(end - 0.05, end + 0.26);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

// Cursor: a single accent shape becomes each thing in turn, and a cursor drives it.

interface Shape {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

/** A value that changes target several times: one spring per change, added up. */
function ride<T extends Record<string, number>>(
  keys: [number, T][],
  t: number,
  k = 170,
  d = 24,
): T {
  const now = { ...keys[0][1] } as Record<string, number>;
  for (let i = 1; i < keys.length; i++) {
    const p = spring(t - keys[i][0], k, d);
    for (const key in now) now[key] += (keys[i][1][key] - keys[i - 1][1][key]) * p;
  }
  return now as T;
}

const SHAPE_LAND = 5.45;

function oneShape(raw: CanvasRenderingContext2D, scene: Scene, t: number): void {
  const ctx = raw as Ctx;
  const c = castOf(scene);
  const { width: W, height: H } = scene;
  const u = unit(scene);
  const land = SHAPE_LAND;
  if (t >= land) {
    // This film has a cursor of its own.
    drawFrame(ctx, scene, resolve('rise'), t - land, { ...LAND, cursor: false }, (track) =>
      track === c.cta ? (t < land + 0.5 ? 'hide' : 'still') : undefined,
    );
  } else drawStage(ctx, scene);
  begin(ctx, scene);

  const labelPx = u * 3.4;
  setFace(ctx, c.face, labelPx, 600);
  const pillW = ctx.measureText(c.label).width + u * 8;
  const head = fitBlock(ctx, c.face, c.words, Math.min(W * 0.74, H * 0.9), H * 0.4, u * 8.5);
  const cardW = head.wide + u * 11;
  const cardH = head.lines.length * head.px * 1.12 + u * 9;
  const cb = c.cta?.sprite.box;
  const pill = c.cta?.e.t === 'pill' ? c.cta.e : null;
  const hb = c.headline?.sprite.box;
  const home: Shape = cb
    ? {
        x: cb.x + cb.w / 2,
        y: cb.y + cb.h / 2,
        w: cb.w,
        h: cb.h,
        r: pill?.radius === undefined ? cb.h / 2 : (pill.radius / 100) * W,
      }
    : { x: hb?.x ?? W / 2, y: hb ? hb.y + hb.h / 2 : H / 2, w: 0, h: 0, r: 0 };
  const mid = { x: W / 2, y: H / 2 };
  const shape = ride<Shape & Record<string, number>>(
    [
      [0, { ...mid, w: u * 3.6, h: u * 3.6, r: u * 1.8 }],
      [0.8, { ...mid, w: pillW, h: u * 8.4, r: u * 4.2 }],
      [2.15, { ...mid, w: Math.min(W * 0.5, u * 46), h: u * 1.6, r: u * 0.8 }],
      [3.1, { ...mid, w: cardW, h: cardH, r: u * 3.4 }],
      [4.9, { ...mid, w: W * 1.3, h: H * 1.3, r: 0 }],
      [land, { ...home }],
    ],
    t,
  );
  // The last press lands on the layer the person chose for it, or else on the button.
  const goal = (scene.tracks.find((x) => effectOf(scene, x) === 'click') ?? c.cta)?.sprite.box;
  const clicks = [2.0, 4.75, ...(goal ? [land + 2.2] : [])];
  const down = Math.max(...clicks.map((at) => press(t - at)));
  const born = spring(t - 0.2, 260, 20) * (1 - 0.035 * down);
  const w = Math.max(0, shape.w * born);
  const h = Math.max(0, shape.h * born);
  const path = () => {
    ctx.beginPath();
    ctx.roundRect(
      shape.x - w / 2,
      shape.y - h / 2,
      w,
      h,
      Math.max(0, Math.min(shape.r, w / 2, h / 2)),
    );
  };
  const fade = 1 - seg(t, land + 0.45, land + 0.6);
  if (w > 0.5 && fade > 0) {
    ctx.save();
    ctx.globalAlpha = fade;
    // As a loader the shape empties, then fills with the accent again.
    const full =
      t < 2.12 || t > 3.02
        ? 1
        : t < 2.34
          ? 1 - inOut(seg(t, 2.12, 2.32))
          : inOut(seg(t, 2.36, 3.0));
    path();
    if (full < 1) {
      ctx.fillStyle = tint(c.ink, 0.16);
      ctx.fill();
    }
    ctx.clip();
    ctx.fillStyle = c.accent;
    ctx.fillRect(shape.x - w / 2, shape.y - h / 2, w * full, h);
    ctx.restore();
  }

  // The button's label types itself, then clears before the shape changes.
  const typed = Math.floor(seg(t, 1.0, 1.5) * c.label.length);
  const labelOut = seg(t, 2.04, 2.16);
  if (typed > 0 && labelOut < 1) {
    setFace(ctx, c.face, labelPx, 600);
    ctx.save();
    ctx.globalAlpha = 1 - labelOut;
    ctx.fillStyle = c.onAccent;
    ctx.textBaseline = 'middle';
    ctx.fillText(
      c.label.slice(0, typed),
      shape.x - ctx.measureText(c.label).width / 2,
      shape.y + labelPx * 0.04,
    );
    ctx.restore();
  }

  // The headline rides the card: in after the card starts to open, out before it floods.
  const headOut = seg(t, 4.76, 4.9);
  if (t > 3.25 && headOut < 1) {
    setFace(ctx, c.face, head.px);
    ctx.textBaseline = 'alphabetic';
    const lh = head.px * 1.12;
    const top = shape.y - (head.lines.length * lh) / 2;
    head.lines.forEach((line, i) => {
      const at = t - 3.3 - i * 0.09;
      if (at <= 0) return;
      const text = line.map((x) => x.text).join(' ');
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, top + i * lh - lh * 0.1, W, lh * 1.18);
      ctx.clip();
      ctx.globalAlpha = 1 - headOut;
      if (headOut > 0) ctx.filter = `blur(${(headOut * u).toFixed(2)}px)`;
      ctx.fillStyle = c.onAccent;
      ctx.fillText(
        text,
        shape.x - head.wide / 2,
        top + i * lh + head.px * 0.92 + (1 - spring(at, 200, 24)) * lh * 1.1,
      );
      ctx.restore();
    });
  }

  for (const at of clicks) {
    const ring = seg(t, at, at + 0.5);
    if (ring <= 0 || ring >= 1) continue;
    ctx.save();
    ctx.globalAlpha = (1 - ring) * 0.55;
    ctx.lineWidth = u * 0.35;
    ctx.strokeStyle = at > land ? c.accent : c.onAccent;
    ctx.beginPath();
    ctx.arc(cursorAt(at).x, cursorAt(at).y, u * (1 + 6 * out(ring)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  function cursorAt(at: number) {
    return ride(
      [
        [0, { x: W * 0.8, y: H + u * 8 }],
        [1.2, { x: mid.x + pillW * 0.2, y: mid.y + u * 1.2 }],
        [2.25, { x: mid.x + Math.min(u * 26, W * 0.3), y: mid.y + u * 15 }],
        [3.95, { x: mid.x + cardW * 0.18, y: mid.y + cardH * 0.14 }],
        [5.1, { x: W * 0.74, y: Math.min(H - u * 8, mid.y + H * 0.3) }],
        ...(goal
          ? [
              [land + 1.45, { x: goal.x + goal.w * 0.62, y: goal.y + goal.h * 0.6 }] as [
                number,
                { x: number; y: number },
              ],
            ]
          : []),
      ],
      at,
      62,
      15,
    );
  }
  const cursor = cursorAt(t);
  drawCursor(ctx, cursor.x, cursor.y, u * 3.6, down);
  ctx.textBaseline = 'alphabetic';
}

// Spotlight: one idea a shot, centered, with room to breathe.

function spotlightPlan(scene: Scene) {
  const c = castOf(scene);
  const headAt = c.kicker ? 1.75 : 0.3;
  const headEnd = headAt + Math.max(2.2, c.words.length * 0.085 + 1.75);
  const heroAt = c.picture.length ? headEnd - 0.1 : -1;
  const home = heroAt < 0 ? headEnd : heroAt + 1.9;
  return { headAt, headEnd, heroAt, home, land: home - 0.15 };
}

function spotlight(raw: CanvasRenderingContext2D, scene: Scene, t: number): void {
  const ctx = raw as Ctx;
  const c = castOf(scene);
  const { width: W, height: H } = scene;
  const u = unit(scene);
  const plan = spotlightPlan(scene);
  const hero = new Set(c.picture);
  if (t >= plan.land) {
    drawFrame(ctx, scene, resolve('focus'), t - plan.land, LAND, (track) =>
      hero.has(track) ? (t < plan.home + 0.8 ? 'hide' : 'still') : undefined,
    );
  } else drawStage(ctx, scene);
  begin(ctx, scene);

  if (c.kicker && t < plan.headAt + 0.1) {
    const at = t - 0.25;
    const gone = seg(t, plan.headAt - 0.3, plan.headAt);
    const px = u * 2.7;
    const spread = (0.62 - 0.4 * out(clamp(at / 1.0))) * px;
    const text = c.kicker.toUpperCase();
    ctx.save();
    ctx.font = `600 ${px}px ${c.face.family}`;
    ctx.letterSpacing = `${spread}px`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = out(clamp(at / 0.5)) * (1 - gone);
    if (gone > 0) ctx.filter = `blur(${(gone * u).toFixed(2)}px)`;
    ctx.fillStyle = c.accent;
    ctx.fillText(text, W / 2 + spread / 2, H / 2);
    ctx.restore();
  }

  if (t > plan.headAt && t < plan.headEnd) {
    const head = fitBlock(ctx, c.face, c.words, W * 0.78, H * 0.44, u * 9.5);
    const gone = seg(t, plan.headEnd - 0.32, plan.headEnd);
    const grow = 1 + 0.05 * seg(t, plan.headAt, plan.headEnd) + 0.07 * gone;
    const lh = head.px * 1.12;
    const space = ctx.measureText(' ').width;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(grow, grow);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = c.ink;
    let n = 0;
    head.lines.forEach((line, i) => {
      let x = -lineWidth(ctx, line) / 2;
      const y = -(head.lines.length * lh) / 2 + i * lh + head.px * 0.9;
      for (const word of line) {
        const at = t - plan.headAt - 0.05 - n++ * 0.085;
        const a = out(clamp(at / 0.45));
        if (a > 0) {
          const soft = (1 - a) * u * 1.2 + gone * u * 1.4;
          ctx.globalAlpha = a * (1 - gone);
          ctx.filter = soft > 0.3 ? `blur(${soft.toFixed(2)}px)` : 'none';
          ctx.fillText(word.text, x, y + (1 - spring(at, 120, 20)) * head.px * 0.35);
        }
        x += word.width + space;
      }
    });
    ctx.restore();
  }

  const pb = c.pictureBox;
  if (pb && plan.heroAt >= 0 && t > plan.heroAt && t < plan.home + 0.8) {
    const at = t - plan.heroAt;
    const big = Math.min(1.6, (W * 0.74) / pb.w, (H * 0.56) / pb.h);
    const cx = pb.x + pb.w / 2;
    const cy = pb.y + pb.h / 2;
    // It travels from center stage to its own place in the design.
    const go = spring(t - plan.home, 60, 15);
    const scale = (big + (1 - big) * go) * (1 + 0.04 * seg(at, 0, 1.9) * (1 - go));
    const x = W / 2 + (cx - W / 2) * go;
    const y = H / 2 + (cy - H / 2) * go + (1 - spring(at, 120, 20)) * u * 8;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, Math.max(pb.w, pb.h) * scale * 0.75);
    glow.addColorStop(0, tint(c.accent, 0.28));
    glow.addColorStop(1, tint(c.accent, 0));
    ctx.save();
    ctx.globalAlpha = out(clamp(at / 0.35)) * (1 - go);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = out(clamp(at / 0.35));
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    for (const track of c.picture)
      ctx.drawImage(track.sprite.canvas, track.sprite.ox, track.sprite.oy);
    ctx.restore();
  }
}

// Terminal: the announcement ships from a command line.

const TERM_LAND = 4.05;

function terminal(raw: CanvasRenderingContext2D, scene: Scene, t: number): void {
  const ctx = raw as Ctx;
  const c = castOf(scene);
  const { width: W, height: H } = scene;
  const u = unit(scene);
  if (t >= TERM_LAND) drawFrame(ctx, scene, resolve('rise'), t - TERM_LAND, LAND);
  else drawStage(ctx, scene);
  begin(ctx, scene);
  const gone = seg(t, TERM_LAND - 0.12, TERM_LAND + 0.3);
  if (gone >= 1) return;
  const mono = IC_FONT_STACKS['geist-mono'];
  const px = Math.min(u * 3.3, H * 0.052, W * 0.034);
  const lh = px * 1.75;
  const w = Math.min(W * 0.88, px * 36);
  const pad = px * 1.5;
  ctx.font = `500 ${px}px ${mono}`;
  ctx.letterSpacing = '0px';
  const said = wrap(ctx, c.words, w - pad * 2 - px * 1.6).map((l) =>
    l.map((x) => x.text).join(' '),
  );
  const h = pad * 2 + px * 2.4 + lh * (2 + said.length);
  const open = spring(t - 0.15, 200, 22);
  // The window opens, then the camera pushes through it into the design.
  const scale = (0.9 + 0.1 * open) * (1 + 0.3 * inOut(gone));
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  ctx.globalAlpha = clamp((t - 0.15) / 0.2) * (1 - gone);
  if (gone > 0) ctx.filter = `blur(${(gone * u * 1.2).toFixed(2)}px)`;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, px * 0.9);
  ctx.fillStyle = 'rgba(8,9,11,0.82)';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = u * 4;
  ctx.shadowOffsetY = u * 1.2;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(1, u * 0.12);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(pad + i * px * 1.25, pad * 0.95, px * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
  }
  ctx.textBaseline = 'middle';
  let y = pad + px * 2.6;
  const line = (prompt: string, text: string, color: string, shown: number, caret: boolean) => {
    ctx.fillStyle = c.accent;
    ctx.fillText(prompt, pad, y);
    const typed = text.slice(0, Math.floor(shown * text.length));
    ctx.fillStyle = color;
    ctx.fillText(typed, pad + px * 1.6, y);
    if (caret && Math.floor(t * 2.5) % 2 === 0) {
      ctx.fillRect(
        pad + px * 1.6 + ctx.measureText(typed).width + px * 0.15,
        y - px * 0.6,
        px * 0.55,
        px * 1.2,
      );
    }
    y += lh;
  };
  const dim = 'rgba(255,255,255,0.86)';
  line('$', c.command, dim, seg(t, 0.55, 1.45), t < 1.7);
  if (t > 1.75) {
    const done = inOut(seg(t, 1.85, 2.65));
    const cells = 18;
    const bar = '█'.repeat(Math.round(done * cells)) + '░'.repeat(cells - Math.round(done * cells));
    line(
      '▸',
      `${bar} ${String(Math.round(done * 100)).padStart(3, ' ')}%`,
      'rgba(255,255,255,0.55)',
      1,
      false,
    );
  }
  said.forEach((text, i) => {
    const from = 2.75 + i * 0.32;
    if (t > from)
      line(i ? ' ' : '✓', text, c.accent, seg(t, from, from + 0.3), i === said.length - 1);
  });
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

export const FILMS: Film[] = [
  {
    id: 'kinetic',
    name: 'Kinetic',
    blurb: 'The headline hits one word a beat, then cuts to the design.',
    length: (scene) => kineticEnd(scene) + 3.4,
    land: (scene) => kineticEnd(scene) + 0.25,
    lands: 'pop',
    fields: ['headline'],
    draw: kinetic,
  },
  {
    id: 'shape',
    name: 'Cursor',
    blurb: 'A single shape becomes button, loader and card. A cursor drives it.',
    length: (scene) => SHAPE_LAND + (castOf(scene).cta ? 3.4 : 2.6),
    land: () => SHAPE_LAND,
    lands: 'rise',
    fields: ['label', 'headline'],
    draw: oneShape,
  },
  {
    id: 'terminal',
    name: 'Terminal',
    blurb: 'A command line types the launch, then opens onto the design.',
    length: () => TERM_LAND + 3.2,
    land: () => TERM_LAND,
    lands: 'rise',
    fields: ['command', 'headline'],
    draw: terminal,
  },
  {
    id: 'spotlight',
    name: 'Spotlight',
    blurb: 'Keynote pacing: one idea a shot, then everything finds its place.',
    length: (scene) => spotlightPlan(scene).home + 3.2,
    land: (scene) => spotlightPlan(scene).land,
    lands: 'focus',
    fields: ['kicker', 'headline', 'picture'],
    draw: spotlight,
  },
];

// What the studio works with: one flat list of styles, and a design's own motion settings.

export type MotionStyle = Film | Preset;

export const MOTION_STYLES: MotionStyle[] = [...FILMS, ...PRESETS];

export const isFilm = (style: MotionStyle): style is Film => 'draw' in style;

export const motionStyle = (id: string): MotionStyle =>
  MOTION_STYLES.find((s) => s.id === id) ?? MOTION_STYLES[0];

const DEFAULT_MOTION: ICMotion = { style: MOTION_STYLES[0].id, pace: 1 };

/** How long an entrance style runs until the person picks a length. */
const ENTRANCE_SECONDS = 6;

export const motionOf = (layout: ICLayout): ICMotion => layout.motion ?? DEFAULT_MOTION;

const timingOf = (m: ICMotion): Timing => ({
  seconds: m.seconds ?? ENTRANCE_SECONDS,
  pace: m.pace,
  outro: !!m.loop,
});

/**
 * How much faster than written a film plays. A length shorter than the film speeds all of it up
 * to fit, so nothing is cut off. A longer one leaves it as written and holds on the design.
 */
const filmSpeed = (film: Film, scene: Scene, m: ICMotion): number =>
  Math.max(1, film.length(scene) / (m.seconds ?? film.length(scene)));

/** The video's length in seconds: the one picked, or else the style's own. */
export function videoLength(scene: Scene, m: ICMotion): number {
  const style = motionStyle(m.style);
  return m.seconds ?? (isFilm(style) ? style.length(scene) : ENTRANCE_SECONDS);
}

/** The shortest a piece of the video can be, in seconds. */
export const CLIP_MIN = 0.3;

/** The video's pieces in the order they play: one whole piece until the person cuts it. */
export function videoClips(scene: Scene, m: ICMotion): ICClip[] {
  const total = videoLength(scene, m);
  const fit = (n: number) => Math.min(total, Math.max(0, n));
  const own = (m.clips ?? [])
    .map((c) => ({ start: fit(c.start), end: fit(c.end) }))
    .filter((c) => c.end - c.start > 0.05);
  return own.length ? own : [{ start: 0, end: total }];
}

/** How long the pieces run, one after another. */
export const clipsLength = (clips: ICClip[]): number =>
  clips.reduce((n, c) => n + c.end - c.start, 0);

/**
 * What paints the cut video. Asked for the frame at `at`, it gives a painter that stays inside
 * the piece that frame is in, so motion blur never mixes two pieces across a cut.
 */
export function cutPaint(paint: Paint, clips: ICClip[]): (at: number) => Paint {
  return (at) => {
    let base = 0;
    let clip = clips[0];
    for (const c of clips) {
      clip = c;
      if (at < base + c.end - c.start || c === clips[clips.length - 1]) break;
      base += c.end - c.start;
    }
    return (ctx, t) => paint(ctx, Math.min(clip.end, Math.max(clip.start, clip.start + t - base)));
  };
}

/** What paints any frame of the design's video. */
export function videoPaint(scene: Scene, m: ICMotion): Paint {
  const style = motionStyle(m.style);
  if (isFilm(style)) {
    const speed = filmSpeed(style, scene, m);
    return (ctx, t) => style.draw(ctx, scene, t * speed);
  }
  const timing = timingOf(m);
  return (ctx, t) => drawFrame(ctx, scene, style, t, timing);
}

/** When the design's own layers start: after a film's shots, or at once under an entrance. */
export function videoLand(scene: Scene, m: ICMotion): number {
  const style = motionStyle(m.style);
  return isFilm(style) ? style.land(scene) / filmSpeed(style, scene, m) : 0;
}

/** What a film reads from the design when the person has given nothing of their own. */
export function castDefaults(scene: Scene): CastWords {
  const known = defaults.get(scene);
  if (known) return known;
  const read = readCast(scene, {});
  const words = {
    headline: read.words.join(' '),
    label: read.label,
    kicker: read.kicker ?? '',
    command: read.command,
  };
  defaults.set(scene, words);
  return words;
}

type CastWords = Record<'headline' | 'label' | 'kicker' | 'command', string>;
const defaults = new WeakMap<Scene, CastWords>();

/** The one highlight a video has: an effect, and the layer it plays on. */
export interface Highlight {
  /** `click` for a cursor pressing the layer, `shine`, `pulse`, or `none`. */
  effect: string;
  id: string | null;
}

/** The video's highlight. Until the person chooses one, the main button shines. */
export function highlightOf(scene: Scene, m: ICMotion): Highlight {
  const own = Object.entries(m.layers ?? {}).find(([, layer]) => layer.after);
  if (own) return { effect: own[1].after as string, id: own[0] };
  return {
    effect: 'shine',
    id: scene.cta?.e.id ?? scene.tracks.find((t) => !t.stage)?.e.id ?? null,
  };
}

/**
 * Makes one item the video's highlight, in place of whichever was. `ids` are the item's layers,
 * its lead first: a column shines or pulses as a whole, and a cursor presses the lead alone.
 */
export function withHighlight(layout: ICLayout, effect: string, ids: string[]): ICLayout {
  const motion = motionOf(layout);
  const layers: Record<string, ICLayerMotion> = {};
  for (const [id, { after: _, ...rest }] of Object.entries(motion.layers ?? {})) {
    if (Object.keys(rest).length) layers[id] = rest;
  }
  for (const id of effect === 'click' ? ids.slice(0, 1) : ids) {
    layers[id] = { ...layers[id], after: effect };
  }
  return { ...layout, motion: { ...motion, layers } };
}

/** The longest side a video is saved at: 4K. */
const VIDEO_MAX = 3840;

/**
 * The pixel size a design's video is saved at: the size its post type asks for, times `scale`,
 * and no larger than 4K.
 */
export function videoSize(layout: ICLayout, scale = 1): { width: number; height: number } {
  const named =
    layout.ratio === 'custom' ? layout.customSize : RATIO_DIMENSIONS[layout.ratio ?? '1:1'];
  const base = named?.width ?? IC_OUTPUT_SIZE;
  const tall = canvasHeight(layout, base) / base;
  const width = Math.round(Math.min(base * scale, VIDEO_MAX, VIDEO_MAX / tall));
  // H.264 needs even sides.
  return { width: width - (width % 2), height: canvasHeight(layout, width) & ~1 };
}

export interface VideoOptions {
  fps: number;
  /** Scale on the size the post type asks for; see `videoSize`. */
  scale?: number;
  onProgress?: (done: number) => void;
}

/** Draws the design's video frame by frame and returns it as an MP4. Nothing leaves the machine. */
export async function composeVideo(
  layout: ICLayout,
  sceneUrl: string | null,
  opts: VideoOptions,
): Promise<Blob> {
  const [images] = await Promise.all([loadImages(layout, sceneUrl), loadFonts()]);
  const { width, height } = videoSize(layout, opts.scale);
  // At 4K the extra sharpness for close shots costs more memory than it shows.
  const sharp = Math.min(SHARP, Math.max(1, 4096 / width));
  const scene = buildScene(layout, images, Math.round(width * sharp));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const spare = document.createElement('canvas');
  spare.width = width;
  spare.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the design.');
  const m = motionOf(layout);
  const clips = videoClips(scene, m);
  const cut = cutPaint(videoPaint(scene, m), clips);
  return encodeMp4({
    canvas,
    fps: opts.fps,
    seconds: clipsLength(clips),
    draw: (t) => (m.blur === false ? cut(t)(ctx, t) : drawBlurred(ctx, spare, cut(t), t, opts.fps)),
    onProgress: opts.onProgress,
  });
}
