import { catalogStorage } from '@academy/core';
import { type ICLayout, parseLayout } from './image-constructor-layout.js';
import { composeLayout } from './image-constructor-render.js';

export const DESIGNS_KIND = 'ic-designs';

const THUMB_WIDTH = 176;
/** The manifest preview cap is 16 KB; a thumbnail over this is dropped rather than failing the save. */
const MAX_THUMB_CHARS = 14_000;

export interface DesignPreview {
  thumb: string | null;
}

// A generated scene lives on the node, so the saved copy keeps it as an uploaded
// image and opens anywhere without regenerating it.
function selfContained(layout: ICLayout, sceneUrl: string | null): ICLayout {
  const { saved: _saved, ...rest } = layout;
  if (!layout.scene.on || layout.scene.upload || !sceneUrl) return rest;
  return { ...rest, scene: { on: true, upload: { name: 'scene', url: sceneUrl } } };
}

async function thumbnail(layout: ICLayout): Promise<string | null> {
  try {
    const url = await composeLayout(layout, null, { width: THUMB_WIDTH, format: 'jpeg', quality: 0.6 });
    return url.length <= MAX_THUMB_CHARS ? url : null;
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
  const preview: DesignPreview = { thumb: await thumbnail(payload) };
  await catalogStorage.save(DESIGNS_KIND, id, name, payload, preview);
  return { id, name };
}

export async function loadDesign(id: string, name: string): Promise<ICLayout> {
  const layout = parseLayout(JSON.stringify(await catalogStorage.get(DESIGNS_KIND, id)));
  if (!layout) throw new Error('This design could not be read.');
  return { ...layout, saved: { id, name } };
}

export const designThumb = (preview: unknown): string | null => {
  const thumb = (preview as DesignPreview | null)?.thumb;
  return typeof thumb === 'string' && thumb.startsWith('data:image/') ? thumb : null;
};
