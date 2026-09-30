'use client';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Bold,
  BringToFront,
  ChevronDown,
  Copy,
  Crop,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Group,
  Italic,
  ImagePlus,
  ImageUp,
  Lock,
  Minus,
  Star,
  MoreHorizontal,
  Plus,
  RefreshCw,
  SendToBack,
  Trash2,
  Underline,
  Ungroup,
  Unlock,
  X,
  RotateCcw,
  WrapText,
} from 'lucide-react';
import Link from 'next/link';
import {
  type ComponentType,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ANNOUNCE_BRANDS, brandOfKit, layerBuilder } from './image-constructor-announce.js';
import { ART, artDef, artDefaults, artFor, artPalette, artUrl } from './image-constructor-art.js';
import { BLOCKS, blockStyle, fitBlockLayer, type ICBlock } from './image-constructor-blocks.js';
import {
  CODE_LANGS,
  type ICCodeData,
  type ICCodeLang,
  isCode,
  sampleCode,
} from './image-constructor-code.js';
import {
  type ICArtGroup,
  isFrameArt,
  isFrameVariant,
  WEB3_GROUPS,
} from './image-constructor-art-web3.js';
import {
  ACCESSORY_LABELS,
  BOTTOM as AVATAR_BOTTOM,
  SHOES as AVATAR_SHOES,
  TOP as AVATAR_TOP,
  avatarSetFor,
  EXPRESSIONS,
  type ICAvatarConfig,
  randomAvatarConfig,
} from './image-constructor-avatar.js';
import { DEFAULT_CUTOUT, type ICCutout } from './image-constructor-cutout.js';
import type { BrandKit } from './image-constructor-brand-kit.js';
import { BrandPicker } from './image-constructor-brand-picker.js';
import { LayersPanel } from './image-constructor-layers.js';
import { StudioPicker } from './image-constructor-picker.js';
import { MyDesignsSection } from './image-constructor-my-designs.js';
import { isFixedWeight } from './image-constructor-font-list.js';
import { cleanSlotName, isSlotName, listSlots, slotTypeOf } from './image-constructor-slots.js';
import { canGenerateElements } from './image-constructor-ai-element.js';
import { InfoHint } from './info-hint.js';
import {
  type ICModel,
  fitFigures,
  IC_FONT_LABELS,
  IC_FONT_STACKS,
  type ICArtEl,
  type ICAvatarEl,
  type ICElement,
  type ICFont,
  type ICLayout,
  type ICPill,
  type ICRatio,
  type ICTemplate,
  applyBrandKit,
  applyPalette,
  designRoles,
  isCroppable,
  layoutFromTemplate,
  defaultRatio,
  HERO_ART,
  isHero,
  isTexture,
  isTextureOn,
  restyleButton,
  setTexture,
  shuffleTexture,
  TEXTURES,
  swapArt,
  swapColors,
  orientationOf,
  IC_OUTPUT_SIZE,
  RATIO_DIMENSIONS,
  RATIO_LABELS,
  ratioHeight,
  supportedOrientations,
} from './image-constructor-layout.js';
import {
  CHART_KINDS,
  type ChartKind,
  chartCsv,
  columnInfo,
  type ICSummary,
  SUMMARIES,
  guessLabel,
  type ICColumnInfo,
  type ICTable,
  MAX_FILE_MB,
  MAX_POINTS,
  parseTable,
  tableToChart,
  type ICChartData,
  isChart,
  num,
  parseChartData,
  sampleData,
  short,
} from './image-constructor-charts.js';
import { BUTTON_LOOKS, type ButtonLook, nextLook } from './image-constructor-buttons.js';
import { DEFAULT_GRID, type ICGrid } from './image-constructor-grid.js';
import { patternId } from './image-constructor-patterns.js';
import { isScreen, otherScreen } from './image-constructor-screens.js';
import { PALETTES } from './image-constructor-palettes.js';
import { canvasHeight, composeLayout, layerBox } from './image-constructor-render.js';
import { parseRanked } from './image-constructor-bench.js';
import { ALL_TEMPLATES, findTemplate, TEMPLATE_PACKS } from './image-constructor-templates.js';
import {
  editList,
  itemTitles,
  type Kind,
  type ListEdit,
  parseChanges,
  parseProducts,
} from './image-constructor-updates.js';
import { IMAGE_MODEL_OPTIONS } from './playground-node-defs.js';
import { ThemedSelect } from './themed-select.js';

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

const dragItem = (item: ICAddItem) => ({
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

const LABEL =
  'mb-2 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70';
const INPUT =
  'w-full rounded-lg border border-canvas-border bg-canvas-muted px-2.5 py-2 text-[12.5px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60';
const SMALL =
  'rounded-md border border-canvas-border bg-canvas px-2.5 py-1 text-[12px] text-canvas-foreground hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-40';
const SWATCH =
  'h-5 min-w-0 cursor-pointer rounded border border-canvas-border hover:border-canvas-foreground';

/** Color pairs for gradient swatches: each neighbor pair of a palette, then first to last. */
const gradientPairs = (colors: string[]): [string, string][] => [
  ...colors.slice(1).map((c, i): [string, string] => [colors[i], c]),
  [colors[0], colors[colors.length - 1]],
];

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-2.5 flex rounded-md border border-canvas-border p-0.5 text-[11px]">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex-1 rounded px-2 py-1 ${value === key ? 'bg-canvas-muted text-canvas-foreground' : 'text-canvas-muted-foreground'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** The canvas size, in the brand bar. A custom size takes a width and height at the bottom of the list. */
export function SizePicker({ api }: { api: StudioApi }) {
  const { layout } = api;
  const template = findTemplate(layout.templateId);
  // A blank canvas has nothing that could conflict with any ratio, so every size stays enabled.
  const isBlank = layout.templateId === 'blank';
  const supported = supportedOrientations(template);
  const [w, setW] = useState(layout.customSize?.width ?? 1500);
  const [h, setH] = useState(layout.customSize?.height ?? 500);
  const ratio = layout.ratio ?? '1:1';
  const dims = (r: ICRatio) =>
    r === 'custom' ? layout.customSize : RATIO_DIMENSIONS[r as keyof typeof RATIO_DIMENSIONS];
  const item = (value: ICRatio, name: string) => {
    const d = dims(value);
    const ok = isBlank || supported.has(orientationOf(value));
    return {
      id: value,
      label: name,
      lead: <RatioIcon w={d?.width ?? 1} h={d?.height ?? 1} />,
      on: ratio === value,
      disabled: !ok,
      title: ok ? undefined : `${template.title} has no layout for this size yet`,
      onPick: () => api.setRatio(value),
    };
  };
  const current = dims(ratio);
  const size = (value: number) => Math.min(8000, Math.max(64, Math.round(value) || 64));
  return (
    <StudioPicker
      block
      label="Size"
      value={
        // Named sizes go by name; only a custom one needs its pixels spelled out.
        ratio === 'custom'
          ? `${current?.width ?? '?'}×${current?.height ?? '?'}`
          : (RATIO_LABELS[ratio] ?? ratio)
      }
      lead={<RatioIcon w={current?.width ?? 1} h={current?.height ?? 1} />}
      sections={[
        {
          items: [
            item('x-post', RATIO_LABELS['x-post']),
            item('linkedin-post', RATIO_LABELS['linkedin-post']),
            item('ig-post', RATIO_LABELS['ig-post']),
            item('story', RATIO_LABELS.story),
          ],
        },
        { title: 'Custom', items: [] },
      ]}
      footer={(close) => (
        <form
          className="flex items-center gap-1.5 px-3 pb-2 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            api.setCustomSize(size(w), size(h));
            close();
          }}
        >
          <input
            type="number"
            min={64}
            max={8000}
            value={w}
            onChange={(e) => setW(Number(e.target.value))}
            aria-label="Width"
            className={`${INPUT} py-1.5`}
          />
          <span className="text-canvas-muted-foreground">×</span>
          <input
            type="number"
            min={64}
            max={8000}
            value={h}
            onChange={(e) => setH(Number(e.target.value))}
            aria-label="Height"
            className={`${INPUT} py-1.5`}
          />
          <button type="submit" className={`${SMALL} shrink-0 py-1.5`}>
            Use
          </button>
        </form>
      )}
    />
  );
}

/** A small outline in a size's shape. */
function RatioIcon({ w, h }: { w: number; h: number }) {
  const k = 14 / Math.max(w, h);
  return (
    <span className="flex size-3.5 shrink-0 items-center justify-center">
      <span
        className="rounded-[2px] border-[1.5px] border-canvas-muted-foreground"
        style={{ width: Math.max(4, w * k), height: Math.max(4, h * k) }}
      />
    </span>
  );
}

/** A prompt-painted photo behind every layer, at the bottom of the Elements tab. */
function AIBackgroundBlock({ api }: { api: StudioApi }) {
  const { layout } = api;
  if (api.standalone) return null;
  return (
    <div className="mt-4 border-t border-canvas-border pt-3">
      <div className={LABEL}>
        AI background
        <InfoHint text="A photo painted from your prompt when the workflow runs. It sits behind every layer and covers the background color while on." />
      </div>
      {layout.scene.on ? (
        <>
          <textarea
            value={layout.prompt}
            placeholder="e.g. a warm studio wall with soft daylight"
            onChange={(e) => api.update((l) => ({ ...l, prompt: e.target.value }))}
            spellCheck={false}
            className={`${INPUT} min-h-[64px] resize-y leading-relaxed`}
          />
          <div className="mt-2">
            <ThemedSelect
              id="ic-model"
              value={layout.model}
              options={IMAGE_MODEL_OPTIONS}
              onChange={(v) => api.update((l) => ({ ...l, model: v as ICLayout['model'] }))}
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-canvas-muted-foreground">
            {layout.scene.upload
              ? 'Using your uploaded image.'
              : api.sceneReady
                ? 'Painted on the last run.'
                : 'Generated when the workflow runs.'}
          </p>
          {/* Same place and size as AI element's Cancel, so the two sections read alike. */}
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              className={`${SMALL} py-2`}
              onClick={() => {
                api.update((l) => ({ ...l, scene: { ...l.scene, on: false } }));
                api.select('bg');
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className={`${SMALL} w-full py-2`}
          onClick={() => {
            api.update((l) => ({ ...l, scene: { ...l.scene, on: true } }));
            api.select('scene');
          }}
        >
          Add AI background
        </button>
      )}
    </div>
  );
}

const previews = new Map<string, Promise<string>>();

/** The template itself drawn at its X size, once per session. */
/** A palette or custom UI kit the template thumbnails are drawn in, like the design they'd open into. */
export interface ThumbLook {
  palette?: string;
  kit?: BrandKit;
}

/** What a thumbnail look should be for a design: its palette, or its own kit when that isn't a
 *  built-in brand (those already list their own templates). */
export const thumbLookOf = (layout: ICLayout): ThumbLook | undefined =>
  layout.palette
    ? { palette: layout.palette }
    : layout.kit && !brandOfKit(layout.kit.id)
      ? { kit: layout.kit }
      : undefined;

const lookKey = (look?: ThumbLook) =>
  look?.palette ??
  (look?.kit ? JSON.stringify([look.kit.roles, look.kit.fonts, look.kit.elements]) : '');

export function templatePreview(t: ICTemplate, look?: ThumbLook): Promise<string> {
  const key = `${t.id}|${lookKey(look)}`;
  let pending = previews.get(key);
  if (!pending) {
    const base = layoutFromTemplate(t, undefined, undefined, t.ratio);
    const styled = look?.palette
      ? applyPalette(base, look.palette)
      : look?.kit
        ? applyBrandKit(base, look.kit)
        : base;
    pending = composeLayout(styled, null, { width: 480, format: 'jpeg', quality: 0.85 });
    previews.set(key, pending);
  }
  return pending;
}

function RenderedThumb({ template, look }: { template: ICTemplate; look?: ThumbLook }) {
  const [url, setUrl] = useState<string | null>(null);
  const key = lookKey(look);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `look`, which is a new object each render
  useEffect(() => {
    let live = true;
    templatePreview(template, look)
      .then((u) => live && setUrl(u))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [template, key]);
  return (
    // The card takes the preview's own X shape, so the design is shown whole, never cropped.
    <div className="relative" style={{ background: template.thumb, aspectRatio: '16 / 9' }}>
      {/* biome-ignore lint/performance/noImgElement: a local data URL */}
      {url && <img src={url} alt="" className="absolute inset-0 size-full" />}
    </div>
  );
}

function Thumb({ template, look }: { template: ICTemplate; look?: ThumbLook }) {
  if (template.kit) return <RenderedThumb template={template} look={look} />;
  const rh = ratioHeight(template.ratio);
  const subjectRatio = template.subject?.ratio ?? 0.625;
  return (
    // A fixed card shape, not derived from the template's own ratio (user: cards were
    // different heights, Blank's square 1:1 next to Catalog's 3:4). Every element inside
    // still positions off the template's real `rh`, so a real template's own schematic
    // preview keeps its correct relative proportions inside this uniform frame.
    <div className="relative" style={{ background: template.thumb, aspectRatio: '3 / 2' }}>
      {template.els
        .filter((e) => e.t !== 'line')
        .map((e) => (
          <i
            key={e.id}
            className={`absolute block rounded-[2px] ${e.t === 'subject' ? 'bg-emerald-300/80' : e.t === 'shape' || e.t === 'image' ? 'bg-white/25' : 'bg-white/70'}`}
            style={{
              left: `${e.x}%`,
              top: `${e.y}%`,
              width: `${e.t === 'text' ? Math.min(e.w, 40) : e.w}%`,
              height:
                e.t === 'subject'
                  ? `${e.w / subjectRatio / rh}%`
                  : e.t === 'pill' || e.t === 'shape' || (e.t === 'image' && e.h !== undefined)
                    ? `${e.h}%`
                    : '3%',
              transform: e.rot ? `rotate(${e.rot}deg)` : undefined,
            }}
          />
        ))}
    </div>
  );
}

export function TemplatesPanel({ api }: { api: StudioApi }) {
  const look = thumbLookOf(api.layout);
  // Opens on the current design's type, and follows it when the design moves to another one.
  const openId = api.layout.thread?.root ?? api.layout.templateId;
  // A list template's id carries its item setup; the picker lists the template itself.
  const openBase = openId.split('~')[0];
  const current = openId === 'blank' ? undefined : findTemplate(openId);
  const [pack, setPack] = useState(() => current?.pack ?? TEMPLATE_PACKS[0]);
  useEffect(() => {
    if (current?.pack) setPack(current.pack);
  }, [current?.pack]);
  const brandId = current?.brand ?? brandOfKit(api.layout.kit?.id) ?? ANNOUNCE_BRANDS[0].id;
  const listed = (t: ICTemplate, p: string) =>
    t.pack === p && !t.hidden && (!t.brand || t.brand === brandId);
  const count = (p: string) => ALL_TEMPLATES.filter((t) => listed(t, p)).length;
  const shown = ALL_TEMPLATES.filter((t) => listed(t, pack));
  return (
    <div>
      <StudioPicker
        block
        label="Type"
        value={pack}
        sections={[
          {
            items: TEMPLATE_PACKS.map((p) => ({
              id: p,
              label: p,
              right: String(count(p)),
              on: pack === p,
              onPick: () => setPack(p),
            })),
          },
        ]}
      />
      <div className="mt-4">
        <MyDesignsSection
          activeId={api.layout.saved?.id}
          onOpen={(layout) => {
            api.update(() => layout);
            api.select(null);
          }}
          onRenamed={(id, name) =>
            api.update((l) => (l.saved?.id === id ? { ...l, saved: { id, name } } : l))
          }
        />
      </div>
      <div className={`${LABEL} flex gap-1.5`}>
        Built-in <span className="font-normal">{shown.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {shown.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => api.chooseTemplate(t)}
            // Focus shows as the tile's own border; the page-wide outline would draw a second one.
            className={`overflow-hidden rounded-xl border bg-canvas-muted text-left focus-visible:border-emerald-400 focus-visible:outline-none ${
              openBase === t.id
                ? 'border-emerald-400'
                : 'border-canvas-border hover:border-canvas-muted-foreground'
            }`}
          >
            <Thumb template={t} look={look} />
            <div className="px-2.5 py-2 text-[12px] font-semibold text-canvas-foreground">
              {t.title}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CutoutControls({
  api,
  id,
  source,
}: {
  api: StudioApi;
  id: string;
  source: { cut?: ICCutout; sample?: boolean };
}) {
  const { cut } = source;
  const [draft, setDraft] = useState<ICCutout>(cut ?? DEFAULT_CUTOUT);
  useEffect(() => {
    if (cut) setDraft(cut);
  }, [cut]);
  const busy = api.cutBusy === id;
  const apply = () => void api.cutout(id, draft);
  const range = (label: string, key: keyof ICCutout, max: number, step: number) => (
    <label className="mt-2 flex items-center gap-2 text-[11.5px] text-canvas-muted-foreground">
      <span className="w-16">{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
        onPointerUp={apply}
        onKeyUp={apply}
        className="flex-1 accent-emerald-500"
      />
    </label>
  );
  return (
    <div>
      <div className={LABEL}>Remove background</div>
      {source.sample ? (
        <p className="text-[11px] leading-relaxed text-canvas-muted-foreground">
          Upload a photo to remove its background here.
        </p>
      ) : (
        <>
          {cut ? (
            <>
              {range('Strength', 'tolerance', 100, 1)}
              {range('Edge', 'feather', 4, 0.5)}
              <button
                type="button"
                className={`${SMALL} mt-2.5 w-full`}
                onClick={() => void api.cutout(id, null)}
              >
                Restore original
              </button>
            </>
          ) : (
            <button type="button" className={`${SMALL} w-full`} disabled={busy} onClick={apply}>
              {busy ? 'Removing…' : 'Remove background'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** The side drawer for editing a chart's data or a code block. */
export function EditDrawer({ api, id }: { api: StudioApi; id: string }) {
  const el = api.layout.els.find((e) => e.id === id);
  if (el?.t === 'art' && isChart(el.art)) return <ChartDrawer api={api} el={el} />;
  if (el?.t === 'art' && isCode(el.art)) return <CodeDrawer api={api} el={el} />;
  // Photos have their editing, remove background included, in the inspector's Image section.
  return null;
}

/** Every palette's colors in a compact grid, the active palette first. Hover a group for its name. */
/** The applied kit's own swatches, in a row above the palettes. */
function BrandSwatches({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2.5">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70">
        Brand
      </div>
      <div className="grid grid-cols-8 gap-1">{children}</div>
    </div>
  );
}

function PaletteSwatches({
  api,
  children,
}: {
  api: StudioApi;
  children: (colors: string[]) => ReactNode;
}) {
  const active = api.layout.palette;
  const ordered = [...PALETTES].sort((a, b) => Number(b.id === active) - Number(a.id === active));
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
      {ordered.map((p) => (
        <div key={p.id} title={p.name} className="grid grid-cols-4 gap-1">
          {children(p.colors)}
        </div>
      ))}
    </div>
  );
}

interface ImportState {
  name: string;
  table: ICTable;
  info: ICColumnInfo[];
  label: number;
  cols: number[];
  hideEmpty: boolean;
  summary: ICSummary;
}

/** The step between loading a file and charting it: which column labels the points, which columns
 *  to draw, and how many rows become one point. */
function ChartImport({
  state,
  points,
  onChange,
  onCancel,
  onImport,
}: {
  state: ImportState;
  points: number;
  onChange: (next: ImportState) => void;
  onCancel: () => void;
  onImport: () => void;
}) {
  const { table, info, label, cols, hideEmpty, summary } = state;
  const rows = table.rows.length;
  const per = Math.ceil(rows / MAX_POINTS);
  const shown = info
    .map((c, i) => [c, i] as const)
    .filter(([c, i]) => i !== label && !(hideEmpty && c.empty));
  const toggle = (i: number) =>
    onChange({
      ...state,
      cols: cols.includes(i)
        ? cols.filter((c) => c !== i)
        : [...cols, i].sort((a, b) => a - b).slice(0, 12),
    });
  return (
    <div className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-canvas-border bg-canvas p-4 text-[12px]">
      <div className="font-semibold">Import {state.name}</div>
      <div className="mt-0.5 text-[11.5px] text-canvas-muted-foreground">
        {rows.toLocaleString()} rows · {info.length} columns
      </div>

      <div className={`${LABEL} mt-4`}>Label each point with</div>
      <ThemedSelect
        value={String(label)}
        options={info.map((c, i) => ({ value: String(i), label: c.name, disabled: c.empty }))}
        onChange={(v) => {
          const next = Number(v);
          onChange({ ...state, label: next, cols: cols.filter((c) => c !== next) });
        }}
      />

      <div className="mt-4 flex items-center">
        <div className={`${LABEL} mb-0 flex-1`}>Columns to chart</div>
        <label className="flex items-center gap-1.5 text-[11px] text-canvas-muted-foreground">
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => onChange({ ...state, hideEmpty: e.target.checked })}
            className="accent-emerald-500"
          />
          Remove empty columns
        </label>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {shown.map(([c, i]) => {
          const usable = !c.empty && c.numeric >= 0.8;
          return (
            <label
              key={i}
              title={
                usable
                  ? undefined
                  : c.empty
                    ? 'This column is empty'
                    : 'This column holds text, not numbers'
              }
              className={`flex items-center gap-2 rounded-md border border-canvas-border px-2 py-1.5 ${usable ? 'cursor-pointer hover:bg-canvas-muted' : 'opacity-40'}`}
            >
              <input
                type="checkbox"
                disabled={!usable}
                checked={cols.includes(i)}
                onChange={() => toggle(i)}
                className="accent-emerald-500"
              />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {!usable && (
                <span className="text-[10.5px] text-canvas-muted-foreground">
                  {c.empty ? 'empty' : 'text'}
                </span>
              )}
            </label>
          );
        })}
      </div>
      {cols.length >= 12 && (
        <p className="mt-1.5 text-[11px] text-canvas-muted-foreground">
          Up to 12 columns per chart.
        </p>
      )}

      {rows > MAX_POINTS && (
        <>
          <div className={`${LABEL} mt-4`}>Each point shows</div>
          <ThemedSelect
            value={summary}
            options={SUMMARIES.map(([value, name]) => ({ value, label: name }))}
            onChange={(v) => onChange({ ...state, summary: v as ICSummary })}
          />
          {summary === 'ohlc' && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-canvas-muted-foreground">
              Uses the first picked column{cols.length > 1 ? ` (${info[cols[0]]?.name})` : ''} and
              draws it as candles.
            </p>
          )}
        </>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-canvas-muted-foreground">
        {rows > MAX_POINTS
          ? `Charts show up to ${MAX_POINTS.toLocaleString()} points, so every ${per.toLocaleString()} rows in order become one point. All rows are used; only those ${points.toLocaleString()} points are kept with the design.`
          : `All ${rows.toLocaleString()} rows become points.`}
      </p>
      <div className="mt-auto flex justify-end gap-2 pt-4">
        <button type="button" className={SMALL} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!cols.length}
          className="rounded-md border border-emerald-500/60 px-3 py-1 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"
          onClick={onImport}
        >
          Import {cols.length ? `${cols.length} ${cols.length === 1 ? 'column' : 'columns'}` : ''}
        </button>
      </div>
    </div>
  );
}

/** Column letters as in a spreadsheet: A, B, … Z, AA. */
function columnLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** The right-side panel a code window's Code button opens: the code, its file name, language and look. */
function CodeDrawer({ api, el }: { api: StudioApi; el: ICArtEl }) {
  const code = el.code ?? sampleCode();
  const set = (p: Partial<ICCodeData>) => api.patch(el.id, { code: { ...code, ...p } });
  const seg = (on: boolean) =>
    `flex-1 rounded px-2 py-1 ${on ? 'bg-canvas text-canvas-foreground' : 'text-canvas-muted-foreground hover:text-canvas-foreground'}`;
  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-canvas-border bg-canvas-muted p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-canvas-foreground">Code</span>
        <button
          type="button"
          onClick={() => api.setEdit(null)}
          aria-label="Close"
          className="text-canvas-muted-foreground hover:text-canvas-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <textarea
        value={code.text}
        onChange={(e) => set({ text: e.target.value })}
        spellCheck={false}
        rows={14}
        className={`${INPUT} mt-3 resize-y whitespace-pre font-mono text-[11.5px] leading-relaxed`}
      />
      <div className={`${LABEL} mt-3`}>File name</div>
      <input
        value={code.title}
        onChange={(e) => set({ title: e.target.value })}
        placeholder="No tab"
        className={INPUT}
      />
      <div className={`${LABEL} mt-3`}>Language</div>
      <select
        value={code.lang}
        onChange={(e) => set({ lang: e.target.value as ICCodeLang })}
        className={INPUT}
      >
        {CODE_LANGS.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      <div className={`${LABEL} mt-3`}>Theme</div>
      <div className="flex rounded-md border border-canvas-border p-0.5 text-[12px]">
        {(['dark', 'light'] as const).map((t) => (
          <button key={t} type="button" className={seg(code.theme === t)} onClick={() => set({ theme: t })}>
            {t === 'dark' ? 'Dark' : 'Light'}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2 text-[12px] text-canvas-muted-foreground">
        <input
          type="checkbox"
          checked={code.lines}
          onChange={(e) => set({ lines: e.target.checked })}
          className="accent-emerald-500"
        />
        Line numbers
      </label>
    </div>
  );
}

const SHEET_GREEN = '#217346';

/** The right-side panel a chart's Data button opens: its type, a summary of its data with an editor
 *  to open, and a switch that makes it a workflow input in Play. */
function ChartDrawer({ api, el }: { api: StudioApi; el: ICArtEl }) {
  const data = el.data ?? sampleData(el.art as ChartKind);
  const [paste, setPaste] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [pending, setPending] = useState<ImportState | null>(null);
  const pendingData = useMemo(
    () =>
      pending && pending.cols.length
        ? tableToChart(pending.table, pending.label, pending.cols, pending.summary)
        : null,
    [pending],
  );
  const load = async (file: File) => {
    if (file.size > MAX_FILE_MB * 1e6) {
      setError(
        `This file is ${Math.round(file.size / 1e6)} MB. The limit is ${MAX_FILE_MB} MB: filter or total it in a spreadsheet first, or connect it in Play.`,
      );
      return;
    }
    const table = parseTable(await file.text());
    if (!table || !table.rows.length) {
      setError('This file has no rows a chart can use.');
      return;
    }
    const info = columnInfo(table);
    const label = guessLabel(info);
    const cols = info
      .map((_, i) => i)
      .filter((i) => i !== label && !info[i].empty && info[i].numeric >= 0.8)
      .slice(0, 12);
    setError(null);
    setPending({ name: file.name, table, info, label, cols, hideEmpty: true, summary: 'average' });
  };
  const [error, setError] = useState<string | null>(null);
  const set = (next: ICChartData) => api.patch(el.id, { data: next });
  const apply = (raw: string) => {
    const parsed = parseChartData(raw);
    if (!parsed || !parsed.labels.length) {
      setError('Use one row per point: a label, then a number for each column.');
      return false;
    }
    setError(null);
    set(parsed);
    return true;
  };
  const setValue = (row: number, col: number, raw: string) => {
    const n = num(raw);
    set({
      ...data,
      series: data.series.map((s, k) =>
        k === col
          ? { ...s, values: s.values.map((v, i) => (i === row ? (Number.isNaN(n) ? v : n) : v)) }
          : s,
      ),
    });
  };
  // A block copied from a spreadsheet, pasted into one cell, fills from there down and right.
  // `col` -1 is the label column. Pasted into the first label with a header row, it replaces all.
  const pasteGrid = (row: number, col: number, e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    if (row === 0 && col === -1 && apply(text)) return;
    const grid = text
      .replace(/\r/g, '')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.split(/\t|,(?=\S)/));
    const labels = data.labels.slice();
    const series = data.series.map((x) => ({ ...x, values: x.values.slice() }));
    grid.forEach((cells, dr) => {
      const i = row + dr;
      while (labels.length <= i) {
        labels.push('');
        for (const x of series) x.values.push(0);
      }
      cells.forEach((raw, dc) => {
        const c = col + dc;
        if (c === -1) {
          labels[i] = raw.trim();
          return;
        }
        while (series.length <= c)
          series.push({ name: `Column ${series.length + 1}`, values: labels.map(() => 0) });
        const n = num(raw);
        series[c].values[i] = Number.isNaN(n) ? 0 : n;
      });
    });
    setError(null);
    set({ ...data, labels, series });
  };
  const taken = new Set(api.layout.els.map((e) => e.slot).filter(Boolean));
  const slotName =
    el.slot ??
    (['chart', 'chart_2', 'chart_3', 'chart_4'].find((n) => !taken.has(n)) || 'chart_data');

  const bg = api.layout.bg;
  const backdrop =
    bg.mode === 'gradient'
      ? `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`
      : bg.mode === 'transparent'
        ? '#11131a'
        : bg.color;
  const preview = artFor({ ...el, data });
  const pendingPreview = pendingData
    ? artFor({
        ...el,
        art: pending?.summary === 'ohlc' ? 'chart-candles' : el.art,
        data: pendingData,
      })
    : undefined;

  const types = (
    <div className="flex flex-wrap gap-1">
      {CHART_KINDS.map(([kind, name]) => (
        <button
          key={kind}
          type="button"
          onClick={() => api.patch(el.id, { art: kind })}
          className={`rounded-full border px-2 py-0.5 text-[11px] ${
            el.art === kind
              ? 'border-emerald-400 bg-emerald-400/10 text-canvas-foreground'
              : 'border-canvas-border text-canvas-muted-foreground hover:text-canvas-foreground'
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  );

  const td = 'border border-neutral-300 p-0';
  const input =
    'block w-full min-w-0 bg-transparent px-2 py-1 text-[11.5px] text-neutral-800 outline-none focus:bg-emerald-50';
  const gutter =
    'border border-neutral-300 bg-neutral-100 px-2 py-1 text-center text-[10.5px] text-neutral-500';

  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-canvas-border bg-canvas-muted p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-canvas-foreground">Chart</span>
        <button
          type="button"
          onClick={() => api.setEdit(null)}
          aria-label="Close"
          className="text-canvas-muted-foreground hover:text-canvas-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className={`${LABEL} mt-3`}>Type</div>
      {types}
      {el.art === 'chart-candles' && data.series.length < 4 && (
        <p className="mt-1.5 text-[11px] text-amber-200">
          Candles need four columns: open, high, low, close.
        </p>
      )}

      <div className={`${LABEL} mt-4`}>Data</div>
      <div className="text-[11.5px] text-canvas-muted-foreground">
        {data.labels.length.toLocaleString()} rows · {data.series.length}{' '}
        {data.series.length === 1 ? 'column' : 'columns'}
      </div>
      <button type="button" className={`${SMALL} mt-2 w-full`} onClick={() => setSheet(true)}>
        Edit data
      </button>
      <button
        type="button"
        title={
          el.slot
            ? 'In Play, connect a node that outputs CSV or JSON to this input on the Create design node. Click to stop using it as an input.'
            : 'In Play, a node that outputs CSV or JSON, such as an API call or a spreadsheet, can fill this chart through the Create design node.'
        }
        onClick={() => api.patch(el.id, { slot: el.slot ? undefined : slotName })}
        className={`${SMALL} mt-2 w-full shrink-0 ${el.slot ? 'border-emerald-500/50 text-emerald-300' : ''}`}
      >
        {el.slot ? `Workflow input: ${el.slot}` : 'Use as workflow input'}
      </button>

      {sheet &&
        createPortal(
          // biome-ignore lint/a11y/noStaticElementInteractions: clicking the dimmed backdrop closes the editor
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-6 font-mono"
            onMouseDown={(e) => e.target === e.currentTarget && setSheet(false)}
          >
            <div className="flex h-[82vh] w-[min(1240px,96vw)] flex-col rounded-2xl border border-canvas-border bg-canvas-muted p-4 text-canvas-foreground shadow-2xl">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-sm font-semibold">Chart data</span>
                <span className="text-[11.5px] text-canvas-muted-foreground">
                  {data.labels.length.toLocaleString()} rows · {data.series.length}{' '}
                  {data.series.length === 1 ? 'column' : 'columns'}
                </span>
                <button
                  type="button"
                  onClick={() => setSheet(false)}
                  className={`${SMALL} ml-auto`}
                >
                  Done
                </button>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-4">
                {pending ? (
                  <ChartImport
                    state={pending}
                    points={pendingData?.labels.length ?? 0}
                    onChange={setPending}
                    onCancel={() => setPending(null)}
                    onImport={() => {
                      if (pendingData)
                        api.patch(el.id, {
                          data: pendingData,
                          ...(pending.summary === 'ohlc' ? { art: 'chart-candles' } : {}),
                        });
                      setPending(null);
                    }}
                  />
                ) : (
                  // The sheet, drawn like the spreadsheet export preview: letters, row numbers, a header row.
                  <div className="flex min-h-0 flex-col">
                    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-canvas-border bg-white">
                      <table className="border-collapse text-left">
                        <thead className="sticky top-0 z-10">
                          <tr>
                            <th className="sticky left-0 z-10 border border-neutral-300 bg-neutral-100 px-2 py-1" />
                            {[-1, ...data.series.map((_, k) => k)].map((c) => (
                              <th
                                key={c}
                                className="border border-neutral-300 px-2 py-1 text-center text-[10.5px] font-semibold text-white"
                                style={{ backgroundColor: SHEET_GREEN }}
                              >
                                {columnLetter(c + 1)}
                              </th>
                            ))}
                            <th className="w-6 border border-neutral-300 bg-neutral-100" />
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className={`${gutter} sticky left-0`}>1</td>
                            <td
                              className={`${td} min-w-32 bg-neutral-50 px-2 py-1 text-[11.5px] font-semibold text-neutral-500`}
                            >
                              Label
                            </td>
                            {data.series.map((s, k) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: columns have no id of their own
                              <td key={k} className={`${td} group relative min-w-32 bg-neutral-50`}>
                                <input
                                  value={s.name}
                                  aria-label={`Column ${columnLetter(k + 1)} name`}
                                  onChange={(e) =>
                                    set({
                                      ...data,
                                      series: data.series.map((x, j) =>
                                        j === k ? { ...x, name: e.target.value } : x,
                                      ),
                                    })
                                  }
                                  className={`${input} font-semibold`}
                                />
                                {data.series.length > 1 && (
                                  <button
                                    type="button"
                                    title="Remove this column"
                                    onClick={() =>
                                      set({
                                        ...data,
                                        series: data.series.filter((_, j) => j !== k),
                                      })
                                    }
                                    className="absolute right-1 top-1.5 hidden rounded text-neutral-400 hover:text-red-500 group-hover:block"
                                  >
                                    <X className="size-3" />
                                  </button>
                                )}
                              </td>
                            ))}
                            <td className={td} />
                          </tr>
                          {data.labels.map((label, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id of their own
                            <tr key={i} className="group">
                              <td className={`${gutter} sticky left-0`}>{i + 2}</td>
                              <td className={`${td} bg-white`}>
                                <input
                                  value={label}
                                  aria-label={`Row ${i + 1} label`}
                                  onPaste={(e) => pasteGrid(i, -1, e)}
                                  onChange={(e) =>
                                    set({
                                      ...data,
                                      labels: data.labels.map((l, j) =>
                                        j === i ? e.target.value : l,
                                      ),
                                    })
                                  }
                                  className={input}
                                />
                              </td>
                              {data.series.map((s, k) => (
                                // biome-ignore lint/suspicious/noArrayIndexKey: columns have no id of their own
                                <td key={k} className={`${td} bg-white`}>
                                  <input
                                    defaultValue={short(s.values[i] ?? 0)}
                                    key={`${i}-${k}-${s.values[i]}`}
                                    aria-label={`${s.name}, row ${i + 1}`}
                                    onPaste={(e) => pasteGrid(i, k, e)}
                                    onBlur={(e) => setValue(i, k, e.target.value)}
                                    onKeyDown={(e) =>
                                      e.key === 'Enter' && (e.target as HTMLInputElement).blur()
                                    }
                                    className={`${input} text-right tabular-nums`}
                                  />
                                </td>
                              ))}
                              <td className={`${td} bg-white text-center`}>
                                <button
                                  type="button"
                                  title="Remove this row"
                                  onClick={() =>
                                    set({
                                      ...data,
                                      labels: data.labels.filter((_, j) => j !== i),
                                      series: data.series.map((x) => ({
                                        ...x,
                                        values: x.values.filter((_, j) => j !== i),
                                      })),
                                    })
                                  }
                                  className="invisible px-1 text-neutral-400 hover:text-red-500 group-hover:visible"
                                >
                                  <X className="size-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className={SMALL}
                        onClick={() =>
                          set({
                            ...data,
                            labels: [...data.labels, ''],
                            series: data.series.map((x) => ({
                              ...x,
                              values: [...x.values, x.values[x.values.length - 1] ?? 0],
                            })),
                          })
                        }
                      >
                        + Row
                      </button>
                      <button
                        type="button"
                        className={SMALL}
                        onClick={() =>
                          set({
                            ...data,
                            series: [
                              ...data.series,
                              {
                                name: `Column ${data.series.length + 1}`,
                                values: data.labels.map(() => 0),
                              },
                            ],
                          })
                        }
                      >
                        + Column
                      </button>
                      <button
                        type="button"
                        className={`${SMALL} ml-auto`}
                        onClick={() => setPaste(paste === null ? chartCsv(data) : null)}
                      >
                        {paste === null ? 'Paste CSV or JSON' : 'Close'}
                      </button>
                      <label className={`${SMALL} flex cursor-pointer items-center`}>
                        Load file
                        <input
                          type="file"
                          accept=".csv,.tsv,.json,text/csv,application/json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) void load(file);
                          }}
                        />
                      </label>
                    </div>
                    {paste !== null && (
                      <div className="mt-2 flex gap-2">
                        <textarea
                          value={paste}
                          onChange={(e) => setPaste(e.target.value)}
                          spellCheck={false}
                          rows={5}
                          className={`${INPUT} font-mono text-[11px] leading-relaxed`}
                        />
                        <button
                          type="button"
                          className={`${SMALL} self-end`}
                          onClick={() => apply(paste) && setPaste(null)}
                        >
                          Apply
                        </button>
                      </div>
                    )}
                    {error && <div className="mt-1.5 text-[11px] text-red-300">{error}</div>}
                    <p className="mt-2 text-[11px] leading-relaxed text-canvas-muted-foreground">
                      Paste cells from Google Sheets or Excel into any cell, or load a CSV or JSON
                      file up to {MAX_FILE_MB} MB. Charts keep up to {MAX_POINTS.toLocaleString()}{' '}
                      points.
                    </p>
                  </div>
                )}

                {/* The chart as it will look, in the design's own colors and background. */}
                <div className="flex min-h-0 flex-col">
                  <div
                    className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-canvas-border p-5"
                    style={{ background: backdrop }}
                  >
                    {preview && (
                      // biome-ignore lint/performance/noImgElement: a local SVG data URL
                      <img
                        src={artUrl(pendingPreview ?? preview, el.colors)}
                        alt="Chart preview"
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="mt-2">{types}</div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** The one faint layer over the background: None, a pattern style, a frame or streaks. */
function TextureControls({ api }: { api: StudioApi }) {
  const on = api.layout.els.some(isTexture);
  const roles = designRoles(api.layout);
  const tile = (active: boolean) =>
    `flex aspect-square items-center justify-center overflow-hidden rounded-lg border ${
      active
        ? 'border-emerald-400'
        : 'border-canvas-border hover:border-canvas-muted-foreground'
    }`;
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          title="No texture"
          onClick={() => api.update((l) => setTexture(l, null))}
          // Having no texture isn't a pick, so None never takes the selection ring.
          className={`${tile(false)} text-[11px] ${on ? 'text-canvas-muted-foreground' : 'text-canvas-foreground'}`}
        >
          None
        </button>
        {TEXTURES.map(([texture, name]) => {
          const def = artDef('pattern' in texture ? patternId(texture.pattern, 1) : texture.art);
          return (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => api.update((l) => setTexture(l, texture))}
              className={tile(isTextureOn(api.layout, texture))}
              style={{ background: roles.bg }}
            >
              {def && (
                // biome-ignore lint/performance/noImgElement: a local SVG data URL
                <img
                  src={artUrl(tileArt(def), { ...artDefaults(def), ...artPalette(def, roles) })}
                  alt={name}
                  className="size-full"
                />
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={`${SMALL} mt-2.5 flex w-full items-center justify-center gap-1.5`}
        onClick={() => api.update(shuffleTexture)}
      >
        <RefreshCw className="size-3.5" /> Shuffle
      </button>
    </div>
  );
}

/** Solid, gradient or transparent background, in the inspector's Fill section. */
export function BackgroundControls({ api }: { api: StudioApi }) {
  const { bg, kit } = api.layout;
  // A kit's own colors and gradients come first, ahead of the stock palettes.
  const brand = kit ? [...new Set([...Object.values(kit.colors), ...(kit.extra ?? [])])] : [];
  const brandGradients = kit?.gradients ?? [];
  // The AI background sits above the background color, so choosing a color turns it off.
  const setBg = (patch: Partial<ICLayout['bg']>) =>
    api.update((l) =>
      fitFigures({ ...l, scene: { ...l.scene, on: false }, bg: { ...l.bg, ...patch } }),
    );
  return (
    <div>
      <Segmented
        value={bg.mode}
        options={[
          ['solid', 'Solid'],
          ['gradient', 'Gradient'],
          ['transparent', 'Transparent'],
        ]}
        onChange={(mode) => setBg({ mode })}
      />
      {bg.mode === 'solid' && (
        <>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bg.color}
              onChange={(e) => setBg({ color: e.target.value })}
              className="h-8 w-10 rounded-md border border-canvas-border bg-canvas p-0.5"
            />
            <input
              value={bg.color}
              maxLength={7}
              spellCheck={false}
              onChange={(e) =>
                /^#[0-9a-fA-F]{6}$/.test(e.target.value) && setBg({ color: e.target.value })
              }
              className={`${INPUT} py-1.5`}
            />
          </div>
          {brand.length > 0 && (
            <BrandSwatches>
              {brand.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  className={SWATCH}
                  style={{ background: c }}
                  onClick={() => setBg({ color: c })}
                />
              ))}
            </BrandSwatches>
          )}
          <PaletteSwatches api={api}>
            {(colors) =>
              colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  className={SWATCH}
                  style={{ background: c }}
                  onClick={() => setBg({ color: c })}
                />
              ))
            }
          </PaletteSwatches>
        </>
      )}
      {bg.mode === 'gradient' && (
        <>
          <div
            className="mb-2 h-8 rounded-lg border border-canvas-border"
            style={{ background: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})` }}
          />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bg.from}
              onChange={(e) => setBg({ from: e.target.value })}
              className="h-8 w-10 rounded-md border border-canvas-border bg-canvas p-0.5"
            />
            <input
              type="color"
              value={bg.to}
              onChange={(e) => setBg({ to: e.target.value })}
              className="h-8 w-10 rounded-md border border-canvas-border bg-canvas p-0.5"
            />
            <input
              type="range"
              min={0}
              max={360}
              value={bg.angle}
              onChange={(e) => setBg({ angle: Number(e.target.value) })}
              className="flex-1 accent-emerald-500"
            />
            <span className="w-9 text-right text-[11px] text-canvas-muted-foreground">
              {bg.angle}°
            </span>
          </div>
          {brandGradients.length > 0 && (
            <BrandSwatches>
              {brandGradients.map(([from, to]) => (
                <button
                  key={`${from}${to}`}
                  type="button"
                  aria-label={`Gradient ${from} to ${to}`}
                  className={SWATCH}
                  style={{ background: `linear-gradient(${bg.angle}deg, ${from}, ${to})` }}
                  onClick={() => setBg({ from, to })}
                />
              ))}
            </BrandSwatches>
          )}
          <PaletteSwatches api={api}>
            {(colors) =>
              gradientPairs(colors).map(([from, to]) => (
                <button
                  key={`${from}${to}`}
                  type="button"
                  aria-label={`Gradient ${from} to ${to}`}
                  className={SWATCH}
                  style={{ background: `linear-gradient(${bg.angle}deg, ${from}, ${to})` }}
                  onClick={() => setBg({ from, to })}
                />
              ))
            }
          </PaletteSwatches>
        </>
      )}
      {bg.mode === 'transparent' && (
        <p className="text-[11px] leading-relaxed text-canvas-muted-foreground">
          The AI background is already off. Export now for a transparent PNG.
        </p>
      )}
    </div>
  );
}

const TILE =
  'flex h-24 items-center justify-center rounded-lg border border-canvas-border bg-canvas-muted p-2 hover:border-canvas-muted-foreground';

/** Frame lines are hairlines at canvas size, so the tile draws them heavier to be seen. */
const tileArt = (art: (typeof ART)[number]) =>
  isFrameArt(art.id)
    ? {
        ...art,
        body: art.body
          .replace(/stroke-width="[\d.]+"/g, 'stroke-width="4"')
          .replace(/ opacity="[\d.]+"/g, ''),
      }
    : art;

function ArtTile({
  api,
  art,
  small,
}: {
  api: StudioApi;
  art: (typeof ART)[number];
  small?: boolean;
}) {
  // Drawn on the design's own background in the colors addArt gives it, like the block tiles.
  const roles = designRoles(api.layout);
  const colors = { ...artDefaults(art), ...artPalette(art, roles) };
  return (
    <button
      type="button"
      title={art.name}
      {...dragItem({ kind: 'art', id: art.id })}
      onClick={() => api.addArt(art.id)}
      className={small ? `${TILE} h-auto aspect-square p-2.5` : TILE}
      style={{ background: roles.bg }}
    >
      {/* biome-ignore lint/performance/noImgElement: a local SVG data URL */}
      <img
        // A chart with several series shades them from its colors, so it is drawn with the design's.
        src={artUrl(tileArt(artFor({ art: art.id, colors }) ?? art), colors)}
        alt={art.name}
        className="max-h-full max-w-full"
      />
    </button>
  );
}

/** A prompt-painted object with its backdrop cut away, added as a normal image layer. */
function AIElementForm({ api }: { api: StudioApi }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => setAvailable(canGenerateElements()), []);
  const busy = api.genBusy !== null;
  // Collapsed to one button like AI background; it folds back once a generation lands cleanly.
  const [open, setOpen] = useState(busy);
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current && !busy && !api.genError) setOpen(false);
    wasBusy.current = busy;
  }, [busy, api.genError]);
  if (!available) return null;
  const wide = `${SMALL} mt-2 flex w-full items-center justify-center gap-1.5 py-2`;
  return (
    <div className="mt-4 border-t border-canvas-border pt-3">
      <div className={LABEL}>
        AI element
        <InfoHint text="An object painted from your prompt and cut out, added as a layer over your background." />
      </div>
      {!open && !busy ? (
        <button type="button" className={`${SMALL} w-full py-2`} onClick={() => setOpen(true)}>
          Add AI element
        </button>
      ) : (
        <>
          <textarea
            value={api.genPrompt}
            placeholder="e.g. a hand holding a smartphone"
            onChange={(e) => api.setGenPrompt(e.target.value)}
            spellCheck={false}
            className={`${INPUT} min-h-[64px] resize-y leading-relaxed`}
          />
          <div className="mt-2">
            <ThemedSelect
              id="ic-element-model"
              value={api.genModel}
              options={IMAGE_MODEL_OPTIONS}
              onChange={(v) => api.setGenModel(v as ICModel)}
            />
          </div>
          {busy ? (
            <>
              <button type="button" onClick={api.stopElement} className={wide}>
                Stop
              </button>
              <p className="mt-1.5 text-[11px] text-canvas-muted-foreground">
                Usually 30 seconds to a couple of minutes. Other tabs keep working meanwhile.
              </p>
            </>
          ) : (
            <div className="mt-2 flex gap-1.5">
              <button type="button" onClick={() => setOpen(false)} className={`${SMALL} py-2`}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!api.genPrompt.trim()}
                onClick={() => void api.generateElement(api.genPrompt, api.genModel)}
                className={`${SMALL} flex flex-1 items-center justify-center py-2`}
              >
                Generate
              </button>
            </div>
          )}
          {api.genError && <p className="mt-1.5 text-[11px] text-red-300">{api.genError}</p>}
        </>
      )}
    </div>
  );
}

/** A block drawn on its own in the design's colors, at a size the tile shows whole. */
function BlockTile({ api, block }: { api: StudioApi; block: ICBlock }) {
  const [url, setUrl] = useState<string | null>(null);
  const { layout } = api;
  const roles = designRoles(layout);
  const key = `${block.id}|${JSON.stringify(roles)}|${layout.kit?.id ?? ''}|${JSON.stringify(layout.bg)}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` captures everything the preview depends on
  useEffect(() => {
    let live = true;
    const H = 62.5;
    const built = block.build(layerBuilder(H, roles), blockStyle(layout.kit));
    const scale = Math.min(88 / built.w, (H * 0.84) / built.h);
    const els = built.els.map((e) =>
      fitBlockLayer(e, scale, (100 - built.w * scale) / 2, (100 - (built.h * scale * 100) / H) / 2),
    );
    const preview: ICLayout = {
      ...layout,
      ratio: 'custom',
      customSize: { width: 160, height: 100 },
      scene: { on: false, upload: null },
      els,
    };
    composeLayout(preview, null, { width: 320, format: 'png' })
      .then((u) => live && setUrl(u))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [key]);
  return (
    <button
      type="button"
      title={block.name}
      {...dragItem({ kind: 'block', id: block.id })}
      onClick={() => api.addBlock(block.id)}
      className="overflow-hidden rounded-lg border border-canvas-border bg-canvas-muted text-left hover:border-canvas-muted-foreground"
    >
      <div className="aspect-[8/5]" style={{ background: roles.bg }}>
        {/* biome-ignore lint/performance/noImgElement: a local data URL */}
        {url && <img src={url} alt="" className="size-full" />}
      </div>
      <div className="truncate px-2 py-1.5 text-[11px] text-canvas-foreground">{block.name}</div>
    </button>
  );
}

/** One group of art shapes, drawn in the design's colors. */
function ShapeSection({ api, group }: { api: StudioApi; group: ICArtGroup }) {
  return (
    <>
      <div className={`${LABEL} mt-4`}>{group}</div>
      <div className="grid grid-cols-4 gap-1.5">
        {/* Streaks stays drawable for designs that have it, but a background pattern replaced it here. */}
        {ART.filter((a) => a.group === group && !isFrameVariant(a.id) && a.id !== 'streaks').map((a) => (
          <ArtTile key={a.id} api={api} art={a} small />
        ))}
      </div>
    </>
  );
}

export function ElementsPanel({ api }: { api: StudioApi }) {
  const add = 'grid grid-cols-2 gap-1.5';
  // Drawn on the design's background in its accent, like the art tiles beside them.
  const { accent, bg } = designRoles(api.layout);
  return (
    <div>
      <div className={LABEL}>Text</div>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          className={SMALL}
          {...dragItem({ kind: 'text' })}
          onClick={() => api.addText('text')}
        >
          Text
        </button>
        <button
          type="button"
          className={SMALL}
          {...dragItem({ kind: 'pill' })}
          onClick={() => api.addText('pill')}
        >
          Badge
        </button>
        <button
          type="button"
          className={SMALL}
          {...dragItem({ kind: 'button' })}
          onClick={() => api.addButton()}
        >
          Button
        </button>
      </div>
      <div className={`${LABEL} mt-4`}>Images</div>
      <div className={add}>
        <button type="button" className={SMALL} onClick={() => api.pickImage('add')}>
          Upload file
        </button>
      </div>
      <AIElementForm api={api} />
      <AIBackgroundBlock api={api} />
      <div className={`${LABEL} mt-4`}>Blocks</div>
      <div className="grid grid-cols-2 gap-1.5">
        {BLOCKS.map((block) => (
          <BlockTile key={block.id} api={api} block={block} />
        ))}
      </div>
      {WEB3_GROUPS.map((g) => (
        <ShapeSection key={g} api={api} group={g} />
      ))}
      <div className={`${LABEL} mt-4`}>Shapes</div>
      <div className="grid grid-cols-4 gap-1.5">
        {(['rect', 'ellipse'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            title={kind === 'rect' ? 'Rectangle' : 'Circle'}
            {...dragItem({ kind })}
            onClick={() => api.addShape(kind)}
            className={`${TILE} aspect-square h-auto`}
            style={{ background: bg }}
          >
            <span
              className={`block ${kind === 'rect' ? 'h-6 w-8 rounded-sm' : 'size-7 rounded-full'}`}
              style={{ background: accent }}
            />
          </button>
        ))}
        <button
          type="button"
          title="Line"
          {...dragItem({ kind: 'line' })}
          onClick={() => api.addLine()}
          className={`${TILE} aspect-square h-auto`}
          style={{ background: bg }}
        >
          <span className="block h-0.5 w-9" style={{ background: accent }} />
        </button>
        {ART.filter((a) => a.kind === 'shape' && !a.group).map((a) => (
          <ArtTile key={a.id} api={api} art={a} small />
        ))}
      </div>
      <div className={`${LABEL} mt-4`}>Characters</div>
      <div className="grid grid-cols-3 gap-1.5">
        {ART.filter((a) => a.kind === 'character').map((a) => (
          <ArtTile key={a.id} api={api} art={a} />
        ))}
      </div>
    </div>
  );
}

const FONT_OPTIONS = (Object.keys(IC_FONT_STACKS) as ICFont[]).map((value) => ({
  value,
  label: IC_FONT_LABELS[value],
}));

// A dropdown instead of a slider: a `Range` next to the font picker was too narrow to
// show its own label and track (user report).
const AVATAR_TEXT_SIZES = [
  { value: '4', label: 'Small' },
  { value: '5.5', label: 'Medium' },
  { value: '7', label: 'Large' },
  { value: '9', label: 'Extra large' },
];

/** Font size as minus, the size in pixels at the 1080 wide design, and plus. */
function SizeStepper({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  const px = Math.round(value * 10.8);
  const set = (next: number) => onChange(Math.min(648, Math.max(16, next)) / 10.8);
  const [draft, setDraft] = useState(String(px));
  useEffect(() => setDraft(String(px)), [px]);
  const step =
    'flex size-7 items-center justify-center text-canvas-muted-foreground hover:text-canvas-foreground';
  return (
    <div className="flex h-7 items-center rounded-md border border-canvas-border" title="Font size">
      <button type="button" aria-label="Smaller" className={step} onClick={() => set(px - 1)}>
        <Minus className="size-3.5" />
      </button>
      <input
        aria-label="Font size"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={() => (draft ? set(Number(draft)) : setDraft(String(px)))}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="h-full w-10 border-x border-canvas-border bg-transparent text-center text-[12px] text-canvas-foreground focus:outline-none"
      />
      <button type="button" aria-label="Bigger" className={step} onClick={() => set(px + 1)}>
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    // The name shows on hover, so the bar stays on one row.
    <input
      type="color"
      title={label}
      aria-label={label}
      value={value || '#000000'}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-8 cursor-pointer rounded-md border border-canvas-border bg-canvas p-0.5"
    />
  );
}

/** A square icon-only button, for bar actions shown as a plain glyph. */
/** Names a layer as a slot, so the Create design node shows it as an input a workflow can fill. */
function SlotControls({ api, el }: { api: StudioApi; el: ICElement }) {
  const type = slotTypeOf(el);
  const [draft, setDraft] = useState(el.slot ?? '');
  const [error, setError] = useState<string | null>(null);
  if (!type) return null;
  const commit = () => {
    const name = cleanSlotName(draft);
    setDraft(name);
    if (!name) return setError(null);
    if (!isSlotName(name)) return setError('Start with a letter; use letters, digits and _.');
    const clash = listSlots(api.layout).find((s) => s.name === name && s.type !== type);
    if (clash) return setError(`"${name}" is already a ${clash.type} slot.`);
    setError(null);
    api.patch(el.id, { slot: name });
  };
  return (
    <div>
      <div className={LABEL}>Slot name</div>
      <input
        // biome-ignore lint/a11y/noAutofocus: opened by the user's own Slot click
        autoFocus
        value={draft}
        placeholder="e.g. title, price, photo"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className={INPUT}
      />
      {error && <div className="mt-1.5 text-[11px] text-red-300">{error}</div>}
      <p className="mt-2 text-[11px] leading-relaxed text-canvas-muted-foreground">
        A Playground workflow can fill this in by name.
      </p>
      {api.standalone && (
        <Link href="/playground" className={`${SMALL} mt-2 flex w-full items-center justify-center gap-1.5`}>
          Open Playground <ArrowRight className="size-3.5" />
        </Link>
      )}
      {el.slot && (
        <button
          type="button"
          className={`${SMALL} mt-2 w-full`}
          onClick={() => {
            api.patch(el.id, { slot: undefined });
            setDraft('');
          }}
        >
          Remove slot
        </button>
      )}
    </div>
  );
}

/** One of the bold, italic and underline toggles, sharing a frame like the alignment buttons. */
function FormatToggle({
  icon: Icon,
  title,
  on,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={on}
      onClick={onClick}
      className={`rounded p-1 ${on ? 'bg-canvas text-canvas-foreground' : 'text-canvas-muted-foreground hover:text-canvas-foreground'}`}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

const KIND_ORDER: Kind[] = ['new', 'imp', 'fix'];
const KIND_UI: Record<Kind, { glyph: string; label: string; cls: string }> = {
  new: { glyph: '+', label: 'New', cls: 'text-sky-300' },
  imp: { glyph: '↑', label: 'Improved', cls: 'text-teal-300' },
  fix: { glyph: '✓', label: 'Fixed', cls: 'text-rose-300' },
};

/** A list template's items: add, remove, and set each one's kind, screenshot or item count. */
function ItemsSection({ api }: { api: StudioApi }) {
  const info = findTemplate(api.layout.templateId).list;
  if (!info) return null;
  const titles = itemTitles(api.layout, info);
  const edit = (e: ListEdit) => {
    api.select(null);
    api.update((l) =>
      editList(l, findTemplate(l.templateId), e, (next, prev, prevT) =>
        layoutFromTemplate(next, prev, prevT, prev.ratio ?? defaultRatio(next)),
      ),
    );
  };
  const changes = info.shape === 'changelog' ? parseChanges(info.spec) : [];
  const counts = info.shape === 'products' ? parseProducts(info.spec) : [];
  const active = info.shape === 'ranked' ? parseRanked(info.spec).active : -1;
  const photos = changes.filter((c) => c.photo).length;
  const n = titles.length;
  const noun = info.shape === 'products' ? 'product' : info.shape === 'ranked' ? 'model' : 'item';
  return (
    <div className="space-y-1">
      {titles.map((title, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: items are positional, their titles can repeat
        <div key={i} className="flex items-center gap-1.5 text-[12px]">
          <span className="w-4 shrink-0 text-right text-canvas-muted-foreground/70">{i + 1}</span>
          {info.shape === 'changelog' && (
            <>
              <button
                type="button"
                title={`${KIND_UI[changes[i].kind].label}. Click to change.`}
                onClick={() =>
                  edit({
                    op: 'kind',
                    index: i,
                    kind: KIND_ORDER[(KIND_ORDER.indexOf(changes[i].kind) + 1) % KIND_ORDER.length],
                  })
                }
                className={`${SMALL} w-7 px-0 font-bold ${KIND_UI[changes[i].kind].cls}`}
              >
                {KIND_UI[changes[i].kind].glyph}
              </button>
              <IconButton
                icon={ImagePlus}
                title={changes[i].photo ? 'Remove the screenshot' : 'Add a screenshot'}
                active={changes[i].photo}
                disabled={!changes[i].photo && photos >= (info.photoMax ?? 4)}
                onClick={() => edit({ op: 'photo', index: i, photo: !changes[i].photo })}
              />
            </>
          )}
          {info.shape === 'ranked' && (
            <IconButton
              icon={Star}
              title={i === active ? 'The highlighted model' : 'Highlight this model'}
              active={i === active}
              onClick={() => edit({ op: 'active', index: i })}
            />
          )}
          <span className="min-w-0 flex-1 truncate">{title || `Untitled ${noun}`}</span>
          {info.shape === 'products' && (
            <span className="flex shrink-0 items-center gap-1">
              <IconButton
                icon={Minus}
                title="One item fewer"
                disabled={counts[i] <= 1}
                onClick={() => edit({ op: 'remove-item', product: i })}
              />
              <span className="w-4 text-center text-canvas-muted-foreground">{counts[i]}</span>
              <IconButton
                icon={Plus}
                title="One more item"
                disabled={counts[i] >= (info.perMax ?? 8)}
                onClick={() => edit({ op: 'add-item', product: i })}
              />
            </span>
          )}
          <IconButton
            icon={X}
            title={`Remove this ${noun}`}
            disabled={n <= info.min}
            onClick={() => edit({ op: 'remove', index: i })}
          />
        </div>
      ))}
      <div className="flex items-center justify-between pt-1.5">
        <button
          type="button"
          disabled={n >= info.max}
          onClick={() => edit({ op: 'add' })}
          className={`${SMALL} flex items-center gap-1`}
        >
          <Plus className="size-3" /> Add {noun}
        </button>
        <span className="text-[11px] text-canvas-muted-foreground/70">
          {n} of {info.max}
        </span>
      </div>
    </div>
  );
}

function IconButton({
  icon: Icon,
  title,
  active,
  disabled,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`${SMALL} px-2 ${active ? 'border-emerald-400 text-emerald-300' : ''}`}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

const AVATAR_TOP_COLORS = ['#3a4a63', '#c8553d', '#2f6b4f', '#efe3cf', '#1a1a1a', '#8c6bff'];
const AVATAR_BOTTOM_COLORS = ['#22252b', '#4a2f22', '#7a5138', '#dfe6ee'];

function SwatchRow({
  colors,
  value,
  onChange,
}: {
  colors: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{ background: c }}
          className={`size-5 rounded-full border-2 ${value === c ? 'border-emerald-500' : 'border-transparent'}`}
        />
      ))}
    </div>
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-full border px-2 py-0.5 text-[10.5px] capitalize ${value === o ? 'border-emerald-500 text-emerald-400' : 'border-canvas-border text-canvas-muted-foreground'}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** All the config-driven avatar's controls: a scoped randomizer, category, skin, head
 *  feature, clothes, accessories and a text line. Its own rail tab (studio.tsx) while an
 *  avatar is selected, since it has far more controls than any other element type's bar. */
export function AvatarEditor({ el, api }: { el: ICAvatarEl; api: StudioApi }) {
  const [randScope, setRandScope] = useState<'earth' | 'space' | 'both'>('both');
  const set = avatarSetFor(el.config.category);
  const patchConfig = (patch: Partial<ICAvatarConfig>) =>
    api.patch(el.id, { config: { ...el.config, ...patch } });

  return (
    <div className="space-y-3">
      <div>
        <div className={LABEL}>Randomize</div>
        <div className="mb-1.5 flex gap-1">
          {(['earth', 'space', 'both'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRandScope(s)}
              className={`flex-1 rounded-md border px-1.5 py-1 text-[10px] ${randScope === s ? 'border-emerald-500 text-emerald-400' : 'border-canvas-border text-canvas-muted-foreground'}`}
            >
              {s === 'both' ? 'Both' : s === 'earth' ? 'Earth' : 'Space'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => api.patch(el.id, { config: randomAvatarConfig(randScope) })}
          className={`${SMALL} w-full`}
        >
          Randomize
        </button>
      </div>
      <div>
        <div className={LABEL}>Category</div>
        <div className="flex gap-1.5">
          {(['earth', 'space'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                const next = avatarSetFor(c);
                patchConfig({
                  category: c,
                  skin: next.skin[2],
                  head: Object.keys(next.head)[0],
                  featureColor: next.featureColors[1],
                  accessories: el.config.accessories.filter((a) => next.accessories.includes(a)),
                });
              }}
              className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${el.config.category === c ? 'border-emerald-500 text-emerald-400' : 'border-canvas-border text-canvas-muted-foreground'}`}
            >
              {c === 'earth' ? 'Earth' : 'Space'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className={LABEL}>Gender</div>
        <div className="flex gap-1.5">
          {(['male', 'female'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => patchConfig({ gender: g })}
              className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${el.config.gender === g ? 'border-emerald-500 text-emerald-400' : 'border-canvas-border text-canvas-muted-foreground'}`}
            >
              {g === 'male' ? 'Male' : 'Female'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className={LABEL}>Text on top</div>
        <input
          type="text"
          value={el.config.text}
          maxLength={14}
          placeholder="GM, WAGMI, your ticker..."
          onChange={(e) => patchConfig({ text: e.target.value })}
          className={`${INPUT} mb-1.5`}
        />
        <div className="flex gap-1.5">
          <div className="flex-1">
            <ThemedSelect
              id="ic-avatar-font"
              value={el.config.textFont}
              options={FONT_OPTIONS}
              onChange={(v) => patchConfig({ textFont: v as ICFont })}
            />
          </div>
          <div className="w-28">
            <ThemedSelect
              id="ic-avatar-text-size"
              value={String(el.config.textSize)}
              options={AVATAR_TEXT_SIZES}
              onChange={(v) => patchConfig({ textSize: Number(v) })}
            />
          </div>
        </div>
      </div>
      <div>
        <div className={LABEL}>Skin</div>
        <SwatchRow
          colors={set.skin}
          value={el.config.skin}
          onChange={(v) => patchConfig({ skin: v })}
        />
      </div>
      <div>
        <div className={LABEL}>Expression</div>
        <ChipRow
          options={Object.keys(EXPRESSIONS)}
          value={el.config.expression}
          onChange={(v) => patchConfig({ expression: v })}
        />
      </div>
      <div>
        <div className={LABEL}>
          {el.config.category === 'earth' ? 'Hair / headwear' : 'Head feature'}
        </div>
        <ChipRow
          options={Object.keys(set.head)}
          value={el.config.head}
          onChange={(v) => patchConfig({ head: v })}
        />
        <div className="mt-1.5">
          <SwatchRow
            colors={set.featureColors}
            value={el.config.featureColor}
            onChange={(v) => patchConfig({ featureColor: v })}
          />
        </div>
      </div>
      <div>
        <div className={LABEL}>Top</div>
        <ChipRow
          options={Object.keys(AVATAR_TOP)}
          value={el.config.top}
          onChange={(v) => patchConfig({ top: v })}
        />
        <div className="mt-1.5">
          <SwatchRow
            colors={AVATAR_TOP_COLORS}
            value={el.config.topColor}
            onChange={(v) => patchConfig({ topColor: v })}
          />
        </div>
      </div>
      <div>
        <div className={LABEL}>Bottom</div>
        <ChipRow
          options={Object.keys(AVATAR_BOTTOM)}
          value={el.config.bottom}
          onChange={(v) => patchConfig({ bottom: v })}
        />
        <div className="mt-1.5">
          <SwatchRow
            colors={AVATAR_BOTTOM_COLORS}
            value={el.config.bottomColor}
            onChange={(v) => patchConfig({ bottomColor: v })}
          />
        </div>
      </div>
      <div>
        <div className={LABEL}>Shoes</div>
        <ChipRow
          options={Object.keys(AVATAR_SHOES)}
          value={el.config.shoes}
          onChange={(v) => patchConfig({ shoes: v })}
        />
      </div>
      <div>
        <div className={LABEL}>Accessories</div>
        <div className="flex flex-wrap gap-1">
          {set.accessories.map((a) => {
            const on = el.config.accessories.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() =>
                  patchConfig({
                    accessories: on
                      ? el.config.accessories.filter((x) => x !== a)
                      : [...el.config.accessories, a],
                  })
                }
                className={`rounded-full border px-2 py-0.5 text-[10.5px] ${on ? 'border-emerald-500 text-emerald-400' : 'border-canvas-border text-canvas-muted-foreground'}`}
              >
                {ACCESSORY_LABELS[a] ?? a}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** A titled block of the inspector that folds away. */
function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-canvas-border px-3.5 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70 hover:text-canvas-muted-foreground"
      >
        {title}
        <ChevronDown className={`ml-auto size-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="mt-2.5 space-y-2.5">{children}</div>}
    </section>
  );
}

/** A label on the left and its controls on the right. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11.5px]">
      <span className="w-16 shrink-0 text-canvas-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

/** A slider that fills its row, with the value beside it. */
function Slider({
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-emerald-500"
      />
      <span className="w-9 text-right text-[11px] text-canvas-muted-foreground">
        {Math.round(value)}
        {unit}
      </span>
    </>
  );
}

const ALIGNMENTS = [
  ['left', AlignLeft],
  ['center', AlignCenter],
  ['right', AlignRight],
] as const;

/** Sections that start folded; the rest start open. Kept across selections. */
const FOLDED = new Set(['Playground slot']);

/** The right-hand panel. Section names and order follow Figma's Design panel, so they read familiar. */
export function Inspector({ api }: { api: StudioApi }) {
  const { layout, selId } = api;
  const el = layout.els.find((e) => e.id === selId);
  const [tab, setTab] = useState<'design' | 'layers'>('design');
  const [, refold] = useState(0);
  const section = (title: string, children: ReactNode) => (
    <Section
      title={title}
      open={!FOLDED.has(title)}
      onToggle={() => {
        if (FOLDED.has(title)) FOLDED.delete(title);
        else FOLDED.add(title);
        refold((n) => n + 1);
      }}
    >
      {children}
    </Section>
  );
  // Nothing picked, or the canvas background clicked: both show the whole design's settings.
  const design = (!selId || selId === 'bg') && api.multiSel.length === 0;
  const selEls = api.multiSel
    .map((id) => layout.els.find((e) => e.id === id))
    .filter((e): e is ICElement => e !== undefined);
  const grouped =
    selEls.length > 1 &&
    selEls[0].groupId !== undefined &&
    selEls.every((e) => e.groupId === selEls[0].groupId);
  const tabClass = (on: boolean) =>
    `flex-1 rounded-md py-1 text-[11.5px] ${on ? 'bg-canvas-muted text-canvas-foreground' : 'text-canvas-muted-foreground hover:text-canvas-foreground'}`;

  return (
    <aside className="flex min-h-0 flex-col border-l border-canvas-border bg-canvas-raised">
      <div className="flex gap-1 border-b border-canvas-border p-2">
        <button type="button" className={tabClass(tab === 'design')} onClick={() => setTab('design')}>
          Design
        </button>
        <button type="button" className={tabClass(tab === 'layers')} onClick={() => setTab('layers')}>
          Layers
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'layers' ? (
          <LayersPanel api={api} />
        ) : (
          <>
            {api.multiSel.length > 1 &&
              section(
                'Selection',
                <Row label={`${api.multiSel.length} layers`}>
                  <button
                    type="button"
                    title={grouped ? 'Ungroup (Shift+Cmd+G)' : 'Group (Cmd+G)'}
                    onClick={grouped ? api.ungroup : api.group}
                    className={`${SMALL} flex items-center gap-1.5`}
                  >
                    {grouped ? <Ungroup className="size-3.5" /> : <Group className="size-3.5" />}
                    {grouped ? 'Ungroup' : 'Group'}
                  </button>
                </Row>,
              )}
            {design && section('UI Kit', <BrandFields api={api} />)}
            {design && findTemplate(api.layout.templateId).list && section('Items', <ItemsSection api={api} />)}
            {design && section('Frame', <SizePicker api={api} />)}
            {/* Right under Frame: the grid belongs to it, and it's easy to miss further down. */}
            {design && section('Layout grid', <GridControls api={api} />)}
            {design && (
              <>
                {section('Fill', <BackgroundControls api={api} />)}
                {section(
                  'Texture',
                  <>
                    <TextureControls api={api} />
                    {!layout.scene.on && !api.standalone && (
                      <button
                        type="button"
                        className={`${SMALL} flex w-full items-center justify-center gap-1.5`}
                        onClick={() => {
                          api.update((l) => ({ ...l, scene: { ...l.scene, on: true } }));
                          api.select('scene');
                        }}
                      >
                        <Eye className="size-3.5" /> Show AI background
                      </button>
                    )}
                  </>,
                )}
              </>
            )}
            {selId === 'scene' &&
              section(
                'AI background',
                <div className="flex flex-wrap gap-1.5">
                  <IconButton
                    icon={layout.scene.upload ? ImageUp : ImagePlus}
                    title={layout.scene.upload ? 'Replace image' : 'Upload image'}
                    onClick={() => api.pickImage('scene')}
                  />
                  {layout.scene.upload && (
                    <IconButton
                      icon={Trash2}
                      title="Remove uploaded image"
                      onClick={() => api.update((l) => ({ ...l, scene: { ...l.scene, upload: null } }))}
                    />
                  )}
                  <IconButton
                    icon={EyeOff}
                    title="Turn off (use the background color)"
                    onClick={() => {
                      api.update((l) => ({ ...l, scene: { ...l.scene, on: false } }));
                      api.select('bg');
                    }}
                  />
                </div>,
              )}
            {el && <LayerSections api={api} el={el} section={section} />}
          </>
        )}
      </div>
    </aside>
  );
}

/** The brand and, on a co-brand design, the partner. */
function BrandFields({ api }: { api: StudioApi }) {
  const { layout } = api;
  const current = layout.templateId === 'blank' ? undefined : findTemplate(layout.templateId);
  const brand = current?.brand ?? brandOfKit(layout.kit?.id) ?? ANNOUNCE_BRANDS[0].id;
  const partnerLogo = layout.els.find((e) => e.slot === 'partner_logo');
  const cobrand = ALL_TEMPLATES.find((t) => t.pack === 'Partnership' && t.brand === brand);
  return (
    <>
      <BrandPicker api={api} />
      {layout.partner ? (
        <div className="space-y-1.5">
          <Row label="Partner">
            <button
              type="button"
              title="Replace the partner's logo. Its color goes onto their side."
              onClick={() => api.pickImage('partner')}
              className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-md border border-canvas-border bg-white px-2"
            >
              {partnerLogo?.t === 'image' && (
                // biome-ignore lint/performance/noImgElement: a local data URL
                <img src={partnerLogo.url} alt="Partner logo" className="max-h-5 max-w-full object-contain" />
              )}
            </button>
          </Row>
          {/* Under the logo, lined up past Row's w-16 label and gap-2. */}
          <div className="flex items-center gap-1.5 pl-[72px]">
            <ColorInput
              label="Partner color"
              value={layout.partner.accent}
              onChange={(v) => api.setPartnerColor(v)}
            />
            <IconButton icon={ArrowLeftRight} title="Swap sides" onClick={api.swapBrands} />
            <IconButton
              icon={X}
              title="Remove the partner's logo and color from every template"
              onClick={api.clearPartner}
            />
          </div>
        </div>
      ) : (
        cobrand && (
          <button
            type="button"
            title="Switch to a co-brand layout with a partner's logo beside yours"
            className={`${SMALL} flex w-full items-center justify-center gap-1 py-1.5`}
            onClick={() => api.chooseTemplate(cobrand)}
          >
            <Plus className="size-3" /> Add partner
          </button>
        )
      )}
    </>
  );
}

/** A selected layer's sections: first what only its kind has, then Figma's Position, Layout,
 *  Appearance, Typography, Fill, Stroke and Effects, each shown only when the layer uses it. */
function LayerSections({
  api,
  el,
  section,
}: {
  api: StudioApi;
  el: ICElement;
  section: (title: string, children: ReactNode) => ReactNode;
}) {
  const patch = (p: Partial<Record<string, unknown>>) => api.patch(el.id, p);
  // In the design's own pixels, as Figma shows them: 1600 wide for an X Post, and so on.
  const W = designWidth(api.layout);
  const box = layerBox(el, api.layout, W);
  const px = { W, H: canvasHeight(api.layout, W), x: box.x, y: box.y, w: box.w, h: box.h };
  const isPhoto = el.t === 'subject' || el.t === 'image';
  const isWords = el.t === 'text' || el.t === 'pill';
  const bold = isWords && el.weight >= 700;
  const art = el.t === 'art' ? artDef(el.art) : undefined;
  const artActions =
    el.t === 'art' &&
    (isScreen(el.art) || art?.group === 'Arrows' || isChart(el.art) || isCode(el.art) || isTexture(el));
  const corner =
    el.t === 'image' && el.h !== undefined ? (
      <Row label="Radius">
        <Slider value={el.radius ?? 0} min={0} max={50} step={0.5} onChange={(v) => patch({ radius: v })} />
      </Row>
    ) : el.t === 'shape' ? (
      <Row label="Radius">
        <Slider value={el.radius} min={0} max={50} step={0.5} onChange={(v) => patch({ radius: v })} />
      </Row>
    ) : el.t === 'pill' && el.look !== 'bracket' && el.look !== 'link' ? (
      <Row label="Radius">
        <Slider
          value={roundness(el, api.layout)}
          min={0}
          max={100}
          onChange={(v) => patch({ radius: cornerRadius(el, api.layout, v) })}
        />
      </Row>
    ) : null;
  const fills =
    el.t === 'text' || el.t === 'line'
      ? [['Color', el.color, (v: string) => patch({ color: v })] as const]
      : el.t === 'pill' || el.t === 'shape'
        ? [['Fill', el.fill, (v: string) => patch({ fill: v })] as const]
        : el.t === 'art'
          ? (art?.slots ?? []).map(
              (slot) =>
                [
                  slot.label,
                  el.colors[slot.key] ?? slot.color,
                  (v: string) => patch({ colors: { ...el.colors, [slot.key]: v } }),
                ] as const,
            )
          : [];

  return (
    <>
      {isPhoto &&
        section(
          'Image',
          <>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                className={`${SMALL} flex items-center justify-center gap-1.5`}
                onClick={() => api.pickImage(el.t === 'subject' ? 'subject' : 'layer')}
              >
                <ImageUp className="size-3.5" /> Replace
              </button>
              {isCroppable(el) && (
                <button
                  type="button"
                  title={el.lock ? 'Unlock to crop' : undefined}
                  disabled={el.lock}
                  onClick={() => api.setCrop(api.cropId === el.id ? null : el.id)}
                  className={`${SMALL} flex items-center justify-center gap-1.5 ${api.cropId === el.id ? 'border-emerald-400 text-emerald-300' : ''}`}
                >
                  <Crop className="size-3.5" /> {api.cropId === el.id ? 'Done' : 'Crop'}
                </button>
              )}
              <button
                type="button"
                onClick={() => patch({ flip: !el.flip })}
                className={`${SMALL} flex items-center justify-center gap-1.5 ${el.flip ? 'border-emerald-400 text-emerald-300' : ''}`}
              >
                <FlipHorizontal2 className="size-3.5" /> Flip
              </button>
              {el.t === 'image' && el.gen && (
                <button
                  type="button"
                  title={api.genError ?? 'A new take of the same prompt'}
                  disabled={api.genBusy !== null}
                  onClick={() => void api.regenerateElement(el.id)}
                  className={`${SMALL} col-span-3 flex items-center justify-center gap-1.5`}
                >
                  <RefreshCw className="size-3.5" /> {api.genBusy === el.id ? 'Regenerating…' : 'Regenerate'}
                </button>
              )}
            </div>
            <CutoutControls
              api={api}
              id={el.id}
              source={el.t === 'subject' ? api.layout.subject : el}
            />
          </>,
        )}
      {el.t === 'pill' &&
        section(
          'Button',
          <>
            <div className="flex items-center justify-between text-[11.5px] text-canvas-muted-foreground">
              Style
              <IconButton
                icon={RefreshCw}
                title="Shuffle: the next button style"
                onClick={() => api.update((l) => restyleIn(l, el.id, nextLook(el.look)))}
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {BUTTON_LOOKS.map(([look, name]) => (
                <button
                  key={look}
                  type="button"
                  onClick={() => api.update((l) => restyleIn(l, el.id, look))}
                  className={`${SMALL} ${el.look === look ? 'border-emerald-400 text-emerald-300' : ''}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </>,
        )}
      {el.t === 'art' &&
        (isHero(el.art) || artActions) &&
        section(
          'Art',
          <>
            {isHero(el.art) && (
              <>
                <div className="flex items-center justify-between text-[11.5px] text-canvas-muted-foreground">
                  Shape
                  <IconButton
                    icon={RefreshCw}
                    title="Shuffle: another shape in the same spot"
                    onClick={() => api.update((l) => swapArt(l, el.id))}
                  />
                </div>
                <div className="grid max-h-60 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
                  {HERO_ART.map((id) => {
                    const def = artDef(id);
                    if (!def) return null;
                    const on = el.art === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        title={def.name}
                        onClick={() => api.update((l) => swapArt(l, el.id, id))}
                        className={`flex aspect-square items-center justify-center rounded-lg border bg-canvas-muted p-1.5 ${
                          on
                            ? 'border-emerald-400'
                            : 'border-canvas-border hover:border-canvas-muted-foreground'
                        }`}
                      >
                        {/* biome-ignore lint/performance/noImgElement: a local SVG data URL */}
                        <img src={artUrl(def, swapColors(api.layout, el, def))} alt={def.name} className="max-h-full max-w-full" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {artActions && (
              <div className="flex flex-wrap gap-1.5">
                {isScreen(el.art) && (
                  <>
                    <IconButton icon={ImageUp} title="Replace screenshot" onClick={() => api.pickImage('shot')} />
                    <IconButton
                      icon={RefreshCw}
                      title="Shuffle: another device of the same kind"
                      onClick={() => api.update((l) => swapArt(l, el.id, otherScreen(el.art)))}
                    />
                  </>
                )}
                {art?.group === 'Arrows' && (
                  <IconButton icon={FlipHorizontal2} title="Flip" active={el.flip} onClick={() => patch({ flip: !el.flip })} />
                )}
                {(isChart(el.art) || isCode(el.art)) && (
                  <button
                    type="button"
                    onClick={() => api.setEdit(api.editId === el.id ? null : el.id)}
                    className={`${SMALL} ${api.editId === el.id ? 'border-emerald-400 text-emerald-300' : ''}`}
                  >
                    {isCode(el.art) ? 'Edit code' : 'Edit data'}
                  </button>
                )}
                {isTexture(el) && (
                  <button
                    type="button"
                    title="A new texture in any style"
                    className={`${SMALL} flex items-center gap-1`}
                    onClick={() => api.update(shuffleTexture)}
                  >
                    <RefreshCw className="size-3.5" /> Shuffle
                  </button>
                )}
              </div>
            )}
          </>,
        )}
      {el.t === 'avatar' &&
        section('Avatar', <p className="text-[11.5px] text-canvas-muted-foreground">Edit it in the Avatar tab.</p>)}
      {section(
        'Position',
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField label="X" value={px.x} onCommit={(v) => patch({ x: (v / px.W) * 100 })} />
            <NumberField label="Y" value={px.y} onCommit={(v) => patch({ y: (v / px.H) * 100 })} />
          </div>
          <Row label="Rotation">
            <Slider value={el.rot ?? 0} min={-180} max={180} unit="°" onChange={(v) => patch({ rot: v })} />
            <IconButton
              icon={RotateCcw}
              title="Reset rotation"
              disabled={!el.rot}
              onClick={() => patch({ rot: 0 })}
            />
          </Row>
          <Row label="Order">
            <button
              type="button"
              className={`${SMALL} flex flex-1 items-center justify-center gap-1.5`}
              onClick={() => api.move(1)}
            >
              <ArrowUp className="size-3.5" /> Forward
            </button>
            <button
              type="button"
              className={`${SMALL} flex flex-1 items-center justify-center gap-1.5`}
              onClick={() => api.move(-1)}
            >
              <ArrowDown className="size-3.5" /> Back
            </button>
          </Row>
        </>,
      )}
      {'w' in el &&
        section(
          'Layout',
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField label="W" value={px.w} onCommit={(v) => v > 0 && patch({ w: (v / px.W) * 100 })} />
            <NumberField
              label="H"
              value={px.h}
              // Text, and pictures drawn at their own shape, take their height from their width.
              disabled={!hasHeight(el)}
              title={hasHeight(el) ? undefined : 'Follows the width'}
              onCommit={(v) => v > 0 && patch({ h: (v / px.H) * 100 })}
            />
          </div>,
        )}
      {section(
        'Appearance',
        <>
          <Row label="Opacity">
            <Slider
              value={Math.round((el.op ?? 1) * 100)}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => patch({ op: v / 100 })}
            />
          </Row>
          {corner}
        </>,
      )}
      {isWords &&
        section(
          'Typography',
          <>
            <ThemedSelect id="ic-font" value={el.font} options={FONT_OPTIONS} onChange={(v) => patch({ font: v })} />
            <Row label="Size">
              <SizeStepper value={el.size} onChange={(size) => patch({ size })} />
            </Row>
            {el.t === 'pill' && (
              <Row label="Color">
                <ColorInput label="Text color" value={el.color} onChange={(v) => patch({ color: v })} />
              </Row>
            )}
            <Row label="Style">
              <div className="flex rounded-md border border-canvas-border p-0.5">
                {!isFixedWeight(el.font) && (
                  <FormatToggle icon={Bold} title="Bold" on={bold} onClick={() => patch({ weight: bold ? 400 : 700 })} />
                )}
                <FormatToggle icon={Italic} title="Italic" on={!!el.italic} onClick={() => patch({ italic: !el.italic })} />
                <FormatToggle
                  icon={Underline}
                  title="Underline"
                  on={!!el.underline}
                  onClick={() => patch({ underline: !el.underline })}
                />
                {el.t === 'text' && (
                  <FormatToggle
                    icon={WrapText}
                    title={el.wrap === false ? 'Wrap lines at the box width' : 'Keep each line on one row'}
                    on={el.wrap !== false}
                    onClick={() => patch({ wrap: el.wrap === false ? undefined : false })}
                  />
                )}
              </div>
              {el.t === 'text' && (
                <div className="flex rounded-md border border-canvas-border p-0.5">
                  {ALIGNMENTS.map(([a, Icon]) => (
                    <button
                      key={a}
                      type="button"
                      title={`Align ${a}`}
                      aria-label={`Align ${a}`}
                      onClick={() => patch({ align: a })}
                      className={`rounded p-1 ${el.align === a ? 'bg-canvas text-canvas-foreground' : 'text-canvas-muted-foreground'}`}
                    >
                      <Icon className="size-3.5" />
                    </button>
                  ))}
                </div>
              )}
            </Row>
          </>,
        )}
      {fills.length > 0 &&
        section(
          'Fill',
          fills.map(([label, value, set]) => (
            <Row key={label} label={label}>
              <ColorInput label={label} value={value} onChange={set} />
            </Row>
          )),
        )}
      {el.t === 'shape' &&
        section(
          'Stroke',
          <Row label="Color">
            <ColorInput label="Stroke" value={el.stroke} onChange={(v) => patch({ stroke: v })} />
          </Row>,
        )}
      {el.t === 'subject' &&
        section(
          'Effects',
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-[11.5px] text-canvas-muted-foreground">
              <input
                type="checkbox"
                checked={el.shadow}
                onChange={(e) => patch({ shadow: e.target.checked })}
                className="accent-emerald-500"
              />
              Shadow
            </label>
            <label className="flex items-center gap-1.5 text-[11.5px] text-canvas-muted-foreground">
              <input
                type="checkbox"
                checked={el.reflect ?? false}
                onChange={(e) => patch({ reflect: e.target.checked })}
                className="accent-emerald-500"
              />
              Reflection
            </label>
          </div>,
        )}
      {api.multiSel.length <= 1 && slotTypeOf(el) && section('Playground slot', <SlotControls api={api} el={el} />)}
    </>
  );
}

/** Columns, rows and a baseline to line layers up on, shown over the canvas and snapped to. */
function GridControls({ api }: { api: StudioApi }) {
  const grid = api.layout.grid ?? { ...DEFAULT_GRID, on: false };
  const set = (patch: Partial<ICGrid>) =>
    api.update((l) => ({ ...l, grid: { ...(l.grid ?? DEFAULT_GRID), ...patch } }));
  // Shown in pixels at the 1080 wide size a design is drawn at; stored as percent of the width.
  const px = (v: number) => Math.round(v * 10.8);
  const field = (label: string, value: number, max: number, onSet: (v: number) => void) => (
    <label className="flex items-center justify-between gap-3 text-[11.5px] text-canvas-muted-foreground">
      {label}
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onSet(Math.min(max, Math.max(0, Number(e.target.value) || 0)))}
        className="w-16 rounded-md border border-canvas-border bg-canvas px-2 py-1 text-right text-[12px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
      />
    </label>
  );
  const check = (label: string, on: boolean, onSet: (v: boolean) => void) => (
    <label className="flex items-center gap-1.5 text-[11.5px] text-canvas-muted-foreground">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onSet(e.target.checked)}
        className="accent-emerald-400"
      />
      {label}
    </label>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-4">
        {check('Show', grid.on, (on) => set({ on }))}
        {check('Snap', grid.snap, (snap) => set({ snap }))}
      </div>
      <div className={LABEL}>Layout</div>
      {field('Columns', grid.cols, 24, (cols) => set({ cols }))}
      {field('Rows', grid.rows, 24, (rows) => set({ rows }))}
      {field('Gutter, px', px(grid.gutter), 200, (v) => set({ gutter: v / 10.8 }))}
      {field('Margin, px', px(grid.margin), 300, (v) => set({ margin: v / 10.8 }))}
      <div className={LABEL}>Baseline</div>
      {field('Step, px', px(grid.baseline), 64, (v) => set({ baseline: v / 10.8 }))}
      <p className="text-[11px] leading-relaxed text-canvas-muted-foreground">
        Rows at 0 give columns only, a step of 0 hides the baseline. Hold Cmd or Ctrl while
        dragging to place freely.
      </p>
    </div>
  );
}

/** Width as a slider, kept centered, plus a fit for layers wider than the canvas, whose handles can
 *  sit out of reach. Boxes that also have a height scale with it, so the shape keeps its proportions. */
/** A pixel value with a one-letter label, like Figma's X, Y, W and H. Enter or leaving it applies it. */
function NumberField({
  label,
  value,
  onCommit,
  disabled,
  title,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  disabled?: boolean;
  title?: string;
}) {
  const shown = String(Math.round(value));
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  const commit = () => {
    const v = Number(draft);
    if (draft.trim() && Number.isFinite(v) && v !== Math.round(value)) onCommit(v);
    else setDraft(shown);
  };
  return (
    <label
      title={title}
      className={`flex h-7 items-center gap-1.5 rounded-md border border-canvas-border bg-canvas px-2 text-[12px] ${disabled ? 'opacity-50' : ''}`}
    >
      <span className="text-canvas-muted-foreground">{label}</span>
      <input
        value={draft}
        disabled={disabled}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.-]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            onCommit(Math.round(value) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-canvas-foreground focus:outline-none"
      />
    </label>
  );
}

/** Layers whose height is set on its own, apart from their width. */
const hasHeight = (el: ICElement) =>
  (el.t === 'shape' || el.t === 'pill' || el.t === 'image') && el.h !== undefined;

/** The design's width in pixels: its named size, its custom size, or the 1080 it's drawn at. */
function designWidth(layout: ICLayout): number {
  if (layout.ratio === 'custom') return layout.customSize?.width ?? IC_OUTPUT_SIZE;
  return RATIO_DIMENSIONS[layout.ratio as keyof typeof RATIO_DIMENSIONS]?.width ?? IC_OUTPUT_SIZE;
}

/** A badge's radius in canvas-width percent that makes its corners fully round. */
const fullRadius = (e: ICPill, l: ICLayout) =>
  (e.h * ratioHeight(l.ratio, l.customSize)) / 2;

/** How round a badge's corners are, 0 square to 100 fully round. */
const roundness = (e: ICPill, l: ICLayout) =>
  e.radius === undefined ? 100 : Math.round(Math.min(100, (e.radius / fullRadius(e, l)) * 100));

/** Fully round stays unset, so the badge keeps round ends when resized. */
const cornerRadius = (e: ICPill, l: ICLayout, v: number) =>
  v >= 100 ? undefined : (fullRadius(e, l) * v) / 100;

/** The design with one badge switched to another look, in the design's own colors. */
const restyleIn = (l: ICLayout, id: string, look: ButtonLook): ICLayout => ({
  ...l,
  els: l.els.map((x) => (x.id === id && x.t === 'pill' ? restyleButton(x, look, designRoles(l)) : x)),
});

/** What the selection is and can do, for the bar over it and the right-click menu alike. */
function selectionOf(api: StudioApi) {
  const els = api.layout.els.filter((e) => api.selIds.includes(e.id));
  const locked = els.length > 0 && els.every((e) => e.lock);
  const grouped = els.some((e) => e.groupId !== undefined);
  const oneGroup = grouped && els.every((e) => e.groupId === els[0].groupId);
  return { els, locked, grouped, canGroup: api.multiSel.length > 1 && !oneGroup };
}

/** The floating bar over a selection on the canvas, one layer or a group: Duplicate, Lock, Delete,
 *  Group or Ungroup, and z-order extremes. */
export function MiniBar({ api, style }: { api: StudioApi; style: CSSProperties }) {
  const [more, setMore] = useState(false);
  const key = api.selIds.join();
  // biome-ignore lint/correctness/useExhaustiveDependencies: closes the menu when the selection changes
  useEffect(() => setMore(false), [key]);
  const sel = selectionOf(api);
  if (sel.els.length === 0) return null;
  const btn =
    'rounded p-1.5 hover:bg-canvas-muted text-canvas-muted-foreground hover:text-canvas-foreground';
  const labeled = `${btn} flex items-center gap-1 px-2 text-[11.5px]`;
  return (
    // The stage below deselects on pointerdown, so the bar must stop it from bubbling there.
    <div
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute z-10 flex items-center gap-0.5 rounded-lg border border-canvas-border bg-canvas-raised p-1 shadow-xl"
    >
      <button type="button" title="Duplicate (Cmd+D)" onClick={api.duplicate} className={btn}>
        <Copy className="size-3.5" />
      </button>
      <button
        type="button"
        title={sel.locked ? 'Unlock' : 'Lock'}
        onClick={api.toggleLock}
        className={sel.locked ? 'rounded p-1.5 text-emerald-300 hover:bg-canvas-muted' : btn}
      >
        {sel.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
      </button>
      <button type="button" title="Delete" onClick={api.remove} className={btn}>
        <Trash2 className="size-3.5" />
      </button>
      {sel.canGroup && (
        <button type="button" title="Group (Cmd+G)" onClick={api.group} className={labeled}>
          <Group className="size-3.5" /> Group
        </button>
      )}
      {sel.grouped && !sel.canGroup && (
        <button
          type="button"
          title="Ungroup (Shift+Cmd+G)"
          onClick={api.ungroup}
          className={labeled}
        >
          <Ungroup className="size-3.5" /> Ungroup
        </button>
      )}
      <div className="relative">
        <button type="button" title="More" onClick={() => setMore((v) => !v)} className={btn}>
          <MoreHorizontal className="size-3.5" />
        </button>
        {more && (
          <div className="absolute left-1/2 top-full z-10 mt-1.5 w-40 -translate-x-1/2 rounded-xl border border-canvas-border bg-canvas-raised p-1.5 shadow-xl">
            <button
              type="button"
              className={`${SMALL} flex w-full items-center gap-1.5 text-left`}
              onClick={() => {
                api.moveEnd(1);
                setMore(false);
              }}
            >
              <BringToFront className="size-3.5" /> Bring to front
            </button>
            <button
              type="button"
              className={`${SMALL} mt-1 flex w-full items-center gap-1.5 text-left`}
              onClick={() => {
                api.moveEnd(-1);
                setMore(false);
              }}
            >
              <SendToBack className="size-3.5" /> Send to back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The right-click menu over a selection: the bar's actions, as a list with their shortcuts. */
export function SelectionMenu({
  api,
  at,
  onClose,
}: {
  api: StudioApi;
  at: { x: number; y: number };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  // Opened near the window's right or bottom edge, the menu moves back inside it.
  const [pos, setPos] = useState(at);
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setPos({
      x: Math.max(8, Math.min(at.x, window.innerWidth - box.width - 8)),
      y: Math.max(8, Math.min(at.y, window.innerHeight - box.height - 8)),
    });
  }, [at]);
  const sel = selectionOf(api);
  if (sel.els.length === 0) return null;
  const items: [label: string, hint: string, run: () => void, hidden?: boolean][] = [
    ['Duplicate', 'Cmd+D', api.duplicate],
    [sel.locked ? 'Unlock' : 'Lock', '', api.toggleLock],
    ['Group', 'Cmd+G', api.group, !sel.canGroup],
    ['Ungroup', 'Shift+Cmd+G', api.ungroup, !sel.grouped || sel.canGroup],
    ['Bring to front', '', () => api.moveEnd(1)],
    ['Send to back', '', () => api.moveEnd(-1)],
    ['Delete', 'Del', api.remove],
  ];
  return createPortal(
    <div
      ref={ref}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[70] min-w-48 rounded-lg border border-canvas-border bg-canvas-raised py-1 font-mono text-[11.5px] shadow-2xl"
      style={{ left: pos.x, top: pos.y }}
    >
      {items
        .filter(([, , , hidden]) => !hidden)
        .map(([label, hint, run]) => (
          <button
            key={label}
            type="button"
            role="menuitem"
            onClick={() => {
              run();
              onClose();
            }}
            className="flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-canvas-foreground hover:bg-canvas-muted"
          >
            {label}
            <span className="text-canvas-muted-foreground/70">{hint}</span>
          </button>
        ))}
    </div>,
    document.body,
  );
}
