'use client';

import {
  Loader2,
  Layers,
  LayoutTemplate,
  Redo2,
  RotateCcw,
  RotateCw,
  Shapes,
  Undo2,
  UserRound,
  X,
} from 'lucide-react';
import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { artDef, artDefaults, artFit, artPalette } from './image-constructor-art.js';
import { ANNOUNCE_BRANDS, brandOfKit, layerBuilder } from './image-constructor-announce.js';
import { frameFor, isFrameArt, PHONE_SCREEN } from './image-constructor-art-web3.js';
import { blockStyle, findBlock } from './image-constructor-blocks.js';
import { logoColor } from './image-constructor-logo-color.js';
import { ExportSheet, type ICExportSettings } from './image-constructor-previews.js';
import { setSlotDefault } from './image-constructor-slots.js';
import {
  AVATAR_FULL_CROP,
  AVATAR_PFP_CROP,
  avatarCropPng,
  avatarCropSvg,
  randomAvatarConfig,
} from './image-constructor-avatar.js';
import { DEFAULT_CUTOUT, type ICCutout, removeBackground } from './image-constructor-cutout.js';
import { loadFonts } from './image-constructor-fonts.js';
import { useHistory } from './image-constructor-history.js';
import {
  type ICModel,
  applyPalette,
  defaultRatio,
  FIGURE_MIN,
  FULL_CROP,
  figureBackdrop,
  IC_OUTPUT_SIZE,
  type ICAvatarEl,
  type ICCrop,
  type ICElement,
  type ICLayout,
  type ICRatio,
  type ICTemplate,
  isCroppable,
  layoutFromTemplate,
  newElementId,
  applyBrandKit,
  orientationOf,
  layoutRoles,
  designRoles,
  fitPatterns,
  openTemplate,
  resizeLayout,
  swapSides,
  parseLayout,
  parseSceneCache,
  ratioHeight,
  resetPalette,
  resetPartner,
  pickPartner,
  cleanSession,
  upgradeIds,
  sceneKey,
} from './image-constructor-layout.js';
import {
  AvatarEditor,
  BrandBar,
  EditDrawer,
  ElementsPanel,
  IC_ADD_MIME,
  type ICAddItem,
  type ICPoint,
  MiniBar,
  type Selection,
  type StudioApi,
  TemplatesPanel,
  Toolbar,
} from './image-constructor-panels.js';
import { SCREENSHOT } from './image-constructor-device.js';
import { pngToPdf } from './image-constructor-pdf.js';
import { readImage } from './image-constructor-read-image.js';
import { generateElement, randomSeed, stopGenerating } from './image-constructor-ai-element.js';
import { SaveDesignButton } from './image-constructor-save-design.js';
import { saveDesign } from './image-constructor-designs.js';
import type { BrandKit } from './image-constructor-brand-kit.js';
import {
  drawLayout,
  type ICBox,
  type ICImages,
  layerBox,
  loadImages,
} from './image-constructor-render.js';
import {
  ALL_HANDLES,
  CORNERS,
  HANDLE_AT,
  handleSign,
  type ICHandle,
  type ICRect,
  resizeRect,
  SIDES,
  toLocal,
} from './image-constructor-resize.js';
import {
  ALL_TEMPLATES,
  defaultLayout,
  findTemplate,
  siblingTemplate,
} from './image-constructor-templates.js';
import { addPage, goToPage, movePage, removePage, startThread, threadInBrand } from './image-constructor-thread.js';
import { PageStrip } from './image-constructor-pages.js';

// The canvas is drawn at a fixed size and scaled by CSS, so dragging works in percentages.
const DRAW = 1080;

type PickTarget = 'add' | 'layer' | 'subject' | 'scene' | 'partner';

interface DragState {
  id: string;
  mode: 'move' | 'resize' | 'crop' | 'pan' | 'rotate';
  handle?: ICHandle;
  /** The element's box in canvas pixels when the drag began. */
  box: ICRect;
  sx: number;
  sy: number;
  orig: ICElement;
  /** Other selected elements moving together with `id`, their starting x/y in percent. */
  group?: { id: string; x: number; y: number }[];
  /** Rotating: the layer's center on screen and the pointer's angle around it when the drag began. */
  turn?: { cx: number; cy: number; from: number };
}

/** A drag angle as a layer's rotation: within ±180, pulled onto a straight angle when close to one,
 *  and onto 15° steps with Shift held. */
function snapAngle(deg: number, fine: boolean): number {
  let a = ((((deg + 180) % 360) + 360) % 360) - 180;
  if (fine) a = Math.round(a / 15) * 15;
  else {
    const right = Math.round(a / 90) * 90;
    if (Math.abs(a - right) < 4) a = right;
  }
  const r = Math.round(a * 10) / 10;
  return r === -180 ? 180 : r || 0;
}

/** Every element sharing `id`'s group, or just `id` alone if it isn't grouped. */
const groupMembers = (els: ICElement[], id: string): string[] => {
  const groupId = els.find((e) => e.id === id)?.groupId;
  return groupId ? els.filter((e) => e.groupId === groupId).map((e) => e.id) : [id];
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Photos, art and text scale as a whole. Shapes and cropped photos stretch on each side. */
const isLocked = (e: ICElement) =>
  e.t === 'subject' ||
  e.t === 'art' ||
  e.t === 'text' ||
  e.t === 'pill' ||
  (e.t === 'image' && e.h === undefined);

const handlesFor = (e: ICElement): ICHandle[] =>
  e.lock ? [] : e.t === 'line' ? SIDES : isLocked(e) ? CORNERS : ALL_HANDLES;
const signature = (url: string | undefined) => {
  if (!url) return '';
  // Recolored SVGs keep their length, so small ones are hashed whole. Photos use length and tail.
  if (!url.startsWith('data:image/svg')) return `${url.length}:${url.slice(-24)}`;
  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = (hash * 31 + url.charCodeAt(i)) | 0;
  return `${url.length}:${hash}`;
};

/** Reads a picked image as a data URL, shrinking very large photos so the saved design stays light. */
export interface ImageConstructorStudioProps {
  layoutRaw: string | undefined;
  sceneCacheRaw: string | undefined;
  onSave: (layout: string) => void;
  /** ⌘S: puts the current design on the node and saves the workflow, like ⌘S anywhere in the playground.
   *  Resolves true when it saved, so the studio confirms on its own Save button. */
  onSaveShortcut?: (layout: string) => Promise<boolean>;
  onClose?: () => void;
  /** The Design page: fills the page, has nothing to close back to, and saves every change as it happens. */
  standalone?: boolean;
}

export function ImageConstructorStudio({
  layoutRaw,
  sceneCacheRaw,
  onSave,
  onSaveShortcut,
  onClose,
  standalone = false,
}: ImageConstructorStudioProps) {
  const {
    value: layout,
    set: setLayout,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<ICLayout>(() => {
    const saved = parseLayout(layoutRaw);
    if (!saved) return defaultLayout();
    const upgraded = upgradeIds(saved, (id) => ALL_TEMPLATES.find((t) => t.id === id));
    return fitPatterns(cleanSession(upgraded, findTemplate(upgraded.templateId)));
  });
  const [selId, setSelId] = useState<Selection>(null);
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<ICBox | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [tab, setTab] = useState<'templates' | 'elements' | 'avatar'>('templates');
  const [images, setImages] = useState<ICImages>({ scene: null, subject: null, layers: new Map() });
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [side, setSide] = useState(480);
  const [fontsReady, setFontsReady] = useState(false);
  const [cutBusy, setCutBusy] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Every size and format is free, no export paywall.
  const [exportSettings, setExportSettings] = useState<ICExportSettings>({
    format: 'png',
    mult: 1,
    quality: 92,
    transparent: false,
  });
  const holderRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<PickTarget>('add');
  const dragRef = useRef<DragState | null>(null);
  const clipRef = useRef<ICElement | null>(null);
  const marqueeRef = useRef<{ sx: number; sy: number; dragging: boolean } | null>(null);
  const creatingAvatarRef = useRef(false);

  const cache = useMemo(() => parseSceneCache(sceneCacheRaw), [sceneCacheRaw]);
  const sceneUrl = cache && cache.key === sceneKey(layout) ? cache.url : null;
  const sceneReady = Boolean(sceneUrl || layout.scene.upload);
  const template = findTemplate(layout.templateId);
  const rh = ratioHeight(layout.ratio, layout.customSize);
  const DRAWH = DRAW * rh;

  const imageKey = [
    signature(layout.subject.url),
    signature(layout.scene.upload?.url),
    signature(sceneUrl ?? undefined),
    ...layout.els.map((e) => {
      if (e.t === 'image') return `${e.id}${signature(e.url)}`;
      if (e.t === 'art')
        return `${e.id}${e.art}${JSON.stringify(e.colors)}${e.data ? JSON.stringify(e.data) : ''}${e.code ? JSON.stringify(e.code) : ''}`;
      return e.t === 'avatar' ? `${e.id}${JSON.stringify(e.config)}` : '';
    }),
  ].join('|');
  // biome-ignore lint/correctness/useExhaustiveDependencies: imageKey stands in for the image URLs it summarizes
  useEffect(() => {
    let live = true;
    void loadImages(layout, sceneUrl).then((next) => live && setImages(next));
    return () => {
      live = false;
    };
  }, [imageKey]);

  useEffect(() => {
    void loadFonts().then(() => setFontsReady(true));
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fontsReady redraws once the bundled fonts load
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    // Until the scene is generated, the design's own background shows through.
    if (ctx) drawLayout(ctx, layout, images, DRAW);
  }, [layout, images, fontsReady]);

  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const measure = () =>
      setSide(Math.max(200, Math.min(el.clientWidth - 32, (el.clientHeight - 32) / rh, 720)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [rh]);

  // Crop mode and the edit drawer belong to one layer, so selecting anything else leaves them.
  useEffect(() => {
    if (cropId && selId !== cropId) setCropId(null);
  }, [cropId, selId]);
  useEffect(() => {
    if (editId && selId !== editId) setEditId(null);
  }, [editId, selId]);

  const update = useCallback((fn: (l: ICLayout) => ICLayout) => setLayout(fn), [setLayout]);
  const patch = useCallback(
    (id: string, p: Partial<Record<string, unknown>>) =>
      setLayout((l) => ({
        ...l,
        els: l.els.map((e) => (e.id === id ? ({ ...e, ...p } as ICElement) : e)),
      })),
    [setLayout],
  );

  const selected = layout.els.find((e) => e.id === selId) ?? null;
  // Avatar is a permanent rail tab now, same standing as Templates/Palettes/Elements;
  // still jumps to it on selecting one, but no longer forces its way back out.
  useEffect(() => {
    if (selected?.t === 'avatar') setTab('avatar');
  }, [selected?.t]);
  // The avatar the Export popover works on: the selected one, or, being on the Avatar
  // tab already implies "this avatar" without making the user click it too (user).
  const isAvatarEl = (e: ICElement): e is ICAvatarEl => e.t === 'avatar';
  const avatarEl =
    selected && isAvatarEl(selected)
      ? selected
      : tab === 'avatar'
        ? (layout.els.find(isAvatarEl) ?? null)
        : null;
  const cropFound = cropId ? layout.els.find((e) => e.id === cropId) : undefined;
  const cropEl =
    cropFound?.t === 'subject' || (cropFound?.t === 'image' && cropFound.h === undefined)
      ? cropFound
      : undefined;

  const insert = useCallback(
    (el: ICElement, after?: string) => {
      setLayout((l) => {
        const at = after ? l.els.findIndex((e) => e.id === after) : -1;
        const els = l.els.slice();
        els.splice(at < 0 ? els.length : at + 1, 0, el);
        return { ...l, els };
      });
      setSelId(el.id);
    },
    [setLayout],
  );

  const copyOf = useCallback(
    (source: ICElement): ICElement => {
      const offset = {
        x: Math.min(source.x + 3, 92),
        y: Math.min(source.y + 3, 92),
        id: newElementId(),
        user: true,
      };
      if (source.t !== 'subject') return { ...structuredClone(source), ...offset };
      const { subject } = layout;
      return {
        t: 'image',
        name: subject.name,
        url: subject.url,
        ratio: subject.ratio,
        crop: source.crop,
        w: source.w,
        vis: true,
        ...offset,
      };
    },
    [layout],
  );

  // A dropped element is centered on the pointer instead of hanging from its corner.
  const centered = useCallback(
    (el: ICElement, at?: ICPoint): ICElement => {
      if (!at) return el;
      const box = layerBox(el, layout, DRAW);
      return {
        ...el,
        x: clamp(at.x - (box.w / DRAW) * 50, -10, 100),
        y: clamp(at.y - (box.h / DRAWH) * 50, -10, 100),
      };
    },
    [DRAWH, layout],
  );

  const addText = useCallback(
    (kind: 'text' | 'pill', at?: ICPoint) => {
      const base = {
        id: newElementId(),
        role: 'custom',
        x: 30,
        y: 44,
        vis: true,
        user: true,
        font: 'sans' as const,
        track: 0,
      };
      // Tagged with roles like template layers, so a palette or brand kit recolors them too.
      const roles = layoutRoles(layout);
      const ink = roles?.ink ?? layout.els.find((e) => e.t === 'text')?.color ?? '#111111';
      const el: ICElement =
        kind === 'text'
          ? {
              ...base,
              t: 'text',
              w: 40,
              text: 'New text',
              size: 6,
              weight: 700,
              color: ink,
              align: 'left',
              lh: 1.1,
              pal: { color: 'ink' },
            }
          : {
              ...base,
              t: 'pill',
              w: 28,
              h: 8,
              text: 'New badge',
              size: 3.4,
              weight: 700,
              color: roles?.onAccent ?? '#111111',
              fill: roles?.accent ?? '#34d399',
              stroke: '',
              pal: { color: 'onAccent', fill: 'accent' },
            };
      insert(centered(el, at));
    },
    [centered, insert, layout],
  );

  const addShape = useCallback(
    (kind: 'rect' | 'ellipse' = 'rect', at?: ICPoint) => {
      const el: ICElement = {
        id: newElementId(),
        t: 'shape',
        kind,
        x: 30,
        y: 40,
        w: 30,
        h: 18,
        fill: layoutRoles(layout)?.accent ?? '#6366f1',
        stroke: '',
        sw: 0.25,
        radius: 2,
        vis: true,
        user: true,
        pal: { fill: 'accent' },
      };
      insert(centered(el, at));
    },
    [centered, insert, layout],
  );

  const addLine = useCallback(
    (at?: ICPoint) => {
      const ink = layout.els.find((e) => e.t === 'text')?.color ?? '#111111';
      const el: ICElement = {
        id: newElementId(),
        t: 'line',
        x: 25,
        y: 50,
        w: 50,
        th: 0.3,
        color: ink,
        vis: true,
        user: true,
      };
      insert(centered(el, at));
    },
    [centered, insert, layout.els],
  );

  const cutout = useCallback(
    async (id: string, opts: ICCutout | null) => {
      const el = layout.els.find((e) => e.id === id);
      if (!el || (el.t !== 'subject' && el.t !== 'image')) return;
      const source = el.t === 'subject' ? layout.subject : el;
      const original = source.original ?? source.url;
      setCutBusy(id);
      try {
        const next = opts
          ? { url: await removeBackground(original, opts), original, cut: opts }
          : { url: original, original: undefined, cut: undefined };
        if (el.t === 'subject') setLayout((l) => ({ ...l, subject: { ...l.subject, ...next } }));
        else patch(id, next);
      } finally {
        setCutBusy(null);
      }
    },
    [layout, patch, setLayout],
  );

  const addArt = useCallback(
    (id: string, at?: ICPoint) => {
      const def = artDef(id);
      if (!def) return;
      if (isFrameArt(id)) {
        // A frame covers the canvas behind everything, locked, in the cut that matches its shape.
        const art = frameFor(id, orientationOf(layout.ratio ?? '1:1'));
        const roles = layoutRoles(layout);
        const frame: ICElement = {
          id: newElementId(),
          t: 'art',
          art,
          x: 0,
          y: 0,
          w: 100,
          colors: { ...artDefaults(def), ...(roles ? artPalette(def, roles) : {}) },
          lock: true,
          vis: true,
          user: true,
        };
        setLayout((l) => ({ ...l, els: [frame, ...l.els] }));
        setSelId(frame.id);
        return;
      }
      const character = def.kind === 'character';
      const roles = layoutRoles(layout);
      if (def.group === 'Backgrounds') {
        // A backdrop goes behind every layer, large, centered on the drop point or the canvas.
        const backdrop: ICElement = {
          id: newElementId(),
          t: 'art',
          art: id,
          x: (at?.x ?? 50) - 35,
          y: (at?.y ?? 50) - 35 / def.ratio / ratioHeight(layout.ratio, layout.customSize),
          w: 70,
          colors: { ...artDefaults(def), ...(roles ? artPalette(def, roles) : {}) },
          vis: true,
          user: true,
        };
        setLayout((l) => ({ ...l, els: [backdrop, ...l.els] }));
        setSelId(backdrop.id);
        return;
      }
      const screen = PHONE_SCREEN[id];
      if (screen) {
        // A device comes with a screenshot slot in its screen, on top so it takes clicks and drops,
        // grouped with the frame so they move together.
        const H = ratioHeight(layout.ratio, layout.customSize) * 100;
        const w = def.ratio < 0.6 ? 24 : 36;
        const k = w / screen.vw;
        const x = (at?.x ?? 50) - w / 2;
        const y = (at?.y ?? 50) - ((w / def.ratio / H) * 100) / 2;
        const groupId = newElementId();
        const shot: ICElement = {
          id: newElementId(),
          t: 'image',
          name: 'screenshot',
          slot: 'screenshot',
          url: SCREENSHOT,
          ratio: 390 / 866,
          x: x + screen.x * k,
          y: y + ((screen.y * k) / H) * 100,
          w: screen.w * k,
          h: ((screen.h * k) / H) * 100,
          radius: screen.r * k,
          fit: 'top',
          vis: true,
          user: true,
          groupId,
        };
        const frame: ICElement = {
          id: newElementId(),
          t: 'art',
          art: id,
          x,
          y,
          w,
          colors: { ...artDefaults(def), ...(roles ? artPalette(def, roles) : {}) },
          vis: true,
          user: true,
          groupId,
        };
        setLayout((l) => ({ ...l, els: [...l.els, frame, shot] }));
        setSelId(shot.id);
        return;
      }
      const el: ICElement = {
        id: newElementId(),
        t: 'art',
        art: id,
        x: character ? 42 : 20,
        y: character ? 20 : 40,
        w: character ? 18 : 24,
        colors: artFit(
          def,
          { ...artDefaults(def), ...(roles ? artPalette(def, roles) : {}) },
          figureBackdrop(layout),
          FIGURE_MIN,
        ),
        vis: true,
        user: true,
      };
      insert(centered(el, at));
    },
    [centered, insert, layout],
  );

  const setPartnerColor = useCallback(
    (color: string) => setLayout((l) => pickPartner(l, color)),
    [setLayout],
  );

  const swapBrands = useCallback(() => setLayout((l) => swapSides(l)), [setLayout]);

  const clearPartner = useCallback(
    () => setLayout((l) => resetPartner(l, findTemplate(l.templateId))),
    [setLayout],
  );

  const addBlock = useCallback(
    (id: string, at?: ICPoint) => {
      const block = findBlock(id);
      if (!block) return;
      const H = ratioHeight(layout.ratio, layout.customSize) * 100;
      const built = block.build(layerBuilder(H, designRoles(layout)), blockStyle(layout.kit));
      // Centered where it was dropped, or on the canvas when clicked.
      const dx = (at?.x ?? 50) - built.w / 2;
      const dy = (at?.y ?? 50) - (built.h / 2 / H) * 100;
      const groupId = newElementId();
      // Slot names stay with the template, so a block's words never share a workflow value by accident.
      const els = built.els.map(
        (e): ICElement => ({
          ...e,
          id: newElementId(),
          x: e.x + dx,
          y: e.y + dy,
          slot: undefined,
          groupId,
          user: true,
        }),
      );
      setLayout((l) => ({ ...l, els: [...l.els, ...els] }));
      setSelId(els[0].id);
    },
    [layout, setLayout],
  );

  // One avatar per canvas, added only on an explicit click (the empty state's own
  // "Add avatar" button, or dropping an avatar tile): it adds into whatever template
  // is already on the canvas rather than replacing it, same as any other element
  // (user: "we have to actually click ourselves" to add one into any template).
  // `layout` here is a snapshot from the last render, not the latest queued state
  // (setLayout's updater only runs later, when React gets to it), so a second call
  // landing before that render still reads "no avatar yet" too. `creatingAvatarRef`
  // closes that window synchronously; the effect below clears it once the insert
  // this ref is guarding for has actually landed in `layout.els`.
  const addAvatar = useCallback(
    (at?: ICPoint) => {
      const existing = layout.els.find((e) => e.t === 'avatar');
      if (existing) {
        setSelId(existing.id);
        return;
      }
      if (creatingAvatarRef.current) return;
      creatingAvatarRef.current = true;
      const el: ICElement = {
        id: newElementId(),
        t: 'avatar',
        x: 37,
        y: 15,
        w: 26,
        config: randomAvatarConfig('both'),
        vis: true,
        user: true,
      };
      insert(centered(el, at));
    },
    [centered, insert, layout],
  );
  useEffect(() => {
    if (layout.els.some((e) => e.t === 'avatar')) creatingAvatarRef.current = false;
  }, [layout.els]);

  // A brand is one choice everywhere: its own version of the current template when there is one,
  // otherwise its kit on the design. Picking it drops whatever kit was applied on top before.
  const pickBrand = useCallback(
    (brandId: string) => {
      const brand = ANNOUNCE_BRANDS.find((b) => b.id === brandId);
      if (!brand) return;
      setLayout((l) => {
        if (l.thread) return threadInBrand(l, brandId) ?? applyBrandKit(l, brand.kit);
        const t = findTemplate(l.templateId);
        const sibling =
          l.templateId !== 'blank' && t.brand ? siblingTemplate(t, brandId) : undefined;
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

  const duplicate = useCallback(() => {
    if (selected) insert(copyOf(selected), selected.id);
  }, [copyOf, insert, selected]);

  const remove = useCallback(() => {
    if (!selected) return;
    setLayout((l) => ({ ...l, els: l.els.filter((e) => e.id !== selected.id) }));
    setSelId(null);
  }, [selected, setLayout]);

  const group = useCallback(() => {
    if (multiSel.length < 2) return;
    const groupId = newElementId();
    setLayout((l) => ({
      ...l,
      els: l.els.map((e) => (multiSel.includes(e.id) ? { ...e, groupId } : e)),
    }));
  }, [multiSel, setLayout]);

  const ungroup = useCallback(() => {
    if (multiSel.length === 0) return;
    setLayout((l) => ({
      ...l,
      els: l.els.map((e) => (multiSel.includes(e.id) ? { ...e, groupId: undefined } : e)),
    }));
  }, [multiSel, setLayout]);

  const move = useCallback(
    (dir: 1 | -1) => {
      setLayout((l) => {
        const i = l.els.findIndex((e) => e.id === selId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= l.els.length) return l;
        const els = l.els.slice();
        [els[i], els[j]] = [els[j], els[i]];
        return { ...l, els };
      });
    },
    [selId, setLayout],
  );

  const moveEnd = useCallback(
    (dir: 1 | -1) => {
      setLayout((l) => {
        const i = l.els.findIndex((e) => e.id === selId);
        if (i < 0) return l;
        const els = l.els.slice();
        const [item] = els.splice(i, 1);
        els.splice(dir === 1 ? els.length : 0, 0, item);
        return { ...l, els };
      });
    },
    [selId, setLayout],
  );

  // Reset starts this template over; the drafts kept for other templates stay.
  const resetTemplate = useCallback(() => {
    setLayout((l) => {
      // A thread starts over as a whole, on the page that was open.
      const template = findTemplate(l.thread?.root ?? l.templateId);
      const fresh = layoutFromTemplate(
        template,
        undefined,
        undefined,
        l.ratio ?? defaultRatio(template),
      );
      const reset = { ...startThread(fresh, template), drafts: l.drafts, saved: l.saved };
      return l.thread ? goToPage(reset, l.thread.at) : reset;
    });
    setSelId(null);
  }, [setLayout]);

  const chooseTemplate = useCallback(
    (t: ICTemplate) => {
      setLayout((l) =>
        openTemplate(l, findTemplate(l.templateId), t, (cur) =>
          startThread(
            layoutFromTemplate(t, cur, findTemplate(cur.templateId), cur.ratio ?? defaultRatio(t)),
            t,
          ),
        ),
      );
      setSelId(null);
    },
    [setLayout],
  );

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
    } else if (target === 'layer' && selected?.t === 'image') {
      patch(selected.id, {
        name: picked.name,
        url: picked.url,
        ratio: picked.ratio,
        crop: undefined,
        original: undefined,
        cut: undefined,
      });
    } else {
      const w = Math.min(40, 50 * picked.ratio);
      insert({
        id: newElementId(),
        t: 'image',
        name: picked.name,
        url: picked.url,
        ratio: picked.ratio,
        w,
        x: (100 - w) / 2,
        y: (100 - w / picked.ratio) / 2,
        vis: true,
        user: true,
      });
    }
  };

  const api: StudioApi = {
    layout,
    selId,
    sceneReady,
    standalone,
    select: (id) => {
      setMultiSel([]);
      setSelId(id);
    },
    update,
    patch,
    addText,
    addShape,
    addLine,
    setRatio,
    setCustomSize,
    setPalette,
    applyBrandKit: applyKit,
    generateElement: generateNewElement,
    regenerateElement,
    genBusy,
    genError,
    genPrompt,
    setGenPrompt,
    genModel,
    setGenModel,
    stopElement,
    addArt,
    addBlock,
    pickBrand,
    setPartnerColor,
    swapBrands,
    clearPartner,
    addAvatar,
    cutout,
    cutBusy,
    pickImage,
    duplicate,
    remove,
    group,
    ungroup,
    move,
    moveEnd,
    chooseTemplate,
    resetTemplate,
    cropId,
    setCrop: setCropId,
    editId,
    setEdit: setEditId,
    multiSel,
  };

  const finish = useCallback(() => {
    // Closing mid-generation would drop the result anyway, so it stops the model too.
    if (genBusy) stopElement();
    try {
      onSave(JSON.stringify(layout));
    } finally {
      onClose?.();
    }
  }, [layout, onClose, onSave, genBusy, stopElement]);

  useEffect(() => {
    if (!standalone) return;
    const timer = setTimeout(() => onSave(JSON.stringify(layout)), 400);
    return () => clearTimeout(timer);
  }, [standalone, layout, onSave]);

  // Read through a ref, so the key handler below always saves the design as it is right now.
  const [savedTick, setSavedTick] = useState(0);
  const saveShortcutRef = useRef<() => void>(() => undefined);
  saveShortcutRef.current = () => {
    const raw = JSON.stringify(layout);
    // A design opened from or saved to the library keeps that copy current too.
    const designSaved = layout.saved
      ? saveDesign(layout, sceneUrl, layout.saved.name, false).then(
          () => true,
          () => false,
        )
      : Promise.resolve(true);
    void Promise.all([onSaveShortcut?.(raw) ?? Promise.resolve(true), designSaved]).then(
      ([workflow, design]) => {
        if (workflow && design) setSavedTick((t) => t + 1);
      },
    );
  };

  // Registered in the capture phase so Delete and the arrow keys never reach the workflow canvas behind the studio.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘S is handled even while typing, and never reaches the playground's own save with a stale design.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        saveShortcutRef.current();
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (key === 'escape') {
        if (cropId) setCropId(null);
        else if (editId) setEditId(null);
        else if (previewOpen) setPreviewOpen(false);
        else if (multiSel.length > 0) setMultiSel([]);
        else finish();
      } else if (key === 'enter' && cropId) setCropId(null);
      else if (mod && key === 'z') {
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && key === 'y') redo();
      else if (mod && key === 'c' && selected) clipRef.current = structuredClone(selected);
      else if (mod && key === 'v' && clipRef.current) {
        const pasted = copyOf(clipRef.current);
        clipRef.current = pasted;
        insert(pasted);
      } else if (mod && key === 'd') duplicate();
      else if (mod && key === 'g') {
        if (e.shiftKey) ungroup();
        else group();
      } else if (key === 'delete' || key === 'backspace') {
        if (multiSel.length > 0) {
          setLayout((l) => ({ ...l, els: l.els.filter((e) => !multiSel.includes(e.id)) }));
          setMultiSel([]);
        } else remove();
      } else if (key.startsWith('arrow') && (multiSel.length > 0 || (selected && !selected.lock))) {
        const step = e.shiftKey ? 2 : 0.5;
        const dx = key === 'arrowright' ? step : key === 'arrowleft' ? -step : 0;
        const dy = key === 'arrowdown' ? step : key === 'arrowup' ? -step : 0;
        if (multiSel.length > 0) {
          for (const id of multiSel) {
            const el = layout.els.find((e2) => e2.id === id);
            if (el && !el.lock) patch(id, { x: el.x + dx, y: el.y + dy });
          }
        } else if (selected) patch(selected.id, { x: selected.x + dx, y: selected.y + dy });
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [
    copyOf,
    cropId,
    duplicate,
    editId,
    previewOpen,
    finish,
    group,
    insert,
    layout,
    multiSel,
    patch,
    redo,
    remove,
    selected,
    setLayout,
    ungroup,
    undo,
  ]);

  const pointerDown = (
    e: ReactPointerEvent,
    el: ICElement,
    mode: DragState['mode'],
    handle?: ICHandle,
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Shift+click toggles one element into or out of the ad-hoc selection, without starting a
    // drag. A prior single selection (held in selId, not multiSel) becomes the starting set.
    if (mode === 'move' && e.shiftKey) {
      const base =
        multiSel.length > 0
          ? multiSel
          : selId && selId !== 'bg' && selId !== 'scene'
            ? [selId]
            : [];
      setSelId(null);
      setMultiSel(base.includes(el.id) ? base.filter((id) => id !== el.id) : [...base, el.id]);
      return;
    }
    // Clicking a grouped element, or one already part of the current multi-selection, keeps
    // the whole set selected so a move drag moves all of them together.
    const together =
      mode === 'move' && multiSel.includes(el.id) && multiSel.length > 1
        ? multiSel
        : groupMembers(layout.els, el.id);
    if (mode === 'move' && together.length > 1) {
      setSelId(null);
      setMultiSel(together);
    } else {
      setMultiSel([]);
      setSelId(el.id);
    }
    if (el.lock) return;
    const box = layerBox(el, layout, DRAW);
    const rect = stageRef.current?.getBoundingClientRect();
    const turn =
      mode === 'rotate' && rect
        ? (() => {
            const cx = rect.left + ((box.x + box.w / 2) / DRAW) * rect.width;
            const cy = rect.top + ((box.y + box.h / 2) / DRAWH) * rect.height;
            return { cx, cy, from: Math.atan2(e.clientY - cy, e.clientX - cx) };
          })()
        : undefined;
    dragRef.current = {
      id: el.id,
      mode,
      handle,
      box,
      turn,
      sx: e.clientX,
      sy: e.clientY,
      orig: el,
      group:
        mode === 'move' && together.length > 1
          ? together.map((id) => {
              const found = layout.els.find((e2) => e2.id === id);
              return { id, x: found?.x ?? 0, y: found?.y ?? 0 };
            })
          : undefined,
    };
  };

  // Alt+click steps to the layer under the one on top, using real hit-testing so rotation and
  // z-order both match what is on screen. Repeated alt+clicks cycle through the whole stack.
  const selectBehind = (clientX: number, clientY: number) => {
    const stack = document
      .elementsFromPoint(clientX, clientY)
      .filter((n): n is HTMLElement => n instanceof HTMLElement && n.dataset.layerId !== undefined)
      .map((n) => n.dataset.layerId as string);
    if (stack.length < 2) return;
    const at = stack.indexOf(selId ?? '');
    setSelId(stack[(at + 1) % stack.length]);
  };

  const resizeBy = (drag: DragState, dx: number, dy: number) => {
    const { orig, box, handle } = drag;
    if (!handle) return;
    const next = resizeRect(box, orig.rot ?? 0, handle, dx, dy, isLocked(orig), 8);
    const at = { x: (next.x / DRAW) * 100, y: (next.y / DRAWH) * 100, w: (next.w / DRAW) * 100 };
    if (orig.t === 'text') {
      const size = clamp(orig.size * (next.w / box.w), 1.5, 60);
      patch(drag.id, { ...at, size });
    } else if (orig.t === 'pill') {
      const k = next.w / box.w;
      patch(drag.id, { ...at, h: orig.h * k, size: orig.size * k });
    } else if (orig.t === 'shape' || (orig.t === 'image' && orig.h !== undefined)) {
      patch(drag.id, { ...at, h: (next.h / DRAWH) * 100 });
    } else if (orig.t === 'line') {
      patch(drag.id, { x: at.x, w: at.w });
    } else {
      patch(drag.id, at);
    }
  };

  // A crop handle moves one edge of the frame while the picture stays where it is on screen.
  const cropBy = (drag: DragState, dx: number, dy: number) => {
    const { orig, box, handle } = drag;
    if (!handle || !isCroppable(orig)) return;
    const c = (orig as { crop?: ICCrop }).crop ?? FULL_CROP;
    const [fullW, fullH] = [box.w / c.w, box.h / c.h];
    const [sx, sy] = handleSign(handle);
    const room = (before: number, after: number, sign: number) => (sign < 0 ? before : after);
    const max = {
      w: box.w + (sx ? room(c.x, 1 - c.x - c.w, sx) * fullW : 0),
      h: box.h + (sy ? room(c.y, 1 - c.y - c.h, sy) * fullH : 0),
    };
    const next = resizeRect(box, orig.rot ?? 0, handle, dx, dy, false, 12, max);
    const [nw, nh] = [next.w / fullW, next.h / fullH];
    patch(drag.id, {
      crop: { x: sx < 0 ? c.x + c.w - nw : c.x, y: sy < 0 ? c.y + c.h - nh : c.y, w: nw, h: nh },
      x: (next.x / DRAW) * 100,
      y: (next.y / DRAWH) * 100,
      w: (next.w / DRAW) * 100,
    });
  };

  // Dragging inside the frame slides the picture under it.
  const panBy = (drag: DragState, dx: number, dy: number) => {
    const { orig, box } = drag;
    if (!isCroppable(orig)) return;
    const c = (orig as { crop?: ICCrop }).crop ?? FULL_CROP;
    const [lx, ly] = toLocal(dx, dy, orig.rot ?? 0);
    patch(drag.id, {
      crop: {
        ...c,
        x: clamp(c.x - lx / (box.w / c.w), 0, 1 - c.w),
        y: clamp(c.y - ly / (box.h / c.h), 0, 1 - c.h),
      },
    });
  };

  const pointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    const px = e.clientX - drag.sx;
    const py = e.clientY - drag.sy;
    if (drag.mode === 'rotate' && drag.turn) {
      const { cx, cy, from } = drag.turn;
      const by = ((Math.atan2(e.clientY - cy, e.clientX - cx) - from) * 180) / Math.PI;
      patch(drag.id, { rot: snapAngle((drag.orig.rot ?? 0) + by, e.shiftKey) });
      return;
    }
    if (drag.mode !== 'move') {
      const [dx, dy] = [(px * DRAW) / rect.width, (py * DRAWH) / rect.height];
      if (drag.mode === 'resize') resizeBy(drag, dx, dy);
      else if (drag.mode === 'crop') cropBy(drag, dx, dy);
      else panBy(drag, dx, dy);
      return;
    }
    const [dx, dy] = [(px / rect.width) * 100, (py / rect.height) * 100];
    for (const t of drag.group ?? [{ id: drag.id, x: drag.orig.x, y: drag.orig.y }]) {
      patch(t.id, { x: clamp(t.x + dx, -20, 100), y: clamp(t.y + dy, -20, 100) });
    }
  };

  const dropOnStage = (e: ReactDragEvent) => {
    const raw = e.dataTransfer.getData(IC_ADD_MIME);
    const rect = stageRef.current?.getBoundingClientRect();
    if (!raw || !rect) return;
    e.preventDefault();
    const at = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    const item = JSON.parse(raw) as ICAddItem;
    if (item.kind === 'art') addArt(item.id, at);
    else if (item.kind === 'block') addBlock(item.id, at);
    else if (item.kind === 'rect' || item.kind === 'ellipse') addShape(item.kind, at);
    else if (item.kind === 'line') addLine(at);
    else if (item.kind === 'avatar') addAvatar(at);
    else addText(item.kind, at);
  };

  // The selected avatar on its own, cropped to a profile picture or the whole figure.
  const exportAvatar = async (mode: 'avatar-pfp' | 'avatar-full') => {
    if (!avatarEl) return;
    const { format, mult, quality, transparent } = exportSettings;
    const width = Math.round(IC_OUTPUT_SIZE * mult);
    const crop = mode === 'avatar-pfp' ? AVATAR_PFP_CROP : AVATAR_FULL_CROP;
    let href: string;
    if (format === 'svg') {
      href = `data:image/svg+xml;utf8,${encodeURIComponent(await avatarCropSvg(avatarEl.config, crop))}`;
    } else if (format === 'pdf') {
      href = await pngToPdf(await avatarCropPng(avatarEl.config, crop, { width }));
    } else {
      href = await avatarCropPng(avatarEl.config, crop, {
        width,
        format,
        quality: quality / 100,
        transparentBg: transparent,
      });
    }
    const link = document.createElement('a');
    link.href = href;
    link.download = `avatar-${mode === 'avatar-pfp' ? 'pfp' : 'full-body'}.${format === 'jpeg' ? 'jpg' : format}`;
    link.click();
  };

  const stageClick = () => {
    setMultiSel([]);
    setSelId(layout.scene.on ? 'scene' : 'bg');
  };

  const stagePointerDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    marqueeRef.current = { sx: e.clientX, sy: e.clientY, dragging: false };
  };

  const stagePointerMove = (e: ReactPointerEvent) => {
    const m = marqueeRef.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!m || !rect) return;
    if (!m.dragging && Math.hypot(e.clientX - m.sx, e.clientY - m.sy) < 4) return;
    m.dragging = true;
    const x1 = clamp(((Math.min(m.sx, e.clientX) - rect.left) / rect.width) * 100, 0, 100);
    const y1 = clamp(((Math.min(m.sy, e.clientY) - rect.top) / rect.height) * 100, 0, 100);
    const x2 = clamp(((Math.max(m.sx, e.clientX) - rect.left) / rect.width) * 100, 0, 100);
    const y2 = clamp(((Math.max(m.sy, e.clientY) - rect.top) / rect.height) * 100, 0, 100);
    setMarquee({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
  };

  // A drag over empty canvas selects every layer it touches, so Delete and
  // Backspace can remove them all at once. A plain click still just selects
  // Background or Scene, same as before.
  const stagePointerUp = () => {
    const m = marqueeRef.current;
    marqueeRef.current = null;
    // Pointer capture still bubbles pointerup here after a layer's own
    // pointerDown handled the gesture (it only stops the down event), so
    // without this check every ordinary click also re-selected Background.
    if (!m) return;
    if (m.dragging && marquee) {
      const [mx1, my1, mx2, my2] = [
        (marquee.x / 100) * DRAW,
        (marquee.y / 100) * DRAWH,
        ((marquee.x + marquee.w) / 100) * DRAW,
        ((marquee.y + marquee.h) / 100) * DRAWH,
      ];
      const ids = layout.els
        .filter((e) => e.vis && !e.lock && !(e.t === 'art' && isFrameArt(e.art)))
        .filter((e) => {
          const box = layerBox(e, layout, DRAW);
          return box.x < mx2 && box.x + box.w > mx1 && box.y < my2 && box.y + box.h > my1;
        })
        .map((e) => e.id);
      setSelId(null);
      setMultiSel(ids);
    } else {
      stageClick();
    }
    setMarquee(null);
  };

  const tabs: { key: typeof tab; label: string; Icon: typeof LayoutTemplate }[] = [
    { key: 'templates', label: 'Templates', Icon: LayoutTemplate },
    { key: 'elements', label: 'Elements', Icon: Shapes },
    { key: 'avatar', label: 'Avatar', Icon: UserRound },
  ];

  const studio = (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-canvas-border bg-canvas-muted font-mono text-canvas-foreground ${
        standalone ? '' : 'max-h-[840px] max-w-[1320px] shadow-2xl'
      }`}
    >
      <div className="flex items-center gap-2.5 border-b border-canvas-border px-4 py-3">
        <div className="flex size-7 items-center justify-center rounded-lg border border-indigo-300/40 bg-indigo-300/15 text-indigo-300">
          <Layers className="size-3.5" />
        </div>
        <div className="text-sm font-semibold">Design Studio</div>
        <div className="text-[12px] text-canvas-muted-foreground">
          {layout.templateId === 'blank' ? 'Blank' : template.title}
        </div>
        {genBusy && (
          <div className="ml-2 flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 py-0.5 pl-2.5 pr-1 text-[11.5px] text-emerald-300">
            <Loader2 className="size-3 animate-spin" />
            {genBusy === 'new' ? 'Generating AI element…' : 'Regenerating…'}
            <button
              type="button"
              onClick={stopElement}
              className="rounded-full px-2 py-0.5 text-canvas-foreground hover:bg-canvas-muted"
            >
              Stop
            </button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={resetTemplate}
            title="Reset template to its original design"
            aria-label="Reset template"
            className="rounded p-1 text-canvas-muted-foreground hover:text-canvas-foreground"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Cmd+Z)"
            aria-label="Undo"
            className="rounded p-1 text-canvas-muted-foreground hover:text-canvas-foreground disabled:opacity-30"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Shift+Cmd+Z)"
            aria-label="Redo"
            className="rounded p-1 text-canvas-muted-foreground hover:text-canvas-foreground disabled:opacity-30"
          >
            <Redo2 className="size-4" />
          </button>
        </div>
        {!standalone && (
          <button
            type="button"
            onClick={finish}
            aria-label="Close"
            className="text-canvas-muted-foreground hover:text-canvas-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <BrandBar api={api} />

      <div className="grid min-h-0 flex-1 grid-cols-[64px_300px_1fr]">
        <nav className="flex flex-col items-center gap-1 border-r border-canvas-border bg-canvas-raised py-2">
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex w-[52px] flex-col items-center gap-1 rounded-lg py-2 text-center text-[10px] leading-tight ${tab === key ? 'bg-canvas-muted text-canvas-foreground' : 'text-canvas-muted-foreground hover:bg-canvas-muted hover:text-canvas-foreground'}`}
            >
              <Icon className="size-[18px]" />
              {label}
            </button>
          ))}
        </nav>

        <section className="min-h-0 overflow-y-auto border-r border-canvas-border bg-canvas p-3">
          {tab === 'templates' && <TemplatesPanel api={api} />}
          {tab === 'elements' && <ElementsPanel api={api} />}
          {tab === 'avatar' &&
            (selected?.t === 'avatar' ? (
              <AvatarEditor el={selected} api={api} />
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-[12px] text-canvas-muted-foreground">
                <p>Select or add an avatar to customize it.</p>
                <button
                  type="button"
                  onClick={() => api.addAvatar()}
                  className="rounded-md border border-canvas-border bg-canvas px-3 py-1.5 text-canvas-foreground hover:bg-canvas-muted"
                >
                  Add avatar
                </button>
              </div>
            ))}
        </section>

        <main className="flex min-h-0 min-w-0 flex-col bg-canvas">
          <Toolbar api={api} />
          <div className="relative flex min-h-0 flex-1">
            <div
              ref={holderRef}
              className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
              style={{
                backgroundImage: 'radial-gradient(#22262b 1.2px, transparent 1.2px)',
                backgroundSize: '22px 22px',
              }}
            >
              {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target for elements dragged from the Elements tab */}
              <div
                ref={stageRef}
                onPointerDown={stagePointerDown}
                onPointerMove={stagePointerMove}
                onPointerUp={stagePointerUp}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(IC_ADD_MIME)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                  }
                }}
                onDrop={dropOnStage}
                // Not clipped, so a layer bigger than the canvas still shows its box and handles around it.
                className={`relative shrink-0 rounded-lg border shadow-lg ${selId === 'bg' || selId === 'scene' ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40' : 'border-canvas-border'}`}
                style={{
                  width: side,
                  height: side * rh,
                  backgroundColor: '#1c2027',
                  backgroundImage:
                    'conic-gradient(#2a2f37 25%, transparent 0 50%, #2a2f37 0 75%, transparent 0)',
                  backgroundSize: '20px 20px',
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={DRAW}
                  height={Math.round(DRAWH)}
                  className="absolute inset-0 size-full rounded-lg"
                />
                {layout.els
                  .filter((e) => e.vis)
                  .map((e) => {
                    const box = layerBox(e, layout, DRAW);
                    const on = e.id === selId || multiSel.includes(e.id);
                    // A locked layer covering the canvas, like a background grid,
                    // lets drags through to the selection box.
                    const passThrough =
                      (e.lock || (e.t === 'art' && isFrameArt(e.art))) &&
                      box.w * box.h >= DRAW * DRAWH * 0.9;
                    return (
                      // biome-ignore lint/a11y/noStaticElementInteractions: a draggable box over the canvas, edited with the mouse or the shortcuts
                      <div
                        key={e.id}
                        data-layer-id={e.id}
                        onPointerDown={(ev) => {
                          if (ev.altKey) {
                            ev.stopPropagation();
                            selectBehind(ev.clientX, ev.clientY);
                            return;
                          }
                          pointerDown(ev, e, 'move');
                        }}
                        onPointerMove={pointerMove}
                        onPointerUp={() => {
                          dragRef.current = null;
                        }}
                        onDoubleClick={() => {
                          if (e.t === 'text' || e.t === 'pill')
                            setEditing({ id: e.id, value: e.text });
                          else if (isCroppable(e)) setCropId(e.id);
                        }}
                        className={`absolute ${passThrough ? 'pointer-events-none' : 'cursor-grab'} ${on ? 'outline outline-1 outline-fuchsia-400 ring-[3px] ring-fuchsia-400/40' : 'hover:outline hover:outline-1 hover:outline-white/40'}`}
                        style={{
                          left: `${(box.x / DRAW) * 100}%`,
                          top: `${(box.y / DRAWH) * 100}%`,
                          width: `${(box.w / DRAW) * 100}%`,
                          height: `${(box.h / DRAWH) * 100}%`,
                          transform: e.rot ? `rotate(${e.rot}deg)` : undefined,
                        }}
                      ></div>
                    );
                  })}
                {marquee && (
                  <div
                    className="pointer-events-none absolute border border-fuchsia-400 bg-fuchsia-400/10"
                    style={{
                      left: `${marquee.x}%`,
                      top: `${marquee.y}%`,
                      width: `${marquee.w}%`,
                      height: `${marquee.h}%`,
                    }}
                  />
                )}
                {selected?.vis &&
                  !cropEl &&
                  (() => {
                    const box = layerBox(selected, layout, DRAW);
                    const topPct = (box.y / DRAWH) * 100;
                    const above = topPct > 8;
                    return (
                      <>
                        <div
                          className="pointer-events-none absolute"
                          style={{
                            left: `${(box.x / DRAW) * 100}%`,
                            top: `${topPct}%`,
                            width: `${(box.w / DRAW) * 100}%`,
                            height: `${(box.h / DRAWH) * 100}%`,
                            transform: selected.rot ? `rotate(${selected.rot}deg)` : undefined,
                          }}
                        >
                          {handlesFor(selected).map((h) => (
                            <i
                              key={h}
                              onPointerDown={(ev) => pointerDown(ev, selected, 'resize', h)}
                              onPointerMove={pointerMove}
                              onPointerUp={() => {
                                dragRef.current = null;
                              }}
                              className="pointer-events-auto absolute block size-2.5 rounded-[2px] border-2 border-fuchsia-400 bg-canvas"
                              style={{
                                left: `${HANDLE_AT[h][0] * 100}%`,
                                top: `${HANDLE_AT[h][1] * 100}%`,
                                transform: 'translate(-50%, -50%)',
                                cursor: `${h}-resize`,
                              }}
                            />
                          ))}
                          {!selected.lock && (
                            // The rotate button sits on the side away from the toolbar.
                            <button
                              type="button"
                              aria-label="Rotate"
                              title="Drag to rotate. Hold Shift for 15° steps."
                              onPointerDown={(ev) => pointerDown(ev, selected, 'rotate')}
                              onPointerMove={pointerMove}
                              onPointerUp={() => {
                                dragRef.current = null;
                              }}
                              className="pointer-events-auto absolute left-1/2 flex size-7 cursor-grab items-center justify-center rounded-full border border-canvas-border bg-canvas text-canvas-foreground shadow-md hover:bg-canvas-muted active:cursor-grabbing"
                              style={
                                above
                                  ? { top: '100%', transform: 'translate(-50%, 12px)' }
                                  : { bottom: '100%', transform: 'translate(-50%, -12px)' }
                              }
                            >
                              <RotateCw className="size-3.5" />
                            </button>
                          )}
                        </div>
                        {!editing && (
                          <MiniBar
                            api={api}
                            style={{
                              left: `${(box.x / DRAW) * 100 + (box.w / DRAW) * 50}%`,
                              top: above ? `${topPct}%` : `${((box.y + box.h) / DRAWH) * 100}%`,
                              transform: above
                                ? 'translate(-50%, calc(-100% - 10px))'
                                : 'translate(-50%, 10px)',
                            }}
                          />
                        )}
                      </>
                    );
                  })()}
                {cropEl &&
                  (() => {
                    const box = layerBox(cropEl, layout, DRAW);
                    const c = cropEl.crop ?? FULL_CROP;
                    const src = cropEl.t === 'subject' ? layout.subject.url : cropEl.url;
                    const pic: CSSProperties = {
                      position: 'absolute',
                      maxWidth: 'none',
                      left: `${(-c.x / c.w) * 100}%`,
                      top: `${(-c.y / c.h) * 100}%`,
                      width: `${100 / c.w}%`,
                      height: `${100 / c.h}%`,
                    };
                    const release = () => {
                      dragRef.current = null;
                    };
                    return (
                      <div
                        className="pointer-events-none absolute"
                        style={{
                          left: `${(box.x / DRAW) * 100}%`,
                          top: `${(box.y / DRAWH) * 100}%`,
                          width: `${(box.w / DRAW) * 100}%`,
                          height: `${(box.h / DRAWH) * 100}%`,
                          transform: cropEl.rot ? `rotate(${cropEl.rot}deg)` : undefined,
                        }}
                      >
                        {/* biome-ignore lint/performance/noImgElement: the picture being cropped, a local data URL */}
                        <img src={src} alt="" draggable={false} style={{ ...pic, opacity: 0.35 }} />
                        <div
                          onPointerDown={(ev) => pointerDown(ev, cropEl, 'pan')}
                          onPointerMove={pointerMove}
                          onPointerUp={release}
                          className="pointer-events-auto absolute inset-0 cursor-move overflow-hidden outline outline-2 outline-fuchsia-400"
                        >
                          {/* biome-ignore lint/performance/noImgElement: the picture being cropped, a local data URL */}
                          <img
                            src={src}
                            alt=""
                            draggable={false}
                            className="pointer-events-none"
                            style={pic}
                          />
                        </div>
                        {ALL_HANDLES.map((h) => (
                          <i
                            key={h}
                            onPointerDown={(ev) => pointerDown(ev, cropEl, 'crop', h)}
                            onPointerMove={pointerMove}
                            onPointerUp={release}
                            className="pointer-events-auto absolute block size-2.5 rounded-[2px] border-2 border-fuchsia-400 bg-fuchsia-400"
                            style={{
                              left: `${HANDLE_AT[h][0] * 100}%`,
                              top: `${HANDLE_AT[h][1] * 100}%`,
                              transform: 'translate(-50%, -50%)',
                              cursor: `${h}-resize`,
                            }}
                          />
                        ))}
                      </div>
                    );
                  })()}
                {editing &&
                  (() => {
                    const target = layout.els.find((e) => e.id === editing.id);
                    if (!target) return null;
                    const box = layerBox(target, layout, DRAW);
                    const commit = () => {
                      patch(editing.id, { text: editing.value });
                      setEditing(null);
                    };
                    return (
                      <textarea
                        // biome-ignore lint/a11y/noAutofocus: opened by an explicit double-click on the text
                        autoFocus
                        value={editing.value}
                        onChange={(e) => setEditing({ id: editing.id, value: e.target.value })}
                        onBlur={commit}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditing(null);
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
                        }}
                        className="absolute z-10 resize-none rounded border border-emerald-500/60 bg-canvas/95 p-1 text-[12px] text-canvas-foreground focus:outline-none"
                        style={{
                          left: `${(box.x / DRAW) * 100}%`,
                          top: `${(box.y / DRAWH) * 100}%`,
                          width: `${Math.max((box.w / DRAW) * 100, 30)}%`,
                          minHeight: `${(box.h / DRAWH) * 100}%`,
                        }}
                      />
                    );
                  })()}
              </div>
            </div>
            {editId && <EditDrawer api={api} id={editId} />}
          </div>
          <PageStrip
            layout={layout}
            sceneUrl={sceneUrl}
            onGo={(i) => {
              setLayout((l) => goToPage(l, i));
              setSelId(null);
            }}
            onAdd={(kind) => {
              setLayout((l) => addPage(l, kind));
              setSelId(null);
            }}
            onRemove={() => {
              setLayout(removePage);
              setSelId(null);
            }}
            onMove={(by) => setLayout((l) => movePage(l, by))}
          />
        </main>
      </div>

      <div className="flex items-center gap-2 border-t border-canvas-border px-4 py-2.5">
        <span className="flex-1" />
        <SaveDesignButton
          savedTick={savedTick}
          layout={layout}
          sceneUrl={sceneUrl}
          fallbackName={
            layout.templateId === 'blank'
              ? 'Untitled design'
              : findTemplate(layout.thread?.root ?? layout.templateId).title
          }
          onSaved={(saved) => setLayout((l) => ({ ...l, saved }))}
        />
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={layout.scene.on && !sceneReady}
          title={
            layout.scene.on && !sceneReady
              ? 'Run the workflow once to paint the AI background'
              : 'Preview every size and download them'
          }
          className="rounded-md border border-canvas-border px-3 py-1.5 text-[12.5px] hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          Export
        </button>
        {!standalone && (
          <button
            type="button"
            onClick={finish}
            className="rounded-md border border-emerald-500/60 px-3.5 py-1.5 text-[12.5px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10"
          >
            Done
          </button>
        )}
      </div>
      {previewOpen && (
        <ExportSheet
          layout={layout}
          template={template}
          sceneUrl={sceneUrl}
          settings={exportSettings}
          onSettings={setExportSettings}
          onAvatarExport={avatarEl ? exportAvatar : undefined}
          onClose={() => setPreviewOpen(false)}
          onEdit={(ratio, custom) => {
            if (custom) setCustomSize(custom.width, custom.height);
            else setRatio(ratio);
            setPreviewOpen(false);
          }}
          onSizes={(exportSizes) => setLayout((l) => ({ ...l, exportSizes }))}
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
  if (standalone) return studio;
  return createPortal(
    // z-55 sits above the config popup and below the select menus (z-60), so their options stay visible.
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking the dimmed backdrop closes the studio, as in the Export popup
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && finish()}
    >
      {studio}
    </div>,
    document.body,
  );
}
