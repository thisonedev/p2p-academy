import type { ButtonLook } from './image-constructor-buttons.js';
import type { ICFont } from './image-constructor-font-list.js';
import { contrast, type ICRole, type ICRoles, legible, mix } from './image-constructor-palettes.js';
import type { ICBackground } from './image-constructor-layout.js';

/** The four colors a person picks. Every design role is derived from these. */
export interface BrandColors {
  bg: string;
  surface: string;
  ink: string;
  accent: string;
}

/** How a brand draws its buttons, badges and cards. */
export interface BrandElements {
  corners: 'square' | 'rounded' | 'pill';
  buttons: ButtonLook;
}

/** The weights a brand sets its headings and body copy in. */
export interface BrandType {
  heading: number;
  body: number;
}

export const DEFAULT_BRAND_ELEMENTS: BrandElements = { corners: 'pill', buttons: 'solid' };
export const DEFAULT_BRAND_TYPE: BrandType = { heading: 700, body: 400 };

/** A saved brand: colors, a font pair and a logo, applied to any design in one click.
 *  Stored in the catalog under `brand-kits`; a design keeps a snapshot, so it renders the same if the kit changes. */
export interface BrandKit {
  v: 1;
  id: string;
  name: string;
  colors: BrandColors;
  roles: ICRoles;
  fonts: { heading: ICFont; body: ICFont };
  /** A PNG or JPEG data URL, at most LOGO_MAX_SIDE on its longer side. Built-in kits use SVG. */
  logo: string | null;
  /** The logo's width over height, so a design can place it without loading it first. */
  logoRatio: number;
  /** Brand colors beyond the four roles, offered wherever a color is picked. */
  extra?: string[];
  /** Two-stop gradients, offered for the background. */
  gradients?: [string, string][];
  /** Absent on kits saved before the style guide; designs then keep their own weights and shapes. */
  type?: BrandType;
  elements?: BrandElements;
}

export const BRAND_KITS_KIND = 'brand-kits';
export const LOGO_MAX_SIDE = 512;
export const LOGO_SLOT = 'logo';

export const DEFAULT_BRAND_COLORS: BrandColors = {
  bg: '#0f1115',
  surface: '#1a1d24',
  ink: '#f5f6f8',
  accent: '#6366f1',
};

/** Where a derived role came from, shown next to it on the review step. */
export type RoleNotes = Partial<Record<ICRole, string>>;

/** Maps the four picked colors onto the eight design roles, fixing text contrast where it falls short. */
export function rolesFrom(colors: BrandColors): { roles: ICRoles; notes: RoleNotes } {
  const { bg, surface, accent } = colors;
  const surfaces = [bg, surface];
  const notes: RoleNotes = {
    bg2: 'Background blended toward the accent',
    muted: 'Text faded toward the background',
    onAccent: 'Black or white, whichever reads better on the accent',
  };
  const ink = legible(colors.ink, surfaces, 4.5);
  if (ink.toLowerCase() !== colors.ink.toLowerCase()) notes.ink = 'Adjusted from your pick for readable contrast';
  const onAccent = contrast('#ffffff', accent) >= contrast('#111111', accent) ? '#ffffff' : '#111111';
  const roles: ICRoles = {
    bg,
    bg2: mix(bg, accent, 0.18),
    panel: surface,
    card: surface,
    ink,
    muted: legible(mix(ink, bg, 0.3), surfaces, 4),
    accent,
    onAccent,
  };
  return { roles, notes };
}

export function makeBrandKit(
  id: string,
  name: string,
  colors: BrandColors,
  fonts: BrandKit['fonts'],
  logo: { url: string; ratio: number } | null,
  style: Pick<BrandKit, 'extra' | 'gradients' | 'type' | 'elements'> = {},
): BrandKit {
  return {
    v: 1,
    id,
    name,
    colors,
    roles: rolesFrom(colors).roles,
    fonts,
    logo: logo?.url ?? null,
    logoRatio: logo?.ratio ?? 1,
    ...style,
  };
}

export function parseBrandKit(value: unknown): BrandKit | null {
  const kit = value as Partial<BrandKit> | null;
  return kit?.v === 1 && typeof kit.id === 'string' && kit.colors && kit.roles && kit.fonts
    ? (kit as BrandKit)
    : null;
}

/** The four swatches a kit card shows, stored in the catalog manifest. */
export const brandKitPreview = (kit: BrandKit) => ({
  colors: [kit.colors.bg, kit.colors.surface, kit.colors.ink, kit.colors.accent],
});

/** A brand's background: its two background colors as a soft diagonal gradient, or one flat color
 *  when they're the same. Every template pack uses this, so a brand looks the same everywhere. */
export const brandBackground = (kit: BrandKit): ICBackground => {
  const { bg, bg2 } = kit.roles;
  return { mode: bg === bg2 ? 'solid' : 'gradient', color: bg, from: bg, to: bg2, angle: 160 };
};

