import { useRef, useState, useEffect, useMemo } from 'react';
import { motionOf, isFilm, motionStyle, videoPaint, designCast, videoSize } from './films.js';
import { loadFonts } from '../render/fonts.js';
import { type ICVideoText, type ICSound, type ICLayout, type ICUpload, ratioHeight } from '../render/layout.js';
import { type Scene, SHARP, buildScene, drawBlurred } from '../motion/motion.js';
import { encodeMp4 } from '../render/mp4.js';
import { loadImages } from '../render/render.js';
import { NEW_SOUND, mixSound } from '../sound/sound.js';
import { findTemplate } from '../templates/templates.js';
import { allPages } from '../templates/thread.js';
import {
  type Slide,
  NEW_VIDEO,
  worded,
  drawn,
  readDesign,
  mediaOf,
  slidesOf,
  storyboardFor,
  skinOf,
  scenesOf,
} from './storyboards.js';
import { type Video, type VideoSpec, type Media, clipMedia, placeMedia, compile } from './video.js';

export const FPS = 30;

export const even = (n: number) => Math.round(n / 2) * 2;

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
export interface Clock {
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
