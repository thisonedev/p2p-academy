'use client';

import { X, ZoomOut, ZoomIn } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CLIP_SECONDS } from './read-clip.js';
import { type Place, placeMedia, laptop } from './video.js';
import { IconButton } from '../../ui/icon-button.js';

export const CENTERED = { x: 0.5, y: 0.5, zoom: 1 };

/** The laptop the sheet shows, in the sheet's canvas of 2000 by 1300. */
const LAP = { cx: 1000, cy: 630, w: 1880, h: 1162, r: 0 };

/** Its screen, as `laptop` in design/video/video.ts lays it out: the picture's own spot. */
const LAP_SCREEN = { w: (810 * LAP.w) / 1000, h: LAP.h - (104 * LAP.w) / 1000 };

const LAP_LOOK = { look: { id: 'block' }, c: { shadow: 'rgba(0,0,0,0.55)' } };

/** Placing a picture, over the whole studio. It is on the video's laptop, drawn as a slide draws
 *  it, so what the lid's rim covers shows. A drag moves it and the wheel zooms. */
export function PlaceSheet({
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
          className="min-w-0 flex-1"
        />
        <ZoomIn className="size-4 shrink-0" />
        <button type="button" disabled={!moved} onClick={() => onPlace(null)} className={small}>
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-fd-primary-foreground hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** A video just picked, before it is added: a slider sets where its few seconds start. */
export function ClipStart({
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
          className="min-w-0 flex-1"
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
          className="rounded-md bg-primary px-2.5 py-1 text-[11.5px] font-semibold text-primary-foreground hover:bg-primary"
        >
          Add
        </button>
      </div>
    </div>
  );
}
