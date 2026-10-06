'use client';

import { catalogStorage, isCatalogDiskLowError } from '@academy/core';
import { useEffect, useRef, useState } from 'react';
import { saveDesign } from './design-designs.js';
import type { ICLayout } from './design-layout.js';
import { ipcErrorMessage } from './playground-library.js';

/** Saves the design to the library. The first save asks for a name; after that it updates the same entry, as ⌘S does. */
export function SaveDesignButton({
  savedTick,
  askNameTick,
  layout,
  sceneUrl,
  fallbackName,
  onSaved,
}: {
  /** Goes up on each ⌘S that saved, so the shortcut confirms in the same spot a click does. */
  savedTick: number;
  /** Goes up when ⌘S is pressed on a design that has no name yet, to open the name box. */
  askNameTick: number;
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: opens only when the tick moves
  useEffect(() => {
    if (askNameTick === 0) return;
    setError(null);
    setName(fallbackName);
    setOpen(true);
  }, [askNameTick]);

  useEffect(() => {
    if (savedTick === 0) return;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 1800);
    return () => window.clearTimeout(t);
  }, [savedTick]);

  if (!available) return null;

  const save = async (title: string) => {
    if (!title) return setError('Give the template a name.');
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
        title={
          layout.saved
            ? `${layout.saved.dirty ? 'Unsaved changes. ' : ''}Updates "${layout.saved.name}" in My templates (⌘S)`
            : 'Save this design as a template of your own'
        }
        onClick={() => {
          setError(null);
          if (layout.saved) return void save(layout.saved.name);
          setName(fallbackName);
          setOpen((v) => !v);
        }}
        className={`rounded-md border bg-canvas-field px-3 py-1.5 text-[12.5px] hover:bg-canvas-muted ${
          open
            ? 'border-emerald-400 text-emerald-300'
            : flash
              ? 'border-emerald-500/60 text-emerald-400'
              : 'border-transparent'
        }`}
      >
        {layout.saved?.dirty && !flash && !busy && (
          <span
            data-unsaved
            aria-hidden
            className="mr-1.5 inline-block size-1.5 rounded-full bg-amber-400 align-middle"
          />
        )}
        {flash ? 'Saved' : busy ? 'Saving…' : layout.saved ? 'Save' : 'Save as template'}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-10 mb-1.5 w-72 rounded-xl border border-canvas-border bg-canvas-raised p-3 text-[11.5px] shadow-xl">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70">
            Save as template
          </div>
          <input
            // biome-ignore lint/a11y/noAutofocus: opened by the user's own Save click
            autoFocus
            value={name}
            maxLength={200}
            placeholder="Template name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save(name.trim())}
            className="w-full rounded-lg border border-canvas-border bg-canvas px-2.5 py-2 text-[12.5px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
          />
          {error && <div className="mt-1.5 text-red-300">{error}</div>}
          <p className="mt-2 leading-relaxed text-canvas-muted-foreground">
            Saves to My templates. Press ⌘S later to update it.
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
