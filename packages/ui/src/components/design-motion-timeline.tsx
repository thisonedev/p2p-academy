'use client';

import { Pause, Play, RotateCcw, Scissors, Trash2 } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import {
  CLIP_MIN,
  clipsLength,
  motionOf,
  videoClips,
  videoLength,
} from './design-films.js';
import type { ICClip, ICLayout, ICMotion } from './design-layout.js';
import type { Scene } from './design-motion.js';
import type { MotionPlayer } from './design-motion-panel.js';

/** A piece being changed by a drag, before it is saved. */
interface Drag {
  i: number;
  /** Pulling one end to trim the piece, or carrying the whole piece to a new place. */
  mode: 'start' | 'end' | 'move';
  x: number;
  /** Seconds one pixel stood for when the drag began. */
  scale: number;
  by: number;
}

/**
 * The timeline under the canvas: one track holding the video's pieces. A piece's ends drag in to
 * trim it, its body drags to reorder it, and the scissors cut the piece under the playhead in two.
 */
export function MotionTimeline({
  layout,
  scene,
  player,
  onMotion,
}: {
  layout: ICLayout;
  scene: Scene | null;
  player: MotionPlayer;
  onMotion: (patch: Partial<ICMotion>) => void;
}) {
  const motion = motionOf(layout);
  const [playing, setPlaying] = useState(player.playing);
  const [picked, setPicked] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const head = useRef<HTMLDivElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const lane = useRef<HTMLDivElement>(null);
  const whole = scene ? videoLength(scene, motion) : (motion.seconds ?? 6);
  const saved = scene ? videoClips(scene, motion) : [{ start: 0, end: whole }];

  // The pieces as the drag in hand would leave them.
  const clips = saved.map((c, i): ICClip => {
    if (!drag || drag.i !== i) return c;
    if (drag.mode === 'start')
      return { ...c, start: Math.min(c.end - CLIP_MIN, Math.max(0, c.start + drag.by)) };
    if (drag.mode === 'end')
      return { ...c, end: Math.max(c.start + CLIP_MIN, Math.min(whole, c.end + drag.by)) };
    return c;
  });
  const total = clipsLength(clips);
  const bases = clips.map((_, i) => clipsLength(clips.slice(0, i)));

  useEffect(() => {
    let frame = requestAnimationFrame(function tick() {
      const t = Math.min(player.t, total);
      if (head.current) head.current.style.left = `${(t / total) * 100}%`;
      if (clock.current) clock.current.textContent = `${t.toFixed(1)}s / ${total.toFixed(1)}s`;
      // A click on the canvas pauses too, so the button follows the player.
      setPlaying(player.playing);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [player, total]);

  /** Saves the pieces. One piece covering everything is the video uncut. */
  const put = (next: ICClip[]) => {
    const uncut = next.length === 1 && next[0].start < 0.02 && next[0].end > whole - 0.02;
    onMotion({ clips: uncut ? undefined : next });
  };
  const split = () => {
    const i = bases.findLastIndex((b) => player.t >= b);
    const clip = saved[i];
    const at = clip ? clip.start + player.t - bases[i] : 0;
    // A cut too close to an end would leave a piece too short to see.
    if (!clip || at - clip.start < CLIP_MIN || clip.end - at < CLIP_MIN) return;
    put([
      ...saved.slice(0, i),
      { start: clip.start, end: at },
      { start: at, end: clip.end },
      ...saved.slice(i + 1),
    ]);
    setPicked(i + 1);
  };
  const remove = () => {
    if (picked === null || saved.length < 2) return;
    put(saved.filter((_, i) => i !== picked));
    setPicked(null);
  };

  const begin = (e: ReactPointerEvent<HTMLElement>, i: number, mode: Drag['mode']) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setPicked(i);
    setDrag({ i, mode, x: e.clientX, scale: total / (lane.current?.clientWidth || 1), by: 0 });
  };
  const move = (e: ReactPointerEvent<HTMLElement>) => {
    if (drag) setDrag({ ...drag, by: (e.clientX - drag.x) * drag.scale });
  };
  const end = () => {
    if (!drag) return;
    setDrag(null);
    if (Math.abs(drag.by) < drag.scale * 3) return;
    if (drag.mode !== 'move') return put(clips);
    // Dropped where its middle lands among the others' middles.
    const mid = (i: number) => bases[i] + (saved[i].end - saved[i].start) / 2;
    const others = saved.map((_, i) => i).filter((i) => i !== drag.i);
    const to = others.filter((i) => mid(i) < mid(drag.i) + drag.by).length;
    const next = others.map((i) => saved[i]);
    next.splice(to, 0, saved[drag.i]);
    put(next);
    setPicked(to);
  };
  const scrub = (e: ReactPointerEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    player.t = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * total;
  };

  const pct = (seconds: number) => `${(seconds / total) * 100}%`;
  const tool =
    'rounded-md border border-canvas-border p-1 text-canvas-muted-foreground hover:bg-canvas-muted hover:text-canvas-foreground disabled:opacity-30 disabled:hover:bg-transparent';
  const edge = (i: number, side: 'start' | 'end') => (
    <b
      className={`absolute inset-y-0 w-1.5 cursor-ew-resize bg-white/25 hover:bg-emerald-400 ${side === 'start' ? 'left-0 rounded-l-[3px]' : 'right-0 rounded-r-[3px]'}`}
      onPointerDown={(e) => begin(e, i, side)}
      onPointerMove={move}
      onPointerUp={end}
    />
  );

  return (
    <div className="shrink-0 select-none border-t border-canvas-border bg-canvas-raised px-3 py-1.5 text-[11px]">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={playing ? 'Pause' : 'Play'}
          className={tool}
          onClick={() => {
            player.playing = !player.playing;
          }}
        >
          {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
        </button>
        <button
          type="button"
          aria-label="Play from the start"
          className={tool}
          onClick={() => {
            player.t = 0;
            player.playing = true;
          }}
        >
          <RotateCcw className="size-3" />
        </button>
        <span ref={clock} className="mx-2 tabular-nums text-canvas-muted-foreground" />
        <button
          type="button"
          aria-label="Split at the playhead"
          title="Split at the playhead"
          className={tool}
          onClick={split}
        >
          <Scissors className="size-3" />
        </button>
        <button
          type="button"
          aria-label="Delete the selected piece"
          title="Delete the selected piece"
          className={tool}
          disabled={picked === null || saved.length < 2}
          onClick={remove}
        >
          <Trash2 className="size-3" />
        </button>
      </div>
      <div ref={lane} className="relative mt-1">
        <div
          className="relative h-4 cursor-col-resize"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            scrub(e);
          }}
          onPointerMove={(e) => e.buttons === 1 && scrub(e)}
        >
          {Array.from({ length: Math.floor(total) + 1 }, (_, s) => (
            <span
              // One mark a second, in order.
              key={s}
              className="absolute bottom-0 border-l border-canvas-border pl-1 text-[9.5px] leading-3 text-canvas-muted-foreground/70"
              style={{ left: pct(s) }}
            >
              {s}s
            </span>
          ))}
        </div>
        <div className="relative h-7">
          {clips.map((clip, i) => {
            const carried = drag?.mode === 'move' && drag.i === i;
            return (
              <div
                // Pieces have no identity beyond their place in the row.
                key={i}
                className={`absolute inset-y-0 flex cursor-grab items-center justify-center overflow-hidden rounded border text-[9.5px] tabular-nums active:cursor-grabbing ${
                  picked === i
                    ? 'border-emerald-400 bg-emerald-400/20 text-emerald-300'
                    : 'border-canvas-border bg-slate-500/30 text-canvas-muted-foreground'
                } ${carried ? 'z-10 opacity-80 shadow-lg' : ''}`}
                style={{
                  left: `calc(${pct(bases[i])} + 1px)`,
                  width: `calc(${pct(clip.end - clip.start)} - 2px)`,
                  transform: carried ? `translateX(${drag.by / drag.scale}px)` : undefined,
                }}
                onPointerDown={(e) => begin(e, i, 'move')}
                onPointerMove={move}
                onPointerUp={end}
              >
                {(clip.end - clip.start).toFixed(1)}s{edge(i, 'start')}
                {edge(i, 'end')}
              </div>
            );
          })}
        </div>
        <div ref={head} className="pointer-events-none absolute inset-y-0 z-20 w-px bg-white/80" />
      </div>
    </div>
  );
}
