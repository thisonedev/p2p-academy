
import {
  useCallback,
  type DragEvent as ReactDragEvent,
} from 'react';
import {
  type ICLayout,
  type ICElement,
  ratioHeight,
  newElementId,
  pickPartner,
} from '../render/layout.js';
import { logoColor } from '../brand/logo-color.js';
import { type Selection, type ICPoint } from '../panels/studio-api.js';
import { readImage } from '../render/read-image.js';
import { setSlotDefault } from '../render/slots.js';
import {
  type PickTarget,
} from './studio-helpers.js';
import type { Dispatch, RefObject, SetStateAction } from 'react';

/** Pictures coming in from the file picker or a drop. */
export function useStudioFiles({
  pickRef,
  fileRef,
  setLayout,
  setSelId,
  selected,
  patch,
  layout,
  insert,
}: {
  pickRef: RefObject<PickTarget>;
  fileRef: RefObject<HTMLInputElement | null>;
  setLayout: (fn: (l: ICLayout) => ICLayout) => void;
  setSelId: Dispatch<SetStateAction<Selection>>;
  selected: ICElement | null;
  patch: (id: string, p: Partial<Record<string, unknown>>) => void;
  layout: ICLayout;
  insert: (el: ICElement, after?: string) => void;
}) {
  const pickImage = useCallback((target: PickTarget) => {
    pickRef.current = target;
    fileRef.current?.click();
  }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const picked = await readImage(file, 1600).catch(() => null);
    if (!picked) return;
    const target = pickRef.current;
    if (target === 'partner') {
      // The partner's side takes the logo's own color, so a new logo recolors half the design.
      const color = await logoColor(picked.url);
      setLayout((l) => {
        const withLogo = setSlotDefault(l, 'partner_logo', picked.url, picked.ratio);
        return color ? pickPartner(withLogo, color) : withLogo;
      });
      return;
    }
    if (target === 'scene') {
      setLayout((l) => ({
        ...l,
        scene: { on: true, upload: { name: picked.name, url: picked.url } },
      }));
      setSelId('scene');
    } else if (target === 'subject') {
      const fit = (w: number) => Math.min(w, 92, 70 * picked.ratio);
      setLayout((l) => ({
        ...l,
        subject: picked,
        els: l.els.map((e) => (e.t === 'subject' ? { ...e, w: fit(e.w), crop: undefined } : e)),
      }));
    } else if (target === 'shot' && selected?.t === 'art') {
      patch(selected.id, { shot: { url: picked.url, ratio: picked.ratio } });
    } else if (target === 'layer' && selected?.t === 'image') {
      patch(selected.id, {
        name: picked.name,
        url: picked.url,
        ratio: picked.ratio,
        crop: undefined,
        pos: undefined,
        original: undefined,
        cut: undefined,
      });
    } else {
      addPicture(picked);
    }
  };

  /** A picture as a new layer, centered on `at` (percent of the canvas) or on the canvas. */
  const addPicture = (picked: { name: string; url: string; ratio: number }, at?: ICPoint) => {
    const w = Math.min(40, 50 * picked.ratio);
    const H = ratioHeight(layout.ratio, layout.customSize) * 100;
    const h = ((w / picked.ratio) * 100) / H;
    insert({
      id: newElementId(),
      t: 'image',
      name: picked.name,
      url: picked.url,
      ratio: picked.ratio,
      w,
      x: (at?.x ?? 50) - w / 2,
      y: (at?.y ?? 50) - h / 2,
      vis: true,
      user: true,
    });
  };

  // Image files dragged in from the desktop become layers where they're dropped, each a little
  // further along when several come at once.
  const dropFiles = async (files: FileList, at?: ICPoint) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    for (const [i, file] of images.entries()) {
      const picked = await readImage(file, 1600).catch(() => null);
      if (!picked) continue;
      addPicture(picked, at ? { x: at.x + i * 4, y: at.y + i * 4 } : { x: 50 + i * 4, y: 50 + i * 4 });
    }
  };
  const hasFiles = (e: ReactDragEvent) => e.dataTransfer.types.includes('Files');

  return {
    pickImage,
    onFile,
    dropFiles,
    hasFiles,
  };
}
