'use client';

import { catalogStorage } from '@academy/core';
import type { AcademyCatalogEntry } from '@academy/validation';
import { ArrowRight, Pencil, Plus, Search } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ANNOUNCE_BRANDS } from './image-constructor-announce.js';
import { DESIGNS_KIND, designSize, designThumb, loadDesign, redrawThumb } from './image-constructor-designs.js';
import { RenameField, renameDesign } from './image-constructor-my-designs.js';
import {
  type ICLayout,
  type ICRatio,
  type ICTemplate,
  layoutFromTemplate,
  RATIO_DIMENSIONS,
} from './image-constructor-layout.js';
import { templatePreview } from './image-constructor-panels.js';
import { canvasHeight, drawLayout, loadImages } from './image-constructor-render.js';
import { ALL_TEMPLATES, TEMPLATE_PACKS } from './image-constructor-templates.js';

/** A new design: one of the named post sizes, or a typed width and height. */
export type ICNewSize = { ratio: ICRatio } | { width: number; height: number };

const SIZES: { ratio: ICRatio; label: string; note?: string }[] = [
  { ratio: 'ig-post', label: 'IG Post' },
  { ratio: 'x-post', label: 'X Post' },
  { ratio: 'linkedin-post', label: 'LinkedIn Post' },
  { ratio: 'story', label: 'Story', note: 'IG, TikTok' },
];

const PAGE = 6;
const CARDS = 3;

/** A small outline of a size, drawn at its real shape inside a `box` pixel square. */
function RatioIcon({ ratio, box }: { ratio: ICRatio; box: number }) {
  const dims = RATIO_DIMENSIONS[ratio] ?? { width: 1, height: 1 };
  const k = box / Math.max(dims.width, dims.height);
  return (
    <i
      className="block rounded-[2px] border-[1.6px] border-current"
      style={{ width: dims.width * k, height: dims.height * k }}
    />
  );
}

/** The + at the top of the rail and the size menu it opens. */
export function CreateButton({
  onCreate,
  openTick = 0,
}: {
  onCreate: (size: ICNewSize) => void;
  /** Goes up to open the menu from elsewhere, like Home's New design card. */
  openTick?: number;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openTick > 0) setOpen(true);
  }, [openTick]);
  const [width, setWidth] = useState('1200');
  const [height, setHeight] = useState('628');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close, true);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const pick = (size: ICNewSize) => {
    setOpen(false);
    onCreate(size);
  };
  const w = Number(width);
  const h = Number(height);
  const customOk = w >= 50 && h >= 50 && w <= 8000 && h <= 8000;
  return (
    <div ref={ref} className="relative mb-1.5 flex flex-col items-center gap-1">
      <button
        type="button"
        title="New design"
        aria-label="New design"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex size-8 items-center justify-center rounded-[9px] bg-emerald-400 text-emerald-950 hover:bg-emerald-300 ${open ? 'outline outline-2 outline-offset-[3px] outline-emerald-400' : ''}`}
      >
        <Plus className="size-4" strokeWidth={2.4} />
      </button>
      <span className="text-[10px] text-canvas-foreground">Create</span>
      {open && (
        <div className="absolute left-[50px] top-0 z-30 w-[300px] rounded-[14px] border border-canvas-border bg-canvas-raised p-3 font-mono shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]">
          <div className="mx-1 mb-2.5 mt-0.5 font-sans text-[13px] font-bold">New design</div>
          {SIZES.map(({ ratio, label, note }) => (
            <button
              key={ratio}
              type="button"
              onClick={() => pick({ ratio })}
              className="flex w-full items-center gap-3 rounded-[9px] p-2 text-left hover:bg-canvas-muted"
            >
              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-canvas-muted text-canvas-muted-foreground">
                <RatioIcon ratio={ratio} box={18} />
              </span>
              <span>
                <span className="block font-sans text-[12.5px] font-medium">{label}</span>
                {note && (
                  <span className="block text-[10.5px] text-canvas-muted-foreground/70">{note}</span>
                )}
              </span>
            </button>
          ))}
          <div className="my-2 border-t border-canvas-border" />
          <form
            className="flex items-center gap-1.5 p-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (customOk) pick({ width: w, height: h });
            }}
          >
            {[
              [width, setWidth, 'Width'] as const,
              [height, setHeight, 'Height'] as const,
            ].map(([value, set, label], i) => (
              <span key={label} className="contents">
                {i === 1 && <span className="text-canvas-muted-foreground/70">×</span>}
                <input
                  aria-label={label}
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
                  className="h-[30px] w-[72px] rounded-[7px] border border-canvas-border bg-canvas px-2 text-[12px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                />
              </span>
            ))}
            <button
              type="submit"
              disabled={!customOk}
              className="ml-auto h-[30px] rounded-lg bg-emerald-400 px-3 text-[12px] font-semibold text-emerald-950 hover:bg-emerald-300 disabled:opacity-40"
            >
              Create
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function ago(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function useUrl(make: () => Promise<string>, deps: unknown[]): string | null {
  const [url, setUrl] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: callers list what the picture depends on
  useEffect(() => {
    let live = true;
    make()
      .then((u) => live && setUrl(u))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, deps);
  return url;
}

/** The saved thumbnail, swapped for a sharp redraw when it predates `hd`. */
function SavedThumb({ entry }: { entry: AcademyCatalogEntry }) {
  const sharp = useUrl(
    () => redrawThumb(entry.id, entry.preview).then((u) => u ?? Promise.reject()),
    [entry.id, entry.updatedAt],
  );
  const url = sharp ?? designThumb(entry.preview);
  // biome-ignore lint/performance/noImgElement: a local data URL
  return url ? <img src={url} alt="" className="size-full object-contain" /> : null;
}

function Card({
  thumb,
  name,
  meta,
  onOpen,
  onRename,
}: {
  thumb: ReactNode;
  name: string;
  meta: ReactNode;
  onOpen: () => void;
  /** Present for saved designs only: an unsaved one has no library entry to rename. */
  onRename?: (name: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  return (
    <div className="group relative flex min-w-0 flex-col rounded-2xl border border-canvas-border bg-canvas-muted p-2.5 transition-colors hover:border-emerald-500/60">
      <button
        type="button"
        onClick={onOpen}
        title={`Open ${name}`}
        className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-[10px] border border-canvas-border bg-canvas"
      >
        {thumb}
      </button>
      {onRename && !renaming && (
        <button
          type="button"
          title="Rename"
          aria-label={`Rename ${name}`}
          onClick={() => setRenaming(true)}
          className="absolute right-4 top-4 flex size-6 items-center justify-center rounded-md bg-black/60 text-canvas-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Pencil className="size-3.5" />
        </button>
      )}
      <div className="mx-1 mt-3">
        {renaming ? (
          <RenameField
            name={name}
            onDone={(next) => {
              setRenaming(false);
              if (next) onRename?.(next);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="block w-full truncate text-left font-sans text-[14px] font-semibold"
          >
            {name}
          </button>
        )}
      </div>
      <div className="mx-1 mb-0.5 mt-1 flex items-center gap-2 font-mono text-[11px] text-canvas-muted-foreground">
        {meta}
      </div>
    </div>
  );
}

function TemplateRow({ template, onUse }: { template: ICTemplate; onUse: () => void }) {
  const thumb = useUrl(() => templatePreview(template), [template]);
  const pages = template.thread?.pages.length ?? 1;
  return (
    <button
      type="button"
      onClick={onUse}
      title={`Use ${template.title}`}
      className="group flex min-w-0 items-center gap-4 rounded-2xl border border-canvas-border bg-canvas-muted p-2.5 text-left transition-colors hover:border-emerald-500/60"
    >
      <div className="flex aspect-video w-[144px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-canvas-border bg-canvas">
        {/* biome-ignore lint/performance/noImgElement: a local data URL */}
        {thumb && <img src={thumb} alt="" className="size-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-sans text-[15px] font-semibold text-canvas-foreground">{template.title}</div>
        <div className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-canvas-muted-foreground">
          {template.pack}
          {/* Only threads have more than one page, so a count on every row would just repeat 1. */}
          {pages > 1 && (
            <span className="rounded-full border border-canvas-border bg-canvas px-2 text-[10px] font-semibold uppercase tracking-[0.08em]">
              {pages} pages
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="mr-2 size-4 shrink-0 text-canvas-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-emerald-400" />
    </button>
  );
}

/** The kits offered as chips on Home; P2P Academy stays in the editor's UI Kit picker only. */
const HERO_BRANDS = ANNOUNCE_BRANDS.filter((b) => b.id !== 'p2p');

/** One template per size for the hero, found by family in each brand; QVAC names two differently. */
const FAN: [families: string[], ratio: ICRatio][] = [
  [['launch'], 'x-post'],
  [['milestone', 'benchmark'], 'ig-post'],
  [['ama', 'office-hours'], 'story'],
];

/** Three templates in the chosen kit, fanned like cards. Drawn straight onto canvases, so a new kit shows at once. */
function HeroFan({ brand }: { brand: string }) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const run = useRef(0);
  useEffect(() => {
    const mine = ++run.current;
    const frame = requestAnimationFrame(async () => {
      for (const [i, [families, ratio]] of FAN.entries()) {
        const t = ALL_TEMPLATES.find(
          (x) => x.pack === 'Announcement' && x.brand === brand && families.includes(x.family ?? ''),
        );
        const canvas = canvases.current[i];
        if (!t || !canvas) continue;
        const layout = layoutFromTemplate(t, undefined, undefined, ratio);
        const images = await loadImages(layout, null);
        if (mine !== run.current) return;
        const width = ratio === 'x-post' ? 560 : ratio === 'story' ? 180 : 300;
        canvas.width = width;
        canvas.height = canvasHeight(layout, width);
        const ctx = canvas.getContext('2d');
        if (ctx) drawLayout(ctx, layout, images, width);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [brand]);
  const card = 'absolute overflow-hidden rounded-[10px] border border-white/10 shadow-[0_22px_40px_-12px_rgba(0,0,0,0.75)]';
  const place = [
    'right-[4%] top-1.5 w-[62%] rotate-[3deg] aspect-video',
    'bottom-0 left-[8%] z-10 w-[32%] -rotate-[5deg] aspect-square',
    '-bottom-8 right-0 z-20 w-[19%] rotate-[6deg] aspect-[9/16]',
  ];
  return (
    <div className="relative hidden h-[190px] md:block" aria-hidden>
      {place.map((cls, i) => (
        <canvas
          key={cls}
          ref={(el) => {
            canvases.current[i] = el;
          }}
          className={`${card} ${cls}`}
        />
      ))}
    </div>
  );
}

/** A Home section with the same header as the app's home page sections. */
function Section({
  eyebrow,
  title,
  sub,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-14">
      <div aria-hidden className="flex items-center gap-3">
        <span className="h-0.5 w-10 rounded-full bg-emerald-500" />
        <span className="h-px flex-1 bg-canvas-border" />
      </div>
      <div className="mb-5 mt-5 flex items-end gap-4">
        <div className="min-w-0">
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-400">
            {eyebrow}
          </p>
          <h2 className="font-sans text-[26px] font-bold leading-tight tracking-tight text-canvas-foreground">
            {title}
          </h2>
          {sub && <p className="mt-1.5 font-mono text-[13px] text-canvas-muted-foreground">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The studio's start page: search, the designs to pick up again, and every template. */
export function StudioHome({
  current,
  onOpenCurrent,
  onOpenDesign,
  onUseTemplate,
  onRenamed,
  brand,
  onBrand,
  onNew,
}: {
  current: ICLayout;
  onOpenCurrent: () => void;
  onOpenDesign: (layout: ICLayout) => void;
  onUseTemplate: (template: ICTemplate) => void;
  /** A saved design got a new name, so the open copy can follow it. */
  onRenamed: (id: string, name: string) => void;
  /** The brand templates show in, and new designs start in. */
  brand: string;
  onBrand: (brand: string) => void;
  /** Opens the New design menu. */
  onNew: () => void;
}) {
  const [query, setQuery] = useState('');
  const [pack, setPack] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [allCards, setAllCards] = useState(false);
  const [saved, setSaved] = useState<AcademyCatalogEntry[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!catalogStorage.available()) return;
    catalogStorage
      .list(DESIGNS_KIND)
      .then((list) => setSaved([...list].sort((a, b) => b.updatedAt - a.updatedAt)))
      .catch(() => setSaved([]));
  }, []);

  // `/` jumps to search, unless you're already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== '/' || t.closest('input, textarea, [contenteditable]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const rename = (id: string, name: string) =>
    void renameDesign(id, name).then(() => {
      setSaved((list) => list.map((e) => (e.id === id ? { ...e, title: name } : e)));
      onRenamed(id, name);
    }, () => undefined);

  const q = query.trim().toLowerCase();
  const matches = (text: string) => !q || text.toLowerCase().includes(q);
  // Only saved designs: a template opened to look at isn't work to come back to.
  const designs = saved.filter((s) => matches(s.title));
  const cardCount = designs.length;
  const cardLimit = allCards ? Number.POSITIVE_INFINITY : CARDS;

  const packs = useMemo(() => TEMPLATE_PACKS.filter((p) => p !== 'Blank'), []);
  const inKit = ALL_TEMPLATES.filter(
    (t) =>
      !t.hidden &&
      t.pack !== 'Blank' &&
      t.brand === brand &&
      (matches(t.title) || matches(t.pack)),
  );
  const templates = pack ? inKit.filter((t) => t.pack === pack) : inKit;
  const kit = ANNOUNCE_BRANDS.find((b) => b.id === brand) ?? ANNOUNCE_BRANDS[0];
  const k = kit.kit.roles;

  return (
    <div className="min-h-0 overflow-y-auto bg-canvas px-10 pb-12 pt-7 font-mono">
      {/* Capped and centered, so rows and search stay a readable length on wide screens. */}
      <div className="mx-auto max-w-5xl">
        {/* The hero is drawn in the kit you're designing in, with three of its templates beside the search. */}
        <div
          className="grid items-center gap-6 overflow-hidden rounded-2xl border p-7 md:grid-cols-[1.25fr_1fr]"
          style={{
            background: `radial-gradient(100% 130% at 100% 0%, ${k.bg2}, ${k.bg} 62%)`,
            borderColor: `${k.ink}14`,
            color: k.ink,
          }}
        >
          <div className="min-w-0">
            <h1 className="font-sans text-[28px] font-extrabold tracking-tight">GM</h1>
            <p className="mt-1 font-sans text-[13px]" style={{ color: k.muted }}>
              Let's create something epic today
            </p>
          <label className="mt-4 flex h-11 items-center gap-2.5 rounded-xl border px-3.5 text-[12.5px]"
            style={{ background: `${k.ink}0d`, borderColor: `${k.ink}1f`, color: k.ink }}>
            <Search className="size-4" style={{ color: k.muted }} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(PAGE);
              }}
              placeholder="Search templates and your designs"
              className="min-w-0 flex-1 bg-transparent placeholder:opacity-60 focus:outline-none"
              style={{ color: k.ink }}
            />
            <kbd className="rounded border border-b-2 px-1.5 text-[10px]" style={{ borderColor: `${k.muted}55`, color: k.muted }}>
              /
            </kbd>
          </label>
            <div className="mt-3 flex flex-wrap gap-1">
              {HERO_BRANDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onBrand(b.id)}
                  aria-pressed={b.id === brand}
                  className="flex h-7 items-center gap-1.5 rounded-full border px-2 text-[11px]"
                  style={
                    b.id === brand
                      ? { borderColor: k.accent, background: `${k.accent}29`, color: k.ink }
                      : { borderColor: `${k.ink}24`, color: k.muted }
                  }
                >
                  <span className="size-2.5 rounded-full" style={{ background: b.kit.roles.accent }} />
                  {b.name}
                </button>
              ))}
            </div>
          </div>
          <HeroFan brand={brand} />
        </div>

        {cardCount > 0 && (
          <Section
            eyebrow="Your designs"
            title="Continue designing"
            action={
              cardCount > CARDS && (
                <button
                  type="button"
                  onClick={() => setAllCards(!allCards)}
                  className="ml-auto flex shrink-0 items-center gap-1.5 text-[12px] text-canvas-muted-foreground hover:text-emerald-400"
                >
                  {allCards ? 'Show less' : `See all ${cardCount}`}
                  {!allCards && <ArrowRight className="size-4" />}
                </button>
              )
            }
          >
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <button
                type="button"
                onClick={onNew}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-canvas-border p-4 transition-colors hover:border-canvas-muted-foreground hover:bg-canvas-muted"
              >
                <span
                  className="flex size-12 items-center justify-center rounded-[10px] border border-emerald-400/30 text-emerald-400"
                  style={{ background: 'color-mix(in oklab, var(--color-emerald-400) 10%, var(--color-canvas))' }}
                >
                  <Plus className="size-5" strokeWidth={2.2} />
                </span>
                <span className="text-center">
                  <span className="block font-sans text-[14px] font-semibold text-canvas-foreground">New design</span>
                  <span className="mt-1 block text-[11px] text-canvas-muted-foreground">Pick a size</span>
                </span>
              </button>
              {designs.slice(0, cardLimit).map((entry) => {
                const size = designSize(entry.preview);
                return (
                  <Card
                    key={entry.id}
                    thumb={<SavedThumb entry={entry} />}
                    name={entry.title}
                    meta={
                      <>
                        {ago(entry.updatedAt)}
                        {size && (
                          <>
                            <span aria-hidden className="text-canvas-border">
                              ·
                            </span>
                            {size}
                          </>
                        )}
                      </>
                    }
                    onOpen={() =>
                      // The open design goes back as it is, unsaved edits included.
                      entry.id === current.saved?.id
                        ? onOpenCurrent()
                        : void loadDesign(entry.id, entry.title).then(onOpenDesign, () => undefined)
                    }
                    onRename={(name) => rename(entry.id, name)}
                  />
                );
              })}
            </div>
          </Section>
        )}

        <Section
          eyebrow="Templates"
          title="Start from a template"
          sub={`${templates.length} ${templates.length === 1 ? 'template' : 'templates'} in the ${kit.name} kit. Pick a kit above to see them in it.`}
        >
          <div className="mb-4 flex flex-wrap gap-1.5">
            {[null, ...packs].map((p) => (
              <button
                key={p ?? 'all'}
                type="button"
                onClick={() => {
                  setPack(p);
                  setShown(PAGE);
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] ${pack === p ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400' : 'border-canvas-border bg-canvas text-canvas-muted-foreground hover:text-canvas-foreground'}`}
              >
                {p ?? 'All'}
                <span className="font-normal opacity-70">
                  {p ? inKit.filter((t) => t.pack === p).length : inKit.length}
                </span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {templates.slice(0, shown).map((t) => (
              <TemplateRow key={t.id} template={t} onUse={() => onUseTemplate(t)} />
            ))}
          </div>
          {templates.length > shown && (
            <div className="mt-5 flex items-center gap-3">
              <span aria-hidden className="h-px flex-1 bg-canvas-border" />
              <button
                type="button"
                onClick={() => setShown(templates.length)}
                className="rounded-lg border border-canvas-border bg-canvas-muted px-3.5 py-2 text-[12px] font-semibold transition-colors hover:border-emerald-500/60 hover:text-emerald-400"
              >
                Show {templates.length - shown} more
              </button>
              <span aria-hidden className="h-px flex-1 bg-canvas-border" />
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
