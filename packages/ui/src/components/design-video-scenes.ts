import { out, type Paint } from './design-motion.js';
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
  path,
  pointer,
  press,
  register,
  rgba,
  say,
  seedOut,
  seg,
  setting,
  toward,
  W,
  widthOf,
  wrap,
} from './design-video.js';

// Every way a scene kind can be drawn. Variants of one kind take the same content and start from
// the same shape, so any of them can stand in for another.

const DOT: Box = { cx: MID.x, cy: MID.y, w: 20, h: 20, r: 10 };
const RING: Box = { cx: MID.x, cy: MID.y, w: 132, h: 132, r: 66 };
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

register<HookContent>({
  kind: 'hook',
  id: 'rise',
  name: 'Words rise',
  dur: () => 3.8,
  draw(ctx, t, d, env, c) {
    const lines = hookLines(c);
    // A word or two on its own fills the frame.
    const short = lines.length === 1 && lines[0].length <= 12;
    const most = lines.length > 2 ? 116 : short ? 230 : 148;
    // A long line is set smaller, so it never runs off the frame.
    const widest = Math.max(...lines.map((l) => widthOf(ctx, env, l, most)));
    const size = Math.min(most, (most * 1640) / Math.max(1, widest));
    const lead = setting(env, 'display', size);
    const top = MID.y - ((lines.length - 1) * lead.size * lead.lead) / 2 + lead.size * 0.3;
    turned(ctx, MID.x, MID.y, 0, (1 + 0.04 * (t / d)) * (1 - 0.05 * env.out), () => {
      leave(ctx, env);
      kicker(ctx, env, c.kicker, MID.x, top - lead.size * 1.15, t, 'center');
      say(ctx, env, lines, MID.x, top, size, t, { start: 0.4, stagger: 0.1 });
    });
    seedOut(ctx, env);
  },
});

register<HookContent>({
  kind: 'hook',
  id: 'bars',
  name: 'Bars wipe',
  dur: () => 4,
  draw(ctx, t, _d, env, c) {
    const lines = hookLines(c);
    const most = lines.length > 2 ? 150 : 190;
    const widest = Math.max(...lines.map((l) => widthOf(ctx, env, l, most)));
    const size = Math.min(most, (most * 1560) / Math.max(1, widest));
    const set = setting(env, 'display', size);
    const pitch = set.size * set.lead;
    const top = MID.y - ((lines.length - 1) * pitch) / 2 + set.size * 0.32;
    ctx.save();
    leave(ctx, env, 30);
    kicker(ctx, env, c.kicker, 142, top - set.size * 1.12, t, 'left');
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
      ctx.rect(120, y0 - 20, w * shed, set.size * 1.2 + 40);
      ctx.clip();
      say(ctx, env, [line], 140, top + i * pitch, size, 99, { align: 'left' });
      ctx.restore();
      ctx.fillStyle = env.c.hot;
      ctx.fillRect(120 + w * shed, y0, w * (grow - shed), set.size * 1.1);
    });
    ctx.restore();
    seedOut(ctx, env);
  },
});

const BEAT = 0.36;
const hookWords = (c: HookContent) => hookLines(c).join(' ').split(' ').filter(Boolean);

register<HookContent>({
  kind: 'hook',
  id: 'slam',
  name: 'One word at a time',
  dur: (c) => 0.4 + hookWords(c).length * BEAT + 1.5,
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
      const size = Math.min(330, (330 * 1500) / Math.max(1, widthOf(ctx, env, marked, 330)));
      const p = env.feel.pop(lt);
      turned(ctx, MID.x, MID.y + 30, 0, lerp(1.18, 1, p), () => {
        ctx.globalAlpha *= seg(lt, 0, 0.06);
        say(ctx, env, [marked], MID.x, MID.y + 30 + size * 0.36, size, 99);
      });
      const done = t - 0.4 - words.length * BEAT;
      say(ctx, env, [hookLines(c).join(' ')], MID.x, 880, 40, done, {
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
  id: 'typed',
  name: 'Typed out',
  dur: (c) => Math.min(6.5, 0.5 + hookChars(c) * KEY + 1.9),
  draw(ctx, t, _d, env, c) {
    const lines = hookLines(c);
    const { size, pitch, top } = hookFit(ctx, env, lines, lines.length > 2 ? 120 : 150, 1500);
    const plain = lines.map((l) => l.replace(/\*/g, ''));
    const left = MID.x - Math.max(...plain.map((l) => widthOf(ctx, env, l, size))) / 2;
    // The lines are typed one key at a time, each revealed up to where the caret has reached.
    let typed = Math.floor(Math.max(0, t - 0.45) / KEY);
    const all = hookChars(c);
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
  id: 'bands',
  name: 'Running bands',
  dur: () => 4.6,
  draw(ctx, t, _d, env, c) {
    const lines = hookLines(c);
    const { feel } = env;
    // Bands of words run across the frame in turn, then part for the headline.
    const part = feel.move(seg(t, 1.5, 2.2));
    const words = `${(c.bands?.trim() || lines.join(' ')).replace(/\*/g, '')}  ·  `;
    const set = setting(env, 'display', 190);
    const rows = 5;
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
      const y = (r + 0.5) * (H / rows) + (r < rows / 2 ? -1 : 1) * part * H * 0.6;
      ctx.globalAlpha = (1 - part) * seg(t, r * 0.06, r * 0.06 + 0.25);
      for (let x = -off; x < W; x += step) {
        if (r % 2 === 0) {
          ctx.fillStyle = rgba(env.c.ink, r === 2 ? 1 : 0.16);
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
      const { size, pitch, top } = hookFit(ctx, env, lines, lines.length > 2 ? 124 : 160, 1640);
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
  id: 'zoom',
  name: 'Fly through',
  dur: (c) => 0.3 + Math.max(0, hookLines(c).length - 1) * FLY + 3,
  draw(ctx, t, _d, env, c) {
    const lines = hookLines(c);
    const { feel } = env;
    const through = Math.max(0, lines.length - 1);
    // Each line comes at the camera and passes it. The whole headline then lands from close up.
    for (let i = 0; i < through; i++) {
      const lt = t - 0.3 - i * FLY;
      if (lt <= 0 || lt > FLY + 0.1) continue;
      const { size } = hookFit(ctx, env, [lines[i]], 200, 1500);
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
      const { size, pitch, top } = hookFit(ctx, env, lines, lines.length > 2 ? 124 : 160, 1640);
      const land = feel.glide(lt);
      ctx.save();
      const far = 1 - Math.min(1, land);
      if (feel.blur && far > 0.02) ctx.filter = `blur(${(far * 22).toFixed(1)}px)`;
      turned(
        ctx,
        MID.x,
        MID.y,
        0,
        lerp(3.2, 1, land) * (1 + 0.03 * (lt / 3)) * (1 - 0.05 * env.out),
        () => {
          leave(ctx, env);
          ctx.globalAlpha *= seg(lt, 0, 0.2);
          kicker(ctx, env, c.kicker, MID.x, top - size * 1.15, lt, 'center', 0.5);
          for (const [i, line] of lines.entries()) {
            say(ctx, env, [line], MID.x, top + i * pitch, size, 99);
          }
        },
      );
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
  id: 'pill',
  name: 'Prompt box',
  entry: { box: DOT },
  dur: () => 5,
  draw(ctx, t, d, env, c) {
    const { feel } = env;
    const click = 3.45;
    const after = t - click - 0.12;
    const open = feel.glide(t);
    const rest: Box = { cx: MID.x, cy: MID.y, w: 1240, h: 132, r: 66 };
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

    ctx.save();
    if (env.look.dark) {
      ctx.shadowColor = rgba(env.c.hot, 0.5);
      ctx.shadowBlur = 90;
    }
    path(ctx, b);
    ctx.fillStyle = env.c.ink;
    ctx.fill();
    ctx.restore();
    if (after > 0) arrive(ctx, env, b, seg(t, d - 0.35, d - 0.05));

    if (show > 0) {
      ctx.save();
      path(ctx, b);
      ctx.clip();
      ctx.globalAlpha = show;
      ctx.font = setting(env, 'text', 48, 500).font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const typed = c.text.slice(0, Math.floor(seg(t, 0.75, 2.65) * c.text.length));
      const x0 = b.cx - b.w / 2 + 58;
      ctx.fillStyle = env.c.onInk;
      ctx.fillText(typed, x0, MID.y + 2);
      if (t < 2.7 || (t * 1.8) % 1 < 0.55)
        ctx.fillRect(x0 + ctx.measureText(typed).width + 6, MID.y - 28, 4, 56);
      const br = 44 * (1 - 0.14 * press(t - click));
      const bx = b.cx + b.w / 2 - 68;
      const sent = t > click + 0.1;
      ctx.fillStyle = sent ? env.c.hot : env.c.onInk;
      ctx.beginPath();
      ctx.arc(bx, MID.y, br, 0, 7);
      ctx.fill();
      ctx.strokeStyle = sent ? env.c.onHot : env.c.ink;
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
      lerp(1560, MID.x + 620 - 64, go) + away * 150,
      lerp(960, MID.y + 6, go) - Math.sin(go * Math.PI) * 70 + away * 190,
      press(t - click),
      seg(t, 2.45, 2.7) * (1 - away),
    );
  },
});

/** The shape an entrance ends as, on its way into the next slide. */
function entranceOut(ctx: Ctx, env: Env, from: Box, t: number, at: number, d: number): Box {
  const b = mix(from, env.into ? env.into.box : RING, env.feel.glide(t - at));
  path(ctx, b);
  ctx.fillStyle = env.c.ink;
  ctx.fill();
  arrive(ctx, env, b, seg(t, d - 0.35, d - 0.05));
  return b;
}

register<InputContent>({
  kind: 'input',
  id: 'chat',
  name: 'Chat message',
  entry: { box: DOT },
  dur: (c) => (c.reply?.trim() ? 6.2 : 5),
  draw(ctx, t, d, env, c) {
    const { feel } = env;
    const leaveAt = c.reply?.trim() ? 4.9 : 3.7;
    const gone = seg(t, leaveAt, leaveAt + 0.25);
    const set = setting(env, 'text', 44, 500);
    ctx.font = set.font;
    const wide = Math.min(1300, ctx.measureText(c.text).width + 120);
    const mine: Box = { cx: MID.x + 120, cy: MID.y - 80, w: wide, h: 124, r: 62 };
    const open = feel.glide(t);
    const b = mix(DOT, mine, open);
    // The message is typed into a bubble in the brand's color, then a reply starts to come.
    ctx.save();
    ctx.globalAlpha = 1 - gone;
    ctx.translate(0, -40 * gone);
    path(ctx, b);
    ctx.fillStyle = blend(env.c.ink, env.c.hot, cl(open * 1.4));
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
    const full = Math.min(1300, ctx.measureText(words).width + 120);
    const reply: Box = {
      cx: MID.x - 300 + (lerp(230, full, said) - 230) / 2,
      cy: MID.y + 110,
      w: lerp(230, full, said) * pop,
      h: lerp(112, 124, said) * pop,
      r: 62,
    };
    if (t >= leaveAt) {
      entranceOut(
        ctx,
        env,
        { ...reply, w: lerp(230, full, said), h: lerp(112, 124, said) },
        t,
        leaveAt,
        d,
      );
      return;
    }
    path(ctx, reply);
    ctx.fillStyle = env.c.ink;
    ctx.fill();
    const dots = 1 - seg(t, 3.25, 3.4);
    for (let k = 0; k < 3 && dots > 0; k++) {
      const hop = Math.max(0, Math.sin((t - 2.6) * 7 - k * 0.9)) * 12;
      ctx.fillStyle = rgba(env.c.onInk, dots);
      ctx.beginPath();
      ctx.arc(reply.cx - reply.w / 2 + (71 + k * 44) * pop, reply.cy - hop, 11 * pop, 0, 7);
      ctx.fill();
    }
    if (said > 0) {
      ctx.save();
      path(ctx, reply);
      ctx.clip();
      ctx.globalAlpha = seg(t, 3.4, 3.6);
      ctx.fillStyle = env.c.onInk;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(words, reply.cx - reply.w / 2 + 60, reply.cy + 2);
      ctx.restore();
    }
  },
});

register<InputContent>({
  kind: 'input',
  id: 'terminal',
  name: 'Command line',
  entry: { box: DOT },
  dur: () => 4.8,
  draw(ctx, t, d, env, c) {
    const { feel } = env;
    const enter = 2.6;
    const leaveAt = 3.4;
    const win: Box = { cx: MID.x, cy: MID.y, w: 1180, h: 400, r: 28 };
    if (t >= leaveAt) {
      entranceOut(ctx, env, win, t, leaveAt, d);
      return;
    }
    const open = feel.glide(t);
    const b = mix(DOT, win, open);
    ctx.save();
    ctx.shadowColor = env.c.shadow;
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 30;
    path(ctx, b);
    // The dot it grew from is ink. The window takes its own dark fill as it opens.
    ctx.fillStyle = blend(env.c.ink, env.look.dark ? env.c.panel : '#101014', cl(open * 1.3));
    ctx.fill();
    ctx.restore();
    ctx.save();
    path(ctx, b);
    ctx.clip();
    ctx.globalAlpha = seg(t, 0.3, 0.55);
    const left = b.cx - b.w / 2;
    const top = b.cy - b.h / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(left, top, b.w, 58);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(left + 36 + k * 26, top + 29, 7, 0, 7);
      ctx.fill();
    }
    ctx.font = '500 40px "Geist Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const typed = c.text.slice(0, Math.floor(seg(t, 0.75, 2.4) * c.text.length));
    const line = (y: number) => {
      ctx.fillStyle = env.c.hot;
      ctx.fillText('›', left + 54, y);
    };
    line(top + 140);
    ctx.fillStyle = '#f4f4f1';
    ctx.fillText(typed, left + 96, top + 140);
    // Enter is pressed, and the caret drops to a fresh prompt as a command line does.
    const y = t < enter ? top + 140 : top + 214;
    const x = t < enter ? left + 100 + ctx.measureText(typed).width : left + 96;
    if (t >= enter) line(top + 214);
    if ((t * 2) % 1 < 0.6 || (t > 2.4 && t < enter + 0.2)) ctx.fillRect(x, y - 22, 20, 44);
    ctx.restore();
  },
});

register<InputContent>({
  kind: 'input',
  id: 'notify',
  name: 'Notification',
  entry: { box: DOT },
  dur: () => 4.6,
  draw(ctx, t, d, env, c) {
    const { feel } = env;
    const tap = 2.7;
    const leaveAt = tap + 0.3;
    // It sits at the top of the frame, where a notification drops in on a phone or a laptop.
    const note: Box = { cx: MID.x, cy: 260, w: 1040, h: 190, r: 48 };
    if (t >= leaveAt) {
      entranceOut(ctx, env, note, t, leaveAt, d);
      return;
    }
    const open = feel.glide(t);
    const down = 1 - 0.04 * press(t - tap);
    const b = mix(DOT, { ...note, w: note.w * down, h: note.h * down }, open);
    ctx.save();
    ctx.shadowColor = env.c.shadow;
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 30;
    path(ctx, b);
    ctx.fillStyle = env.c.ink;
    ctx.fill();
    ctx.restore();
    ctx.save();
    path(ctx, b);
    ctx.clip();
    ctx.globalAlpha = seg(t, 0.3, 0.55);
    const left = b.cx - b.w / 2;
    path(ctx, { cx: left + 96, cy: b.cy, w: 108, h: 108, r: 28 });
    ctx.fillStyle = env.c.hot;
    ctx.fill();
    ctx.fillStyle = env.c.onHot;
    ctx.font = '700 64px Geist, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(env.brand.trim().charAt(0).toUpperCase(), left + 96, b.cy + 4);
    ctx.textAlign = 'left';
    ctx.fillStyle = env.c.onInk;
    ctx.font = setting(env, 'text', 40, 620).font;
    ctx.fillText(env.brand, left + 184, b.cy - 30);
    ctx.fillStyle = rgba(env.c.onInk, 0.7);
    ctx.font = setting(env, 'text', 36, 450).font;
    ctx.fillText(c.text, left + 184, b.cy + 28);
    ctx.fillStyle = rgba(env.c.onInk, 0.45);
    ctx.textAlign = 'right';
    ctx.fillText('now', left + b.w - 46, b.cy - 30);
    ctx.restore();
    const go = feel.move(seg(t, 1.8, tap - 0.05));
    pointer(
      ctx,
      lerp(1560, MID.x + 260, go),
      lerp(960, note.cy + 30, go),
      press(t - tap),
      seg(t, 1.8, 2.05),
    );
  },
});

register<InputContent>({
  kind: 'input',
  id: 'compose',
  name: 'Write and send',
  entry: { box: DOT },
  dur: () => 5.2,
  draw(ctx, t, d, env, c) {
    const { feel } = env;
    const click = 3.4;
    const leaveAt = click + 0.25;
    const win: Box = { cx: MID.x, cy: MID.y, w: 1220, h: 540, r: 40 };
    if (t >= leaveAt) {
      entranceOut(ctx, env, win, t, leaveAt, d);
      return;
    }
    const open = feel.glide(t);
    const b = mix(DOT, win, open);
    ctx.save();
    ctx.shadowColor = env.c.shadow;
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 30;
    path(ctx, b);
    ctx.fillStyle = env.c.ink;
    ctx.fill();
    ctx.restore();
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
    ctx.fillStyle = rgba(env.c.onInk, 0.5);
    ctx.fillText('To', left, top + 86);
    ctx.font = setting(env, 'text', 34, 550).font;
    const who = ctx.measureText(env.brand).width + 56;
    ctx.fillStyle = rgba(env.c.onInk, 0.12);
    ctx.beginPath();
    ctx.roundRect(left + 64, top + 54, who, 64, 32);
    ctx.fill();
    ctx.fillStyle = env.c.onInk;
    ctx.fillText(env.brand, left + 92, top + 88);
    ctx.fillStyle = rgba(env.c.onInk, 0.16);
    ctx.fillRect(left, top + 150, b.w - 140, 2);
    const set = setting(env, 'text', 54, 600);
    const lines = wrap(ctx, env, c.text, 54, b.w - 160, 'text').slice(0, 3);
    let typed = Math.floor(seg(t, 0.8, 2.7) * c.text.length);
    ctx.font = set.font;
    ctx.fillStyle = env.c.onInk;
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
      r: 44,
    };
    path(ctx, send);
    ctx.fillStyle = env.c.hot;
    ctx.fill();
    ctx.fillStyle = env.c.onHot;
    ctx.font = setting(env, 'text', 38, 620).font;
    ctx.textAlign = 'center';
    ctx.fillText('Send  →', send.cx, send.cy + 2);
    ctx.restore();
    const go = feel.move(seg(t, 2.5, click - 0.05));
    pointer(
      ctx,
      lerp(1620, send.cx + 50, go),
      lerp(1000, send.cy + 26, go),
      down,
      seg(t, 2.5, 2.75),
    );
  },
});

/** How a Build-up ends: a disc in the hot color with a tick, which becomes the next slide's shape. */
function doneDisc(ctx: Ctx, env: Env, t: number, done: number, turn: number, R: number): void {
  const fill = env.feel.pop(t - done);
  if (fill <= 0) return;
  const disc: Box = { cx: MID.x, cy: MID.y, w: R * 2 * fill, h: R * 2 * fill, r: R };
  const b = toward(env, disc, env.feel.glide(t - turn));
  ctx.save();
  ctx.globalAlpha = env.into ? 1 : 1 - env.out;
  path(ctx, b);
  ctx.fillStyle = env.c.hot;
  ctx.fill();
  ctx.restore();
  arrive(ctx, env, b, seg(t, turn + 0.05, turn + 0.45));
  const tick = seg(t, done + 0.08, done + 0.42);
  const gone = 1 - seg(t, turn, turn + 0.18);
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

register<WorkingContent>({
  kind: 'working',
  id: 'ring',
  name: 'Progress ring',
  entry: { box: RING },
  dur: () => 4.4,
  draw(ctx, t, _d, env, c) {
    const { feel } = env;
    const done = 2.5;
    const turn = 3.3;
    const p = feel.move(seg(t, 0.35, done));
    const R = lerp(66, 170, feel.glide(t));
    const faint = rgba(env.c.ink, 0.14);

    if (t < turn) {
      ctx.fillStyle = rgba(env.c.ink, 1 - seg(t, 0, 0.3));
      ctx.beginPath();
      ctx.arc(MID.x, MID.y, R, 0, 7);
      ctx.fill();
      ctx.lineWidth = 14;
      ctx.strokeStyle = faint;
      ctx.beginPath();
      ctx.arc(MID.x, MID.y, R, 0, 7);
      ctx.stroke();
      ctx.strokeStyle = env.c.hot;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(MID.x, MID.y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, p));
      ctx.stroke();
      ctx.lineCap = 'butt';
      const ripple = out(seg(t, done, done + 0.8));
      if (ripple > 0 && ripple < 1) {
        ctx.strokeStyle = rgba(env.c.hot, 0.6 * (1 - ripple));
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(MID.x, MID.y, R + 260 * ripple, 0, 7);
        ctx.stroke();
      }
      ctx.font = '500 68px "Geist Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(env.c.ink, seg(t, 0.3, 0.6) * (1 - seg(t, done, done + 0.12)));
      ctx.fillText(`${Math.round(p * 100)}%`, MID.x, MID.y + 3);

      // The steps swap under the ring as the work moves on.
      const steps = c.steps.filter(Boolean);
      const at = Math.min(steps.length - 1, Math.floor(p * steps.length));
      const f = p * steps.length - at;
      ctx.font = setting(env, 'text', 42, 500).font;
      const line = (text: string, a: number, dy: number) => {
        ctx.fillStyle = rgba(env.c.ink, env.look.dim * a * (1 - seg(t, done + 0.5, turn)));
        ctx.fillText(text, MID.x, MID.y + 280 + dy);
      };
      if (t > done)
        line('Done', seg(t, done, done + 0.2), (1 - out(seg(t, done, done + 0.3))) * 18);
      else if (steps.length) {
        const inn = out(seg(f, 0, 0.22));
        if (at > 0 && inn < 1) line(steps[at - 1], 1 - inn, -18 * inn);
        line(steps[at], at === 0 ? seg(t, 0.4, 0.7) : inn, (1 - inn) * 18);
      }
    }

    doneDisc(ctx, env, t, done, turn, R);
  },
});

register<WorkingContent>({
  kind: 'working',
  id: 'checklist',
  name: 'Checklist',
  entry: { box: RING },
  dur: () => 4.8,
  draw(ctx, t, _d, env, c) {
    const { feel } = env;
    const steps = c.steps.filter(Boolean).slice(0, 4);
    const each = 0.62;
    const done = 0.9 + steps.length * each + 0.2;
    const turn = done + 0.75;
    const rowH = 124;
    const top = MID.y - (steps.length * rowH + (steps.length - 1) * 22) / 2;
    const away = feel.move(seg(t, done - 0.05, done + 0.3));
    const grow = feel.glide(t);
    steps.forEach((step, i) => {
      // The circle the slide came from opens into the first step. The rest line up under it.
      const inn = i === 0 ? 1 : feel.pop(t - 0.2 - i * 0.12);
      if (inn <= 0) return;
      const ticked = feel.pop(t - 0.9 - i * each);
      const row: Box = {
        cx: MID.x,
        cy: top + rowH / 2 + i * (rowH + 22) + (1 - inn) * 60,
        w: 980,
        h: rowH,
        r: 30,
      };
      const b = i === 0 ? mix(RING, row, grow) : row;
      const fill = blend(env.c.chip, env.c.hot, 0.1 * cl(ticked));
      ctx.save();
      ctx.globalAlpha = (i === 0 ? 1 : seg(t - 0.2 - i * 0.12, 0, 0.18)) * (1 - away);
      ctx.translate(0, (MID.y - b.cy) * away * 0.6);
      path(ctx, b);
      ctx.fillStyle = i === 0 ? blend(env.c.ink, fill, cl(grow * 1.3)) : fill;
      ctx.fill();
      path(ctx, b);
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(env.c.chipInk, 0.12);
      ctx.stroke();
      if (i === 0) ctx.globalAlpha *= seg(t, 0.3, 0.55);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = '500 34px "Geist Mono", ui-monospace, monospace';
      ctx.fillStyle = env.c.hot === env.c.chip ? env.c.chipInk : env.c.hot;
      ctx.fillText(`0${i + 1}`, row.cx - row.w / 2 + 44, b.cy + 2);
      ctx.font = setting(env, 'text', 42, 560).font;
      ctx.fillStyle = env.c.chipInk;
      ctx.fillText(step, row.cx - row.w / 2 + 124, b.cy + 2);
      const box: Box = { cx: row.cx + row.w / 2 - 70, cy: b.cy, w: 52, h: 52, r: 14 };
      path(ctx, box);
      ctx.fillStyle = blend(blend(env.c.chip, env.c.chipInk, 0.14), env.c.hot, cl(ticked));
      ctx.fill();
      if (ticked > 0.3) {
        ctx.strokeStyle = env.c.onHot;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(box.cx - 12, box.cy + 1);
        ctx.lineTo(box.cx - 3, box.cy + 10);
        ctx.lineTo(box.cx + 13, box.cy - 10);
        ctx.stroke();
      }
      ctx.restore();
    });
    doneDisc(ctx, env, t, done, turn, 150);
  },
});

register<WorkingContent>({
  kind: 'working',
  id: 'wheel',
  name: 'Picker wheel',
  entry: { box: RING },
  dur: () => 4.8,
  draw(ctx, t, _d, env, c) {
    const { feel } = env;
    const steps = c.steps.filter(Boolean).slice(0, 5);
    const each = 0.78;
    const done = 0.5 + steps.length * each;
    const turn = done + 0.75;
    // The list rolls up a step at a time. Only the step in the middle is sharp and lit.
    let at = 0;
    for (let i = 1; i < steps.length; i++) {
      at += feel.move(seg(t, 0.5 + i * each - 0.3, 0.5 + i * each));
    }
    const away = feel.move(seg(t, done - 0.1, done + 0.25));
    const pitch = 168;
    // The circle the slide came from opens into the lit row in the middle.
    const grow = feel.glide(t);
    const lit = mix(RING, { cx: MID.x, cy: MID.y, w: 1060, h: 150, r: 38 }, grow);
    ctx.save();
    ctx.globalAlpha = 1 - away;
    path(ctx, lit);
    ctx.fillStyle = blend(env.c.ink, env.c.chip, cl(grow * 1.3));
    ctx.fill();
    path(ctx, lit);
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(env.c.chipInk, 0.12);
    ctx.stroke();
    ctx.restore();
    steps.forEach((step, i) => {
      const off = i - at;
      const far = Math.min(1, Math.abs(off));
      if (Math.abs(off) > 2.4) return;
      ctx.save();
      ctx.globalAlpha = seg(t, 0.3 + i * 0.05, 0.6 + i * 0.05) * (1 - away) * lerp(1, 0.32, far);
      if (feel.blur && far > 0.05) ctx.filter = `blur(${(far * 7).toFixed(1)}px)`;
      const y = MID.y + off * pitch;
      ctx.fillStyle = env.c.hot === env.c.chip ? env.c.chipInk : env.c.hot;
      ctx.beginPath();
      ctx.arc(MID.x - 440, y, 26, 0, 7);
      ctx.fill();
      ctx.font = setting(env, 'text', lerp(60, 50, far), 620).font;
      ctx.fillStyle = far < 0.5 ? env.c.chipInk : env.c.ink;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(step, MID.x - 380, y + 3);
      ctx.restore();
    });
    doneDisc(ctx, env, t, done, turn, 150);
  },
});

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
  const ring = seg(t, PICK_AT, PICK_AT + 0.15) * (1 - seg(t, LIFT_AT + 0.2, LIFT_AT + 0.6));
  card(
    ctx,
    env,
    b,
    env.media(media),
    cl(lift) * (env.into?.chrome ?? 0),
    shown * (env.into ? 1 : 1 - env.out),
    ring,
  );
}

function pickPointer(ctx: Ctx, env: Env, t: number, target: Box): void {
  const go = env.feel.move(seg(t, 2.75, PICK_AT - 0.05));
  const away = out(seg(t, PICK_AT + 0.25, PICK_AT + 0.9));
  pointer(
    ctx,
    lerp(1620, target.cx + 40, go) + away * 200,
    lerp(1000, target.cy + 30, go) + away * 260,
    press(t - PICK_AT),
    seg(t, 2.75, 2.95) * (1 - away),
  );
}

const PITCH = { x: 448, y: 288 };

register<WallContent>({
  kind: 'wall',
  id: 'grid',
  name: 'Grid that whips',
  entry: { box: TILE, media: 2 },
  dur: () => 5.2,
  draw(ctx, t, _d, env, c) {
    const { feel } = env;
    const picked = env.into?.media ?? 0;
    const shift = (r: number, at: number) =>
      (r === 0 ? 1 : -1) * (18 * at + PITCH.x * 2 * feel.move(seg(at, 2.2, 2.9)));
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
      for (let r = -1; r <= 1; r++) {
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
  id: 'reel',
  name: 'Reel that lands',
  entry: { box: TILE, media: 2 },
  dur: () => 5.2,
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
  id: 'tilt',
  name: 'Tilted wall',
  entry: { box: TILE, media: 2 },
  dur: () => 5.2 - HEAD_START,
  draw(ctx, t, _d, env, c) {
    const { feel } = env;
    const picked = env.into?.media ?? 0;
    // The wall is there from the first frame, already leaning back like a table top. It has no
    // opening where the pictures spread out, so its pick and lift come that much sooner.
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
    const shown = seg(t, 0, 0.22);
    ctx.save();
    ctx.translate(MID.x, MID.y);
    ctx.transform(1 + 0.1 * lean, -0.16 * lean, 0.42 * lean, 1 - 0.1 * lean, 0, 0);
    ctx.translate(-MID.x, -MID.y);
    for (let r = -3; r <= 3; r++) {
      for (let col = -6; col <= 6; col++) {
        if (r === 0 && col === 1) continue;
        const b = spot(col, r, t);
        if (b.cx < -700 || b.cx > W + 700) continue;
        // The middle picture is the one the slide before ended on, so it is there at once.
        const mine = r === 0 && col === 0;
        card(ctx, env, b, env.media(mine ? 2 : col + 2 + r * 3), 0, (mine ? 1 : shown) * fade);
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
  id: 'fan',
  name: 'Fan of cards',
  entry: { box: TILE, media: 2 },
  dur: () => 5.2,
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
  id: 'float',
  name: 'Floating pictures',
  entry: { box: TILE, media: 2 },
  dur: () => 5.2,
  draw(ctx, t, _d, env, c) {
    const { feel } = env;
    const picked = env.into?.media ?? 0;
    const fade = 1 - feel.move(seg(t, PICK_AT + 0.1, 4.05));
    const lead = FLOATS.length - 1;
    const place = (i: number, at: number): Box => {
      const [x, y, depth] = FLOATS[i];
      const a = feel.glide(at - 0.05 - i * 0.05);
      // Near pictures drift further than far ones, which is what gives the frame its depth.
      const push = 1 + 0.07 * depth * (at / 5.2);
      const sway = at * (0.5 + depth * 0.2) + i * 1.7;
      return {
        cx: MID.x + ((x - 0.5) * W * push + Math.sin(sway) * 16 * depth) * a,
        cy: MID.y + ((y - 0.5) * H * push + Math.cos(sway * 0.8) * 12 * depth) * a,
        w: TILE.w * lerp(1, depth * 1.05, a),
        h: TILE.h * lerp(1, depth * 1.05, a),
        r: TILE.r,
      };
    };
    FLOATS.forEach(([, , depth], i) => {
      if (i === lead) return;
      const far = Math.max(0, 0.95 - depth) * feel.glide(t - 0.3);
      ctx.save();
      if (feel.blur && far > 0.02) ctx.filter = `blur(${(far * 22).toFixed(1)}px)`;
      card(ctx, env, place(i, t), env.media(i === lead - 1 ? 2 : i + 3), 0, fade * (1 - far * 0.9));
      ctx.restore();
    });
    // The label is the middle of the frame here, set large, with the pictures around it.
    ctx.save();
    ctx.globalAlpha = 1 - seg(t, PICK_AT - 0.1, PICK_AT + 0.25);
    say(ctx, env, wrap(ctx, env, c.label, 84, 720).slice(0, 3), MID.x, MID.y - 20, 84, t, {
      start: 0.7,
      stagger: 0.07,
    });
    ctx.restore();
    pickAndLift(ctx, env, t, place(lead, Math.min(t, LIFT_AT)), picked, seg(t, 0.1, 0.35));
    pickPointer(ctx, env, t, place(lead, PICK_AT));
  },
});

const RINGED = { w: 520, h: 330, cards: 9, step: 0.4, radius: 1180 };

register<WallContent>({
  kind: 'wall',
  id: 'carousel',
  name: 'Curved carousel',
  entry: { box: TILE, media: 2 },
  dur: () => 5.2,
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

function features(lay: FeatureLayout) {
  return (ctx: Ctx, t: number, d: number, env: Env, c: FeaturesContent): void => {
    const { feel } = env;
    const n = c.items.length;
    const i = Math.min(n - 1, Math.floor(t / SPAN));
    const lt = t - i * SPAN;
    const f = c.items[i];
    const hero: Box = { ...lay.hero, cy: lay.hero.cy + Math.sin(env.T * 1.3) * 6 * (1 - env.out) };
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
        const back = k - (i === 0 ? 0 : 1 - Math.min(1, settle));
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
const HERO_LEFT: Box = { ...HERO, cx: W - HERO.cx + 40 };
const STAGE: Box = { cx: MID.x, cy: 400, w: 980, h: 552, r: 28 };
const HERO_DECK: Box = { cx: 1450, cy: 540, w: 780, h: 490, r: 28 };

register<FeaturesContent>({
  kind: 'features',
  id: 'split',
  name: 'Words left, screen right',
  entry: { box: HERO, media: 0, chrome: 1 },
  dur: featureDur,
  draw: features({
    hero: HERO,
    text: { x: 130, y: 540, align: 'left', max: 740, title: 112, body: 38 },
    swap: { x: 760, y: 0 },
    pips: { x: 132, y: 900 },
  }),
});

register<FeaturesContent>({
  kind: 'features',
  id: 'flip',
  name: 'Screen left, words right',
  entry: { box: HERO_LEFT, media: 0, chrome: 1 },
  dur: featureDur,
  draw: features({
    hero: HERO_LEFT,
    text: { x: 1100, y: 540, align: 'left', max: 720, title: 104, body: 38 },
    swap: { x: -760, y: 0 },
    pips: { x: 1102, y: 900 },
  }),
});

register<FeaturesContent>({
  kind: 'features',
  id: 'stage',
  name: 'Screen on top, words under',
  entry: { box: STAGE, media: 0, chrome: 1 },
  dur: featureDur,
  draw: features({
    hero: STAGE,
    text: { x: MID.x, y: 860, align: 'center', max: 1500, title: 84, body: 34 },
    swap: { x: 0, y: -760 },
    pips: { x: MID.x, y: 1030 },
  }),
});

register<FeaturesContent>({
  kind: 'features',
  id: 'deck',
  name: 'Deck of screens',
  entry: { box: HERO_DECK, media: 0, chrome: 1 },
  dur: featureDur,
  draw: features({
    hero: HERO_DECK,
    text: { x: 130, y: 540, align: 'left', max: 620, title: 100, body: 36 },
    swap: { x: 700, y: 0 },
    pips: { x: 132, y: 900 },
    deck: true,
  }),
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
  if (pulse < 1) {
    ctx.strokeStyle = rgba(env.c.ink, 0.5 * (1 - pulse));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(MID.x, MID.y, 12 + 340 * pulse, 0, 7);
    ctx.stroke();
    ctx.fillStyle = rgba(env.c.ink, 1 - seg(t, 0, 0.18));
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
  id: 'count',
  name: 'One at a time',
  entry: { box: SEED },
  dur: (c) => statsOf(c).length * STAT + 0.8,
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
      bigNumber(ctx, env, s.value, -8, 0, 330, out(seg(env.frame - i * STAT, 0.1, 1.05)));
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
  id: 'row',
  name: 'Side by side',
  entry: { box: SEED },
  dur: () => 5.2,
  draw(ctx, t, _d, env, c) {
    const list = statsOf(c).slice(0, 3);
    const { feel } = env;
    const span = Math.min(580, 1680 / Math.max(1, list.length));
    const size = Math.min(
      190,
      ...list.map((s) => (190 * (span - 70)) / Math.max(1, widthOf(ctx, env, s.value, 190))),
    );
    ctx.save();
    leave(ctx, env, 30);
    list.forEach((s, i) => {
      const x = MID.x + (i - (list.length - 1) / 2) * span;
      const at = 0.35 + i * 0.3 * feel.gap;
      const lt = t - at;
      if (lt <= 0) return;
      const inn = feel.rise(lt);
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
  id: 'card',
  name: 'Design on a card',
  entry: { box: FULL, fill: 'hot' },
  dur: () => 5,
  draw(ctx, t, _d, env, c) {
    ctx.save();
    ctx.globalAlpha = 1 - env.out;
    ctx.fillStyle = env.c.hot;
    ctx.fillRect(0, 0, W, H);
    const shade = ctx.createRadialGradient(MID.x, H * 1.1, 0, MID.x, H * 1.1, 1100);
    shade.addColorStop(0, 'rgba(0,0,0,0.3)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
    say(ctx, env, [c.label], MID.x, 104, 24, t, {
      voice: 'mono',
      color: rgba(env.c.onHot, 0.8),
      start: 0.5,
      stagger: 0.06,
    });
    ctx.restore();

    const inn = env.feel.glide(t - 0.1);
    // The card takes the design's own shape, so a story stays tall and a post stays wide.
    const shape = c.canvas.width / Math.max(1, c.canvas.height);
    const tall = Math.min(664, 1180 / shape);
    const full: Box = { cx: MID.x, cy: 582, w: tall * shape, h: tall, r: 28 };
    const rest = {
      ...full,
      cy: full.cy + 760 * (1 - inn),
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
  id: 'swipe',
  name: 'Pages swipe by',
  dur: () => 4.6,
  draw(ctx, t, _d, env, c) {
    ctx.save();
    ctx.globalAlpha = seg(t, 0.2, 0.5) * (1 - env.out);
    say(ctx, env, [c.label], MID.x, 96, 24, t, { voice: 'mono', color: dim(env), start: 0.2 });
    ctx.restore();
    const inn = env.feel.glide(t - 0.05);
    const shape = c.canvas.width / Math.max(1, c.canvas.height);
    const tall = Math.min(780, 1500 / shape);
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
  id: 'meet',
  name: 'Two marks meet',
  dur: () => 4.4,
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

register<OutroContent>({
  kind: 'outro',
  id: 'lockup',
  name: 'Logo and name',
  entry: { box: MARK, fill: 'hot' },
  dur: () => 5,
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
        wrap(ctx, env, c.tagline, 38, 1100, 'text').slice(0, 2),
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
  id: 'wordmark',
  name: 'Giant name',
  entry: { box: MARK, fill: 'hot' },
  dur: () => 5,
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
      const size = Math.min(300, (300 * 1640) / Math.max(1, widthOf(ctx, env, env.brand, 300)));
      say(ctx, env, [env.brand], MID.x, 580 + size * 0.18, size, t, { start: 0.6, stagger: 0.14 });
      say(ctx, env, wrap(ctx, env, c.tagline, 38, 1100, 'text').slice(0, 2), MID.x, 780, 38, t, {
        voice: 'text',
        color: dim(env),
        start: 1.2,
        stagger: 0.05,
      });
      linkPill(ctx, env, c.link, 900, t, 1.9);
    });
  },
});
