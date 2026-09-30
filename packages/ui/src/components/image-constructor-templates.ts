import { ANNOUNCE_PACK } from './image-constructor-announce.js';
import { withBrandCopy } from './image-constructor-brand-copy.js';
import { COBRAND_PACK } from './image-constructor-cobrand.js';
import { INFO_PACK } from './image-constructor-info.js';
import { PRODUCT_PACK } from './image-constructor-product.js';
import { THREAD_DESIGNS } from './image-constructor-thread-designs.js';
import { THREADS_PACK } from './image-constructor-threads.js';
import { UPDATES_TEMPLATES, withSpec } from './image-constructor-updates.js';
import { type ICLayout, type ICTemplate, SAMPLE_SUBJECT, withCards } from './image-constructor-layout.js';

/** An empty white canvas, in a category of its own at the top of the list. */
const BLANK: ICTemplate = {
  id: 'blank',
  title: 'Blank',
  pack: 'Blank',
  ratio: 'ig-post',
  scene: false,
  model: 'sd2.1',
  seed: 1,
  scenePrompt: '',
  thumb: 'linear-gradient(180deg,#f4f4f4,#ffffff)',
  bg: { mode: 'solid', color: '#ffffff', from: '#ffffff', to: '#ffffff', angle: 0 },
  source: null,
  els: [],
};

/** Every template, in the order the pack picker lists the packs, with Tether's and QVAC's own copy. */
export const ALL_TEMPLATES: ICTemplate[] = [
  BLANK,
  ...ANNOUNCE_PACK,
  ...UPDATES_TEMPLATES,
  ...COBRAND_PACK,
  ...INFO_PACK,
  ...PRODUCT_PACK,
  ...THREAD_DESIGNS,
  ...THREADS_PACK,
].map((t) => withCards(withBrandCopy(t)));

export const TEMPLATE_PACKS = [...new Set(ALL_TEMPLATES.map((t) => t.pack))];

/** The same layout in another brand, within the same pack, for switching brand without losing it. */
export const siblingTemplate = (t: ICTemplate, brand: string): ICTemplate | undefined => {
  const sibling = ALL_TEMPLATES.find((x) => x.pack === t.pack && x.family === t.family && x.brand === brand);
  // A list template keeps its items in the other brand too.
  return sibling && t.list ? withSpec(sibling, t.list.spec) : sibling;
};

/** A template by id, built with the item setup after its `~` if it has one. Designs made from a
 *  template that no longer exists open on Blank. */
export function findTemplate(id: string): ICTemplate {
  const [base, spec] = id.split('~');
  const t = ALL_TEMPLATES.find((x) => x.id === base) ?? BLANK;
  return spec && t.list ? withSpec(t, spec) : t;
}

/** A new design starts empty, on the Blank template. */
export function defaultLayout(): ICLayout {
  return {
    v: 1,
    partnerV: 1,
    idsV: 3,
    templateId: BLANK.id,
    ratio: BLANK.ratio,
    prompt: '',
    model: BLANK.model,
    seed: BLANK.seed,
    scene: { on: false, upload: null },
    bg: structuredClone(BLANK.bg),
    subject: SAMPLE_SUBJECT,
    els: [],
  };
}
