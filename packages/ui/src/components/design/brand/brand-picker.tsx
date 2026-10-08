'use client';

import { catalogStorage } from '@academy/core';
import type { AcademyCatalogEntry } from '@academy/validation';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ANNOUNCE_BRANDS, BRAND_GROUPS, brandOfKit } from '../templates/announce.js';
import {
  BRAND_KITS_KIND,
  type BrandKit,
  brandKitPreview,
  parseBrandKit,
} from './brand-kit.js';
import { BrandKitEditor } from './brand-kit-editor.js';
import type { ICLayout } from '../render/layout.js';
import { findPalette, PALETTES } from './palettes.js';
import { Dots, PickerAction } from '../panels/picker.js';
import { findTemplate } from '../templates/templates.js';
import { Dropdown } from '../../ui/dropdown.js';

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
  if (!kit) throw new Error('This UI kit could not be read.');
  return kit;
}

/** The one place to choose the design's colors: saved brands, built-in brands, or a palette. */
export function BrandPicker({ api }: { api: BrandPickerApi }) {
  const { layout } = api;
  const [available, setAvailable] = useState(false);
  const [entries, setEntries] = useState<AcademyCatalogEntry[]>([]);
  const [editing, setEditing] = useState<BrandKit | 'new' | null>(null);
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
    if (editing === 'new' || activeKitId === kit.id) api.applyBrandKit(kit);
    setEditing(null);
    refresh();
  };

  const current = layout.templateId === 'blank' ? undefined : findTemplate(layout.templateId);
  const palette = findPalette(layout.palette ?? undefined);
  // The applied kit wins over the template's own brand, so one of your kits shows by its name.
  const kitBrand = brandOfKit(activeKitId);
  const brand =
    palette || (layout.kit && !kitBrand)
      ? undefined
      : ANNOUNCE_BRANDS.find((b) => b.id === (kitBrand ?? current?.brand));
  const ownKit = !palette && !brand && layout.kit ? layout.kit : undefined;
  const shown = palette
    ? { name: palette.name, colors: palette.colors.slice(0, 2) }
    : brand
      ? { name: brand.name, colors: [brand.kit.roles.bg, brand.kit.roles.accent] }
      : ownKit
        ? { name: ownKit.name, colors: [ownKit.roles.bg, ownKit.roles.accent] }
        : { name: 'None', colors: [] };

  return (
    <>
      <Dropdown
        wide
        value={shown.name}
        lead={shown.colors.length ? <Dots colors={shown.colors} /> : undefined}
        sections={[
          ...(entries.length
            ? [
                {
                  title: 'My UI kits',
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
          ...BRAND_GROUPS.map(({ title, brands }) => ({
            title,
            items: brands.map((b) => ({
              id: b.id,
              label: b.name,
              lead: <Dots colors={[b.kit.roles.bg, b.kit.roles.accent]} />,
              on: brand?.id === b.id,
              onPick: () => api.pickBrand(b.id),
            })),
          })),
          {
            title: 'Popular',
            items: [
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
        header={
          available
            ? (close) => (
                <PickerAction
                  onClick={() => {
                    close();
                    setEditing('new');
                  }}
                >
                  <Plus className="size-3.5" /> New UI kit…
                </PickerAction>
              )
            : undefined
        }
        footer={
          !available
            ? () => (
                <div className="px-3 py-2 text-[11px] text-canvas-muted-foreground">
                  Saving your own UI kits works in the desktop app.
                </div>
              )
            : error
              ? () => <div className="px-3 py-1.5 text-[11px] text-red-300">{error}</div>
              : undefined
        }
      />
      {editing && (
        <BrandKitEditor
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}
