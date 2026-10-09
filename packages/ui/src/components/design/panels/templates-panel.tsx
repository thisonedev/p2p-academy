'use client';

import { useState, useEffect } from 'react';
import { brandOfKit, ANNOUNCE_BRANDS } from '../templates/announce.js';
import type { BrandKit } from '../brand/brand-kit.js';
import { Dropdown } from '../../ui/dropdown.js';
import { MyDesignsSection } from '../studio/my-designs.js';
import {
  type ICLayout,
  type ICTemplate,
  layoutFromTemplate,
  applyPalette,
  applyBrandKit,
  ratioHeight,
} from '../render/layout.js';
import { composeLayout } from '../render/render.js';
import { findTemplate, TEMPLATE_PACKS, ALL_TEMPLATES } from '../templates/templates.js';
import type { StudioApi } from './studio-api.js';
import { LABEL } from './panel-shared.js';

const previews = new Map<string, Promise<string>>();

/** The template itself drawn at its X size, once per session. */
/** A palette or custom UI kit the template thumbnails are drawn in, like the design they'd open into. */
export interface ThumbLook {
  palette?: string;
  kit?: BrandKit;
}

/** What a thumbnail look should be for a design: its palette, or its own kit when that isn't a
 *  built-in brand (those already list their own templates). */
export const thumbLookOf = (layout: ICLayout): ThumbLook | undefined =>
  layout.palette
    ? { palette: layout.palette }
    : layout.kit && !brandOfKit(layout.kit.id)
      ? { kit: layout.kit }
      : undefined;

const lookKey = (look?: ThumbLook) =>
  look?.palette ??
  (look?.kit ? JSON.stringify([look.kit.roles, look.kit.fonts, look.kit.elements]) : '');

export function templatePreview(t: ICTemplate, look?: ThumbLook): Promise<string> {
  const key = `${t.id}|${lookKey(look)}`;
  let pending = previews.get(key);
  if (!pending) {
    const base = layoutFromTemplate(t, undefined, undefined, t.ratio);
    const styled = look?.palette
      ? applyPalette(base, look.palette)
      : look?.kit
        ? applyBrandKit(base, look.kit)
        : base;
    pending = composeLayout(styled, null, { width: 480, format: 'jpeg', quality: 0.85 });
    previews.set(key, pending);
  }
  return pending;
}

function RenderedThumb({ template, look }: { template: ICTemplate; look?: ThumbLook }) {
  const [url, setUrl] = useState<string | null>(null);
  const key = lookKey(look);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `look`, which is a new object each render
  useEffect(() => {
    let live = true;
    templatePreview(template, look)
      .then((u) => live && setUrl(u))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [template, key]);
  return (
    // The card takes the preview's own X shape, so the design is shown whole, never cropped.
    <div className="relative" style={{ background: template.thumb, aspectRatio: '16 / 9' }}>
      {/* biome-ignore lint/performance/noImgElement: a local data URL */}
      {url && <img src={url} alt="" className="absolute inset-0 size-full" />}
    </div>
  );
}

function Thumb({ template, look }: { template: ICTemplate; look?: ThumbLook }) {
  if (template.kit) return <RenderedThumb template={template} look={look} />;
  const rh = ratioHeight(template.ratio);
  const subjectRatio = template.subject?.ratio ?? 0.625;
  return (
    // A fixed card shape, not derived from the template's own ratio (user: cards were
    // different heights, Blank's square 1:1 next to Catalog's 3:4). Every element inside
    // still positions off the template's real `rh`, so a real template's own schematic
    // preview keeps its correct relative proportions inside this uniform frame.
    <div className="relative" style={{ background: template.thumb, aspectRatio: '3 / 2' }}>
      {template.els
        .filter((e) => e.t !== 'line')
        .map((e) => (
          <i
            key={e.id}
            className={`absolute block rounded-[2px] ${e.t === 'subject' ? 'bg-primary-soft/80' : e.t === 'shape' || e.t === 'image' ? 'bg-white/25' : 'bg-white/70'}`}
            style={{
              left: `${e.x}%`,
              top: `${e.y}%`,
              width: `${e.t === 'text' ? Math.min(e.w, 40) : e.w}%`,
              height:
                e.t === 'subject'
                  ? `${e.w / subjectRatio / rh}%`
                  : e.t === 'pill' || e.t === 'shape' || (e.t === 'image' && e.h !== undefined)
                    ? `${e.h}%`
                    : '3%',
              transform: e.rot ? `rotate(${e.rot}deg)` : undefined,
            }}
          />
        ))}
    </div>
  );
}

export function TemplatesPanel({ api }: { api: StudioApi }) {
  const look = thumbLookOf(api.layout);
  // Opens on the current design's type, and follows it when the design moves to another one.
  const openId = api.layout.thread?.root ?? api.layout.templateId;
  // A list template's id carries its item setup; the picker lists the template itself.
  const openBase = openId.split('~')[0];
  const current = openId === 'blank' ? undefined : findTemplate(openId);
  const [pack, setPack] = useState(() => current?.pack ?? TEMPLATE_PACKS[0]);
  useEffect(() => {
    if (current?.pack) setPack(current.pack);
  }, [current?.pack]);
  const brandId = current?.brand ?? brandOfKit(api.layout.kit?.id) ?? ANNOUNCE_BRANDS[0].id;
  const listed = (t: ICTemplate, p: string) =>
    t.pack === p && !t.hidden && (!t.brand || t.brand === brandId);
  const count = (p: string) => ALL_TEMPLATES.filter((t) => listed(t, p)).length;
  const shown = ALL_TEMPLATES.filter((t) => listed(t, pack));
  return (
    <div>
      <Dropdown
        wide
        label="Type"
        value={pack}
        sections={[
          {
            items: TEMPLATE_PACKS.map((p) => ({
              id: p,
              label: p,
              right: String(count(p)),
              on: pack === p,
              onPick: () => setPack(p),
            })),
          },
        ]}
      />
      <div className="mt-4">
        <MyDesignsSection
          activeId={api.layout.saved?.id}
          saved={api.layout.saved}
          onOpen={(layout) => {
            api.update(() => layout);
            api.select(null);
          }}
          onRenamed={(id, name) =>
            api.update((l) => (l.saved?.id === id ? { ...l, saved: { id, name } } : l))
          }
        />
      </div>
      <div className={`${LABEL} flex gap-1.5`}>
        Built-in <span className="font-normal">{shown.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {shown.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => api.chooseTemplate(t)}
            className={`overflow-hidden rounded-xl border bg-canvas-muted text-left ${
              openBase === t.id
                ? 'border-primary'
                : 'border-canvas-border hover:border-canvas-muted-foreground'
            }`}
          >
            <Thumb template={t} look={look} />
            <div className="px-2.5 py-2 text-label font-semibold text-canvas-foreground">
              {t.title}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
