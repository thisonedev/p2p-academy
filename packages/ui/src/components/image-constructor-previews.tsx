'use client';

import { zipSync } from 'fflate';
import {
  Bookmark,
  Heart,
  Instagram,
  Linkedin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Repeat2,
  Send,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { textRoom, textWidth } from './image-constructor-fit.js';
import {
  type ICLayout,
  type ICRatio,
  type ICTemplate,
  resizeLayout,
} from './image-constructor-layout.js';
import { composeLayoutPdf } from './image-constructor-pdf.js';
import { composeLayout, layerBox } from './image-constructor-render.js';
import { composeLayoutSvg } from './image-constructor-svg.js';

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
  { key: 'x', label: 'X post', ratio: 'x-post', width: 1600, height: 900 },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    ratio: 'linkedin-post',
    width: 1200,
    height: 1200,
  },
  {
    key: 'instagram',
    label: 'Instagram',
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

export type ICExportFormat = 'png' | 'jpeg' | 'pdf' | 'svg';

/** The app a size is for. Story is a ring, not one app's logo, since Instagram and TikTok share it. */
function SizeIcon({ target, className = 'size-4' }: { target: Target; className?: string }) {
  if (target.key === 'linkedin') return <Linkedin className={className} />;
  if (target.key === 'instagram') return <Instagram className={className} />;
  if (target.key === 'x') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M18.9 2H22l-7.2 8.2L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.7-8.8L1.8 2h6.8l4.7 6.2L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z" />
      </svg>
    );
  }
  if (target.key === 'story') {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9.5" strokeDasharray="4.2 2.4" strokeLinecap="round" />
        <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return null;
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

/** Text that runs past its box or off the canvas, and word blocks that land on top of each other. */
function problems(layout: ICLayout): string[] {
  const out: string[] = [];
  const texts = layout.els.filter((e) => e.vis && (e.t === 'text' || e.t === 'pill'));
  let spill = 0;
  for (const e of texts) {
    if (e.t !== 'text' && e.t !== 'pill') continue;
    const w = textWidth(e);
    if (w === null) continue;
    const right = e.t === 'text' && e.align === 'left' ? e.x + w : e.x + e.w;
    // A turned text, such as a tagline down the side, runs along another axis.
    if (w > textRoom(e) + 0.5 || (!e.rot && right > 100.5)) spill += 1;
  }
  if (spill)
    out.push(
      spill === 1 ? 'A text runs outside its box.' : `${spill} texts run outside their boxes.`,
    );
  const boxes = texts.map((e) => layerBox(e, layout, 1000));
  const overlap = boxes.some((a, i) =>
    boxes.slice(i + 1).some((b) => {
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return w > 4 && h > Math.min(a.h, b.h) * 0.35;
    }),
  );
  if (overlap) out.push('Some texts overlap at this size.');
  return out;
}

// Every size sits in the same generic post: a colored avatar, a placeholder name and plain icons.
// Only the picture's shape changes, so the sizes are easy to compare side by side.
function Avatar({ color }: { color: string }) {
  return <span className="size-7 shrink-0 rounded-full" style={{ background: color }} />;
}

interface PostProps {
  target: Target;
  url: string | null;
  name: string;
  handle: string;
  color: string;
  safe: boolean;
}

function Post({ target, url, name, handle, color, safe }: PostProps) {
  const tall = target.height > target.width * 1.2;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f1115] p-3 font-sans text-[13px] text-white">
      <div className="mb-2.5 flex items-center gap-2">
        <Avatar color={color} />
        <div className="min-w-0 leading-tight">
          <div className="truncate font-semibold">{name}</div>
          <div className="text-[11.5px] text-white/50">@{handle} · 2h</div>
        </div>
        <MoreHorizontal className="ml-auto size-4 text-white/50" />
      </div>
      <div
        className={`relative overflow-hidden rounded-lg border border-white/10 ${tall ? 'mx-auto max-w-[260px]' : ''}`}
      >
        {url ? (
          // biome-ignore lint/performance/noImgElement: a local data URL
          <img src={url} alt={`${target.label} preview`} className="block w-full" />
        ) : (
          <div
            className="w-full animate-pulse bg-white/5"
            style={{ aspectRatio: `${target.width} / ${target.height}` }}
          />
        )}
        {/* What story apps cover with their own controls: about 250px on top, 330px below. */}
        {tall && safe && (
          <div className="absolute inset-x-0 top-0 h-[13%] border-b border-dashed border-white/40 bg-black/35" />
        )}
        {tall && safe && (
          <div className="absolute inset-x-0 bottom-0 h-[17%] border-t border-dashed border-white/40 bg-black/35" />
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-4 text-white/55">
        <Heart className="size-4" />
        <MessageCircle className="size-4" />
        <Repeat2 className="size-4" />
        <Send className="size-4" />
        <Bookmark className="ml-auto size-4" />
      </div>
    </div>
  );
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
}

/** Preview and export in one: every size in a mock of the app it's posted to, and one download for all. */
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
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [safe, setSafe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [what, setWhat] = useState<'canvas' | 'avatar-pfp' | 'avatar-full'>('canvas');
  const [draft, setDraft] = useState({ width: 1500, height: 500 });

  useEffect(() => {
    let live = true;
    targets.forEach((t, i) => {
      composeLayout(sized[i], sceneUrl, {
        width: t.height > t.width * 1.2 ? 400 : 720,
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

  const chosen = targets.filter((t) => picked[t.key] ?? true);
  const name =
    layout.shared?.brandName ??
    (layout.kit && layout.kit.name !== 'Default' ? layout.kit.name : 'Your Brand');
  const handle = slug(name).replace(/-/g, '');
  const color = layout.kit?.roles.accent ?? '#6366f1';
  const ext = settings.format === 'jpeg' ? 'jpg' : settings.format;
  const scale = settings.format === 'svg' ? 1 : settings.mult;

  const render = async (t: Target, i: number): Promise<string> => {
    const width = Math.round(t.width * scale);
    if (settings.format === 'svg') {
      const svg = await composeLayoutSvg(sized[i], sceneUrl, t.width);
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
    if (settings.format === 'pdf') return composeLayoutPdf(sized[i], sceneUrl, width);
    return composeLayout(sized[i], sceneUrl, {
      width,
      format: settings.format,
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
    try {
      if (what !== 'canvas' && onAvatarExport) {
        await onAvatarExport(what);
        return;
      }
      const base = layout.templateId === 'blank' ? 'design' : slug(template.title);
      const named = (t: Target) =>
        `${base}-${slug(t.label)}-${Math.round(t.width * scale)}x${Math.round(t.height * scale)}.${ext}`;
      // One size downloads as its own file; several come as one zip.
      if (chosen.length === 1) {
        save(await render(chosen[0], targets.indexOf(chosen[0])), named(chosen[0]));
        return;
      }
      const files: Record<string, Uint8Array> = {};
      for (const t of chosen) files[named(t)] = bytesOf(await render(t, targets.indexOf(t)));
      const zip = zipSync(files, { level: 0 });
      const href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
      save(href, `${base}-${chosen.length}-sizes.zip`);
      setTimeout(() => URL.revokeObjectURL(href), 5000);
    } finally {
      setBusy(false);
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
  const seg = (on: boolean) =>
    `rounded px-2 py-1 ${on ? 'bg-canvas-muted text-canvas-foreground' : 'text-canvas-muted-foreground hover:text-canvas-foreground'}`;

  const card = (t: Target, i: number): ReactNode => {
    const notes = problems(sized[i]);
    return (
      <div
        key={t.key}
        className={`mb-4 flex break-inside-avoid flex-col gap-2 rounded-xl border border-canvas-border bg-canvas p-3 ${
          (picked[t.key] ?? true) ? '' : 'opacity-40'
        }`}
      >
        <div className="flex items-center gap-2 text-[12px]">
          <SizeIcon target={t} className="size-3.5 text-canvas-muted-foreground" />
          <span className="font-semibold text-canvas-foreground">{t.label}</span>
          <span className="text-canvas-muted-foreground">
            {t.width}×{t.height}
          </span>
          <button
            type="button"
            className={`${small} ml-auto`}
            onClick={() => onEdit(t.ratio, t.custom)}
          >
            Edit
          </button>
        </div>
        {notes.length > 0 && (
          <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">
            {notes.join(' ')} Edit this size to fix it.
          </div>
        )}
        <Post
          target={t}
          url={urls[t.key] ?? null}
          name={name}
          handle={handle}
          color={color}
          safe={safe}
        />
      </div>
    );
  };

  const label = busy
    ? 'Exporting…'
    : what !== 'canvas'
      ? 'Download'
      : `Download ${chosen.length} ${chosen.length === 1 ? 'file' : 'files'}`;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-canvas-muted">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-canvas-border px-4 py-3 text-[12px]">
        <div className="text-sm font-semibold">Preview</div>
        {onAvatarExport && (
          <div className="flex rounded-md border border-canvas-border p-0.5">
            {(
              [
                ['canvas', 'Design'],
                ['avatar-pfp', 'Avatar PFP'],
                ['avatar-full', 'Avatar full body'],
              ] as const
            ).map(([v, text]) => (
              <button key={v} type="button" onClick={() => setWhat(v)} className={seg(what === v)}>
                {text}
              </button>
            ))}
          </div>
        )}
        <div className="flex rounded-md border border-canvas-border p-0.5">
          {(['png', 'jpeg', 'pdf', 'svg'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onSettings({ ...settings, format: f })}
              className={seg(settings.format === f)}
            >
              {f === 'jpeg' ? 'JPG' : f.toUpperCase()}
            </button>
          ))}
        </div>
        {settings.format !== 'svg' && (
          <div className="flex rounded-md border border-canvas-border p-0.5">
            {EXPORT_SCALES.map((s) => (
              <button
                key={s.label}
                type="button"
                title={
                  s.mult === 1
                    ? 'The size each app asks for'
                    : `${s.mult}× the size each app asks for`
                }
                onClick={() => onSettings({ ...settings, mult: s.mult })}
                className={seg(settings.mult === s.mult)}
              >
                {s.label}
              </button>
            ))}
          </div>
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
        {what === 'canvas' && (
          <label className="flex items-center gap-1.5 text-canvas-muted-foreground">
            <input
              type="checkbox"
              checked={safe}
              onChange={(e) => setSafe(e.target.checked)}
              className="accent-fuchsia-400"
            />
            Story safe areas
          </label>
        )}
        <div className="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            disabled={busy || (what === 'canvas' && chosen.length === 0)}
            onClick={() => void download()}
            className="rounded-md border border-emerald-500/60 px-3 py-1.5 font-semibold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"
          >
            {label}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="text-canvas-muted-foreground hover:text-canvas-foreground"
          >
            <X className="size-4" />
          </button>
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
                    ? 'border-fuchsia-400 bg-fuchsia-400/10 text-canvas-foreground'
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
                  <button
                    type="button"
                    title="Remove this size"
                    className="mr-1.5 rounded p-0.5 text-canvas-muted-foreground hover:text-canvas-foreground"
                    onClick={() =>
                      onSizes((layout.exportSizes ?? []).filter((s) => s !== t.custom))
                    }
                  >
                    <X className="size-3" />
                  </button>
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
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {what !== 'canvas' ? (
          <p className="text-[12px] text-canvas-muted-foreground">
            The avatar on its own, in the format and size picked above.
          </p>
        ) : (
          // Masonry: cards keep their own heights and flow into columns, so tall stories leave no gaps.
          <div className="[column-gap:1rem] [column-width:300px]">{targets.map(card)}</div>
        )}
      </div>
    </div>
  );
}
