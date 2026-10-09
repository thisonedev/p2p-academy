'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import type { AcademyAPI, AcademyWindowAPI } from '@academy/validation';
import '../../lib/academy.js';

function readAPI(): AcademyWindowAPI | null {
  if (typeof window === 'undefined') return null;
  return window.academy?.window ?? null;
}

export function WindowControls() {
  // Start null so SSR and the first client render match, swapping to the real bridge after mount (avoids the React #418 hydration mismatch).
  const [api, setApi] = useState<AcademyWindowAPI | null>(null);
  useEffect(() => {
    setApi(readAPI());
  }, []);
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div
      aria-label="Window controls"
      className="flex items-center gap-2"
      onMouseDown={stop}
      onClick={stop}
    >
      {api ? (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => api.close()}
            className="size-3 rounded-full bg-window-close transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-window-close/50"
          />
          <button
            type="button"
            aria-label="Minimize"
            onClick={() => api.minimize()}
            className="size-3 rounded-full bg-window-minimize transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-window-minimize/50"
          />
          <button
            type="button"
            aria-label="Maximize"
            onClick={() => api.maximize()}
            className="size-3 rounded-full bg-window-maximize transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-window-maximize/50"
          />
        </>
      ) : (
        <>
          <span aria-hidden className="size-3 rounded-full" />
          <span aria-hidden className="size-3 rounded-full" />
          <span aria-hidden className="size-3 rounded-full" />
        </>
      )}
    </div>
  );
}
