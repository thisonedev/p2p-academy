'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';
import '../../lib/academy.js';

export interface YouTubeEmbedProps {
  videoId: string;
  title: string;
  className?: string;
  /** A still shipped with the app, like a product screenshot. It shows as is, with a small
   *  "Watch demo" button, instead of a dimmed YouTube thumbnail with a big play button. */
  poster?: string;
}

/** Click-to-play facade: shows the real thumbnail and only loads YouTube's
 *  iframe/JS once clicked. The desktop app serves itself from a custom
 *  academy:// origin, which YouTube's player rejects outright (error 153)
 *  since it isn't http(s), so desktop opens the real watch page in the
 *  system browser instead of embedding. */
export function YouTubeEmbed({ videoId, title, className = '', poster }: YouTubeEmbedProps) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        className={className}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        // The page's own Referrer-Policy is no-referrer; without a referrer, YouTube
        // can't verify the embedding origin and refuses to play (error 153).
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  }

  const thumbnail = (
    <>
      {/* biome-ignore lint/performance/noImgElement: a remote YouTube thumbnail, not a local asset next/image would optimize */}
      <img
        src={poster ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
        onError={(e) => {
          const fallback = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
        }}
        fetchPriority="high"
        decoding="async"
        alt=""
        className="absolute inset-0 size-full object-cover object-left-top"
      />
      {poster ? (
        <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-canvas-border bg-canvas-raised py-1.5 pl-1.5 pr-3.5 text-sm font-semibold text-canvas-foreground shadow-lg transition-colors group-hover:border-primary/60">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-canvas">
            <Play className="size-3" strokeWidth={2} fill="currentColor" />
          </span>
          Watch demo
        </span>
      ) : (
        <>
          <span className="absolute inset-0 bg-canvas/50 transition-colors group-hover:bg-canvas/30" />
          <span className="relative flex size-14 items-center justify-center rounded-full border border-canvas-border bg-canvas-raised text-primary">
            <Play className="size-5" strokeWidth={2} fill="currentColor" />
          </span>
        </>
      )}
    </>
  );

  return (
    <button
      type="button"
      // Checked on click, not in state: swapping the element after mount remounts the
      // thumbnail and it blinks twice. The main process opens window.open in the browser.
      onClick={() =>
        window.academy
          ? window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')
          : setPlaying(true)
      }
      className={`group relative flex items-center justify-center bg-canvas ${className}`}
      aria-label={`Play "${title}"`}
    >
      {thumbnail}
    </button>
  );
}
