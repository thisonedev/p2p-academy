// Every font a design can use, in the order the pickers show them. Files are in apps/web/public/fonts.

interface FontDef {
  id: string;
  label: string;
  group: 'Sans' | 'Mono' | 'Serif' | 'Display' | 'Script';
  /** CSS family name, also the name the face is registered under. */
  family: string;
  /** Fallbacks used until the face loads, or when it fails to. */
  stack: string;
  file: string;
  /** Weight range the file supports. */
  weight: string;
  /** Single-weight faces ignore the weight setting, because a browser would fake the bold. */
  fixedWeight?: boolean;
}

export const IC_FONT_LIST = [
  {
    id: 'sans',
    label: 'Inter',
    group: 'Sans',
    family: 'Inter',
    stack: 'Inter, "Helvetica Neue", Arial, sans-serif',
    file: 'inter-latin-wght-normal.woff2',
    weight: '100 900',
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    group: 'Sans',
    family: 'Montserrat',
    stack: 'Montserrat, Inter, Arial, sans-serif',
    file: 'montserrat-latin-wght-normal.woff2',
    weight: '100 900',
  },
  {
    id: 'dm-sans',
    label: 'DM Sans',
    group: 'Sans',
    family: 'DM Sans',
    stack: '"DM Sans", Inter, Arial, sans-serif',
    file: 'dm-sans-latin-wght-normal.woff2',
    weight: '100 1000',
  },
  {
    id: 'outfit',
    label: 'Outfit',
    group: 'Sans',
    family: 'Outfit',
    stack: 'Outfit, Inter, Arial, sans-serif',
    file: 'outfit-latin-wght-normal.woff2',
    weight: '100 900',
  },
  {
    id: 'grotesk',
    label: 'Space Grotesk',
    group: 'Sans',
    family: 'Space Grotesk',
    stack: '"Space Grotesk", Inter, Arial, sans-serif',
    file: 'space-grotesk-latin-wght-normal.woff2',
    weight: '300 700',
  },
  {
    id: 'geist',
    label: 'Geist',
    group: 'Sans',
    family: 'Geist',
    stack: 'Geist, Inter, Arial, sans-serif',
    file: 'geist-latin-wght-normal.woff2',
    weight: '100 900',
  },
  {
    id: 'geist-mono',
    label: 'Geist Mono',
    group: 'Mono',
    family: 'Geist Mono',
    stack: '"Geist Mono", ui-monospace, Menlo, monospace',
    file: 'geist-mono-latin-wght-normal.woff2',
    weight: '100 900',
  },
  {
    id: 'serif',
    label: 'Playfair Display',
    group: 'Serif',
    family: 'Playfair Display',
    stack: '"Playfair Display", Didot, Georgia, serif',
    file: 'playfair-display-latin-wght-normal.woff2',
    weight: '400 900',
  },
  {
    id: 'cormorant',
    label: 'Cormorant Garamond',
    group: 'Serif',
    family: 'Cormorant Garamond',
    stack: '"Cormorant Garamond", Georgia, serif',
    file: 'cormorant-garamond-latin-wght-normal.woff2',
    weight: '300 700',
  },
  {
    id: 'bodoni',
    label: 'Bodoni Moda',
    group: 'Serif',
    family: 'Bodoni Moda',
    stack: '"Bodoni Moda", Didot, Georgia, serif',
    file: 'bodoni-moda-latin-wght-normal.woff2',
    weight: '400 900',
  },
  {
    id: 'lora',
    label: 'Lora',
    group: 'Serif',
    family: 'Lora',
    stack: 'Lora, Georgia, serif',
    file: 'lora-latin-wght-normal.woff2',
    weight: '400 700',
  },
  {
    id: 'dm-serif',
    label: 'DM Serif Display',
    group: 'Serif',
    family: 'DM Serif Display',
    stack: '"DM Serif Display", Georgia, serif',
    file: 'dm-serif-display-latin-400-normal.woff2',
    weight: '400',
    fixedWeight: true,
  },
  {
    id: 'cond',
    label: 'Anton',
    group: 'Display',
    family: 'Anton',
    stack: 'Anton, "Arial Narrow", Impact, sans-serif',
    file: 'anton-latin-400-normal.woff2',
    weight: '400',
    fixedWeight: true,
  },
  {
    id: 'bebas',
    label: 'Bebas Neue',
    group: 'Display',
    family: 'Bebas Neue',
    stack: '"Bebas Neue", Anton, Impact, sans-serif',
    file: 'bebas-neue-latin-400-normal.woff2',
    weight: '400',
    fixedWeight: true,
  },
  {
    id: 'oswald',
    label: 'Oswald',
    group: 'Display',
    family: 'Oswald',
    stack: 'Oswald, "Arial Narrow", Impact, sans-serif',
    file: 'oswald-latin-wght-normal.woff2',
    weight: '200 700',
  },
  {
    id: 'archivo-black',
    label: 'Archivo Black',
    group: 'Display',
    family: 'Archivo Black',
    stack: '"Archivo Black", Arial, sans-serif',
    file: 'archivo-black-latin-400-normal.woff2',
    weight: '400',
    fixedWeight: true,
  },
  {
    id: 'abril',
    label: 'Abril Fatface',
    group: 'Display',
    family: 'Abril Fatface',
    stack: '"Abril Fatface", Georgia, serif',
    file: 'abril-fatface-latin-400-normal.woff2',
    weight: '400',
    fixedWeight: true,
  },
  {
    id: 'script',
    label: 'Caveat',
    group: 'Script',
    family: 'Caveat',
    stack: 'Caveat, "Comic Sans MS", cursive',
    file: 'caveat-latin-wght-normal.woff2',
    weight: '400 700',
  },
  {
    id: 'dancing',
    label: 'Dancing Script',
    group: 'Script',
    family: 'Dancing Script',
    stack: '"Dancing Script", Caveat, cursive',
    file: 'dancing-script-latin-wght-normal.woff2',
    weight: '400 700',
  },
  {
    id: 'pacifico',
    label: 'Pacifico',
    group: 'Script',
    family: 'Pacifico',
    stack: 'Pacifico, Caveat, cursive',
    file: 'pacifico-latin-400-normal.woff2',
    weight: '400',
    fixedWeight: true,
  },
] as const satisfies readonly FontDef[];

export type ICFont = (typeof IC_FONT_LIST)[number]['id'];

export const IC_FONT_STACKS = Object.fromEntries(
  IC_FONT_LIST.map((f) => [f.id, f.stack]),
) as Record<ICFont, string>;

export const IC_FONT_LABELS = Object.fromEntries(
  IC_FONT_LIST.map((f) => [f.id, f.label]),
) as Record<ICFont, string>;

const FIXED = new Set<string>(IC_FONT_LIST.filter((f) => 'fixedWeight' in f).map((f) => f.id));

export const isFixedWeight = (font: string): boolean => FIXED.has(font);

const MONO = new Set<string>(IC_FONT_LIST.filter((f) => f.group === 'Mono').map((f) => f.id));

export const isMonoFont = (font: string): boolean => MONO.has(font);

/** The exact family name a `font-family` attribute should carry, not the full fallback
 *  stack: `IC_FONT_STACKS` entries quote their own fallbacks (e.g. `"Helvetica Neue"`),
 *  which corrupts a double-quoted SVG attribute if embedded whole. */
export function fontFamily(font: ICFont): string {
  return IC_FONT_LIST.find((f) => f.id === font)?.family ?? font;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const fontFaceCache = new Map<ICFont, Promise<string | null>>();

/** A `@font-face` rule embedding one bundled face as base64, cached per font so repeated
 *  calls (typing, re-rendering) fetch it once. An SVG rasterized through `<img>` can't see
 *  the page's own loaded web fonts, so anything drawn that way needs the face inlined. */
export function fetchFontFace(id: ICFont): Promise<string | null> {
  let pending = fontFaceCache.get(id);
  if (!pending) {
    pending = (async () => {
      const def = IC_FONT_LIST.find((f) => f.id === id);
      if (!def) return null;
      try {
        const res = await fetch(`${BASE}/fonts/${def.file}`);
        if (!res.ok) return null;
        const bytes = new Uint8Array(await res.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return `@font-face{font-family:'${def.family}';src:url(data:font/woff2;base64,${btoa(binary)}) format('woff2');font-weight:${def.weight};}`;
      } catch {
        return null;
      }
    })();
    fontFaceCache.set(id, pending);
  }
  return pending;
}
