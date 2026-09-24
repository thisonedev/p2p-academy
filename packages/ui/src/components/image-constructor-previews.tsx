'use client';

import { zipSync } from 'fflate';
import {
  BarChart2,
  Bookmark,
  Heart,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Repeat,
  Repeat2,
  Send,
  Share,
  ThumbsUp,
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

/** One place the design will be posted: which size it uses and how that app frames it. */
interface Target {
  key: string;
  label: string;
  ratio: ICRatio;
  width: number;
  height: number;
  frame: 'x' | 'linkedin' | 'instagram' | 'story' | 'plain';
  custom?: { width: number; height: number };
}

const NAMED: Target[] = [
  { key: 'x', label: 'X post', ratio: 'x-post', width: 1600, height: 900, frame: 'x' },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    ratio: 'linkedin-post',
    width: 1200,
    height: 1200,
    frame: 'linkedin',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    ratio: 'ig-post',
    width: 1080,
    height: 1080,
    frame: 'instagram',
  },
  { key: 'story', label: 'Story', ratio: 'story', width: 1080, height: 1920, frame: 'story' },
];

export type ICExportFormat = 'png' | 'jpeg' | 'pdf' | 'svg';

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
    if (w > textRoom(e) + 0.5 || right > 100.5) spill += 1;
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

// The app chrome around each preview is generic on purpose: a colored avatar, a placeholder name
// and plain icons, so it reads as "an X post" or "a story" without copying anyone's branding.
function Avatar({ color, size = 32 }: { color: string; size?: number }) {
  return (
    <span
      className="shrink-0 rounded-full"
      style={{ width: size, height: size, background: color }}
    />
  );
}

interface FrameProps {
  target: Target;
  url: string | null;
  name: string;
  handle: string;
  color: string;
  safe: boolean;
}

function Frame({ target, url, name, handle, color, safe }: FrameProps) {
  const img = url ? (
    // biome-ignore lint/performance/noImgElement: a local data URL
    <img src={url} alt={`${target.label} preview`} className="block w-full" />
  ) : (
    <div
      className="w-full animate-pulse bg-black/10"
      style={{ aspectRatio: `${target.width} / ${target.height}` }}
    />
  );
  const icons = (list: [typeof Heart, string][]) =>
    list.map(([Icon, text], i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: a fixed row of icons
      <span key={i} className="flex items-center gap-1">
        <Icon className="size-4" /> {text}
      </span>
    ));
  if (target.frame === 'x') {
    return (
      <div className="rounded-2xl border border-white/10 bg-black p-3 font-sans text-[13px] text-white">
        <div className="flex gap-2.5">
          <Avatar color={color} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="font-bold">{name}</span>
              <span className="text-white/50">@{handle} · 2h</span>
              <MoreHorizontal className="ml-auto size-4 text-white/50" />
            </div>
            <p className="mb-2 mt-0.5">Big news today. More in the thread.</p>
            <div className="overflow-hidden rounded-2xl border border-white/15">{img}</div>
            <div className="mt-2 flex justify-between text-[12px] text-white/50">
              {icons([
                [MessageCircle, '24'],
                [Repeat2, '118'],
                [Heart, '1.2K'],
                [BarChart2, '48K'],
                [Share, ''],
              ])}
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (target.frame === 'linkedin') {
    return (
      <div className="overflow-hidden rounded-lg border border-black/10 bg-white font-sans text-[13px] text-[#191919]">
        <div className="flex gap-2 p-3">
          <Avatar color={color} size={40} />
          <div>
            <div className="font-semibold">{name}</div>
            <div className="text-[11.5px] text-black/55">12,480 followers · 1h</div>
          </div>
        </div>
        <p className="px-3 pb-2">We're excited to share something new with you.</p>
        {img}
        <div className="flex justify-around border-t border-black/10 px-2 py-2 text-[12px] text-black/60">
          {icons([
            [ThumbsUp, 'Like'],
            [MessageSquare, 'Comment'],
            [Repeat, 'Repost'],
            [Send, 'Send'],
          ])}
        </div>
      </div>
    );
  }
  if (target.frame === 'instagram') {
    return (
      <div className="overflow-hidden rounded-lg border border-black/10 bg-white font-sans text-[13px] text-[#111]">
        <div className="flex items-center gap-2 p-2.5">
          <Avatar color={color} size={30} />
          <span className="font-semibold">{handle}</span>
          <MoreHorizontal className="ml-auto size-4" />
        </div>
        {img}
        <div className="flex items-center gap-3.5 p-2.5">
          <Heart className="size-5" />
          <MessageCircle className="size-5" />
          <Send className="size-5" />
          <Bookmark className="ml-auto size-5" />
        </div>
        <div className="px-2.5 pb-3">
          <div className="font-semibold">1,024 likes</div>
          <div>
            <span className="font-semibold">{handle}</span> Something new is here.
          </div>
        </div>
      </div>
    );
  }
  if (target.frame === 'story') {
    return (
      <div className="relative mx-auto w-full max-w-[280px] overflow-hidden rounded-[26px] border-[6px] border-black bg-black font-sans text-white">
        {img}
        {/* What Instagram and TikTok cover with their own controls: about 250px on top, 330px below. */}
        {safe && <div className="absolute inset-x-0 top-0 h-[13%] bg-red-500/30" />}
        {safe && <div className="absolute inset-x-0 bottom-0 h-[17%] bg-red-500/30" />}
        <div className="absolute inset-x-2.5 top-2.5 flex gap-1">
          <span className="h-0.5 flex-1 rounded bg-white" />
          <span className="h-0.5 flex-1 rounded bg-white/40" />
        </div>
        <div className="absolute left-2.5 top-5 flex items-center gap-2 text-[12px]">
          <Avatar color={color} size={24} />
          <span className="font-semibold">{handle}</span>
          <span className="text-white/70">2h</span>
        </div>
        <div className="absolute inset-x-2.5 bottom-3 flex items-center gap-2.5 text-[12px]">
          <span className="flex-1 rounded-full border border-white/60 px-3 py-1.5 text-white/80">
            Send message
          </span>
          <Heart className="size-5" />
          <Send className="size-5" />
        </div>
      </div>
    );
  }
  return <div className="overflow-hidden rounded-lg border border-white/15">{img}</div>;
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
        frame: 'plain' as const,
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
        width: t.frame === 'story' ? 400 : 720,
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
    'w-full rounded-lg border border-canvas-border bg-canvas-muted px-2.5 py-2 text-[12.5px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60';
  const small =
    'rounded-md border border-canvas-border bg-canvas px-2.5 py-1 text-[12px] text-canvas-foreground hover:bg-canvas-muted';
  const seg = (on: boolean) =>
    `rounded px-2 py-1 ${on ? 'bg-canvas-muted text-canvas-foreground' : 'text-canvas-muted-foreground hover:text-canvas-foreground'}`;

  const card = (t: Target, i: number): ReactNode => {
    const notes = problems(sized[i]);
    return (
      <div
        key={t.key}
        className="mb-4 flex break-inside-avoid flex-col gap-2 rounded-xl border border-canvas-border bg-canvas p-3"
      >
        <div className="flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={picked[t.key] ?? true}
            onChange={(e) => setPicked((p) => ({ ...p, [t.key]: e.target.checked }))}
            className="accent-fuchsia-400"
          />
          <span className="font-semibold text-canvas-foreground">{t.label}</span>
          <span className="text-canvas-muted-foreground">
            {t.width}×{t.height}
          </span>
          {t.custom && (
            <button
              type="button"
              title="Remove this size"
              className="text-canvas-muted-foreground hover:text-canvas-foreground"
              onClick={() => onSizes((layout.exportSizes ?? []).filter((s) => s !== t.custom))}
            >
              <X className="size-3.5" />
            </button>
          )}
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
        <Frame
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
      : `Download ${chosen.length} ${chosen.length === 1 ? 'size' : 'sizes'}`;

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
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {what !== 'canvas' ? (
          <p className="text-[12px] text-canvas-muted-foreground">
            The avatar on its own, in the format and size picked above.
          </p>
        ) : (
          // Masonry: cards keep their own heights and flow into columns, so tall stories leave no gaps.
          <div className="[column-gap:1rem] [column-width:300px]">
            {targets.map(card)}
            <div className="mb-4 flex break-inside-avoid flex-col gap-2 rounded-xl border border-dashed border-canvas-border p-3 text-[12px] text-canvas-muted-foreground">
              <div className="font-semibold text-canvas-foreground">Custom size</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={64}
                  max={8000}
                  value={draft.width}
                  onChange={(e) => setDraft((d) => ({ ...d, width: Number(e.target.value) || 1 }))}
                  placeholder="Width"
                  className={input}
                />
                <input
                  type="number"
                  min={64}
                  max={8000}
                  value={draft.height}
                  onChange={(e) => setDraft((d) => ({ ...d, height: Number(e.target.value) || 1 }))}
                  placeholder="Height"
                  className={input}
                />
              </div>
              <button type="button" className={small} onClick={addSize}>
                Add size
              </button>
              <p>For banners and headers, such as 1500 × 500 for an X header.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
