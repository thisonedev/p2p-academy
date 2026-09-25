'use client';

import { catalogStorage } from '@academy/core';
import type { AcademyCatalogEntry } from '@academy/validation';
import { Pencil, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ANNOUNCE_BRANDS, brandOfKit } from './image-constructor-announce.js';
import {
  BRAND_KITS_KIND,
  type BrandKit,
  brandKitPreview,
  parseBrandKit,
} from './image-constructor-brand-kit.js';
import { BrandKitEditor } from './image-constructor-brand-kit-editor.js';
import type { ICLayout } from './image-constructor-layout.js';
import { PALETTES } from './image-constructor-palettes.js';
import { Dots, PickerAction, StudioPicker } from './image-constructor-picker.js';
import { findTemplate } from './image-constructor-templates.js';

export interface BrandPickerApi {
  layout: ICLayout;
  pickBrand: (brandId: string) => void;
  applyBrandKit: (kit: BrandKit) => void;
  setPalette: (id: string | null) => void;
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

/** The one place to choose the design's colors: saved brands, built-in brands, or a palette. */
export function BrandPicker({ api }: { api: BrandPickerApi }) {
  const { layout } = api;
  const [available, setAvailable] = useState(false);
  const [entries, setEntries] = useState<AcademyCatalogEntry[]>([]);
  const [editing, setEditing] = useState<BrandKit | 'new' | null>(null);
  // Set while editing a built-in brand's copy, which saves as a new kit and leaves the original alone.
  const [copy, setCopy] = useState(false);
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

  const activeKitId = layout.kit?.id;
  const save = async (kit: BrandKit) => {
    await catalogStorage.save(BRAND_KITS_KIND, kit.id, kit.name, kit, brandKitPreview(kit));
    // A new kit goes straight onto the design; an edited one refreshes it only if it's the one in use.
    if (editing === 'new' || copy || activeKitId === kit.id) api.applyBrandKit(kit);
    setEditing(null);
    setCopy(false);
    refresh();
  };

  const current = layout.templateId === 'blank' ? undefined : findTemplate(layout.templateId);
  const palette = PALETTES.find((p) => p.id === layout.palette);
  const brand = palette
    ? undefined
    : ANNOUNCE_BRANDS.find((b) => b.id === (current?.brand ?? brandOfKit(activeKitId)));
  const ownKit = !palette && !brand && layout.kit ? layout.kit : undefined;
  const shown = palette
    ? { name: palette.name, colors: palette.colors.slice(0, 2) }
    : brand
      ? { name: brand.name, colors: [brand.kit.roles.bg, brand.kit.roles.accent] }
      : ownKit
        ? { name: ownKit.name, colors: [ownKit.roles.bg, ownKit.roles.accent] }
        : { name: 'Template colors', colors: [] };

  return (
    <>
      <StudioPicker
        label="Brand"
        value={shown.name}
        lead={shown.colors.length ? <Dots colors={shown.colors} /> : undefined}
        sections={[
          ...(entries.length
            ? [
                {
                  title: 'My brands',
                  items: entries.map((entry) => ({
                    id: entry.id,
                    label: entry.title,
                    lead: <Dots colors={previewColors(entry).slice(0, 2)} />,
                    on: !palette && activeKitId === entry.id,
                    onPick: () => run(async () => api.applyBrandKit(await loadKit(entry.id))),
                    onEdit: () => run(async () => setEditing(await loadKit(entry.id))),
                    onRemove: () =>
                      run(async () => {
                        await catalogStorage.remove(BRAND_KITS_KIND, entry.id);
                        refresh();
                      }),
                  })),
                },
              ]
            : []),
          {
            title: 'Built-in',
            items: ANNOUNCE_BRANDS.map((b) => ({
              id: b.id,
              label: b.name,
              lead: <Dots colors={[b.kit.roles.bg, b.kit.roles.accent]} />,
              on: brand?.id === b.id,
              onPick: () => api.pickBrand(b.id),
            })),
          },
          {
            title: 'Colors only',
            note: 'keeps fonts and logo',
            items: [
              {
                id: 'template',
                label: 'Template colors',
                on: !layout.palette && !layout.kit,
                onPick: () => api.setPalette(null),
              },
              ...PALETTES.map((p) => ({
                id: p.id,
                label: p.name,
                lead: <Dots colors={p.colors.slice(0, 3)} />,
                on: palette?.id === p.id,
                onPick: () => api.setPalette(p.id),
              })),
            ],
          },
        ]}
        footer={(close) =>
          available ? (
            <>
              <PickerAction
                onClick={() => {
                  close();
                  setCopy(false);
                  setEditing('new');
                }}
              >
                <Plus className="size-3.5" /> New brand…
              </PickerAction>
              {brand && (
                <PickerAction
                  title={`Save a copy of ${brand.name} you can edit. The built-in brand stays as it is.`}
                  onClick={() => {
                    close();
                    setCopy(true);
                    setEditing({
                      ...brand.kit,
                      id: crypto.randomUUID(),
                      name: `${brand.name} (custom)`,
                    });
                  }}
                >
                  <Pencil className="size-3.5" /> Customize {brand.name}…
                </PickerAction>
              )}
              {error && <div className="px-3 py-1.5 text-[11px] text-red-300">{error}</div>}
            </>
          ) : (
            <div className="px-3 py-2 text-[11px] text-canvas-muted-foreground">
              Saving your own brands works in the desktop app.
            </div>
          )
        }
      />
      {editing && (
        <BrandKitEditor
          initial={editing === 'new' ? null : editing}
          copy={copy}
          onCancel={() => {
            setEditing(null);
            setCopy(false);
          }}
          onSave={save}
        />
      )}
    </>
  );
}
