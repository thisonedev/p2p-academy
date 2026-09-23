'use client';

import { catalogStorage, isCatalogDiskLowError } from '@academy/core';
import { useEffect, useRef, useState } from 'react';
import { saveDesign } from './image-constructor-designs.js';
import type { ICLayout } from './image-constructor-layout.js';
import { ipcErrorMessage } from './playground-library.js';

/** Saves the design to the library. The first save asks for a name; after that it updates the same entry, as ⌘S does. */
export function SaveDesignButton({
  savedTick,
  layout,
  sceneUrl,
  fallbackName,
  onSaved,
}: {
  /** Goes up on each ⌘S that saved, so the shortcut confirms in the same spot a click does. */
  savedTick: number;
  layout: ICLayout;
  sceneUrl: string | null;
  fallbackName: string;
  onSaved: (saved: { id: string; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(false);
  useEffect(() => setAvailable(catalogStorage.available()), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as globalThis.Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (savedTick === 0) return;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 1800);
    return () => window.clearTimeout(t);
  }, [savedTick]);

  if (!available) return null;

  const save = async (title: string) => {
    if (!title) return setError('Give the design a name.');
    setBusy(true);
    setError(null);
    try {
      onSaved(await saveDesign(layout, sceneUrl, title, false));
      setOpen(false);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1800);
    } catch (err) {
      // A direct update has no popover open, so the error opens it to be seen.
      setName(title);
      setOpen(true);
      setError(
        isCatalogDiskLowError(err)
          ? 'Not enough disk space to save. Free some space and try again.'
          : ipcErrorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title={layout.saved ? `Updates "${layout.saved.name}" in your library (⌘S)` : 'Save this design to your library'}
        onClick={() => {
          setError(null);
          if (layout.saved) return void save(layout.saved.name);
          setName(fallbackName);
          setOpen((v) => !v);
        }}
        className={`rounded-md border px-3 py-1.5 text-[12.5px] hover:bg-canvas-muted ${
          open ? 'border-fuchsia-400 text-fuchsia-300' : flash ? 'border-emerald-500/60 text-emerald-400' : 'border-canvas-border'
        }`}
      >
        {flash ? 'Saved' : busy ? 'Saving…' : 'Save to library'}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-10 mb-1.5 w-72 rounded-xl border border-canvas-border bg-canvas-raised p-3 text-[11.5px] shadow-xl">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70">
            Save to library
          </div>
          <input
            // biome-ignore lint/a11y/noAutofocus: opened by the user's own Save click
            autoFocus
            value={name}
            maxLength={200}
            placeholder="Design name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save(name.trim())}
            className="w-full rounded-lg border border-canvas-border bg-canvas px-2.5 py-2 text-[12.5px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
          />
          {error && <div className="mt-1.5 text-red-300">{error}</div>}
          <p className="mt-2 leading-relaxed text-canvas-muted-foreground">
            Any Create design node can then use it. After this, ⌘S keeps it up to date.
          </p>
          <div className="mt-2.5 flex justify-end gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(name.trim())}
              className="rounded-md bg-emerald-500 px-3 py-1 text-[12px] font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
