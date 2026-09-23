'use client';

import { catalogStorage } from '@academy/core';
import type { AcademyCatalogEntry } from '@academy/validation';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DESIGNS_KIND, designThumb, loadDesign } from './image-constructor-designs.js';
import type { ICLayout } from './image-constructor-layout.js';
import { ipcErrorMessage } from './playground-library.js';

/** Designs saved to the library, above the template pack. Opening one replaces the canvas; undo brings it back. */
export function MyDesignsSection({
  activeId,
  onOpen,
}: {
  activeId: string | undefined;
  onOpen: (layout: ICLayout) => void;
}) {
  const [available, setAvailable] = useState(false);
  const [entries, setEntries] = useState<AcademyCatalogEntry[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    catalogStorage
      .list(DESIGNS_KIND)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  // Refreshes on mount, so each visit to the Templates tab shows a design saved a moment ago.
  useEffect(() => {
    const ok = catalogStorage.available();
    setAvailable(ok);
    if (ok) refresh();
  }, [refresh]);

  if (!available || entries.length === 0) return null;

  const run = (fn: () => Promise<void>) => {
    setError(null);
    fn().catch((err) => setError(ipcErrorMessage(err)));
  };

  return (
    <div className="mb-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70">
        My designs
      </div>
      {error && <div className="mb-2 text-[11px] text-red-300">{error}</div>}
      <div className="grid grid-cols-2 gap-2">
        {entries.map((entry) => {
          const thumb = designThumb(entry.preview);
          return (
            <div
              key={entry.id}
              className={`overflow-hidden rounded-xl border bg-canvas-muted ${
                activeId === entry.id
                  ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40'
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
                <div className="truncate px-2.5 pt-2 text-[12px] font-semibold text-canvas-foreground">{entry.title}</div>
              </button>
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
                      className="rounded bg-red-500/90 px-2 py-0.5 font-semibold text-white hover:bg-red-500"
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
    </div>
  );
}
