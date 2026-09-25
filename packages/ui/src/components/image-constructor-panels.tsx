'use client';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Braces,
  BringToFront,
  Copy,
  Crop,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Group,
  ImagePlus,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Replace as ReplaceIcon,
  SendToBack,
  Trash2,
  Ungroup,
  Unlock,
  X,
} from 'lucide-react';
import {
  type ComponentType,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ANNOUNCE_BRANDS, brandOfKit, layerBuilder } from './image-constructor-announce.js';
import { ART, artDef, artDefaults, artFor, artPalette, artUrl } from './image-constructor-art.js';
import { BLOCKS, blockStyle, fitBlockLayer, type ICBlock } from './image-constructor-blocks.js';
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
  type ICRatio,
  type ICTemplate,
  designRoles,
  isCroppable,
  layoutFromTemplate,
  layoutRoles,
  HERO_ART,
  isHero,
  patternLayer,
  setPattern,
  shuffleAll,
  swapArt,
  swapColors,
  orientationOf,
  RATIO_DIMENSIONS,
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
import { isPattern, PATTERN_STYLES, patternDef, patternId } from './image-constructor-patterns.js';
import { PALETTES } from './image-constructor-palettes.js';
import { composeLayout } from './image-constructor-render.js';
import { ALL_TEMPLATES, findTemplate, TEMPLATE_PACKS } from './image-constructor-templates.js';
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
  | { kind: 'art' | 'block'; id: string };
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
  pickImage: (target: 'add' | 'layer' | 'subject' | 'scene' | 'partner') => void;
  setPartnerColor: (color: string) => void;
  swapBrands: () => void;
  /** Puts the default partner logo and color back everywhere. */
  clearPartner: () => void;
  duplicate: () => void;
  remove: () => void;
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
}

const LABEL =
  'mb-2 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70';
const INPUT =
  'w-full rounded-lg border border-canvas-border bg-canvas-muted px-2.5 py-2 text-[12.5px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60';
const SMALL =
  'rounded-md border border-canvas-border bg-canvas px-2.5 py-1 text-[12px] text-canvas-foreground hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-40';
const SWATCH =
  'h-5 min-w-0 cursor-pointer rounded border border-canvas-border hover:border-canvas-foreground';

// Real post types instead of a bare ratio, each with its own real size. `elementsFor`
// already picks the closest hand-made layout by orientation, so nothing here is
// hardcoded to today's two templates.
const RATIO_LABELS: Record<string, string> = {
  'x-post': 'X post',
  'linkedin-post': 'LinkedIn',
  'ig-post': 'Instagram',
  // IG Story and TikTok Story were two identical 1080x1920 entries (user); YouTube
  // Thumbnail is gone.
  story: 'Story',
};

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
      right: d ? `${d.width}×${d.height}` : undefined,
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
      label="Size"
      value={
        ratio === 'custom'
          ? `Custom · ${current?.width ?? '?'}×${current?.height ?? '?'}`
          : `${RATIO_LABELS[ratio] ?? ratio} · ${current?.width}×${current?.height}`
      }
      lead={<RatioIcon w={current?.width ?? 1} h={current?.height ?? 1} />}
      sections={[
        {
          title: 'Posts',
          items: [
            item('x-post', 'X post'),
            item('linkedin-post', 'LinkedIn'),
            item('ig-post', 'Instagram'),
          ],
        },
        { title: 'Tall', items: [item('story', 'Story')] },
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
function templatePreview(t: ICTemplate): Promise<string> {
  let pending = previews.get(t.id);
  if (!pending) {
    pending = composeLayout(layoutFromTemplate(t, undefined, undefined, t.ratio), null, {
      width: 480,
      format: 'jpeg',
      quality: 0.85,
    });
    previews.set(t.id, pending);
  }
  return pending;
}

function RenderedThumb({ template }: { template: ICTemplate }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    templatePreview(template)
      .then((u) => live && setUrl(u))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [template]);
  return (
    // The card takes the preview's own X shape, so the design is shown whole, never cropped.
    <div className="relative" style={{ background: template.thumb, aspectRatio: '16 / 9' }}>
      {/* biome-ignore lint/performance/noImgElement: a local data URL */}
      {url && <img src={url} alt="" className="absolute inset-0 size-full" />}
    </div>
  );
}

function Thumb({ template }: { template: ICTemplate }) {
  if (template.kit) return <RenderedThumb template={template} />;
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

/** What the design is, whichever tab is open: its brand, its size and, on a co-brand design, the partner. */
export function BrandBar({ api }: { api: StudioApi }) {
  const { layout } = api;
  const current = layout.templateId === 'blank' ? undefined : findTemplate(layout.templateId);
  const brand = current?.brand ?? brandOfKit(layout.kit?.id) ?? ANNOUNCE_BRANDS[0].id;
  const partnerLogo = layout.els.find((e) => e.slot === 'partner_logo');
  const cobrand = ALL_TEMPLATES.find((t) => t.pack === 'Co-brand' && t.brand === brand);
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-canvas-border px-4 py-2">
      <BrandPicker api={api} />
      <SizePicker api={api} />
      <span className="mx-1.5 h-5 w-px shrink-0 bg-canvas-border" />
      {layout.partner ? (
        <>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70">
            Partner
          </span>
          <button
            type="button"
            title="Replace the partner's logo. Its color goes onto their side."
            onClick={() => api.pickImage('partner')}
            className="flex h-7 w-20 shrink-0 items-center justify-center rounded-md border border-canvas-border bg-white px-1.5"
          >
            {partnerLogo?.t === 'image' && (
              // biome-ignore lint/performance/noImgElement: a local data URL
              <img
                src={partnerLogo.url}
                alt="Partner logo"
                className="max-h-5 max-w-full object-contain"
              />
            )}
          </button>
          <label title="Partner color" className="flex shrink-0 cursor-pointer items-center">
            <input
              type="color"
              value={layout.partner.accent}
              onChange={(e) => api.setPartnerColor(e.target.value)}
              className="h-7 w-8 cursor-pointer rounded border border-canvas-border bg-canvas"
            />
          </label>
          <button type="button" className={`${SMALL} shrink-0 py-1.5`} onClick={api.swapBrands}>
            Swap sides
          </button>
          <button
            type="button"
            title="Remove the partner's logo and color from every template"
            aria-label="Remove partner logo"
            className="shrink-0 rounded-md p-1.5 text-canvas-muted-foreground hover:bg-canvas-muted hover:text-canvas-foreground"
            onClick={api.clearPartner}
          >
            <X className="size-3.5" />
          </button>
        </>
      ) : (
        cobrand && (
          <button
            type="button"
            title="Switch to a co-brand layout with a partner's logo beside yours"
            className={`${SMALL} flex shrink-0 items-center gap-1 py-1.5`}
            onClick={() => api.chooseTemplate(cobrand)}
          >
            <Plus className="size-3" /> Partner
          </button>
        )
      )}
    </div>
  );
}

export function TemplatesPanel({ api }: { api: StudioApi }) {
  // Opens on the current design's type, and follows it when the design moves to another one.
  const current =
    api.layout.templateId === 'blank' ? undefined : findTemplate(api.layout.templateId);
  const [pack, setPack] = useState(() => current?.pack ?? TEMPLATE_PACKS[0]);
  useEffect(() => {
    if (current?.pack) setPack(current.pack);
  }, [current?.pack]);
  const brandId = current?.brand ?? brandOfKit(api.layout.kit?.id) ?? ANNOUNCE_BRANDS[0].id;
  const brand = ANNOUNCE_BRANDS.find((b) => b.id === brandId);
  const count = (p: string) =>
    ALL_TEMPLATES.filter((t) => t.pack === p && (!t.brand || t.brand === brandId)).length;
  const shown = ALL_TEMPLATES.filter((t) => t.pack === pack && (!t.brand || t.brand === brandId));
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
        />
      </div>
      <div className={`${LABEL} flex gap-1.5`}>
        Built-in <span className="font-normal">{shown.length}</span>
      </div>
      {brand && !api.layout.palette && shown.some((t) => t.brand) && (
        <p className="-mt-1 mb-2 text-[11px] leading-relaxed text-canvas-muted-foreground/70">
          Previews use your brand, {brand.name}. Change it in the top bar.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {shown.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => api.chooseTemplate(t)}
            className={`overflow-hidden rounded-xl border bg-canvas-muted text-left ${
              api.layout.templateId === t.id
                ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40'
                : 'border-canvas-border hover:border-canvas-muted-foreground'
            }`}
          >
            <Thumb template={t} />
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
          <p className="mt-2 text-[11px] leading-relaxed text-canvas-muted-foreground">
            Works best on a plain background. It clears the color that touches the edges of the
            photo.
          </p>
        </>
      )}
    </div>
  );
}

/** The right-side panel the Photo bar's Edit button opens: background removal and quick adjustments. */
export function EditDrawer({ api, id }: { api: StudioApi; id: string }) {
  const el = api.layout.els.find((e) => e.id === id);
  if (el?.t === 'art' && isChart(el.art)) return <ChartDrawer api={api} el={el} />;
  if (!el || (el.t !== 'subject' && el.t !== 'image')) return null;
  const isSubject = el.t === 'subject';
  const source = isSubject ? api.layout.subject : el;
  return (
    <div className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-l border-canvas-border bg-canvas-muted p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-canvas-foreground">Edit photo</span>
        <button
          type="button"
          onClick={() => api.setEdit(null)}
          aria-label="Close"
          className="text-canvas-muted-foreground hover:text-canvas-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mt-3">
        <CutoutControls api={api} id={id} source={source} />
      </div>
      <div className="mt-4 border-t border-canvas-border pt-3">
        <div className={LABEL}>Adjust</div>
        <Range
          label="Opacity"
          value={Math.round((el.op ?? 1) * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => api.patch(id, { op: v / 100 })}
        />
        <div className="mt-2">
          <Range
            label="Rotate"
            value={el.rot ?? 0}
            min={-180}
            max={180}
            step={1}
            onChange={(v) => api.patch(id, { rot: v })}
          />
        </div>
      </div>
      {isSubject && (
        <p className="mt-3 text-[11px] leading-relaxed text-canvas-muted-foreground">
          A transparent PNG works as is. For any other photo, use Remove background above.
        </p>
      )}
    </div>
  );
}

/** Every palette's colors in a compact grid, the active palette first. Hover a group for its name. */
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
              ? 'border-fuchsia-400 bg-fuchsia-400/10 text-canvas-foreground'
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

/** A faint geometric pattern behind the design: None, or a style to generate, from the Background bar. */
function PatternControls({ api }: { api: StudioApi }) {
  const current = patternLayer(api.layout);
  const active = current?.art.split('-')[1];
  const tile = (on: boolean) =>
    `flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-white ${
      on
        ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40'
        : 'border-canvas-border hover:border-canvas-muted-foreground'
    }`;
  return (
    <div className="w-64">
      <div className={LABEL}>Pattern</div>
      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          title="No pattern"
          onClick={() => api.update((l) => setPattern(l, null))}
          className={`${tile(!current)} text-[11px] text-canvas-muted-foreground`}
        >
          None
        </button>
        {PATTERN_STYLES.map(([style, name]) => {
          const def = patternDef(patternId(style, 1));
          return (
            <button
              key={style}
              type="button"
              title={name}
              onClick={() => api.update((l) => setPattern(l, style))}
              className={tile(active === style)}
            >
              {def && (
                // biome-ignore lint/performance/noImgElement: a local SVG data URL
                <img src={artUrl(def, artDefaults(def))} alt={name} className="size-full" />
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={`${SMALL} mt-2.5 flex w-full items-center justify-center gap-1.5`}
        onClick={() => api.update(shuffleAll)}
      >
        <RefreshCw className="size-3.5" /> Shuffle all
      </button>
    </div>
  );
}

/** Solid, gradient or transparent background, opened from the top bar's Background swatch. */
export function BackgroundControls({ api }: { api: StudioApi }) {
  const { bg } = api.layout;
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
  const roles = layoutRoles(api.layout);
  const colors = {
    ...artDefaults(art),
    ...(roles && art.kind === 'shape' ? artPalette(art, roles) : {}),
  };
  return (
    <button
      type="button"
      title={art.name}
      {...dragItem({ kind: 'art', id: art.id })}
      onClick={() => api.addArt(art.id)}
      className={small ? `${TILE} h-auto aspect-square p-2.5` : TILE}
    >
      {/* biome-ignore lint/performance/noImgElement: a local SVG data URL */}
      <img src={artUrl(tileArt(art), colors)} alt={art.name} className="max-h-full max-w-full" />
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
        {ART.filter((a) => a.group === group && !isFrameVariant(a.id)).map((a) => (
          <ArtTile key={a.id} api={api} art={a} small />
        ))}
      </div>
    </>
  );
}

export function ElementsPanel({ api }: { api: StudioApi }) {
  const add = 'grid grid-cols-2 gap-1.5';
  const accent = layoutRoles(api.layout)?.accent ?? '#6366f1';
  return (
    <div>
      <div className={LABEL}>Text</div>
      <div className={add}>
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

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[11.5px] text-canvas-muted-foreground">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 accent-emerald-500"
      />
    </label>
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
    <label className="flex items-center gap-2 text-[11.5px] text-canvas-muted-foreground">
      {label}
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 rounded-md border border-canvas-border bg-canvas p-0.5"
      />
    </label>
  );
}

/** A bar button that opens a small floating panel below it. Only one is open at a time. */
function PopButton({
  label,
  open,
  onToggle,
  align = 'left',
  wide,
  children,
}: {
  label: ReactNode;
  open: boolean;
  onToggle: () => void;
  align?: 'left' | 'right';
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Closes on any click outside the button or its popover, not just the button itself
  // (same pattern as ThemedSelect and PlaygroundConfigPopup).
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (ref.current?.contains(target)) return;
      if (target.closest('[data-themed-select-menu]')) return;
      onToggle();
    }
    document.addEventListener('mousedown', onDocClick, true);
    return () => document.removeEventListener('mousedown', onDocClick, true);
  }, [open, onToggle]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={onToggle}
        className={`${SMALL} flex items-center gap-1.5 ${open ? 'border-fuchsia-400 text-fuchsia-300' : ''}`}
      >
        {label}
      </button>
      {open && (
        <div
          className={`absolute top-full z-10 mt-1.5 ${wide ? 'w-72' : 'w-56'} rounded-xl border border-canvas-border bg-canvas-raised p-3 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** A square icon-only button, for the bar actions Canva shows as a plain glyph. */
const SLOT_HINT = {
  text: 'its text',
  image: 'its image',
  color: 'its fill color',
  data: 'its data',
} as const;

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
        A workflow can replace {SLOT_HINT[type]} through this name on the Create design node. Layers
        with the same name share one value.
      </p>
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
      className={`${SMALL} px-2 ${active ? 'border-fuchsia-400 text-fuchsia-300' : ''}`}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

const Sep = () => <span className="mx-0.5 h-5 w-px bg-canvas-border" />;

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

const ALIGNMENTS = [
  ['left', AlignLeft],
  ['center', AlignCenter],
  ['right', AlignRight],
] as const;

export function Toolbar({ api }: { api: StudioApi }) {
  const { layout, selId } = api;
  const el = layout.els.find((e) => e.id === selId);
  const [pop, setPop] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: closes the popover when the selection changes
  useEffect(() => setPop(null), [selId]);
  const name =
    api.multiSel.length > 0
      ? `${api.multiSel.length} selected`
      : selId === 'bg'
        ? 'Background'
        : selId === 'scene'
          ? 'AI background'
          : el
            ? {
                text: 'Text',
                pill: 'Badge',
                line: 'Line',
                shape: 'Shape',
                subject: 'Product',
                image: 'Image',
                art: 'Art',
                avatar: 'Avatar',
              }[el.t]
            : 'Nothing selected';
  const selEls = api.multiSel
    .map((id) => layout.els.find((e) => e.id === id))
    .filter((e): e is ICElement => e !== undefined);
  const grouped =
    selEls.length > 1 &&
    selEls[0].groupId !== undefined &&
    selEls.every((e) => e.groupId === selEls[0].groupId);
  const isPhoto = el?.t === 'subject' || el?.t === 'image';
  const bold = (el?.t === 'text' || el?.t === 'pill') && el.weight >= 700;
  const { bg } = layout;
  const bgSwatch =
    bg.mode === 'transparent'
      ? 'repeating-conic-gradient(#666 0 25%, transparent 0 50%) 0 0 / 8px 8px'
      : bg.mode === 'gradient'
        ? `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`
        : bg.color;
  return (
    // Matches a populated bar's own height (a select, a swatch), not the empty
    // "Nothing selected" row's shorter one: that gap ate into the canvas area
    // below on the first selection, shrinking and recentering it visibly.
    <div className="flex min-h-[50px] flex-wrap items-center gap-1.5 border-b border-canvas-border bg-canvas-muted px-3.5 py-1.5 text-[11.5px]">
      <span className="mr-1 font-semibold text-canvas-foreground">{name}</span>
      {el && api.multiSel.length <= 1 && slotTypeOf(el) && (
        <PopButton
          label={
            <>
              <Braces className="size-3.5" />
              {el.slot ?? 'Slot'}
            </>
          }
          open={pop === 'slot'}
          onToggle={() => setPop(pop === 'slot' ? null : 'slot')}
          wide
        >
          <SlotControls api={api} el={el} />
        </PopButton>
      )}
      {api.multiSel.length > 1 &&
        (grouped ? (
          <IconButton icon={Ungroup} title="Ungroup" onClick={api.ungroup} />
        ) : (
          <IconButton icon={Group} title="Group" onClick={api.group} />
        ))}
      {(selId === 'bg' || (!selId && api.multiSel.length === 0)) && (
        <>
          <PopButton
            label={
              <>
                <span
                  className="size-3.5 rounded-full border border-canvas-border"
                  style={{ background: bgSwatch }}
                />
                Color
              </>
            }
            open={pop === 'bg'}
            onToggle={() => setPop(pop === 'bg' ? null : 'bg')}
            wide
          >
            <BackgroundControls api={api} />
          </PopButton>
          <PopButton
            label="Pattern"
            open={pop === 'pattern'}
            onToggle={() => setPop(pop === 'pattern' ? null : 'pattern')}
            wide
          >
            <PatternControls api={api} />
          </PopButton>
          <IconButton
            icon={RefreshCw}
            title="Shuffle: a new pattern from any style"
            onClick={() => api.update(shuffleAll)}
          />
          {!layout.scene.on && !api.standalone && (
            <IconButton
              icon={Eye}
              title="Show AI background"
              onClick={() => {
                api.update((l) => ({ ...l, scene: { ...l.scene, on: true } }));
                api.select('scene');
              }}
            />
          )}
        </>
      )}
      {selId === 'scene' && (
        <>
          <IconButton
            icon={layout.scene.upload ? ReplaceIcon : ImagePlus}
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
        </>
      )}
      {isPhoto && el && (
        <>
          <IconButton
            icon={Pencil}
            title="Edit photo"
            active={api.editId === el.id}
            onClick={() => api.setEdit(api.editId === el.id ? null : el.id)}
          />
          {el.t === 'image' && el.gen && (
            <IconButton
              icon={RefreshCw}
              title={
                api.genBusy === el.id
                  ? 'Regenerating…'
                  : (api.genError ?? 'Regenerate (a new take of the same prompt)')
              }
              active={api.genBusy === el.id}
              disabled={api.genBusy !== null}
              onClick={() => void api.regenerateElement(el.id)}
            />
          )}
          <IconButton
            icon={ReplaceIcon}
            title={el.t === 'subject' ? 'Replace photo' : 'Replace image'}
            onClick={() => api.pickImage(el.t === 'subject' ? 'subject' : 'layer')}
          />
          {isCroppable(el) && (
            <IconButton
              icon={Crop}
              title={el.lock ? 'Unlock to crop' : api.cropId === el.id ? 'Done cropping' : 'Crop'}
              active={api.cropId === el.id}
              disabled={el.lock}
              onClick={() => api.setCrop(api.cropId === el.id ? null : el.id)}
            />
          )}
          <IconButton
            icon={FlipHorizontal2}
            title="Flip"
            active={el.flip}
            onClick={() => api.patch(el.id, { flip: !el.flip })}
          />
          {el.t === 'image' && el.h !== undefined && (
            <Range
              label="Round"
              value={el.radius ?? 0}
              min={0}
              max={50}
              step={0.5}
              onChange={(v) => api.patch(el.id, { radius: v })}
            />
          )}
          {el.t === 'subject' && (
            <>
              <label className="flex items-center gap-1.5 text-[11.5px] text-canvas-muted-foreground">
                <input
                  type="checkbox"
                  checked={el.shadow}
                  onChange={(e) => api.patch(el.id, { shadow: e.target.checked })}
                  className="accent-emerald-500"
                />
                Shadow
              </label>
              <label className="flex items-center gap-1.5 text-[11.5px] text-canvas-muted-foreground">
                <input
                  type="checkbox"
                  checked={el.reflect ?? false}
                  onChange={(e) => api.patch(el.id, { reflect: e.target.checked })}
                  className="accent-emerald-500"
                />
                Reflection
              </label>
            </>
          )}
          <Sep />
        </>
      )}
      {(el?.t === 'text' || el?.t === 'pill') && (
        <>
          <div className="w-28">
            <ThemedSelect
              id="ic-font"
              value={el.font}
              options={FONT_OPTIONS}
              onChange={(v) => api.patch(el.id, { font: v })}
            />
          </div>
          <Range
            label="Size"
            value={el.size}
            min={1.5}
            max={60}
            step={0.1}
            onChange={(v) => api.patch(el.id, { size: v })}
          />
          <ColorInput
            label="Color"
            value={el.color}
            onChange={(v) => api.patch(el.id, { color: v })}
          />
          {el.t === 'pill' && (
            <ColorInput
              label="Fill"
              value={el.fill}
              onChange={(v) => api.patch(el.id, { fill: v })}
            />
          )}
          {!isFixedWeight(el.font) && (
            <IconButton
              icon={Bold}
              title={bold ? 'Remove bold' : 'Bold'}
              active={bold}
              onClick={() => api.patch(el.id, { weight: bold ? 400 : 700 })}
            />
          )}
          {el.t === 'text' && (
            <div className="flex rounded-md border border-canvas-border p-0.5">
              {ALIGNMENTS.map(([a, Icon]) => (
                <button
                  key={a}
                  type="button"
                  title={`Align ${a}`}
                  aria-label={`Align ${a}`}
                  onClick={() => api.patch(el.id, { align: a })}
                  className={`rounded p-1 ${el.align === a ? 'bg-canvas text-canvas-foreground' : 'text-canvas-muted-foreground'}`}
                >
                  <Icon className="size-3.5" />
                </button>
              ))}
            </div>
          )}
          <Sep />
        </>
      )}
      {el?.t === 'line' && (
        <>
          <ColorInput
            label="Color"
            value={el.color}
            onChange={(v) => api.patch(el.id, { color: v })}
          />
          <Sep />
        </>
      )}
      {el?.t === 'art' && (
        <>
          {isHero(el.art) && (
            <>
              <PopButton
                label="Shape"
                open={pop === 'shape'}
                onToggle={() => setPop(pop === 'shape' ? null : 'shape')}
                wide
              >
                <div className={LABEL}>Shape</div>
                <div className="grid max-h-72 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
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
                            ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40'
                            : 'border-canvas-border hover:border-canvas-muted-foreground'
                        }`}
                      >
                        {/* biome-ignore lint/performance/noImgElement: a local SVG data URL */}
                        <img
                          src={artUrl(def, swapColors(api.layout, el, def))}
                          alt={def.name}
                          className="max-h-full max-w-full"
                        />
                      </button>
                    );
                  })}
                </div>
              </PopButton>
              <IconButton
                icon={RefreshCw}
                title="Shuffle: another shape in the same spot"
                onClick={() => api.update((l) => swapArt(l, el.id))}
              />
            </>
          )}
          {isChart(el.art) && (
            <button
              type="button"
              onClick={() => api.setEdit(api.editId === el.id ? null : el.id)}
              className={`${SMALL} ${api.editId === el.id ? 'border-fuchsia-400 text-fuchsia-300' : ''}`}
            >
              Data
            </button>
          )}
          {isPattern(el.art) && (
            <button
              type="button"
              title="A new pattern from any style"
              className={`${SMALL} flex items-center gap-1`}
              onClick={() => api.update(shuffleAll)}
            >
              <RefreshCw className="size-3.5" /> Shuffle
            </button>
          )}
          {artDef(el.art)?.slots.map((slot) => (
            <ColorInput
              key={slot.key}
              label={slot.label}
              value={el.colors[slot.key] ?? slot.color}
              onChange={(v) => api.patch(el.id, { colors: { ...el.colors, [slot.key]: v } })}
            />
          ))}
          <Sep />
        </>
      )}
      {el?.t === 'shape' && (
        <>
          <ColorInput
            label="Fill"
            value={el.fill}
            onChange={(v) => api.patch(el.id, { fill: v })}
          />
          <ColorInput
            label="Stroke"
            value={el.stroke}
            onChange={(v) => api.patch(el.id, { stroke: v })}
          />
          <Range
            label="Round"
            value={el.radius}
            min={0}
            max={50}
            step={0.5}
            onChange={(v) => api.patch(el.id, { radius: v })}
          />
          <Sep />
        </>
      )}
      {el && (
        <>
          <PopButton
            label="Opacity"
            open={pop === 'opacity'}
            onToggle={() => setPop(pop === 'opacity' ? null : 'opacity')}
          >
            <Range
              label="Opacity"
              value={Math.round((el.op ?? 1) * 100)}
              min={0}
              max={100}
              step={1}
              onChange={(v) => api.patch(el.id, { op: v / 100 })}
            />
            <div className="mt-2.5">
              <Range
                label="Rotate"
                value={el.rot ?? 0}
                min={-180}
                max={180}
                step={1}
                onChange={(v) => api.patch(el.id, { rot: v })}
              />
            </div>
          </PopButton>
          <div className="ml-auto">
            <PopButton
              label="Position"
              open={pop === 'position'}
              onToggle={() => setPop(pop === 'position' ? null : 'position')}
              align="right"
            >
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className={`${SMALL} flex flex-1 items-center justify-center gap-1.5`}
                  onClick={() => {
                    api.move(1);
                    setPop(null);
                  }}
                >
                  <ArrowUp className="size-3.5" /> Forward
                </button>
                <button
                  type="button"
                  className={`${SMALL} flex flex-1 items-center justify-center gap-1.5`}
                  onClick={() => {
                    api.move(-1);
                    setPop(null);
                  }}
                >
                  <ArrowDown className="size-3.5" /> Back
                </button>
              </div>
              {'w' in el && <SizeControls el={el} onPatch={(p) => api.patch(el.id, p)} />}
            </PopButton>
          </div>
        </>
      )}
    </div>
  );
}

/** Width as a slider, kept centered, plus a fit for layers wider than the canvas, whose handles can
 *  sit out of reach. Boxes that also have a height scale with it, so the shape keeps its proportions. */
function SizeControls({
  el,
  onPatch,
}: {
  el: ICElement;
  onPatch: (p: Partial<ICElement>) => void;
}) {
  if (!('w' in el)) return null;
  const resize = (w: number) => {
    const k = w / el.w;
    const next: Record<string, number> = { w, x: el.x + (el.w - w) / 2 };
    if ((el.t === 'shape' || el.t === 'pill' || el.t === 'image') && el.h !== undefined)
      next.h = el.h * k;
    onPatch(next as Partial<ICElement>);
  };
  return (
    <div className="mt-3 border-t border-canvas-border pt-2.5">
      <div className="mb-1 flex items-center justify-between text-[11px] text-canvas-muted-foreground">
        <span>Size</span>
        <span>{Math.round(el.w)}% of the width</span>
      </div>
      <input
        type="range"
        min={2}
        max={200}
        value={Math.min(200, el.w)}
        onChange={(e) => resize(Number(e.target.value))}
        className="w-full accent-fuchsia-400"
      />
      {el.w > 100 && (
        <button type="button" className={`${SMALL} mt-1.5 w-full`} onClick={() => resize(100)}>
          Fit to canvas width
        </button>
      )}
    </div>
  );
}

/** The floating group over a selected layer on the canvas: Duplicate, Lock, Delete, and z-order extremes. */
export function MiniBar({ api, style }: { api: StudioApi; style: CSSProperties }) {
  const el = api.layout.els.find((e) => e.id === api.selId);
  const [more, setMore] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: closes the menu when the selection changes
  useEffect(() => setMore(false), [api.selId]);
  if (!el) return null;
  const btn =
    'rounded p-1.5 hover:bg-canvas-muted text-canvas-muted-foreground hover:text-canvas-foreground';
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
        title={el.lock ? 'Unlock' : 'Lock'}
        onClick={() => api.patch(el.id, { lock: !el.lock })}
        className={el.lock ? 'rounded p-1.5 text-fuchsia-300 hover:bg-canvas-muted' : btn}
      >
        {el.lock ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
      </button>
      <button type="button" title="Delete" onClick={api.remove} className={btn}>
        <Trash2 className="size-3.5" />
      </button>
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
