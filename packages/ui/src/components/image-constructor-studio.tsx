'use client';

import { Layers, LayoutTemplate, Palette, Redo2, RotateCcw, Shapes, Undo2, X } from 'lucide-react';
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
import { type ICCutout, removeBackground } from './image-constructor-cutout.js';
import { loadFonts } from './image-constructor-fonts.js';
import { useHistory } from './image-constructor-history.js';
import {
  applyPalette,
  FIGURE_MIN,
  FULL_CROP,
  figureBackdrop,
  IC_OUTPUT_SIZE,
  type ICCrop,
  type ICElement,
  type ICLayout,
  type ICRatio,
  type ICTemplate,
  isCroppable,
  layoutFromTemplate,
  newElementId,
  paletteRoles,
  parseLayout,
  parseSceneCache,
  ratioHeight,
  resetPalette,
  sceneKey,
} from './image-constructor-layout.js';
import {
  EditDrawer,
  ElementsPanel,
  IC_ADD_MIME,
  type ICAddItem,
  type ICPoint,
  MiniBar,
  PalettesPanel,
  PromptBlock,
  type Selection,
  type StudioApi,
  TemplatesPanel,
  Toolbar,
} from './image-constructor-panels.js';
import {
  composeLayout,
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
import { defaultLayout, findTemplate } from './image-constructor-templates.js';

// The canvas is drawn at a fixed size and scaled by CSS, so dragging works in percentages.
const DRAW = 1080;
const MAX_UPLOAD_SIDE = 1600;

type PickTarget = 'add' | 'layer' | 'subject' | 'scene';

interface DragState {
  id: string;
  mode: 'move' | 'resize' | 'crop' | 'pan';
  handle?: ICHandle;
  /** The element's box in canvas pixels when the drag began. */
  box: ICRect;
  sx: number;
  sy: number;
  orig: ICElement;
}

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
async function readImage(file: File): Promise<{ name: string; url: string; ratio: number }> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('That file is not an image.'));
    el.src = raw;
  });
  const ratio = img.naturalWidth / img.naturalHeight;
  const scale = Math.min(1, MAX_UPLOAD_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1) return { name: file.name, url: raw, ratio };
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { name: file.name, url: canvas.toDataURL('image/png'), ratio };
}

export interface ImageConstructorStudioProps {
  layoutRaw: string | undefined;
  sceneCacheRaw: string | undefined;
  onSave: (layout: string) => void;
  onClose: () => void;
}

export function ImageConstructorStudio({
  layoutRaw,
  sceneCacheRaw,
  onSave,
  onClose,
}: ImageConstructorStudioProps) {
  const {
    value: layout,
    set: setLayout,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<ICLayout>(() => parseLayout(layoutRaw) ?? defaultLayout());
  const [selId, setSelId] = useState<Selection>(null);
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<ICBox | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [tab, setTab] = useState<'templates' | 'palettes' | 'elements'>('elements');
  const [images, setImages] = useState<ICImages>({ scene: null, subject: null, layers: new Map() });
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [side, setSide] = useState(480);
  const [fontsReady, setFontsReady] = useState(false);
  const [cutBusy, setCutBusy] = useState<string | null>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<PickTarget>('add');
  const dragRef = useRef<DragState | null>(null);
  const clipRef = useRef<ICElement | null>(null);
  const marqueeRef = useRef<{ sx: number; sy: number; dragging: boolean } | null>(null);

  const cache = useMemo(() => parseSceneCache(sceneCacheRaw), [sceneCacheRaw]);
  const sceneUrl = cache && cache.key === sceneKey(layout) ? cache.url : null;
  const sceneReady = Boolean(sceneUrl || layout.scene.upload);
  const template = findTemplate(layout.templateId);
  const rh = ratioHeight(layout.ratio);
  const DRAWH = DRAW * rh;

  const imageKey = [
    signature(layout.subject.url),
    signature(layout.scene.upload?.url),
    signature(sceneUrl ?? undefined),
    ...layout.els.map((e) => {
      if (e.t === 'image') return `${e.id}${signature(e.url)}`;
      return e.t === 'art' ? `${e.id}${e.art}${JSON.stringify(e.colors)}` : '';
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
    if (ctx)
      drawLayout(ctx, layout, images, DRAW, {
        placeholder: { from: template.bg.from, to: template.bg.to },
      });
  }, [layout, images, template, fontsReady]);

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
      const ink = layout.els.find((e) => e.t === 'text')?.color ?? '#111111';
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
            }
          : {
              ...base,
              t: 'pill',
              w: 28,
              h: 8,
              text: 'New badge',
              size: 3.4,
              weight: 700,
              color: '#111111',
              fill: '#34d399',
              stroke: '',
            };
      insert(centered(el, at));
    },
    [centered, insert, layout.els],
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
        fill: '#e7ddd0',
        stroke: '',
        sw: 0.25,
        radius: 2,
        vis: true,
        user: true,
      };
      insert(centered(el, at));
    },
    [centered, insert],
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
      const roles = paletteRoles(layout.palette);
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

  const setPalette = useCallback(
    (id: string | null) => {
      setLayout((l) => (id ? applyPalette(l, id) : resetPalette(l, findTemplate(l.templateId))));
    },
    [setLayout],
  );

  const setRatio = useCallback(
    (ratio: ICRatio) => {
      setLayout((l) => {
        const template = findTemplate(l.templateId);
        const built = layoutFromTemplate(template, l, template, ratio);
        return {
          ...built,
          prompt: l.prompt,
          model: l.model,
          seed: l.seed,
          scene: l.scene,
          bg: l.bg,
          subject: l.subject,
        };
      });
    },
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

  const resetTemplate = useCallback(() => {
    setLayout((l) => layoutFromTemplate(findTemplate(l.templateId), undefined, undefined, l.ratio));
    setSelId(null);
  }, [setLayout]);

  const chooseTemplate = useCallback(
    (t: ICTemplate) => {
      setLayout((l) => layoutFromTemplate(t, l, findTemplate(l.templateId), l.ratio ?? t.ratio));
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
    const picked = await readImage(file).catch(() => null);
    if (!picked) return;
    const target = pickRef.current;
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
    setPalette,
    addArt,
    cutout,
    cutBusy,
    pickImage,
    duplicate,
    remove,
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
    try {
      onSave(JSON.stringify(layout));
    } finally {
      onClose();
    }
  }, [layout, onClose, onSave]);

  // Registered in the capture phase so Delete and the arrow keys never reach the workflow canvas behind the studio.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (key === 'escape') {
        if (cropId) setCropId(null);
        else if (editId) setEditId(null);
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
      else if (key === 'delete' || key === 'backspace') {
        if (multiSel.length > 0) {
          setLayout((l) => ({ ...l, els: l.els.filter((e) => !multiSel.includes(e.id)) }));
          setMultiSel([]);
        } else remove();
      } else if (key.startsWith('arrow') && selected && !selected.lock) {
        const step = e.shiftKey ? 2 : 0.5;
        patch(selected.id, {
          x: selected.x + (key === 'arrowright' ? step : key === 'arrowleft' ? -step : 0),
          y: selected.y + (key === 'arrowdown' ? step : key === 'arrowup' ? -step : 0),
        });
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
    finish,
    insert,
    multiSel,
    patch,
    redo,
    remove,
    selected,
    setLayout,
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
    setMultiSel([]);
    setSelId(el.id);
    if (el.lock) return;
    dragRef.current = {
      id: el.id,
      mode,
      handle,
      box: layerBox(el, layout, DRAW),
      sx: e.clientX,
      sy: e.clientY,
      orig: el,
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
    if (drag.mode !== 'move') {
      const [dx, dy] = [(px * DRAW) / rect.width, (py * DRAWH) / rect.height];
      if (drag.mode === 'resize') resizeBy(drag, dx, dy);
      else if (drag.mode === 'crop') cropBy(drag, dx, dy);
      else panBy(drag, dx, dy);
      return;
    }
    const { orig } = drag;
    patch(drag.id, {
      x: clamp(orig.x + (px / rect.width) * 100, -20, 100),
      y: clamp(orig.y + (py / rect.height) * 100, -20, 100),
    });
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
    else if (item.kind === 'rect' || item.kind === 'ellipse') addShape(item.kind, at);
    else if (item.kind === 'line') addLine(at);
    else addText(item.kind, at);
  };

  const exportPng = async () => {
    const link = document.createElement('a');
    link.href = await composeLayout(layout, sceneUrl, IC_OUTPUT_SIZE);
    link.download = `${template.title.toLowerCase().replace(/\s+/g, '-')}.png`;
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
        .filter((e) => e.vis)
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

  return createPortal(
    // z-55 sits above the config popup and below the select menus (z-60), so their options stay visible.
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking the dimmed backdrop closes the studio, as in the Export popup
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && finish()}
    >
      <div className="flex h-full max-h-[840px] w-full max-w-[1320px] flex-col overflow-hidden rounded-2xl border border-canvas-border bg-canvas-muted font-mono text-canvas-foreground shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-canvas-border px-4 py-3">
          <div className="flex size-7 items-center justify-center rounded-lg border border-indigo-300/40 bg-indigo-300/15 text-indigo-300">
            <Layers className="size-3.5" />
          </div>
          <div className="text-sm font-semibold">Compose image</div>
          <div className="text-[12px] text-canvas-muted-foreground">{template.title}</div>
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
          <button
            type="button"
            onClick={finish}
            aria-label="Close"
            className="text-canvas-muted-foreground hover:text-canvas-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[64px_300px_1fr]">
          <nav className="flex flex-col items-center gap-1 border-r border-canvas-border bg-canvas-raised py-2">
            {(
              [
                ['templates', 'Templates', LayoutTemplate],
                ['palettes', 'Palettes', Palette],
                ['elements', 'Elements', Shapes],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex w-[52px] flex-col items-center gap-1 rounded-lg py-2 text-[10px] ${tab === key ? 'bg-canvas-muted text-canvas-foreground' : 'text-canvas-muted-foreground hover:bg-canvas-muted hover:text-canvas-foreground'}`}
              >
                <Icon className="size-[18px]" />
                {label}
              </button>
            ))}
          </nav>

          <section className="min-h-0 overflow-y-auto border-r border-canvas-border bg-canvas p-3">
            <PromptBlock api={api} />
            {tab === 'templates' && <TemplatesPanel api={api} />}
            {tab === 'palettes' && <PalettesPanel api={api} />}
            {tab === 'elements' && <ElementsPanel api={api} />}
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
                  className={`relative shrink-0 overflow-hidden rounded-lg border shadow-lg ${selId === 'bg' || selId === 'scene' ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40' : 'border-canvas-border'}`}
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
                    className="absolute inset-0 size-full"
                  />
                  {layout.scene.on && !images.scene && (
                    <div className="pointer-events-none absolute bottom-2 right-2.5 text-[10px] text-white/50">
                      Placeholder · generated when the workflow runs
                    </div>
                  )}
                  {layout.els
                    .filter((e) => e.vis)
                    .map((e) => {
                      const box = layerBox(e, layout, DRAW);
                      const on = e.id === selId || multiSel.includes(e.id);
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
                          className={`absolute cursor-grab ${on ? 'outline outline-1 outline-fuchsia-400 ring-[3px] ring-fuchsia-400/40' : 'hover:outline hover:outline-1 hover:outline-white/40'}`}
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
                          <img
                            src={src}
                            alt=""
                            draggable={false}
                            style={{ ...pic, opacity: 0.35 }}
                          />
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
          </main>
        </div>

        <div className="flex items-center gap-2 border-t border-canvas-border px-4 py-2.5">
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => void exportPng()}
            disabled={layout.scene.on && !sceneReady}
            title={
              layout.scene.on && !sceneReady
                ? 'Run the workflow once to generate the scene'
                : undefined
            }
            className="rounded-md border border-canvas-border bg-canvas px-3 py-1.5 text-[12.5px] hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export PNG
          </button>
          <button
            type="button"
            onClick={finish}
            className="rounded-md border border-emerald-500/60 px-3.5 py-1.5 text-[12.5px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10"
          >
            Done
          </button>
        </div>
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
    </div>,
    document.body,
  );
}
