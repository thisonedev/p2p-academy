'use client';

import {
  LayoutTemplate,
  Shapes,
  UserRound,
  House,
  Minus,
  Plus,
  RotateCw,
} from 'lucide-react';
import {
  useCallback,
  useState,
  useRef,
  useMemo,
  useEffect,
  useLayoutEffect,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { ANNOUNCE_BRANDS } from '../templates/announce.js';
import { isFrameArt } from '../art/art-web3.js';
import { isChart } from '../art/charts.js';
import { isCode } from '../art/code.js';
import { saveDesign } from './designs.js';
import { loadFonts } from '../render/fonts.js';
import { CreateButton, StudioHome } from './home.js';
import { useHistory } from './history.js';
import {
  type ICLayout,
  parseLayout,
  upgradeIds,
  fitPatterns,
  cleanSession,
  reconnectWires,
  type ICElement,
  parseSceneCache,
  sceneKey,
  ratioHeight,
  type ICAvatarEl,
  isCroppable,
  FULL_CROP,
  isSlotImage,
} from '../render/layout.js';
import { PageStrip } from './pages.js';
import { AvatarEditor } from '../panels/avatar-editor.js';
import { EditDrawer } from '../panels/edit-drawer.js';
import { ElementsPanel } from '../panels/elements-panel.js';
import { type Selection, type StudioApi, IC_ADD_MIME } from '../panels/studio-api.js';
import { MiniBar, SelectionMenu } from '../panels/selection-bars.js';
import { TemplatesPanel } from '../panels/templates-panel.js';
import { Inspector } from '../panels/inspector.js';
import { newMotionPlayer, useMotionScene, MotionStage, MotionPanel } from '../motion/motion-panel.js';
import { MotionTimeline } from '../motion/motion-timeline.js';
import { SHARP } from '../motion/motion.js';
import { motionOf } from '../video/films.js';
import { type ICExportSettings, ExportSheet } from '../panels/previews.js';
import {
  type ICBox,
  type ICImages,
  loadImages,
  drawLayout,
  layerBox,
  slotPlacement,
} from '../render/render.js';
import {
  CORNERS,
  HANDLE_AT,
  ALL_HANDLES,
} from '../render/resize.js';
import { defaultLayout, ALL_TEMPLATES, findTemplate } from '../templates/templates.js';
import { useDesignOnly, useStory } from '../video/story.js';
import { VideoStage, SlideStrip } from '../video/video-stage.js';
import { VideoPanel } from '../video/video-panel.js';
import { goToPage, addPage, removePage, movePage } from '../templates/thread.js';
import { Overlay } from '../../ui/overlay.js';
import {
  DRAW,
  ZOOMS,
  groupMembers,
  handlesFor,
  nextZoom,
  signature,
  type DragState,
  type PickTarget,
} from './studio-helpers.js';
import { GridOverlay, GuideLines, RailButton } from './studio-parts.js';
import { useStagePointer } from './use-stage-pointer.js';
import { useStudioFiles } from './use-studio-files.js';
import { useDesignLifecycle } from './use-design-lifecycle.js';
import { useSelectionActions } from './use-selection-actions.js';
import { useBrandAndGenerate } from './use-brand-and-generate.js';
import { useAddLayers } from './use-add-layers.js';
import { LeaveDialog } from './leave-dialog.js';
import { StudioBottomBar } from './studio-bottom-bar.js';
import { StudioTopBar } from './studio-top-bar.js';

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

  const {
    insert,
    copyOf,
    addText,
    addButton,
    addShape,
    addLine,
    cutout,
    addArt,
    setPartnerColor,
    swapBrands,
    clearPartner,
    addBlock,
    addAvatar,
  } = useAddLayers({
    setLayout,
    setSelId,
    layout,
    DRAWH,
    setCutBusy,
    patch,
    setMultiSel,
    creatingAvatarRef,
  });
  useEffect(() => {
    if (layout.els.some((e) => e.t === 'avatar')) creatingAvatarRef.current = false;
  }, [layout.els]);

  // A brand is one choice everywhere: its own version of the current template when there is one,
  // otherwise its kit on the design. Picking it drops whatever kit was applied on top before.
  const {
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
  } = useBrandAndGenerate({
    setLayout,
    insert,
    layout,
    patch,
  });

  // The layers the bar, the right-click menu and the shortcuts act on: a group or pick, or one layer.
  const {
    selIds,
    duplicate,
    remove,
    toggleLock,
    group,
    ungroup,
    move,
    moveEnd,
  } = useSelectionActions({
    multiSel,
    selected,
    insert,
    copyOf,
    layout,
    setLayout,
    setSelId,
    setMultiSel,
    selId,
  });

  // Reset starts this template over; the drafts kept for other templates stay.
  const {
    resetTemplate,
    chooseTemplate,
    startDesign,
    newDesign,
    fromTemplate,
    leaving,
    setLeaving,
    leaveError,
    unsaved,
    leave,
    saveAndLeave,
    revertToSaved,
    goHome,
  } = useDesignLifecycle({
    setLayout,
    setSelId,
    setMultiSel,
    setTab,
    setView,
    homeBrand,
    layout,
    sceneUrl,
  });

  const {
    pickImage,
    onFile,
    dropFiles,
    hasFiles,
  } = useStudioFiles({
    pickRef,
    fileRef,
    setLayout,
    setSelId,
    selected,
    patch,
    layout,
    insert,
  });

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

  const {
    pointerDown,
    selectBehind,
    pointerMove,
    dropOnStage,
    exportAvatar,
    previewAvatar,
    stagePointerDown,
    stagePointerMove,
    stagePointerUp,
  } = useStagePointer({
    multiSel,
    selId,
    setSelId,
    setMultiSel,
    layout,
    stageRef,
    DRAWH,
    dragRef,
    patch,
    setLayout,
    setGuides,
    hasFiles,
    dropFiles,
    addArt,
    addBlock,
    addButton,
    addShape,
    addLine,
    addAvatar,
    addText,
    avatarEl,
    exportSettings,
    marqueeRef,
    setMarquee,
    marquee,
  });

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
      <StudioTopBar
        view={view}
        previewOpen={previewOpen}
        api={api}
        layout={layout}
        template={template}
        genBusy={genBusy}
        stopElement={stopElement}
        revertToSaved={revertToSaved}
        resetTemplate={resetTemplate}
        unsaved={unsaved}
        undo={undo}
        canUndo={canUndo}
        redo={redo}
        canRedo={canRedo}
        standalone={standalone}
        finish={finish}
      />


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
                <div className="flex flex-col items-center gap-3 py-10 text-center text-label text-canvas-muted-foreground">
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
              className={`absolute bottom-3 right-3 z-20 items-center gap-0.5 rounded-lg border border-canvas-border bg-canvas-raised p-0.5 text-caption text-canvas-muted-foreground shadow-lg ${playing ? 'hidden' : 'flex'}`}
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
                className={`relative m-auto shrink-0 rounded-lg border shadow-lg ${selId === 'bg' || selId === 'scene' ? 'border-primary' : 'border-canvas-border'} ${playing ? '[&>*:not(canvas,button)]:hidden' : ''}`}
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
                        className={`absolute ${passThrough ? 'pointer-events-none' : 'cursor-grab'} ${on ? 'outline outline-1 outline-primary' : 'hover:outline hover:outline-1 hover:outline-white/40'}`}
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
                          className="pointer-events-none absolute outline outline-1 outline-primary"
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
                              className="pointer-events-auto absolute block size-2.5 rounded-[2px] border-2 border-primary bg-canvas"
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
                    className="pointer-events-none absolute border border-primary bg-primary/10"
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
                              className="pointer-events-auto absolute block size-2.5 rounded-[2px] border-2 border-primary bg-canvas"
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
                          className="pointer-events-auto absolute inset-0 cursor-move overflow-hidden outline outline-2 outline-primary"
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
                            className="pointer-events-auto absolute block size-2.5 rounded-[2px] border-2 border-primary bg-primary"
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
                        className="absolute z-10 resize-none rounded border border-primary/60 bg-canvas/95 p-1 text-label text-canvas-foreground focus:outline-none"
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
      <StudioBottomBar
        savedTick={savedTick}
        askNameTick={askNameTick}
        layout={layout}
        sceneUrl={sceneUrl}
        setLayout={setLayout}
        motionOpen={motionOpen}
        setExportSettings={setExportSettings}
        videoOpen={videoOpen}
        setPreviewOpen={setPreviewOpen}
        sceneReady={sceneReady}
        standalone={standalone}
        finish={finish}
      />
      )}
      {menu && <SelectionMenu api={api} at={menu} onClose={() => setMenu(null)} />}
      {leaving && layout.saved && (
        <LeaveDialog
          setLeaving={setLeaving}
          layout={layout}
          leaveError={leaveError}
          leaving={leaving}
          saveAndLeave={saveAndLeave}
        />
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
    // Above the playground config popup (z-modal) and below dropdown menus (z-popover).
    <Overlay onClose={finish} className="z-modal-raised">
      {studio}
    </Overlay>,
    document.body,
  );
}
