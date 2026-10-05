'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  castDefaults,
  clipsLength,
  cutPaint,
  highlightOf,
  isFilm,
  MOTION_STYLES,
  motionOf,
  motionStyle,
  videoClips,
  videoLand,
  videoLength,
  videoPaint,
  withHighlight,
} from './image-constructor-films.js';
import { loadFonts } from './image-constructor-fonts.js';
import type { ICElement, ICLayout, ICMotion } from './image-constructor-layout.js';
import {
  buildScene,
  drawBlurred,
  type Scene,
  SHARP,
  type Track,
} from './image-constructor-motion.js';
import type { StudioApi } from './image-constructor-panels.js';
import { loadImages } from './image-constructor-render.js';
import { ThemedSelect } from './themed-select.js';

/** Where playback is. The canvas, the timeline and the panel all read this one clock. */
export interface MotionPlayer {
  t: number;
  playing: boolean;
  total: number;
}

export const newMotionPlayer = (): MotionPlayer => ({ t: 0, playing: true, total: 6 });

/** The design painted for animating, `width` pixels wide, rebuilt a moment after it changes. */
export function useMotionScene(
  layout: ICLayout,
  sceneUrl: string | null,
  width: number,
  on: boolean,
): Scene | null {
  const [scene, setScene] = useState<Scene | null>(null);
  useEffect(() => {
    if (!on) {
      setScene(null);
      return;
    }
    let live = true;
    // Waits out a drag or a run of typing instead of repainting every layer on each change.
    const wait = setTimeout(() => {
      void Promise.all([loadImages(layout, sceneUrl), loadFonts()]).then(([images]) => {
        if (live) setScene(buildScene(layout, images, width));
      });
    }, 120);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [layout, sceneUrl, width, on]);
  return scene;
}

/** The video playing over the design's canvas. A click on it pauses or plays. */
export function MotionStage({
  scene,
  layout,
  player,
}: {
  scene: Scene;
  layout: ICLayout;
  player: MotionPlayer;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const motion = motionOf(layout);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const scratch = document.createElement('canvas');
    scratch.width = canvas.width;
    scratch.height = canvas.height;
    const clips = videoClips(scene, motion);
    const cut = cutPaint(videoPaint(scene, motion), clips);
    // The player's clock runs over the cut video: its pieces, one after another.
    player.total = clipsLength(clips);
    let last = performance.now();
    let shown = -1;
    let frame = requestAnimationFrame(function tick(now) {
      const dt = (now - last) / 1000;
      last = now;
      // A short rest on the last frame before it starts over.
      if (player.playing) player.t = (player.t + dt) % (player.total + 0.5);
      const t = Math.min(player.t, player.total);
      // Paused on a frame that is already up, there is nothing to draw.
      if (t !== shown) {
        if (motion.blur === false) cut(t)(ctx, t);
        else drawBlurred(ctx, scratch, cut(t), t, 30, 4);
        shown = t;
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [scene, motion, player]);
  // Space pauses and plays, as in any video editor, except while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const at = e.target as HTMLElement | null;
      const typing = at?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(at?.tagName ?? '');
      if (e.code !== 'Space' || typing || e.metaKey || e.ctrlKey || e.altKey) return;
      // Stopped here so the key does not also press a focused button or scroll the page.
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
        width={Math.round(scene.width / SHARP)}
        height={Math.round(scene.height / SHARP)}
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

/** The design's video on a loop, for a preview card. Nothing shows until its layers are painted. */
export function MotionPreview({
  layout,
  sceneUrl,
  width,
}: {
  layout: ICLayout;
  sceneUrl: string | null;
  width: number;
}) {
  const scene = useMotionScene(layout, sceneUrl, width, true);
  const ref = useRef<HTMLCanvasElement>(null);
  const motion = motionOf(layout);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!scene || !ctx) return;
    const clips = videoClips(scene, motion);
    const cut = cutPaint(videoPaint(scene, motion), clips);
    const total = clipsLength(clips);
    let frame = requestAnimationFrame(function tick(now) {
      // Every card reads the same clock, so all sizes play in step.
      const t = Math.min((now / 1000) % (total + 0.5), total);
      cut(t)(ctx, t);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [scene, motion]);
  return scene ? (
    <canvas ref={ref} width={scene.width} height={scene.height} className="block w-full" />
  ) : (
    <div className="aspect-video w-full animate-pulse bg-white/5" />
  );
}

/** What a layer is called in the timeline and the Motion tab. */
export function layerName(e: ICElement, chart: boolean): string {
  const short = (s: string) => {
    const one = s.replace(/\s+/g, ' ').trim();
    return one.length > 20 ? `${one.slice(0, 19)}…` : one;
  };
  if (e.t === 'text') return short(e.text) || 'Text';
  if (e.t === 'pill') return `Button · ${short(e.text)}`;
  if (e.t === 'art') return chart ? 'Chart' : 'Art';
  if (e.t === 'shape') return 'Card';
  if (e.t === 'subject') return 'Product';
  return e.t[0].toUpperCase() + e.t.slice(1);
}

const inks = new WeakMap<HTMLCanvasElement, { x: number; y: number; w: number; h: number }>();

/**
 * What a layer actually paints, which can be much smaller than its box: a short word in a wide
 * text box would otherwise be a speck in its tile. Read once per picture and kept, since reading
 * pixels back is slow and the same layer can sit in more than one row of tiles.
 */
function inkBox(track: Track): { x: number; y: number; w: number; h: number } {
  const { canvas: picture, ox, oy } = track.sprite;
  const known = inks.get(picture);
  if (known) return known;
  const ink = picture.getContext('2d')?.getImageData(0, 0, picture.width, picture.height).data;
  let x0 = picture.width;
  let y0 = picture.height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; ink && y < picture.height; y++) {
    for (let x = 0; x < picture.width; x++) {
      if (ink[(y * picture.width + x) * 4 + 3] < 24) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const box =
    x1 >= x0 ? { x: ox + x0, y: oy + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : track.sprite.box;
  inks.set(picture, box);
  return box;
}

/** Something whole a person would point at: a layer, with everything that sits on it. */
interface Item {
  id: string;
  tracks: Track[];
}

/**
 * The design's items worth offering as tiles. A card comes with what is on it, so its rows,
 * ticks and labels are not tiles of their own, and specks too small to mean anything are left
 * out. Only the `most` largest are kept, shown in reading order.
 */
function itemsOf(scene: Scene, most: number, pictures: boolean): Item[] {
  const live = scene.tracks.filter((t) => !t.stage);
  const area = (t: Track) => t.pivot.w * t.pivot.h;
  const within = (t: Track, o: Track) => {
    const cx = t.sprite.box.x + t.sprite.box.w / 2;
    const cy = t.sprite.box.y + t.sprite.box.h / 2;
    return (
      cx > o.pivot.x && cx < o.pivot.x + o.pivot.w && cy > o.pivot.y && cy < o.pivot.y + o.pivot.h
    );
  };
  const holds = (o: Track) => o.e.t === 'shape' || o.e.t === 'image';
  const least = scene.width * scene.height * (pictures ? 0.02 : 0.003);
  // A group is one item, led by its largest member.
  const groups = new Map<Track['pivot'], Track[]>();
  for (const t of live) groups.set(t.pivot, [...(groups.get(t.pivot) ?? []), t]);
  const own = (t: Track) => t.sprite.box.w * t.sprite.box.h;
  const tops = [...groups.values()]
    .map((members) => [...members].sort((a, b) => own(b) - own(a))[0])
    .filter((t) => {
      const words = (groups.get(t.pivot) ?? []).every((m) => m.e.t === 'text' || m.e.t === 'pill');
      if (pictures && words) return false;
      // A button stands on its own even on a card, since it is what gets pressed.
      if (t.e.t === 'pill') return true;
      // A drawing can also sit on a larger drawing, such as a planet on its halo. Words never
      // belong to a drawing behind them.
      const art = (x: Track) => x.e.t === 'art' || x.e.t === 'image' || x.e.t === 'subject';
      const held = live.some(
        (o) =>
          o !== t &&
          (holds(o) || (o.e.t === 'art' && art(t))) &&
          area(o) > area(t) * 1.5 &&
          within(t, o),
      );
      return !held && area(t) >= least;
    });
  // A run of alike pieces stacked in a column, such as a list's rows or a stack of cards, is one
  // item: the column. Alike means the same left edge and about the same height, close together.
  const columns: Track[][] = [];
  for (const t of [...tops].sort((a, b) => a.pivot.y - b.pivot.y)) {
    const column = columns.find((c) => {
      const last = c[c.length - 1].pivot;
      const tall = Math.max(last.h, t.pivot.h);
      return (
        t.e.t !== 'pill' &&
        c[0].e.t !== 'pill' &&
        Math.abs(last.x - t.pivot.x) < scene.width * 0.015 &&
        Math.abs(last.h - t.pivot.h) < tall * 0.3 &&
        // Rows of a list sit further apart than they are tall.
        t.pivot.y - (last.y + last.h) < tall * 2.5
      );
    });
    if (column) column.push(t);
    else columns.push([t]);
  }
  const size = (c: Track[]) => c.reduce((n, t) => n + area(t), 0);
  return columns
    .sort((a, b) => size(b) - size(a))
    .slice(0, most)
    .sort((a, b) => a[0].pivot.y - b[0].pivot.y || a[0].pivot.x - b[0].pivot.x)
    .map((c) => ({
      id: c[0].e.id,
      // The lead first, then the rest of the column and everything sitting on any of it.
      tracks: [
        c[0],
        ...live.filter(
          (o) => o !== c[0] && c.some((t) => o === t || o.pivot === t.pivot || within(o, t)),
        ),
      ],
    }));
}

/** One item of the design as a small picture of itself, so it needs no name to be recognized. */
function ItemTile({
  scene,
  item,
  on,
  onPick,
}: {
  scene: Scene;
  item: Item;
  on: boolean;
  onPick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Everything painted for the item, fitted whole into the tile with a little room around it.
    const inks = item.tracks.map(inkBox);
    const x = Math.min(...inks.map((b) => b.x));
    const y = Math.min(...inks.map((b) => b.y));
    const w = Math.max(...inks.map((b) => b.x + b.w)) - x;
    const h = Math.max(...inks.map((b) => b.y + b.h)) - y;
    const pad = Math.max(w, h) * 0.12 + 2;
    const fit = Math.min(canvas.width / (w + pad * 2), canvas.height / (h + pad * 2));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(scene.base, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(fit, fit);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    // In the design's own stacking order, whichever layer leads the item.
    for (const t of scene.tracks) {
      if (item.tracks.includes(t)) ctx.drawImage(t.sprite.canvas, t.sprite.ox, t.sprite.oy);
    }
  }, [scene, item]);
  const lead = item.tracks.find((t) => t.e.id === item.id) ?? item.tracks[0];
  const name = layerName(lead.e, lead.sprite.chart);
  return (
    <button
      type="button"
      title={name}
      aria-label={name}
      aria-pressed={on}
      onClick={onPick}
      className={`overflow-hidden rounded-md border ${on ? 'border-emerald-400' : 'border-canvas-border hover:border-canvas-muted-foreground/50'}`}
    >
      <canvas ref={ref} width={112} height={72} className="block h-9 w-full" />
    </button>
  );
}

/** Lengths that suit a feed post or a story. Auto is the style's own. */
const LENGTHS: [number | undefined, string][] = [
  [undefined, 'Auto'],
  [5, '5s'],
  [8, '8s'],
  [10, '10s'],
  [15, '15s'],
];

/** What each thing a film lets the person set is called. */
const FIELD_NAMES = {
  headline: 'Text',
  label: 'Button',
  kicker: 'Kicker',
  command: 'Command',
  picture: 'Picture',
};

/** What the video's one highlight can be. */
const EFFECTS = [
  { value: 'click', label: 'Cursor click' },
  { value: 'shine', label: 'Shine' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'none', label: 'None' },
];

const seg = (on: boolean) =>
  `rounded px-2 py-1 ${on ? 'bg-canvas-muted text-canvas-foreground' : 'text-canvas-muted-foreground hover:text-canvas-foreground'}`;

function Segment<T>({
  options,
  value,
  onPick,
}: {
  options: [T, string][];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className={`flex rounded-md border border-canvas-border p-0.5 text-[11.5px]`}>
      {options.map(([v, label]) => (
        <button key={label} type="button" onClick={() => onPick(v)} className={seg(v === value)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-canvas-border px-3.5 py-3">
      <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70">
        {title}
      </div>
      {children}
    </section>
  );
}

/** The inspector's Motion tab: a picked layer's own animation, the video's timing, then its style. */
export function MotionPanel({
  api,
  sceneUrl,
  player,
}: {
  api: StudioApi;
  sceneUrl: string | null;
  player: MotionPlayer;
}) {
  const { layout } = api;
  const motion = motionOf(layout);
  const style = motionStyle(motion.style);
  const film = isFilm(style);
  const set = (patch: Partial<ICMotion>) =>
    api.update((l) => ({ ...l, motion: { ...motionOf(l), ...patch } }));
  const thumbs = useMotionScene(layout, sceneUrl, 480, true);
  const cards = useRef(new Map<string, HTMLCanvasElement>());

  const [hover, setHover] = useState<string | null>(null);

  // A card shows one frame from the middle of its style, and plays only while the pointer is on
  // it. Nine videos running at once would keep the machine busy for nothing.
  useEffect(() => {
    if (!thumbs) return;
    let frame = 0;
    for (const s of MOTION_STYLES) {
      const ctx = cards.current.get(s.id)?.getContext('2d');
      if (!ctx) continue;
      // A card plays a film at its own length, and an entrance as a short loop.
      const m = {
        ...motion,
        style: s.id,
        pace: 1,
        seconds: isFilm(s) ? undefined : 3.2,
        loop: false,
        clips: undefined,
      };
      const paint = videoPaint(thumbs, m);
      if (s.id !== hover) {
        paint(ctx, isFilm(s) ? videoLand(thumbs, m) * 0.45 : 0.6);
        continue;
      }
      const loop = videoLength(thumbs, m);
      const from = performance.now();
      frame = requestAnimationFrame(function tick(now) {
        paint(ctx, ((now - from) / 1000) % loop);
        frame = requestAnimationFrame(tick);
      });
    }
    return () => cancelAnimationFrame(frame);
  }, [thumbs, motion, hover]);

  const lit = thumbs ? highlightOf(thumbs, motion) : { effect: 'shine', id: null };
  // Kept between redraws, so a tile repaints only when the design does.
  const items = useMemo(() => (thumbs ? itemsOf(thumbs, 12, false) : []), [thumbs]);
  const pictures = useMemo(() => (thumbs ? itemsOf(thumbs, 8, true) : []), [thumbs]);
  // The item the highlight is on, and its layers for when only the effect changes.
  const litItem = items.find((item) => item.tracks.some((t) => t.e.id === lit.id));
  const litIds = litItem ? litItem.tracks.map((t) => t.e.id) : lit.id ? [lit.id] : [];

  return (
    <>
      <Block title="Timing">
        <div className="flex flex-wrap gap-1.5">
          <Segment
            options={LENGTHS}
            value={motion.seconds}
            // The pieces were cut from the old length, so a new one starts uncut.
            onPick={(seconds) => set({ seconds, clips: undefined })}
          />
          {/* A film sets its own pace, so these show for the entrance styles only. */}
          {!film && (
            <>
              <Segment
                options={[
                  [1.35, 'Calm'],
                  [1, 'Normal'],
                  [0.75, 'Snappy'],
                ]}
                value={motion.pace}
                onPick={(pace) => set({ pace })}
              />
              <Segment
                options={[
                  [false, 'Hold'],
                  [true, 'Loop'],
                ]}
                value={!!motion.loop}
                onPick={(loop) => set({ loop })}
              />
            </>
          )}
          <Segment
            options={[
              [true, 'Motion blur'],
              [false, 'Off'],
            ]}
            value={motion.blur !== false}
            onPick={(blur) => set({ blur })}
          />
        </div>
      </Block>
      {thumbs && lit.id && (
        <Block title="Highlight">
          <ThemedSelect
            ariaLabel="Highlight effect"
            value={lit.effect}
            options={EFFECTS}
            onChange={(effect) => api.update((l) => withHighlight(l, effect, litIds))}
          />
          {lit.effect !== 'none' && (
            <div className="mt-1.5 grid max-h-32 grid-cols-4 gap-1.5 overflow-y-auto">
              {items.map((item) => (
                <ItemTile
                  key={item.id}
                  scene={thumbs}
                  item={item}
                  on={item === litItem}
                  onPick={() =>
                    api.update((l) =>
                      withHighlight(
                        l,
                        lit.effect,
                        item.tracks.map((t) => t.e.id),
                      ),
                    )
                  }
                />
              ))}
            </div>
          )}
        </Block>
      )}
      {film && thumbs && (
        <Block title="Content">
          <div className="space-y-1.5">
            {style.fields.map((field) =>
              field === 'picture' ? (
                <div key={field} className="grid grid-cols-4 gap-1.5 pt-0.5">
                  {pictures.map((t) => (
                    <ItemTile
                      key={t.id}
                      scene={thumbs}
                      item={t}
                      on={t.id === motion.cast?.picture}
                      onPick={() =>
                        set({
                          cast: {
                            ...motion.cast,
                            // A second click gives the choice back to the film.
                            picture: t.id === motion.cast?.picture ? undefined : t.id,
                          },
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <label key={field} className="flex items-center gap-2 text-[11px]">
                  <span className="w-14 shrink-0 text-canvas-muted-foreground/70">
                    {FIELD_NAMES[field]}
                  </span>
                  <input
                    type="text"
                    // The design's own words show until the person types theirs. Emptied, the
                    // field stays empty to type in, and the film goes back to the design's.
                    value={motion.cast?.[field] ?? castDefaults(thumbs)[field]}
                    onChange={(e) => {
                      const typed = e.target.value;
                      const same = typed === castDefaults(thumbs)[field];
                      set({ cast: { ...motion.cast, [field]: same ? undefined : typed } });
                    }}
                    className="min-w-0 flex-1 rounded-md border border-canvas-border bg-canvas px-2 py-1 text-[12px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                  />
                </label>
              ),
            )}
          </div>
        </Block>
      )}
      <Block title="Style">
        <div className="grid grid-cols-2 gap-1.5">
          {MOTION_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.blurb}
              onPointerEnter={() => setHover(s.id)}
              onPointerLeave={() => setHover(null)}
              onClick={() => {
                // A new style is watched from its first frame.
                player.t = 0;
                player.playing = true;
                set({ style: s.id });
              }}
              className={`flex flex-col gap-1 rounded-lg border p-1 pb-1.5 text-left ${
                s.id === style.id
                  ? 'border-emerald-400 bg-emerald-400/10'
                  : 'border-canvas-border bg-canvas hover:border-canvas-muted-foreground/50'
              }`}
            >
              <span className="flex h-14 items-center justify-center overflow-hidden rounded bg-black">
                <canvas
                  ref={(c) => {
                    if (c) cards.current.set(s.id, c);
                    else cards.current.delete(s.id);
                  }}
                  width={thumbs?.width ?? 240}
                  height={thumbs?.height ?? 135}
                  className="max-h-full max-w-full"
                />
              </span>
              <span className="px-0.5 text-[12px] font-semibold text-canvas-foreground">
                {s.name}
              </span>
            </button>
          ))}
        </div>
      </Block>
    </>
  );
}
