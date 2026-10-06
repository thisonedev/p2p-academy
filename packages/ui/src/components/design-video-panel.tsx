'use client';

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Eye,
  EyeOff,
  ImagePlus,
  Pause,
  Play,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { designCast, isFilm, motionOf, motionStyle, videoPaint } from './design-films.js';
import { loadFonts } from './design-fonts.js';
import {
  type ICLayout,
  type ICSound,
  type ICVideo,
  type ICVideoText,
  ratioHeight,
} from './design-layout.js';
import { buildScene, drawBlurred, type Scene, SHARP } from './design-motion.js';
import { encodeMp4 } from './design-mp4.js';
import type { StudioApi } from './design-panels.js';
import { readImage } from './design-read-image.js';
import { loadImages } from './design-render.js';
import { FX_LEVELS, mixSound, NEW_SOUND, SOUND_KINDS, trackOf, tracksAt } from './design-sound.js';
import { findTemplate } from './design-templates.js';
import { allPages } from './design-thread.js';
// Loaded for what it registers: every slide the storyboards name.
import './design-video-scenes.js';
import {
  mediaOf,
  NEW_VIDEO,
  readDesign,
  type Slide,
  scenesOf,
  skinOf,
  slidesOf,
  storyboardFor,
} from './design-storyboards.js';
import {
  compile,
  FEELS,
  H,
  LOOKS,
  type Media,
  PACE_NAMES,
  PACES,
  shuffle,
  type Video,
  type VideoSpec,
  variantsOf,
  W,
} from './design-video.js';
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
  /** A small copy of each of the video's pictures, for showing which one a highlight has. */
  thumbs: string[];
  sound: ICSound;
}

/** Where playback is, shared with the Motion tab's own player. */
interface Clock {
  t: number;
  playing: boolean;
  total: number;
  /** Silences the preview. The saved video keeps its sound. */
  muted?: boolean;
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

const loadPictures = (uploads: { url: string }[]): Promise<Media[]> =>
  Promise.all(
    uploads.map(
      (m) =>
        new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = m.url;
        }),
    ),
  ).then((list) => list.filter((x): x is HTMLImageElement => x !== null));

/** The design as a slide of its own, and as a still picture for the other slides. */
function designSlide(layout: ICLayout, scene: Scene) {
  const size = () => {
    const c = document.createElement('canvas');
    c.width = even(scene.width / SHARP);
    c.height = even(scene.height / SHARP);
    return c;
  };
  const m = motionOf(layout);
  // A film has shots of its own and runs too long for one slide, so the design uses a plain entrance.
  const style = isFilm(motionStyle(m.style)) ? 'rise' : m.style;
  const paint = videoPaint(scene, { style, pace: m.pace, seconds: 4 });
  const still = size();
  const sctx = still.getContext('2d');
  if (sctx) paint(sctx, 99);
  return { canvas: size(), paint, still };
}

const thumbs = new WeakMap<Media, string>();

/** A picture as a small data URL, made once for each. */
function thumbOf(m: Media): string {
  const known = thumbs.get(m);
  if (known) return known;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 80;
  const g = c.getContext('2d');
  const w = (m as HTMLImageElement).naturalWidth || m.width;
  const h = (m as HTMLImageElement).naturalHeight || m.height;
  if (g && w && h) {
    const k = Math.max(c.width / w, c.height / h);
    g.drawImage(m, (c.width - w * k) / 2, (c.height - h * k) / 2, w * k, h * k);
  }
  const url = c.toDataURL('image/jpeg', 0.75);
  thumbs.set(m, url);
  return url;
}

/** One page of the design, painted and ready to be a slide. */
interface Page {
  layout: ICLayout;
  scene: Scene;
  design: ReturnType<typeof designSlide>;
}

const sceneWidth = (l: ICLayout) => {
  const rh = ratioHeight(l.ratio, l.customSize);
  return Math.round((rh > 1 ? 1280 / rh : 1280) * SHARP);
};

/** Every page of the design painted for the video. A design that is not a thread is one page. */
async function paintPages(layout: ICLayout, sceneUrl: string | null): Promise<Page[]> {
  await loadFonts();
  return Promise.all(
    allPages(layout).map(async (l) => {
      // Only the open page can have the AI background that was painted for it.
      const images = await loadImages(l, l === layout ? sceneUrl : null);
      const scene = buildScene(l, images, sceneWidth(l));
      return { layout: l, scene, design: designSlide(l, scene) };
    }),
  );
}

function buildStory(layout: ICLayout, pages: Page[], own: Media[]): Story {
  const video = layout.video ?? NEW_VIDEO;
  // The first page speaks for the design: its words, colors and pictures.
  const first = pages[0];
  const text = { ...readDesign(first.layout, designCast(first.scene)), ...video.text };
  const media = mediaOf(first.scene, own, first.design.still);
  const pack = findTemplate(layout.thread?.root ?? layout.templateId).pack;
  const slides = slidesOf(
    storyboardFor(pack, pages.length),
    video,
    text,
    media,
    pages.map((p) => p.design),
  );
  const spec: VideoSpec = {
    feel: video.feel,
    pace: video.pace,
    skin: { ...skinOf(first.scene), look: video.look },
    brand: text.brand,
    scenes: scenesOf(slides, video),
  };
  return {
    built: compile(spec, media),
    spec,
    slides,
    text,
    thumbs: media.map(thumbOf),
    sound: video.sound ?? NEW_SOUND,
  };
}

/** The design's longer video, or null while it is shut or its pages are being painted. */
export function useStory(layout: ICLayout, sceneUrl: string | null, on: boolean): Story | null {
  const design = useDesignOnly(layout);
  const [pages, setPages] = useState<Page[] | null>(null);
  useEffect(() => {
    if (!on) {
      setPages(null);
      return;
    }
    let live = true;
    // Waits out a run of edits instead of repainting every page on each one.
    const wait = setTimeout(() => {
      void paintPages(design, sceneUrl).then((list) => {
        if (live) setPages(list);
      });
    }, 120);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [design, sceneUrl, on]);

  const uploads = layout.video?.media;
  const [own, setOwn] = useState<Media[]>([]);
  useEffect(() => {
    let live = true;
    void loadPictures(uploads ?? []).then((list) => {
      if (live) setOwn(list);
    });
    return () => {
      live = false;
    };
  }, [uploads]);

  const video = layout.video;
  return useMemo(() => (pages ? buildStory(layout, pages, own) : null), [video, pages, own]);
}

/** Draws the design's longer video frame by frame and returns it as an MP4, 1920 by 1080. */
export async function composeStory(
  layout: ICLayout,
  sceneUrl: string | null,
  opts: { fps: number; onProgress?: (done: number) => void },
): Promise<Blob> {
  const [pages, own] = await Promise.all([
    paintPages(layout, sceneUrl),
    loadPictures(layout.video?.media ?? []),
  ]);
  const { built, sound, spec } = buildStory(layout, pages, own);
  const audio = await mixSound(built.cues, built.length, sound, spec.pace);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const spare = document.createElement('canvas');
  spare.width = W;
  spare.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the video.');
  return encodeMp4({
    canvas,
    fps: opts.fps,
    seconds: built.length,
    audio,
    draw: (t) => {
      if (built.blur) drawBlurred(ctx, spare, built.frame(t), t, opts.fps);
      else built.frame(t)(ctx, t);
    },
    onProgress: opts.onProgress,
  });
}

/** The design's longer video on a loop, for the Export sheet. */
export function StoryPreview({ layout, sceneUrl }: { layout: ICLayout; sceneUrl: string | null }) {
  const story = useStory(layout, sceneUrl, true);
  const [player] = useState(() => ({ t: 0, playing: true, total: 1 }));
  return (
    <div className="relative mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-xl border border-canvas-border bg-black">
      {story ? (
        <VideoStage story={story} player={player} rh={9 / 16} silent />
      ) : (
        <div className="size-full animate-pulse bg-white/5" />
      )}
    </div>
  );
}

let speaker: AudioContext | null = null;

/** Plays the video's sound in step with its clock: a pause, a jump or a new loop is followed
 *  within a moment. The sound is mixed again a beat after the video or its settings change. */
function useSound(story: Story, player: Clock, silent: boolean): void {
  const { built, sound } = story;
  const { pace } = story.spec;
  const [mix, setMix] = useState<AudioBuffer | null>(null);
  useEffect(() => {
    if (silent) return;
    let live = true;
    const wait = setTimeout(() => {
      void mixSound(built.cues, built.length, sound, pace)
        .catch(() => null)
        .then((buffer) => {
          if (live) setMix(buffer);
        });
    }, 200);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [built, sound, pace, silent]);
  useEffect(() => {
    if (!mix) return;
    speaker ??= new AudioContext();
    const ctx = speaker;
    // A browser keeps sound off until the person has clicked or pressed a key on the page.
    const wake = () => void ctx.resume();
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    let playing: { src: AudioBufferSourceNode; gain: GainNode; from: number; at: number } | null =
      null;
    const stop = () => {
      if (!playing) return;
      const { src, gain } = playing;
      // A short fade, since a sound cut dead clicks.
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.012);
      src.stop(ctx.currentTime + 0.08);
      playing = null;
    };
    let raf = requestAnimationFrame(function tick() {
      const want = player.playing && !player.muted && ctx.state === 'running';
      const due = playing ? playing.from + ctx.currentTime - playing.at : 0;
      if (playing && (!want || Math.abs(due - player.t) > 0.15)) stop();
      if (want && !playing && player.t < mix.duration) {
        const src = ctx.createBufferSource();
        src.buffer = mix;
        const gain = ctx.createGain();
        src.connect(gain).connect(ctx.destination);
        src.start(0, player.t);
        playing = { src, gain, from: player.t, at: ctx.currentTime };
      }
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(raf);
      stop();
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [mix, player]);
}

/** The video over the design's canvas, fitted inside it. A click on it pauses or plays. */
export function VideoStage({
  story,
  player,
  rh,
  silent = false,
}: {
  story: Story;
  player: Clock;
  rh: number;
  /** Plays without sound, as the Export sheet's preview does. */
  silent?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { built } = story;
  useSound(story, player, silent);
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
  const [muted, setMuted] = useState(!!player.muted);
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
  const name = (id: string) => slides.find((s) => s.id === id)?.name ?? id;
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
        <button
          type="button"
          onClick={() => {
            player.muted = !muted;
            setMuted(!muted);
          }}
          aria-label={muted ? 'Unmute' : 'Mute'}
          aria-pressed={muted}
          className="flex size-7 items-center justify-center rounded-md border border-canvas-border hover:bg-canvas-muted"
        >
          {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </button>
        <span ref={time} className="font-mono text-[11px] text-canvas-muted-foreground" />
      </div>
      <div className="relative flex h-11 gap-[3px]">
        {built.shots.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              player.t = s.start;
              onSlide(s.id);
            }}
            style={{ flexGrow: s.d, flexBasis: 0 }}
            className={`flex min-w-0 flex-col justify-center overflow-hidden whitespace-nowrap rounded-md border bg-canvas-raised px-2 text-left hover:bg-canvas-muted ${s.id === slide ? 'border-emerald-400' : 'border-canvas-border'}`}
          >
            <span className="text-[11.5px] font-medium text-canvas-foreground">{name(s.id)}</span>
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
/** A small icon button at the end of a section's title, as the Design tab has. */
const ICON = 'rounded p-0.5 text-canvas-muted-foreground hover:text-canvas-foreground';
const BUTTON =
  'rounded-md border border-canvas-border px-2.5 py-1.5 text-[12px] text-canvas-foreground hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-40';

/** Sections the person opened or folded by hand, by title, kept while the studio is open. */
const OPENED = new Map<string, boolean>();

/** A section that folds shut from its title, as the Design tab's sections do. */
function Block({
  title,
  children,
  action,
  quiet,
  id,
  shut,
}: {
  title: string;
  children: ReactNode;
  /** A control beside the fold arrow at the end of the title row. */
  action?: ReactNode;
  /** Draws the body faint, for a slide that is switched off. */
  quiet?: boolean;
  id?: string;
  /** Starts folded, until the person opens it. A slide that is switched off does. */
  shut?: boolean;
}) {
  const [, refold] = useState(0);
  const open = OPENED.get(title) ?? !shut;
  return (
    <section id={id} className="border-b border-canvas-border px-3.5 py-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            OPENED.set(title, !open);
            refold((n) => n + 1);
          }}
          className="flex min-w-0 flex-1 items-center text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70 hover:text-canvas-muted-foreground"
        >
          {title}
        </button>
        {action}
        <ChevronDown
          aria-hidden
          className={`size-3.5 shrink-0 text-canvas-muted-foreground/70 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </div>
      {open && children && (
        <div className={`mt-2.5 space-y-1.5 ${quiet ? 'opacity-45' : ''}`}>{children}</div>
      )}
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
  api.update((l) => ({ ...l, video: fn(l.video ?? NEW_VIDEO) }));

/** The Video tab: what every slide shares, its pictures, then a section for each slide. */
export function VideoPanel({
  api,
  story,
  player,
  slide,
  picks,
}: {
  api: StudioApi;
  story: Story | null;
  player: Clock;
  slide: string;
  /** How many times a slide was picked in the strip, so picking the same one again counts. */
  picks: number;
}) {
  const video = api.layout.video ?? NEW_VIDEO;
  const set = (patch: Partial<ICVideo>) => patchVideo(api, (v) => ({ ...v, ...patch }));

  // A slide picked in the strip under the canvas opens its section, folds the other slides'
  // and brings it into view. Nothing opens until one is picked.
  const [, refold] = useState(0);
  const names = story?.slides.map((sl) => [sl.id, sl.name] as const);
  useEffect(() => {
    if (!picks || !names) return;
    for (const [id, name] of names) OPENED.set(name, id === slide);
    refold((n) => n + 1);
    requestAnimationFrame(() =>
      document.getElementById(`video-slide-${slide}`)?.scrollIntoView({ block: 'nearest' }),
    );
  }, [picks]);

  const reshuffle = () => {
    if (!story) return;
    const seed = video.seed + 1;
    const next = shuffle(story.spec, seed);
    const variants = { ...video.variants };
    for (const s of next.scenes) if (s.variant) variants[s.kind] = s.variant;
    set({ look: next.skin.look, feel: next.feel, pace: next.pace, variants, seed });
    player.t = 0;
    player.playing = true;
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
      <Block
        title="Style"
        action={
          <button
            type="button"
            onClick={reshuffle}
            title="Shuffle"
            aria-label="Shuffle"
            className={ICON}
          >
            <Shuffle className="size-3.5" />
          </button>
        }
      >
        <Row label="Look">
          <ThemedSelect
            value={video.look ?? LOOKS[0].id}
            options={LOOKS.map((l) => ({ value: l.id, label: l.name }))}
            onChange={(look) => set({ look })}
          />
        </Row>
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
            options={PACES.map((p, i) => ({ value: String(p), label: PACE_NAMES[i] }))}
            onChange={(pace) => set({ pace: Number(pace) })}
          />
        </Row>
        {Object.keys(video.text).length > 0 && (
          <button
            type="button"
            onClick={() => patchVideo(api, (v) => ({ ...v, text: {} }))}
            className={`${BUTTON} w-full`}
          >
            Use the design's words
          </button>
        )}
      </Block>
      <SoundBlock api={api} />
      <Block
        title="Pictures"
        action={
          <label title="Add pictures" className={`${ICON} cursor-pointer`}>
            <ImagePlus className="size-3.5" />
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              aria-label="Add pictures"
              onChange={(e) => {
                void addPictures(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        }
      >
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
      </Block>
      {/* Every slide has a section of its own, so all that can change is in view at once. */}
      {story?.slides
        // A slide the design gives nothing to show is left out of the list.
        .filter((sl) => sl.ready)
        .map((sl) => (
          <VideoSlide key={sl.id} api={api} story={story} picked={sl} current={sl.id === slide} />
        ))}
    </>
  );
}

/** A person's own music is kept inside the design, so a very large file is left out. */
const MAX_MUSIC = 12 * 1024 * 1024;

function Switch({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        on ? 'bg-emerald-500' : 'bg-canvas-muted-foreground/40'
      }`}
    >
      <span
        className={`inline-block size-4 rounded-full bg-canvas transition-transform ${
          on ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/** One line of the Sound block: what plays, and a switch that turns it off without losing it. */
function SoundRow({
  label,
  on,
  onToggle,
  children,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-14 shrink-0 text-canvas-muted-foreground/70">{label}</span>
      <span className={`block min-w-0 flex-1 ${on ? '' : 'pointer-events-none opacity-40'}`}>
        {children}
      </span>
      <Switch label={label} on={on} onChange={onToggle} />
    </div>
  );
}

/** The video's music and effects. Each is one choice and one switch. Which kinds of effect play
 *  is tucked behind the icon in the title. */
function SoundBlock({ api }: { api: StudioApi }) {
  const sound = api.layout.video?.sound ?? NEW_SOUND;
  const pace = api.layout.video?.pace ?? NEW_VIDEO.pace;
  const set = (patch: Partial<ICSound>) =>
    patchVideo(api, (v) => ({ ...v, sound: { ...(v.sound ?? NEW_SOUND), ...patch } }));
  const file = useRef<HTMLInputElement>(null);
  const [kinds, setKinds] = useState(false);
  const addMusic = (f: File | undefined) => {
    if (!f || f.size > MAX_MUSIC) return;
    const reader = new FileReader();
    reader.onload = () =>
      set({ music: 'own', musicOff: false, own: { name: f.name, url: String(reader.result) } });
    reader.readAsDataURL(f);
  };
  const level = FX_LEVELS.reduce((best, l) =>
    Math.abs(l.vol - sound.fxVol) < Math.abs(best.vol - sound.fxVol) ? l : best,
  );
  return (
    <Block
      title="Sound"
      action={
        <button
          type="button"
          onClick={() => setKinds(!kinds)}
          title="Choose effects"
          aria-label="Choose effects"
          aria-expanded={kinds}
          className={ICON}
        >
          <SlidersHorizontal className="size-3.5" />
        </button>
      }
    >
      <SoundRow
        label="Music"
        on={!sound.musicOff}
        onToggle={() => set({ musicOff: !sound.musicOff })}
      >
        <ThemedSelect
          value={sound.music === 'own' && sound.own ? 'own' : trackOf(sound.music, pace).id}
          options={[
            ...tracksAt(pace).map((m) => ({ value: m.id, label: m.name })),
            ...(sound.own ? [{ value: 'own', label: sound.own.name }] : []),
            { value: 'add', label: 'Your own file…' },
          ]}
          onChange={(music) => (music === 'add' ? file.current?.click() : set({ music }))}
        />
      </SoundRow>
      <SoundRow label="Effects" on={sound.fx} onToggle={() => set({ fx: !sound.fx })}>
        <ThemedSelect
          value={level.id}
          options={FX_LEVELS.map((l) => ({ value: l.id, label: l.name }))}
          onChange={(id) => set({ fxVol: FX_LEVELS.find((l) => l.id === id)?.vol ?? sound.fxVol })}
        />
      </SoundRow>
      {kinds && (
        <div className={`flex flex-wrap gap-1 pt-1 ${sound.fx ? '' : 'opacity-40'}`}>
          {SOUND_KINDS.map((k) => {
            const on = !sound.off.includes(k.id);
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  set({ off: on ? [...sound.off, k.id] : sound.off.filter((x) => x !== k.id) })
                }
                className={`rounded-md border px-2 py-1 text-[11px] ${
                  on
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-canvas-foreground'
                    : 'border-canvas-border text-canvas-muted-foreground/60 hover:text-canvas-muted-foreground'
                }`}
              >
                {k.name}
              </button>
            );
          })}
        </div>
      )}
      <input
        ref={file}
        type="file"
        accept="audio/*"
        hidden
        aria-label="Your own music file"
        onChange={(e) => {
          addMusic(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </Block>
  );
}

/** The block for the picked slide: how it is drawn and the words on it. */
function VideoSlide({
  api,
  story,
  picked,
  current,
}: {
  api: StudioApi;
  story: Story;
  picked: Slide;
  /** The slide the playhead was last sent to. */
  current: boolean;
}) {
  const video = api.layout.video ?? NEW_VIDEO;
  const slide = picked.id;
  const t = story.text;
  const text = (patch: Partial<ICVideoText>) =>
    patchVideo(api, (v) => ({ ...v, text: { ...v.text, ...patch } }));
  const feature = (i: number, patch: Partial<ICVideoText['features'][number]>) =>
    text({ features: t.features.map((f, k) => (k === i ? { ...f, ...patch } : f)) });
  const stat = (i: number, patch: Partial<ICVideoText['stats'][number]>) =>
    text({ stats: t.stats.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const kind = picked.kind;
  const variants = variantsOf(kind);
  const shot = story.built.shots.find((s) => s.id === slide);
  return (
    <Block
      id={`video-slide-${slide}`}
      title={picked.name}
      quiet={!picked.on}
      shut
      action={
        <button
          type="button"
          aria-label={picked.on ? `Hide ${picked.name}` : `Show ${picked.name}`}
          aria-pressed={picked.on}
          onClick={() => {
            // Hiding a slide folds its section, and showing it opens it.
            OPENED.set(picked.name, !picked.on);
            patchVideo(api, (v) => ({ ...v, slides: { ...v.slides, [slide]: !picked.on } }));
          }}
          className={`rounded p-0.5 hover:text-canvas-foreground disabled:cursor-not-allowed disabled:opacity-40 ${current ? 'text-emerald-400' : 'text-canvas-muted-foreground'}`}
        >
          {picked.on ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>
      }
    >
      {variants.length > 1 && (
        <Row label="Style">
          <ThemedSelect
            value={shot?.variant.id ?? video.variants[kind] ?? variants[0].id}
            options={variants.map((v) => ({ value: v.id, label: v.name }))}
            onChange={(id) =>
              patchVideo(api, (v) => ({ ...v, variants: { ...v.variants, [kind]: id } }))
            }
          />
        </Row>
      )}
      {kind === 'hook' && (
        <>
          <Text label="Lines" value={t.hook} onChange={(hook) => text({ hook })} lines={3} />
          {shot?.variant.id === 'bands' && (
            <Text label="Bands" value={t.bands} onChange={(bands) => text({ bands })} />
          )}
          <Text label="Brand" value={t.brand} onChange={(brand) => text({ brand })} />
          <Text label="Version" value={t.version} onChange={(version) => text({ version })} />
        </>
      )}
      {kind === 'pair' && (
        <>
          <Text label="Brand" value={t.brand} onChange={(brand) => text({ brand })} />
          <Text label="Partner" value={t.partner} onChange={(partner) => text({ partner })} />
        </>
      )}
      {kind === 'input' && (
        <>
          <Text label="Label" value={t.ask} onChange={(ask) => text({ ask })} />
          <Text label="Text" value={t.prompt} onChange={(prompt) => text({ prompt })} />
          {shot?.variant.id === 'chat' && (
            <Text label="Reply" value={t.reply} onChange={(reply) => text({ reply })} />
          )}
        </>
      )}
      {kind === 'working' &&
        t.steps.map((step, i) => (
          <Text
            key={i}
            label={`Step ${i + 1}`}
            value={step}
            onChange={(v) => text({ steps: t.steps.map((s, k) => (k === i ? v : s)) })}
          />
        ))}
      {kind === 'wall' && <Text label="Label" value={t.wall} onChange={(wall) => text({ wall })} />}
      {kind === 'features' && (
        <>
          {t.features.map((f, i) => {
            const pic = (f.pic ?? i) % Math.max(1, story.thumbs.length);
            const move = (by: number) => {
              const list = t.features.map((x, k) => ({ ...x, pic: x.pic ?? k }));
              [list[i], list[i + by]] = [list[i + by], list[i]];
              text({ features: list });
            };
            return (
              <div key={i} className="space-y-1.5 rounded-md border border-canvas-border p-1.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Next picture"
                    aria-label={`Change the picture of highlight ${i + 1}`}
                    disabled={story.thumbs.length < 2}
                    onClick={() => feature(i, { pic: (pic + 1) % story.thumbs.length })}
                    className="h-9 w-14 shrink-0 overflow-hidden rounded border border-canvas-border hover:border-emerald-400 disabled:hover:border-canvas-border"
                  >
                    {story.thumbs[pic] && (
                      <img src={story.thumbs[pic]} alt="" className="size-full object-cover" />
                    )}
                  </button>
                  <span className="flex-1 pl-1 text-[11px] text-canvas-muted-foreground/70">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    aria-label={`Move highlight ${i + 1} up`}
                    disabled={i === 0}
                    onClick={() => move(-1)}
                    className={`${ICON} disabled:opacity-30`}
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move highlight ${i + 1} down`}
                    disabled={i === t.features.length - 1}
                    onClick={() => move(1)}
                    className={`${ICON} disabled:opacity-30`}
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove highlight ${i + 1}`}
                    onClick={() => text({ features: t.features.filter((_, k) => k !== i) })}
                    className={ICON}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <Text label="Title" value={f.title} onChange={(title) => feature(i, { title })} />
                <Text
                  label="Line"
                  value={f.body}
                  onChange={(body) => feature(i, { body })}
                  lines={2}
                />
                <Text label="Badge" value={f.tag} onChange={(tag) => feature(i, { tag })} />
              </div>
            );
          })}
          <button
            type="button"
            disabled={t.features.length >= MAX_FEATURES}
            onClick={() =>
              text({ features: [...t.features, { title: 'New highlight', body: '', tag: '' }] })
            }
            className={`${BUTTON} w-full`}
          >
            Add highlight
          </button>
        </>
      )}
      {kind === 'stats' && (
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
      {kind === 'design' && (
        <Text
          label="Label"
          value={t.designLabel}
          onChange={(designLabel) => text({ designLabel })}
        />
      )}
      {kind === 'outro' && (
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
