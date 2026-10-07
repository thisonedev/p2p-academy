import {
  type Box,
  blend,
  cl,
  type Env,
  H,
  lerp,
  MID,
  pane,
  panel,
  path,
  pointer,
  press,
  register,
  rgba,
  seg,
  setting,
  stuff,
} from './design-video.js';
import {
  doneDisc,
  entranceOut,
  type InputContent,
  RING,
  room,
  type WorkingContent,
} from './design-video-scenes.js';

// The Setup notification and the two Build-up slides, built once for each look, and a few that go
// with any look. A change of look swaps a slide for that look's own.

type Ctx = CanvasRenderingContext2D;

const mono = (size: number, weight = 500) =>
  `${weight} ${size}px "Geist Mono", ui-monospace, monospace`;
const soft = (env: Env) => rgba(env.c.ink, env.look.dim);

function write(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  color: string,
  align: CanvasTextAlign = 'left',
): void {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/** Text broken to a width in the font already set, cut short with an ellipsis past `most` lines. */
function broken(ctx: Ctx, text: string, max: number, most: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length <= most) return lines;
  const kept = lines.slice(0, most);
  kept[most - 1] = `${kept[most - 1].replace(/[.,;:!?]$/, '')}…`;
  return kept;
}

/** The largest size up to `base` at which the longest of the lines fits `max`. */
function fit(ctx: Ctx, lines: string[], font: (size: number) => string, base: number, max: number) {
  ctx.font = font(base);
  const longest = Math.max(1, ...lines.map((l) => ctx.measureText(l).width));
  return Math.min(base, (base * max) / longest);
}

/** A message set as large as it goes: the largest size from `max` down at which it takes no
 *  more than `most` lines. */
function sized(
  ctx: Ctx,
  text: string,
  font: (size: number) => string,
  max: number,
  min: number,
  width: number,
  most: number,
): { size: number; lines: string[] } {
  let size = max;
  for (; size > min; size *= 0.93) {
    ctx.font = font(size);
    if (broken(ctx, text, width, 99).length <= most) break;
  }
  ctx.font = font(size);
  return { size, lines: broken(ctx, text, width, most) };
}

/** A tick that draws itself on, short stroke first. */
function tick(ctx: Ctx, cx: number, cy: number, r: number, drawn: number, color: string): void {
  if (drawn <= 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.21;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.42, cy + r * 0.04);
  const first = Math.min(1, drawn * 2.2);
  ctx.lineTo(cx - r * 0.42 + r * 0.3 * first, cy + r * 0.04 + r * 0.3 * first);
  if (drawn > 0.45) {
    const rest = (drawn - 0.45) / 0.55;
    ctx.lineTo(cx - r * 0.12 + r * 0.56 * rest, cy + r * 0.34 - r * 0.88 * rest);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

const corner = (b: Box) => ({ left: b.cx - b.w / 2, top: b.cy - b.h / 2 });

// ---------------------------------------------------------------- notification

interface Notice<L extends { b: Box }> {
  id: string;
  name: string;
  /** The one look it is made for. */
  look?: string;
  /** When its sound plays, if not as it comes in. */
  ding?: number;
  lay: (ctx: Ctx, env: Env, c: InputContent) => L;
  /** The color it has as it shrinks into the next slide's shape. */
  fill: (env: Env) => string;
  enter: (ctx: Ctx, env: Env, b: Box, inn: number) => void;
  paint: (ctx: Ctx, env: Env, l: L, c: InputContent, t: number) => void;
}

/** A notification that arrives, is tapped, and turns into the next slide, as the banner does.
 *  Each look has it three ways: its own entrance, dropping from above to the middle, and
 *  dropping in to rest under the top edge as a phone's banner does. */
function notice<L extends { b: Box }>(o: Notice<L>): void {
  noticeAs(o, '', '', false);
  // A look whose own entrance is the drop has no second copy of it.
  if (o.enter !== fromTop) noticeAs({ ...o, enter: fromTop }, '-drop', ' drop', false);
  noticeAs({ ...o, enter: fromTop }, '-banner', ' banner', true);
}

function noticeAs<L extends { b: Box }>(o: Notice<L>, id: string, name: string, top: boolean) {
  register<InputContent>({
    kind: 'input',
    narrow: true,
    id: o.id + id,
    name: o.name + name,
    look: o.look,
    role: o.look && `notice${id}`,
    also: o.look && !id && o.enter === fromTop ? 'notice-drop' : undefined,
    dur: () => 3.75,
    leave: () => 0.75,
    cues: () => [
      { at: o.ding ?? 0.45, sound: 'ding' },
      { at: 2.7, sound: 'click' },
    ],
    draw(ctx, t, d, env, c) {
      const tap = 2.7;
      const leaveAt = tap + 0.3;
      const l = o.lay(ctx, env, c);
      // A banner rests a little under the frame's top edge, which a tall frame has higher up.
      if (top) l.b.cy = 70 - env.tall + l.b.h / 2;
      const note = l.b;
      if (t >= leaveAt && !env.plain) {
        entranceOut(ctx, env, note, t, leaveAt, d, o.fill(env));
        return;
      }
      const inn = env.feel.glide(t - 0.25);
      if (inn <= 0) return;
      const down = 1 - 0.04 * press(t - tap);
      ctx.save();
      o.enter(ctx, env, note, inn);
      ctx.translate(note.cx, note.cy);
      ctx.scale(down, down);
      ctx.translate(-note.cx, -note.cy);
      o.paint(ctx, env, l, c, t);
      ctx.restore();
      const go = env.feel.move(seg(t, 1.8, tap - 0.05));
      pointer(
        ctx,
        env,
        lerp(MID.x + env.wide * 0.31, note.cx + note.w * 0.25, go),
        lerp(960, note.cy + 30, go),
        t - tap,
        seg(t, 1.8, 2.05),
      );
    },
  });
}

const fromTop = (ctx: Ctx, env: Env, b: Box, inn: number) =>
  ctx.translate(0, -(1 - inn) * (b.cy + b.h / 2 + env.tall + 40));

/** Out of soft focus, a little small and a little high. */
function focus(ctx: Ctx, env: Env, b: Box, inn: number): void {
  ctx.globalAlpha *= cl(inn * 1.4);
  const s = lerp(0.9, 1, inn);
  ctx.translate(b.cx, b.cy - (1 - inn) * 50);
  ctx.scale(s, s);
  ctx.translate(-b.cx, -b.cy);
  if (env.feel.blur && inn < 0.98) ctx.filter = `blur(${((1 - cl(inn)) * 18).toFixed(1)}px)`;
}

function rise(ctx: Ctx, _env: Env, _b: Box, inn: number): void {
  ctx.globalAlpha *= cl(inn * 1.4);
  ctx.translate(0, (1 - inn) * 50);
}

const initial = (env: Env) => env.brand.trim().charAt(0).toUpperCase();

notice({
  id: 'note-slab',
  name: 'Notification',
  look: 'block',
  lay(ctx, env, c) {
    const w = room(env, 1400, 100);
    const set = setting(env, 'display', 120);
    const face = (s: number) => setting(env, 'display', s).font;
    const text = set.upper ? c.text.toUpperCase() : c.text;
    const { size, lines } = sized(ctx, text, face, 120, 64, w - 112, 3);
    const h = size * (1.55 + lines.length * 1.13) + 56;
    return { b: { cx: MID.x, cy: MID.y, w, h, r: 16 }, lines, size, font: face(size) };
  },
  fill: (env) => env.c.hot,
  enter: fromTop,
  paint(ctx, env, { b, lines, size, font }) {
    const { left, top } = corner(b);
    path(ctx, b);
    ctx.fillStyle = env.c.hot;
    ctx.fill();
    ctx.font = setting(env, 'text', size * 0.38, 700).font;
    write(ctx, env.brand, left + 56, top + 28 + size * 0.5, env.c.onHot);
    write(ctx, 'now', left + b.w - 56, top + 28 + size * 0.5, rgba(env.c.onHot, 0.6), 'right');
    ctx.font = font;
    lines.forEach((line, i) => {
      write(ctx, line, left + 56, top + 28 + size * (1.62 + i * 1.13), env.c.onHot);
    });
  },
});

/** A notification laid out as a round mark, a name over the message, and the time. It is set out
 *  1180 wide and drawn at `k` times that, so it fills the frame it is in. */
function card(ctx: Ctx, env: Env, c: InputContent): { b: Box; lines: string[]; k: number } {
  const w = room(env, 1560, 100);
  const k = w / 1180;
  ctx.font = setting(env, 'text', 54, 500).font;
  const lines = broken(ctx, c.text, 930, 2);
  const h = (150 + lines.length * 66) * k;
  return { b: { cx: MID.x, cy: MID.y, w, h, r: Math.min(stuff(env).r, h / 2) }, lines, k };
}

function cardText(
  ctx: Ctx,
  env: Env,
  b: Box,
  lines: string[],
  k: number,
  mark: string,
  on: string,
) {
  const { left, top } = corner(b);
  const ink = stuff(env).ink;
  ctx.save();
  ctx.translate(left, top);
  ctx.scale(k, k);
  const mid = b.h / k / 2;
  ctx.beginPath();
  ctx.arc(104, mid, 58, 0, 7);
  ctx.fillStyle = mark;
  ctx.fill();
  ctx.font = setting(env, 'text', 50, 700).font;
  write(ctx, initial(env), 104, mid + 3, on, 'center');
  ctx.font = setting(env, 'text', 36, 600).font;
  write(ctx, env.brand, 196, 66, ink);
  ctx.font = setting(env, 'text', 32, 430).font;
  write(ctx, 'now', 1180 - 54, 66, rgba(ink, env.look.dim), 'right');
  ctx.font = setting(env, 'text', 54, 500).font;
  lines.forEach((line, i) => {
    write(ctx, line, 196, 130 + i * 66, ink);
  });
  ctx.restore();
}

notice({
  id: 'notify',
  name: 'Notification',
  look: 'design',
  lay: card,
  fill: (env) => env.c.panel,
  enter: focus,
  paint(ctx, env, { b, lines, k }) {
    panel(ctx, env, b);
    cardText(ctx, env, b, lines, k, env.c.hot, env.c.onHot);
  },
});

const sheet = (env: Env) =>
  env.look.dark ? blend(env.c.ground, env.c.ink, 0.09) : blend(env.c.ground, '#ffffff', 0.75);

notice({
  id: 'note-paper',
  name: 'Notification',
  look: 'paper',
  lay(ctx, env, c) {
    const w = room(env, 1400, 100);
    const set = setting(env, 'display', 104);
    const face = (s: number) => setting(env, 'display', s).font;
    const text = set.upper ? c.text.toUpperCase() : c.text;
    const { size, lines } = sized(ctx, text, face, 104, 60, w - 144, 3);
    const h = 216 + lines.length * size * 1.14;
    return { b: { cx: MID.x, cy: MID.y, w, h, r: 6 }, lines, size, font: face(size) };
  },
  fill: sheet,
  enter: rise,
  paint(ctx, env, { b, lines, size, font }) {
    const { left, top } = corner(b);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.26)';
    ctx.shadowBlur = 54;
    ctx.shadowOffsetY = 28;
    path(ctx, b);
    ctx.fillStyle = sheet(env);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(left + 82, top + 84, 10, 0, 7);
    ctx.fillStyle = env.c.hot;
    ctx.fill();
    ctx.font = setting(env, 'text', 36, 600).font;
    write(ctx, env.brand, left + 110, top + 86, soft(env));
    ctx.font = setting(env, 'text', 34, 430).font;
    write(ctx, 'now', left + b.w - 72, top + 86, soft(env), 'right');
    ctx.fillStyle = rgba(env.c.ink, 0.12);
    ctx.fillRect(left + 72, top + 130, b.w - 144, 2);
    ctx.font = font;
    lines.forEach((line, i) => {
      write(ctx, line, left + 72, top + 150 + size * 1.14 * (i + 0.5), env.c.ink);
    });
  },
});

notice({
  id: 'note-glass',
  name: 'Notification',
  look: 'glass',
  lay: card,
  fill: (env) => blend(env.c.ground, '#ffffff', 0.2),
  enter: focus,
  paint(ctx, env, { b, lines, k }) {
    pane(ctx, env, b);
    cardText(ctx, env, b, lines, k, env.c.ink, env.c.ground);
  },
});

// ---------------------------------------------------------------- progress

/** The disc the slide before ends on, shrinking away as this one begins. */
function handed(ctx: Ctx, env: Env, t: number): void {
  const a = 1 - seg(t, 0.05, 0.4);
  if (env.plain || a <= 0) return;
  const k = 1 - env.feel.move(seg(t, 0, 0.4));
  path(ctx, { ...RING, w: RING.w * k, h: RING.h * k });
  ctx.fillStyle = rgba(env.dot, a);
  ctx.fill();
}

interface Meter {
  /** 0 to 1, eased. */
  p: number;
  pct: number;
  steps: string[];
  /** The step being worked on. */
  at: number;
  /** The step's name at a point, in the font already set. It swaps as the work moves on. */
  step: (x: number, y: number, color: string, a: number, align?: CanvasTextAlign) => void;
}

function meter(o: {
  id: string;
  name: string;
  look?: string;
  paint: (ctx: Ctx, env: Env, m: Meter) => void;
}): void {
  register<WorkingContent>({
    kind: 'working',
    narrow: true,
    id: o.id,
    name: o.name,
    look: o.look,
    role: o.look && 'meter',
    entry: { box: RING },
    dur: () => 4.4,
    leave: () => 1.9,
    cues: () => [{ at: 2.5, sound: 'success' }],
    draw(ctx, t, _d, env, c) {
      const done = 2.5;
      const p = env.feel.move(seg(t, 0.35, done));
      const steps = c.steps.filter(Boolean);
      const at = Math.max(0, Math.min(steps.length - 1, Math.floor(p * steps.length)));
      const f = p * steps.length - at;
      const inn = 1 - (1 - cl(f / 0.22)) ** 3;
      const step: Meter['step'] = (x, y, color, a, align = 'left') => {
        if (!steps.length) return;
        if (at > 0 && inn < 1)
          write(ctx, steps[at - 1], x, y - 18 * inn, rgba(color, a * (1 - inn)), align);
        write(ctx, steps[at], x, y + (1 - inn) * 18, rgba(color, a * (at ? inn : 1)), align);
      };
      const a = seg(t, 0.1, 0.45) * (1 - seg(t, done, done + 0.25));
      if (a > 0) {
        ctx.save();
        ctx.globalAlpha *= a;
        o.paint(ctx, env, { p, pct: Math.round(p * 100), steps, at, step });
        ctx.restore();
      }
      handed(ctx, env, t);
      doneDisc(ctx, env, t, done, 3.3, 170, c);
    },
  });
}

meter({
  id: 'fill',
  name: 'Progress',
  look: 'block',
  paint(ctx, env, m) {
    // The accent floods the frame from the left, and whatever it passes over turns to its ink.
    const x0 = MID.x - env.wide / 2 - 40;
    const y0 = -env.tall - 40;
    const high = H + env.tall * 2 + 80;
    const number = setting(env, 'display', Math.min(460, env.wide * 0.3)).font;
    const label = setting(env, 'text', 54, 600).font;
    const all = (color: string) => {
      ctx.font = number;
      write(ctx, `${m.pct}%`, MID.x, MID.y, color, 'center');
      ctx.font = label;
      m.step(x0 + 110, H + env.tall - 90, color, 1);
    };
    all(env.c.ink);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, (env.wide + 80) * m.p, high);
    ctx.clip();
    ctx.fillStyle = env.c.hot;
    ctx.fillRect(x0, y0, env.wide + 80, high);
    all(env.c.onHot);
    ctx.restore();
  },
});

/** A large number that counts in place: its digits end at one point, so nothing shifts. */
function count(
  ctx: Ctx,
  env: Env,
  m: Meter,
  font: (size: number) => string,
  size: number,
  cy: number,
) {
  ctx.font = font(size);
  const nw = ctx.measureText('100').width;
  ctx.font = font(size * 0.42);
  const x0 = MID.x - (nw + ctx.measureText('%').width + size * 0.04) / 2;
  write(ctx, '%', x0 + nw + size * 0.04, cy + size * 0.18, soft(env));
  ctx.font = font(size);
  write(ctx, String(m.pct), x0 + nw, cy, env.c.ink, 'right');
}

function bar(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  p: number,
  track: string,
  fill: string,
) {
  ctx.fillStyle = track;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(h, w * p), h, h / 2);
  ctx.fill();
}

meter({
  id: 'ring',
  name: 'Progress',
  look: 'design',
  paint(ctx, env, m) {
    count(ctx, env, m, (s) => setting(env, 'text', s, 600).font, 380, MID.y - 70);
    const w = Math.min(620, env.wide - 200);
    bar(ctx, MID.x - w / 2, MID.y + 166, w, 8, m.p, rgba(env.c.ink, 0.16), env.c.hot);
    ctx.font = setting(env, 'text', 48, 500).font;
    m.step(MID.x, MID.y + 256, env.c.ink, env.look.dim, 'center');
  },
});

meter({
  id: 'ruled',
  name: 'Progress',
  look: 'paper',
  paint(ctx, env, m) {
    const w = room(env, 1200, 160);
    const left = MID.x - w / 2;
    const size = Math.min(400, w * 0.42);
    const set = setting(env, 'display', size);
    ctx.font = set.font;
    const nw = ctx.measureText(String(m.pct)).width;
    write(ctx, String(m.pct), left, MID.y - 90, env.c.ink);
    ctx.font = setting(env, 'display', size * 0.4).font;
    write(ctx, '%', left + nw + size * 0.06, MID.y - 90 + size * 0.2, soft(env));
    ctx.fillStyle = rgba(env.c.ink, 0.18);
    ctx.fillRect(left, MID.y + 166, w, 6);
    ctx.fillStyle = env.c.hot;
    ctx.fillRect(left, MID.y + 166, w * m.p, 6);
    ctx.font = setting(env, 'text', 46, 500).font;
    m.step(left, MID.y + 234, env.c.ink, env.look.dim);
    if (m.steps.length)
      write(ctx, `${m.at + 1} of ${m.steps.length}`, left + w, MID.y + 234, soft(env), 'right');
  },
});

meter({
  id: 'glass-meter',
  name: 'Progress',
  look: 'glass',
  paint(ctx, env, m) {
    const w = Math.min(920, env.wide - 120);
    pane(ctx, env, { cx: MID.x, cy: MID.y, w, h: 560, r: stuff(env).r });
    count(ctx, env, m, (s) => setting(env, 'text', s, 600).font, 250, MID.y - 70);
    bar(ctx, MID.x - w * 0.3, MID.y + 96, w * 0.6, 8, m.p, rgba(env.c.ink, 0.2), env.c.ink);
    ctx.font = setting(env, 'text', 38, 500).font;
    m.step(MID.x, MID.y + 176, env.c.ink, 0.75, 'center');
  },
});

// Registered after the looks' own, so a slide with no style picked gets its look's Progress.
meter({
  id: 'cells',
  name: 'Cell meter',
  paint(ctx, env, m) {
    const w = room(env, 1500, 160);
    const u = w / 1100;
    const left = MID.x - w / 2;
    const n = m.steps.length;
    const top = MID.y - ((266 + n * 56) * u) / 2;
    ctx.font = mono(150 * u, 700);
    write(ctx, `${m.pct}%`, left, top + 75 * u, env.c.ink);
    ctx.font = mono(30 * u);
    if (n) write(ctx, `${m.at + 1}/${n}`, left + w, top + 112 * u, soft(env), 'right');
    const cells = 32;
    const gap = w * 0.008;
    const cw = (w - gap * (cells - 1)) / cells;
    const lit = Math.round(m.p * cells);
    for (let i = 0; i < cells; i++) {
      ctx.fillStyle = i < lit ? env.c.hot : rgba(env.c.ink, 0.12);
      ctx.fillRect(left + i * (cw + gap), top + 160 * u, cw, 76 * u);
    }
    ctx.font = mono(34 * u);
    for (let i = 0; i <= m.at && i < n; i++)
      write(
        ctx,
        `→ ${m.steps[i]}`,
        left,
        top + (294 + i * 56) * u,
        i < m.at ? soft(env) : env.c.ink,
      );
  },
});

// ---------------------------------------------------------------- checklist

const EACH = 0.62;
const tickAt = (i: number) => 0.9 + i * EACH;

function list(o: {
  id: string;
  name: string;
  look?: string;
  paint: (ctx: Ctx, env: Env, steps: string[], t: number) => void;
}): void {
  register<WorkingContent>({
    kind: 'working',
    narrow: true,
    id: o.id,
    name: o.name,
    look: o.look,
    role: o.look && 'list',
    entry: { box: RING },
    dur: () => 4.8,
    leave: (c) => 4.8 - tickAt(c.steps.filter(Boolean).slice(0, 4).length) - 0.2,
    cues(c) {
      const n = c.steps.filter(Boolean).slice(0, 4).length;
      return [
        ...Array.from({ length: n }, (_, i) => ({
          at: tickAt(i),
          sound: 'pop' as const,
          rate: 1 + i * 0.07,
        })),
        { at: tickAt(n) + 0.2, sound: 'success' },
      ];
    },
    draw(ctx, t, _d, env, c) {
      const steps = c.steps.filter(Boolean).slice(0, 4);
      const done = tickAt(steps.length) + 0.2;
      const away = env.feel.move(seg(t, done - 0.05, done + 0.3));
      const a = seg(t, 0.15, 0.45) * (1 - away);
      if (a > 0) {
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate(0, -30 * away);
        o.paint(ctx, env, steps, t);
        ctx.restore();
      }
      handed(ctx, env, t);
      doneDisc(ctx, env, t, done, done + 0.75, 150, c);
    },
  });
}

/** True once a step's turn has come: the first from the start, the rest as the one before is ticked. */
const reached = (i: number, t: number) => i === 0 || t >= tickAt(i - 1);

list({
  id: 'struck',
  name: 'Checklist',
  look: 'block',
  paint(ctx, env, steps, t) {
    const w = room(env, 1500, 160);
    const left = MID.x - w / 2;
    const upper = setting(env, 'display', 76).upper;
    const words = steps.map((s) => (upper ? s.toUpperCase() : s));
    const face = (s: number) => setting(env, 'display', s).font;
    const size = fit(ctx, words, face, 100, w - 190);
    const high = size * 1.95;
    const top = MID.y - (steps.length * high) / 2;
    ctx.font = face(size);
    words.forEach((word, i) => {
      const y = top + i * high;
      ctx.fillStyle = rgba(env.c.ink, 0.2);
      ctx.fillRect(left, y - 2, w, 4);
      if (i === words.length - 1) ctx.fillRect(left, y + high - 2, w, 4);
      const mid = y + high / 2 + size * 0.04;
      write(ctx, word, left + 36, mid, rgba(env.c.ink, reached(i, t) ? 1 : 0.38));
      // A bar of the accent crosses the row as it is ticked, and the words under it change ink.
      const q = env.feel.move(seg(t, tickAt(i), tickAt(i) + 0.3));
      if (q <= 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, y, w * q, high);
      ctx.clip();
      ctx.fillStyle = env.c.hot;
      ctx.fillRect(left, y, w, high);
      write(ctx, word, left + 36, mid, env.c.onHot);
      tick(
        ctx,
        left + w - 70,
        y + high / 2,
        size * 0.5,
        seg(t, tickAt(i) + 0.12, tickAt(i) + 0.36),
        env.c.onHot,
      );
      ctx.restore();
    });
  },
});

list({
  // Keeps the id of the style it replaced, so a video that used it plays this one.
  id: 'boxes',
  name: 'Step log',
  paint(ctx, env, steps, t) {
    // An assistant's activity list. A step's dot swells in and its words slide out from it. The
    // dot breathes while the step runs and takes the accent when it is done, and only then does
    // the rail run down from it to where the next dot appears.
    const w = room(env, 1300, 160);
    const face = (s: number) => mono(s, 500);
    const size = fit(ctx, steps, face, 78, w - 78 * 1.5);
    const pitch = size * 2.05;
    // The list is centered as a block: its rail, its dots and its longest line together.
    ctx.font = face(size);
    const longest = Math.max(1, ...steps.map((step) => ctx.measureText(step).width));
    const left = MID.x - (size * 1.5 + longest) / 2;
    const top = MID.y - ((steps.length - 1) * pitch) / 2;
    const r = size * 0.19;
    const rail = left + r;
    ctx.fillStyle = rgba(env.c.ink, 0.16);
    for (let k = 0; k < steps.length - 1; k++) {
      const run = env.feel.move(seg(t, tickAt(k) - 0.2, tickAt(k) + 0.04));
      if (run > 0) ctx.fillRect(rail - 1.5, top + k * pitch, 3, pitch * run);
    }
    ctx.font = face(size);
    steps.forEach((step, i) => {
      const from = i === 0 ? 0.2 : tickAt(i - 1);
      const grown = Math.max(0, env.feel.pop(t - from));
      if (grown <= 0) return;
      const inn = env.feel.rise(t - from - 0.08);
      const y = top + i * pitch;
      const done = cl(env.feel.pop(t - tickAt(i)));
      const breath = 0.5 + 0.25 * Math.sin((t - from) * 7);
      ctx.beginPath();
      ctx.arc(rail, y, r * grown * lerp(1, 1.15, done), 0, 7);
      // A solid tone, so the rail does not show through the dot while it breathes.
      const idle = blend(env.c.ground, env.c.ink, breath);
      ctx.fillStyle = done > 0 ? blend(idle, env.c.hot, done) : idle;
      ctx.fill();
      if (inn <= 0) return;
      ctx.save();
      ctx.globalAlpha *= cl(inn);
      ctx.translate((inn - 1) * size * 0.5, 0);
      write(ctx, step, left + size * 1.5, y + size * 0.04, rgba(env.c.ink, lerp(1, 0.62, done)));
      ctx.restore();
    });
  },
});

list({
  id: 'checklist',
  name: 'Checklist',
  look: 'design',
  paint(ctx, env, steps, t) {
    const upper = setting(env, 'display', 120).upper;
    const words = steps.map((s) => (upper ? s.toUpperCase() : s));
    const face = (s: number) => setting(env, 'display', s).font;
    const size = fit(ctx, words, face, 120, room(env, 1400, 200) - 150);
    const r = size * 0.36;
    let current = 0;
    // One step holds the frame at a time. It is ticked, lifts away, and the next rises into its place.
    words.forEach((word, i) => {
      const start = i === 0 ? 0.2 : tickAt(i - 1) + 0.36;
      const inn = env.feel.rise(t - start);
      if (inn <= 0) return;
      current = i;
      const last = i === words.length - 1;
      const off = last ? 0 : env.feel.move(seg(t, tickAt(i) + 0.2, tickAt(i) + 0.4));
      if (off >= 1) return;
      ctx.save();
      ctx.globalAlpha *= cl(inn) * (1 - off);
      ctx.translate(0, (1 - inn) * 90 - off * 90);
      ctx.font = face(size);
      const x0 = MID.x - (r * 2 + size * 0.4 + ctx.measureText(word).width) / 2;
      const ticked = cl(env.feel.pop(t - tickAt(i)));
      ctx.beginPath();
      ctx.arc(x0 + r, MID.y, r - size * 0.03, 0, 7);
      ctx.lineWidth = size * 0.06;
      ctx.strokeStyle = rgba(env.c.ink, 0.45 * (1 - ticked));
      ctx.stroke();
      if (ticked > 0) {
        ctx.beginPath();
        ctx.arc(x0 + r, MID.y, r * lerp(0.6, 1, ticked), 0, 7);
        ctx.fillStyle = rgba(env.c.hot, ticked);
        ctx.fill();
        tick(ctx, x0 + r, MID.y, r, seg(t, tickAt(i) + 0.03, tickAt(i) + 0.2), env.c.onHot);
      }
      write(ctx, word, x0 + r * 2 + size * 0.4, MID.y + size * 0.04, env.c.ink);
      ctx.restore();
    });
    ctx.font = mono(30);
    write(ctx, `${current + 1} / ${steps.length}`, MID.x, MID.y + size * 1.25, soft(env), 'center');
  },
});

list({
  id: 'ruled-list',
  name: 'Checklist',
  look: 'paper',
  paint(ctx, env, steps, t) {
    const w = room(env, 1400, 160);
    const left = MID.x - w / 2;
    const upper = setting(env, 'display', 72).upper;
    const words = steps.map((s) => (upper ? s.toUpperCase() : s));
    const face = (s: number) => setting(env, 'display', s).font;
    const size = fit(ctx, words, face, 92, w - 130);
    const high = size * 2;
    const top = MID.y - (steps.length * high) / 2;
    ctx.font = face(size);
    words.forEach((word, i) => {
      const y = top + i * high;
      ctx.fillStyle = rgba(env.c.ink, 0.22);
      ctx.fillRect(left, y - 1, w, 2);
      if (i === words.length - 1) ctx.fillRect(left, y + high - 1, w, 2);
      write(ctx, word, left, y + high / 2 + size * 0.04, rgba(env.c.ink, reached(i, t) ? 1 : 0.35));
      tick(
        ctx,
        left + w - size * 0.5,
        y + high / 2,
        size * 0.5,
        seg(t, tickAt(i), tickAt(i) + 0.3),
        env.c.hot,
      );
    });
  },
});

list({
  id: 'glass-list',
  name: 'Checklist',
  look: 'glass',
  paint(ctx, env, steps, t) {
    const w = Math.min(1300, env.wide - 120);
    const face = (s: number) => setting(env, 'text', s, 600).font;
    const size = fit(ctx, steps, face, 76, w - 280);
    const high = size * 2;
    const h = steps.length * high + 80;
    pane(ctx, env, { cx: MID.x, cy: MID.y, w, h, r: stuff(env).r });
    const left = MID.x - w / 2;
    const r = size * 0.42;
    ctx.font = face(size);
    steps.forEach((step, i) => {
      const y = MID.y - h / 2 + 40 + (i + 0.5) * high;
      const ticked = cl(env.feel.pop(t - tickAt(i)));
      ctx.beginPath();
      ctx.arc(left + 80 + r, y, r - 2, 0, 7);
      ctx.lineWidth = 4;
      ctx.strokeStyle = rgba(env.c.ink, 0.35 * (1 - ticked));
      ctx.stroke();
      if (ticked > 0) {
        ctx.beginPath();
        ctx.arc(left + 80 + r, y, r * lerp(0.6, 1, ticked), 0, 7);
        ctx.fillStyle = rgba(env.c.ink, ticked);
        ctx.fill();
        tick(ctx, left + 80 + r, y, r, seg(t, tickAt(i) + 0.05, tickAt(i) + 0.3), env.c.ground);
      }
      write(
        ctx,
        step,
        left + 80 + r * 2 + size * 0.5,
        y + size * 0.04,
        rgba(env.c.ink, reached(i, t) ? 1 : 0.5),
      );
    });
  },
});

// ---------------------------------------------------------------- status word

/** What an assistant says it is doing while it works. A video shows a few, drawn from these. */
const STATUS = [
  'Thinking',
  'Strategizing',
  'Pondering',
  'Noodling',
  'Brewing',
  'Conjuring',
  'Crunching',
  'Sketching',
  'Tinkering',
  'Mulling',
  'Scheming',
  'Assembling',
  'Polishing',
  'Wrangling',
  'Composing',
  'Distilling',
  'Percolating',
  'Cooking',
  'Drafting',
  'Synthesizing',
  'Reasoning',
  'Musing',
  'Simmering',
  'Puzzling',
  'Refining',
];
// A word stays up long enough to read at the fastest speed, which runs a slide at almost twice this.
const WORD = 0.9;
const WORDS = 4;
const SAID = 0.3 + WORDS * WORD;

/** The video's own few status words, in its own order. They come from the video's draw, so the
 *  same video always shows the same ones and a shuffle shows others. */
function statusWords(draw: number): string[] {
  let h = Math.imul(draw ^ 0x9e3779b9, 2654435761);
  const pool = [...STATUS];
  return Array.from({ length: WORDS }, () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return pool.splice((h >>> 0) % pool.length, 1)[0];
  });
}

register<WorkingContent>({
  kind: 'working',
  narrow: true,
  id: 'status',
  name: 'Status word',
  entry: { box: RING },
  dur: () => SAID + 1.3,
  leave: () => 1.3,
  cues: () => [
    ...Array.from({ length: WORDS - 1 }, (_, i) => ({
      at: 0.3 + (i + 1) * WORD,
      sound: 'pop' as const,
      rate: 1 + i * 0.07,
    })),
    { at: SAID, sound: 'success' },
  ],
  draw(ctx, t, _d, env, c) {
    const words = statusWords(c.draw ?? 0);
    const away = env.feel.move(seg(t, SAID - 0.05, SAID + 0.3));
    const a = seg(t, 0.15, 0.45) * (1 - away);
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.translate(0, -30 * away);
      const size = fit(
        ctx,
        words.map((w) => `${w}…`),
        (s) => mono(s),
        92,
        room(env, 1300, 160) - 92,
      );
      ctx.font = mono(size);
      const widest = Math.max(...words.map((w) => ctx.measureText(`${w}…`).width));
      const r = size * 0.3;
      const left = MID.x - (r * 2 + size * 0.55 + widest) / 2;
      // The mark beside the word, one of three for the video: a breathing dot, three dots that
      // rise in turn, or a ring with a bright quarter running around it.
      const mark = c.mark ?? 'dot';
      const mx = left + r;
      if (mark === 'dot') {
        const beat = 0.75 + 0.25 * Math.sin(t * 5);
        ctx.fillStyle = rgba(env.c.hot, 0.22);
        ctx.beginPath();
        ctx.arc(mx, MID.y, r * 1.25 * beat, 0, 7);
        ctx.fill();
        ctx.fillStyle = env.c.hot;
        ctx.beginPath();
        ctx.arc(mx, MID.y, r * 0.72 * beat, 0, 7);
        ctx.fill();
      } else if (mark === 'dots') {
        for (let i = 0; i < 3; i++) {
          const up = Math.max(0, Math.sin(t * 6.5 - i * 0.9));
          ctx.fillStyle = rgba(env.c.hot, 0.45 + 0.55 * up);
          ctx.beginPath();
          ctx.arc(mx + (i - 1) * r * 1.05, MID.y - up * r * 0.5, r * 0.33, 0, 7);
          ctx.fill();
        }
      } else {
        ctx.lineWidth = size * 0.075;
        ctx.strokeStyle = rgba(env.c.ink, 0.16);
        ctx.beginPath();
        ctx.arc(mx, MID.y, r, 0, 7);
        ctx.stroke();
        ctx.strokeStyle = env.c.hot;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(mx, MID.y, r, t * 6, t * 6 + 1.7);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
      const x = left + r * 2 + size * 0.55;
      const k = Math.min(WORDS - 1, Math.floor(Math.max(0, t - 0.3) / WORD));
      const inn = k === 0 ? 1 : env.feel.move(seg(t, 0.3 + k * WORD, 0.3 + k * WORD + 0.3));
      // A band of light crosses the word from left to right, again and again.
      const at = x + widest * (((t * 0.55) % 1.6) - 0.3);
      const lit = ctx.createLinearGradient(at - widest * 0.25, 0, at + widest * 0.25, 0);
      lit.addColorStop(0, rgba(env.c.ink, 0.5));
      lit.addColorStop(0.5, rgba(env.c.ink, 1));
      lit.addColorStop(1, rgba(env.c.ink, 0.5));
      // One word rolls up out of the line as the next rolls in from below.
      const say = (word: string, dy: number, alpha: number) => {
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.fillStyle = lit;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${word}…`, x, MID.y + size * 0.04 + dy);
        ctx.restore();
      };
      if (k > 0 && inn < 1) say(words[k - 1], -size * 0.9 * inn, 1 - inn);
      say(words[k], size * 0.9 * (1 - inn), inn);
      ctx.restore();
    }
    handed(ctx, env, t);
    doneDisc(ctx, env, t, SAID, SAID + 0.75, 150, c);
  },
});
