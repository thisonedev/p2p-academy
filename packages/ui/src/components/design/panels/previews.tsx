'use client';

import { zipSync } from 'fflate';
import {
  Pencil,
  Plus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { composeVideo, videoSize } from '../video/films.js';
import {
  type ICLayout,
  type ICRatio,
  type ICTemplate,
  ratioHeight,
  resizeLayout,
} from '../render/layout.js';
import { MotionPreview } from '../motion/motion-panel.js';
import { composeLayoutPdf, pngsToPdf } from '../render/pdf.js';
import { PlatformIcon } from './platform-icon.js';
import { previews } from './preview-hold.js';
import { composeLayout } from '../render/render.js';
import { composeLayoutSvg } from '../render/svg.js';
import { findTemplate } from '../templates/templates.js';
import { allPages } from '../templates/thread.js';
import { composeStory, StoryPreview, storySize } from '../video/video-panel.js';
import { IconButton } from '../../ui/icon-button.js';
import { SegmentButton, SegmentGroup } from '../../ui/segment-group.js';

/** One place the design will be posted, and the size it uses. */
interface Target {
  key: string;
  label: string;
  /** Where else this size is used, for the tooltip. */
  hint?: string;
  ratio: ICRatio;
  width: number;
  height: number;
  custom?: { width: number; height: number };
}

const NAMED: Target[] = [
  { key: 'x', label: 'X Post', ratio: 'x-post', width: 1600, height: 900 },
  {
    key: 'linkedin',
    label: 'LinkedIn Post',
    ratio: 'linkedin-post',
    width: 1080,
    height: 1350,
  },
  {
    key: 'instagram',
    label: 'IG Post',
    ratio: 'ig-post',
    width: 1080,
    height: 1080,
  },
  {
    key: 'story',
    label: 'Story',
    hint: 'Instagram and TikTok',
    ratio: 'story',
    width: 1080,
    height: 1920,
  },
];

/** `mp4` is the design's short clip, `video` its longer video of slides. */
export type ICExportFormat = 'png' | 'jpeg' | 'pdf' | 'svg' | 'mp4' | 'video';

function SizeIcon({ target, className }: { target: Target; className?: string }) {
  return <PlatformIcon app={target.key} className={className} />;
}

/** Export settings, the same ones the single-size export always had. */
export interface ICExportSettings {
  format: ICExportFormat;
  /** Scale on each size's own pixel dimensions; 1 is the size the app asks for. */
  mult: number;
  /** JPEG only, 40 to 100. */
  quality: number;
  /** PNG only. */
  transparent: boolean;
  /** MP4 only: frames a second. */
  fps: number;
  /** MP4 only: whether the file has the video's music and effects. */
  sound: boolean;
}

export const EXPORT_SCALES = [
  { label: 'Small', mult: 0.5 },
  { label: 'Medium', mult: 1 },
  { label: 'Large', mult: 2 },
  { label: 'Extra large', mult: 4 },
] as const;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'design';

const bytesOf = (url: string) => {
  if (url.startsWith('data:image/svg+xml;utf8,')) {
    return new TextEncoder().encode(decodeURIComponent(url.slice(url.indexOf(',') + 1)));
  }
  const raw = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const GAP = 16;
/** The height a tile's label takes under it. */
const LABEL = 26;
/** Below this height a preview no longer reads, so the sheet scrolls instead. */
const SMALLEST = 150;

/** One height for every preview, and the rows they sit in, so that all of them show in a space
 *  `wide` by `tall` without scrolling. `ratios` are widths over heights. */
function fitRows(ratios: number[], wide: number, tall: number): { h: number; rows: number[][] } {
  const all = ratios.map((_, i) => i);
  if (!ratios.length || wide <= 0 || tall <= 0) return { h: 240, rows: [all] };
  const total = ratios.reduce((a, b) => a + b, 0);
  let best = { h: 0, rows: [all] };
  for (let n = 1; n <= Math.min(3, ratios.length); n++) {
    // Rows of about the same width, kept in order.
    const rows: number[][] = [[]];
    let sum = 0;
    ratios.forEach((r, i) => {
      const row = rows[rows.length - 1];
      if (row.length && rows.length < n && sum + r / 2 > (total / n) * rows.length) rows.push([i]);
      else row.push(i);
      sum += r;
    });
    const h = Math.min(
      (tall - rows.length * LABEL - (rows.length - 1) * GAP) / rows.length,
      ...rows.map(
        (row) => (wide - (row.length - 1) * GAP) / row.reduce((a, i) => a + ratios[i], 0),
      ),
    );
    if (h > best.h) best = { h, rows };
  }
  return { h: Math.max(SMALLEST, Math.floor(best.h)), rows: best.rows };
}

export interface ExportSheetProps {
  layout: ICLayout;
  template: ICTemplate;
  sceneUrl: string | null;
  settings: ICExportSettings;
  onSettings: (s: ICExportSettings) => void;
  onClose: () => void;
  /** Opens that size in the studio. */
  onEdit: (ratio: ICRatio, custom?: { width: number; height: number }) => void;
  onSizes: (sizes: { width: number; height: number }[]) => void;
  /** Set when the design has an avatar, which can also be exported on its own. */
  onAvatarExport?: (mode: 'avatar-pfp' | 'avatar-full') => Promise<void>;
  /** The avatar on its own as a picture, for the preview. */
  onAvatarPreview?: (mode: 'avatar-pfp' | 'avatar-full') => Promise<string>;
}

/** Preview and export in one: every size side by side, and one download for all. */
export function ExportSheet({
  layout,
  template,
  sceneUrl,
  settings,
  onSettings,
  onClose,
  onEdit,
  onSizes,
  onAvatarExport,
  onAvatarPreview,
}: ExportSheetProps) {
  const targets = useMemo<Target[]>(
    () => [
      ...NAMED,
      ...(layout.exportSizes ?? []).map((s) => ({
        key: `custom-${s.width}x${s.height}`,
        label: 'Custom',
        ratio: 'custom' as ICRatio,
        width: s.width,
        height: s.height,
        custom: s,
      })),
    ],
    [layout.exportSizes],
  );
  const sized = useMemo(
    () =>
      targets.map((t) => resizeLayout(layout, template, t.ratio, t.custom ?? layout.customSize)),
    [targets, layout, template],
  );
  const [urls, setUrls] = useState<Record<string, string>>({});
  const pageCount = layout.thread?.pages.length ?? 1;
  const [every, setEvery] = useState(pageCount > 1);
  // Every page of a thread at every size, each laid out for that size by its own template.
  const pageSized = useMemo(() => {
    if (!every || pageCount < 2) return null;
    const pages = allPages(layout);
    return targets.map((t, i) =>
      pages.map((page) =>
        page === layout
          ? sized[i]
          : resizeLayout(
              page,
              findTemplate(page.templateId),
              t.ratio,
              t.custom ?? layout.customSize,
            ),
      ),
    );
  }, [every, pageCount, layout, targets, sized]);
  const [pageUrls, setPageUrls] = useState<Record<string, string>>({});
  // A thread exports every page, so it starts with only the size it's being designed in.
  const [picked, setPicked] = useState<Record<string, boolean>>(() => {
    if (!layout.thread) return {};
    const tall = ratioHeight(layout.ratio, layout.customSize);
    const own = targets.find((t) => Math.abs(t.height / t.width - tall) < 0.01);
    return own ? Object.fromEntries(targets.map((t) => [t.key, t === own])) : {};
  });
  // What goes out and in what order: sizes by key, and a thread's pages by index. Removing or
  // dragging here changes the export only; the design stays as it is.
  const [order, setOrder] = useState<string[]>([]);
  const [keptPages, setKeptPages] = useState<number[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  // The space the previews have, less its padding. They are sized to fill it without scrolling.
  const roomRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = roomRef.current;
    if (!el) return;
    const seen = new ResizeObserver(([e]) =>
      setRoom({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }),
    );
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  const [safe, setSafe] = useState(true);
  const [busy, setBusy] = useState(false);
  // The sheet opens with its previews playing, whatever the last one was left at. Closing it
  // stops a render that is under way, which would otherwise run on unseen to its end.
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => {
    previews.set(false);
    return () => inFlight.current?.abort();
  }, []);
  // While a video renders: which one, and how far along it is.
  const [progress, setProgress] = useState('');
  const [failed, setFailed] = useState('');
  const [what, setWhat] = useState<'canvas' | 'avatar-pfp' | 'avatar-full'>('canvas');
  const [draft, setDraft] = useState({ width: 1500, height: 500 });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (what === 'canvas' || !onAvatarPreview) return;
    let live = true;
    setAvatarUrl(null);
    onAvatarPreview(what)
      .then((url) => live && setAvatarUrl(url))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [what, onAvatarPreview]);
  const [onePdf, setOnePdf] = useState(true);

  useEffect(() => {
    let live = true;
    targets.forEach((t, i) => {
      composeLayout(sized[i], sceneUrl, {
        width: t.height > t.width * 1.2 ? 640 : 1200,
        format: 'jpeg',
        quality: 0.85,
      })
        .then((url) => live && setUrls((u) => ({ ...u, [t.key]: url })))
        .catch(() => undefined);
    });
    return () => {
      live = false;
    };
  }, [targets, sized, sceneUrl]);

  useEffect(() => {
    if (!pageSized) return;
    let live = true;
    targets.forEach((t, i) => {
      pageSized[i].forEach((page, p) => {
        composeLayout(page, sceneUrl, { width: 320, format: 'jpeg', quality: 0.8 })
          .then((url) => live && setPageUrls((u) => ({ ...u, [`${t.key}#${p}`]: url })))
          .catch(() => undefined);
      });
    });
    return () => {
      live = false;
    };
  }, [targets, pageSized, sceneUrl]);

  const rank = (key: string, i: number) => {
    const at = order.indexOf(key);
    return at < 0 ? order.length + i : at;
  };
  const ordered = targets
    .map((t, i) => ({ t, r: rank(t.key, i) }))
    .sort((a, b) => a.r - b.r)
    .map(({ t }) => t);
  const chosen = ordered.filter((t) => picked[t.key] ?? true);
  const pagesOut = keptPages ?? Array.from({ length: pageCount }, (_, i) => i);
  /** Moves `from` to where `to` is in a list, for drag-to-reorder. */
  const moved = <T,>(list: T[], from: T, to: T): T[] => {
    const rest = list.filter((x) => x !== from);
    rest.splice(rest.indexOf(to), 0, from);
    return rest;
  };
  const dropSize = (to: string) => {
    if (dragging?.startsWith('size:'))
      setOrder(
        moved(
          ordered.map((t) => t.key),
          dragging.slice(5),
          to,
        ),
      );
    setDragging(null);
  };
  const dropPage = (to: number) => {
    if (dragging?.startsWith('page:')) setKeptPages(moved(pagesOut, Number(dragging.slice(5)), to));
    setDragging(null);
  };
  const ext = settings.format === 'jpeg' ? 'jpg' : settings.format;
  const scale = settings.format === 'svg' ? 1 : settings.mult;
  const video = settings.format === 'mp4' && what === 'canvas';
  const story = settings.format === 'video' && what === 'canvas';

  const render = async (t: Target, l: ICLayout): Promise<string> => {
    const width = Math.round(t.width * scale);
    if (settings.format === 'svg') {
      const svg = await composeLayoutSvg(l, sceneUrl, t.width);
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
    if (settings.format === 'pdf') return composeLayoutPdf(l, sceneUrl, width);
    return composeLayout(l, sceneUrl, {
      width,
      // A video is saved by `composeVideo`; a still of it is a PNG.
      format: settings.format === 'jpeg' ? 'jpeg' : 'png',
      quality: settings.quality / 100,
      transparentBg: settings.transparent,
    });
  };

  const save = (href: string, filename: string) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.click();
  };

  const download = async () => {
    setBusy(true);
    setFailed('');
    // The previews stand still while a download renders, which leaves it the whole machine.
    const paused = previews.paused;
    previews.set(true);
    const run = new AbortController();
    inFlight.current = run;
    try {
      if (what !== 'canvas' && onAvatarExport) {
        await onAvatarExport(what);
        return;
      }
      const base =
        layout.templateId === 'blank'
          ? 'design'
          : slug(findTemplate(layout.thread?.root ?? layout.templateId).title);
      const dims = (t: Target, l?: ICLayout) => {
        // A video stops at 4K, so its name says the size it was really saved at.
        const v = video && l ? videoSize(l, scale) : null;
        return v
          ? `${v.width}x${v.height}`
          : `${Math.round(t.width * scale)}x${Math.round(t.height * scale)}`;
      };
      // A thread's pages come grouped by platform, a folder each, numbered in thread order.
      const jobs = pageSized
        ? chosen.flatMap((t) =>
            pagesOut.map((p, n) => {
              const l = pageSized[targets.indexOf(t)][p];
              return {
                name: `${slug(t.label)}-${dims(t, l)}/${base}-${String(n + 1).padStart(2, '0')}.${ext}`,
                t,
                l,
              };
            }),
          )
        : chosen.map((t) => {
            const l = sized[targets.indexOf(t)];
            return { name: `${base}-${slug(t.label)}-${dims(t, l)}.${ext}`, t, l };
          });
      // Videos render one after another, each in the app, then save like any other file. The
      // longer video is one file a size, its pages inside it, so a thread adds no files.
      if (video || story) {
        const list = story
          ? chosen.map((t) => {
              const l = sized[targets.indexOf(t)];
              const size = storySize(l, scale);
              return { name: `${base}-${slug(t.label)}-video-${size.width}x${size.height}.mp4`, l };
            })
          : jobs;
        const files: Record<string, Uint8Array> = {};
        for (const [i, j] of list.entries()) {
          const onProgress = (done: number) =>
            setProgress(
              `Rendering ${list.length > 1 ? `${i + 1} of ${list.length} · ` : ''}${Math.round(done * 100)}%`,
            );
          const blob = story
            ? await composeStory(j.l, sceneUrl, {
                fps: settings.fps,
                scale,
                sound: settings.sound,
                onProgress,
                signal: run.signal,
              })
            : await composeVideo(j.l, sceneUrl, {
                fps: settings.fps,
                scale,
                sound: settings.sound,
                onProgress,
                signal: run.signal,
              });
          if (list.length === 1) {
            const href = URL.createObjectURL(blob);
            save(href, j.name);
            setTimeout(() => URL.revokeObjectURL(href), 5000);
            return;
          }
          files[j.name] = new Uint8Array(await blob.arrayBuffer());
        }
        const href = URL.createObjectURL(
          new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }),
        );
        save(href, `${base}-${list.length}-videos.zip`);
        setTimeout(() => URL.revokeObjectURL(href), 5000);
        return;
      }
      // Several PDFs can go out as one, a page each.
      if (settings.format === 'pdf' && onePdf && jobs.length > 1) {
        const pngs = [];
        for (const j of jobs)
          pngs.push(
            await composeLayout(j.l, sceneUrl, {
              width: Math.round(j.t.width * scale),
              format: 'png',
            }),
          );
        save(await pngsToPdf(pngs), `${base}.pdf`);
        return;
      }
      // One file downloads as it is; several come as one zip.
      if (jobs.length === 1) {
        save(await render(jobs[0].t, jobs[0].l), jobs[0].name);
        return;
      }
      const files: Record<string, Uint8Array> = {};
      for (const j of jobs) files[j.name] = bytesOf(await render(j.t, j.l));
      const zip = zipSync(files, { level: 0 });
      const href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
      save(
        href,
        pageSized ? `${base}-${pagesOut.length}-pages.zip` : `${base}-${chosen.length}-sizes.zip`,
      );
      setTimeout(() => URL.revokeObjectURL(href), 5000);
    } catch (e) {
      // Stopped by closing the sheet, which is not a failure to report.
      if (!run.signal.aborted)
        setFailed(e instanceof Error ? e.message : 'The export could not be made.');
    } finally {
      previews.set(paused);
      setBusy(false);
      setProgress('');
    }
  };

  // The same limits as the canvas's own Custom size.
  const addSize = () => {
    const width = Math.min(8000, Math.max(64, Math.round(draft.width)));
    const height = Math.min(8000, Math.max(64, Math.round(draft.height)));
    const list = layout.exportSizes ?? [];
    if (!list.some((s) => s.width === width && s.height === height)) {
      onSizes([...list, { width, height }]);
    }
  };

  const input =
    'w-20 rounded-md border border-canvas-border bg-canvas px-2 py-1 text-[12px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60';
  const small =
    'rounded-md border border-canvas-border bg-canvas px-2.5 py-1 text-[12px] text-canvas-foreground hover:bg-canvas-muted';

  const remove = (t: Target) => (
    <button
      type="button"
      title="Leave this size out of the export"
      aria-label={`Remove ${t.label}`}
      className="rounded p-1 text-canvas-muted-foreground hover:bg-canvas-muted hover:text-canvas-foreground"
      onClick={() => setPicked((p) => ({ ...p, [t.key]: false }))}
    >
      <X className="size-3.5" />
    </button>
  );
  const dragSize = (t: Target) => ({
    draggable: true,
    onDragStart: () => setDragging(`size:${t.key}`),
    onDragOver: (e: { preventDefault: () => void }) =>
      dragging?.startsWith('size:') && e.preventDefault(),
    onDrop: () => dropSize(t.key),
    onDragEnd: () => setDragging(null),
  });

  const over =
    'rounded bg-black/70 p-1 text-white hover:bg-black focus:outline-none focus-visible:ring-1 focus-visible:ring-white';
  // One size as it will download: the picture, the clip or the video, and its name under it.
  const tile = (t: Target, h: number): ReactNode => {
    const l = sized[targets.indexOf(t)];
    const loud = settings.sound && t.key === chosen[0]?.key;
    const url = urls[t.key];
    // Only story-shaped posts (9:16) have app controls over them; a 4:5 feed post has none.
    const bands = safe && !story && t.height >= t.width * 1.6;
    return (
      <div
        key={t.key}
        {...dragSize(t)}
        className={`group/tile shrink-0 cursor-grab ${dragging === `size:${t.key}` ? 'opacity-60' : ''}`}
        style={{ width: (h * t.width) / t.height }}
      >
        <div className="relative overflow-hidden rounded-xl border border-canvas-border">
          {story ? (
            <StoryPreview layout={l} sceneUrl={sceneUrl} loud={loud} fill />
          ) : video ? (
            <MotionPreview
              layout={l}
              sceneUrl={sceneUrl}
              width={t.height > t.width * 1.2 ? 400 : 720}
              loud={loud}
            />
          ) : url ? (
            // biome-ignore lint/performance/noImgElement: a local data URL
            <img src={url} alt={`${t.label} preview`} draggable={false} className="block w-full" />
          ) : (
            <div
              className="w-full animate-pulse bg-white/5"
              style={{ aspectRatio: `${t.width} / ${t.height}` }}
            />
          )}
          {/* What story apps cover with their own controls: about 250px on top, 330px below. */}
          {bands && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[13%] border-b border-dashed border-white/40 bg-black/35" />
          )}
          {bands && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[17%] border-t border-dashed border-white/40 bg-black/35" />
          )}
          {/* Over the video's own pause button, which covers the whole preview. */}
          <div className="absolute right-1.5 top-1.5 z-40 flex gap-1 opacity-0 focus-within:opacity-100 group-hover/tile:opacity-100">
            <button
              type="button"
              title="Edit this size"
              aria-label={`Edit ${t.label}`}
              className={over}
              onClick={() => onEdit(t.ratio, t.custom)}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              title="Leave this size out of the export"
              aria-label={`Remove ${t.label}`}
              className={over}
              onClick={() => setPicked((p) => ({ ...p, [t.key]: false }))}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-1.5 truncate text-center text-[11px] text-canvas-muted-foreground">
          {t.label}
        </div>
      </div>
    );
  };
  const fit = fitRows(
    chosen.map((t) => t.width / t.height),
    room.w,
    room.h,
  );

  // One platform's copy of the whole thread: every page in order, as it will download.
  const pageStrip = (t: Target): ReactNode => {
    const i = targets.indexOf(t);
    const w = t.height > t.width * 1.2 ? 120 : t.width > t.height * 1.2 ? 240 : 170;
    return (
      <section
        key={t.key}
        {...dragSize(t)}
        className={`rounded-xl border bg-canvas p-3 ${
          dragging === `size:${t.key}` ? 'border-emerald-400 opacity-60' : 'border-canvas-border'
        }`}
      >
        <div className="mb-2.5 flex items-center gap-2 text-[12px]">
          <SizeIcon target={t} className="size-3.5 text-canvas-muted-foreground" />
          <span className="font-semibold text-canvas-foreground">{t.label}</span>
          <span className="text-canvas-muted-foreground">
            {t.width}×{t.height} · {pagesOut.length} of {pageCount} pages
          </span>
          {pagesOut.length < pageCount && (
            <button type="button" className={small} onClick={() => setKeptPages(null)}>
              Restore pages
            </button>
          )}
          <button
            type="button"
            className={`${small} ml-auto`}
            onClick={() => onEdit(t.ratio, t.custom)}
          >
            Edit
          </button>
          {remove(t)}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {pagesOut.map((p, n) => {
            const url = pageUrls[`${t.key}#${p}`];
            return (
              <figure
                key={`${t.key}#${p}`}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  setDragging(`page:${p}`);
                }}
                onDragOver={(e) => dragging?.startsWith('page:') && e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation();
                  dropPage(p);
                }}
                onDragEnd={() => setDragging(null)}
                className={`group/page relative shrink-0 cursor-grab ${dragging === `page:${p}` ? 'opacity-50' : ''}`}
                style={{ width: w }}
              >
                {url ? (
                  // biome-ignore lint/performance/noImgElement: a rendered data URL
                  <img src={url} alt={`Page ${p + 1}`} className="w-full rounded-md" />
                ) : (
                  <div
                    className="w-full rounded-md bg-canvas-muted"
                    style={{ aspectRatio: `${t.width} / ${t.height}` }}
                  />
                )}
                <figcaption className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[10px] text-white">
                  {n + 1}
                </figcaption>
                {pagesOut.length > 1 && (
                  <button
                    type="button"
                    title="Leave this page out of the export"
                    aria-label={`Remove page ${n + 1}`}
                    onClick={() => setKeptPages(pagesOut.filter((x) => x !== p))}
                    className="absolute right-1 top-1 rounded bg-black/70 p-0.5 text-white opacity-0 group-hover/page:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </figure>
            );
          })}
        </div>
      </section>
    );
  };

  const count = chosen.length * (pageSized && !story ? pagesOut.length : 1);
  const files = settings.format === 'pdf' && onePdf && count > 1 ? 1 : count;
  const label = busy
    ? progress || 'Exporting…'
    : what !== 'canvas'
      ? 'Download'
      : `Download ${files} ${files === 1 ? 'file' : 'files'}${
          pageSized && files > 1
            ? ` (${chosen.length} ${chosen.length === 1 ? 'size' : 'sizes'} × ${pagesOut.length} pages)`
            : ''
        }`;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-canvas-muted">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-canvas-border px-4 py-3 text-[12px]">
        <div className="text-sm font-semibold">Preview</div>
        {onAvatarExport && (
          <SegmentGroup>
            {(
              [
                ['canvas', 'Design'],
                ['avatar-pfp', 'Avatar PFP'],
                ['avatar-full', 'Avatar full body'],
              ] as const
            ).map(([v, text]) => (
              <SegmentButton
                key={v}
                onClick={() => {
                  setWhat(v);
                  // An avatar is a picture, so a video choice goes back to PNG.
                  if (v !== 'canvas' && (settings.format === 'mp4' || settings.format === 'video'))
                    onSettings({ ...settings, format: 'png' });
                }}
                on={what === v}
              >
                {text}
              </SegmentButton>
            ))}
          </SegmentGroup>
        )}
        {what === 'canvas' && pageCount > 1 && (
          <SegmentGroup>
            <SegmentButton onClick={() => setEvery(false)} on={!every}>
              This page
            </SegmentButton>
            <SegmentButton onClick={() => setEvery(true)} on={every}>
              All {pageCount} pages
            </SegmentButton>
          </SegmentGroup>
        )}
        <SegmentGroup>
          {(
            [
              'png',
              'jpeg',
              'pdf',
              'svg',
              ...(what === 'canvas' ? (['mp4', 'video'] as const) : []),
            ] as const
          ).map((f) => (
            <SegmentButton
              key={f}
              onClick={() => onSettings({ ...settings, format: f })}
              on={settings.format === f}
            >
              {f === 'jpeg'
                ? 'JPG'
                : f === 'mp4'
                  ? 'Clip'
                  : f === 'video'
                    ? 'Video'
                    : f.toUpperCase()}
            </SegmentButton>
          ))}
        </SegmentGroup>
        {settings.format !== 'svg' && (
          <SegmentGroup>
            {EXPORT_SCALES.map((s) => (
              <SegmentButton
                key={s.label}
                title={
                  s.mult === 1
                    ? 'The size each app asks for'
                    : `${s.mult}× the size each app asks for`
                }
                onClick={() => onSettings({ ...settings, mult: s.mult })}
                on={settings.mult === s.mult}
              >
                {s.label}
              </SegmentButton>
            ))}
          </SegmentGroup>
        )}
        {what === 'canvas' && settings.format === 'pdf' && count > 1 && (
          <SegmentGroup>
            <SegmentButton onClick={() => setOnePdf(true)} on={onePdf}>
              One PDF
            </SegmentButton>
            <SegmentButton onClick={() => setOnePdf(false)} on={!onePdf}>
              Separate files
            </SegmentButton>
          </SegmentGroup>
        )}
        {settings.format === 'jpeg' && (
          <label className="flex items-center gap-2 text-canvas-muted-foreground">
            Quality
            <input
              type="range"
              min={40}
              max={100}
              value={settings.quality}
              onChange={(e) => onSettings({ ...settings, quality: Number(e.target.value) })}
              className="w-24 accent-emerald-500"
            />
            {settings.quality}%
          </label>
        )}
        {(video || story) && (
          <SegmentGroup>
            {[30, 60].map((n) => (
              <SegmentButton
                key={n}
                onClick={() => onSettings({ ...settings, fps: n })}
                on={settings.fps === n}
              >
                {n} fps
              </SegmentButton>
            ))}
          </SegmentGroup>
        )}
        {(video || story) && (
          // The timeline's own speaker button. On, the first preview is heard and the saved
          // files have the sound. Off, both are silent.
          <button
            type="button"
            onClick={() => onSettings({ ...settings, sound: !settings.sound })}
            aria-label={settings.sound ? 'Sound on' : 'Sound off'}
            aria-pressed={settings.sound}
            title={settings.sound ? 'Sound on' : 'Sound off'}
            className="flex size-7 items-center justify-center rounded-md border border-canvas-border hover:bg-canvas-muted"
          >
            {settings.sound ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
          </button>
        )}
        {settings.format === 'png' && (
          <label className="flex items-center gap-1.5 text-canvas-muted-foreground">
            <input
              type="checkbox"
              checked={settings.transparent}
              onChange={(e) => onSettings({ ...settings, transparent: e.target.checked })}
              className="accent-emerald-500"
            />
            Transparent background
          </label>
        )}
        {what === 'canvas' && !story && (
          <label className="flex items-center gap-1.5 text-canvas-muted-foreground">
            <input
              type="checkbox"
              checked={safe}
              onChange={(e) => setSafe(e.target.checked)}
              className="accent-emerald-400"
            />
            Story safe areas
          </label>
        )}
        <div className="ml-auto flex items-center gap-2.5">
          {failed && <span className="text-red-400">{failed}</span>}
          <button
            type="button"
            disabled={busy || (what === 'canvas' && chosen.length === 0)}
            onClick={() => void download()}
            className="rounded-md border border-emerald-500/60 px-3 py-1.5 font-semibold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"
          >
            {label}
          </button>
          <IconButton
            onClick={onClose}
            aria-label="Close preview"
          >
            <X className="size-4" />
          </IconButton>
        </div>
      </div>
      {what === 'canvas' && (
        <div className="flex flex-wrap items-center gap-2 border-b border-canvas-border px-4 py-2.5 text-[12px]">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70">
            Sizes
          </span>
          {targets.map((t) => {
            const on = picked[t.key] ?? true;
            const tip = `${t.label}${t.hint ? ` (${t.hint})` : ''} · ${t.width}×${t.height}`;
            return (
              <div
                key={t.key}
                className={`flex h-8 items-center rounded-lg border ${
                  on
                    ? 'border-emerald-400 bg-emerald-400/10 text-canvas-foreground'
                    : 'border-canvas-border text-canvas-muted-foreground/60 hover:border-canvas-muted-foreground hover:text-canvas-foreground'
                }`}
              >
                <button
                  type="button"
                  title={`${on ? 'Skip' : 'Include'} ${tip}`}
                  aria-label={tip}
                  aria-pressed={on}
                  onClick={() => setPicked((p) => ({ ...p, [t.key]: !on }))}
                  className={`flex h-full items-center ${t.custom ? 'pl-2.5 pr-1' : 'w-8 justify-center'}`}
                >
                  {t.custom ? `${t.width}×${t.height}` : <SizeIcon target={t} />}
                </button>
                {t.custom && (
                  <IconButton
                    look="small"
                    title="Remove this size"
                    className="mr-1.5"
                    onClick={() =>
                      onSizes((layout.exportSizes ?? []).filter((s) => s !== t.custom))
                    }
                  >
                    <X className="size-3" />
                  </IconButton>
                )}
              </div>
            );
          })}
          <form
            className="ml-1 flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              addSize();
            }}
          >
            <input
              type="number"
              min={64}
              max={8000}
              value={draft.width}
              onChange={(e) => setDraft((d) => ({ ...d, width: Number(e.target.value) || 1 }))}
              aria-label="Custom width"
              className={input}
            />
            <span className="text-canvas-muted-foreground">×</span>
            <input
              type="number"
              min={64}
              max={8000}
              value={draft.height}
              onChange={(e) => setDraft((d) => ({ ...d, height: Number(e.target.value) || 1 }))}
              aria-label="Custom height"
              className={input}
            />
            <button type="submit" className={`${small} flex items-center gap-1`}>
              <Plus className="size-3" /> Custom size
            </button>
          </form>
        </div>
      )}
      <div ref={roomRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {what !== 'canvas' ? (
          <div className="flex h-full items-center justify-center">
            <div
              className={`flex items-center justify-center overflow-hidden rounded-xl border border-canvas-border ${
                what === 'avatar-pfp' ? 'size-72' : 'h-[28rem] w-72'
              }`}
              style={{
                background:
                  settings.transparent && settings.format === 'png'
                    ? 'repeating-conic-gradient(#3a3d44 0 25%, #2a2d33 0 50%) 0 0 / 16px 16px'
                    : undefined,
              }}
            >
              {avatarUrl ? (
                // biome-ignore lint/performance/noImgElement: a rendered data URL
                <img src={avatarUrl} alt="Avatar preview" className="max-h-full max-w-full" />
              ) : (
                <div className="size-full animate-pulse bg-canvas" />
              )}
            </div>
          </div>
        ) : pageSized && !story ? (
          <div className="flex flex-col gap-4">{chosen.map(pageStrip)}</div>
        ) : (
          // Every size at one height, in as few rows as show them all at once.
          <div className="flex min-h-full flex-col items-center justify-center gap-4">
            {fit.rows.map((row) => (
              <div key={chosen[row[0]].key} className="flex justify-center gap-4">
                {row.map((i) => tile(chosen[i], fit.h))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
