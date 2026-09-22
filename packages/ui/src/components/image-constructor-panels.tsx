'use client';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  BringToFront,
  Copy,
  Crop,
  Eye,
  EyeOff,
  FlipHorizontal2,
  ImagePlus,
  Lock,
  MoreHorizontal,
  Pencil,
  Replace as ReplaceIcon,
  SendToBack,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import {
  type ComponentType,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import { ART, artDef, artDefaults, artUrl } from './image-constructor-art.js';
import { DEFAULT_CUTOUT, type ICCutout } from './image-constructor-cutout.js';
import { isFixedWeight } from './image-constructor-font-list.js';
import {
  fitFigures,
  IC_FONT_LABELS,
  IC_FONT_STACKS,
  type ICFont,
  type ICLayout,
  type ICRatio,
  type ICTemplate,
  isCroppable,
  ratioHeight,
} from './image-constructor-layout.js';
import { PALETTES } from './image-constructor-palettes.js';
import { PRODUCT_PACK } from './image-constructor-templates.js';
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
  | { kind: 'text' | 'pill' | 'rect' | 'ellipse' | 'line' }
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
  resetTemplate: () => void;
  cropId: string | null;
  setCrop: (id: string | null) => void;
  setRatio: (ratio: ICRatio) => void;
  pickImage: (target: 'add' | 'layer' | 'subject' | 'scene') => void;
  duplicate: () => void;
  remove: () => void;
  move: (dir: 1 | -1) => void;
  moveEnd: (dir: 1 | -1) => void;
  chooseTemplate: (template: ICTemplate) => void;
  setPalette: (id: string | null) => void;
  cutout: (id: string, opts: ICCutout | null) => Promise<void>;
  cutBusy: string | null;
  editId: string | null;
  setEdit: (id: string | null) => void;
  /** Ids picked by dragging a selection box over empty canvas. Delete/Backspace acts on all of them. */
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

const RATIOS = [
  { value: '1:1', label: 'Square 1:1' },
  { value: '4:5', label: 'Portrait 4:5' },
  { value: '3:4', label: 'Portrait 3:4' },
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
  return (
    <div className="mb-3 border-b border-canvas-border pb-3">
      <div className={LABEL}>Canvas</div>
      <ThemedSelect
        id="ic-ratio"
        value={layout.ratio ?? '1:1'}
        options={RATIOS}
        onChange={(v) => api.setRatio(v as ICRatio)}
      />
      {layout.scene.on ? (
        <>
          <div className={`${LABEL} mt-3`}>Prompt</div>
          <textarea
            value={layout.prompt}
            onChange={(e) => api.update((l) => ({ ...l, prompt: e.target.value }))}
            spellCheck={false}
            className={`${INPUT} min-h-[96px] resize-y leading-relaxed`}
          />
          <div className="mt-2">
            <ThemedSelect
              id="ic-model"
              value={layout.model}
              options={IMAGE_MODEL_OPTIONS}
              onChange={(v) => api.update((l) => ({ ...l, model: v as ICLayout['model'] }))}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-canvas-muted-foreground">
            {api.sceneReady ? 'Scene from the last run.' : 'Generated when the workflow runs.'}
          </p>
        </>
      ) : null}
    </div>
  );
}

function Thumb({ template }: { template: ICTemplate }) {
  const rh = ratioHeight(template.ratio);
  const subjectRatio = template.subject?.ratio ?? 0.625;
  return (
    <div className="relative" style={{ background: template.thumb, aspectRatio: `1 / ${rh / 2}` }}>
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
  return (
    <div>
      <ThemedSelect id="ic-pack" value="Product" options={['Product']} onChange={() => undefined} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {PRODUCT_PACK.map((t) => (
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
                {t.source
                  ? t.source.author
                    ? `Inspired by @${t.source.author}`
                    : 'Inspired by a meigen.ai post'
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
  // The scene sits above the background, so choosing a background hides the scene.
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
          The scene image is already off. Export now for a transparent PNG.
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
      <div className={LABEL}>Palettes</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => api.setPalette(null)}
          className={card(current === null)}
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

function ArtTile({ api, art }: { api: StudioApi; art: (typeof ART)[number] }) {
  return (
    <button
      type="button"
      title={art.name}
      {...dragItem({ kind: 'art', id: art.id })}
      onClick={() => api.addArt(art.id)}
      className={TILE}
    >
      {/* biome-ignore lint/performance/noImgElement: a local SVG data URL */}
      <img src={artUrl(art, artDefaults(art))} alt={art.name} className="max-h-full max-w-full" />
    </button>
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
      <div className={`${LABEL} mt-4`}>Characters</div>
      <div className="grid grid-cols-3 gap-1.5">
        {ART.filter((a) => a.kind === 'character').map((a) => (
          <ArtTile key={a.id} api={api} art={a} />
        ))}
      </div>
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
        {ART.filter((a) => a.kind === 'shape').map((a) => (
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
  return (
    <div className="relative">
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
          ? 'Scene image'
          : el
            ? {
                text: 'Text',
                pill: 'Badge',
                line: 'Line',
                shape: 'Shape',
                subject: 'Product',
                image: 'Image',
                art: 'Art',
              }[el.t]
            : 'Nothing selected';
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
              title="Show scene image"
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
            title="Hide (use Background instead)"
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
