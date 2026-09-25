import type { AcademyAPI } from '@academy/validation';
import { DEFAULT_CUTOUT, removeBackground } from './image-constructor-cutout.js';
import { type ICModel, sceneSize } from './image-constructor-layout.js';

// Asks for a lone object on a flat backdrop, which the edge-color cutout then clears.
const ISOLATED = ', a single isolated object centered on a plain pure white background, whole object in frame, no shadow, no text';

const bridge = () =>
  typeof window === 'undefined' ? undefined : (window as unknown as { academy?: AcademyAPI }).academy;

/** Generating needs the desktop app's local image models. */
export const canGenerateElements = (): boolean => typeof bridge()?.generateImage === 'function';

export const randomSeed = (): number => Math.floor(Math.random() * 2_147_483_647);

/** Stops the element being painted; its generateElement call then rejects. */
export async function stopGenerating(): Promise<void> {
  await bridge()?.cancelGenerateImage?.().catch(() => undefined);
}

/** Paints the object, then cuts its backdrop away. `original` keeps the uncut image for re-cutting. */
export async function generateElement(
  prompt: string,
  model: ICModel,
  seed: number,
): Promise<{ original: string; url: string; ratio: number }> {
  const generate = bridge()?.generateImage;
  if (!generate) throw new Error('AI elements need the desktop app.');
  const { width, height } = sceneSize(model, '1:1');
  const original = await generate(`${prompt.trim()}${ISOLATED}`, model, { width, height, seed });
  const url = await removeBackground(original, DEFAULT_CUTOUT);
  return { original, url, ratio: width / height };
}
