'use client';

import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  designCast,
  isFilm,
  motionOf,
  motionStyle,
  videoPaint,
  videoSize,
} from './films.js';
import { loadFonts } from '../render/fonts.js';
import {
  type ICLayout,
  type ICSound,
  type ICUpload,
  type ICVideo,
  type ICVideoText,
  ratioHeight,
} from '../render/layout.js';
import { buildScene, drawBlurred, type Scene, SHARP } from '../motion/motion.js';
import { encodeMp4 } from '../render/mp4.js';
import type { StudioApi } from '../panels/panels.js';
import { previews } from '../panels/preview-hold.js';
import { CLIP_SECONDS, readClip } from './read-clip.js';
import { readImage } from '../render/read-image.js';
import { loadImages } from '../render/render.js';
import { mixSound, NEW_SOUND, otherTakes, quickPace, trackOf, tracksAt } from '../sound/sound.js';
import { MusicShuffle, MuteButton, useSound, useSoundControls } from '../sound/sound-panel.js';
import { findTemplate } from '../templates/templates.js';
import { allPages } from '../templates/thread.js';
// Loaded for what it registers: every slide the storyboards name.
import './video-scenes.js';
import './video-styles.js';
import { PreviewSelect } from './video-previews.js';
import { FIELD, Row } from '../panels/controls.js';
import { Segments } from '../panels/segments.js';
import {
  drawn,
  mediaOf,
  NEW_VIDEO,
  readDesign,
  type Slide,
  scenesOf,
  skinOf,
  slidesOf,
  storyboardFor,
  worded,
} from './storyboards.js';
import {
  CLICKS,
  CUTS,
  clipMedia,
  compile,
  ENDINGS,
  FEELS,
  FRAMES,
  LOOKS,
  lookId,
  MARKS,
  type Media,
  type Place,
  PACE_NAMES,
  PACES,
  POINTERS,
  laptop,
  placeMedia,
  shuffle,
  type Video,
  type VideoSpec,
  variantsOf,
} from './video.js';
import { ThemedSelect } from '../../ui/themed-select.js';
import { IconButton, iconButtonClass } from '../../ui/icon-button.js';
import { FoldSection } from '../panels/fold-section.js';

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

// An upload is decoded once. Moving or zooming it then only changes how it is placed.
const DECODED = new Map<string, Promise<Media | null>>();
const decoded = (m: ICUpload): Promise<Media | null> => {
  let got = DECODED.get(m.url);
  if (!got) {
    got = new Promise<Media | null>((resolve) => {
      const img = new Image();
      // A video's upload is the sheet of its frames, which becomes a picture that plays.
      img.onload = () => resolve(m.clip ? clipMedia(img, m.clip) : img);
      img.onerror = () => resolve(null);
      img.src = m.url;
    });
    DECODED.set(m.url, got);
  }
  return got;
};

const loadPictures = (uploads: ICUpload[]): Promise<Media[]> =>
  Promise.all(
    uploads.map(async (m) => {
      const media = await decoded(m);
      if (media) placeMedia(media, m.place);
      return media;
    }),
  ).then((list) => list.filter((x): x is Media => x !== null));

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
  const text = worded(drawn(readDesign(first.layout, designCast(first.scene)), video), video.text);
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
    cut: video.cut,
    pointer: video.pointer,
    click: video.click,
    frame: video.frame,
  };
  return {
    built: compile(spec, media, ratioHeight(layout.ratio, layout.customSize)),
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

/** The size the longer video is saved at: the size its post type asks for, times the scale
 *  picked in the Export sheet, as a clip is. */
export const storySize = (layout: ICLayout, scale = 1): { width: number; height: number } =>
  videoSize(layout, scale);

/** Draws the design's longer video frame by frame and returns it as an MP4, in the design's
 *  own format. */
export async function composeStory(
  layout: ICLayout,
  sceneUrl: string | null,
  opts: {
    fps: number;
    scale?: number;
    sound?: boolean;
    onProgress?: (done: number) => void;
    signal?: AbortSignal;
  },
): Promise<Blob> {
  const [pages, own] = await Promise.all([
    paintPages(layout, sceneUrl),
    loadPictures(layout.video?.media ?? []),
  ]);
  const { built, sound, spec } = buildStory(layout, pages, own);
  const audio =
    opts.sound === false ? null : await mixSound(built.cues, built.length, sound, spec.pace);
  const { width, height } = storySize(layout, opts.scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const spare = document.createElement('canvas');
  spare.width = width;
  spare.height = height;
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
    signal: opts.signal,
  });
}

/** The design's longer video on a loop, for the Export sheet. */
export function StoryPreview({
  layout,
  sceneUrl,
  loud = false,
  fill = false,
}: {
  layout: ICLayout;
  sceneUrl: string | null;
  /** Plays the video's sound too. One preview at most, or it would play several times over. */
  loud?: boolean;
  /** As wide as what it is in, which then gives it its frame. */
  fill?: boolean;
}) {
  const story = useStory(layout, sceneUrl, true);
  const [player] = useState(() => ({ t: 0, playing: true, total: 1 }));
  // A pause on one preview pauses them all, since they are the same video in several sizes.
  useEffect(() => previews.join(player), [player]);
  const rh = ratioHeight(layout.ratio, layout.customSize);
  return (
    <div
      className={`relative overflow-hidden bg-black ${fill ? '' : 'mx-auto rounded-xl border border-canvas-border'}`}
      // As wide as the sheet allows, and never taller than most of the window.
      style={{ aspectRatio: `${1 / rh}`, width: fill ? '100%' : `min(100%, 48rem, ${65 / rh}vh)` }}
    >
      {story ? (
        <VideoStage
          story={story}
          player={player}
          rh={rh}
          silent={!loud}
          onToggle={(e) => previews.toggle(e)}
        />
      ) : (
        <div className="size-full animate-pulse bg-white/5" />
      )}
    </div>
  );
}

/** The video over the design's canvas, in the design's own format. A click pauses or plays. */
export function VideoStage({
  story,
  player,
  rh,
  silent = false,
  onToggle,
}: {
  story: Story;
  player: Clock;
  rh: number;
  /** Plays without sound, as the Export sheet's preview does. */
  silent?: boolean;
  /** Takes over pause and play, for previews that all pause together. */
  onToggle?: (e: Event) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { built } = story;
  useSound(built.cues, built.length, story.sound, story.spec.pace, player, silent);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Drawn no larger than 1280 on its long side, which keeps a tall format as quick as a wide one.
    const fit = Math.min(1, canvas.width / canvas.height);
    const frame = document.createElement('canvas');
    frame.width = even(canvas.width * fit);
    frame.height = even(canvas.height * fit);
    const fctx = frame.getContext('2d');
    const scratch = document.createElement('canvas');
    scratch.width = frame.width;
    scratch.height = frame.height;
    if (!fctx) return;
    player.total = built.length;
    let last = performance.now();
    let shown = -1;
    let raf = requestAnimationFrame(function tick(now) {
      // The clock keeps real time even when frames are slow to draw, as several previews at
      // once can be. Held back, the picture would fall behind its sound.
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      if (player.playing) player.t += dt;
      if (player.t >= built.length) player.t = 0;
      if (player.t !== shown) {
        const paint = built.frame(player.t);
        if (built.blur) drawBlurred(fctx, scratch, paint, player.t, FPS, player.playing ? 3 : 5);
        else paint(fctx, player.t);
        ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
        shown = player.t;
      }
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
    // The frame's shape is here too: a new one clears the canvas, and a paused video would
    // otherwise leave it empty until something else changed.
  }, [built, player, rh]);
  // Space pauses and plays, as it does for the design's own animation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const at = e.target as HTMLElement | null;
      const typing = at?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(at?.tagName ?? '');
      if (e.code !== 'Space' || typing || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      if (onToggle) onToggle(e);
      else player.playing = !player.playing;
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [player, onToggle]);
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
        onClick={(e) => {
          if (onToggle) onToggle(e.nativeEvent);
          else player.playing = !player.playing;
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
  const strip = useRef<HTMLDivElement>(null);
  // While the playhead is dragged: whether the video was playing, to go on when it is let go.
  const drag = useRef<boolean | null>(null);
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
        <MuteButton player={player} />
        <span ref={time} className="font-mono text-[11px] text-canvas-muted-foreground" />
      </div>
      <div ref={strip} className="relative mt-3.5 flex h-11 gap-[3px]">
        {built.shots.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              player.t = s.start;
              onSlide(s.id);
            }}
            // As wide as the time until the next slide starts. Under a cut where two slides
            // overlap, its own length would push every later slide right of the playhead.
            style={{
              flexGrow: (built.shots[i + 1]?.start ?? built.length) - s.start,
              flexBasis: 0,
            }}
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
          className="absolute -bottom-1 -top-3.5 z-10 -ml-2 w-4 cursor-ew-resize touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = player.playing;
            player.playing = false;
          }}
          onPointerMove={(e) => {
            const box = strip.current?.getBoundingClientRect();
            if (drag.current === null || !box) return;
            const p = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
            player.t = Math.min(built.length - 0.001, p * built.length);
          }}
          onPointerUp={() => {
            if (drag.current === null) return;
            player.playing = drag.current;
            drag.current = null;
            const at = built.shots.find((s) => player.t < s.start + s.d);
            if (at) onSlide(at.id);
          }}
        >
          <span className="absolute left-1/2 top-0 h-2.5 w-3 -translate-x-1/2 rounded-sm bg-emerald-400" />
          <span className="absolute bottom-0 left-1/2 top-2 w-0.5 -translate-x-1/2 bg-emerald-400" />
        </div>
      </div>
    </div>
  );
}

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
    <FoldSection
      title={title}
      open={open}
      action={action}
      id={id}
      quiet={quiet}
      onToggle={() => {
        OPENED.set(title, !open);
        refold((n) => n + 1);
      }}
    >
      {children || undefined}
    </FoldSection>
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
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD} block resize-none`}
        />
      ) : (
        <input
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          className={FIELD}
        />
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
  onSlide,
}: {
  api: StudioApi;
  story: Story | null;
  player: Clock;
  /** The slide picked here or in the strip under the canvas. */
  slide: string;
  onSlide: (id: string) => void;
}) {
  const video = api.layout.video ?? NEW_VIDEO;
  const set = (patch: Partial<ICVideo>) => patchVideo(api, (v) => ({ ...v, ...patch }));
  const setSound = (patch: Partial<ICSound>) =>
    patchVideo(api, (v) => ({ ...v, sound: { ...(v.sound ?? NEW_SOUND), ...patch } }));
  const soundControls = useSoundControls(video.sound ?? NEW_SOUND, video.pace, setSound);

  // A slide the design gives nothing to show is left out.
  const ready = story?.slides.filter((sl) => sl.ready) ?? [];
  const picked = ready.find((sl) => sl.id === slide) ?? ready[0];

  const reshuffle = () => {
    if (!story) return;
    const seed = video.seed + 1;
    const next = shuffle(story.spec, seed);
    const variants = { ...video.variants };
    for (const s of next.scenes) if (s.variant) variants[s.kind] = s.variant;
    // The music is not this shuffle's to change. A track only fits some speeds, so with music
    // on, the new speed is one the playing track fits. The fastest speed is left for the person
    // to pick: the shuffle only stays on it, never moves to it.
    const sound = video.sound ?? NEW_SOUND;
    const playing =
      sound.musicOff || sound.music === 'own' ? null : trackOf(sound.music, video.pace);
    const fits = PACES.filter(
      (p) =>
        (!playing || tracksAt(p).includes(playing)) && (!quickPace(p) || quickPace(video.pace)),
    );
    const pace = fits.includes(next.pace) ? next.pace : (fits[seed % fits.length] ?? video.pace);
    set({
      look: next.skin.look,
      feel: next.feel,
      pace,
      variants,
      seed,
      cut: other(CUTS, video.cut),
      ending: other(ENDINGS, story.text.ending),
      mark: other(MARKS, story.text.mark),
      pointer: other(POINTERS, video.pointer),
      click: other(CLICKS, video.click),
      // The effects' recordings are the shuffle's to change. The music is not.
      sound: { ...sound, takes: otherTakes(sound) },
    });
    player.t = 0;
    player.playing = true;
  };

  // The upload whose zoom and position the sliders under the grid set.
  const [placing, setPlacing] = useState<number | null>(null);
  const placed = placing === null ? undefined : video.media[placing];
  // Null puts the picture back around its middle.
  const place = (place: Place | null) =>
    set({
      media: video.media.map((m, k) => {
        if (k !== placing) return m;
        const { place: _was, ...rest } = m;
        return place ? { ...rest, place } : rest;
      }),
    });
  // Videos wait here to be given a start, one at a time. Pictures are added at once.
  const [waiting, setWaiting] = useState<File[]>([]);
  const [reading, setReading] = useState(0);
  const addMedia = (got: ICUpload[]) => {
    if (got.length) patchVideo(api, (v) => ({ ...v, media: [...v.media, ...got] }));
  };
  const addPictures = async (files: FileList | null) => {
    const all = Array.from(files ?? []);
    setWaiting((w) => [...w, ...all.filter((f) => f.type.startsWith('video/'))]);
    const read = await Promise.all(
      all
        .filter((f) => !f.type.startsWith('video/'))
        .map((f) => readImage(f, 1600).catch(() => null)),
    );
    addMedia(read.filter((x) => x !== null).map((x) => ({ name: x.name, url: x.url })));
  };
  const addClip = (file: File, from: number) => {
    setWaiting((w) => w.filter((f) => f !== file));
    setReading((n) => n + 1);
    void readClip(file, from)
      .then((clip) => addMedia([clip]))
      .catch(() => undefined)
      .finally(() => setReading((n) => n - 1));
  };

  return (
    <>
      <Block
        title="Style"
        action={
          <IconButton
            look="small"
            onClick={reshuffle}
            title="Shuffle"
            aria-label="Shuffle"
          >
            <Shuffle className="size-3.5" />
          </IconButton>
        }
      >
        <Row label="Look">
          <ThemedSelect
            value={lookId(video.look)}
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
        <Row label="Cuts">
          <ThemedSelect
            value={CUTS.find((x) => x.id === video.cut)?.id ?? CUTS[0].id}
            options={CUTS.map((x) => ({ value: x.id, label: x.name }))}
            onChange={(cut) => set({ cut })}
          />
        </Row>
        <Row label="Speed">
          <ThemedSelect
            value={String(video.pace)}
            options={PACES.map((p, i) => ({ value: String(p), label: PACE_NAMES[i] }))}
            onChange={(pace) => set({ pace: Number(pace) })}
          />
        </Row>
        <Row label="Pointer">
          <PreviewSelect
            set="pointer"
            what="pointer"
            value={video.pointer ?? POINTERS[0].id}
            list={POINTERS}
            onPick={(pointer) => set({ pointer })}
          />
        </Row>
        <Row label="Click">
          <PreviewSelect
            set="click"
            what="click"
            value={video.click ?? CLICKS[0].id}
            list={CLICKS}
            onPick={(click) => set({ click })}
          />
        </Row>
      </Block>
      <Block
        title="Sound"
        action={<MusicShuffle sound={video.sound ?? NEW_SOUND} pace={video.pace} set={setSound} />}
      >
        {soundControls}
      </Block>
      <Block
        title="Images/videos"
        action={
          <label title="Add images or videos" className={iconButtonClass('small', 'cursor-pointer')}>
            <ImagePlus className="size-3.5" />
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              aria-label="Add images or videos"
              onChange={(e) => {
                void addPictures(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        }
      >
        {waiting[0] && (
          <ClipStart
            key={`${waiting[0].name}${waiting[0].size}`}
            file={waiting[0]}
            onAdd={(from) => addClip(waiting[0], from)}
            onCancel={() => setWaiting((w) => w.slice(1))}
          />
        )}
        {reading > 0 && (
          <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] text-canvas-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Reading video…
          </div>
        )}
        {video.media.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {video.media.map((m, i) => (
              <div key={`${m.name}${i}`} className="group relative">
                <button
                  type="button"
                  title={m.name}
                  aria-pressed={i === placing}
                  onClick={() => setPlacing(i === placing ? null : i)}
                  className={`block aspect-video w-full overflow-hidden rounded border ${
                    i === placing ? 'border-emerald-400' : 'border-canvas-border'
                  }`}
                >
                  <img src={m.clip?.poster ?? m.url} alt={m.name} className="size-full object-cover" />
                </button>
                <button
                  type="button"
                  title={`Remove ${m.name}`}
                  aria-label={`Remove ${m.name}`}
                  onClick={() => {
                    setPlacing(null);
                    set({ media: video.media.filter((_, k) => k !== i) });
                  }}
                  className="absolute right-0.5 top-0.5 hidden rounded bg-black/70 p-0.5 text-white group-hover:block"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {placed && placing !== null && (
          <PlaceSheet
            src={placed.clip?.poster ?? placed.url}
            name={placed.name}
            place={placed.place ?? CENTERED}
            moved={placed.place !== undefined}
            onPlace={place}
            onClose={() => setPlacing(null)}
          />
        )}
      </Block>
      {story && picked && (
        <Block
          title="Slides"
          action={
            // Shown once a word was typed over, which is the only time there is something to undo.
            Object.keys(video.text).length > 0 && (
              <IconButton
                look="small"
                onClick={() => patchVideo(api, (v) => ({ ...v, text: {} }))}
                title="Use the design's words"
                aria-label="Use the design's words"
              >
                <RotateCcw className="size-3.5" />
              </IconButton>
            )
          }
        >
          <Segments
            cols={3}
            options={ready.map((sl) => ({
              key: sl.id,
              label: sl.name,
              on: sl.id === picked.id,
              struck: !sl.on,
              onPick: () => {
                const shot = story.built.shots.find((s) => s.id === sl.id);
                if (shot) player.t = shot.start;
                onSlide(sl.id);
              },
            }))}
          />
          <VideoSlide api={api} story={story} picked={picked} />
        </Block>
      )}
    </>
  );
}

const CENTERED = { x: 0.5, y: 0.5, zoom: 1 };

/** The laptop the sheet shows, in the sheet's canvas of 2000 by 1300. */
const LAP = { cx: 1000, cy: 630, w: 1880, h: 1162, r: 0 };
/** Its screen, as `laptop` in design/video/video.ts lays it out: the picture's own spot. */
const LAP_SCREEN = { w: (810 * LAP.w) / 1000, h: LAP.h - (104 * LAP.w) / 1000 };
const LAP_LOOK = { look: { id: 'block' }, c: { shadow: 'rgba(0,0,0,0.55)' } };

/** Placing a picture, over the whole studio. It is on the video's laptop, drawn as a slide draws
 *  it, so what the lid's rim covers shows. A drag moves it and the wheel zooms. */
function PlaceSheet({
  src,
  name,
  place,
  moved,
  onPlace,
  onClose,
}: {
  src: string;
  name: string;
  place: Place;
  /** The person has placed it, so there is something to reset. */
  moved: boolean;
  onPlace: (place: Place | null) => void;
  onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const from = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const now = useRef({ place, onPlace, onClose });
  now.current = { place, onPlace, onClose };
  useEffect(() => {
    let live = true;
    const i = new Image();
    i.onload = () => live && setImg(i);
    i.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !img) return;
    placeMedia(img, place);
    ctx.clearRect(0, 0, 2000, 1300);
    laptop(ctx, LAP_LOOK, LAP, img);
  }, [img, place]);
  // Listened to directly: React's wheel handler cannot stop the page from scrolling, and Escape
  // must not reach the studio under the sheet.
  useEffect(() => {
    const el = canvas.current;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const { place: p, onPlace: put } = now.current;
      put({ ...p, zoom: Math.min(3, Math.max(1, p.zoom - e.deltaY * 0.002)) });
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      now.current.onClose();
    };
    el?.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key, true);
    return () => {
      el?.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key, true);
    };
  }, []);
  const small =
    'rounded-md border border-canvas-border bg-canvas px-3 py-1.5 text-[12.5px] text-canvas-foreground hover:bg-canvas-muted disabled:opacity-40';
  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: a click on the blurred studio closes the sheet
    <div
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex flex-col items-center gap-4 bg-canvas/70 p-6 backdrop-blur-md"
    >
      <div className="flex w-full max-w-5xl items-center gap-2 text-[13px] text-canvas-foreground">
        <span className="font-semibold">Place picture</span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-canvas-muted-foreground">
          {name}
        </span>
        <IconButton look="small" aria-label="Close" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <canvas
          ref={canvas}
          width={2000}
          height={1300}
          aria-label={`${name} on a laptop`}
          onPointerDown={(e) => {
            from.current = { px: e.clientX, py: e.clientY, x: place.x, y: place.y };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const was = from.current;
            if (!was || !img) return;
            // The canvas is drawn smaller than it is, so a drag is measured in its own pixels.
            const k = 2000 / e.currentTarget.clientWidth;
            const s =
              Math.max(LAP_SCREEN.w / img.naturalWidth, LAP_SCREEN.h / img.naturalHeight) *
              place.zoom;
            // How much of the picture is cut off each way, which is how far it can be dragged.
            const over = {
              w: img.naturalWidth * s - LAP_SCREEN.w,
              h: img.naturalHeight * s - LAP_SCREEN.h,
            };
            const part = (v: number) => Math.min(1, Math.max(0, v));
            onPlace({
              ...place,
              x: over.w > 1 ? part(was.x - ((e.clientX - was.px) * k) / over.w) : place.x,
              y: over.h > 1 ? part(was.y - ((e.clientY - was.py) * k) / over.h) : place.y,
            });
          }}
          onPointerUp={() => {
            from.current = null;
          }}
          onPointerCancel={() => {
            from.current = null;
          }}
          className="max-h-full max-w-full cursor-grab touch-none select-none active:cursor-grabbing"
        />
      </div>
      <div className="flex w-full max-w-xl items-center gap-3 text-canvas-muted-foreground">
        <ZoomOut className="size-4 shrink-0" />
        <input
          type="range"
          aria-label="Zoom"
          min={1}
          max={3}
          step={0.01}
          value={place.zoom}
          onChange={(e) => onPlace({ ...place, zoom: Number(e.target.value) })}
          className="min-w-0 flex-1 accent-emerald-400"
        />
        <ZoomIn className="size-4 shrink-0" />
        <button type="button" disabled={!moved} onClick={() => onPlace(null)} className={small}>
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-[12.5px] font-medium text-fd-primary-foreground hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** A video just picked, before it is added: a slider sets where its few seconds start. */
function ClipStart({
  file,
  onAdd,
  onCancel,
}: {
  file: File;
  onAdd: (from: number) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState('');
  const [length, setLength] = useState(0);
  const [from, setFrom] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const made = URL.createObjectURL(file);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [file]);
  const most = Math.max(0, length - CLIP_SECONDS);
  const stamp = (n: number) => `${Math.floor(n / 60)}:${(n % 60).toFixed(1).padStart(4, '0')}`;
  const small =
    'rounded-md border border-canvas-border px-2 py-1 text-[11.5px] text-canvas-foreground hover:bg-canvas-muted';
  return (
    <div className="mb-2 space-y-1.5 rounded-lg border border-canvas-border p-1.5">
      {url && (
        <video
          ref={ref}
          src={url}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => setLength(e.currentTarget.duration || 0)}
          className="aspect-video w-full rounded bg-black object-contain"
        />
      )}
      <div className="flex items-center gap-2 text-[11.5px] text-canvas-muted-foreground">
        <span className="w-9 shrink-0">Start</span>
        <input
          type="range"
          aria-label="Where the clip starts"
          min={0}
          max={most}
          step={0.1}
          value={from}
          disabled={most <= 0}
          onChange={(e) => {
            const at = Number(e.target.value);
            setFrom(at);
            if (ref.current) ref.current.currentTime = at;
          }}
          className="min-w-0 flex-1 accent-emerald-400"
        />
        <span className="w-10 shrink-0 text-right tabular-nums">{stamp(from)}</span>
      </div>
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={onCancel} className={small}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onAdd(from)}
          className="rounded-md bg-emerald-500 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-950 hover:bg-emerald-400"
        >
          Add
        </button>
      </div>
    </div>
  );
}

/** One of the list at random that is not the one in use. */
function other(list: readonly { id: string }[], now: string | undefined): string {
  const rest = list.filter((x) => x.id !== (now ?? list[0].id));
  return rest[Math.floor(Math.random() * rest.length)].id;
}

/** The picked slide's own controls: whether it plays, how it is drawn and the words on it. */
function VideoSlide({ api, story, picked }: { api: StudioApi; story: Story; picked: Slide }) {
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
  // The look's own styles come first in the list, then the ones that go with any look.
  const fits = variantsOf(kind, lookId(video.look));
  const variants = [...fits.filter((v) => v.look), ...fits.filter((v) => !v.look)];
  const shot = story.built.shots.find((s) => s.id === slide);
  const style = shot?.variant.id ?? video.variants[kind] ?? variants[0]?.id;
  const setStyle = (id: string) =>
    patchVideo(api, (v) => ({ ...v, variants: { ...v.variants, [kind]: id } }));
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-canvas-foreground">
        <span className="min-w-0 flex-1 truncate">{picked.name}</span>
        {kind === 'working' && (
          <IconButton
            look="small"
            title="Other steps"
            aria-label="Other steps"
            // Typed steps give way too, or the shuffle would show nothing new.
            onClick={() =>
              patchVideo(api, (v) => {
                const { steps: _typed, ...kept } = v.text;
                return { ...v, text: kept, stepsTurn: (v.stepsTurn ?? 0) + 1 };
              })
            }
          >
            <Shuffle className="size-3.5" />
          </IconButton>
        )}
        <IconButton
          look="small"
          aria-label={picked.on ? `Hide ${picked.name}` : `Show ${picked.name}`}
          aria-pressed={picked.on}
          onClick={() =>
            patchVideo(api, (v) => ({ ...v, slides: { ...v.slides, [slide]: !picked.on } }))
          }
        >
          {picked.on ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </IconButton>
      </div>
      {/* One height for every slide, so the panel does not jump as slides are picked. A slide with
          more than fits scrolls inside. */}
      <div
        className={`mt-2 h-60 space-y-1.5 overflow-y-auto pr-1 ${picked.on ? '' : 'opacity-45'}`}
      >
        {variants.length > 1 && (
          <Row label="Style">
            <span className="flex w-full min-w-0 items-center gap-1.5">
              <span className="min-w-0 flex-1">
                <ThemedSelect
                  value={style}
                  options={variants.map((v) => ({ value: v.id, label: v.name }))}
                  onChange={setStyle}
                />
              </span>
              <IconButton
                look="small"
                title="Another style"
                aria-label="Another style"
                onClick={() => {
                  const others = variants.filter((v) => v.id !== style);
                  setStyle(others[Math.floor(Math.random() * others.length)].id);
                }}
              >
                <Shuffle className="size-3.5" />
              </IconButton>
            </span>
          </Row>
        )}
        {kind === 'working' && (
          <Row label="Ending">
            <PreviewSelect
              set="ending"
              what="ending"
              value={t.ending ?? ENDINGS[0].id}
              list={ENDINGS}
              onPick={(ending) => patchVideo(api, (v) => ({ ...v, ending }))}
            />
          </Row>
        )}
        {kind === 'working' && style === 'status' && (
          <Row label="Mark">
            <PreviewSelect
              set="mark"
              what="mark"
              value={t.mark ?? MARKS[0].id}
              list={MARKS}
              onPick={(mark) => patchVideo(api, (v) => ({ ...v, mark }))}
            />
          </Row>
        )}
        {/* The phone styles are always a phone. The others take the frame picked here. */}
        {kind === 'features' && ['split', 'flip', 'stage', 'deck'].includes(style ?? '') && (
          <Row label="Frame">
            <ThemedSelect
              value={FRAMES.find((f) => f.id === video.frame)?.id ?? FRAMES[0].id}
              options={FRAMES.map((f) => ({ value: f.id, label: f.name }))}
              onChange={(frame) => patchVideo(api, (v) => ({ ...v, frame }))}
            />
          </Row>
        )}
        {kind === 'hook' && (
          <>
            <Text label="Lines" value={t.hook} onChange={(hook) => text({ hook })} lines={3} />
            {shot?.variant.id === 'bands' && (
              <Text label="Bands" value={t.bands} onChange={(bands) => text({ bands })} />
            )}
            {shot?.variant.id === 'slam' && (
              <Text label="Caption" value={t.caption} onChange={(caption) => text({ caption })} />
            )}
            <Row
              label="Brand"
              dim={t.hookBrandOff}
              end={
                <IconButton
                  look="small"
                  aria-label={t.hookBrandOff ? 'Show brand in hook' : 'Hide brand in hook'}
                  aria-pressed={!t.hookBrandOff}
                  onClick={() => text({ hookBrandOff: !t.hookBrandOff })}
                >
                  {t.hookBrandOff ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </IconButton>
              }
            >
              <input
                value={t.brand}
                aria-label="Brand"
                onChange={(e) => text({ brand: e.target.value })}
                className={FIELD}
              />
            </Row>
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
        {kind === 'wall' && (
          <Text label="Label" value={t.wall} onChange={(wall) => text({ wall })} />
        )}
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
                <div
                  key={i}
                  className="space-y-1.5 border-t-2 border-[#0c0e12] pt-2.5 first:border-t-0 first:pt-0"
                >
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
                    <IconButton
                      look="small"
                      aria-label={`Move highlight ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => move(-1)}
                      className="disabled:opacity-30"
                    >
                      <ArrowUp className="size-3.5" />
                    </IconButton>
                    <IconButton
                      look="small"
                      aria-label={`Move highlight ${i + 1} down`}
                      disabled={i === t.features.length - 1}
                      onClick={() => move(1)}
                      className="disabled:opacity-30"
                    >
                      <ArrowDown className="size-3.5" />
                    </IconButton>
                    <IconButton
                      look="small"
                      aria-label={`Remove highlight ${i + 1}`}
                      onClick={() => text({ features: t.features.filter((_, k) => k !== i) })}
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
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
      </div>
    </div>
  );
}
