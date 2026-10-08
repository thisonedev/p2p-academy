
import {
  useCallback,
  useState,
  useRef,
} from 'react';
import { stopGenerating, randomSeed, generateElement } from '../art/ai-element.js';
import { ANNOUNCE_BRANDS, brandOfKit } from '../templates/announce.js';
import type { BrandKit } from '../brand/brand-kit.js';
import { DEFAULT_CUTOUT } from '../art/cutout.js';
import {
  type ICLayout,
  type ICElement,
  newElementId,
  applyBrandKit,
  openTemplate,
  layoutFromTemplate,
  defaultRatio,
  type ICModel,
  applyPalette,
  resetPalette,
  type ICRatio,
  resizeLayout,
} from '../render/layout.js';
import { findTemplate, siblingTemplate } from '../templates/templates.js';
import { threadInBrand } from '../templates/thread.js';

/** The design's brand, kit, palette and size, and making or remaking a layer with the image model. */
export function useBrandAndGenerate({
  setLayout,
  insert,
  layout,
  patch,
}: {
  setLayout: (fn: (l: ICLayout) => ICLayout) => void;
  insert: (el: ICElement, after?: string) => void;
  layout: ICLayout;
  patch: (id: string, p: Partial<Record<string, unknown>>) => void;
}) {
  const pickBrand = useCallback(
    (brandId: string) => {
      const brand = ANNOUNCE_BRANDS.find((b) => b.id === brandId);
      if (!brand) return;
      setLayout((l) => {
        if (l.thread) return threadInBrand(l, brandId) ?? applyBrandKit(l, brand.kit);
        const t = findTemplate(l.templateId);
        // Its own brand needs no other version of the template: the kit alone clears a palette.
        const sibling =
          l.templateId !== 'blank' && t.brand && t.brand !== brandId
            ? siblingTemplate(t, brandId)
            : undefined;
        if (!sibling) return applyBrandKit(l, brand.kit);
        // A different brand brings its own logo, name and address; the partner stays.
        return openTemplate(
          l,
          t,
          sibling,
          (cur) =>
            layoutFromTemplate(
              sibling,
              { ...cur, kit: t.kit, palette: undefined },
              t,
              cur.ratio ?? defaultRatio(sibling),
            ),
          false,
        );
      });
    },
    [setLayout],
  );

  const applyKit = useCallback(
    (kit: BrandKit) => {
      const brand = brandOfKit(kit.id);
      if (brand) pickBrand(brand);
      else setLayout((l) => applyBrandKit(l, kit));
    },
    [pickBrand, setLayout],
  );

  // 'new' while a fresh element paints, a layer id while that one regenerates.
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  // Kept here, not in the Elements tab, so switching tabs mid-generation keeps what was typed.
  const [genPrompt, setGenPrompt] = useState('');
  const [genModel, setGenModel] = useState<ICModel>('flux2-klein');
  // A stop is the user's own choice, so the rejection it causes is not shown as an error.
  const genStoppedRef = useRef(false);
  const stopElement = useCallback(() => {
    genStoppedRef.current = true;
    void stopGenerating();
  }, []);
  const failed = useCallback((err: unknown) => {
    if (!genStoppedRef.current) setGenError(err instanceof Error ? err.message : String(err));
  }, []);

  const generateNewElement = useCallback(
    async (prompt: string, model: ICModel) => {
      setGenBusy('new');
      setGenError(null);
      genStoppedRef.current = false;
      try {
        const seed = randomSeed();
        const made = await generateElement(prompt, model, seed);
        const w = 40;
        insert({
          id: newElementId(),
          t: 'image',
          name: prompt.trim().slice(0, 40) || 'AI element',
          url: made.url,
          original: made.original,
          cut: DEFAULT_CUTOUT,
          ratio: made.ratio,
          w,
          x: (100 - w) / 2,
          y: (100 - w / made.ratio) / 2,
          vis: true,
          user: true,
          gen: { prompt: prompt.trim(), model, seed },
        });
      } catch (err) {
        failed(err);
      } finally {
        setGenBusy(null);
      }
    },
    [insert, failed],
  );

  const regenerateElement = useCallback(
    async (id: string) => {
      const el = layout.els.find((e) => e.id === id);
      if (el?.t !== 'image' || !el.gen) return;
      setGenBusy(id);
      setGenError(null);
      genStoppedRef.current = false;
      try {
        const seed = randomSeed();
        const made = await generateElement(el.gen.prompt, el.gen.model, seed);
        patch(id, {
          url: made.url,
          original: made.original,
          cut: DEFAULT_CUTOUT,
          crop: undefined,
          pos: undefined,
          gen: { ...el.gen, seed },
        });
      } catch (err) {
        failed(err);
      } finally {
        setGenBusy(null);
      }
    },
    [layout.els, patch, failed],
  );

  const setPalette = useCallback(
    (id: string | null) => {
      setLayout((l) => (id ? applyPalette(l, id) : resetPalette(l, findTemplate(l.templateId))));
    },
    [setLayout],
  );

  const setRatio = useCallback(
    (ratio: ICRatio) => setLayout((l) => resizeLayout(l, findTemplate(l.templateId), ratio)),
    [setLayout],
  );

  // A typed size lays the design out like the closest named size, and keeps its own tweaks too.
  const setCustomSize = useCallback(
    (width: number, height: number) =>
      setLayout((l) => resizeLayout(l, findTemplate(l.templateId), 'custom', { width, height })),
    [setLayout],
  );

  return {
    pickBrand,
    applyKit,
    genBusy,
    genError,
    genPrompt,
    setGenPrompt,
    genModel,
    setGenModel,
    stopElement,
    generateNewElement,
    regenerateElement,
    setPalette,
    setRatio,
    setCustomSize,
  };
}
