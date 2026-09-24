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
  useRef,
  useState,
} from 'react';
import { ART, artDef, artDefaults, artPalette, artUrl } from './image-constructor-art.js';
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
import { BrandKitsSection } from './image-constructor-brand-kits-panel.js';
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
  type ICAvatarEl,
  type ICElement,
  type ICFont,
  type ICLayout,
  type ICRatio,
  type ICTemplate,
  isCroppable,
  layoutFromTemplate,
  layoutRoles,
  orientationOf,
  RATIO_DIMENSIONS,
  ratioHeight,
  supportedOrientations,
} from './image-constructor-layout.js';
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
  | { kind: 'art'; id: string };
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
  select: (id: Selection) => void;
  update: (fn: (layout: ICLayout) => ICLayout) => void;
  patch: (id: string, patch: Partial<Record<string, unknown>>) => void;
  addText: (kind: 'text' | 'pill', at?: ICPoint) => void;
  addShape: (kind?: 'rect' | 'ellipse', at?: ICPoint) => void;
  addLine: (at?: ICPoint) => void;
  addArt: (id: string, at?: ICPoint) => void;
  addAvatar: (at?: ICPoint) => void;
  resetTemplate: () => void;
  cropId: string | null;
  setCrop: (id: string | null) => void;
  setRatio: (ratio: ICRatio) => void;
  setCustomSize: (width: number, height: number) => void;
  pickImage: (target: 'add' | 'layer' | 'subject' | 'scene') => void;
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
  /** Places the kit's logo as a new layer slotted `logo`. */
  addLogo: (kit: BrandKit) => void;
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
  'x-post': 'X',
  'linkedin-post': 'LinkedIn Post',
  'ig-post': 'IG Post',
  // IG Story and TikTok Story were two identical 1080x1920 entries (user); YouTube
  // Thumbnail is gone.
  story: 'Story',
};
const RATIOS = [
  ...Object.entries(RATIO_LABELS).map(([value, name]) => {
    const dim = RATIO_DIMENSIONS[value as ICRatio];
    return { value, label: dim ? `${name} · ${dim.width}×${dim.height}` : name };
  }),
  { value: 'custom', label: 'Custom size' },
];

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

export function PromptBlock({ api }: { api: StudioApi }) {
  const { layout } = api;
  const template = findTemplate(layout.templateId);
  // A blank canvas (no template chosen yet) has nothing that could conflict with any
  // ratio, so every size stays enabled instead of inheriting the fallback template's own.
  const isBlank = layout.templateId === 'blank';
  const supported = supportedOrientations(template);
  const ratioOptions = RATIOS.map((o) =>
    // Custom size has no authored layout to conflict with, so it's always available,
    // the same reasoning a blank canvas already gets.
    o.value === 'custom' || isBlank || supported.has(orientationOf(o.value as ICRatio))
      ? o
      : { ...o, disabled: true, title: `${template.title} has no layout for this size yet` },
  );
  return (
    <div className="mb-3 border-b border-canvas-border pb-3">
      <div className={LABEL}>Canvas</div>
      <ThemedSelect
        id="ic-ratio"
        value={layout.ratio ?? '1:1'}
        options={ratioOptions}
        onChange={(v) => api.setRatio(v as ICRatio)}
      />
      {layout.ratio === 'custom' && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="number"
            min={64}
            max={8000}
            value={layout.customSize?.width ?? 1080}
            onChange={(e) =>
              api.setCustomSize(Number(e.target.value) || 1, layout.customSize?.height ?? 1080)
            }
            placeholder="Width"
            className={INPUT}
          />
          <input
            type="number"
            min={64}
            max={8000}
            value={layout.customSize?.height ?? 1080}
            onChange={(e) =>
              api.setCustomSize(layout.customSize?.width ?? 1080, Number(e.target.value) || 1)
            }
            placeholder="Height"
            className={INPUT}
          />
        </div>
      )}
    </div>
  );
}

/** A prompt-painted photo behind every layer, at the bottom of the Elements tab. */
function AIBackgroundBlock({ api }: { api: StudioApi }) {
  const { layout } = api;
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
    <div className="relative" style={{ background: template.thumb, aspectRatio: '3 / 2' }}>
      {/* biome-ignore lint/performance/noImgElement: a local data URL */}
      {url && <img src={url} alt="" className="absolute inset-0 size-full object-cover" />}
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

export function TemplatesPanel({ api }: { api: StudioApi }) {
  // Opens on the current design's pack; a blank canvas opens on the first one.
  const [pack, setPack] = useState(() =>
    api.layout.templateId === 'blank' ? TEMPLATE_PACKS[0] : findTemplate(api.layout.templateId).pack,
  );
  return (
    <div>
      <MyDesignsSection
        activeId={api.layout.saved?.id}
        onOpen={(layout) => {
          api.update(() => layout);
          api.select(null);
        }}
      />
      <ThemedSelect id="ic-pack" value={pack} options={TEMPLATE_PACKS} onChange={setPack} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {ALL_TEMPLATES.filter((t) => t.pack === pack).map((t) => (
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
            <div className="px-2.5 pb-2.5 pt-2">
              <div className="text-[12px] font-semibold text-canvas-foreground">{t.title}</div>
              <div className="truncate text-[10.5px] text-canvas-muted-foreground">
                {t.kit
                  ? 'X, square, story'
                  : t.source
                  ? t.source.author
                    ? `Inspired by @${t.source.author}`
                    : 'Inspired by a reference design'
                  : 'Original'}
              </div>
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

export function PalettesPanel({ api }: { api: StudioApi }) {
  const current = api.layout.palette ?? null;
  const card = (on: boolean) =>
    `overflow-hidden rounded-xl border bg-canvas-muted text-left ${
      on
        ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40'
        : 'border-canvas-border hover:border-canvas-muted-foreground'
    }`;
  return (
    <div>
      <BrandKitsSection
        api={{ activeKitId: api.layout.kit?.id, applyBrandKit: api.applyBrandKit, addLogo: api.addLogo }}
      />
      <div className={LABEL}>Color Kits</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => api.setPalette(null)}
          className={card(current === null && !api.layout.kit)}
        >
          <div className="flex h-9 items-center justify-center bg-canvas text-[11px] text-canvas-muted-foreground">
            Original
          </div>
          <div className="px-2.5 py-2 text-[12px] font-semibold text-canvas-foreground">
            Template colors
          </div>
        </button>
        {PALETTES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => api.setPalette(p.id)}
            className={card(current === p.id)}
          >
            <div className="flex h-9">
              {p.colors.map((c) => (
                <span key={c} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <div className="truncate px-2.5 py-2 text-[12px] font-semibold text-canvas-foreground">
              {p.name}
            </div>
          </button>
        ))}
      </div>
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
  const colors = { ...artDefaults(art), ...(roles && art.group ? artPalette(art, roles) : {}) };
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

const AI_ONLY: ICArtGroup[] = ['AI'];
const WEB3_ONLY = WEB3_GROUPS.filter((g) => g !== 'AI');

/** Grouped art shapes, with chips to narrow them when the section spans more than one group. */
function ShapeSection({
  api,
  title,
  groups,
}: {
  api: StudioApi;
  title: string;
  groups: readonly ICArtGroup[];
}) {
  const [group, setGroup] = useState<ICArtGroup | 'All'>('All');
  const shapes = ART.filter(
    (a) =>
      a.group &&
      groups.includes(a.group) &&
      (group === 'All' || a.group === group) &&
      !isFrameVariant(a.id),
  );
  return (
    <>
      <div className={`${LABEL} mt-4`}>{title}</div>
      {groups.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {(['All', ...groups] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={`rounded-full border px-2 py-0.5 text-[10.5px] ${
                group === g
                  ? 'border-fuchsia-400 bg-fuchsia-400/10 text-canvas-foreground'
                  : 'border-canvas-border text-canvas-muted-foreground hover:text-canvas-foreground'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {shapes.map((a) => (
          <ArtTile key={a.id} api={api} art={a} small />
        ))}
      </div>
    </>
  );
}

export function ElementsPanel({ api }: { api: StudioApi }) {
  const add = 'grid grid-cols-2 gap-1.5';
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
      <ShapeSection api={api} title="Web3" groups={WEB3_ONLY} />
      <ShapeSection api={api} title="AI" groups={AI_ONLY} />
      <div className={`${LABEL} mt-4`}>Shapes</div>
      <div className="grid grid-cols-3 gap-1.5">
        {(['rect', 'ellipse'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            title={kind === 'rect' ? 'Rectangle' : 'Circle'}
            {...dragItem({ kind })}
            onClick={() => api.addShape(kind)}
            className={TILE}
          >
            <span
              className={`block bg-canvas-muted-foreground/60 ${kind === 'rect' ? 'h-9 w-12 rounded-sm' : 'size-11 rounded-full'}`}
            />
          </button>
        ))}
        <button
          type="button"
          title="Line"
          {...dragItem({ kind: 'line' })}
          onClick={() => api.addLine()}
          className={TILE}
        >
          <span className="block h-0.5 w-14 bg-canvas-muted-foreground/60" />
        </button>
        {ART.filter((a) => a.kind === 'shape' && !a.group).map((a) => (
          <ArtTile key={a.id} api={api} art={a} />
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
      {selId === 'bg' && (
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
          {!layout.scene.on && (
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
              title={api.genBusy === el.id ? 'Regenerating…' : api.genError ?? 'Regenerate (a new take of the same prompt)'}
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
            </PopButton>
          </div>
        </>
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
