import { catalogStorage } from '@academy/core';
import { type ICLayout, parseLayout, RATIO_LABELS, upgradeIds } from './design-layout.js';
import { canvasHeight, composeLayout } from './design-render.js';
import { ALL_TEMPLATES } from './design-templates.js';

export const DESIGNS_KIND = 'ic-designs';

/** Twice Home's card picture, so thumbnails stay sharp on retina screens. */
const THUMB_BOX = { width: 480, height: 270 };
/** The manifest preview cap is 64 KB; a thumbnail over this is dropped rather than failing the save. */
const MAX_THUMB_CHARS = 60_000;

export interface DesignPreview {
  thumb: string | null;
  /** Like 'IG Post' or '1200×628'; absent on designs saved before it existed. */
  size?: string;
  /** Drawn at THUMB_BOX. Older saves have a 176px thumbnail that blurs on Home. */
  hd?: true;
}

function sizeLabel({ ratio, customSize }: ICLayout): string | undefined {
  if (ratio === 'custom') return customSize && `${customSize.width}×${customSize.height}`;
  return ratio && (RATIO_LABELS[ratio] ?? ratio);
}

// A generated scene lives on the node, so the saved copy keeps it as an uploaded
// image and opens anywhere without regenerating it.
function selfContained(layout: ICLayout, sceneUrl: string | null): ICLayout {
  // Drafts of other templates are this session's work, not part of the saved design.
  const { saved: _saved, drafts: _drafts, ...rest } = layout;
  if (!layout.scene.on || layout.scene.upload || !sceneUrl) return rest;
  return { ...rest, scene: { on: true, upload: { name: 'scene', url: sceneUrl } } };
}

async function thumbnail(layout: ICLayout): Promise<string | null> {
  try {
    const tall = canvasHeight(layout, 1000) / 1000;
    const width = Math.round(Math.min(THUMB_BOX.width, THUMB_BOX.height / tall));
    for (const quality of [0.9, 0.8, 0.65]) {
      const url = await composeLayout(layout, null, { width, format: 'jpeg', quality });
      if (url.length <= MAX_THUMB_CHARS) return url;
    }
    return null;
  } catch {
    return null;
  }
}

/** Saves the design to the library and returns the entry it now belongs to. `asNew` forks a copy. */
export async function saveDesign(
  layout: ICLayout,
  sceneUrl: string | null,
  name: string,
  asNew: boolean,
): Promise<{ id: string; name: string }> {
  const id = (!asNew && layout.saved?.id) || crypto.randomUUID();
  const payload = selfContained(layout, sceneUrl);
  const preview: DesignPreview = { thumb: await thumbnail(payload), size: sizeLabel(layout), hd: true };
  await catalogStorage.save(DESIGNS_KIND, id, name, payload, preview);
  return { id, name };
}

export async function loadDesign(id: string, name: string): Promise<ICLayout> {
  const layout = parseLayout(JSON.stringify(await catalogStorage.get(DESIGNS_KIND, id)));
  if (!layout) throw new Error('This design could not be read.');
  const upgraded = upgradeIds(layout, (t) => ALL_TEMPLATES.find((x) => x.id === t));
  return { ...upgraded, saved: { id, name } };
}

export const designThumb = (preview: unknown): string | null => {
  const thumb = (preview as DesignPreview | null)?.thumb;
  return typeof thumb === 'string' && thumb.startsWith('data:image/') ? thumb : null;
};

export const designSize = (preview: unknown): string | null => {
  const size = (preview as DesignPreview | null)?.size;
  return typeof size === 'string' ? size : null;
};

/** A sharp thumbnail for a design saved before `hd`, drawn from the saved design itself. */
export async function redrawThumb(id: string, preview: unknown): Promise<string | null> {
  if ((preview as DesignPreview | null)?.hd) return null;
  const layout = parseLayout(JSON.stringify(await catalogStorage.get(DESIGNS_KIND, id)));
  return layout && thumbnail(layout);
}
