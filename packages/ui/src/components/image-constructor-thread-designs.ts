// Whole threads: a cover, the posts in between and an ending, each post its own card. Six designs
// across three kinds of thread (how-to, explainer and list), in each built-in brand, for X and square.

import {
  ANNOUNCE_BRANDS,
  type LayerBuilder,
  layerBuilder,
  renumber,
} from './image-constructor-announce.js';
import { artDef } from './image-constructor-art.js';
import { blockStyle, type ICBlockStyle } from './image-constructor-blocks.js';
import { SAMPLE_LOGO } from './image-constructor-brand-builtin.js';
import { type BrandKit, brandBackground } from './image-constructor-brand-kit.js';
import { sampleCode } from './image-constructor-code.js';
import { device } from './image-constructor-device.js';
import { grouped, rows } from './image-constructor-groups.js';
import type { ICElement, ICTemplate } from './image-constructor-layout.js';
import { patternFor } from './image-constructor-patterns.js';
import {
  authorLine,
  browserWindow,
  chip,
  pointer,
  priceCard,
  quoteCard,
  stepBadge,
  txCard,
  walletConnect,
} from './image-constructor-thread-parts.js';

type B = LayerBuilder;

interface Brand {
  id: string;
  kit: BrandKit;
}

const BRANDS: Brand[] = ANNOUNCE_BRANDS.map((b) => ({ id: b.id, kit: b.kit }));

interface Ctx {
  b: B;
  H: number;
  s: ICBlockStyle;
  /** X, then square. */
  p: <T>(x: T, sq: T) => T;
  /** The page margin. */
  m: number;
  /** Where an inner page's headline starts, below the corner logo. */
  top: number;
  /** In a story, how far the square card sits from the canvas top, and the canvas's real height.
   *  Layouts draw a square card; full-height pieces stretch over the whole story with these. */
  oy: number;
  fullH: number;
}

type Layout = (x: Ctx) => ICElement[];

const head = (x: Ctx, o = {}) =>
  ({ font: x.s.heading, weight: 700, track: -0.03, lh: 1.08, ...o }) as const;
const body = (x: Ctx, o = {}) => ({ font: x.s.body, tone: 'muted' as const, lh: 1.4, ...o });
const lines = (text: string) => text.split('\n').length;

/** The page's place in the thread, top right, kept up to date as pages are added or moved. */
const counter = (x: Ctx, o: { tone?: 'muted' | 'onAccent' } = {}) =>
  x.b.text('thread_count', 100 - x.m - 14, x.m, 14, '2/7', x.p(2.2, 3), {
    font: 'geist-mono',
    weight: 500,
    tone: o.tone ?? 'muted',
    align: 'right',
  });

/** A small logo top left on inner pages, sized by height so any logo shape sits the same. */
const cornerLogo = (x: Ctx, lx = x.m, ly = x.m) => {
  const logo = x.s.logo;
  const h = x.p(2.6, 3.6);
  if (!logo) return [];
  return [x.b.image('logo', lx, ly, Math.min(h * logo.ratio, 22), logo.url, logo.ratio)];
};

/** A step's number badge, title and one line of detail, stacked from `y`. Returns where it ends. */
function stepText(x: Ctx, sx: number, y: number, w: number, title: string, detail: string) {
  const { b, s, p } = x;
  const size = p(6.4, 9);
  const ts = p(4.4, 6.2);
  const ds = p(2.3, 3.2);
  const ty = y + size + p(3, 4);
  const dy = ty + lines(title) * ts * 1.08 + p(1.8, 2.4);
  return {
    els: [
      ...stepBadge(b, s, sx, y, size).els,
      b.text('title', sx, ty, w, title, ts, head(x)),
      b.text('detail', sx, dy, w, detail, ds, body(x)),
    ],
    end: dy + lines(detail) * ds * 1.4,
  };
}

// ------------------------------------------------------------------ How-to: steps

/** A thread's label with the thread icon after it, starting at `tx` or centered on it. */
function threadTag(x: Ctx, tx: number, ty: number, text: string, centered: boolean) {
  const size = x.p(1.8, 2.4);
  const c = chip(x.b, x.s, 0, 0, text, size);
  const icon = c.h * 2.2;
  const gap = size * 0.8;
  const left = centered ? tx - (c.w + gap + icon) / 2 : tx;
  return grouped([
    ...chip(x.b, x.s, left, ty, text, size).els.map((e) => ({ ...e, groupId: undefined })),
    x.b.art('thread-spool', left + c.w + gap, ty + (c.h - icon) / 2, icon),
  ]);
}

const howtoCover: Layout = (x) => {
  const { b, s, p, m, H } = x;
  const hs = p(6.4, 8.6);
  const headline = p('Claim your\nairdrop in\n4 steps', 'Claim your airdrop\nin 4 steps');
  const hy = p(13, 20);
  const sy = hy + lines(headline) * hs * 1.08 + p(2.4, 3.2);
  const ss = p(2.3, 3.2);
  const w = p(36, 44);
  const [wx, wy] = p([100 - m - w, 9], [100 - m - w, 55]);
  return [
    ...threadTag(x, m, p(7, 9), 'HOW TO', false),
    b.text('headline', m, hy, p(52, 86), headline, hs, head(x, { weight: 800 })),
    b.text(
      'sub',
      m,
      sy,
      p(46, 60),
      p(
        'A thread for first-timers.\nAbout five minutes.',
        'A thread for first-timers.\nIt takes about five minutes.',
      ),
      ss,
      body(x),
    ),
    ...walletConnect(b, s, wx, wy, w).els,
    p(pointer(b, [45, 30], [57, 18.5]), pointer(b, [28, 74], [47, 66])),
    ...authorLine(b, s, m, H - m - p(7, 9), p(7, 9)).els,
  ];
};

const howtoWallet: Layout = (x) => {
  const { b, s, p, m } = x;
  const t = stepText(
    x,
    m,
    p(10, 12),
    p(44, 86),
    'Connect your wallet',
    'Open the claim page and pick\nthe wallet you hold the tokens in.',
  );
  const w = p(38, 56);
  const [cx, cy] = p([100 - m - w, 10], [22, t.end + 5]);
  return [
    ...cornerLogo(x),
    counter(x),
    ...t.els,
    ...walletConnect(b, s, cx, cy, w).els,
    pointer(b, [cx - p(12, 16), cy + w * 0.24 + p(9, 10)], [cx - 1.5, cy + w * 0.24]),
  ];
};

const howtoShot: Layout = (x) => {
  const { b, p, m, H } = x;
  const t = stepText(
    x,
    m,
    p(10, 12),
    p(37, 86),
    p('Check you\nqualify', 'Check you qualify'),
    'Paste your address. The page\nshows what you can claim.',
  );
  const [bx, bw] = p([44, 100 - m - 44], [m, 100 - m * 2]);
  const room = H - p(9, t.end + 4) - m;
  const bh = shotH(bw, room);
  const by = p((H - bh) / 2 + 1, t.end + 4);
  return [
    ...cornerLogo(x),
    counter(x),
    ...t.els,
    deviceIn(x, 'screen-window-right', bx, by, bw, bh),
    p(pointer(b, [32, 41], [bx - 1.5, by + bh * 0.55]), pointer(b, [62, by - 9], [74, by - 1.5])),
  ];
};

const howtoTx: Layout = (x) => {
  const { b, s, p, m } = x;
  const t = stepText(
    x,
    m,
    p(10, 12),
    p(42, 86),
    'Confirm the claim',
    'Sign in your wallet, then check\nthe transaction on the explorer.',
  );
  const w = p(45, 70);
  const rows = 5;
  const [cx, cy] = p([100 - m - w, 8], [(100 - w) / 2, t.end + 4]);
  return [
    ...cornerLogo(x),
    counter(x),
    ...t.els,
    ...txCard(b, s, cx, cy, w, rows).els,
    p(pointer(b, [40, 35], [cx - 1.5, 23]), pointer(b, [72, cy - 8], [80, cy - 1.5])),
  ];
};

const howtoCode: Layout = (x) => {
  const { b, p, m } = x;
  const t = stepText(
    x,
    m,
    p(10, 12),
    p(37, 86),
    p('Or use the\ncommand line', 'Or use the command line'),
    'Two commands: check, then claim\nto the same wallet.',
  );
  const w = p(52, 86);
  return [
    ...cornerLogo(x),
    counter(x),
    ...t.els,
    {
      ...b.art('code-window', p(100 - m - w, m), p(14, t.end + 5), w),
      code: {
        ...sampleCode(),
        lang: 'sh' as const,
        title: 'Terminal',
        text: "# Check you're eligible\nnpx yourbrand-cli check 0x71C7…976F\n\n# Claim to the same wallet\nnpx yourbrand-cli claim --to 0x71C7…976F",
      },
    },
  ];
};

// ------------------------------------------------------------------ How-to: guide

/** An outlined tag in the on-accent color, for text on the accent panel. */
function onAccentChip(x: Ctx, cx: number, cy: number, text: string, size: number) {
  const h = size * 2.1;
  const w = size * (text.length * 0.68 + 2.8);
  return grouped([
    x.b.rect(cx, cy, w, h, '', { line: 'onAccent', sw: 0.25, radius: h / 2 }),
    x.b.text('chip', cx, cy + (h - size * 1.15) / 2, w, text, size, {
      font: x.s.body,
      weight: 600,
      tone: 'onAccent',
      align: 'center',
    }),
  ]);
}

/** A device drawing fitted inside a box and centered in it, like the browser windows it stands in
 *  for. Heights are in canvas-width units, as the builder takes them. */
function deviceIn(x: Ctx, art: string, bx: number, by: number, bw: number, bh: number) {
  const ratio = artDef(art)?.ratio ?? 1.5;
  const w = Math.min(bw, bh * ratio);
  const h = w / ratio;
  return x.b.art(art, bx + (bw - w) / 2, by + (bh - h) / 2, w);
}

/** A browser window no taller than a wide screenshot needs, so the stand-in fills it. */
const shotH = (w: number, room: number) => Math.min(room, w * 0.687);

/** The left side in the accent color, full height. */
const panel = (x: Ctx, w: number) => x.b.rect(0, -x.oy, w, x.fullH, 'accent');

/** A phone centered in the space right of the panel, and its top edge. */
function centerPhone(x: Ctx, pw: number, w = x.p(19, 30)) {
  const y = (x.H - w * 2.05) / 2;
  return { els: device(x.b, 'phone', pw + (100 - pw - w) / 2, y, w), y };
}

/** A step's big number, title and detail on the panel, centered top to bottom. */
function panelStep(x: Ctx, pw: number, title: string, detail: string) {
  const { b, p, m, H } = x;
  const ns = p(16, 22);
  const ts = p(4.4, 5.6);
  const ds = p(2.2, 2.9);
  const g1 = p(2.5, 3);
  const g2 = p(1.6, 2.4);
  const h = ns + g1 + lines(title) * ts * 1.08 + g2 + lines(detail) * ds * 1.4;
  const y = (H - h) / 2;
  const ty = y + ns + g1;
  return [
    b.text(
      'step_no',
      m,
      y,
      30,
      '01',
      ns,
      head(x, { weight: 800, tone: 'onAccent', lh: 1, track: -0.05 }),
    ),
    b.text('title', m, ty, pw - m * 2, title, ts, head(x, { tone: 'onAccent' })),
    b.text(
      'detail',
      m,
      ty + lines(title) * ts * 1.08 + g2,
      pw - m * 2,
      detail,
      ds,
      body(x, { tone: 'onAccent', op: 0.85 }),
    ),
  ];
}

const GUIDE_STEPS = ['Get a wallet', 'Top up with a card', 'Pick what to swap', 'Swap in one tap'];

const splitCover: Layout = (x) => {
  const { b, p, m, H } = x;
  const pw = p(52, 58);
  const cs = p(1.8, 2.7);
  const hs = p(5.6, 7.9);
  const headline = '4 steps to\nyour first\nswap';
  const rs = p(2.3, 3.6);
  const rh = p(4.3, 7.4);
  const g = p(3, 4.5);
  const h = cs * 2.1 + g + lines(headline) * hs * 1.08 + g + GUIDE_STEPS.length * rh;
  const y = (H - h) / 2;
  const hy = y + cs * 2.1 + g;
  const ly = hy + lines(headline) * hs * 1.08 + g;
  return [
    panel(x, pw),
    ...onAccentChip(x, m, y, 'GUIDE', cs),
    b.text('headline', m, hy, pw - m * 2, headline, hs, head(x, { weight: 800, tone: 'onAccent' })),
    ...rows(GUIDE_STEPS, (step, i) => [
      b.rect(m, ly + i * rh, pw - m * 2, 0.2, 'onAccent', { op: 0.25 }),
      b.text(
        `step_${i + 1}_no`,
        m,
        ly + i * rh + (rh - rs * 1.15) / 2,
        8,
        String(i + 1).padStart(2, '0'),
        rs,
        {
          font: 'geist-mono',
          weight: 600,
          tone: 'onAccent',
          op: 0.7,
        },
      ),
      b.text(
        `step_${i + 1}`,
        m + rs * 2.8,
        ly + i * rh + (rh - rs * 1.15) / 2,
        pw - m * 2 - rs * 2.8,
        step,
        rs,
        {
          font: x.s.body,
          weight: 600,
          tone: 'onAccent',
        },
      ),
    ]),
    ...centerPhone(x, pw, p(19, 31)).els,
  ];
};

const splitStep: Layout = (x) => {
  const { b, p, H } = x;
  const pw = p(52, 56);
  return [
    panel(x, pw),
    ...panelStep(
      x,
      pw,
      'Top up with\na card',
      p(
        'Tap Buy, choose an amount and\npay with a card or bank transfer.',
        'Tap Buy, choose an amount\nand pay with a card or\nbank transfer.',
      ),
    ),
    counter(x),
    ...centerPhone(x, pw).els,
    pointer(b, [pw - 3, H / 2 + p(7, 9)], [pw + (100 - pw - p(19, 30)) / 2 - 1.5, H / 2 - p(2, 3)]),
  ];
};

const splitTip: Layout = (x) => {
  const { b, s, p, m, H } = x;
  const pw = p(52, 54);
  const cw = 100 - pw - m * 2;
  const tip = p(
    'Start with a small amount.\nCheck the rate and the fee\nbefore you confirm.',
    'Start small.\nCheck the rate\nand the fee\nbefore you\nconfirm.',
  );
  const tipS = p(2.2, 2.9);
  const pad = p(2.4, 3);
  const cs = p(1.8, 2.4);
  const tipH = pad + cs * 2.1 + p(2, 3) + lines(tip) * tipS * 1.4 + pad;
  const tipY = (H - tipH) / 2;
  const sh = p(8, 11);
  return [
    panel(x, pw),
    ...panelStep(
      x,
      pw,
      'Swap in\none tap',
      p(
        'Pick the two tokens, enter an\namount and confirm the swap.',
        'Pick the two tokens, enter\nan amount and confirm\nthe swap.',
      ),
    ),
    counter(x),
    b.rect(pw + m, tipY, cw, tipH, 'card', { line: 'panel', sw: 0.25, radius: 2.4 }),
    ...chip(b, s, pw + m + pad, tipY + pad, 'TIP', cs).els,
    b.text(
      'tip',
      pw + m + pad,
      tipY + pad + cs * 2.1 + p(2, 3),
      cw - pad * 2,
      tip,
      tipS,
      body(x, { tone: 'ink' }),
    ),
    b.art('shield', pw + m + cw - sh * 0.7, tipY - sh * 0.45, sh),
  ];
};

/** A step with two screens side by side, such as before and after a tap. */
const splitScreens: Layout = (x) => {
  const { b, p, H } = x;
  const pw = p(52, 56);
  // In a square the two phones overlap a little, so they can be bigger.
  const w = p(17, 21.5);
  const gap = p(3, -5);
  const x0 = pw + (100 - pw - w * 2 - gap) / 2;
  const y = (H - w * 2.05) / 2;
  return [
    panel(x, pw),
    ...panelStep(
      x,
      pw,
      "Confirm and\nyou're done",
      p(
        'Check the rate, tap Swap and\nsign in your wallet.',
        'Check the rate, tap Swap\nand sign in your wallet.',
      ),
    ),
    counter(x),
    ...device(b, 'phone', x0, y + p(4, 3), w),
    // The raised phone stays clear of the page counter in the top corner.
    ...device(b, 'phone', x0 + w + gap, y + p(0.5, -3), w),
  ];
};

// ------------------------------------------------------------------ Explainer

const explainHook: Layout = (x) => {
  const { b, s, p, m, H } = x;
  const hs = p(7, 9.4);
  const headline = "99% of people\ndon't get restaking.";
  const hy = p(15, 26);

  return [
    b.art(patternFor('pattern-dots-11', x.fullH), 0, -x.oy, 100, { op: 0.18, lock: true }),
    ...threadTag(x, 50, p(7, 12), 'EXPLAINER', true),
    b.text('headline', m, hy, 100 - m * 2, headline, hs, head(x, { weight: 800, align: 'center' })),
    b.text(
      'sub',
      m,
      hy + lines(headline) * hs * 1.08 + p(2.5, 3.5),
      100 - m * 2,
      'How it works, in six posts.',
      p(2.6, 3.4),
      body(x, { align: 'center' }),
    ),
    ...authorLine(b, s, 50 - p(12, 16), H - m - p(7, 9), p(7, 9)).els,
    b.art('arrow-down', p(86, 76), p(36, 66), p(6, 10)),
  ];
};

const explainDefine: Layout = (x) => {
  const { b, p, m } = x;
  const ts = p(9, 11);
  const ty = p(14, 20);
  const def =
    'Using tokens you already staked\nto secure other networks too,\nfor extra rewards and extra risk.';
  const ds = p(3.6, 4.6);
  const dy = ty + ts * 1.1 + p(8, 11);
  return [
    ...cornerLogo(x),
    counter(x),
    b.text('term', m, ty, 90, 're·stak·ing', ts, head(x, { weight: 800 })),
    b.text('phonetic', m, ty + ts * 1.15 + p(0.5, 1), 80, '/riː ˈsteɪ kɪŋ/  ·  noun', p(2.2, 3), {
      font: 'geist-mono',
      tone: 'accent',
    }),
    b.rect(m, dy - p(3.5, 4.5), p(10, 14), 0.5, 'accent'),
    b.text('definition', m, dy, p(80, 88), def, ds, { font: x.s.body, weight: 500, lh: 1.35 }),
  ];
};

const explainMechanism: Layout = (x) => {
  const { b, p, m } = x;
  const ts = p(5, 6.4);
  const steps: [string, string, string][] = [
    ['coin', 'Stake', 'You lock tokens\nto secure a chain.'],
    ['layers', 'Restake', 'The same stake\nbacks new networks.'],
    ['shield', 'Earn', 'Each network pays\nfor the security.'],
  ];
  const gap = p(8, 6);
  const cw = (100 - m * 2 - gap * 2) / 3;
  const cy = x.top + ts * 1.1 + p(4, 6);
  const ch = p(20, 30);
  const is = cw * 0.34;
  return [
    ...cornerLogo(x),
    counter(x),
    b.text('headline', m, x.top, 80, 'How it works', ts, head(x)),
    ...rows(steps, ([icon, name, note], i) => {
      const cx = m + i * (cw + gap);
      return [
        b.rect(cx, cy, cw, ch, 'card', { line: 'panel', sw: 0.25, radius: 2.4 }),
        b.art(icon, cx + (cw - is) / 2, cy + ch * 0.18, is),
        b.text(
          `step_${i + 1}`,
          cx,
          cy + ch * 0.18 + is + p(1.6, 2.4),
          cw,
          name,
          p(2.8, 3.6),
          head(x, { align: 'center' }),
        ),
        b.text(
          `note_${i + 1}`,
          cx - gap * 0.4,
          cy + ch + p(2, 3),
          cw + gap * 0.8,
          note,
          p(1.9, 2.6),
          body(x, { align: 'center' }),
        ),
      ];
    }),
    ...[0, 1].map((i) =>
      b.art(
        'arrow-straight',
        m + i * (cw + gap) + cw + gap * 0.12,
        cy + ch / 2 - gap * 0.1,
        gap * 0.76,
      ),
    ),
    b.text(
      'footnote',
      m,
      cy + ch + p(9.5, 16),
      100 - m * 2,
      p(
        'One stake, several jobs. That is the whole idea, and the whole risk.',
        'One stake, several jobs. That is the\nwhole idea, and the whole risk.',
      ),
      p(2.2, 3.2),
      body(x, { tone: 'ink' }),
    ),
  ];
};

const explainExample: Layout = (x) => {
  const { b, p, m } = x;
  const ts = p(5, 6.4);
  const cw = p(54, 86);
  const code = {
    ...sampleCode(),
    lang: 'sol' as const,
    title: 'Restake.sol',
    text: 'function restake(uint256 amount) external {\n  stake[msg.sender] -= amount;\n  security[msg.sender] += amount;\n  emit Restaked(msg.sender, amount);\n}',
  };
  const cy = x.top + ts * 1.1 + p(3, 5);
  const caption = p(
    'The stake never\nmoves. It gets a\nsecond job.',
    'The stake never moves.\nIt gets a second job.',
  );
  const cs = p(3, 4.4);
  const [tx, ty] = p([m + cw + 6, 22], [m, 72]);
  return [
    ...cornerLogo(x),
    counter(x),
    b.text('headline', m, x.top, 80, 'In practice', ts, head(x)),
    { ...b.art('code-window', m, cy, cw), code },
    b.text('caption', tx, ty, p(30, 60), caption, cs, head(x, { weight: 600, lh: 1.25 })),
    p(
      pointer(b, [72, 39], [m + cw + 1.5, 31], -1),
      pointer(b, [62, 76], [70, cy + cw / 2.16 + 1.5], -1),
    ),
  ];
};

const explainLimits: Layout = (x) => {
  const { b, p, m } = x;
  const ts = p(5, 6.4);
  const risks: [string, string, string][] = [
    ['lock', 'Slashing', 'A bad operator can cost you part of your stake.'],
    ['key', 'Lockups', 'Getting out can take days, sometimes weeks.'],
    ['shield', 'Stacked risk', 'One failure can hit every network at once.'],
  ];
  const rh = p(10, 15);
  const gap = p(2, 3);
  const top = x.top + ts * 1.1 + p(3.5, 5);
  const is = rh * 0.5;
  return [
    ...cornerLogo(x),
    counter(x),
    b.text('headline', m, x.top, 80, 'The catch', ts, head(x)),
    ...rows(risks, ([icon, name, note], i) => {
      const ry = top + i * (rh + gap);
      return [
        b.rect(m, ry, 100 - m * 2, rh, 'card', { line: 'panel', sw: 0.25, radius: 2 }),
        b.art(icon, m + rh * 0.25, ry + (rh - is) / 2, is),
        b.text(
          `risk_${i + 1}`,
          m + rh * 0.25 + is + p(2.4, 3),
          ry + rh * 0.2,
          60,
          name,
          p(2.6, 3.6),
          head(x, { weight: 700 }),
        ),
        b.text(
          `risk_note_${i + 1}`,
          m + rh * 0.25 + is + p(2.4, 3),
          ry + rh * 0.2 + p(3.4, 4.8),
          p(70, 68),
          note,
          p(2.1, 2.5),
          body(x),
        ),
      ];
    }),
  ];
};

const explainLinks: Layout = (x) => {
  const { b, s, p, m, H } = x;
  const ts = p(5, 6.4);
  const links: [string, string][] = [
    ['The docs', 'docs.yourbrand.xyz/restaking'],
    ['Risk dashboard', 'yourbrand.xyz/risk'],
    ['Our full write-up', 'yourbrand.xyz/blog/restaking'],
  ];
  const rh = p(8, 12);
  const top = x.top + ts * 1.1 + p(3.5, 5);
  return [
    ...cornerLogo(x),
    counter(x),
    b.text('headline', m, x.top, 80, 'Go deeper', ts, head(x)),
    ...rows(links, ([name, url], i) => {
      const ry = top + i * rh;
      return [
        b.rect(m, ry, 100 - m * 2, 0.2, 'panel'),
        b.text(
          `link_${i + 1}`,
          m,
          ry + p(1.6, 2.4),
          60,
          name,
          p(2.6, 3.6),
          head(x, { weight: 600 }),
        ),
        b.text(`url_${i + 1}`, m, ry + p(1.6, 2.4) + p(3.2, 4.4), 90, url, p(2, 2.8), {
          font: 'geist-mono',
          tone: 'accent',
        }),
      ];
    }),
    ...authorLine(b, s, m, H - m - p(7, 9), p(7, 9)).els,
  ];
};

// ------------------------------------------------------------------ Deep dive

/** A section label like "02 Mechanism": the number on the accent, the name on the card color. */
function section(x: Ctx, sx: number, sy: number, n: string, name: string) {
  const { b, p } = x;
  const size = p(2, 2.8);
  const h = size * 2.2;
  const nw = size * (n.length * 0.62 + 1.6);
  const tw = size * (name.length * 0.6 + 1.8);
  return grouped([
    b.rect(sx, sy, nw, h, 'accent', { radius: 0.8 }),
    b.text('section_no', sx, sy + (h - size * 1.15) / 2, nw, n, size, {
      font: 'geist-mono',
      weight: 600,
      tone: 'onAccent',
      align: 'center',
    }),
    b.rect(sx + nw, sy, tw, h, 'ink', { radius: 0.8 }),
    b.text('section', sx + nw, sy + (h - size * 1.15) / 2, tw, name, size, {
      font: x.s.heading,
      weight: 700,
      tone: 'bg',
      align: 'center',
    }),
  ]);
}

const VAULT = `function deposit(uint256 assets) external {
  shares = previewDeposit(assets);
  asset.transferFrom(msg.sender, this, assets);
  _mint(msg.sender, shares);
}`;

const tearCover: Layout = (x) => {
  const { b, s, p, m } = x;
  const hs = p(6.6, 8.6);
  const headline = "How Partner's\nvault works";
  const hy = p(15, 18);
  const cw = p(46, 60);
  return [
    ...chip(b, s, m, p(7, 9), 'DEEP DIVE', p(1.8, 2.4)).els,
    b.text('headline', m, hy, p(50, 86), headline, hs, head(x, { weight: 800 })),
    b.text(
      'sub',
      m,
      hy + lines(headline) * hs * 1.08 + p(2.4, 3.2),
      p(40, 70),
      'The contracts, line by line.\nEight posts.',
      p(2.4, 3.2),
      body(x),
    ),
    {
      ...b.art('code-window', p(100 - m - cw + 3, 100 - m - cw), p(12, 54), cw, { rot: -4 }),
      code: { ...sampleCode(), lang: 'sol' as const, title: 'Vault.sol', text: VAULT },
    },
    p(pointer(b, [39, 43], [50, 32]), pointer(b, [18, 86], [32, 75])),
    b.text('start', p(24, 5), p(46, 88), 30, 'Start here', p(2.4, 3.2), head(x, { weight: 600 })),
  ];
};

const tearCode: Layout = (x) => {
  const { b, p, m } = x;
  const cw = p(60, 86);
  return [
    counter(x),
    ...section(x, m, m, '01', 'Deposit'),
    {
      ...b.art('code-window', m, p(13, 16), cw),
      code: { ...sampleCode(), lang: 'sol' as const, title: 'Vault.sol', lines: true, text: VAULT },
    },
    b.text(
      'caption',
      p(m + cw + 5, m + 30),
      p(24, 62),
      p(26, 56),
      p('Shares are\npriced before\nthe transfer.', 'Shares are priced\nbefore the transfer.'),
      p(3, 4.2),
      head(x, { weight: 600, lh: 1.25 }),
    ),
    p(
      pointer(b, [77, 40], [m + cw + 1.5, 33], -1),
      pointer(b, [33, 67], [26, 16 + cw / 2.1 + 1.5], -1),
    ),
  ];
};

const tearVersus: Layout = (x) => {
  const { b, s, p, m } = x;
  const gap = p(6, 6);
  const cw = p((100 - m * 2 - gap) / 2, 66);
  const cy = p(14, 15);
  const v1 =
    'function withdraw(uint256 s) external {\n  uint256 a = convert(s);\n  asset.transfer(msg.sender, a);\n  _burn(msg.sender, s);\n}';
  const v2 =
    'function withdraw(uint256 s) external {\n  _burn(msg.sender, s);\n  uint256 a = convert(s);\n  asset.transfer(msg.sender, a);\n}';
  const vs = p(5, 6);
  return [
    counter(x),
    ...section(x, m, m, '02', 'Withdraw'),
    {
      ...b.art('code-window', p(m, 17), cy, cw),
      code: { ...sampleCode(), lang: 'sol' as const, title: 'v1.sol', text: v1 },
    },
    {
      ...b.art('code-window', p(m + cw + gap, 17), p(cy, cy + cw / 2.07 + gap), cw),
      code: { ...sampleCode(), lang: 'sol' as const, title: 'v2.sol', text: v2 },
    },
    b.rect(50 - vs / 2, p(cy + 8, cy + cw / 2.07 + gap / 2 - vs / 2), vs, vs, 'accent', {
      radius: 1,
    }),
    b.text(
      'vs',
      50 - vs / 2,
      p(cy + 8, cy + cw / 2.07 + gap / 2 - vs / 2) + (vs - vs * 0.42 * 1.15) / 2,
      vs,
      'VS',
      vs * 0.42,
      { font: s.heading, weight: 800, tone: 'onAccent', align: 'center' },
    ),
    b.text(
      'caption',
      m,
      p(42, 89),
      100 - m * 2,
      p(
        'v2 burns the shares first, so a reentrant\ncall finds nothing left to take.',
        'v2 burns the shares first, so a reentrant call finds nothing.',
      ),
      p(2.4, 2.6),
      body(x, { tone: 'ink', align: 'center' }),
    ),
  ];
};

const tearShot: Layout = (x) => {
  const { b, s, p, m, H } = x;
  const [bx, by, bw] = p([m, 13, 64], [m, 16, 100 - m * 2]);
  const bh = p(H - by - m, 56);
  return [
    counter(x),
    ...section(x, m, m, '03', 'In the app'),
    ...browserWindow(b, s, bx, by, bw, bh, 'app.partner.xyz/vault').els,
    b.text(
      'caption',
      p(bx + bw + 4, m),
      p(20, by + bh + 5),
      p(100 - bx - bw - 4 - m, 70),
      p(
        'The app reads\nthis share\nprice straight\nfrom the\ncontract.',
        'The app reads this share price\nstraight from the contract.',
      ),
      p(2.8, 3.6),
      head(x, { weight: 600, lh: 1.25 }),
    ),
    p(
      pointer(b, [79, 44], [bx + bw + 1.5, 36], -1),
      pointer(b, [72, by + bh + 8], [64, by + bh + 1.5], -1),
    ),
  ];
};

const tearChain: Layout = (x) => {
  const { b, s, p, m } = x;
  const w = p(52, 84);
  const [cx, cy] = p([100 - m - w, 12], [8, 16]);
  const card = txCard(b, s, cx, cy, w, 5);
  return [
    counter(x),
    ...section(x, m, m, '04', 'On-chain'),
    ...card.els,
    b.text(
      'caption',
      m,
      p(20, cy + card.h + 5),
      p(34, 84),
      p(
        'Every deposit\nleaves a trail\nlike this one.',
        'Every deposit leaves a trail like this one.',
      ),
      p(3, 3.4),
      head(x, { weight: 600, lh: 1.25 }),
    ),
  ];
};

const tearTakeaways: Layout = (x) => {
  const { b, p, m } = x;
  const ts = p(5, 6.4);
  const items = [
    'Shares are priced before any transfer',
    'Withdrawals burn first, then pay out',
    'The vault takes fees from yield',
    'Two audits, both public',
  ];
  const gap = p(7.4, 11);
  const size = p(2.8, 3.8);
  return [
    counter(x),
    ...section(x, m, m, '05', 'Takeaways'),
    b.text('headline', m, p(13, 17), 80, 'What to remember', ts, head(x)),
    ...rows(items, (line, i) => [
      b.art('verified', m, p(24, 32) + i * gap, size * 1.15),
      b.text(
        `point_${i + 1}`,
        m + size * 1.9,
        p(24, 32) + i * gap,
        100 - m * 2 - size * 1.9,
        line,
        size,
        { font: x.s.body, weight: 500 },
      ),
    ]),
  ];
};

// ------------------------------------------------------------------ List

/** The line that connects a thread's posts, down the left of each card, with this card's dot. */
function rail(x: Ctx, dotY: number) {
  const { b, p, H, oy } = x;
  const rx = p(6.5, 8.5);
  const d = p(2.6, 3.4);
  return [
    { ...b.rect(rx - 0.25, -oy, 0.5, dotY + oy, 'muted', { op: 0.6 }), rail: 'top' as const },
    {
      ...b.rect(rx - 0.25, dotY, 0.5, H + oy - dotY, 'muted', { op: 0.6 }),
      rail: 'bottom' as const,
    },
    b.rect(rx - d / 2, dotY - d / 2, d, d, 'accent', { radius: d / 2 }),
  ];
}

/** Where a list card's content starts, right of the rail. */
const railX = (x: Ctx) => x.p(12, 15);

/** An item's number: a small # and the big number in the `step_no` slot, numbered in order. */
function itemNo(x: Ctx, lx: number, y: number, ns: number) {
  return [
    x.b.text('hash', lx, y, 10, '#', ns * 0.55, head(x, { weight: 700, tone: 'accent' })),
    x.b.text(
      'step_no',
      lx + ns * 0.4,
      y,
      30,
      '01',
      ns,
      head(x, { weight: 800, tone: 'accent', lh: 1, track: -0.04 }),
    ),
  ];
}

const listCover: Layout = (x) => {
  const { b, s, p, m, H } = x;
  const lx = railX(x);
  const hs = p(7, 9);
  const headline = "7 tools I'm\nusing this week";
  const cy = p(7, 10);
  const cs = p(1.8, 2.4);
  const hy = p(17, 22);
  const big = p(44, 42);
  return [
    ...rail(x, cy + cs * 1.05),
    b.text(
      'big_number',
      100 - m - 40,
      p(4, 52),
      40,
      '7',
      big,
      head(x, { weight: 800, tone: 'accent', align: 'right', lh: 1, op: 0.9 }),
    ),
    ...chip(b, s, lx, cy, 'WEEK 39 · SEP 2026', cs, false).els,
    b.text('headline', lx, hy, p(52, 80), headline, hs, head(x, { weight: 800 })),
    b.text(
      'sub',
      lx,
      hy + lines(headline) * hs * 1.08 + p(2.4, 3.2),
      p(46, 60),
      'One per post. Save it for later.',
      p(2.4, 3.2),
      body(x),
    ),
    ...authorLine(b, s, lx, H - m - p(7, 9), p(7, 9)).els,
  ];
};

/** An item with its logo on a tile: the number, name, a line on it, and its link. */
const listItem: Layout = (x) => {
  const { b, s, p, m } = x;
  const lx = railX(x);
  const ns = p(13, 16);
  const ny = p(8, 10);
  const ts = p(5.2, 7);
  const tile = p(26, 30);
  const [tx, ty] = p([100 - m - tile, 11], [100 - m - tile, 14]);
  const ly = p(26, 46);
  const desc = 'One line on what it does\nand why it earned a spot.';
  const ds = p(2.4, 3.4);
  return [
    ...rail(x, ny + ns * 0.5),
    counter(x),
    ...itemNo(x, lx, ny, ns),
    b.rect(tx, ty, tile, tile, 'card', { line: 'panel', sw: 0.25, radius: 3 }),
    b.logo(
      'tool_logo',
      tx + tile * 0.2,
      ty + tile * 0.2,
      tile * 0.6,
      tile * 0.6,
      x.s.logo?.url ?? '',
      x.s.logo?.ratio ?? 1,
    ),
    b.text('title', lx, ly, p(50, 78), 'Tool name', ts, head(x, { weight: 800 })),
    b.text('detail', lx, ly + ts * 1.1 + p(1.6, 2.4), p(50, 78), desc, ds, body(x)),
    ...chip(
      b,
      s,
      lx,
      ly + ts * 1.1 + p(1.6, 2.4) + lines(desc) * ds * 1.4 + p(2.6, 4),
      'tool.xyz',
      p(1.9, 2.6),
      false,
    ).els,
  ];
};

/** An item shown in use: the number and name, then a screenshot of it on a laptop. */
const listShot: Layout = (x) => {
  const { b, p, m, H } = x;
  const lx = railX(x);
  const ns = p(11, 13);
  const ny = p(8, 10);
  const ts = p(4.6, 6.4);
  const ty = ny + ns + p(3, 3.5);
  const desc = p(
    'What it looks like, and\nthe one screen you need.',
    'What it looks like, and the one screen you need.',
  );
  const ds = p(2.3, 3.1);
  const end = ty + ts * 1.1 + p(1.6, 2.4) + lines(desc) * ds * 1.4;
  const [bx, bw] = p([50, 100 - m - 50], [lx, 100 - m - lx]);
  const bh = shotH(bw, H - p(9, end + 5) - m);
  const by = p((H - bh) / 2, end + 5);
  return [
    ...rail(x, ny + ns * 0.5),
    counter(x),
    ...itemNo(x, lx, ny, ns),
    b.text('title', lx, ty, p(34, 78), 'Another tool', ts, head(x, { weight: 800 })),
    b.text('detail', lx, ty + ts * 1.1 + p(1.6, 2.4), p(34, 78), desc, ds, body(x)),
    deviceIn(x, 'screen-laptop-silver', bx, by, bw, bh),
  ];
};

/** An item someone vouches for: the number and name, then their quote about it. */
const listQuote: Layout = (x) => {
  const { b, s, p, m, H } = x;
  const lx = railX(x);
  const ns = p(11, 13);
  const ny = p(8, 10);
  const ts = p(4.6, 6.4);
  const ty = ny + ns + p(3, 3.5);
  const desc = p('Why it stays on\nmy home screen.', 'Why it stays on my home screen.');
  const ds = p(2.3, 3.1);
  const qw = p(46, 100 - m - lx);
  const q = {
    text: 'Set it up once and forgot\nit was there. That is the\nhighest praise I have.',
    name: 'Sam Lee',
    handle: '@samlee',
  };
  const qh = quoteCard(b, s, 0, 0, qw, q).h;
  const [qx, qy] = p(
    [100 - m - qw, (H - qh) / 2],
    [lx, ty + ts * 1.1 + p(1.6, 2.4) + lines(desc) * ds * 1.4 + 5],
  );
  return [
    ...rail(x, ny + ns * 0.5),
    counter(x),
    ...itemNo(x, lx, ny, ns),
    b.text('title', lx, ty, p(34, 78), 'A wallet', ts, head(x, { weight: 800 })),
    b.text('detail', lx, ty + ts * 1.1 + p(1.6, 2.4), p(34, 78), desc, ds, body(x)),
    ...quoteCard(b, s, qx, qy, qw, q).els,
  ];
};

const listSummary: Layout = (x) => {
  const { b, p, m } = x;
  const lx = railX(x);
  const ts = p(5, 6.4);
  const hy = p(7, 9);
  const names = [
    'Tool name',
    'Another tool',
    'A wallet',
    'An explorer',
    'A dashboard',
    'A bot',
    'A newsletter',
  ];
  const cols = p(2, 1);
  const per = Math.ceil(names.length / cols);
  const rh = p(5.4, 9);
  const top = p(17, 20);
  const size = p(2.6, 3.6);
  const colW = (100 - m - lx) / cols;
  return [
    ...rail(x, hy + ts * 0.55),
    counter(x),
    b.text('headline', lx, hy, 80, 'The full list', ts, head(x)),
    ...rows(names, (name, i) => {
      const col = Math.floor(i / per);
      const ry = top + (i % per) * rh;
      const cx = lx + col * colW;
      return [
        b.rect(cx, ry, colW - p(4, 0), 0.2, 'panel'),
        b.text(
          `n_${i + 1}`,
          cx,
          ry + (rh - size * 1.15) / 2,
          8,
          String(i + 1).padStart(2, '0'),
          size,
          { font: 'geist-mono', weight: 600, tone: 'accent' },
        ),
        b.text(
          `item_${i + 1}`,
          cx + size * 2.6,
          ry + (rh - size * 1.15) / 2,
          colW - size * 3,
          name,
          size,
          { font: x.s.body, weight: 600 },
        ),
      ];
    }),
  ];
};

// ------------------------------------------------------------------ Recap

const recapCover: Layout = (x) => {
  const { b, s, p, m, H } = x;
  const hs = p(6.8, 8.8);
  const headline = 'What we shipped\nin September';
  const hy = p(16, 20);
  const stats: [string, string][] = [
    ['12', 'releases'],
    ['4', 'new chains'],
    ['38k', 'new users'],
  ];
  const gap = p(2.4, 3);
  const sw = p(19, (100 - m * 2 - gap * 2) / 3);
  const sy = p(14, 58);
  const sx0 = p(100 - m - sw, m);
  return [
    ...chip(b, s, m, p(7, 9), 'MONTHLY RECAP', p(1.8, 2.4)).els,
    b.text('headline', m, hy, p(58, 86), headline, hs, head(x, { weight: 800 })),
    ...authorLine(b, s, m, H - m - p(7, 9), p(7, 9)).els,
    ...rows(stats, ([n, label], i) => {
      const [cx, cy] = p([sx0, sy + i * (p(11, 0) + gap)], [sx0 + i * (sw + gap), sy]);
      const ch = p(11, 18);
      return [
        b.rect(cx, cy, sw, ch, 'card', { line: 'panel', sw: 0.25, radius: 2 }),
        b.text(
          `stat_${i + 1}`,
          cx + p(2, 3),
          cy + ch * 0.14,
          sw,
          n,
          p(4.4, 6.4),
          head(x, { weight: 800, tone: 'accent' }),
        ),
        b.text(
          `stat_label_${i + 1}`,
          cx + p(2, 3),
          cy + ch * 0.14 + p(5, 7.4),
          sw,
          label,
          p(1.9, 2.6),
          body(x),
        ),
      ];
    }),
  ];
};

const recapShipped: Layout = (x) => {
  const { b, s, p, m, H } = x;
  const ts = p(5, 6.4);
  const title = 'Gasless swaps';
  const [bx, bw] = p([46, 100 - m - 46], [m, 100 - m * 2]);
  const bh = shotH(bw, H - p(9, 40) - m);
  const by = p((H - bh) / 2 + 1, 40);
  const ty = p(18, 18);
  return [
    counter(x),
    ...chip(b, s, m, p(9, 9), 'SHIPPED · SEP 12', p(1.8, 2.4)).els,
    b.text('title', m, ty, p(38, 86), title, ts, head(x, { weight: 800 })),
    b.text(
      'detail',
      m,
      ty + ts * 1.1 + p(1.6, 2.4),
      p(36, 86),
      p(
        "Swap without holding the\nchain's gas token. We cover\nthe fee and take it from\nthe trade.",
        "Swap without holding the chain's gas token.\nWe cover the fee and take it from the trade.",
      ),
      p(2.3, 3.1),
      body(x),
    ),
    deviceIn(x, 'screen-window-stack', bx, by, bw, bh),
  ];
};

const recapStat: Layout = (x) => {
  const { b, s, p, m, H } = x;
  const big = p(12, 16);
  const cw = p(48, 64);
  const card = priceCard(b, s, 0, 0, cw);
  const [cx, cy] = p([100 - m - cw, (H - card.h) / 2], [100 - m - cw, 100 - m - card.h]);
  return [
    counter(x),
    b.text(
      'number',
      m,
      p(12, 10),
      p(44, 86),
      '$240M',
      big,
      head(x, { weight: 800, tone: 'accent', lh: 1, track: -0.04 }),
    ),
    b.text(
      'label',
      m,
      p(12, 10) + big * 1.05 + p(1.5, 2),
      p(40, 86),
      'traded through the app\nthis month',
      p(2.8, 3.6),
      body(x, { tone: 'ink', weight: 500 }),
    ),
    ...priceCard(b, s, cx, cy, cw).els,
  ];
};

const recapQuote: Layout = (x) => {
  const { b, s, p, m, H } = x;
  const w = p(62, 86);
  const q = quoteCard(b, s, 0, 0, w);
  return [
    counter(x),
    ...chip(b, s, m, p(8, 9), 'FROM THE AMA', p(1.8, 2.4)).els,
    ...quoteCard(b, s, (100 - w) / 2, (H - q.h) / 2 + p(3, 4), w).els,
  ];
};

const recapNext: Layout = (x) => {
  const { b, p, m } = x;
  const ts = p(5.4, 7);
  const items = ['Limit orders', 'Two more chains', 'A desktop app'];
  const rh = p(9, 13);
  const top = x.top + ts * 1.1 + p(4, 6);
  const size = p(3, 4.2);
  return [
    counter(x),
    ...cornerLogo(x),
    b.text('headline', m, x.top, 80, 'Coming in October', ts, head(x, { weight: 800 })),
    ...rows(items, (line, i) => {
      const ry = top + i * rh;
      return [
        b.rect(m, ry, 100 - m * 2, rh - p(1.6, 2.4), 'card', {
          line: 'panel',
          sw: 0.25,
          radius: 2,
        }),
        b.art('ring', m + p(2.4, 3), ry + (rh - p(1.6, 2.4) - size * 1.2) / 2, size * 1.2),
        b.text(
          `next_${i + 1}`,
          m + p(2.4, 3) + size * 2,
          ry + (rh - p(1.6, 2.4) - size * 1.15) / 2,
          70,
          line,
          size,
          { font: x.s.body, weight: 600 },
        ),
      ];
    }),
  ];
};

// ------------------------------------------------------------------ Templates

interface Design {
  key: string;
  title: string;
  /** Page kinds: key, the name Add page shows, and the layout. The first is the cover. */
  pages: [string, string, Layout][];
  /** The pages a new thread starts with, by kind, before the closing post. */
  start: string[];
}

const DESIGNS: Design[] = [
  {
    key: 'howto',
    title: 'How-to: steps',
    pages: [
      ['cover', 'Cover', howtoCover],
      ['wallet', 'Step: connect wallet', howtoWallet],
      ['shot', 'Step: screenshot', howtoShot],
      ['tx', 'Step: transaction', howtoTx],
      ['code', 'Step: code', howtoCode],
    ],
    start: ['cover', 'wallet', 'shot', 'tx'],
  },
  {
    key: 'guide',
    title: 'How-to: guide',
    pages: [
      ['cover', 'Cover', splitCover],
      ['phone', 'Step: phone', splitStep],
      ['screens', 'Step: two screens', splitScreens],
      ['tip', 'Step: tip', splitTip],
    ],
    start: ['cover', 'phone', 'screens', 'tip'],
  },
  {
    key: 'explainer',
    title: 'Explainer',
    pages: [
      ['cover', 'Hook', explainHook],
      ['define', 'Definition', explainDefine],
      ['mechanism', 'How it works', explainMechanism],
      ['example', 'Example', explainExample],
      ['limits', 'The catch', explainLimits],
      ['links', 'Links', explainLinks],
    ],
    start: ['cover', 'define', 'mechanism', 'example', 'limits', 'links'],
  },
  {
    key: 'teardown',
    title: 'Deep dive',
    pages: [
      ['cover', 'Cover', tearCover],
      ['code', 'Code', tearCode],
      ['versus', 'Before and after', tearVersus],
      ['shot', 'Screenshot', tearShot],
      ['chain', 'Transaction', tearChain],
      ['takeaways', 'Takeaways', tearTakeaways],
    ],
    start: ['cover', 'code', 'versus', 'shot', 'chain', 'takeaways'],
  },
  {
    key: 'list',
    title: 'Weekly list',
    pages: [
      ['cover', 'Cover', listCover],
      ['item', 'Item: logo', listItem],
      ['shot', 'Item: screenshot', listShot],
      ['quote', 'Item: quote', listQuote],
      ['summary', 'Full list', listSummary],
    ],
    start: ['cover', 'item', 'shot', 'quote', 'summary'],
  },
  {
    key: 'recap',
    title: 'Monthly recap',
    pages: [
      ['cover', 'Cover', recapCover],
      ['shipped', 'Shipped', recapShipped],
      ['stat', 'Big number', recapStat],
      ['quote', 'Quote', recapQuote],
      ['next', 'Coming next', recapNext],
    ],
    start: ['cover', 'shipped', 'stat', 'quote', 'next'],
  },
];

const H_X = 56.25;
const H_ST = (1920 / 1080) * 100;

function page(c: Brand, d: Design, kind: string, title: string, layout: Layout): ICTemplate {
  const s = { ...blockStyle(c.kit), logo: blockStyle(c.kit).logo ?? SAMPLE_LOGO };
  // A story shows the square card centered in its safe area.
  const build = (f: 'x' | 'sq' | 'st') => {
    const fullH = f === 'x' ? H_X : f === 'sq' ? 100 : H_ST;
    const H = f === 'x' ? H_X : 100;
    const oy = (fullH - H) / 2;
    const b = layerBuilder(fullH, c.kit.roles, f);
    const p = <T>(xv: T, sq: T): T => (f === 'x' ? xv : sq);
    const els = layout({ b, H, s, p, m: p(5, 7), top: p(10, 13.5), oy, fullH });
    const dy = (oy / fullH) * 100;
    return renumber(dy ? els.map((e) => ({ ...e, y: e.y + dy })) : els);
  };
  const bg = brandBackground(c.kit);
  const cover = kind === d.pages[0][0];
  const id = (k: string) => `${c.id === 'acme' ? 'thread' : `thread-${c.id}`}-${d.key}-${k}`;
  const last = c.id === 'acme' ? 'thread-last' : `thread-${c.id}-last`;
  return {
    id: id(kind),
    title: cover ? d.title : title,
    pack: 'Threads',
    brand: c.id,
    family: `${d.key}-${kind}`,
    ratio: 'x-post',
    scene: false,
    scenePrompt: '',
    seed: 1,
    model: 'flux2-klein',
    thumb: c.kit.roles.bg,
    bg,
    els: build('x'),
    variants: { '1:1': build('sq'), story: build('st') },
    source: null,
    kit: c.kit,
    ...(cover
      ? {
          thread: {
            pages: [...d.start.map(id), last],
            kinds: [...d.pages.slice(1).map(([k]) => id(k)), id(d.pages[0][0]), last],
          },
        }
      : { hidden: true }),
  };
}

export const THREAD_DESIGNS: ICTemplate[] = BRANDS.flatMap((c) =>
  DESIGNS.flatMap((d) => d.pages.map(([kind, title, layout]) => page(c, d, kind, title, layout))),
);
