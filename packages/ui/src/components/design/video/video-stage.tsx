'use client';

import { Pause, Play } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { type ICLayout, ratioHeight } from '../render/layout.js';
import { drawBlurred } from '../motion/motion.js';
import { previews } from '../panels/preview-hold.js';
import { useSound, MuteButton } from '../sound/sound-panel.js';
import { FPS, even, useStory, type Clock, type Story } from './story.js';

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
