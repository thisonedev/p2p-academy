'use client';

import { catalogStorage } from '@academy/core';
import type { AcademyCatalogEntry } from '@academy/validation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  BRAND_KITS_KIND,
  type BrandKit,
  brandKitPreview,
  parseBrandKit,
} from './image-constructor-brand-kit.js';
import { BrandKitEditor } from './image-constructor-brand-kit-editor.js';
import { BUILTIN_KITS } from './image-constructor-brand-builtin.js';

export interface BrandKitsApi {
  activeKitId: string | undefined;
  applyBrandKit: (kit: BrandKit) => void;
  addLogo: (kit: BrandKit) => void;
}

const previewColors = (entry: AcademyCatalogEntry): string[] => {
  const colors = (entry.preview as { colors?: unknown } | null)?.colors;
  return Array.isArray(colors) ? colors.filter((c): c is string => typeof c === 'string') : [];
};

async function loadKit(id: string): Promise<BrandKit> {
  const kit = parseBrandKit(await catalogStorage.get(BRAND_KITS_KIND, id));
  if (!kit) throw new Error('This brand kit could not be read.');
  return kit;
}

/** Saved brand kits, above the color kits in the Brand Kits tab. */
export function BrandKitsSection({ api }: { api: BrandKitsApi }) {
  const [available, setAvailable] = useState(false);
  const [entries, setEntries] = useState<AcademyCatalogEntry[]>([]);
  const [editing, setEditing] = useState<BrandKit | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    catalogStorage
      .list(BRAND_KITS_KIND)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    const ok = catalogStorage.available();
    setAvailable(ok);
    if (ok) refresh();
  }, [refresh]);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    fn().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  const save = async (kit: BrandKit) => {
    await catalogStorage.save(BRAND_KITS_KIND, kit.id, kit.name, kit, brandKitPreview(kit));
    // A new kit goes straight onto the design; an edited one refreshes it only if it's the one in use.
    if (editing === 'new' || api.activeKitId === kit.id) api.applyBrandKit(kit);
    setEditing(null);
    refresh();
  };

  const small =
    'flex items-center justify-center rounded-md p-1.5 text-canvas-muted-foreground hover:bg-canvas hover:text-canvas-foreground';

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70">
          My Brand Kits
        </div>
        {available && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex items-center gap-1 rounded-md border border-canvas-border px-2 py-1 text-[11px] text-canvas-foreground hover:bg-canvas"
          >
            <Plus className="size-3" /> New
          </button>
        )}
      </div>

      {!available && (
        <p className="text-[11px] leading-relaxed text-canvas-muted-foreground">
          Brand kits are saved in the desktop app.
        </p>
      )}
      {available && entries.length === 0 && (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="w-full rounded-xl border border-dashed border-canvas-border px-3 py-4 text-center text-[11.5px] text-canvas-muted-foreground hover:border-canvas-muted-foreground"
        >
          Save your brand's colors, fonts and logo once, then apply them to any design.
        </button>
      )}
      {error && <div className="mb-2 text-[11px] text-red-300">{error}</div>}

      <div className="grid grid-cols-2 gap-2">
        {entries.map((entry) => {
          const active = api.activeKitId === entry.id;
          return (
            <div
              key={entry.id}
              className={`overflow-hidden rounded-xl border bg-canvas-muted ${
                active ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40' : 'border-canvas-border hover:border-canvas-muted-foreground'
              }`}
            >
              <button
                type="button"
                title={`Apply ${entry.title}`}
                onClick={() => run(async () => api.applyBrandKit(await loadKit(entry.id)))}
                className="block w-full text-left"
              >
                <div className="flex h-9">
                  {previewColors(entry).map((c, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a kit may repeat a color
                    <span key={i} className="flex-1" style={{ background: c }} />
                  ))}
                </div>
                <div className="truncate px-2.5 pt-2 text-[12px] font-semibold text-canvas-foreground">{entry.title}</div>
              </button>
              {confirmDelete === entry.id ? (
                <div className="px-2.5 pb-2 pt-1.5 text-[11px]">
                  <div className="mb-1.5 text-canvas-muted-foreground">Delete this kit?</div>
                  <div className="flex justify-end gap-1">
                    <button type="button" className="rounded border border-canvas-border px-2 py-0.5 hover:bg-canvas" onClick={() => setConfirmDelete(null)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded bg-red-500/90 px-2 py-0.5 font-semibold text-white hover:bg-red-500"
                      onClick={() =>
                        run(async () => {
                          await catalogStorage.remove(BRAND_KITS_KIND, entry.id);
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
                <div className="flex items-center gap-0.5 px-1.5 py-1">
                  <button
                    type="button"
                    title="Place the kit's logo on the design"
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-canvas-muted-foreground hover:bg-canvas hover:text-canvas-foreground"
                    onClick={() =>
                      run(async () => {
                        const kit = await loadKit(entry.id);
                        if (!kit.logo) throw new Error(`${kit.name} has no logo yet. Edit the kit to add one.`);
                        api.addLogo(kit);
                      })
                    }
                  >
                    <Plus className="size-3" /> Logo
                  </button>
                  <button type="button" title="Edit" className={small} onClick={() => run(async () => setEditing(await loadKit(entry.id)))}>
                    <Pencil className="size-3.5" />
                  </button>
                  <button type="button" title="Delete" className={`${small} ml-auto`} onClick={() => setConfirmDelete(entry.id)}>
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70">
        Built-in
      </div>
      <div className="grid grid-cols-2 gap-2">
        {BUILTIN_KITS.map((kit) => (
          <div
            key={kit.id}
            className={`overflow-hidden rounded-xl border bg-canvas-muted ${
              api.activeKitId === kit.id ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40' : 'border-canvas-border hover:border-canvas-muted-foreground'
            }`}
          >
            <button type="button" title={`Apply ${kit.name}`} onClick={() => api.applyBrandKit(kit)} className="block w-full text-left">
              <div className="flex h-9">
                {brandKitPreview(kit).colors.map((c, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a kit may repeat a color
                  <span key={i} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <div className="truncate px-2.5 pt-2 text-[12px] font-semibold text-canvas-foreground">{kit.name}</div>
            </button>
            <div className="flex items-center px-1.5 py-1">
              <button
                type="button"
                title="Place the kit's logo on the design"
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-canvas-muted-foreground hover:bg-canvas hover:text-canvas-foreground"
                onClick={() => api.addLogo(kit)}
              >
                <Plus className="size-3" /> Logo
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <BrandKitEditor initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSave={save} />
      )}
    </div>
  );
}
