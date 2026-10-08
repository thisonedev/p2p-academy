import { type DragEvent } from 'react';
import { type ICCutout } from '../art/cutout.js';
import type { BrandKit } from '../brand/brand-kit.js';
import { type ICLayout, type ICRatio, type ICTemplate, type ICModel } from '../render/layout.js';

export type Selection = string | 'bg' | 'scene' | null;

/** The design actions the panels and toolbar can call. The studio implements them. */
/** A spot on the canvas in percent, where a dropped element is centered. */
export interface ICPoint {
  x: number;
  y: number;
}

/** What an Elements button carries while it is dragged onto the canvas. */
export type ICAddItem =
  | { kind: 'text' | 'pill' | 'rect' | 'ellipse' | 'line' | 'avatar' }
  | { kind: 'art' | 'block'; id: string }
  | { kind: 'button' };

export const IC_ADD_MIME = 'application/x-ic-add';

export const dragItem = (item: ICAddItem) => ({
  draggable: true,
  onDragStart: (e: DragEvent<HTMLElement>) => {
    e.dataTransfer.setData(IC_ADD_MIME, JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
    // Without this, the browser drags the whole tile (dark background, border):
    // fine for an <img> tile (art), which it drags as just the image, but a
    // shape's <span> preview has no such special case. Drag just that preview.
    const preview = e.currentTarget.querySelector('span, img');
    if (preview instanceof HTMLElement) {
      const rect = preview.getBoundingClientRect();
      e.dataTransfer.setDragImage(preview, rect.width / 2, rect.height / 2);
    }
  },
});

export interface StudioApi {
  layout: ICLayout;
  selId: Selection;
  sceneReady: boolean;
  /** On the Design page, with no workflow run to paint an AI background. */
  standalone: boolean;
  select: (id: Selection) => void;
  update: (fn: (layout: ICLayout) => ICLayout) => void;
  patch: (id: string, patch: Partial<Record<string, unknown>>) => void;
  addText: (kind: 'text' | 'pill', at?: ICPoint) => void;
  addShape: (kind?: 'rect' | 'ellipse', at?: ICPoint) => void;
  addLine: (at?: ICPoint) => void;
  addArt: (id: string, at?: ICPoint) => void;
  addBlock: (id: string, at?: ICPoint) => void;
  pickBrand: (brandId: string) => void;
  addAvatar: (at?: ICPoint) => void;
  resetTemplate: () => void;
  cropId: string | null;
  setCrop: (id: string | null) => void;
  setRatio: (ratio: ICRatio) => void;
  setCustomSize: (width: number, height: number) => void;
  pickImage: (target: 'add' | 'layer' | 'subject' | 'scene' | 'partner' | 'shot') => void;
  setPartnerColor: (color: string) => void;
  swapBrands: () => void;
  /** Puts the default partner logo and color back everywhere. */
  clearPartner: () => void;
  duplicate: () => void;
  remove: () => void;
  /** Locks the selection, or unlocks it when it is all locked. */
  toggleLock: () => void;
  /** Adds a button in a look, in the design's colors. */
  addButton: (at?: ICPoint) => void;
  /** The layers the selection actions work on. */
  selIds: string[];
  group: () => void;
  ungroup: () => void;
  move: (dir: 1 | -1) => void;
  moveEnd: (dir: 1 | -1) => void;
  chooseTemplate: (template: ICTemplate) => void;
  setPalette: (id: string | null) => void;
  applyBrandKit: (kit: BrandKit) => void;
  generateElement: (prompt: string, model: ICModel) => Promise<void>;
  regenerateElement: (id: string) => Promise<void>;
  /** 'new' while an element is being painted, or the id of the one regenerating. */
  genBusy: string | null;
  genError: string | null;
  genPrompt: string;
  setGenPrompt: (prompt: string) => void;
  genModel: ICModel;
  setGenModel: (model: ICModel) => void;
  stopElement: () => void;
  cutout: (id: string, opts: ICCutout | null) => Promise<void>;
  cutBusy: string | null;
  editId: string | null;
  setEdit: (id: string | null) => void;
  /** Ids picked by marquee, shift+click, or clicking a grouped element. Delete/move act on all of them. */
  multiSel: string[];
  /** Selects exactly these layers: one becomes the single selection, more a multi-selection. */
  selectMany: (ids: string[]) => void;
  /** Opens the right-click menu for the selection at a point on screen. */
  openMenu: (at: { x: number; y: number }) => void;
}
