'use client';

import type { AcademyAPI } from '@academy/validation';
import { Play } from 'lucide-react';
import { useEffect, useState } from 'react';

declare global {
  interface Window {
    academy?: AcademyAPI;
  }
}

export interface YouTubeEmbedProps {
  videoId: string;
  title: string;
  className?: string;
}

/** Click-to-play facade: shows the real thumbnail and only loads YouTube's
 *  iframe/JS once clicked. The desktop app serves itself from a custom
 *  academy:// origin, which YouTube's player rejects outright (error 153)
 *  since it isn't http(s), so desktop opens the real watch page in the
 *  system browser instead of embedding. */
export function YouTubeEmbed({ videoId, title, className = '' }: YouTubeEmbedProps) {
  const [playing, setPlaying] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => setIsDesktop(!!window.academy), []);

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
        src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
        onError={(e) => {
          e.currentTarget.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }}
        alt=""
        className="absolute inset-0 size-full object-cover"
      />
      <span className="absolute inset-0 bg-canvas/50 transition-colors group-hover:bg-canvas/30" />
      <span className="relative flex size-14 items-center justify-center rounded-full border border-canvas-border bg-canvas-raised text-emerald-400">
        <Play className="size-5" strokeWidth={2} fill="currentColor" />
      </span>
    </>
  );

  if (isDesktop) {
    return (
      <a
        href={`https://www.youtube.com/watch?v=${videoId}`}
        target="_blank"
        rel="noreferrer"
        className={`group relative flex items-center justify-center bg-canvas ${className}`}
        aria-label={`Watch "${title}" on YouTube`}
      >
        {thumbnail}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className={`group relative flex items-center justify-center bg-canvas ${className}`}
      aria-label={`Play "${title}"`}
    >
      {thumbnail}
    </button>
  );
}
