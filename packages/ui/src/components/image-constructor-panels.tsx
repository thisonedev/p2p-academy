'use client';

import {
  Circle,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LayoutTemplate,
  Minus,
  Package,
  Square,
  Trash2,
  Type,
} from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import {
  IC_FONT_LABELS,
  IC_FONT_STACKS,
  type ICElement,
  type ICFont,
  type ICLayout,
  type ICPill,
  type ICRatio,
  type ICTemplate,
  type ICText,
  ratioHeight,
} from './image-constructor-layout.js';
import { isFixedWeight } from './image-constructor-font-list.js';
import { PRODUCT_PACK } from './image-constructor-templates.js';
import { IMAGE_MODEL_OPTIONS } from './playground-node-defs.js';
import { ThemedSelect } from './themed-select.js';

export type Selection = string | 'bg' | 'scene' | null;

/** The design actions the panels and toolbar can call. The studio implements them. */
export interface StudioApi {
  layout: ICLayout;
  selId: Selection;
  sceneReady: boolean;
  select: (id: Selection) => void;
  update: (fn: (layout: ICLayout) => ICLayout) => void;
  patch: (id: string, patch: Partial<Record<string, unknown>>) => void;
  addText: (kind: 'text' | 'pill') => void;
  addShape: (kind?: 'rect' | 'ellipse') => void;
  setRatio: (ratio: ICRatio) => void;
  pickImage: (target: 'add' | 'layer' | 'subject' | 'scene') => void;
  duplicate: () => void;
  remove: () => void;
  move: (dir: 1 | -1) => void;
  chooseTemplate: (template: ICTemplate) => void;
}

const LABEL =
  'mb-2 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70';
const INPUT =
  'w-full rounded-lg border border-canvas-border bg-canvas-muted px-2.5 py-2 text-[12.5px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60';
const SMALL =
  'rounded-md border border-canvas-border bg-canvas px-2.5 py-1 text-[12px] text-canvas-foreground hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-40';
const SWATCH =
  'size-6 cursor-pointer rounded-md border border-canvas-border hover:border-canvas-foreground';

const RATIOS = [
  { value: '1:1', label: 'Square 1:1' },
  { value: '4:5', label: 'Portrait 4:5' },
  { value: '3:4', label: 'Portrait 3:4' },
];

const SOLIDS = [
  '#ffffff',
  '#f4f1ea',
  '#111827',
  '#0b1220',
  '#34d399',
  '#fbbf24',
  '#f472b6',
  '#60a5fa',
];
const GRADIENTS: [string, string, number][] = [
  ['#20304a', '#0b1220', 160],
  ['#f6d365', '#fda085', 135],
  ['#a18cd1', '#fbc2eb', 135],
  ['#84fab0', '#8fd3f4', 120],
  ['#232526', '#414345', 160],
  ['#ff9a9e', '#fad0c4', 90],
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

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1 mt-1 rounded-xl border border-canvas-border bg-canvas-muted p-2.5">
      {children}
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
      <p className="mt-2 text-[11px] leading-relaxed text-canvas-muted-foreground">
        Every template has its own layout for square and portrait.
      </p>
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
            {api.sceneReady
              ? 'Showing the scene from the last run. It regenerates when the prompt or model changes.'
              : 'The scene is generated when the workflow runs. Until then the canvas shows a placeholder.'}
          </p>
        </>
      ) : (
        <p className="mt-3 text-[11px] leading-relaxed text-canvas-muted-foreground">
          This design uses the background alone. Turn on Scene image in Layers to generate a
          backdrop from a prompt.
        </p>
      )}
    </div>
  );
}

function Thumb({ template }: { template: ICTemplate }) {
  const rh = ratioHeight(template.ratio);
  const subjectRatio = template.subject?.ratio ?? 0.625;
  return (
    <div className="relative" style={{ background: template.thumb, aspectRatio: `1 / ${rh}` }}>
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

function rowLabel(e: ICElement): string {
  if (e.t === 'text' || e.t === 'pill') return e.text.split('\n').join(' ') || 'Empty text';
  if (e.t === 'line') return 'Line';
  if (e.t === 'shape') return 'Shape';
  return e.t === 'subject' ? 'Product' : e.name;
}

function RowIcon({ e }: { e: ICElement }) {
  const cls = 'size-3.5 shrink-0 text-canvas-muted-foreground';
  if (e.t === 'text') return <Type className={cls} />;
  if (e.t === 'pill') return <Circle className={cls} />;
  if (e.t === 'line') return <Minus className={cls} />;
  if (e.t === 'shape') return <Square className={cls} />;
  return e.t === 'subject' ? <Package className={cls} /> : <ImageIcon className={cls} />;
}

function Row({
  on,
  off,
  onClick,
  icon,
  label,
  onEye,
}: {
  on: boolean;
  off?: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  onEye?: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: the row holds a nested visibility button, so it cannot be a <button>
    <div
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      role="button"
      tabIndex={0}
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-[12px] ${
        on ? 'border-fuchsia-400/50 bg-canvas-muted' : 'border-transparent hover:bg-canvas-muted'
      }`}
    >
      {icon}
      <span
        className={`min-w-0 flex-1 truncate ${off ? 'text-canvas-muted-foreground line-through' : ''}`}
      >
        {label}
      </span>
      {onEye && (
        <button
          type="button"
          aria-label={off ? 'Show layer' : 'Hide layer'}
          onClick={(e) => {
            e.stopPropagation();
            onEye();
          }}
          className="text-canvas-muted-foreground hover:text-canvas-foreground"
        >
          {off ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      )}
    </div>
  );
}

function ImageCard({ api, id }: { api: StudioApi; id: string }) {
  const el = api.layout.els.find((e) => e.id === id);
  if (!el || (el.t !== 'subject' && el.t !== 'image')) return null;
  const isSubject = el.t === 'subject';
  const source = isSubject ? api.layout.subject : el;
  return (
    <Card>
      <div className="flex items-center gap-2.5">
        <div
          className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-canvas p-1"
          style={{
            backgroundImage:
              'conic-gradient(#2a2f37 25%, transparent 0 50%, #2a2f37 0 75%, transparent 0)',
            backgroundSize: '12px 12px',
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: a local data URL the user picked */}
          <img src={source.url} alt="" className="max-h-full max-w-full" />
        </div>
        <div className="min-w-0 text-[12px]">
          <div className="truncate text-canvas-foreground">{source.name}</div>
          <div className="text-[11px] text-canvas-muted-foreground">
            {isSubject ? 'Kept as your pixels' : 'Image layer'}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => api.pickImage(isSubject ? 'subject' : 'layer')}
        className={`${SMALL} mt-2.5 w-full`}
      >
        {isSubject ? 'Replace photo' : 'Replace image'}
      </button>
      <label className="mt-2.5 flex items-center gap-2 text-[11.5px] text-canvas-muted-foreground">
        <span className="w-10">Size</span>
        <input
          type="range"
          min={5}
          max={92}
          value={Math.round(el.w)}
          onChange={(e) => api.patch(id, { w: Number(e.target.value) })}
          className="flex-1 accent-emerald-500"
        />
      </label>
      {isSubject && (
        <p className="mt-2 text-[11px] leading-relaxed text-canvas-muted-foreground">
          Use a transparent PNG. A Remove background block in front will cut out any photo later.
        </p>
      )}
    </Card>
  );
}

function SceneCard({ api }: { api: StudioApi }) {
  const { scene } = api.layout;
  return (
    <Card>
      <button type="button" onClick={() => api.pickImage('scene')} className={`${SMALL} w-full`}>
        {scene.upload ? 'Replace image' : 'Upload image'}
      </button>
      {scene.upload && (
        <div className="mt-2 flex items-center gap-2 text-[12px]">
          <span className="min-w-0 flex-1 truncate">{scene.upload.name}</span>
          <button
            type="button"
            onClick={() => api.update((l) => ({ ...l, scene: { ...l.scene, upload: null } }))}
            className="text-emerald-400 hover:underline"
          >
            Remove
          </button>
        </div>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-canvas-muted-foreground">
        The prompt generates this image when the workflow runs. Upload your own to use it instead.
        Hide the layer to see the background.
      </p>
    </Card>
  );
}

function BackgroundCard({ api }: { api: StudioApi }) {
  const { bg } = api.layout;
  // The scene sits above the background, so choosing a background hides the scene.
  const setBg = (patch: Partial<ICLayout['bg']>) =>
    api.update((l) => ({ ...l, scene: { ...l.scene, on: false }, bg: { ...l.bg, ...patch } }));
  return (
    <Card>
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
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {SOLIDS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                className={SWATCH}
                style={{ background: c }}
                onClick={() => setBg({ color: c })}
              />
            ))}
          </div>
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
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {GRADIENTS.map(([from, to, angle]) => (
              <button
                key={`${from}${to}`}
                type="button"
                aria-label={`Gradient ${from} to ${to}`}
                className={SWATCH}
                style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}
                onClick={() => setBg({ from, to, angle })}
              />
            ))}
          </div>
        </>
      )}
      {bg.mode === 'transparent' && (
        <p className="text-[11px] leading-relaxed text-canvas-muted-foreground">
          Hide the Scene image layer to export a transparent PNG.
        </p>
      )}
    </Card>
  );
}

function TextCard({ api, el }: { api: StudioApi; el: ICText | ICPill }) {
  return (
    <Card>
      <textarea
        value={el.text}
        onChange={(e) => api.patch(el.id, { text: e.target.value })}
        spellCheck={false}
        rows={2}
        className={`${INPUT} resize-y`}
      />
      <div className="mt-2">
        <ThemedSelect
          id="ic-font-card"
          value={el.font}
          options={FONT_OPTIONS}
          onChange={(v) => api.patch(el.id, { font: v })}
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-canvas-muted-foreground">
        Drag it on the canvas to move it. Drag the corner to resize. Double-click to type.
      </p>
    </Card>
  );
}

export function ElementsPanel({ api }: { api: StudioApi }) {
  const add = 'grid grid-cols-2 gap-1.5';
  return (
    <div>
      <div className={LABEL}>Text</div>
      <div className={add}>
        <button type="button" className={SMALL} onClick={() => api.addText('text')}>
          Text
        </button>
        <button type="button" className={SMALL} onClick={() => api.addText('pill')}>
          Badge
        </button>
      </div>
      <div className={`${LABEL} mt-4`}>Shapes</div>
      <div className={add}>
        <button type="button" className={SMALL} onClick={() => api.addShape('rect')}>
          Rectangle
        </button>
        <button type="button" className={SMALL} onClick={() => api.addShape('ellipse')}>
          Circle
        </button>
      </div>
      <div className={`${LABEL} mt-4`}>Photos</div>
      <div className={add}>
        <button type="button" className={SMALL} onClick={() => api.pickImage('add')}>
          Upload image
        </button>
      </div>
    </div>
  );
}

export function LayersPanel({ api }: { api: StudioApi }) {
  const { layout, selId } = api;
  // Clicking an element on the canvas opens this tab, so scroll its row into view.
  useEffect(() => {
    if (selId)
      document.querySelector(`[data-row="${selId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selId]);
  return (
    <div>
      <div className={LABEL}>Layers</div>
      <div data-row="bg">
        <Row
          on={selId === 'bg'}
          onClick={() => api.select('bg')}
          icon={<LayoutTemplate className="size-3.5 shrink-0 text-canvas-muted-foreground" />}
          label="Background"
        />
        {selId === 'bg' && <BackgroundCard api={api} />}
      </div>
      <div data-row="scene">
        <Row
          on={selId === 'scene'}
          off={!layout.scene.on}
          onClick={() => api.select('scene')}
          icon={<ImageIcon className="size-3.5 shrink-0 text-canvas-muted-foreground" />}
          label="Scene image"
          onEye={() => api.update((l) => ({ ...l, scene: { ...l.scene, on: !l.scene.on } }))}
        />
        {selId === 'scene' && <SceneCard api={api} />}
      </div>
      {[...layout.els].reverse().map((e) => (
        <div key={e.id} data-row={e.id}>
          <Row
            on={selId === e.id}
            off={!e.vis}
            onClick={() => api.select(e.id)}
            icon={<RowIcon e={e} />}
            label={rowLabel(e)}
            onEye={() => api.patch(e.id, { vis: !e.vis })}
          />
          {selId === e.id && (e.t === 'text' || e.t === 'pill') && <TextCard api={api} el={e} />}
          {selId === e.id && (e.t === 'subject' || e.t === 'image') && (
            <ImageCard api={api} id={e.id} />
          )}
        </div>
      ))}
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

export function Toolbar({ api }: { api: StudioApi }) {
  const { layout, selId } = api;
  const el = layout.els.find((e) => e.id === selId);
  const name =
    selId === 'bg'
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
            }[el.t]
          : 'Nothing selected';
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-3 border-b border-canvas-border bg-canvas-muted px-3.5 py-1.5 text-[11.5px]">
      <span className="font-semibold text-canvas-foreground">{name}</span>
      {selId === 'scene' && (
        <button type="button" className={SMALL} onClick={() => api.pickImage('scene')}>
          Upload image
        </button>
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
          {!isFixedWeight(el.font) && (
            <Range
              label="Weight"
              value={el.weight}
              min={300}
              max={900}
              step={100}
              onChange={(v) => api.patch(el.id, { weight: v })}
            />
          )}
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
          {el.t === 'text' && (
            <div className="flex rounded-md border border-canvas-border p-0.5 text-[11px]">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => api.patch(el.id, { align: a })}
                  className={`rounded px-2 py-0.5 ${el.align === a ? 'bg-canvas text-canvas-foreground' : 'text-canvas-muted-foreground'}`}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {el?.t === 'line' && (
        <ColorInput
          label="Color"
          value={el.color}
          onChange={(v) => api.patch(el.id, { color: v })}
        />
      )}
      {el?.t === 'subject' && (
        <label className="flex items-center gap-2 text-[11.5px] text-canvas-muted-foreground">
          <input
            type="checkbox"
            checked={el.shadow}
            onChange={(e) => api.patch(el.id, { shadow: e.target.checked })}
            className="accent-emerald-500"
          />
          Shadow
        </label>
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
        </>
      )}
      {el?.t === 'image' && el.h !== undefined && (
        <Range
          label="Round"
          value={el.radius ?? 0}
          min={0}
          max={50}
          step={0.5}
          onChange={(v) => api.patch(el.id, { radius: v })}
        />
      )}
      {el?.t === 'subject' && (
        <label className="flex items-center gap-2 text-[11.5px] text-canvas-muted-foreground">
          <input
            type="checkbox"
            checked={el.reflect ?? false}
            onChange={(e) => api.patch(el.id, { reflect: e.target.checked })}
            className="accent-emerald-500"
          />
          Reflection
        </label>
      )}
      {el && (
        <>
          <Range
            label="Rotate"
            value={el.rot ?? 0}
            min={-180}
            max={180}
            step={1}
            onChange={(v) => api.patch(el.id, { rot: v })}
          />
          <Range
            label="Opacity"
            value={Math.round((el.op ?? 1) * 100)}
            min={0}
            max={100}
            step={1}
            onChange={(v) => api.patch(el.id, { op: v / 100 })}
          />
        </>
      )}
      {el && (
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" title="Bring forward" className={SMALL} onClick={() => api.move(1)}>
            Forward
          </button>
          <button
            type="button"
            title="Send backward"
            className={SMALL}
            onClick={() => api.move(-1)}
          >
            Back
          </button>
          <button
            type="button"
            title="Duplicate (Cmd+D)"
            className={`${SMALL} flex items-center gap-1`}
            onClick={api.duplicate}
          >
            <Copy className="size-3" /> Duplicate
          </button>
          {el.t !== 'subject' && (
            <button
              type="button"
              title="Delete"
              className={`${SMALL} flex items-center gap-1`}
              onClick={api.remove}
            >
              <Trash2 className="size-3" /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
