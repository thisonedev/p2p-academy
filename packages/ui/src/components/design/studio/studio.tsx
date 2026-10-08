'use client';

import {
  House,
  LayoutTemplate,
  Loader2,
  Minus,
  Plus,
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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { generateElement, randomSeed, stopGenerating } from '../art/ai-element.js';
import { ANNOUNCE_BRANDS, brandOfKit, layerBuilder } from '../templates/announce.js';
import { artDef, artDefaults, artFit, artPalette } from '../art/art.js';
import { isFrameArt, PHONE_SCREEN } from '../art/art-web3.js';
import {
  AVATAR_FULL_CROP,
  AVATAR_PFP_CROP,
  avatarCropPng,
  avatarCropSvg,
  randomAvatarConfig,
} from '../art/avatar.js';
import { blockStyle, findBlock } from '../templates/blocks.js';
import type { BrandKit } from '../brand/brand-kit.js';
import { isChart } from '../art/charts.js';
import { isCode } from '../art/code.js';
import { DEFAULT_CUTOUT, type ICCutout, removeBackground } from '../art/cutout.js';
import { loadDesign, saveDesign } from './designs.js';
import { SCREENSHOT } from '../art/device.js';
import { loadFonts } from '../render/fonts.js';
import {
  canvasLines,
  gridLines,
  gridSnapLines,
  type ICGrid,
  SAFE_MARGIN,
  snapBox,
} from '../render/grid.js';
import { CreateButton, type ICNewSize, StudioHome } from './home.js';
import { useHistory } from './history.js';
import {
  applyBrandKit,
  applyPalette,
  cleanSession,
  defaultRatio,
  designRoles,
  FIGURE_MIN,
  FULL_CROP,
  figureBackdrop,
  fitPatterns,
  IC_OUTPUT_SIZE,
  type ICAvatarEl,
  type ICCrop,
  type ICElement,
  type ICLayout,
  type ICModel,
  type ICPill,
  type ICRatio,
  type ICTemplate,
  isCroppable,
  isSlotImage,
  isTexture,
  layoutFromTemplate,
  layoutRoles,
  newElementId,
  openClean,
  openTemplate,
  parseLayout,
  reconnectWires,
  parseSceneCache,
  pickPartner,
  ratioHeight,
  resetPalette,
  resetPartner,
  resizeLayout,
  restyleButton,
  sceneKey,
  setTexture,
  swapSides,
  textureOf,
  upgradeIds,
} from '../render/layout.js';
import { logoColor } from '../brand/logo-color.js';
import { PageStrip } from './pages.js';
import {
  AvatarEditor,
  EditDrawer,
  ElementsPanel,
  FormatChips,
  IC_ADD_MIME,
  type ICAddItem,
  type ICPoint,
  MiniBar,
  type Selection,
  SelectionMenu,
  type StudioApi,
  TemplatesPanel,
  Inspector,
} from '../panels/panels.js';
import { pngToPdf } from '../render/pdf.js';
import {
  MotionPanel,
  MotionStage,
  newMotionPlayer,
  useMotionScene,
} from '../motion/motion-panel.js';
import { MotionTimeline } from '../motion/motion-timeline.js';
import { SHARP } from '../motion/motion.js';
import { motionOf } from '../video/films.js';
import { ExportSheet, type ICExportSettings } from '../panels/previews.js';
import { readImage } from '../render/read-image.js';
import {
  drawBackground,
  drawLayout,
  type ICBox,
  type ICImages,
  layerBox,
  loadImages,
  slotPlacement,
} from '../render/render.js';
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
} from '../render/resize.js';
import { ipcErrorMessage } from '../../playground/lib/library.js';
import { SaveDesignButton } from './save-design.js';
import { isScreen } from '../art/screens.js';
import { setSlotDefault } from '../render/slots.js';
import {
  ALL_TEMPLATES,
  defaultLayout,
  findTemplate,
  siblingTemplate,
} from '../templates/templates.js';
import { SlideStrip, useDesignOnly, useStory, VideoPanel, VideoStage } from '../video/video-panel.js';
import {
  addPage,
  goToPage,
  movePage,
  removePage,
  startThread,
  threadInBrand,
} from '../templates/thread.js';
import { Overlay } from '../../ui/overlay.js';
import { IconButton } from '../../ui/icon-button.js';

// The canvas is drawn at a fixed size and scaled by CSS, so dragging works in percentages.
const DRAW = 1080;
/** Zoom steps, as a share of the size that fits the canvas area. 1 is Fit. */
const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const nextZoom = (z: number, dir: 1 | -1) =>
  dir === 1 ? (ZOOMS.find((s) => s > z + 1e-6) ?? z) : ([...ZOOMS].reverse().find((s) => s < z - 1e-6) ?? z);

type PickTarget = 'add' | 'layer' | 'subject' | 'scene' | 'partner' | 'shot';

interface DragState {
  id: string;
  mode: 'move' | 'resize' | 'crop' | 'pan' | 'rotate' | 'scale';
  handle?: ICHandle;
  /** The element's box in canvas pixels when the drag began. */
  box: ICRect;
  sx: number;
  sy: number;
  orig: ICElement;
  /** Other selected elements moving together with `id`, their starting x/y in percent. */
  group?: { id: string; x: number; y: number }[];
  /** Scaling a selection of several layers: each one as it was when the drag began. */
  members?: ICElement[];
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

/** The lines a drag snapped to, in magenta. The safe margin shows as a dashed frame. */
function GuideLines({ x, y, H }: { x?: number; y?: number; H: number }) {
  const safe =
    [SAFE_MARGIN, 100 - SAFE_MARGIN].includes(x ?? -1) ||
    [SAFE_MARGIN, H - SAFE_MARGIN].includes(y ?? -1);
  const line = {
    stroke: 'rgb(217 70 239)',
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      viewBox={`0 0 100 ${H}`}
      preserveAspectRatio="none"
    >
      {safe && (
        <rect
          x={SAFE_MARGIN}
          y={SAFE_MARGIN}
          width={100 - SAFE_MARGIN * 2}
          height={H - SAFE_MARGIN * 2}
          fill="none"
          {...line}
          strokeDasharray="4 4"
          strokeOpacity={0.7}
        />
      )}
      {x !== undefined && <line x1={x} x2={x} y1={0} y2={H} {...line} />}
      {y !== undefined && <line x1={0} x2={100} y1={y} y2={y} {...line} />}
    </svg>
  );
}

/** The layout grid over the stage: columns and rows as soft bands, the baseline as hairlines. */
function GridOverlay({ grid, H }: { grid: ICGrid; H: number }) {
  const { cols, rows, baseline } = gridLines(grid, H);
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      viewBox={`0 0 100 ${H}`}
      preserveAspectRatio="none"
    >
      {cols.map(([a, b]) => (
        <rect key={`c${a}`} x={a} y={0} width={b - a} height={H} fill="rgb(236 72 153 / 0.1)" />
      ))}
      {rows.map(([a, b]) => (
        <rect key={`r${a}`} x={0} y={a} width={100} height={b - a} fill="rgb(236 72 153 / 0.1)" />
      ))}
      {baseline.map((y) => (
        <line
          key={`b${y}`}
          x1={0}
          x2={100}
          y1={y}
          y2={y}
          stroke="rgb(34 211 238 / 0.25)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/** Every element sharing `id`'s group, or just `id` alone if it isn't grouped. */
const groupMembers = (els: ICElement[], id: string): string[] => {
  const groupId = els.find((e) => e.id === id)?.groupId;
  return groupId ? els.filter((e) => e.groupId === groupId).map((e) => e.id) : [id];
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A layer grown or shrunk by `k`, with its top-left corner moved to `x`, `y` (percent). */
function scaleLayer(e: ICElement, k: number, x: number, y: number): ICElement {
  const next = { ...e, x, y } as ICElement;
  if ('w' in next) next.w *= k;
  if ('h' in next && typeof next.h === 'number') next.h *= k;
  if ('size' in next) next.size *= k;
  if ('radius' in next && typeof next.radius === 'number') next.radius *= k;
  if ('sw' in next) next.sw *= k;
  if ('th' in next) next.th *= k;
  return next;
}

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

// Rail items are tinted tiles like the playground's block palette, in its colors from the bottom up.
const RAIL_ITEM =
  'group flex w-[56px] flex-col items-center gap-1 py-1 text-center text-[10px] leading-tight';
const RAIL_TILE = 'flex size-9 items-center justify-center rounded-lg border transition';
// The border stays faint whether or not the tab is open: full strength and a white label mark it.
const RAIL_TINT = {
  home: 'text-blue-300 bg-blue-300/15 border-blue-300/40',
  templates: 'text-amber-300 bg-amber-300/15 border-amber-300/40',
  elements: 'text-orange-300 bg-orange-300/15 border-orange-300/40',
  avatar: 'text-red-300 bg-red-300/15 border-red-300/40',
};

function RailButton({
  on,
  tint,
  Icon,
  label,
  title,
  onClick,
}: {
  on: boolean;
  tint: keyof typeof RAIL_TINT;
  Icon: typeof House;
  label: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} title={title ?? label} className={RAIL_ITEM}>
      <span
        className={`${RAIL_TILE} ${RAIL_TINT[tint]} ${on ? '' : 'opacity-75 group-hover:opacity-100'}`}
      >
        <Icon className="size-3.5" />
      </span>
      <span className={on ? 'text-canvas-foreground' : 'text-canvas-muted-foreground group-hover:text-canvas-foreground'}>
        {label}
      </span>
    </button>
  );
}

/**
 * A template opened from another design takes that design's look: its palette, or its own UI kit.
 * A draft of the template keeps its words and edits; its old colors are replaced.
 */
function inLookOf(opened: ICLayout, from: ICLayout, t: ICTemplate): ICLayout {
  if (from.palette) {
    return opened.palette === from.palette ? opened : applyPalette(opened, from.palette);
  }
  if (from.kit && !brandOfKit(from.kit.id)) {
    return opened.kit?.id === from.kit.id && !opened.palette ? opened : applyBrandKit(opened, from.kit);
  }
  // Coming from a built-in brand: a draft left in a palette or a kit of your own goes back to the template's.
  const stale = opened.palette || (opened.kit && !brandOfKit(opened.kit.id));
  return stale && t.kit ? applyBrandKit(opened, t.kit) : opened;
}

/** Reads a picked image as a data URL, shrinking very large photos so the saved design stays light. */
export interface DesignStudioProps {
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

export function DesignStudio({
  layoutRaw,
  sceneCacheRaw,
  onSave,
  onSaveShortcut,
  onClose,
  standalone = false,
}: DesignStudioProps) {
  const {
    value: layout,
    set: setRaw,
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
  // Every edit redraws the wires between the dots it moved, so they stay joined.
  const setLayout = useCallback(
    (fn: (l: ICLayout) => ICLayout) =>
      setRaw((l) => {
        const next = reconnectWires(fn(l));
        // An edit leaves `saved` as it was, and that marks the design unsaved. A save or an open
        // puts a new `saved` in its place, which clears the mark.
        return next !== l && next.saved && next.saved === l.saved && !next.saved.dirty
          ? { ...next, saved: { ...next.saved, dirty: true } }
          : next;
      }),
    [setRaw],
  );
  const [selId, setSelId] = useState<Selection>(null);
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<ICBox | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // The lines a drag caught on, in percent of the width, drawn across the canvas while it lasts.
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [cropId, setCropId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [tab, setTab] = useState<'templates' | 'elements' | 'avatar'>('templates');
  // Clicking the open tab again folds the side panel away, for more room on the canvas.
  const [panelOpen, setPanelOpen] = useState(true);
  // The Design page opens on its home; the workflow's studio goes straight to the canvas.
  const [view, setView] = useState<'home' | 'editor'>(standalone ? 'home' : 'editor');
  // Picked on Home: the brand its templates show in and a new blank design starts in.
  const [homeBrand, setHomeBrand] = useState(ANNOUNCE_BRANDS[0].id);
  // Home's New design card opens the same size menu as the + in the rail.
  const [createTick, setCreateTick] = useState(0);
  const [images, setImages] = useState<ICImages>({ scene: null, subject: null, layers: new Map() });
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [side, setSide] = useState(480);
  const [zoom, setZoom] = useState(1);
  const [fontsReady, setFontsReady] = useState(false);
  const [cutBusy, setCutBusy] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Every size and format is free, no export paywall.
  const [exportSettings, setExportSettings] = useState<ICExportSettings>({
    format: 'png',
    mult: 1,
    quality: 92,
    transparent: false,
    fps: 30,
    sound: true,
  });
  const holderRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<PickTarget>('add');
  const dragRef = useRef<DragState | null>(null);
  const clipRef = useRef<ICElement | null>(null);
  const marqueeRef = useRef<{
    sx: number;
    sy: number;
    dragging: boolean;
    /** Pressed on the canvas itself, not the space around it. */
    inside: boolean;
  } | null>(null);
  const creatingAvatarRef = useRef(false);

  const cache = useMemo(() => parseSceneCache(sceneCacheRaw), [sceneCacheRaw]);
  const sceneUrl = cache && cache.key === sceneKey(layout) ? cache.url : null;
  const sceneReady = Boolean(sceneUrl || layout.scene.upload);
  const template = findTemplate(layout.templateId);
  const rh = ratioHeight(layout.ratio, layout.customSize);
  const DRAWH = DRAW * rh;
  // Zoomed in, the canvas draws at the size it shows, so text stays sharp. DRAW stays the layout math's unit.
  const shown = side * zoom;
  const res = Math.round(
    Math.min(4320, Math.max(DRAW, shown * (typeof window === 'undefined' ? 1 : window.devicePixelRatio))),
  );

  // While the Motion tab is open the canvas plays the design's video instead of standing still.
  const [motionOpen, setMotionOpen] = useState(false);
  // The Video tab plays the design's longer video the same way. Only one of the two is open.
  const [videoOpen, setVideoOpen] = useState(false);
  const playing = motionOpen || videoOpen;
  const [player] = useState(newMotionPlayer);
  // Typing into the video's fields leaves the design as it was, so its layers are not repainted.
  const designOnly = useDesignOnly(layout);
  const motionScene = useMotionScene(
    designOnly,
    sceneUrl,
    Math.round(Math.min(res, 1400) * SHARP),
    motionOpen && view === 'editor',
  );
  const story = useStory(layout, sceneUrl, videoOpen && view === 'editor');
  // A button pressed with the mouse gives its focus up, so no focus ring is left on it when a key
  // is pressed next. A button reached with the keyboard keeps its ring.
  useEffect(() => {
    const letGo = (e: MouseEvent) => {
      const button = (e.target as HTMLElement | null)?.closest('button');
      if (e.detail > 0 && button?.closest('[data-design-studio]')) button.blur();
    };
    document.addEventListener('click', letGo);
    return () => document.removeEventListener('click', letGo);
  }, []);

  // The slide last picked, in the strip under the canvas or in the Video tab.
  const [slide, setSlide] = useState('hook');

  // Another template is another video, so it plays from its first frame.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the template's id is the trigger
  useEffect(() => {
    player.t = 0;
    player.playing = true;
  }, [layout.templateId, player]);

  const imageKey = [
    signature(layout.subject.url),
    signature(layout.scene.upload?.url),
    signature(sceneUrl ?? undefined),
    ...layout.els.map((e) => {
      if (e.t === 'image') return `${e.id}${signature(e.url)}`;
      if (e.t === 'art')
        return `${e.id}${e.art}${JSON.stringify(e.colors)}${e.data ? JSON.stringify(e.data) : ''}${e.code ? JSON.stringify(e.code) : ''}${e.shot ? signature(e.shot.url) : ''}`;
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

  // A new zoom resizes the canvas, which wipes it, so this redraws before the browser paints the blank frame.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fontsReady redraws once the bundled fonts load, view once the canvas mounts
  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    // Until the scene is generated, the design's own background shows through.
    if (ctx) drawLayout(ctx, layout, images, res);
  }, [layout, images, fontsReady, view, res]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the holder only exists in the editor view
  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const measure = () =>
      setSide(Math.max(200, Math.min(el.clientWidth - 32, (el.clientHeight - 32) / rh, 720)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [rh, view]);

  // Cmd + / Cmd - / Cmd 0 zoom the canvas, unless the keys are going into a text field.
  useEffect(() => {
    if (view !== 'editor') return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === '=' || e.key === '+') setZoom((z) => nextZoom(z, 1));
      else if (e.key === '-') setZoom((z) => nextZoom(z, -1));
      else if (e.key === '0') setZoom(1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view]);

  // Pinch, or Ctrl and the wheel, zooms smoothly. The listener isn't passive, so the page doesn't zoom too.
  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(4, Math.max(0.25, z * Math.exp(-e.deltaY * 0.01))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [view]);

  // A new zoom keeps the middle of the design in the middle of the view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the zoom changes
  useLayoutEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [zoom]);

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
  const cropEl = cropFound?.t === 'subject' || cropFound?.t === 'image' ? cropFound : undefined;

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

  const addButton = useCallback(
    (at?: ICPoint) => {
      const look = layout.kit?.elements?.buttons ?? 'solid';
      const H = ratioHeight(layout.ratio, layout.customSize) * 100;
      const size = 3.2;
      const base: ICPill = {
        id: newElementId(),
        t: 'pill',
        role: 'cta',
        x: 30,
        y: 44,
        w: 28,
        h: ((size * 2.6) / H) * 100,
        text: look === 'link' ? 'Read more' : 'Get started',
        size,
        weight: 600,
        font: blockStyle(layout.kit).body,
        track: 0,
        color: '',
        fill: '',
        stroke: '',
        vis: true,
        user: true,
      };
      insert(centered(restyleButton(base, look, designRoles(layout)), at));
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
      const character = def.kind === 'character';
      const roles = designRoles(layout);
      if (def.group === 'Backgrounds') {
        // A frame, pattern or streaks becomes the design's one texture, over the whole canvas.
        setLayout((l) => setTexture(l, textureOf(id)));
        setSelId(null);
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
          colors: { ...artDefaults(def), ...artPalette(def, roles) },
          vis: true,
          user: true,
          groupId,
        };
        setLayout((l) => ({
          ...l,
          els: [...l.els, frame, shot],
          groupNames: { ...l.groupNames, [groupId]: def.name },
        }));
        setSelId(null);
        setMultiSel([frame.id, shot.id]);
        return;
      }
      // Devices come in at about the height of the phone, so a laptop isn't a fraction of one. A
      // code window or chart comes in wide enough to read, and a wide drawing wider than an icon.
      const device = isScreen(id);
      const w = character
        ? 18
        : device
          ? Math.min(62, 44 * def.ratio)
          : def.group === 'Code'
            ? 60
            : def.group === 'Charts'
              ? 50
              : def.ratio >= 1.4
                ? 36
                : 24;
      const H = ratioHeight(layout.ratio, layout.customSize) * 100;
      const el: ICElement = {
        id: newElementId(),
        t: 'art',
        art: id,
        x: character ? 42 : (100 - w) / 2,
        y: character ? 20 : ((H - w / def.ratio) / 2 / H) * 100,
        w,
        colors: artFit(
          def,
          { ...artDefaults(def), ...artPalette(def, roles) },
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
      setLayout((l) => ({
        ...l,
        els: [...l.els, ...els],
        groupNames: { ...l.groupNames, [groupId]: block.name },
      }));
      setSelId(null);
      setMultiSel(els.map((e) => e.id));
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

  // The layers the bar, the right-click menu and the shortcuts act on: a group or pick, or one layer.
  const selIds = multiSel.length > 0 ? multiSel : selected ? [selected.id] : [];

  const duplicate = useCallback(() => {
    if (multiSel.length === 0) {
      if (selected) insert(copyOf(selected), selected.id);
      return;
    }
    // Copies of a group form a group of their own.
    const groups = new Map<string, string>();
    const copies = layout.els
      .filter((e) => multiSel.includes(e.id))
      .map((e) => {
        const copy = copyOf(e);
        if (!e.groupId) return copy;
        if (!groups.has(e.groupId)) groups.set(e.groupId, newElementId());
        return { ...copy, groupId: groups.get(e.groupId) };
      });
    setLayout((l) => ({ ...l, els: [...l.els, ...copies] }));
    setSelId(null);
    setMultiSel(copies.map((c) => c.id));
  }, [copyOf, insert, layout.els, multiSel, selected, setLayout]);

  const remove = useCallback(() => {
    if (multiSel.length > 0) {
      setLayout((l) => ({ ...l, els: l.els.filter((e) => !multiSel.includes(e.id)) }));
      setMultiSel([]);
      return;
    }
    if (!selected) return;
    setLayout((l) => ({ ...l, els: l.els.filter((e) => e.id !== selected.id) }));
    setSelId(null);
  }, [multiSel, selected, setLayout]);

  /** Locks the selection, or unlocks it when all of it is locked already. */
  const toggleLock = useCallback(() => {
    const ids = multiSel.length > 0 ? multiSel : selected ? [selected.id] : [];
    const lock = layout.els.some((e) => ids.includes(e.id) && !e.lock);
    setLayout((l) => ({
      ...l,
      els: l.els.map((e) => (ids.includes(e.id) ? { ...e, lock } : e)),
    }));
  }, [layout.els, multiSel, selected, setLayout]);

  const group = useCallback(() => {
    if (multiSel.length < 2) return;
    const groupId = newElementId();
    setLayout((l) => ({
      ...l,
      els: l.els.map((e) => (multiSel.includes(e.id) ? { ...e, groupId } : e)),
    }));
  }, [multiSel, setLayout]);

  // Ungrouping any part of a group, even the one layer picked out of it, takes the whole group apart.
  const ungroup = useCallback(() => {
    const ids = multiSel.length > 0 ? multiSel : selected ? [selected.id] : [];
    const gone = new Set(
      layout.els.flatMap((e) => (ids.includes(e.id) && e.groupId ? [e.groupId] : [])),
    );
    if (gone.size === 0) return;
    setLayout((l) => ({
      ...l,
      els: l.els.map((e) => (e.groupId && gone.has(e.groupId) ? { ...e, groupId: undefined } : e)),
    }));
  }, [layout.els, multiSel, selected, setLayout]);

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
      const ids = multiSel.length > 0 ? multiSel : selId ? [selId] : [];
      setLayout((l) => {
        // Moved together, in the order they already stack.
        const picked = l.els.filter((e) => ids.includes(e.id));
        if (picked.length === 0) return l;
        const rest = l.els.filter((e) => !ids.includes(e.id));
        return { ...l, els: dir === 1 ? [...rest, ...picked] : [...picked, ...rest] };
      });
    },
    [multiSel, selId, setLayout],
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
      setLayout((l) => {
        if (l.saved) {
          const clean = openClean(l, t, (bare) =>
            startThread(
              layoutFromTemplate(t, bare, findTemplate(l.templateId), l.ratio ?? defaultRatio(t)),
              t,
            ),
          );
          return inLookOf(clean, l, t);
        }
        return inLookOf(
          openTemplate(l, findTemplate(l.templateId), t, (cur) =>
            startThread(
              layoutFromTemplate(t, cur, findTemplate(cur.templateId), cur.ratio ?? defaultRatio(t)),
              t,
            ),
          ),
          l,
          t,
        );
      });
      setSelId(null);
    },
    [setLayout],
  );

  // Starting from home or the + menu replaces the design; undo brings the old one back.
  const startDesign = useCallback(
    (next: ICLayout) => {
      setLayout(() => next);
      setSelId(null);
      setMultiSel([]);
      setTab('templates');
      setView('editor');
    },
    [setLayout],
  );

  const newDesign = useCallback(
    (size: ICNewSize) => {
      const blank =
        'ratio' in size
          ? resizeLayout(defaultLayout(), findTemplate('blank'), size.ratio)
          : resizeLayout(defaultLayout(), findTemplate('blank'), 'custom', size);
      const kit = ANNOUNCE_BRANDS.find((b) => b.id === homeBrand)?.kit;
      startDesign(kit ? applyBrandKit(blank, kit) : blank);
    },
    [startDesign, homeBrand],
  );

  const fromTemplate = useCallback(
    (t: ICTemplate) =>
      startDesign(startThread(layoutFromTemplate(t, undefined, undefined, defaultRatio(t)), t)),
    [startDesign],
  );

  // What the person was about to do when a saved design with unsaved edits was in the way.
  const [leaving, setLeaving] = useState<{ go: () => void } | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const unsaved = !!layout.saved?.dirty;
  /** Runs `go` now, or asks first when it would drop edits the library copy does not have. */
  const leave = (go: () => void) => {
    setLeaveError(null);
    if (unsaved) setLeaving({ go });
    else go();
  };
  const saveAndLeave = () => {
    const at = layout.saved;
    if (!at || !leaving) return;
    saveDesign(layout, sceneUrl, at.name, false).then(
      () => {
        setLeaving(null);
        leaving.go();
      },
      (err) => setLeaveError(ipcErrorMessage(err)),
    );
  };
  const revertToSaved = () => {
    const at = layout.saved;
    if (!at) return;
    void loadDesign(at.id, at.name).then(
      (stored) => {
        setLayout(() => stored);
        setSelId(null);
        setMultiSel([]);
      },
      () => undefined,
    );
  };

  const goHome = () => {
    setSelId(null);
    setMultiSel([]);
    setView('home');
  };

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

  const api: StudioApi = {
    layout,
    selId,
    sceneReady,
    standalone,
    select: (id) => {
      setMultiSel([]);
      setSelId(id);
    },
    selectMany: (ids) => {
      setSelId(ids.length === 1 ? ids[0] : null);
      setMultiSel(ids.length > 1 ? ids : []);
    },
    openMenu: setMenu,
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
    toggleLock,
    addButton,
    selIds,
    group,
    ungroup,
    move,
    moveEnd,
    chooseTemplate: (t) => leave(() => chooseTemplate(t)),
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
  // Goes up when ⌘S needs a name first: a design page design that was never saved.
  const [askNameTick, setAskNameTick] = useState(0);
  const saveShortcutRef = useRef<() => void>(() => undefined);
  saveShortcutRef.current = () => {
    if (standalone && !layout.saved) {
      setAskNameTick((t) => t + 1);
      return;
    }
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
        if (design)
          setLayout((l) => (l.saved ? { ...l, saved: { id: l.saved.id, name: l.saved.name } } : l));
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
      } else if (key === 'delete' || key === 'backspace') remove();
      else if (key.startsWith('arrow') && (multiSel.length > 0 || (selected && !selected.lock))) {
        const step = e.shiftKey ? 2 : 0.5;
        const dx = key === 'arrowright' ? step : key === 'arrowleft' ? -step : 0;
        const dy = key === 'arrowdown' ? step : key === 'arrowup' ? -step : 0;
        // A layer picked out of its group nudges with the group, like a drag.
        const ids =
          multiSel.length > 0 ? multiSel : selected ? groupMembers(layout.els, selected.id) : [];
        for (const id of ids) {
          const el = layout.els.find((e2) => e2.id === id);
          if (el && !el.lock) patch(id, { x: el.x + dx, y: el.y + dy });
        }
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
    // A layer picked out of its group with a double-click stays selected on its own for editing,
    // but still moves with its group: only Ungroup lets a piece move apart.
    const members = groupMembers(layout.els, el.id);
    const together =
      mode === 'move' && multiSel.includes(el.id) && multiSel.length > 1 ? multiSel : members;
    const pickedOut = selId === el.id && members.length > 1;
    if (mode === 'move' && together.length > 1 && !pickedOut) {
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
    if (isSlotImage(orig)) {
      const [lx, ly] = toLocal(dx, dy, orig.rot ?? 0);
      const p = slotPlacement(box, orig.ratio, orig);
      const [ox, oy] = [p.w - box.w, Math.max(0, p.h - box.h)];
      const [px, py] = [ox > 0 ? (box.x - p.x) / ox : 0.5, oy > 0 ? (box.y - p.y) / oy : 0];
      patch(drag.id, {
        pos: { x: ox > 0 ? clamp(px - lx / ox, 0, 1) : px, y: oy > 0 ? clamp(py - ly / oy, 0, 1) : py },
      });
      return;
    }
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
    if (drag.mode === 'scale' && drag.members && drag.handle) {
      const [dx, dy] = [(px * DRAW) / rect.width, (py * DRAWH) / rect.height];
      const { box } = drag;
      const next = resizeRect(box, 0, drag.handle, dx, dy, true, 12);
      const k = next.w / box.w;
      const moved = new Map(
        drag.members.map((m) => [
          m.id,
          scaleLayer(
            m,
            k,
            ((next.x + ((m.x / 100) * DRAW - box.x) * k) / DRAW) * 100,
            ((next.y + ((m.y / 100) * DRAWH - box.y) * k) / DRAWH) * 100,
          ),
        ]),
      );
      setLayout((l) => ({ ...l, els: l.els.map((e) => moved.get(e.id) ?? e) }));
      return;
    }
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
    let [dx, dy] = [(px / rect.width) * 100, (py / rect.height) * 100];
    const moving = drag.group ?? [{ id: drag.id, x: drag.orig.x, y: drag.orig.y }];
    // The moving box's edges and middle catch on the canvas middle, edges and safe
    // margin, on other layers, and on the grid when it's snapping. Cmd or Ctrl places freely.
    let caught: { x?: number; y?: number } = {};
    const boxes = moving.flatMap((m) => {
      const el = layout.els.find((x) => x.id === m.id);
      return el ? [layerBox({ ...el, x: m.x, y: m.y } as ICElement, layout, DRAW)] : [];
    });
    if (!(e.metaKey || e.ctrlKey) && boxes.length > 0) {
      // Canvas pixels to percent of the width, the unit guides are measured in.
      const u = 100 / DRAW;
      const H = (DRAWH / DRAW) * 100;
      const x0 = Math.min(...boxes.map((b) => b.x)) * u;
      const y0 = Math.min(...boxes.map((b) => b.y)) * u;
      const x1 = Math.max(...boxes.map((b) => b.x + b.w)) * u;
      const y1 = Math.max(...boxes.map((b) => b.y + b.h)) * u;
      const { xs, ys } = canvasLines(H);
      const ids = new Set(moving.map((m) => m.id));
      for (const o of layout.els) {
        if (ids.has(o.id) || !o.vis || isTexture(o)) continue;
        const b = layerBox(o, layout, DRAW);
        if (b.w * u > 90) continue;
        xs.push(b.x * u, (b.x + b.w / 2) * u, (b.x + b.w) * u);
        ys.push(b.y * u, (b.y + b.h / 2) * u, (b.y + b.h) * u);
      }
      if (layout.grid?.on && layout.grid.snap) {
        const g = gridSnapLines(layout.grid, H);
        xs.push(...g.xs);
        ys.push(...g.ys);
      }
      const nudge = snapBox({ x: x0 + dx, y: y0 + (dy * H) / 100, w: x1 - x0, h: y1 - y0 }, xs, ys);
      dx += nudge.dx;
      dy += (nudge.dy * 100) / H;
      caught = { x: nudge.x, y: nudge.y };
    }
    setGuides(caught);
    for (const t of moving) {
      patch(t.id, { x: clamp(t.x + dx, -20, 100), y: clamp(t.y + dy, -20, 100) });
    }
  };

  const dropOnStage = (e: ReactDragEvent) => {
    const raw = e.dataTransfer.getData(IC_ADD_MIME);
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const at = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    if (!raw && hasFiles(e)) {
      e.preventDefault();
      e.stopPropagation();
      void dropFiles(e.dataTransfer.files, at);
      return;
    }
    if (!raw) return;
    e.preventDefault();
    const item = JSON.parse(raw) as ICAddItem;
    if (item.kind === 'art') addArt(item.id, at);
    else if (item.kind === 'block') addBlock(item.id, at);
    else if (item.kind === 'button') addButton(at);
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
      href = await pngToPdf(
        await avatarCropPng(avatarEl.config, crop, {
          width,
          transparentBg: false,
          paint: (ctx, w, h) => drawBackground(ctx, layout, w, h),
        }),
      );
    } else {
      href = await avatarCropPng(avatarEl.config, crop, {
        width,
        format: format === 'jpeg' ? 'jpeg' : 'png',
        quality: quality / 100,
        transparentBg: transparent,
        paint: (ctx, w, h) => drawBackground(ctx, layout, w, h),
      });
    }
    const link = document.createElement('a');
    link.href = href;
    link.download = `avatar-${mode === 'avatar-pfp' ? 'pfp' : 'full-body'}.${format === 'jpeg' ? 'jpg' : format}`;
    link.click();
  };

  // Rendered without the design's own background, so the preview shows what the file holds.
  const previewAvatar = useCallback(
    (mode: 'avatar-pfp' | 'avatar-full') =>
      avatarEl
        ? avatarCropPng(
            avatarEl.config,
            mode === 'avatar-pfp' ? AVATAR_PFP_CROP : AVATAR_FULL_CROP,
            {
              width: 576,
              format: 'png',
              transparentBg: exportSettings.transparent,
              paint: (ctx, w, h) => drawBackground(ctx, layout, w, h),
            },
          )
        : Promise.reject(new Error('No avatar')),
    [avatarEl, exportSettings.transparent, layout],
  );

  const stageClick = () => {
    setMultiSel([]);
    setSelId(layout.scene.on ? 'scene' : 'bg');
  };

  const stagePointerDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    marqueeRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      dragging: false,
      inside: stageRef.current?.contains(e.target as Node) ?? false,
    };
  };

  const stagePointerMove = (e: ReactPointerEvent) => {
    const m = marqueeRef.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!m || !rect) return;
    if (!m.dragging && Math.hypot(e.clientX - m.sx, e.clientY - m.sy) < 4) return;
    m.dragging = true;
    // In percent of the canvas, running past it when the drag starts or ends outside.
    const x1 = ((Math.min(m.sx, e.clientX) - rect.left) / rect.width) * 100;
    const y1 = ((Math.min(m.sy, e.clientY) - rect.top) / rect.height) * 100;
    const x2 = ((Math.max(m.sx, e.clientX) - rect.left) / rect.width) * 100;
    const y2 = ((Math.max(m.sy, e.clientY) - rect.top) / rect.height) * 100;
    setMarquee({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
  };

  // A drag over empty canvas, or the space around it, selects every layer it touches, so Delete and
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
    } else if (m.inside) {
      stageClick();
    } else {
      // A click around the canvas clears the selection.
      setSelId(null);
      setMultiSel([]);
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
      data-design-studio
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-canvas-border bg-canvas-muted font-mono text-canvas-foreground ${
        standalone ? '' : 'max-h-[840px] max-w-[1320px] shadow-2xl'
      }`}
    >
      <div className="relative flex items-center gap-2.5 border-b border-canvas-border px-4 py-3">
        {/* The design's size, in the middle of the bar so it is at hand from every tab. */}
        {view === 'editor' && !previewOpen && (
          // Above the canvas below the bar, so the custom size box that drops from it can be used.
          <div className="absolute left-1/2 z-40 -translate-x-1/2">
            <FormatChips api={api} />
          </div>
        )}
        <div className="flex h-7 items-center text-sm font-semibold">Design Studio</div>
        <div className="text-[12px] text-canvas-muted-foreground">
          {view === 'home' ? 'Home' : layout.templateId === 'blank' ? 'Blank' : template.title}
        </div>
        {genBusy && (
          <div className="ml-2 flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 py-0.5 pl-2.5 pr-1 text-[11.5px] text-emerald-300">
            <Loader2 className="size-3 animate-spin" />
            {genBusy === 'new' ? 'Generating AI element…' : 'Regenerating…'}
            <button
              type="button"
              onClick={stopElement}
              className="rounded-md px-2 py-0.5 text-canvas-foreground hover:bg-canvas-muted"
            >
              Stop
            </button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            // A saved design goes back to its saved copy, anything else to its template.
            onClick={layout.saved ? revertToSaved : resetTemplate}
            disabled={!!layout.saved && !unsaved}
            title={layout.saved ? 'Revert to saved' : 'Reset template to its original design'}
            aria-label={layout.saved ? 'Revert to saved' : 'Reset template'}
            className="rounded p-1 text-canvas-muted-foreground hover:text-canvas-foreground disabled:cursor-not-allowed disabled:opacity-40"
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
          <IconButton
            onClick={finish}
            aria-label="Close"
          >
            <X className="size-4" />
          </IconButton>
        )}
      </div>


      <div
        className={`grid min-h-0 flex-1 ${view === 'home' ? 'grid-cols-[64px_1fr]' : panelOpen ? 'grid-cols-[64px_300px_1fr_272px]' : 'grid-cols-[64px_1fr_272px]'}`}
      >
        <nav data-studio-rail className="flex flex-col items-center gap-1.5 border-r border-canvas-border bg-canvas-raised py-3">
          {standalone && (
            <>
              <CreateButton onCreate={(size) => leave(() => newDesign(size))} openTick={createTick} />
              <RailButton on={view === 'home'} tint="home" Icon={House} label="Home" onClick={goHome} />
            </>
          )}
          {tabs.map(({ key, label, Icon }) => {
            // The tab stays lit with its panel hidden: it is still the one a second click brings back.
            const on = view === 'editor' && tab === key;
            return (
              <RailButton
                key={key}
                on={on}
                tint={key}
                Icon={Icon}
                label={label}
                title={on && panelOpen ? `Hide ${label}` : label}
                onClick={() => {
                  const same = view === 'editor' && tab === key;
                  setPanelOpen(same ? !panelOpen : true);
                  setTab(key);
                  setView('editor');
                }}
              />
            );
          })}
        </nav>

        {view === 'home' ? (
          <StudioHome
            current={layout}
            onOpenCurrent={() => setView('editor')}
            onOpenDesign={(next) => leave(() => startDesign(next))}
            onUseTemplate={(t) => leave(() => fromTemplate(t))}
            onRenamed={(id, name) =>
              setLayout((l) => (l.saved?.id === id ? { ...l, saved: { ...l.saved, name } } : l))
            }
            brand={homeBrand}
            onBrand={setHomeBrand}
            onNew={() => setCreateTick((t) => t + 1)}
          />
        ) : (
        <>
        {panelOpen && (
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
        )}

        <main className="flex min-h-0 min-w-0 flex-col bg-canvas">
          <div className="relative flex min-h-0 flex-1">
            {/* A playing video has no zoom control over it. */}
            <div
              className={`absolute bottom-3 right-3 z-20 items-center gap-0.5 rounded-lg border border-canvas-border bg-canvas-raised p-0.5 text-[11px] text-canvas-muted-foreground shadow-lg ${playing ? 'hidden' : 'flex'}`}
            >
              <button
                type="button"
                title="Zoom out (Cmd -)"
                aria-label="Zoom out"
                disabled={zoom <= ZOOMS[0]}
                onClick={() => setZoom((z) => nextZoom(z, -1))}
                className="rounded-md p-1.5 hover:bg-canvas-muted hover:text-canvas-foreground disabled:opacity-30"
              >
                <Minus className="size-3.5" />
              </button>
              <button
                type="button"
                title="Fit to the canvas area (Cmd 0)"
                onClick={() => setZoom(1)}
                className="min-w-12 rounded-md px-1.5 py-1 text-center tabular-nums hover:bg-canvas-muted hover:text-canvas-foreground"
              >
                {Math.abs(zoom - 1) < 0.01 ? 'Fit' : `${Math.round(zoom * 100)}%`}
              </button>
              <button
                type="button"
                title="Zoom in (Cmd +)"
                aria-label="Zoom in"
                disabled={zoom >= ZOOMS[ZOOMS.length - 1]}
                onClick={() => setZoom((z) => nextZoom(z, 1))}
                className="rounded-md p-1.5 hover:bg-canvas-muted hover:text-canvas-foreground disabled:opacity-30"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-to-select starts anywhere around the canvas too */}
            <div
              ref={holderRef}
              // Files dropped beside the canvas still come in, centered.
              onDragOver={(e) => {
                if (hasFiles(e)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }
              }}
              onDrop={(e) => {
                if (!hasFiles(e)) return;
                e.preventDefault();
                void dropFiles(e.dataTransfer.files);
              }}
              onPointerDown={stagePointerDown}
              onPointerMove={stagePointerMove}
              onPointerUp={stagePointerUp}
              // Margin auto on the canvas centers it and still lets a zoomed-in canvas scroll to every edge.
              className="flex min-h-0 flex-1 overflow-auto p-4"
              // The same dot grid as the Playground's canvas: 1px dots every 22px.
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22'%3E%3Ccircle cx='11' cy='11' r='0.5' fill='%2322262b'/%3E%3C/svg%3E")`,
                backgroundSize: '22px 22px',
              }}
            >
              {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target for elements dragged from the Elements tab */}
              <div
                ref={stageRef}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(IC_ADD_MIME) || hasFiles(e)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                  }
                }}
                onDrop={dropOnStage}
                // Not clipped, so a layer bigger than the canvas still shows its box and handles around it.
                // While the video plays, the design's own boxes and handles stay out of the picture.
                className={`relative m-auto shrink-0 rounded-lg border shadow-lg ${selId === 'bg' || selId === 'scene' ? 'border-emerald-400' : 'border-canvas-border'} ${playing ? '[&>*:not(canvas,button)]:hidden' : ''}`}
                style={{
                  width: shown,
                  height: shown * rh,
                  backgroundColor: '#1c2027',
                  backgroundImage:
                    'conic-gradient(#2a2f37 25%, transparent 0 50%, #2a2f37 0 75%, transparent 0)',
                  backgroundSize: '20px 20px',
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={res}
                  height={Math.round(res * rh)}
                  className="absolute inset-0 size-full rounded-lg"
                />
                {motionOpen && motionScene && (
                  <MotionStage
                    scene={motionScene}
                    layout={layout}
                    player={player}
                    silent={previewOpen}
                  />
                )}
                {videoOpen && story && (
                  <VideoStage story={story} player={player} rh={rh} silent={previewOpen} />
                )}
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
                          // A right-click only picks, so the menu that follows acts on this layer.
                          if (ev.button === 2) {
                            ev.stopPropagation();
                            if (!selIds.includes(e.id)) {
                              const members = groupMembers(layout.els, e.id);
                              setSelId(members.length > 1 ? null : e.id);
                              setMultiSel(members.length > 1 ? members : []);
                            }
                            return;
                          }
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
                          setGuides({});
                        }}
                        onContextMenu={(ev) => {
                          ev.preventDefault();
                          setMenu({ x: ev.clientX, y: ev.clientY });
                        }}
                        onDoubleClick={() => {
                          // The first double-click on a group steps inside it, to this one layer.
                          if (e.groupId && selId !== e.id) {
                            setMultiSel([]);
                            setSelId(e.id);
                            return;
                          }
                          if (e.t === 'text' || e.t === 'pill')
                            setEditing({ id: e.id, value: e.text });
                          else if (isCroppable(e)) setCropId(e.id);
                          // A code window or chart opens its editor, like its toolbar button.
                          else if (e.t === 'art' && (isCode(e.art) || isChart(e.art)))
                            setEditId(e.id);
                        }}
                        className={`absolute ${passThrough ? 'pointer-events-none' : 'cursor-grab'} ${on ? 'outline outline-1 outline-emerald-400' : 'hover:outline hover:outline-1 hover:outline-white/40'}`}
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
                {layout.grid?.on && <GridOverlay grid={layout.grid} H={(DRAWH / DRAW) * 100} />}
                {(guides.x !== undefined || guides.y !== undefined) && (
                  <GuideLines {...guides} H={(DRAWH / DRAW) * 100} />
                )}
                {multiSel.length > 1 &&
                  !marquee &&
                  (() => {
                    const members = layout.els.filter(
                      (e) => multiSel.includes(e.id) && e.vis && !e.lock,
                    );
                    if (members.length < 2) return null;
                    const boxes = members.map((e) => layerBox(e, layout, DRAW));
                    const x0 = Math.min(...boxes.map((b) => b.x));
                    const y0 = Math.min(...boxes.map((b) => b.y));
                    const x1 = Math.max(...boxes.map((b) => b.x + b.w));
                    const y1 = Math.max(...boxes.map((b) => b.y + b.h));
                    const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
                    const topPct = (box.y / DRAWH) * 100;
                    const above = topPct > 8;
                    // The whole selection scales from a corner, like one picture.
                    return (
                      <>
                        <div
                          className="pointer-events-none absolute outline outline-1 outline-emerald-400"
                          style={{
                            left: `${(box.x / DRAW) * 100}%`,
                            top: `${(box.y / DRAWH) * 100}%`,
                            width: `${(box.w / DRAW) * 100}%`,
                            height: `${(box.h / DRAWH) * 100}%`,
                          }}
                        >
                          {CORNERS.map((h) => (
                            <i
                              key={h}
                              onPointerDown={(ev) => {
                                ev.stopPropagation();
                                ev.currentTarget.setPointerCapture(ev.pointerId);
                                dragRef.current = {
                                  id: members[0].id,
                                  mode: 'scale',
                                  handle: h,
                                  box,
                                  sx: ev.clientX,
                                  sy: ev.clientY,
                                  orig: members[0],
                                  members,
                                };
                              }}
                              onPointerMove={pointerMove}
                              onPointerUp={() => {
                                dragRef.current = null;
                                setGuides({});
                              }}
                              className="pointer-events-auto absolute block size-2.5 rounded-[2px] border-2 border-emerald-400 bg-canvas"
                              style={{
                                left: `${HANDLE_AT[h][0] * 100}%`,
                                top: `${HANDLE_AT[h][1] * 100}%`,
                                transform: 'translate(-50%, -50%)',
                                cursor: `${h}-resize`,
                              }}
                            />
                          ))}
                        </div>
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
                      </>
                    );
                  })()}
                {marquee && (
                  <div
                    className="pointer-events-none absolute border border-emerald-400 bg-emerald-400/10"
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
                                setGuides({});
                              }}
                              className="pointer-events-auto absolute block size-2.5 rounded-[2px] border-2 border-emerald-400 bg-canvas"
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
                                setGuides({});
                              }}
                              className="pointer-events-auto absolute left-1/2 flex size-7 cursor-grab items-center justify-center rounded-md border border-canvas-border bg-canvas text-canvas-foreground shadow-md hover:bg-canvas-muted active:cursor-grabbing"
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
                    const slot = isSlotImage(cropEl) ? slotPlacement(box, cropEl.ratio, cropEl) : null;
                    const pic: CSSProperties = {
                      position: 'absolute',
                      maxWidth: 'none',
                      ...(slot
                        ? {
                            left: `${((slot.x - box.x) / box.w) * 100}%`,
                            top: `${((slot.y - box.y) / box.h) * 100}%`,
                            width: `${(slot.w / box.w) * 100}%`,
                            height: `${(slot.h / box.h) * 100}%`,
                          }
                        : {
                            left: `${(-c.x / c.w) * 100}%`,
                            top: `${(-c.y / c.h) * 100}%`,
                            width: `${100 / c.w}%`,
                            height: `${100 / c.h}%`,
                          }),
                    };
                    const release = () => {
                      dragRef.current = null;
                      setGuides({});
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
                          className="pointer-events-auto absolute inset-0 cursor-move overflow-hidden outline outline-2 outline-emerald-400"
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
                        {/* A slot's frame is set by the template, so only its picture moves. */}
                        {(slot ? [] : ALL_HANDLES).map((h) => (
                          <i
                            key={h}
                            onPointerDown={(ev) => pointerDown(ev, cropEl, 'crop', h)}
                            onPointerMove={pointerMove}
                            onPointerUp={release}
                            className="pointer-events-auto absolute block size-2.5 rounded-[2px] border-2 border-emerald-400 bg-emerald-400"
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
              // The video belongs to the whole thread, so it stays as the open page changes.
              setLayout((l) => ({ ...goToPage(l, i), video: l.video }));
              setSelId(null);
            }}
            onAdd={(kind) => {
              setLayout((l) => ({ ...addPage(l, kind), video: l.video }));
              setSelId(null);
            }}
            onRemove={() => {
              setLayout((l) => ({ ...removePage(l), video: l.video }));
              setSelId(null);
            }}
            onMove={(by) => setLayout((l) => movePage(l, by))}
          />
          {videoOpen && story && (
            <SlideStrip story={story} player={player} slide={slide} onSlide={setSlide} />
          )}
          {motionOpen && (
            <MotionTimeline
              layout={layout}
              scene={motionScene}
              player={player}
              onMotion={(patch) => setLayout((l) => ({ ...l, motion: { ...motionOf(l), ...patch } }))}
            />
          )}
        </main>
        <Inspector
          api={api}
          motion={{
            open: motionOpen,
            setOpen: (open) => {
              setMotionOpen(open);
              if (open) setVideoOpen(false);
              player.t = 0;
              player.playing = true;
            },
            panel: <MotionPanel api={api} sceneUrl={sceneUrl} player={player} />,
          }}
          video={{
            open: videoOpen,
            setOpen: (open) => {
              setVideoOpen(open);
              if (open) setMotionOpen(false);
              player.t = 0;
              player.playing = true;
            },
            panel: (
              <VideoPanel api={api} story={story} player={player} slide={slide} onSlide={setSlide} />
            ),
          }}
        />
        </>
        )}
      </div>

      {view === 'editor' && (
      <div className="flex items-center gap-2 border-t border-canvas-border px-4 py-2.5">
        <span className="flex-1" />
        <SaveDesignButton
          savedTick={savedTick}
          askNameTick={askNameTick}
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
          onClick={() => {
            // Export starts on what the open tab plays: the design's clip or its longer video.
            if (motionOpen) setExportSettings((s) => ({ ...s, format: 'mp4' }));
            if (videoOpen) setExportSettings((s) => ({ ...s, format: 'video' }));
            setPreviewOpen(true);
          }}
          disabled={layout.scene.on && !sceneReady}
          title={
            layout.scene.on && !sceneReady
              ? 'Run the workflow once to paint the AI background'
              : 'Preview every size and download them'
          }
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-[12.5px] font-medium text-fd-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
      )}
      {menu && <SelectionMenu api={api} at={menu} onClose={() => setMenu(null)} />}
      {leaving && layout.saved && (
        <Overlay
          onClose={() => setLeaving(null)}
          className="z-[90] bg-black/40 p-0"
          role="presentation"
          onKeyDown={(e) => e.key === 'Escape' && setLeaving(null)}
        >
          <div
            role="alertdialog"
            aria-labelledby="design-unsaved-title"
            className="w-[380px] rounded-xl border border-canvas-border bg-canvas p-4 shadow-2xl"
          >
            <div id="design-unsaved-title" className="text-[13px] font-semibold text-canvas-foreground">
              Save changes to “{layout.saved.name}”?
            </div>
            {leaveError && <div className="mt-1.5 text-xs text-red-300">{leaveError}</div>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLeaving(null)}
                className="rounded-md border border-canvas-border px-3 py-1.5 text-xs text-canvas-foreground hover:bg-canvas-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeaving(null);
                  leaving.go();
                }}
                className="rounded-md border border-canvas-border px-3 py-1.5 text-xs text-red-300 hover:bg-canvas-muted"
              >
                Discard
              </button>
              <button
                type="button"
                // biome-ignore lint/a11y/noAutofocus: the safe choice takes focus, so Enter never drops the edits
                autoFocus
                onClick={saveAndLeave}
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
              >
                Save
              </button>
            </div>
          </div>
        </Overlay>
      )}
      {previewOpen && (
        <ExportSheet
          layout={layout}
          template={template}
          sceneUrl={sceneUrl}
          settings={exportSettings}
          onSettings={setExportSettings}
          onAvatarExport={avatarEl ? exportAvatar : undefined}
          onAvatarPreview={avatarEl ? previewAvatar : undefined}
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
    <Overlay onClose={finish} className="z-[55] bg-black/50">
      {studio}
    </Overlay>,
    document.body,
  );
}
