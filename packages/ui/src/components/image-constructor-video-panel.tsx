'use client';

import { ImagePlus, Pause, Play, Shuffle, X } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  designCast,
  isFilm,
  motionOf,
  motionStyle,
  videoPaint,
} from './image-constructor-films.js';
import type { ICLayout, ICVideo, ICVideoText } from './image-constructor-layout.js';
import { drawBlurred, type Scene, SHARP } from './image-constructor-motion.js';
import { encodeMp4 } from './image-constructor-mp4.js';
import type { StudioApi } from './image-constructor-panels.js';
import { readImage } from './image-constructor-read-image.js';
import { findTemplate } from './image-constructor-templates.js';
// Loaded for what it registers: every slide the storyboards name.
import './image-constructor-video-scenes.js';
import {
  compile,
  FEELS,
  H,
  type Media,
  PACES,
  shuffle,
  type Video,
  type VideoSpec,
  variantsOf,
  W,
} from './image-constructor-video.js';
import {
  mediaOf,
  NEW_VIDEO,
  type Slide,
  scenesOf,
  skinOf,
  slidesOf,
  storyboardFor,
  videoText,
} from './image-constructor-video-storyboards.js';
import { ThemedSelect } from './themed-select.js';

const FPS = 30;
const MAX_FEATURES = 5;
const even = (n: number) => Math.round(n / 2) * 2;

/** A design's video, ready to play: its slides, its words and the compiled frames. */
export interface Story {
  built: Video;
  spec: VideoSpec;
  slides: Slide[];
  text: ICVideoText;
}

/** Where playback is, shared with the Motion tab's own player. */
interface Clock {
  t: number;
  playing: boolean;
  total: number;
}

/** The design without its video, the same object until something other than the video changes. */
export function useDesignOnly(layout: ICLayout): ICLayout {
  const kept = useRef(layout);
  const keys = new Set([...Object.keys(kept.current), ...Object.keys(layout)]) as Set<
    keyof ICLayout
  >;
  for (const k of keys) {
    if (k !== 'video' && kept.current[k] !== layout[k]) {
      kept.current = layout;
      break;
    }
  }
  return kept.current;
}

/** The design's video, or null when it has none or its layers are not painted yet. */
export function useStory(layout: ICLayout, scene: Scene | null): Story | null {
  const video = layout.video;
  const uploads = video?.media;
  const [own, setOwn] = useState<Media[]>([]);
  useEffect(() => {
    let live = true;
    void Promise.all(
      (uploads ?? []).map(
        (m) =>
          new Promise<HTMLImageElement | null>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = m.url;
          }),
      ),
    ).then((list) => {
      if (live) setOwn(list.filter((x): x is HTMLImageElement => x !== null));
    });
    return () => {
      live = false;
    };
  }, [uploads]);

  const m = motionOf(layout);
  // The design as a slide of its own, and as a still picture for the other slides.
  const design = useMemo(() => {
    if (!scene) return null;
    const size = () => {
      const c = document.createElement('canvas');
      c.width = even(scene.width / SHARP);
      c.height = even(scene.height / SHARP);
      return c;
    };
    // A film has shots of its own and runs too long for one slide, so the design uses a plain entrance.
    const style = isFilm(motionStyle(m.style)) ? 'rise' : m.style;
    const paint = videoPaint(scene, { style, pace: m.pace, seconds: 4 });
    const still = size();
    const sctx = still.getContext('2d');
    if (sctx) paint(sctx, 99);
    return { canvas: size(), paint, still };
  }, [scene, m]);

  const pack = findTemplate(layout.thread?.root ?? layout.templateId).pack;
  const els = layout.els;
  return useMemo(() => {
    if (!video || !scene || !design) return null;
    const text = videoText(layout, designCast(scene));
    const media = mediaOf(scene, own, design.still);
    const slides = slidesOf(storyboardFor(pack), video, text, media, design);
    const spec: VideoSpec = {
      feel: video.feel,
      pace: video.pace,
      skin: skinOf(scene),
      brand: text.brand,
      scenes: scenesOf(slides, video),
    };
    return { built: compile(spec, media), spec, slides, text };
  }, [video, els, scene, design, own, pack]);
}

/** The video over the design's canvas, fitted inside it. A click on it pauses or plays. */
export function VideoStage({ story, player, rh }: { story: Story; player: Clock; rh: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { built } = story;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const frame = document.createElement('canvas');
    frame.width = 1280;
    frame.height = 720;
    const fctx = frame.getContext('2d');
    const scratch = document.createElement('canvas');
    scratch.width = frame.width;
    scratch.height = frame.height;
    if (!fctx) return;
    player.total = built.length;
    // The video is 16:9 whatever the design's size, so it sits centered with room around it.
    const w = Math.min(canvas.width, (canvas.height * 16) / 9);
    const h = (w * 9) / 16;
    let last = performance.now();
    let shown = -1;
    let raf = requestAnimationFrame(function tick(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (player.playing) player.t += dt;
      if (player.t >= built.length) player.t = 0;
      if (player.t !== shown) {
        const paint = built.frame(player.t);
        if (built.blur) drawBlurred(fctx, scratch, paint, player.t, FPS, player.playing ? 3 : 5);
        else paint(fctx, player.t);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frame, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        shown = player.t;
      }
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [built, player]);
  // Space pauses and plays, as it does for the design's own animation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const at = e.target as HTMLElement | null;
      const typing = at?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(at?.tagName ?? '');
      if (e.code !== 'Space' || typing || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) player.playing = !player.playing;
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [player]);
  return (
    <>
      <canvas
        ref={ref}
        width={1280}
        height={even(1280 * rh)}
        className="pointer-events-none absolute inset-0 size-full rounded-lg"
      />
      <button
        type="button"
        aria-label="Pause or play the video"
        className="absolute inset-0 z-30 cursor-pointer rounded-lg"
        // Kept from the canvas below, where a press would start a selection drag.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => {
          player.playing = !player.playing;
        }}
      />
    </>
  );
}

/** The video's slides under the canvas, each as wide as it is long. A click jumps to one. */
export function SlideStrip({
  story,
  player,
  slide,
  onSlide,
}: {
  story: Story;
  player: Clock;
  slide: string;
  onSlide: (kind: string) => void;
}) {
  const head = useRef<HTMLDivElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(player.playing);
  const { built, slides } = story;
  useEffect(() => {
    const stamp = (n: number) => `${Math.floor(n / 60)}:${(n % 60).toFixed(1).padStart(4, '0')}`;
    let raf = requestAnimationFrame(function tick() {
      if (head.current) head.current.style.left = `${(player.t / built.length) * 100}%`;
      if (time.current) time.current.textContent = `${stamp(player.t)} / ${stamp(built.length)}`;
      setPlaying(player.playing);
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [built, player]);
  const name = (kind: string) => slides.find((s) => s.kind === kind)?.name ?? kind;
  return (
    <div className="border-t border-canvas-border px-4 pb-3 pt-2.5">
      <div className="mb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            player.playing = !player.playing;
          }}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex size-7 items-center justify-center rounded-md border border-canvas-border hover:bg-canvas-muted"
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <span ref={time} className="font-mono text-[11px] text-canvas-muted-foreground" />
      </div>
      <div className="relative flex h-11 gap-[3px]">
        {built.shots.map((s) => (
          <button
            key={s.kind}
            type="button"
            onClick={() => {
              player.t = s.start;
              onSlide(s.kind);
            }}
            style={{ flexGrow: s.d, flexBasis: 0 }}
            className={`flex min-w-0 flex-col justify-center overflow-hidden whitespace-nowrap rounded-md border bg-canvas-raised px-2 text-left hover:bg-canvas-muted ${s.kind === slide ? 'border-emerald-400' : 'border-canvas-border'}`}
          >
            <span className="text-[11.5px] font-medium text-canvas-foreground">{name(s.kind)}</span>
            <span className="text-[10.5px] text-canvas-muted-foreground">
              {s.variant.name} · {s.d.toFixed(1)}s
            </span>
          </button>
        ))}
        <div
          ref={head}
          className="pointer-events-none absolute -bottom-1 -top-1 w-0.5 bg-emerald-400"
        />
      </div>
    </div>
  );
}

const INPUT =
  'w-full min-w-0 rounded-md border border-canvas-border bg-canvas px-2 py-1 text-[12px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60';
const BUTTON =
  'rounded-md border border-canvas-border px-2.5 py-1.5 text-[12px] text-canvas-foreground hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-40';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-canvas-border px-3.5 py-3">
      <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the child passed in
    <label className="flex items-center gap-2 text-[11px]">
      <span className="w-14 shrink-0 text-canvas-muted-foreground/70">{label}</span>
      <span className="block min-w-0 flex-1">{children}</span>
    </label>
  );
}

function Text({
  label,
  value,
  onChange,
  lines,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  lines?: number;
}) {
  return (
    <Row label={label}>
      {lines ? (
        <textarea
          rows={lines}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT} block resize-none`}
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={INPUT} />
      )}
    </Row>
  );
}

const patchVideo = (api: StudioApi, fn: (v: ICVideo) => ICVideo) =>
  api.update((l) => (l.video ? { ...l, video: fn(l.video) } : l));

/** The Motion tab's top block: makes the design a video, then sets what all its slides share. */
export function VideoWhole({
  api,
  story,
  player,
  slide,
  onSlide,
}: {
  api: StudioApi;
  story: Story | null;
  player: Clock;
  slide: string;
  onSlide: (kind: string) => void;
}) {
  const video = api.layout.video;
  const [progress, setProgress] = useState<number | null>(null);
  if (!video) {
    return (
      <Block title="Video">
        <button
          type="button"
          onClick={() => {
            api.update((l) => ({ ...l, video: NEW_VIDEO }));
            player.t = 0;
            player.playing = true;
          }}
          className={`${BUTTON} w-full`}
        >
          Make a video
        </button>
      </Block>
    );
  }
  const set = (patch: Partial<ICVideo>) => patchVideo(api, (v) => ({ ...v, ...patch }));

  const reshuffle = () => {
    if (!story) return;
    const seed = video.seed + 1;
    const next = shuffle(story.spec, seed);
    const variants = { ...video.variants };
    for (const s of next.scenes) if (s.variant) variants[s.kind] = s.variant;
    set({ feel: next.feel, pace: next.pace, variants, seed });
    player.t = 0;
    player.playing = true;
  };

  const download = async () => {
    if (!story || progress !== null) return;
    setProgress(0);
    const was = player.playing;
    player.playing = false;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const spare = document.createElement('canvas');
    spare.width = W;
    spare.height = H;
    const ctx = canvas.getContext('2d');
    const { built } = story;
    try {
      if (!ctx) throw new Error('This browser cannot draw the video.');
      const blob = await encodeMp4({
        canvas,
        fps: FPS,
        seconds: built.length,
        draw: (t) => {
          if (built.blur) drawBlurred(ctx, spare, built.frame(t), t, FPS);
          else built.frame(t)(ctx, t);
        },
        onProgress: setProgress,
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const name = story.text.brand
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      link.download = `${name || 'design'}-video.mp4`;
      link.click();
    } finally {
      player.playing = was;
      setProgress(null);
    }
  };

  const addPictures = async (files: FileList | null) => {
    const read = await Promise.all(
      Array.from(files ?? []).map((f) => readImage(f, 1600).catch(() => null)),
    );
    const got = read.filter((x) => x !== null).map((x) => ({ name: x.name, url: x.url }));
    if (got.length) patchVideo(api, (v) => ({ ...v, media: [...v.media, ...got] }));
  };

  return (
    <>
      <Block title="Whole video">
        <button
          type="button"
          onClick={reshuffle}
          className={`${BUTTON} flex w-full items-center justify-center gap-1.5`}
        >
          <Shuffle className="size-3.5" />
          Shuffle
        </button>
        <Row label="Motion">
          <ThemedSelect
            value={video.feel}
            options={FEELS.map((f) => ({ value: f.id, label: f.name }))}
            onChange={(feel) => set({ feel })}
          />
        </Row>
        <Row label="Speed">
          <ThemedSelect
            value={String(video.pace)}
            options={PACES.map((p) => ({
              value: String(p),
              label: p < 1 ? 'Calm' : p > 1 ? 'Fast' : 'Normal',
            }))}
            onChange={(pace) => set({ pace: Number(pace) })}
          />
        </Row>
        {video.media.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {video.media.map((m, i) => (
              <button
                key={`${m.name}${i}`}
                type="button"
                title={`Remove ${m.name}`}
                onClick={() => set({ media: video.media.filter((_, k) => k !== i) })}
                className="group relative aspect-video overflow-hidden rounded border border-canvas-border"
              >
                <img src={m.url} alt={m.name} className="size-full object-cover" />
                <span className="absolute inset-0 hidden items-center justify-center bg-black/60 group-hover:flex">
                  <X className="size-3.5" />
                </span>
              </button>
            ))}
          </div>
        )}
        <label className={`${BUTTON} flex cursor-pointer items-center justify-center gap-1.5`}>
          <ImagePlus className="size-3.5" />
          Add pictures
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void addPictures(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => void download()}
            disabled={!story || progress !== null}
            className="rounded-md border border-emerald-500/60 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/10 disabled:cursor-wait disabled:opacity-70"
          >
            {progress === null ? 'Download MP4' : `Rendering ${Math.round(progress * 100)}%`}
          </button>
          <button
            type="button"
            onClick={() => api.update((l) => ({ ...l, video: undefined }))}
            className={BUTTON}
          >
            Remove video
          </button>
        </div>
      </Block>
      {story && (
        <Block title="Slides">
          {story.slides.map((s) => (
            <div key={s.kind} className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={s.on}
                disabled={!s.ready}
                aria-label={`Show ${s.name}`}
                onChange={(e) => set({ slides: { ...video.slides, [s.kind]: e.target.checked } })}
                className="accent-emerald-400"
              />
              <button
                type="button"
                onClick={() => {
                  onSlide(s.kind);
                  const shot = story.built.shots.find((x) => x.kind === s.kind);
                  if (shot) player.t = shot.start;
                }}
                className={`min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left hover:bg-canvas-muted ${s.kind === slide ? 'bg-canvas-muted text-canvas-foreground' : s.on ? 'text-canvas-foreground' : 'text-canvas-muted-foreground'}`}
              >
                {s.name}
              </button>
            </div>
          ))}
        </Block>
      )}
    </>
  );
}

/** The Motion tab's block for the picked slide: how it is drawn and the words on it. */
export function VideoSlide({ api, story, slide }: { api: StudioApi; story: Story; slide: string }) {
  const video = api.layout.video;
  const picked = story.slides.find((s) => s.kind === slide);
  if (!video || !picked) return null;
  const t = story.text;
  const text = (patch: Partial<ICVideoText>) =>
    patchVideo(api, (v) => ({ ...v, text: { ...v.text, ...patch } }));
  const feature = (i: number, patch: Partial<ICVideoText['features'][number]>) =>
    text({ features: t.features.map((f, k) => (k === i ? { ...f, ...patch } : f)) });
  const stat = (i: number, patch: Partial<ICVideoText['stats'][number]>) =>
    text({ stats: t.stats.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const variants = variantsOf(slide);
  const shot = story.built.shots.find((s) => s.kind === slide);
  return (
    <Block title={picked.name}>
      {variants.length > 1 && (
        <Row label="Style">
          <ThemedSelect
            value={shot?.variant.id ?? video.variants[slide] ?? variants[0].id}
            options={variants.map((v) => ({ value: v.id, label: v.name }))}
            onChange={(id) =>
              patchVideo(api, (v) => ({ ...v, variants: { ...v.variants, [slide]: id } }))
            }
          />
        </Row>
      )}
      {slide === 'hook' && (
        <>
          <Text label="Lines" value={t.hook} onChange={(hook) => text({ hook })} lines={3} />
          <Text label="Brand" value={t.brand} onChange={(brand) => text({ brand })} />
          <Text label="Version" value={t.version} onChange={(version) => text({ version })} />
        </>
      )}
      {slide === 'input' && (
        <>
          <Text label="Label" value={t.ask} onChange={(ask) => text({ ask })} />
          <Text label="Text" value={t.prompt} onChange={(prompt) => text({ prompt })} />
        </>
      )}
      {slide === 'working' &&
        t.steps.map((step, i) => (
          <Text
            key={i}
            label={`Step ${i + 1}`}
            value={step}
            onChange={(v) => text({ steps: t.steps.map((s, k) => (k === i ? v : s)) })}
          />
        ))}
      {slide === 'wall' && (
        <Text label="Label" value={t.wall} onChange={(wall) => text({ wall })} />
      )}
      {slide === 'features' && (
        <>
          {t.features.map((f, i) => (
            <div key={i} className="space-y-1.5 pb-1.5">
              <Text
                label={`${i + 1}. Title`}
                value={f.title}
                onChange={(title) => feature(i, { title })}
              />
              <Text
                label="Line"
                value={f.body}
                onChange={(body) => feature(i, { body })}
                lines={2}
              />
              <Text label="Badge" value={f.tag} onChange={(tag) => feature(i, { tag })} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={t.features.length >= MAX_FEATURES}
              onClick={() =>
                text({ features: [...t.features, { title: 'New feature', body: '', tag: '' }] })
              }
              className={BUTTON}
            >
              Add feature
            </button>
            <button
              type="button"
              disabled={t.features.length === 0}
              onClick={() => text({ features: t.features.slice(0, -1) })}
              className={BUTTON}
            >
              Remove last
            </button>
          </div>
        </>
      )}
      {slide === 'stats' && (
        <>
          {t.stats.map((s, i) => (
            <div key={i} className="space-y-1.5 pb-1.5">
              <Text
                label={`${i + 1}. Number`}
                value={s.value}
                onChange={(value) => stat(i, { value })}
              />
              <Text label="Label" value={s.label} onChange={(label) => stat(i, { label })} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={t.stats.length >= 3}
              onClick={() => text({ stats: [...t.stats, { value: '100%', label: '' }] })}
              className={BUTTON}
            >
              Add number
            </button>
            <button
              type="button"
              disabled={t.stats.length === 0}
              onClick={() => text({ stats: t.stats.slice(0, -1) })}
              className={BUTTON}
            >
              Remove last
            </button>
          </div>
        </>
      )}
      {slide === 'design' && (
        <Text
          label="Label"
          value={t.designLabel}
          onChange={(designLabel) => text({ designLabel })}
        />
      )}
      {slide === 'outro' && (
        <>
          <Text
            label="Tagline"
            value={t.tagline}
            onChange={(tagline) => text({ tagline })}
            lines={2}
          />
          <Text label="Link" value={t.link} onChange={(link) => text({ link })} />
        </>
      )}
    </Block>
  );
}
