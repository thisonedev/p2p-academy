const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// Files live in apps/web/public/fonts with their SIL Open Font License text.
const FACES = [
  { family: 'Inter', file: 'inter-latin-wght-normal.woff2', weight: '100 900' },
  {
    family: 'Playfair Display',
    file: 'playfair-display-latin-wght-normal.woff2',
    weight: '400 900',
  },
  { family: 'Anton', file: 'anton-latin-400-normal.woff2', weight: '400' },
  { family: 'Space Grotesk', file: 'space-grotesk-latin-wght-normal.woff2', weight: '300 700' },
  { family: 'Caveat', file: 'caveat-latin-wght-normal.woff2', weight: '400 700' },
];

let pending: Promise<void> | null = null;

/** Loads the bundled faces once. A face that fails to load falls back to its system stack. */
export function loadFonts(): Promise<void> {
  if (!pending) {
    pending = Promise.all(
      FACES.map(async (f) => {
        try {
          const face = new FontFace(f.family, `url(${BASE}/fonts/${f.file})`, { weight: f.weight });
          document.fonts.add(await face.load());
        } catch {
          // The system stack in IC_FONT_STACKS covers a missing face.
        }
      }),
    ).then(() => undefined);
  }
  return pending;
}
