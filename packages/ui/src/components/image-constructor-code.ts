// A code window: an editor frame with a file tab, drawn from the layer's own code with syntax colors.
// Like a chart, it's an art layer whose drawing is rebuilt from its data, so it exports as vectors.

import type { ICArtDef } from './image-constructor-art.js';

export type ICCodeLang = 'ts' | 'js' | 'py' | 'sol' | 'rs' | 'go' | 'sh' | 'json';

export interface ICCodeData {
  text: string;
  lang: ICCodeLang;
  /** The file name on the tab. Empty hides the tab. */
  title: string;
  theme: 'dark' | 'light';
  lines: boolean;
}

export const CODE_ART = 'code-window';
export const isCode = (id: string) => id === CODE_ART;

export const CODE_LANGS: [ICCodeLang, string][] = [
  ['ts', 'TypeScript'],
  ['js', 'JavaScript'],
  ['sol', 'Solidity'],
  ['py', 'Python'],
  ['rs', 'Rust'],
  ['go', 'Go'],
  ['sh', 'Shell'],
  ['json', 'JSON'],
];

export const sampleCode = (): ICCodeData => ({
  text: "import { connect } from 'wallet-kit';\n\nconst wallet = await connect();\nconsole.log('Hi ' + wallet.address);",
  lang: 'ts',
  title: 'connect.ts',
  theme: 'dark',
  lines: false,
});

const KEYWORDS: Record<ICCodeLang, string> = {
  ts: 'import export from const let var function return async await if else for while new class extends interface type enum implements public private readonly as of in typeof keyof true false null undefined this throw try catch default',
  js: 'import export from const let var function return async await if else for while new class extends true false null undefined this throw try catch default typeof of in',
  sol: 'pragma solidity contract interface library function returns return public private internal external view pure payable memory storage calldata event emit modifier require if else for while mapping struct constructor override virtual true false msg import is new',
  py: 'import from as def return if elif else for while in not and or class with try except finally raise lambda None True False self async await pass yield print',
  rs: 'fn let mut pub use mod struct enum impl trait for in if else match return async await self Self true false loop while const static crate where as ref move dyn',
  go: 'package import func return var const type struct interface map chan go defer if else for range switch case default true false nil',
  sh: 'if then else fi for do done in case esac function export echo cd npm npx pnpm curl git sudo',
  json: 'true false null',
};

const TYPES: Record<ICCodeLang, string> = {
  ts: 'string number boolean void any unknown never Promise Record',
  js: 'Promise',
  sol: 'address uint256 uint128 uint64 uint32 uint8 uint int256 int bool bytes bytes32 string',
  py: 'int str float bool list dict tuple set',
  rs: 'u8 u16 u32 u64 u128 usize i32 i64 f32 f64 bool String str Vec Option Result',
  go: 'int int64 uint64 string bool error byte float64',
  sh: '',
  json: '',
};

interface Theme {
  bg: string;
  bar: string;
  tab: string;
  text: string;
  dim: string;
  keyword: string;
  string: string;
  number: string;
  comment: string;
  fn: string;
  type: string;
}

const THEMES: Record<ICCodeData['theme'], Theme> = {
  dark: {
    bg: '#23272e',
    bar: '#1b1e23',
    tab: '#23272e',
    text: '#c8ccd4',
    dim: '#5c6370',
    keyword: '#c678dd',
    string: '#98c379',
    number: '#d19a66',
    comment: '#7f848e',
    fn: '#61afef',
    type: '#e5c07b',
  },
  light: {
    bg: '#ffffff',
    bar: '#eef0f3',
    tab: '#ffffff',
    text: '#24292f',
    dim: '#9aa1ab',
    keyword: '#cf222e',
    string: '#0a3069',
    number: '#0550ae',
    comment: '#6e7781',
    fn: '#8250df',
    type: '#953800',
  },
};

/** The tab's language badge: letters on a color, like an editor's file icon. */
const BADGE: Record<ICCodeLang, [string, string, string]> = {
  ts: ['TS', '#3178c6', '#ffffff'],
  js: ['JS', '#f0db4f', '#1b1b1b'],
  sol: ['SOL', '#6b7280', '#ffffff'],
  py: ['PY', '#3776ab', '#ffd43b'],
  rs: ['RS', '#ce422b', '#ffffff'],
  go: ['GO', '#00add8', '#ffffff'],
  sh: ['$_', '#4b5563', '#ffffff'],
  json: ['{}', '#6b7280', '#ffffff'],
};

type Kind = keyof Omit<Theme, 'bg' | 'bar' | 'tab' | 'dim'>;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Splits one line into colored runs. Comments and strings end at the line's end. */
export function highlight(line: string, lang: ICCodeLang): [string, Kind][] {
  const kw = new Set(KEYWORDS[lang].split(' '));
  const types = new Set(TYPES[lang].split(' ').filter(Boolean));
  const comment = lang === 'py' || lang === 'sh' ? '#.*' : lang === 'json' ? '(?!)' : '\\/\\/.*';
  const re = new RegExp(
    `(${comment})|("(?:[^"\\\\]|\\\\.)*"?|'(?:[^'\\\\]|\\\\.)*'?|\`[^\`]*\`?)|(\\b\\d[\\d_]*(?:\\.\\d+)?(?:e\\d+)?\\b|\\b0x[0-9a-fA-F]+\\b)|([A-Za-z_$][\\w$]*)|(\\s+|.)`,
    'g',
  );
  const out: [string, Kind][] = [];
  for (const m of line.matchAll(re)) {
    const [all, com, str, num, word] = m;
    let kind: Kind = 'text';
    if (com) kind = 'comment';
    else if (str) kind = 'string';
    else if (num) kind = 'number';
    else if (word) {
      const after = line.slice((m.index ?? 0) + all.length);
      if (kw.has(word)) kind = 'keyword';
      else if (types.has(word) || /^[A-Z]/.test(word)) kind = 'type';
      else if (/^\s*\(/.test(after)) kind = 'fn';
    }
    const last = out[out.length - 1];
    if (last && last[1] === kind) last[0] += all;
    else out.push([all, kind]);
  }
  return out;
}

// Layout in drawing units. Geist Mono's letters are 0.6 of the font size wide.
const FS = 16;
const CH = FS * 0.6;
const LH = FS * 1.65;
const PAD = 26;
const BAR = 46;
const MIN_W = 420;
const FONT = "'Geist Mono', ui-monospace, Menlo, monospace";

/** The window as an art drawing, sized to fit its code. */
export function codeDef(code: ICCodeData): ICArtDef {
  const t = THEMES[code.theme];
  const lines = code.text.replace(/\t/g, '  ').split('\n');
  const gutter = code.lines ? String(lines.length).length * CH + 22 : 0;
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const w = Math.max(MIN_W, PAD * 2 + gutter + longest * CH);
  const h = BAR + PAD * 2 + lines.length * LH - (LH - FS);
  const dots = ['#ff5f57', '#febc2e', '#28c840']
    .map((c, i) => `<circle cx="${24 + i * 20}" cy="${BAR / 2}" r="6.5" fill="${c}"/>`)
    .join('');
  let tab = '';
  if (code.title.trim()) {
    const [label, bg, fg] = BADGE[code.lang];
    const bw = label.length > 2 ? 30 : 22;
    const tw = bw + 14 + code.title.length * 8.4 + 30;
    tab =
      `<path d="M92 ${BAR}V14a8 8 0 0 1 8-8h${tw - 16}a8 8 0 0 1 8 8v${BAR - 14}Z" fill="${t.tab}"/>` +
      `<rect x="108" y="${BAR / 2 - 8}" width="${bw}" height="17" rx="3" fill="${bg}"/>` +
      `<text x="${108 + bw / 2}" y="${BAR / 2 + 5}" text-anchor="middle" font-family="${FONT}" font-size="10.5" font-weight="700" fill="${fg}">${esc(label)}</text>` +
      `<text x="${108 + bw + 12}" y="${BAR / 2 + 5}" font-family="${FONT}" font-size="14" fill="${t.text}">${esc(code.title)}</text>`;
  }
  const body = lines
    .map((line, i) => {
      const y = BAR + PAD + FS * 0.8 + i * LH;
      const num = code.lines
        ? `<text x="${PAD + gutter - 22}" y="${y}" text-anchor="end" font-family="${FONT}" font-size="${FS}" fill="${t.dim}">${i + 1}</text>`
        : '';
      const runs = highlight(line, code.lang)
        .map(
          ([s, k]) =>
            `<tspan fill="${t[k]}"${k === 'comment' ? ' font-style="italic"' : ''}>${esc(s)}</tspan>`,
        )
        .join('');
      return `${num}<text x="${PAD + gutter}" y="${y}" font-family="${FONT}" font-size="${FS}" xml:space="preserve">${runs}</text>`;
    })
    .join('');
  const r = 14;
  // Two windows in one exported SVG need clip ids of their own.
  const clip = `cw${Math.round(w)}x${Math.round(h)}`;
  return {
    id: CODE_ART,
    name: 'Code window',
    kind: 'shape',
    group: 'Code',
    ratio: w / h,
    viewBox: `0 0 ${w} ${h}`,
    body:
      `<clipPath id="${clip}"><rect width="${w}" height="${h}" rx="${r}"/></clipPath><g clip-path="url(#${clip})">` +
      `<rect width="${w}" height="${h}" fill="${t.bg}"/><rect width="${w}" height="${BAR}" fill="${t.bar}"/>` +
      `${dots}${tab}${body}</g>`,
    slots: [],
  };
}
