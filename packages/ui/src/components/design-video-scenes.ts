import { out, type Paint } from './design-motion.js';
import { asIntro, asText, type Cue, keys } from './design-sound.js';
import { TERM, termBar, termFirst, termLine, termStep } from './design-terminal.js';
import {
  arrive,
  type Box,
  blend,
  card,
  chip,
  cl,
  counted,
  cover,
  dim,
  type Env,
  H,
  leave,
  lerp,
  MID,
  mix,
  panel,
  path,
  pointer,
  press,
  register,
  rgba,
  say,
  seedOut,
  seg,
  setting,
  stuff,
  toward,
  W,
  widthOf,
  wrap,
} from './design-video.js';

// Every way a scene kind can be drawn. Variants of one kind take the same content and start from
// the same shape, so any of them can stand in for another.

const DOT: Box = { cx: MID.x, cy: MID.y, w: 20, h: 20, r: 10 };
export const RING: Box = { cx: MID.x, cy: MID.y, w: 132, h: 132, r: 66 };
const TILE: Box = { cx: MID.x, cy: MID.y, w: 420, h: 260, r: 26 };
const HERO: Box = { cx: 1380, cy: 540, w: 900, h: 564, r: 28 };
const SEED: Box = { cx: MID.x, cy: MID.y, w: 24, h: 24, r: 12 };
const FULL: Box = { cx: MID.x, cy: MID.y, w: W + 80, h: H + 80, r: 0 };
const MARK: Box = { cx: MID.x, cy: MID.y, w: 132, h: 132, r: 34 };

type Ctx = CanvasRenderingContext2D;

/** Draws with the frame turned about a point. */
function turned(
  ctx: Ctx,
  cx: number,
  cy: number,
  deg: number,
  scale: number,
  draw: () => void,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
}

function kicker(
  ctx: Ctx,
  env: Env,
  text: string,
  x: number,
  y: number,
  t: number,
  align: 'left' | 'center',
  start = 0.15,
): void {
  say(ctx, env, [text], x, y, 27, t, {
    voice: 'mono',
    color: env.c.hot,
    start,
    stagger: 0.05,
    align,
  });
}

// ---------------------------------------------------------------- hook

export interface HookContent {
  kicker: string;
  /** Up to three lines, split by line breaks. */
  lines: string;
  /** What the Running bands hook runs across the frame before the headline. */
  bands?: string;
}

const hookLines = (c: HookContent) =>
  c.lines
    .split('\n')
    .filter((l) => l.trim())
    .slice(0, 3);

/** How far a slide has grown out of the shape it starts from. Under a dissolve or a push there
 *  is no such shape, so it is fully grown from its first frame. */
const grown = (env: Env, p: number) => (env.plain ? 1 : p);

/** True in a frame tall enough that slides are drawn larger and must keep to a narrower width. */
const tight = (env: Env) => env.wide < W;

/** How wide a centered slide may run in this frame: its usual measure, or less in a tall frame. */
export const room = (env: Env, most: number, pad = 150) => Math.min(most, env.wide - pad);

/** A hook's lines for this frame. They stay as written while they fit at a size that reads. In a
 *  narrow frame each is wrapped again, so the words stay large on more lines. */
function hookFor(ctx: Ctx, env: Env, c: HookContent, most: number, wide: number): string[] {
  const lines = hookLines(c);
  const fit = room(env, wide);
  const widest = Math.max(1, ...lines.map((l) => widthOf(ctx, env, l, most)));
  if (env.wide >= W || fit / widest >= 0.92) return lines;
  // Each word carries its own `*` marks, since a marked run may now break across lines.
  let hot = false;
  const marked = lines.map((line) =>
    line
      .split(' ')
      .filter(Boolean)
      .map((word) => {
        if (word.startsWith('*')) hot = true;
        const out = hot ? `*${word.replace(/\*/g, '')}*` : word;
        if (/\*[.,!?]?$/.test(word)) hot = false;
        return out;
      })
      .join(' '),
  );
  // Wrapped at a smaller size each time, until all of it fits on six lines.
  let again = marked;
  for (let size = most; size > most * 0.5; size *= 0.9) {
    again = marked.flatMap((line) => wrap(ctx, env, line, size, fit));
    if (again.length <= 6) break;
  }
  return again;
}

register<HookContent>({
  kind: 'hook',
  narrow: true,
  id: 'rise',
  name: 'Words rise',
  dur: () => 3.8,
  cues: () => asIntro(asText([{ at: 0.35, sound: 'slide' }])),
  draw(ctx, t, _d, env, c) {
    const lines = hookFor(ctx, env, c, 148, 1640);
    // A word or two on its own fills the frame.
    const short = lines.length === 1 && lines[0].length <= 12;
    const most = tight(env) ? 148 : lines.length > 2 ? 116 : short ? 230 : 148;
    // A long line is set smaller, so it never runs off the frame.
    const widest = Math.max(...lines.map((l) => widthOf(ctx, env, l, most)));
    const size = Math.min(most, (most * room(env, 1640)) / Math.max(1, widest));
    const lead = setting(env, 'display', size);
    const top = MID.y - ((lines.length - 1) * lead.size * lead.lead) / 2 + lead.size * 0.3;
    // No slow push in here: a scale that changes every frame makes the words crawl by a pixel.
    turned(ctx, MID.x, MID.y, 0, 1 - 0.05 * env.out, () => {
      leave(ctx, env);
      kicker(ctx, env, c.kicker, MID.x, top - lead.size * 1.15, t, 'center');
      say(ctx, env, lines, MID.x, top, size, t, { start: 0.4, stagger: 0.1 });
    });
    seedOut(ctx, env);
  },
});

register<HookContent>({
  kind: 'hook',
  narrow: true,
  id: 'bars',
  name: 'Bars wipe',
  dur: () => 4,
  cues: (c, feel) =>
    asIntro(
      asText(
        hookLines(c).map((_, i) => ({ at: 0.35 + i * 0.24 * feel.gap, sound: 'slide' as const })),
      ),
    ),
  draw(ctx, t, _d, env, c) {
    const lines = hookFor(ctx, env, c, 170, env.wide - 360);
    const most = lines.length > 2 && !tight(env) ? 150 : 190;
    const widest = Math.max(...lines.map((l) => widthOf(ctx, env, l, most)));
    const size = Math.min(most, (most * (env.wide - 360)) / Math.max(1, widest));
    const set = setting(env, 'display', size);
    const pitch = set.size * set.lead;
    const top = MID.y - ((lines.length - 1) * pitch) / 2 + set.size * 0.32;
    // The lines hang from the left edge of what the frame shows.
    const x0 = MID.x - env.wide / 2 + 120;
    ctx.save();
    leave(ctx, env, 30);
    kicker(ctx, env, c.kicker, x0 + 22, top - set.size * 1.12, t, 'left');
    lines.forEach((line, i) => {
      const lt = t - 0.35 - i * 0.24 * env.feel.gap;
      if (lt <= 0) return;
      const w = widthOf(ctx, env, line, size) + 50;
      const y0 = top + i * pitch - set.size * 0.9;
      // A bar crosses the line, and the words are there once it has passed.
      const grow = env.feel.move(seg(lt, 0, 0.32));
      const shed = env.feel.move(seg(lt, 0.3, 0.66));
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0 - 20, w * shed, set.size * 1.2 + 40);
      ctx.clip();
      say(ctx, env, [line], x0 + 20, top + i * pitch, size, 99, { align: 'left' });
      ctx.restore();
      ctx.fillStyle = env.c.hot;
      ctx.fillRect(x0 + w * shed, y0, w * (grow - shed), set.size * 1.1);
    });
    ctx.restore();
    seedOut(ctx, env);
  },
});

const BEAT = 0.36;
const hookWords = (c: HookContent) => hookLines(c).join(' ').split(' ').filter(Boolean);

register<HookContent>({
  kind: 'hook',
  narrow: true,
  id: 'slam',
  name: 'One word at a time',
  dur: (c) => 0.4 + hookWords(c).length * BEAT + 1.5,
  cues: (c) =>
    asIntro(asText(hookWords(c).map((_, i) => ({ at: 0.4 + i * BEAT, sound: 'pop' as const })))),
  draw(ctx, t, _d, env, c) {
    const words = hookWords(c);
    const i = Math.min(words.length - 1, Math.max(0, Math.floor((t - 0.4) / BEAT)));
    const lt = t - 0.4 - i * BEAT;
    ctx.save();
    leave(ctx, env);
    kicker(ctx, env, c.kicker, MID.x, 250, t, 'center', 0.1);
    if (t >= 0.4) {
      // Each word fills the frame. Marked words keep their `*` so they take the hot color.
      let hot = false;
      let marked = '';
      for (let k = 0; k <= i; k++) {
        if (words[k].startsWith('*')) hot = true;
        marked = hot ? `*${words[k].replace(/\*/g, '')}*` : words[k];
        if (/\*[.,!?]?$/.test(words[k])) hot = false;
      }
      const size = Math.min(
        330,
        (330 * room(env, 1500, 120)) / Math.max(1, widthOf(ctx, env, marked, 330)),
      );
      const p = env.feel.pop(lt);
      turned(ctx, MID.x, MID.y + 30, 0, lerp(1.18, 1, p), () => {
        ctx.globalAlpha *= seg(lt, 0, 0.06);
        say(ctx, env, [marked], MID.x, MID.y + 30 + size * 0.36, size, 99);
      });
      const done = t - 0.4 - words.length * BEAT;
      const whole = wrap(ctx, env, hookLines(c).join(' '), 40, env.wide - 200, 'text').slice(0, 3);
      say(ctx, env, whole, MID.x, 880, 40, done, {
        voice: 'text',
        color: dim(env),
        stagger: 0.04,
      });
    }
    ctx.restore();
    seedOut(ctx, env);
  },
});

/** A hook's lines set as large as fits, and how tall one line then is. */
function hookFit(ctx: Ctx, env: Env, lines: string[], most: number, room: number) {
  const widest = Math.max(1, ...lines.map((l) => widthOf(ctx, env, l, most)));
  const size = Math.min(most, (most * room) / widest);
  const set = setting(env, 'display', size);
  const pitch = set.size * set.lead;
  return { size, pitch, top: MID.y - ((lines.length - 1) * pitch) / 2 + set.size * 0.32 };
}

const KEY = 0.05;
const hookChars = (c: HookContent) => hookLines(c).join('').replace(/\*/g, '').length;

register<HookContent>({
  kind: 'hook',
  narrow: true,
  id: 'typed',
  name: 'Typed out',
  dur: (c) => Math.min(6.5, 0.5 + hookChars(c) * KEY + 1.9),
  cues: (c) => keys(0.45, 0.45 + hookChars(c) * KEY, hookChars(c)),
  draw(ctx, t, _d, env, c) {
    const lines = hookFor(ctx, env, c, 150, 1500);
    const { size, pitch, top } = hookFit(
      ctx,
      env,
      lines,
      lines.length > 2 && !tight(env) ? 120 : 150,
      room(env, 1500, 170),
    );
    const plain = lines.map((l) => l.replace(/\*/g, ''));
    const left = MID.x - Math.max(...plain.map((l) => widthOf(ctx, env, l, size))) / 2;
    // The lines are typed one key at a time, each revealed up to where the caret has reached.
    let typed = Math.floor(Math.max(0, t - 0.45) / KEY);
    const all = plain.join('').length;
    ctx.save();
    leave(ctx, env, 20);
    kicker(ctx, env, c.kicker, left, top - size * 1.18, t, 'left');
    let caret = { x: left, y: top };
    lines.forEach((line, i) => {
      const here = Math.min(plain[i].length, Math.max(0, typed));
      typed -= plain[i].length;
      if (here <= 0 && i > 0) return;
      const w = widthOf(ctx, env, plain[i].slice(0, here), size);
      ctx.save();
      ctx.beginPath();
      ctx.rect(left - 20, top + i * pitch - size * 1.1, w + 20, size * 1.5);
      ctx.clip();
      say(ctx, env, [line], left, top + i * pitch, size, 99, { align: 'left' });
      ctx.restore();
      caret = { x: left + w, y: top + i * pitch };
    });
    const done = t > 0.45 + all * KEY;
    if (!done || (t * 1.7) % 1 < 0.55) {
      ctx.fillStyle = env.c.hot;
      ctx.fillRect(caret.x + size * 0.06, caret.y - size * 0.8, size * 0.09, size * 0.95);
    }
    ctx.restore();
    seedOut(ctx, env);
  },
});

register<HookContent>({
  kind: 'hook',
  narrow: true,
  id: 'bands',
  name: 'Running bands',
  dur: () => 4.6,
  cues: () =>
    asIntro([
      // The bands are words on the move. The hit is the headline taking their place.
      { at: 0, sound: 'whoosh', text: true },
      { at: 1.55, sound: 'hit', gain: 0.7 },
    ]),
  draw(ctx, t, _d, env, c) {
    const lines = hookFor(ctx, env, c, 160, 1640);
    const { feel } = env;
    // Bands of words run across the frame in turn, then part for the headline.
    const part = feel.move(seg(t, 1.5, 2.2));
    const words = `${(c.bands?.trim() || hookLines(c).join(' ')).replace(/\*/g, '')}  ·  `;
    const set = setting(env, 'display', 190);
    // Five bands fill a 16:9 frame. A taller one gets more above and below them.
    const more = Math.ceil(env.tall / (H / 5));
    const rows = 5 + more * 2;
    ctx.save();
    ctx.font = set.font;
    (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${set.track}px`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const step = Math.max(200, ctx.measureText(words).width);
    for (let r = 0; r < rows; r++) {
      const dir = r % 2 === 0 ? -1 : 1;
      // Fast at first, easing down, so the bands settle as the headline arrives.
      const run = (1 - (1 - seg(t, 0, 2.2)) ** 3) * 900 + t * 40;
      const off = (((dir * run + r * 137) % step) + step) % step;
      const y = (r - more + 0.5) * (H / 5) + (r < rows / 2 ? -1 : 1) * part * (H * 0.6 + env.tall);
      ctx.globalAlpha = (1 - part) * seg(t, r * 0.06, r * 0.06 + 0.25);
      for (let x = -off; x < W; x += step) {
        if (r % 2 === 0) {
          ctx.fillStyle = rgba(env.c.ink, r === more + 2 ? 1 : 0.16);
          ctx.fillText(words, x, y);
        } else {
          ctx.strokeStyle = rgba(env.c.ink, 0.4);
          ctx.lineWidth = 3;
          ctx.strokeText(words, x, y);
        }
      }
    }
    (ctx as Ctx & { letterSpacing: string }).letterSpacing = '0px';
    ctx.restore();

    const inn = feel.pop(t - 1.55);
    if (inn > 0) {
      const { size, pitch, top } = hookFit(
        ctx,
        env,
        lines,
        lines.length > 2 && !tight(env) ? 124 : 160,
        room(env, 1640),
      );
      turned(ctx, MID.x, MID.y, 0, lerp(1.3, 1, inn) * (1 - 0.05 * env.out), () => {
        leave(ctx, env);
        ctx.globalAlpha *= seg(t, 1.55, 1.75);
        kicker(ctx, env, c.kicker, MID.x, top - size * 1.15, t - 1.6, 'center', 0);
        for (const [i, line] of lines.entries()) {
          say(ctx, env, [line], MID.x, top + i * pitch, size, 99);
        }
      });
    }
    seedOut(ctx, env);
  },
});

const FLY = 0.9;

register<HookContent>({
  kind: 'hook',
  narrow: true,
  id: 'zoom',
  name: 'Fly through',
  dur: (c) => 0.3 + Math.max(0, hookLines(c).length - 1) * FLY + 3,
  cues(c) {
    const through = Math.max(0, hookLines(c).length - 1);
    const land = 0.3 + through * FLY;
    return asIntro([
      // Each line's whoosh peaks as it passes the camera.
      ...Array.from({ length: through }, (_, i) => ({
        at: 0.3 + i * FLY + FLY - 0.4,
        sound: 'whoosh' as const,
        text: true,
      })),
      { at: land + 0.2, sound: 'hit', gain: 0.7 },
    ]);
  },
  draw(ctx, t, _d, env, c) {
    const lines = hookLines(c);
    const { feel } = env;
    const through = Math.max(0, lines.length - 1);
    // Each line comes at the camera and passes it. The whole headline then lands from close up.
    for (let i = 0; i < through; i++) {
      const lt = t - 0.3 - i * FLY;
      if (lt <= 0 || lt > FLY + 0.1) continue;
      const { size } = hookFit(ctx, env, [lines[i]], 200, room(env, 1500));
      const inn = feel.pop(lt);
      const pass = seg(lt, FLY - 0.32, FLY) ** 2;
      ctx.save();
      ctx.globalAlpha = seg(lt, 0, 0.1) * (1 - pass);
      if (feel.blur && pass > 0.02) ctx.filter = `blur(${(pass * 26).toFixed(1)}px)`;
      turned(ctx, MID.x, MID.y, 0, lerp(0.5, 1, inn) + pass * 7, () =>
        say(ctx, env, [lines[i]], MID.x, MID.y + size * 0.34, size, 99),
      );
      ctx.restore();
    }
    const lt = t - 0.3 - through * FLY;
    if (lt > 0) {
      const all = hookFor(ctx, env, c, 160, 1640);
      const { size, pitch, top } = hookFit(
        ctx,
        env,
        all,
        all.length > 2 && !tight(env) ? 124 : 160,
        room(env, 1640),
      );
      // Held at full size once it gets there, so the words do not swell past it and settle back.
      const land = Math.min(1, feel.glide(lt));
      ctx.save();
      const far = 1 - land;
      if (feel.blur && far > 0.02) ctx.filter = `blur(${(far * 22).toFixed(1)}px)`;
      turned(ctx, MID.x, MID.y, 0, lerp(3.2, 1, land) * (1 - 0.05 * env.out), () => {
        leave(ctx, env);
        ctx.globalAlpha *= seg(lt, 0, 0.2);
        kicker(ctx, env, c.kicker, MID.x, top - size * 1.15, lt, 'center', 0.5);
        for (const [i, line] of all.entries()) {
          say(ctx, env, [line], MID.x, top + i * pitch, size, 99);
        }
      });
      ctx.restore();
    }
    seedOut(ctx, env);
  },
});

// ---------------------------------------------------------------- typed input

export interface InputContent {
  label: string;
  text: string;
  /** What comes back, for the styles that show an answer. */
  reply?: string;
}

register<InputContent>({
  kind: 'input',
  narrow: true,
  id: 'pill',
  name: 'Prompt box',
  entry: { box: DOT },
  // Each Setup ends as its shape reaches the next slide's, so the bare shape is never held.
  dur: () => 4.35,
  cues: (c) => [...keys(0.75, 2.65, c.text.length), { at: 3.45, sound: 'click' }],
  draw(ctx, t, d, env, c) {
    const { feel } = env;
    const click = 3.45;
    // Under a dissolve or a push the box stays as it is, and the frame does the leaving.
    const after = env.plain ? -1 : t - click - 0.12;
    const open = grown(env, feel.glide(t));
    const st = stuff(env);
    const rest: Box = {
      cx: MID.x,
      cy: MID.y,
      w: room(env, 1240, 110),
      h: 132,
      r: Math.min(66, st.r),
    };
    const small = env.into ? env.into.box : RING;
    const b = after > 0 ? mix(rest, small, feel.glide(after)) : mix(DOT, rest, open);
    const show = after > 0 ? 1 - seg(after, 0, 0.14) : seg(t, 0.25, 0.5);

    ctx.save();
    ctx.globalAlpha = show;
    say(ctx, env, [c.label], MID.x, MID.y - 128, 36, t, {
      voice: 'text',
      color: dim(env),
      weight: 500,
      start: 0.45,
    });
    ctx.restore();

    // The field is made of the look's own material. The dot it grew from fades off it, and it
    // goes back to that dot's color as it leaves.
    if (after > 0) {
      path(ctx, b);
      ctx.fillStyle = blend(st.fill, env.dot, cl(feel.glide(after) * 1.6));
      ctx.fill();
    } else {
      panel(ctx, env, b);
      path(ctx, b);
      ctx.fillStyle = rgba(env.dot, 1 - cl(open * 1.6));
      ctx.fill();
    }
    if (after > 0) arrive(ctx, env, b, seg(t, d - 0.35, d - 0.05));

    if (show > 0) {
      ctx.save();
      path(ctx, b);
      ctx.clip();
      ctx.globalAlpha = show;
      // Set smaller when the whole question would not fit the box beside its button.
      const px = Math.min(
        48,
        (48 * (rest.w - 210)) / Math.max(1, widthOf(ctx, env, c.text, 48, 'text')),
      );
      ctx.font = setting(env, 'text', px, 500).font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const typed = c.text.slice(0, Math.floor(seg(t, 0.75, 2.65) * c.text.length));
      const x0 = b.cx - b.w / 2 + 58;
      ctx.fillStyle = st.ink;
      ctx.fillText(typed, x0, MID.y + 2);
      if (t < 2.7 || (t * 1.8) % 1 < 0.55)
        ctx.fillRect(x0 + ctx.measureText(typed).width + 6, MID.y - 28, 4, 56);
      const br = 44 * (1 - 0.14 * press(t - click));
      const bx = b.cx + b.w / 2 - 68;
      const sent = t > click + 0.1;
      // On a slab that is itself the accent, the button stays in the slab's ink.
      const lit = sent && st.fill !== env.c.hot;
      ctx.fillStyle = lit ? env.c.hot : st.ink;
      ctx.beginPath();
      ctx.arc(bx, MID.y, br, 0, 7);
      ctx.fill();
      ctx.strokeStyle = lit ? env.c.onHot : st.fill;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, MID.y + 14);
      ctx.lineTo(bx, MID.y - 14);
      ctx.moveTo(bx - 13, MID.y - 1);
      ctx.lineTo(bx, MID.y - 14);
      ctx.lineTo(bx + 13, MID.y - 1);
      ctx.stroke();
      ctx.restore();
    }

    const go = feel.move(seg(t, 2.45, 3.3));
    const away = out(seg(t, click + 0.2, click + 0.9));
    pointer(
      ctx,
      lerp(MID.x + env.wide * 0.31, MID.x + rest.w / 2 - 64, go) + away * 150,
      lerp(960, MID.y + 6, go) - Math.sin(go * Math.PI) * 70 + away * 190,
      press(t - click),
      seg(t, 2.45, 2.7) * (1 - away),
    );
  },
});

/** The shape an entrance ends as, on its way into the next slide. */
export function entranceOut(
  ctx: Ctx,
  env: Env,
  from: Box,
  t: number,
  at: number,
  d: number,
  /** The shape's own fill, when it is not ink. It turns to ink as it goes. */
  fill?: string,
): Box {
  const go = env.feel.glide(t - at);
  const b = mix(from, env.into ? env.into.box : RING, go);
  ctx.save();
  if (env.glow) {
    ctx.shadowColor = rgba(env.dot, 0.7 * cl(go));
    ctx.shadowBlur = 70;
  }
  path(ctx, b);
  ctx.fillStyle = blend(fill ?? env.c.ink, env.dot, cl(go * 1.6));
  ctx.fill();
  ctx.restore();
  arrive(ctx, env, b, seg(t, d - 0.35, d - 0.05));
  return b;
}

register<InputContent>({
  kind: 'input',
  narrow: true,
  id: 'chat',
  name: 'Chat message',
  entry: { box: DOT },
  dur: (c) => (c.reply?.trim() ? 5.7 : 4.5),
  cues: (c) => [
    ...keys(0.6, 2.3, c.text.length),
    { at: 2.6, sound: 'pop' },
    ...(c.reply?.trim() ? [{ at: 3.3, sound: 'ding' as const }] : []),
  ],
  draw(ctx, t, d, env, c) {
    const { feel } = env;
    const leaveAt = c.reply?.trim() ? 4.9 : 3.7;
    const gone = env.plain ? 0 : seg(t, leaveAt, leaveAt + 0.25);
    const set = setting(env, 'text', 44, 500);
    ctx.font = set.font;
    const wide = Math.min(1300, env.wide - 340, ctx.measureText(c.text).width + 120);
    const st = stuff(env);
    const mine: Box = { cx: MID.x + 120, cy: MID.y - 80, w: wide, h: 124, r: Math.min(62, st.r) };
    const open = grown(env, feel.glide(t));
    const b = mix(DOT, mine, open);
    // The message is typed into a bubble in the brand's color, then a reply starts to come.
    ctx.save();
    ctx.globalAlpha = 1 - gone;
    ctx.translate(0, -40 * gone);
    path(ctx, b);
    ctx.fillStyle = blend(env.dot, env.c.hot, cl(open * 1.4));
    ctx.fill();
    path(ctx, b);
    ctx.clip();
    ctx.globalAlpha *= seg(t, 0.3, 0.5);
    ctx.fillStyle = env.c.onHot;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      c.text.slice(0, Math.floor(seg(t, 0.6, 2.3) * c.text.length)),
      b.cx - b.w / 2 + 60,
      b.cy + 2,
    );
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = seg(t, 0.4, 0.7) * (1 - gone);
    say(ctx, env, [c.label], MID.x, MID.y - 210, 34, t, {
      voice: 'text',
      color: dim(env),
      weight: 500,
      start: 0.4,
    });
    ctx.restore();

    // A reply comes: three dots, then its words. That bubble is what the next slide grows from.
    const pop = feel.pop(t - 2.6);
    if (pop <= 0) return;
    const words = c.reply?.trim() ?? '';
    const said = words ? feel.glide(t - 3.3) : 0;
    ctx.font = set.font;
    const full = Math.min(1300, env.wide - 270, ctx.measureText(words).width + 120);
    const reply: Box = {
      cx: MID.x - 300 + (lerp(230, full, said) - 230) / 2,
      cy: MID.y + 110,
      w: lerp(230, full, said) * pop,
      h: lerp(112, 124, said) * pop,
      r: Math.min(62, st.r),
    };
    if (t >= leaveAt && !env.plain) {
      entranceOut(
        ctx,
        env,
        { ...reply, w: lerp(230, full, said), h: lerp(112, 124, said) },
        t,
        leaveAt,
        d,
        st.fill,
      );
      return;
    }
    panel(ctx, env, reply);
    const dots = 1 - seg(t, 3.25, 3.4);
    for (let k = 0; k < 3 && dots > 0; k++) {
      const hop = Math.max(0, Math.sin((t - 2.6) * 7 - k * 0.9)) * 12;
      ctx.fillStyle = rgba(st.ink, dots);
      ctx.beginPath();
      ctx.arc(reply.cx - reply.w / 2 + (71 + k * 44) * pop, reply.cy - hop, 11 * pop, 0, 7);
      ctx.fill();
    }
    if (said > 0) {
      ctx.save();
      path(ctx, reply);
      ctx.clip();
      ctx.globalAlpha = seg(t, 3.4, 3.6);
      ctx.fillStyle = st.ink;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(words, reply.cx - reply.w / 2 + 60, reply.cy + 2);
      ctx.restore();
    }
  },
});

register<InputContent>({
  kind: 'input',
  narrow: true,
  id: 'terminal',
  name: 'Command line',
  entry: { box: DOT },
  dur: () => 4.15,
  // Enter sounds lower and louder than the keys before it.
  cues: (c) => [...keys(0.75, 2.4, c.text.length), { at: 2.6, sound: 'key', gain: 1.5, rate: 0.8 }],
  draw(ctx, t, d, env, c) {
    const { feel } = env;
    const enter = 2.6;
    const leaveAt = 3.4;
    const win: Box = { cx: MID.x, cy: MID.y, w: room(env, 1180, 100), h: 400, r: 28 };
    if (t >= leaveAt && !env.plain) {
      entranceOut(ctx, env, win, t, leaveAt, d);
      return;
    }
    const open = grown(env, feel.glide(t));
    const b = mix(DOT, win, open);
    const px = 40;
    ctx.save();
    ctx.shadowColor = env.c.shadow;
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 30;
    path(ctx, b);
    // The dot it grew from is ink. The window takes its own dark fill as it opens.
    // The terminal's own text is light, so its window stays dark under every look: a step off a
    // dark ground, or the terminal's own fill on a light one.
    const fill = env.look.dark ? blend(env.c.ground, env.c.ink, 0.07) : TERM.fill;
    ctx.fillStyle = blend(env.dot, fill, cl(open * 1.3));
    ctx.fill();
    ctx.restore();
    ctx.save();
    path(ctx, b);
    ctx.clip();
    ctx.globalAlpha = seg(t, 0.3, 0.55);
    const left = b.cx - b.w / 2;
    const top = b.cy - b.h / 2;
    termBar(ctx, left, top, b.w, px);
    const typed = c.text.slice(0, Math.floor(seg(t, 0.75, 2.4) * c.text.length));
    const first = top + termFirst(px);
    const blink = (t * 2) % 1 < 0.6 || (t > 2.4 && t < enter + 0.2);
    // Enter is pressed, and the caret drops to a fresh prompt as a command line does.
    termLine(ctx, left, first, px, '›', typed, { accent: env.c.hot, caret: t < enter && blink });
    if (t >= enter)
      termLine(ctx, left, first + termStep(px), px, '›', '', { accent: env.c.hot, caret: blink });
    ctx.restore();
  },
});

register<InputContent>({
  kind: 'input',
  narrow: true,
  id: 'compose',
  name: 'Write and send',
  entry: { box: DOT },
  dur: () => 4.4,
  cues: (c) => [...keys(0.8, 2.7, c.text.length), { at: 3.4, sound: 'click' }],
  draw(ctx, t, d, env, c) {
    const { feel } = env;
    const click = 3.4;
    const leaveAt = click + 0.25;
    const st = stuff(env);
    const win: Box = {
      cx: MID.x,
      cy: MID.y,
      w: room(env, 1220, 100),
      h: 540,
      r: Math.min(40, st.r),
    };
    if (t >= leaveAt && !env.plain) {
      entranceOut(ctx, env, win, t, leaveAt, d, st.fill);
      return;
    }
    const open = grown(env, feel.glide(t));
    const b = mix(DOT, win, open);
    panel(ctx, env, b);
    path(ctx, b);
    ctx.fillStyle = rgba(env.dot, 1 - cl(open * 1.6));
    ctx.fill();
    ctx.save();
    path(ctx, b);
    ctx.clip();
    ctx.globalAlpha = seg(t, 0.3, 0.55);
    const left = b.cx - b.w / 2 + 70;
    const top = b.cy - b.h / 2;
    // The top row says who it is for. The message under it is typed, then sent.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = setting(env, 'text', 36, 450).font;
    ctx.fillStyle = rgba(st.ink, 0.5);
    ctx.fillText('To', left, top + 86);
    ctx.font = setting(env, 'text', 34, 550).font;
    const who = ctx.measureText(env.brand).width + 56;
    ctx.fillStyle = rgba(st.ink, 0.12);
    ctx.beginPath();
    ctx.roundRect(left + 64, top + 54, who, 64, Math.min(32, st.r));
    ctx.fill();
    ctx.fillStyle = st.ink;
    ctx.fillText(env.brand, left + 92, top + 88);
    ctx.fillStyle = rgba(st.ink, 0.16);
    ctx.fillRect(left, top + 150, b.w - 140, 2);
    const set = setting(env, 'text', 54, 600);
    const lines = wrap(ctx, env, c.text, 54, b.w - 160, 'text').slice(0, 3);
    let typed = Math.floor(seg(t, 0.8, 2.7) * c.text.length);
    ctx.font = set.font;
    ctx.fillStyle = st.ink;
    lines.forEach((line, i) => {
      const here = line.slice(0, Math.max(0, typed));
      typed -= line.length + 1;
      ctx.fillText(here, left, top + 232 + i * 74);
    });
    const down = press(t - click);
    const send: Box = {
      cx: b.cx + b.w / 2 - 190,
      cy: top + b.h - 96,
      w: 240 * (1 - 0.06 * down),
      h: 88 * (1 - 0.06 * down),
      r: Math.min(44, st.r),
    };
    path(ctx, send);
    // On a slab that is itself the accent, the button is in the slab's ink.
    const slab = st.fill === env.c.hot;
    ctx.fillStyle = slab ? st.ink : env.c.hot;
    ctx.fill();
    ctx.fillStyle = slab ? st.fill : env.c.onHot;
    ctx.font = setting(env, 'text', 38, 620).font;
    ctx.textAlign = 'center';
    ctx.fillText('Send  →', send.cx, send.cy + 2);
    ctx.restore();
    const go = feel.move(seg(t, 2.5, click - 0.05));
    pointer(
      ctx,
      lerp(MID.x + env.wide * 0.34, send.cx + 50, go),
      lerp(1000, send.cy + 26, go),
      down,
      seg(t, 2.5, 2.75),
    );
  },
});

/** How a Build-up ends: a disc in the hot color with a tick, which becomes the next slide's shape. */
export function doneDisc(
  ctx: Ctx,
  env: Env,
  t: number,
  done: number,
  turn: number,
  R: number,
): void {
  const fill = env.feel.pop(t - done);
  if (fill <= 0) return;
  const disc: Box = { cx: MID.x, cy: MID.y, w: R * 2 * fill, h: R * 2 * fill, r: R };
  // With no shape to turn into, the disc swells a little and thins away over most of a second,
  // so the slide ends on a soft beat and not on a quick fade.
  const off = env.into ? 0 : env.feel.move(seg(t, turn, turn + 0.75));
  const grow = 1 + 0.4 * off;
  const b = env.into
    ? toward(env, disc, env.feel.glide(t - turn))
    : { ...disc, w: disc.w * grow, h: disc.h * grow, r: R * grow };
  ctx.save();
  ctx.globalAlpha = env.into ? 1 : (1 - off) * (1 - env.out);
  path(ctx, b);
  ctx.fillStyle = env.c.hot;
  ctx.fill();
  ctx.restore();
  arrive(ctx, env, b, seg(t, turn + 0.05, turn + 0.45));
  const tick = seg(t, done + 0.08, done + 0.42);
  const gone = 1 - seg(t, turn, turn + (env.into ? 0.18 : 0.3));
  if (tick <= 0 || gone <= 0) return;
  const k = R / 170;
  ctx.strokeStyle = rgba(env.c.onHot, gone);
  ctx.lineWidth = 19 * k;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(MID.x - 58 * k, MID.y + 6 * k);
  const a = Math.min(1, tick * 2.2);
  ctx.lineTo(MID.x + (-58 + 40 * a) * k, MID.y + (6 + 40 * a) * k);
  if (tick > 0.45) {
    const q = (tick - 0.45) / 0.55;
    ctx.lineTo(MID.x + (-18 + 80 * q) * k, MID.y + (46 - 88 * q) * k);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

// ---------------------------------------------------------------- working

export interface WorkingContent {
  steps: string[];
}

// ---------------------------------------------------------------- media wall

export interface WallContent {
  label: string;
}

const PICK_AT = 3.35;
const LIFT_AT = 3.7;
/** Seconds a wall saves by starting already formed. */
const HEAD_START = 0.8;

function wallLabel(ctx: Ctx, env: Env, text: string, t: number): void {
  ctx.save();
  ctx.globalAlpha = seg(t, 0.7, 1.0) * (1 - seg(t, PICK_AT, PICK_AT + 0.3));
  const set = setting(env, 'mono', 22);
  ctx.font = set.font;
  (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${set.track}px`;
  const label = text.toUpperCase();
  const lw = ctx.measureText(label).width + 44;
  ctx.fillStyle = env.c.ink;
  ctx.beginPath();
  // In a tall frame the label keeps near the top of what shows.
  ctx.translate(0, -env.tall * 0.8);
  ctx.roundRect(MID.x - lw / 2, 44, lw, 46, 23);
  ctx.fill();
  ctx.fillStyle = env.c.onInk;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, MID.x + 2, 68);
  (ctx as Ctx & { letterSpacing: string }).letterSpacing = '0px';
  ctx.restore();
}

/** The end of a wall: a cursor presses the picked picture and it lifts into the next scene. */
function pickAndLift(ctx: Ctx, env: Env, t: number, from: Box, media: number, shown: number): void {
  const lift = env.feel.glide(t - LIFT_AT);
  const b = toward(env, from, lift);
  card(
    ctx,
    env,
    b,
    env.media(media),
    cl(lift) * (env.into?.chrome ?? 0),
    shown * (env.into ? 1 : 1 - env.out),
  );
}

function pickPointer(ctx: Ctx, env: Env, t: number, target: Box): void {
  const go = env.feel.move(seg(t, 2.75, PICK_AT - 0.05));
  const away = out(seg(t, PICK_AT + 0.25, PICK_AT + 0.9));
  pointer(
    ctx,
    lerp(MID.x + env.wide * 0.34, target.cx + 40, go) + away * 200,
    lerp(1000, target.cy + 30, go) + away * 260,
    press(t - PICK_AT),
    seg(t, 2.75, 2.95) * (1 - away),
  );
}

/** How every wall ends: the press on the picked picture, then its lift into the next slide.
 *  `early` is how much sooner a wall with a head start gets there. */
const wallCues = (opening: Cue[], early = 0): Cue[] => [
  ...opening,
  { at: PICK_AT - early, sound: 'click' },
  { at: LIFT_AT - early, sound: 'whoosh' },
];

const PITCH = { x: 448, y: 288 };

register<WallContent>({
  kind: 'wall',
  narrow: true,
  id: 'grid',
  name: 'Grid that whips',
  entry: { box: TILE, media: 2 },
  dur: () => 5.2,
  cues: () =>
    wallCues([
      { at: 0.05, sound: 'slide' },
      { at: 2.2, sound: 'whoosh' },
    ]),
  draw(ctx, t, _d, env, c) {
    const { feel } = env;
    const picked = env.into?.media ?? 0;
    const shift = (r: number, at: number) =>
      (r % 2 === 0 ? 1 : -1) * (18 * at + PITCH.x * 2 * feel.move(seg(at, 2.2, 2.9)));
    const delayOf = (col: number, r: number) =>
      col === 0 && r === 0 ? -9 : 0.05 + Math.hypot(col, r * 0.8) * 0.07;
    const spot = (col: number, r: number, at: number): Box => {
      const a = feel.glide(at - delayOf(col, r));
      const s = lerp(0.55, 1, a);
      return {
        cx: MID.x + (col * PITCH.x + shift(r, at)) * a,
        cy: MID.y + r * PITCH.y * a,
        w: TILE.w * s,
        h: TILE.h * s,
        r: TILE.r,
      };
    };
    const cam = lerp(1, 0.93, out(seg(t, 0, 1.6))) + 0.07 * feel.move(seg(t, PICK_AT, 4.0));
    const fade = 1 - feel.move(seg(t, PICK_AT + 0.1, 4.05));
    turned(ctx, MID.x, MID.y, 0, cam, () => {
      // Three rows fill a 16:9 frame. A taller one gets more above and below.
      const rows = 1 + Math.ceil(env.tall / PITCH.y);
      for (let r = -rows; r <= rows; r++) {
        for (let col = -6; col <= 6; col++) {
          if (r === 0 && col === -2) continue;
          const b = spot(col, r, t);
          if (b.cx < -300 || b.cx > W + 300) continue;
          const s = lerp(0.94, 1, fade);
          card(
            ctx,
            env,
            { ...b, w: b.w * s, h: b.h * s },
            env.media(col + 2 + r * 3),
            0,
            seg(t - delayOf(col, r), 0, 0.2) * fade,
          );
        }
      }
      pickAndLift(
        ctx,
        env,
        t,
        spot(-2, 0, Math.min(t, LIFT_AT)),
        picked,
        seg(t - delayOf(-2, 0), 0, 0.2),
      );
    });
    wallLabel(ctx, env, c.label, t);
    pickPointer(ctx, env, t, spot(-2, 0, PICK_AT));
  },
});

const BIG = { w: 640, h: 400, pitch: 690, far: 6 };

register<WallContent>({
  kind: 'wall',
  narrow: true,
  id: 'reel',
  name: 'Reel that lands',
  entry: { box: TILE, media: 2 },
  dur: () => 5.2,
  cues: () => wallCues([{ at: 0.25, sound: 'whoosh' }]),
  draw(ctx, t, _d, env, c) {
    const { feel } = env;
    const picked = env.into?.media ?? 0;
    const open = feel.glide(t);
    // The row runs fast, slows, and stops with the picked picture in the middle.
    const run = 1 - (1 - seg(t, 0.25, 2.95)) ** 4;
    const offset = -BIG.pitch * BIG.far * run;
    const fade = 1 - feel.move(seg(t, PICK_AT + 0.1, 4.05));
    const spot = (j: number, off: number): Box => {
      const x = MID.x + j * BIG.pitch * open + off;
      const s = 1 - 0.16 * Math.min(1, Math.abs(x - MID.x) / 900);
      return {
        cx: x,
        cy: MID.y,
        w: lerp(TILE.w, BIG.w, open) * s,
        h: lerp(TILE.h, BIG.h, open) * s,
        r: 30,
      };
    };
    for (let j = -2; j <= BIG.far + 2; j++) {
      if (j === BIG.far) continue;
      const b = spot(j, offset);
      if (b.cx < -400 || b.cx > W + 400) continue;
      card(
        ctx,
        env,
        b,
        env.media(j + 2 === picked ? j + 3 : j + 2),
        0,
        (j === 0 ? 1 : seg(t, 0.05, 0.3)) * fade,
      );
    }
    const lead = spot(BIG.far, offset);
    if (lead.cx < W + 400) pickAndLift(ctx, env, t, lead, picked, seg(t, 0.05, 0.3));
    wallLabel(ctx, env, c.label, t);
    pickPointer(ctx, env, t, spot(BIG.far, -BIG.pitch * BIG.far));
  },
});

register<WallContent>({
  kind: 'wall',
  narrow: true,
  id: 'tilt',
  name: 'Tilted wall',
  dur: () => 5.2 - HEAD_START,
  cues: () => wallCues([], HEAD_START),
  draw(ctx, t, _d, env, c) {
    const { feel } = env;
    const picked = env.into?.media ?? 0;
    // The whole wall fades in at once, already leaning back like a table top. It has no opening
    // where one picture stands alone or the pictures spread out, so its pick and lift come sooner.
    const u = t + HEAD_START;
    const lean = feel.move(seg(t, 0, 0.35)) * (1 - feel.move(seg(u, 2.5, 3.25)));
    const fade = 1 - feel.move(seg(u, PICK_AT + 0.1, 4.05));
    const spot = (col: number, r: number, at: number): Box => ({
      cx: MID.x + col * PITCH.x + (r % 2 === 0 ? -1 : 1) * 46 * Math.min(at, LIFT_AT - HEAD_START),
      cy: MID.y + r * PITCH.y,
      w: TILE.w,
      h: TILE.h,
      r: TILE.r,
    });
    const shown = seg(t, 0, 0.3);
    ctx.save();
    ctx.translate(MID.x, MID.y);
    ctx.transform(1 + 0.1 * lean, -0.16 * lean, 0.42 * lean, 1 - 0.1 * lean, 0, 0);
    ctx.translate(-MID.x, -MID.y);
    const rows = 3 + Math.ceil(env.tall / PITCH.y);
    for (let r = -rows; r <= rows; r++) {
      for (let col = -6; col <= 6; col++) {
        if (r === 0 && col === 1) continue;
        const b = spot(col, r, t);
        if (b.cx < -700 || b.cx > W + 700) continue;
        const mine = r === 0 && col === 0;
        card(ctx, env, b, env.media(mine ? 2 : col + 2 + r * 3), 0, shown * fade);
      }
    }
    pickAndLift(ctx, env, u, spot(1, 0, t), picked, shown);
    ctx.restore();
    wallLabel(ctx, env, c.label, u);
    pickPointer(ctx, env, u, spot(1, 0, PICK_AT - HEAD_START));
  },
});

const HAND = { w: 520, h: 330, cards: 7, step: 10.5, radius: 1500 };

register<WallContent>({
  kind: 'wall',
  narrow: true,
  id: 'fan',
  name: 'Fan of cards',
  entry: { box: TILE, media: 2 },
  dur: () => 5.2,
  cues: () =>
    wallCues([
      { at: 0.2, sound: 'slide' },
      { at: 1.8, sound: 'slide' },
    ]),
  draw(ctx, t, _d, env, c) {
    const { feel } = env;
    const picked = env.into?.media ?? 0;
    const open = feel.glide(t - 0.2);
    // The hand slides along by one card, which puts the picked one upright in the middle.
    const turn = feel.move(seg(t, 1.8, 2.6));
    const fade = 1 - feel.move(seg(t, PICK_AT + 0.1, 4.05));
    const mid = (HAND.cards - 1) / 2;
    const place = (i: number) => {
      const k = (i - mid - turn) * open;
      const deg = k * HAND.step;
      const rad = (deg * Math.PI) / 180;
      const box: Box = {
        cx: MID.x + Math.sin(rad) * HAND.radius,
        cy: MID.y + 70 * open + (1 - Math.cos(rad)) * HAND.radius,
        w: lerp(TILE.w, HAND.w, open),
        h: lerp(TILE.h, HAND.h, open),
        r: 28,
      };
      return { box, deg, k };
    };
    const lead = mid + 1;
    // Outer cards first, so the ones nearer the middle lie on top.
    const order = Array.from({ length: HAND.cards }, (_, i) => i)
      .filter((i) => i !== lead)
      .sort((a, b) => Math.abs(place(b).k) - Math.abs(place(a).k));
    for (const i of order) {
      const p = place(i);
      const b = { ...p.box, cy: p.box.cy + 260 * (1 - fade) };
      turned(ctx, b.cx, b.cy, p.deg, 1, () =>
        card(ctx, env, b, env.media(i === mid ? 2 : i + 3), 0, fade),
      );
    }
    const mine = place(lead);
    if (t < PICK_AT) {
      turned(ctx, mine.box.cx, mine.box.cy, mine.deg, 1, () =>
        card(ctx, env, mine.box, env.media(picked), 0, seg(t, 0.2, 0.45)),
      );
    } else pickAndLift(ctx, env, t, mine.box, picked, 1);
    wallLabel(ctx, env, c.label, t);
    pickPointer(ctx, env, t, { ...mine.box, cx: MID.x, cy: MID.y + 70 });
  },
});

/** Where each floating picture rests, as a share of the frame, and how near it is. */
const FLOATS: [x: number, y: number, depth: number][] = [
  [0.13, 0.2, 0.62],
  [0.86, 0.17, 0.7],
  [0.07, 0.72, 0.8],
  [0.9, 0.8, 0.66],
  [0.31, 0.86, 0.95],
  [0.7, 0.12, 0.9],
  [0.13, 0.47, 1.08],
  [0.86, 0.52, 1.16],
];

register<WallContent>({
  kind: 'wall',
  narrow: true,
  id: 'float',
  name: 'Floating pictures',
  entry: { box: TILE, media: 2 },
  dur: () => 5.2,
  cues: () => wallCues([{ at: 0.05, sound: 'slide' }]),
  draw(ctx, t, _d, env, c) {
    const { feel } = env;
    const picked = env.into?.media ?? 0;
    const fade = 1 - feel.move(seg(t, PICK_AT + 0.1, 4.05));
    const lead = FLOATS.length - 1;
    const place = (i: number, at: number): Box => {
      const [x, level, depth] = FLOATS[i];
      // In a narrow frame the pictures beside the label would cover it, so they rest above and
      // below its lines instead, and every picture is a little smaller.
      const beside = tight(env) && Math.abs(level - 0.5) < 0.1;
      const y = beside ? level + (level < 0.5 ? -0.17 : 0.17) : level;
      const small = tight(env) ? 0.74 : 1;
      const a = feel.glide(at - 0.05 - i * 0.05);
      // Near pictures drift further than far ones, which is what gives the frame its depth.
      const push = 1 + 0.07 * depth * (at / 5.2);
      const sway = at * (0.5 + depth * 0.2) + i * 1.7;
      return {
        cx: MID.x + ((x - 0.5) * env.wide * push + Math.sin(sway) * 16 * depth) * a,
        cy:
          MID.y + ((y - 0.5) * (H + env.tall * 1.6) * push + Math.cos(sway * 0.8) * 12 * depth) * a,
        w: TILE.w * lerp(1, depth * 1.05 * small, a),
        h: TILE.h * lerp(1, depth * 1.05 * small, a),
        r: TILE.r,
      };
    };
    FLOATS.forEach(([, , depth], i) => {
      if (i === lead) return;
      const far = Math.max(0, 0.95 - depth) * feel.glide(t - 0.3);
      const src = env.media(i === lead - 1 ? 2 : i + 3);
      hazy(ctx, env, place(i, t), feel.blur ? far * 22 : 0, src, fade * (1 - far * 0.9));
    });
    // The label is the middle of the frame here, set large, with the pictures around it.
    ctx.save();
    ctx.globalAlpha = 1 - seg(t, PICK_AT - 0.1, PICK_AT + 0.25);
    const words = wrap(ctx, env, c.label, 84, Math.min(720, env.wide - 260)).slice(0, 4);
    say(ctx, env, words, MID.x, MID.y - 20, 84, t, {
      start: 0.7,
      stagger: 0.07,
    });
    ctx.restore();
    pickAndLift(ctx, env, t, place(lead, Math.min(t, LIFT_AT)), picked, seg(t, 0.1, 0.35));
    pickPointer(ctx, env, t, place(lead, PICK_AT));
  },
});

let haze: HTMLCanvasElement | null = null;

/** A card out of focus. It is drawn small and stretched back up, which softens it for a fraction
 *  of what a blur filter costs on every far card of every frame. */
function hazy(
  ctx: Ctx,
  env: Env,
  b: Box,
  blur: number,
  src: Parameters<typeof card>[3],
  alpha: number,
): void {
  if (blur < 0.6) {
    card(ctx, env, b, src, 0, alpha);
    return;
  }
  haze ??= document.createElement('canvas');
  const g = haze.getContext('2d');
  if (!g) return;
  // Sized in the frame's own pixels, with room around the card for its shadow.
  const k = ctx.getTransform().a / (1 + blur * 0.35);
  const pad = 90;
  const x0 = b.cx - b.w / 2 - pad;
  const y0 = b.cy - b.h / 2 - pad;
  haze.width = Math.max(2, Math.ceil((b.w + pad * 2) * k));
  haze.height = Math.max(2, Math.ceil((b.h + pad * 2) * k));
  g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  card(g, env, b, src, 0, 1);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(haze, x0, y0, b.w + pad * 2, b.h + pad * 2);
  ctx.restore();
}

const RINGED = { w: 520, h: 330, cards: 9, step: 0.4, radius: 1180 };

register<WallContent>({
  kind: 'wall',
  narrow: true,
  id: 'carousel',
  name: 'Curved carousel',
  entry: { box: TILE, media: 2 },
  dur: () => 5.2,
  cues: () => wallCues([{ at: 0.2, sound: 'whoosh' }]),
  draw(ctx, t, _d, env, c) {
    const { feel } = env;
    const picked = env.into?.media ?? 0;
    const open = feel.glide(t - 0.1);
    // The cards stand on a wide ring that turns, slows, and stops with the picked one facing us.
    const spin = (1 - seg(t, 0.2, 2.95)) ** 3 * 2.6;
    const fade = 1 - feel.move(seg(t, PICK_AT + 0.1, 4.05));
    const mid = (RINGED.cards - 1) / 2;
    const place = (i: number) => {
      const a = ((i - mid) * RINGED.step + spin) * open;
      const depth = Math.cos(a);
      const s = lerp(0.6, 1, (depth + 1) / 2);
      const box: Box = {
        cx: MID.x + Math.sin(a) * RINGED.radius * open,
        cy: MID.y - 10,
        // A card turned away from us shows narrower.
        w: lerp(TILE.w, RINGED.w * s * Math.max(0.25, Math.abs(depth)), open),
        h: lerp(TILE.h, RINGED.h * s, open),
        r: 26,
      };
      return { box, depth };
    };
    const order = Array.from({ length: RINGED.cards }, (_, i) => i)
      .filter((i) => i !== mid && place(i).depth > -0.2)
      .sort((x, y) => place(x).depth - place(y).depth);
    for (const i of order) {
      const p = place(i);
      const shown = fade * lerp(0.35, 1, (p.depth + 1) / 2);
      card(ctx, env, p.box, env.media(i + 3), 0, shown);
      // A faint copy below, as on a polished floor.
      ctx.save();
      ctx.translate(0, p.box.cy * 2 + p.box.h + 14);
      ctx.scale(1, -1);
      ctx.beginPath();
      ctx.rect(p.box.cx - p.box.w / 2, p.box.cy + p.box.h * 0.15, p.box.w, p.box.h * 0.35);
      ctx.clip();
      card(ctx, env, p.box, env.media(i + 3), 0, shown * 0.16 * cl(open));
      ctx.restore();
    }
    const lead = place(mid);
    // The picture it opened from stays on top until the ring has formed.
    const first = 1 - seg(t, 0.1, 0.45);
    pickAndLift(ctx, env, t, lead.box, picked, 1);
    if (first > 0) card(ctx, env, lead.box, env.media(2), 0, first);
    wallLabel(ctx, env, c.label, t);
    pickPointer(ctx, env, t, { ...lead.box, cx: MID.x });
  },
});

// ---------------------------------------------------------------- features

export interface Feature {
  title: string;
  body: string;
  /** A few words for the small badge on the screenshot. */
  tag: string;
  /** Which of the video's pictures it shows. Absent, its own place in the list. */
  pic?: number;
}

export interface FeaturesContent {
  items: Feature[];
  /** The first item's picture, which the slide before ends on. */
  lead?: number;
}

const SPAN = 3.4;

/** The small live piece of interface on a feature's screenshot: a switch, notices, or a chart. */
function widget(ctx: Ctx, env: Env, kind: number, tag: string, lt: number, hero: Box): void {
  const { feel, c } = env;
  const pop = feel.pop(lt - 0.95);
  if (pop <= 0 || !tag.trim()) return;
  const x = hero.cx - hero.w / 2 - 74;
  const bottom = hero.cy + hero.h / 2 + 34;
  const on = c.hot === c.chip || c.hot === c.chipInk ? c.ground : c.hot;
  ctx.save();
  ctx.globalAlpha *= seg(lt, 0.95, 1.1);
  ctx.font = setting(env, 'text', 28, 550).font;
  const tw = ctx.measureText(tag).width;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  if (kind === 0) {
    const w = tw + 170;
    const flip = feel.pop(lt - 1.75);
    ctx.save();
    chip(ctx, env, x, bottom - 92, w, 92, pop);
    ctx.fillStyle = c.chipInk;
    ctx.fillText(tag, 30, 47);
    ctx.fillStyle = blend(blend(c.chip, c.chipInk, 0.25), on, cl(flip));
    ctx.beginPath();
    ctx.roundRect(w - 108, 26, 78, 40, 20);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(w - 88 + 38 * flip, 46, 15, 0, 7);
    ctx.fill();
    ctx.restore();
    const go = feel.move(seg(lt, 1.15, 1.7));
    pointer(
      ctx,
      lerp(x + w + 240, x + w - 62, go),
      lerp(bottom + 150, bottom - 40, go),
      press(lt - 1.72),
      seg(lt, 1.15, 1.3) * (1 - seg(lt, 2.1, 2.5)),
    );
  } else if (kind === 1) {
    const w = Math.max(tw + 120, 300);
    ctx.save();
    chip(ctx, env, x, bottom - 92, w, 92, pop);
    ctx.fillStyle = on;
    ctx.beginPath();
    ctx.arc(46, 46, 19, 0, 7);
    ctx.fill();
    // The tick draws itself a moment after the badge appears.
    const tick = seg(lt, 1.3, 1.6);
    if (tick > 0) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(38, 47);
      ctx.lineTo(38 + 6 * Math.min(1, tick * 2), 47 + 6 * Math.min(1, tick * 2));
      if (tick > 0.5) ctx.lineTo(44 + 11 * (tick * 2 - 1), 53 - 13 * (tick * 2 - 1));
      ctx.stroke();
    }
    ctx.fillStyle = c.chipInk;
    ctx.fillText(tag, 80, 47);
    ctx.restore();
  } else {
    const w = Math.max(tw + 90, 330);
    ctx.save();
    chip(ctx, env, x, bottom - 170, w, 170, pop);
    ctx.fillStyle = c.chipInk;
    ctx.font = setting(env, 'text', 34, 600).font;
    ctx.fillText(tag, 30, 48);
    const ys = [0.2, 0.28, 0.22, 0.4, 0.36, 0.55, 0.62, 0.8, 1];
    const n = (ys.length - 1) * out(seg(lt, 1.2, 2.2));
    const k = Math.floor(n);
    ctx.beginPath();
    for (let j = 0; j <= k; j++)
      ctx.lineTo(30 + (j / (ys.length - 1)) * (w - 60), 146 - ys[j] * 62);
    if (k < ys.length - 1)
      ctx.lineTo(30 + (n / (ys.length - 1)) * (w - 60), 146 - lerp(ys[k], ys[k + 1], n - k) * 62);
    ctx.strokeStyle = on;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

interface FeatureLayout {
  hero: Box;
  /** Where the words sit. `max` is the widest a line may run. */
  text: {
    x: number;
    y: number;
    align: 'left' | 'center';
    max: number;
    title: number;
    body: number;
  };
  /** Where the screenshot before this one leaves to, and the next one comes from. */
  swap: { x: number; y: number };
  /** Shows the screenshots still to come as a deck going back behind the one showing. */
  deck?: boolean;
  pips: { x: number; y: number };
}

/** The layout for a frame that shows `wide` of the slide and `tall` beyond it above and below.
 *  A 16:9 frame keeps the style's own. A tall one has no room beside the screenshot, so every
 *  style stacks: the screenshot on top, the words centered under it. */
function featureLayout(lay: FeatureLayout, wide: number, tall: number): FeatureLayout {
  if (wide >= W) return lay;
  // A deck's cards go back to the left of the one showing, so it is narrower and sits to the
  // right, which leaves them room inside the frame.
  const fan = lay.deck ? 250 : 0;
  const w = wide - 220 - fan;
  const h = Math.min(w * 0.62, H + tall * 2 - 760);
  const top = MID.y - (h + 520) / 2;
  const y = top + h + 250;
  return {
    hero: { cx: MID.x + fan / 2, cy: top + h / 2, w: Math.min(w, h / 0.62), h, r: 28 },
    text: { x: MID.x, y, align: 'center', max: wide - 170, title: 96, body: 38 },
    // It still comes in from the side the style brings it from.
    swap: { x: Math.sign(lay.swap.x) * wide, y: lay.swap.x ? 0 : -(h + 300) },
    deck: lay.deck,
    pips: { x: MID.x, y: y + 250 },
  };
}

function features(base: FeatureLayout) {
  return (ctx: Ctx, t: number, d: number, env: Env, c: FeaturesContent): void => {
    const lay = featureLayout(base, env.wide, env.tall);
    const { feel } = env;
    const n = c.items.length;
    const i = Math.min(n - 1, Math.floor(t / SPAN));
    const lt = t - i * SPAN;
    const f = c.items[i];
    // It floats on the slide's own clock, so it starts from where the slide before set it down.
    const hero: Box = { ...lay.hero, cy: lay.hero.cy + Math.sin(t * 1.3) * 6 * (1 - env.out) };
    const tx = lay.text;

    const wordsOut = i < n - 1 ? feel.move(seg(lt, SPAN - 0.35, SPAN)) : env.out;
    ctx.save();
    ctx.globalAlpha = 1 - wordsOut;
    ctx.translate(0, -24 * wordsOut);
    if (feel.blur && wordsOut > 0.01) ctx.filter = `blur(${(10 * wordsOut).toFixed(1)}px)`;
    const start = i === 0 ? 0.45 : 0.2;
    const titles = wrap(ctx, env, f.title, tx.title, tx.max).slice(0, 3);
    const bodies = wrap(ctx, env, f.body, tx.body, tx.max * 0.92, 'text').slice(0, 3);
    const set = setting(env, 'display', tx.title);
    const pitch = set.size * set.lead;
    const top = tx.y - ((titles.length - 1) * pitch) / 2 - (bodies.length - 1) * tx.body * 0.7;
    kicker(ctx, env, `0${i + 1} / 0${n}`, tx.x, top - set.size * 1.22, lt, tx.align, start);
    say(ctx, env, titles, tx.x, top, tx.title, lt, {
      align: tx.align,
      start: start + 0.08,
      stagger: 0.09,
    });
    say(ctx, env, bodies, tx.x, top + (titles.length - 1) * pitch + tx.body * 2.3, tx.body, lt, {
      voice: 'text',
      align: tx.align,
      color: dim(env),
      start: start + 0.35,
      stagger: 0.025,
    });
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = seg(t, 0.6, 0.9) * (1 - env.out);
    const px = lay.pips.x - (tx.align === 'center' ? (n * 76 - 14) / 2 : 0);
    for (let k = 0; k < n; k++) {
      ctx.fillStyle = rgba(env.c.ink, 0.18);
      ctx.beginPath();
      ctx.roundRect(px + k * 76, lay.pips.y, 62, 5, 2.5);
      ctx.fill();
      const p = k < i ? 1 : k === i ? cl(lt / SPAN) : 0;
      if (p > 0) {
        ctx.fillStyle = env.c.hot;
        ctx.beginPath();
        ctx.roundRect(px + k * 76, lay.pips.y, 62 * p, 5, 2.5);
        ctx.fill();
      }
    }
    ctx.restore();

    if (lay.deck) {
      // Furthest first, so each card of the deck lies on the one behind it.
      for (let k = Math.min(3, n - 1 - i); k >= 1; k--) {
        const settle = feel.glide(lt - 0.1 - k * 0.06);
        // On the first screen the deck fans out from behind it, so the one window the slide
        // opens on is not joined by three more in a single frame.
        const back = i === 0 ? k * Math.max(0, settle) : k - (1 - Math.min(1, settle));
        const s = 1 - 0.07 * back;
        const b = { ...hero, cx: hero.cx - 104 * back, w: hero.w * s, h: hero.h * s };
        card(
          ctx,
          env,
          b,
          env.media(c.items[i + k].pic ?? i + k),
          1,
          (0.92 - 0.2 * back) * (1 - env.out),
        );
      }
    }
    // The screenshot: the last one leaves as the next swings in.
    if (i > 0 && lt < 0.5) {
      const q = feel.move(seg(lt, 0, 0.5));
      const b = { ...hero, cx: hero.cx - lay.swap.x * 0.7 * q, cy: hero.cy - lay.swap.y * 0.7 * q };
      turned(ctx, b.cx, b.cy, -4 * q, 1 - 0.14 * q, () =>
        card(ctx, env, b, env.media(c.items[i - 1].pic ?? i - 1), 1, 1 - q),
      );
    }
    const inn = i === 0 ? 1 : feel.glide(lt - 0.08);
    if (inn <= 0) return;
    if (env.out > 0) {
      const b = toward(env, hero, env.out);
      card(
        ctx,
        env,
        b,
        env.media(f.pic ?? i),
        1 - env.out,
        env.into ? 1 - seg(env.out, 0.5, 0.9) : 1 - env.out,
      );
      arrive(ctx, env, b, seg(env.out, 0.45, 0.85));
      return;
    }
    const b = {
      ...hero,
      cx: hero.cx + lay.swap.x * (1 - inn),
      cy: hero.cy + lay.swap.y * (1 - inn),
    };
    turned(ctx, b.cx, b.cy, 5 * (1 - inn), lerp(0.84, 1, inn), () =>
      card(ctx, env, b, env.media(f.pic ?? i), 1, i === 0 ? 1 : seg(lt, 0.08, 0.3)),
    );
    ctx.save();
    ctx.globalAlpha =
      i < n - 1
        ? 1 - seg(lt, SPAN - 0.3, SPAN - 0.05)
        : 1 - seg(t, d - env.feel.exit - 0.25, d - env.feel.exit);
    widget(ctx, env, i % 3, f.tag, lt, b);
    ctx.restore();
  };
}

const featureDur = (c: FeaturesContent) => c.items.length * SPAN + 0.3;
const featureCues = (c: FeaturesContent): Cue[] =>
  c.items.flatMap((f, i) => {
    const at = i * SPAN;
    const badge = f.tag.trim();
    return [
      ...(i > 0 ? [{ at: at + 0.05, sound: 'slide' as const }] : []),
      ...(badge ? [{ at: at + 0.95, sound: 'pop' as const }] : []),
      // Every third badge is a switch that a cursor flips.
      ...(badge && i % 3 === 0 ? [{ at: at + 1.72, sound: 'click' as const }] : []),
    ];
  });
const HERO_LEFT: Box = { ...HERO, cx: W - HERO.cx + 40 };
const STAGE: Box = { cx: MID.x, cy: 400, w: 980, h: 552, r: 28 };
const HERO_DECK: Box = { cx: 1450, cy: 540, w: 780, h: 490, r: 28 };
const SPLIT: FeatureLayout = {
  hero: HERO,
  text: { x: 130, y: 540, align: 'left', max: 740, title: 112, body: 38 },
  swap: { x: 760, y: 0 },
  pips: { x: 132, y: 900 },
};
const FLIP: FeatureLayout = {
  hero: HERO_LEFT,
  text: { x: 1100, y: 540, align: 'left', max: 720, title: 104, body: 38 },
  swap: { x: -760, y: 0 },
  pips: { x: 1102, y: 900 },
};
const STAGED: FeatureLayout = {
  hero: STAGE,
  text: { x: MID.x, y: 860, align: 'center', max: 1500, title: 84, body: 34 },
  swap: { x: 0, y: -760 },
  pips: { x: MID.x, y: 1030 },
};
const DECK: FeatureLayout = {
  hero: HERO_DECK,
  text: { x: 130, y: 540, align: 'left', max: 620, title: 100, body: 36 },
  swap: { x: 700, y: 0 },
  pips: { x: 132, y: 900 },
  deck: true,
};

register<FeaturesContent>({
  kind: 'features',
  narrow: true,
  id: 'split',
  name: 'Words left, screen right',
  entry: { box: HERO, media: 0, chrome: 1 },
  dur: featureDur,
  cues: featureCues,
  entryFor: (wide, tall) => ({
    box: featureLayout(SPLIT, wide, tall).hero,
    media: 0,
    chrome: 1,
  }),
  draw: features(SPLIT),
});

register<FeaturesContent>({
  kind: 'features',
  narrow: true,
  id: 'flip',
  name: 'Screen left, words right',
  entry: { box: HERO_LEFT, media: 0, chrome: 1 },
  dur: featureDur,
  cues: featureCues,
  entryFor: (wide, tall) => ({
    box: featureLayout(FLIP, wide, tall).hero,
    media: 0,
    chrome: 1,
  }),
  draw: features(FLIP),
});

register<FeaturesContent>({
  kind: 'features',
  narrow: true,
  id: 'stage',
  name: 'Screen on top, words under',
  entry: { box: STAGE, media: 0, chrome: 1 },
  dur: featureDur,
  cues: featureCues,
  entryFor: (wide, tall) => ({
    box: featureLayout(STAGED, wide, tall).hero,
    media: 0,
    chrome: 1,
  }),
  draw: features(STAGED),
});

register<FeaturesContent>({
  kind: 'features',
  narrow: true,
  id: 'deck',
  name: 'Deck of screens',
  entry: { box: HERO_DECK, media: 0, chrome: 1 },
  dur: featureDur,
  cues: featureCues,
  entryFor: (wide, tall) => ({
    box: featureLayout(DECK, wide, tall).hero,
    media: 0,
    chrome: 1,
  }),
  draw: features(DECK),
});

// ---------------------------------------------------------------- numbers

export interface StatsContent {
  items: { value: string; label: string }[];
}

const STAT = 1.8;
const statsOf = (c: StatsContent) => c.items.filter((s) => s.value);

/** The dot the scene came from bursts, and at the end grows into the next scene. */
function seedInOut(ctx: Ctx, env: Env, t: number): void {
  const pulse = out(seg(t, 0, 0.7));
  // The pulse answers the dot the slide grew from, so there is none when nothing handed it one.
  if (pulse < 1 && !env.plain) {
    ctx.strokeStyle = rgba(env.dot, 0.5 * (1 - pulse));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(MID.x, MID.y, 12 + 340 * pulse, 0, 7);
    ctx.stroke();
    ctx.fillStyle = rgba(env.dot, 1 - seg(t, 0, 0.18));
    ctx.beginPath();
    ctx.arc(MID.x, MID.y, 12, 0, 7);
    ctx.fill();
  }
  seedOut(ctx, env);
}

function bigNumber(
  ctx: Ctx,
  env: Env,
  value: string,
  x: number,
  y: number,
  size: number,
  p: number,
): void {
  const set = setting(env, 'display', size);
  ctx.font = set.font;
  (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${set.track}px`;
  const full = ctx.measureText(value).width;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // The figure is the point of the slide, so it is set in the brand's color.
  ctx.fillStyle = env.c.hot;
  ctx.fillText(counted(value, p), x - full / 2, y);
  (ctx as Ctx & { letterSpacing: string }).letterSpacing = '0px';
}

register<StatsContent>({
  kind: 'stats',
  narrow: true,
  id: 'count',
  name: 'One at a time',
  entry: { box: SEED },
  dur: (c) => statsOf(c).length * STAT + 0.8,
  // A figure slides up, and pops as its count reaches the value.
  cues: (c) =>
    statsOf(c).flatMap((_, i) => [
      { at: i * STAT + 0.05, sound: 'slide' as const, text: true },
      { at: i * STAT + 1.05, sound: 'pop' as const, gain: 0.7 },
    ]),
  draw(ctx, t, _d, env, c) {
    const list = statsOf(c);
    const { feel } = env;
    ctx.save();
    ctx.globalAlpha = 1 - env.out;
    list.forEach((s, i) => {
      const lt = t - i * STAT;
      const last = i === list.length - 1;
      if (lt < 0 || (!last && lt > STAT + 0.4)) return;
      const inn = feel.rise(lt - 0.05);
      const gone = last ? 0 : feel.move(seg(lt, STAT - 0.1, STAT + 0.3));
      ctx.save();
      ctx.globalAlpha *= seg(lt, 0.05, 0.22) * (1 - gone);
      if (feel.blur && gone > 0.01) ctx.filter = `blur(${(14 * gone).toFixed(1)}px)`;
      ctx.beginPath();
      ctx.rect(0, MID.y - 300, W, 400);
      ctx.clip();
      ctx.translate(MID.x, MID.y + 60 + (1 - inn) * 300 - gone * 170);
      ctx.scale(lerp(0.92, 1, inn), lerp(0.92, 1, inn));
      const size = Math.min(
        330,
        (330 * (env.wide - 160)) / Math.max(1, widthOf(ctx, env, s.value, 330)),
      );
      bigNumber(ctx, env, s.value, -8, 0, size, out(seg(env.frame - i * STAT, 0.1, 1.05)));
      ctx.restore();
      ctx.save();
      ctx.globalAlpha *= 1 - gone;
      ctx.translate(0, -60 * gone);
      say(ctx, env, [s.label], MID.x, MID.y + 170, 38, lt, {
        voice: 'text',
        color: dim(env),
        weight: 450,
        start: 0.35,
        stagger: 0.05,
      });
      ctx.restore();
    });
    ctx.restore();
    seedInOut(ctx, env, t);
  },
});

register<StatsContent>({
  kind: 'stats',
  narrow: true,
  id: 'row',
  name: 'Side by side',
  entry: { box: SEED },
  dur: () => 5.2,
  cues: (c, feel) =>
    statsOf(c)
      .slice(0, 3)
      .map((_, i) => ({ at: 0.35 + i * 0.3 * feel.gap, sound: 'slide' as const, text: true })),
  draw(ctx, t, _d, env, c) {
    const list = statsOf(c).slice(0, 3);
    const { feel } = env;
    // Side by side in a wide frame. A tall one has no room for that, so they stack.
    const stack = tight(env) && list.length > 1;
    const span = stack ? env.wide - 200 : Math.min(580, 1680 / Math.max(1, list.length));
    const size = Math.min(
      190,
      ...list.map((s) => (190 * (span - 70)) / Math.max(1, widthOf(ctx, env, s.value, 190))),
    );
    ctx.save();
    leave(ctx, env, 30);
    list.forEach((s, i) => {
      const place = i - (list.length - 1) / 2;
      const x = stack ? MID.x : MID.x + place * span;
      const at = 0.35 + i * 0.3 * feel.gap;
      const lt = t - at;
      if (lt <= 0) return;
      const inn = feel.rise(lt);
      ctx.save();
      if (stack) ctx.translate(0, place * 400);
      ctx.save();
      ctx.globalAlpha *= seg(lt, 0, 0.16);
      ctx.beginPath();
      ctx.rect(x - span / 2, MID.y - 220, span, 250);
      ctx.clip();
      bigNumber(
        ctx,
        env,
        s.value,
        x,
        MID.y + 10 + (1 - inn) * 200,
        size,
        out(seg(env.frame - at, 0.05, 1.3)),
      );
      ctx.restore();
      const line = feel.move(seg(lt, 0.1, 0.6));
      ctx.fillStyle = env.c.hot;
      ctx.fillRect(x - 120 * line, MID.y + 62, 240 * line, 5);
      const labels = wrap(ctx, env, s.label, 32, span - 80, 'text').slice(0, 2);
      say(ctx, env, labels, x, MID.y + 130, 32, lt, {
        voice: 'text',
        color: dim(env),
        weight: 450,
        start: 0.3,
        stagger: 0.04,
      });
      ctx.restore();
    });
    ctx.restore();
    seedInOut(ctx, env, t);
  },
});

// ---------------------------------------------------------------- a design as a scene

export interface DesignContent {
  label: string;
  /** The design's own video, painted here each frame. */
  canvas: HTMLCanvasElement;
  paint: Paint | null;
}

register<DesignContent>({
  kind: 'design',
  narrow: true,
  id: 'card',
  name: 'Design on a card',
  entry: { box: FULL, fill: 'hot' },
  dur: () => 5,
  // The video's big moment: a build-up runs through the slide before and ends as this opens.
  cues: () => [
    { at: 0.05, sound: 'riser', ends: true },
    { at: 0.05, sound: 'hit' },
    { at: 0.6, sound: 'shimmer' },
  ],
  draw(ctx, t, _d, env, c) {
    ctx.save();
    ctx.globalAlpha = 1 - env.out;
    ctx.fillStyle = env.c.hot;
    ctx.fillRect(0, -env.tall, W, H + env.tall * 2);
    const shade = ctx.createRadialGradient(MID.x, H * 1.1, 0, MID.x, H * 1.1, 1100);
    shade.addColorStop(0, 'rgba(0,0,0,0.3)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, -env.tall, W, H + env.tall * 2);
    say(ctx, env, [c.label], MID.x, 104 - env.tall * 0.8, 24, t, {
      voice: 'mono',
      color: rgba(env.c.onHot, 0.8),
      start: 0.5,
      stagger: 0.06,
    });
    ctx.restore();

    const inn = env.feel.glide(t - 0.1);
    // The card takes the design's own shape, so a story stays tall and a post stays wide.
    const shape = c.canvas.width / Math.max(1, c.canvas.height);
    // A tall frame has room for a larger card, which a tall design needs most.
    const tall = tight(env)
      ? Math.min(H + env.tall * 2 - 420, (env.wide - 150) / shape)
      : Math.min(664, 1180 / shape);
    const full: Box = { cx: MID.x, cy: 582, w: tall * shape, h: tall, r: 28 };
    const rest = {
      ...full,
      cy: full.cy + (760 + env.tall) * (1 - inn),
      w: full.w * lerp(0.8, 1, inn),
      h: full.h * lerp(0.8, 1, inn),
    };
    const b = toward(env, rest, env.out);
    if (c.paint) {
      const dctx = c.canvas.getContext('2d') as Ctx;
      c.paint(dctx, Math.max(0, t - 0.55));
      dctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    turned(ctx, b.cx, b.cy, 6 * (1 - inn), 1, () => {
      ctx.save();
      ctx.globalAlpha = env.into ? 1 : 1 - env.out;
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 80;
      ctx.shadowOffsetY = 36;
      path(ctx, b);
      ctx.fillStyle = env.c.panel;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      path(ctx, b);
      ctx.clip();
      cover(ctx, c.canvas, b.cx - b.w / 2, b.cy - b.h / 2, b.w, b.h);
      ctx.restore();
      arrive(ctx, env, b, seg(env.out, 0.1, 0.6));
    });
  },
});

// ---------------------------------------------------------------- a thread's page

register<DesignContent>({
  kind: 'page',
  narrow: true,
  id: 'swipe',
  name: 'Pages swipe by',
  dur: () => 4.6,
  cues: () => [{ at: 0.05, sound: 'slide' }],
  draw(ctx, t, _d, env, c) {
    ctx.save();
    ctx.globalAlpha = seg(t, 0.2, 0.5) * (1 - env.out);
    say(ctx, env, [c.label], MID.x, 96 - env.tall * 0.8, 24, t, {
      voice: 'mono',
      color: dim(env),
      start: 0.2,
    });
    ctx.restore();
    const inn = env.feel.glide(t - 0.05);
    const shape = c.canvas.width / Math.max(1, c.canvas.height);
    const tall = tight(env)
      ? Math.min(H + env.tall * 2 - 380, (env.wide - 130) / shape)
      : Math.min(780, 1500 / shape);
    const rest: Box = { cx: MID.x + W * (1 - inn), cy: 590, w: tall * shape, h: tall, r: 28 };
    // The page leaves to the left for the next one, or shrinks into what the next slide starts from.
    const b = env.into ? toward(env, rest, env.out) : { ...rest, cx: rest.cx - W * env.out };
    if (c.paint) {
      const dctx = c.canvas.getContext('2d') as Ctx;
      c.paint(dctx, Math.max(0, t - 0.45));
      dctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    turned(ctx, b.cx, b.cy, 3 * (1 - inn), 1, () => {
      ctx.save();
      ctx.shadowColor = env.c.shadow;
      ctx.shadowBlur = 80;
      ctx.shadowOffsetY = 36;
      path(ctx, b);
      ctx.fillStyle = env.c.panel;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      path(ctx, b);
      ctx.clip();
      cover(ctx, c.canvas, b.cx - b.w / 2, b.cy - b.h / 2, b.w, b.h);
      ctx.restore();
      if (env.into) arrive(ctx, env, b, seg(env.out, 0.1, 0.6));
    });
  },
});

// ---------------------------------------------------------------- two brands

export interface PairContent {
  a: string;
  b: string;
}

register<PairContent>({
  kind: 'pair',
  narrow: true,
  id: 'meet',
  name: 'Two marks meet',
  dur: () => 4.4,
  cues: () => [
    { at: 0.1, sound: 'slide' },
    { at: 0.75, sound: 'pop' },
    { at: 2.3, sound: 'hit', gain: 0.8 },
  ],
  draw(ctx, t, _d, env, c) {
    const { feel } = env;
    const inn = feel.glide(t - 0.1);
    // The marks come in from the sides, stand apart, then close up on the cross between them.
    const close = feel.pop(t - 2.3);
    const gap = lerp(W * 0.6, lerp(250, 168, close), inn);
    const side = 190;
    ctx.save();
    leave(ctx, env);
    const one = (name: string, dir: number, fill: string, ink: string) => {
      const b: Box = { cx: MID.x + dir * gap, cy: MID.y - 40, w: side, h: side, r: 50 };
      path(ctx, b);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.font = `700 ${side * 0.6}px Geist, Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name.trim().charAt(0).toUpperCase(), b.cx, b.cy + side * 0.04);
      say(ctx, env, [name], b.cx, b.cy + side * 0.5 + 76, 40, t, {
        voice: 'text',
        weight: 550,
        start: 0.9,
      });
    };
    one(c.a, -1, env.c.hot, env.c.onHot);
    one(c.b, 1, env.c.ink, env.c.onInk);
    const cross = feel.pop(t - 0.75);
    if (cross > 0) {
      const arm = 22 * cross * (1 - 0.35 * close);
      ctx.strokeStyle = dim(env);
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(MID.x - arm, MID.y - 40 - arm);
      ctx.lineTo(MID.x + arm, MID.y - 40 + arm);
      ctx.moveTo(MID.x + arm, MID.y - 40 - arm);
      ctx.lineTo(MID.x - arm, MID.y - 40 + arm);
      ctx.stroke();
    }
    const ring = out(seg(t, 2.3, 3.1));
    if (ring > 0 && ring < 1) {
      ctx.strokeStyle = rgba(env.c.hot, 0.55 * (1 - ring));
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(MID.x, MID.y - 40, 120 + 420 * ring, 0, 7);
      ctx.stroke();
    }
    ctx.restore();
    seedOut(ctx, env);
  },
});

// ---------------------------------------------------------------- outro

export interface OutroContent {
  tagline: string;
  link: string;
}

function mark(ctx: Ctx, env: Env, b: Box, t: number): void {
  path(ctx, b);
  ctx.fillStyle = env.c.hot;
  ctx.fill();
  ctx.fillStyle = rgba(env.c.onHot, seg(t, 0.1, 0.35));
  ctx.font = `700 ${b.h * 0.65}px Geist, Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(env.brand.trim().charAt(0).toUpperCase(), b.cx, b.cy + b.h * 0.04);
}

function linkPill(ctx: Ctx, env: Env, text: string, y: number, t: number, at: number): void {
  const pop = env.feel.pop(t - at);
  if (pop <= 0 || !text.trim()) return;
  ctx.save();
  ctx.font = '500 26px "Geist Mono", ui-monospace, monospace';
  const w = ctx.measureText(text).width + 84;
  const b: Box = { cx: MID.x, cy: y, w: w * lerp(0.8, 1, pop), h: 70 * lerp(0.8, 1, pop), r: 35 };
  ctx.globalAlpha = seg(t, at, at + 0.15);
  path(ctx, b);
  ctx.fillStyle = env.c.hot;
  ctx.fill();
  ctx.save();
  path(ctx, b);
  ctx.clip();
  const sweep = seg(t, at + 0.85, at + 1.65);
  if (sweep > 0 && sweep < 1) {
    const sx = b.cx - b.w / 2 - 120 + (b.w + 240) * env.feel.move(sweep);
    const g = ctx.createLinearGradient(sx - 90, 0, sx + 90, 0);
    const shine = env.c.onHot;
    g.addColorStop(0, rgba(shine, 0));
    g.addColorStop(0.5, rgba(shine, 0.3));
    g.addColorStop(1, rgba(shine, 0));
    ctx.fillStyle = g;
    ctx.fillRect(b.cx - b.w / 2, b.cy - b.h / 2, b.w, b.h);
  }
  ctx.restore();
  ctx.fillStyle = env.c.onHot;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, b.cx, b.cy + 2);
  ctx.restore();
}

/** The name opens at `name`. The link pops at `link` and a light crosses it a moment later. */
const outroCues = (c: OutroContent, name: number, link: number): Cue[] => [
  { at: 0.1, sound: 'hit', gain: 0.6 },
  { at: name, sound: 'slide', text: true },
  ...(c.link.trim()
    ? [
        { at: link, sound: 'pop' as const },
        { at: link + 0.85, sound: 'shimmer' as const },
      ]
    : []),
];

register<OutroContent>({
  kind: 'outro',
  narrow: true,
  id: 'lockup',
  name: 'Logo and name',
  entry: { box: MARK, fill: 'hot' },
  dur: () => 5,
  cues: (c) => outroCues(c, 0.45, 1.75),
  draw(ctx, t, d, env, c) {
    turned(ctx, MID.x, MID.y, 0, 1 + 0.03 * (t / d), () => {
      const open = env.feel.glide(t - 0.45);
      const set = setting(env, 'display', 108);
      const name = set.upper ? env.brand.toUpperCase() : env.brand;
      const nameW = widthOf(ctx, env, env.brand, 108);
      const cy = MID.y - 90 * cl(open);
      const mx = lerp(MID.x, MID.x - (MARK.w + 34 + nameW) / 2 + MARK.w / 2, open);
      mark(ctx, env, { ...MARK, cx: mx, cy }, t);
      if (open > 0) {
        const left = mx + MARK.w / 2 + 34;
        ctx.save();
        ctx.beginPath();
        ctx.rect(left - 10, cy - 100, (nameW + 30) * cl(open), 200);
        ctx.clip();
        ctx.font = set.font;
        (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${set.track}px`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = env.c.ink;
        ctx.fillText(name, left - 60 * (1 - cl(open)), cy + 6);
        (ctx as Ctx & { letterSpacing: string }).letterSpacing = '0px';
        ctx.restore();
      }
      say(
        ctx,
        env,
        wrap(ctx, env, c.tagline, 38, room(env, 1100), 'text').slice(0, 3),
        MID.x,
        MID.y + 66,
        38,
        t,
        {
          voice: 'text',
          color: dim(env),
          start: 1.05,
          stagger: 0.05,
        },
      );
      linkPill(ctx, env, c.link, MID.y + 196, t, 1.75);
    });
  },
});

register<OutroContent>({
  kind: 'outro',
  narrow: true,
  id: 'wordmark',
  name: 'Giant name',
  entry: { box: MARK, fill: 'hot' },
  dur: () => 5,
  cues: (c) => outroCues(c, 0.4, 1.9),
  draw(ctx, t, d, env, c) {
    turned(ctx, MID.x, MID.y, 0, 1 + 0.03 * (t / d), () => {
      const up = env.feel.glide(t - 0.4);
      const s = lerp(1, 0.7, up);
      mark(
        ctx,
        env,
        { ...MARK, cy: lerp(MID.y, 250, up), w: MARK.w * s, h: MARK.h * s, r: MARK.r * s },
        t,
      );
      const size = Math.min(
        300,
        (300 * room(env, 1640)) / Math.max(1, widthOf(ctx, env, env.brand, 300)),
      );
      say(ctx, env, [env.brand], MID.x, 580 + size * 0.18, size, t, { start: 0.6, stagger: 0.14 });
      say(
        ctx,
        env,
        wrap(ctx, env, c.tagline, 38, room(env, 1100), 'text').slice(0, 3),
        MID.x,
        780,
        38,
        t,
        {
          voice: 'text',
          color: dim(env),
          start: 1.2,
          stagger: 0.05,
        },
      );
      linkPill(ctx, env, c.link, 900, t, 1.9);
    });
  },
});
