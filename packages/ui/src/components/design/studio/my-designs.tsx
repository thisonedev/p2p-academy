'use client';

import { catalogStorage } from '@academy/core';
import type { AcademyCatalogEntry } from '@academy/validation';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DESIGNS_KIND, designThumb, loadDesign } from './designs.js';
import type { ICLayout } from '../render/layout.js';
import { ipcErrorMessage } from '../../playground/lib/library.js';

export const renameDesign = (id: string, name: string) =>
  catalogStorage.rename(DESIGNS_KIND, id, name);

/** A saved design's name as an input: Enter or leaving it saves, Escape keeps the old name. */
export function RenameField({
  name,
  onDone,
}: {
  name: string;
  onDone: (name: string | null) => void;
}) {
  const [draft, setDraft] = useState(name);
  const commit = () => {
    const next = draft.trim();
    onDone(next && next !== name ? next : null);
  };
  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: opened by the user's own Rename click
      autoFocus
      aria-label="Design name"
      value={draft}
      maxLength={200}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        else if (e.key === 'Escape') onDone(null);
      }}
      className="w-full min-w-0 rounded border border-primary/60 bg-canvas px-1 py-0.5 text-[12px] font-semibold text-canvas-foreground"
      // The site's global :focus-visible outline isn't in a layer, so a class can't turn it off.
      style={{ outline: 'none' }}
    />
  );
}

/** Designs saved to the library, above the template pack. Opening one replaces the canvas; undo brings it back. */
export function MyDesignsSection({
  activeId,
  saved,
  onOpen,
  onRenamed,
}: {
  activeId: string | undefined;
  /** The open design's saved record. It is a new object after every save, which reloads the list. */
  saved: { id: string; name: string } | undefined;
  onOpen: (layout: ICLayout) => void;
  onRenamed: (id: string, name: string) => void;
}) {
  const [available, setAvailable] = useState(false);
  const [entries, setEntries] = useState<AcademyCatalogEntry[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Folded unless one of them is open on the canvas.
  const [open, setOpen] = useState(!!activeId);

  const refresh = useCallback(() => {
    catalogStorage
      .list(DESIGNS_KIND)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  // Refreshes on mount and after every save, so a design saved while this tab is open shows
  // up without leaving it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `saved` is the signal, not an input
  useEffect(() => {
    const ok = catalogStorage.available();
    setAvailable(ok);
    if (ok) refresh();
  }, [refresh, saved]);

  // A design saved for the first time becomes the open one, so the list unfolds to show it.
  useEffect(() => {
    if (activeId) setOpen(true);
  }, [activeId]);

  if (!available || entries.length === 0) return null;

  const run = (fn: () => Promise<void>) => {
    setError(null);
    fn().catch((err) => setError(ipcErrorMessage(err)));
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="mb-2 flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70 hover:text-canvas-muted-foreground"
      >
        My templates ({entries.length})
        <ChevronDown
          className={`ml-auto size-3.5 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && error && <div className="mb-2 text-[11px] text-danger">{error}</div>}
      {open && (
        <div className="grid grid-cols-2 gap-2">
          {entries.map((entry) => {
            const thumb = designThumb(entry.preview);
            return (
              <div
                key={entry.id}
                className={`overflow-hidden rounded-xl border bg-canvas-muted ${
                  activeId === entry.id
                    ? 'border-primary'
                    : 'border-canvas-border hover:border-canvas-muted-foreground'
                }`}
              >
                <button
                  type="button"
                  title={`Open ${entry.title}`}
                  onClick={() => run(async () => onOpen(await loadDesign(entry.id, entry.title)))}
                  className="block w-full text-left"
                >
                  <div className="flex h-20 items-center justify-center bg-canvas">
                    {thumb ? (
                      <img src={thumb} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-[10.5px] text-canvas-muted-foreground">No preview</span>
                    )}
                  </div>
                  {renaming !== entry.id && (
                    <div className="truncate px-2.5 pt-2 text-[12px] font-semibold text-canvas-foreground">
                      {entry.title}
                    </div>
                  )}
                </button>
                {renaming === entry.id && (
                  <div className="px-1.5 pt-1.5">
                    <RenameField
                      name={entry.title}
                      onDone={(name) => {
                        setRenaming(null);
                        if (name)
                          run(async () => {
                            await renameDesign(entry.id, name);
                            onRenamed(entry.id, name);
                            refresh();
                          });
                      }}
                    />
                  </div>
                )}
                {confirmDelete === entry.id ? (
                  <div className="px-2.5 pb-2 pt-1.5 text-[11px]">
                    <div className="mb-1.5 text-canvas-muted-foreground">Delete this design?</div>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded border border-canvas-border px-2 py-0.5 hover:bg-canvas"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rounded bg-danger-strong/90 px-2 py-0.5 font-semibold text-white hover:bg-danger-strong"
                        onClick={() =>
                          run(async () => {
                            await catalogStorage.remove(DESIGNS_KIND, entry.id);
                            setConfirmDelete(null);
                            refresh();
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end px-1.5 py-1">
                    <button
                      type="button"
                      title="Rename"
                      onClick={() => setRenaming(entry.id)}
                      className="rounded-md p-1.5 text-canvas-muted-foreground hover:bg-canvas hover:text-canvas-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => setConfirmDelete(entry.id)}
                      className="rounded-md p-1.5 text-canvas-muted-foreground hover:bg-canvas hover:text-canvas-foreground"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
