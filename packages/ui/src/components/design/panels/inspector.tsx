'use client';

import {
  ImagePlus,
  Star,
  Minus,
  Plus,
  X,
  Ungroup,
  Group,
  Eye,
  Shuffle,
  ImageUp,
  Trash2,
  EyeOff,
  ArrowLeftRight,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { brandOfKit, ANNOUNCE_BRANDS } from '../templates/announce.js';
import { BrandPicker } from '../brand/brand-picker.js';
import { LayersPanel } from '../studio/layers.js';
import { layoutFromTemplate, defaultRatio, type ICElement, shuffleTexture } from '../render/layout.js';
import { DEFAULT_GRID, type ICGrid } from '../render/grid.js';
import { parseRanked } from '../templates/bench.js';
import { findTemplate, ALL_TEMPLATES } from '../templates/templates.js';
import { type Kind, itemTitles, type ListEdit, editList, parseChanges, parseProducts } from '../templates/updates.js';
import { Row } from './controls.js';
import { IconButton } from '../../ui/icon-button.js';
import { FoldSection } from './fold-section.js';
import type { StudioApi } from './studio-api.js';
import { LABEL, SMALL } from './panel-shared.js';
import { BoxIconButton, ColorInput } from './panel-fields.js';
import { BackgroundControls, TextureControls } from './background-controls.js';
import { LayerSections } from './layer-sections.js';
import { fieldClass } from '../../ui/field.js';

const KIND_ORDER: Kind[] = ['new', 'imp', 'fix'];

const KIND_UI: Record<Kind, { glyph: string; label: string; cls: string }> = {
  new: { glyph: '+', label: 'New', cls: 'text-tag-new' },
  imp: { glyph: '↑', label: 'Improved', cls: 'text-tag-improved' },
  fix: { glyph: '✓', label: 'Fixed', cls: 'text-tag-fixed' },
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
        <div key={i} className="flex items-center gap-1.5 text-label">
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
              <BoxIconButton
                icon={ImagePlus}
                title={changes[i].photo ? 'Remove the screenshot' : 'Add a screenshot'}
                active={changes[i].photo}
                disabled={!changes[i].photo && photos >= (info.photoMax ?? 4)}
                onClick={() => edit({ op: 'photo', index: i, photo: !changes[i].photo })}
              />
            </>
          )}
          {info.shape === 'ranked' && (
            <BoxIconButton
              icon={Star}
              title={i === active ? 'The highlighted model' : 'Highlight this model'}
              active={i === active}
              onClick={() => edit({ op: 'active', index: i })}
            />
          )}
          <span className="min-w-0 flex-1 truncate">{title || `Untitled ${noun}`}</span>
          {info.shape === 'products' && (
            <span className="flex shrink-0 items-center gap-1">
              <BoxIconButton
                icon={Minus}
                title="One item fewer"
                disabled={counts[i] <= 1}
                onClick={() => edit({ op: 'remove-item', product: i })}
              />
              <span className="w-4 text-center text-canvas-muted-foreground">{counts[i]}</span>
              <BoxIconButton
                icon={Plus}
                title="One more item"
                disabled={counts[i] >= (info.perMax ?? 8)}
                onClick={() => edit({ op: 'add-item', product: i })}
              />
            </span>
          )}
          <BoxIconButton
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
        <span className="text-caption text-canvas-muted-foreground/70">
          {n} of {info.max}
        </span>
      </div>
    </div>
  );
}

/** Sections that start folded; the rest start open. Kept across selections. */
const FOLDED = new Set(['Playground slot']);

/** The right-hand panel. Section names and order follow Figma's Design panel, so they read familiar. */
export function Inspector({
  api,
  motion,
  video,
}: {
  api: StudioApi;
  /** The Motion tab. The studio owns whether it is open, since the canvas plays while it is. */
  motion?: { open: boolean; setOpen: (open: boolean) => void; panel: ReactNode };
  /** The Video tab, open or shut by the studio for the same reason. */
  video?: { open: boolean; setOpen: (open: boolean) => void; panel: ReactNode };
}) {
  const { layout, selId } = api;
  const el = layout.els.find((e) => e.id === selId);
  const [own, setOwn] = useState<'design' | 'layers'>('design');
  const tab = video?.open ? 'video' : motion?.open ? 'motion' : own;
  const setTab = (next: 'design' | 'layers') => {
    setOwn(next);
    motion?.setOpen(false);
    video?.setOpen(false);
  };
  const [, refold] = useState(0);
  const section = (title: string, children: ReactNode, action?: ReactNode) => (
    <FoldSection
      title={title}
      action={action}
      open={!FOLDED.has(title)}
      onToggle={() => {
        if (FOLDED.has(title)) FOLDED.delete(title);
        else FOLDED.add(title);
        refold((n) => n + 1);
      }}
    >
      {children}
    </FoldSection>
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
    `flex-1 rounded-md py-1 text-caption ${on ? 'bg-canvas-muted text-canvas-foreground' : 'text-canvas-muted-foreground hover:text-canvas-foreground'}`;

  return (
    <aside data-studio-inspector className="flex min-h-0 flex-col border-l border-canvas-border bg-canvas">
      <div className="flex gap-1 border-b border-canvas-border p-2">
        <button type="button" className={tabClass(tab === 'design')} onClick={() => setTab('design')}>
          Design
        </button>
        <button type="button" className={tabClass(tab === 'layers')} onClick={() => setTab('layers')}>
          Layers
        </button>
        {motion && (
          <button type="button" className={tabClass(tab === 'motion')} onClick={() => motion.setOpen(true)}>
            Motion
          </button>
        )}
        {video && (
          <button type="button" className={tabClass(tab === 'video')} onClick={() => video.setOpen(true)}>
            Video
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'video' ? (
          video?.panel
        ) : tab === 'motion' ? (
          motion?.panel
        ) : tab === 'layers' ? (
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
            {/* The size is set in the top bar. The grid leads here, where it is hard to miss. */}
            {design && section('Layout grid', <GridControls api={api} />)}
            {design && findTemplate(api.layout.templateId).list && section('Items', <ItemsSection api={api} />)}
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
                  <IconButton
                    look="small"
                    onClick={() => api.update(shuffleTexture)}
                    title="Shuffle texture"
                    aria-label="Shuffle texture"
                  >
                    <Shuffle className="size-3.5" />
                  </IconButton>,
                )}
              </>
            )}
            {selId === 'scene' &&
              section(
                'AI background',
                <div className="flex flex-wrap gap-1.5">
                  <BoxIconButton
                    icon={layout.scene.upload ? ImageUp : ImagePlus}
                    title={layout.scene.upload ? 'Replace image' : 'Upload image'}
                    onClick={() => api.pickImage('scene')}
                  />
                  {layout.scene.upload && (
                    <BoxIconButton
                      icon={Trash2}
                      title="Remove uploaded image"
                      onClick={() => api.update((l) => ({ ...l, scene: { ...l.scene, upload: null } }))}
                    />
                  )}
                  <BoxIconButton
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
            <BoxIconButton icon={ArrowLeftRight} title="Swap sides" onClick={api.swapBrands} />
            <BoxIconButton
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
            className={`${SMALL} flex h-[34px] w-full items-center justify-center gap-1`}
            onClick={() => api.chooseTemplate(cobrand)}
          >
            <Plus className="size-3" /> Add partner
          </button>
        )
      )}
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
    <label className="flex items-center justify-between gap-3 text-caption text-canvas-muted-foreground">
      {label}
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onSet(Math.min(max, Math.max(0, Number(e.target.value) || 0)))}
        className={fieldClass('sm', 'w-16 text-right')}
      />
    </label>
  );
  const check = (label: string, on: boolean, onSet: (v: boolean) => void) => (
    <label className="flex items-center gap-1.5 text-caption text-canvas-muted-foreground">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onSet(e.target.checked)}
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
      <p className="text-caption leading-relaxed text-canvas-muted-foreground">
        Rows at 0 give columns only, a step of 0 hides the baseline. Hold Cmd or Ctrl while
        dragging to place freely.
      </p>
    </div>
  );
}
