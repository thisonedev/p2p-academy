'use client';

import { Scaling } from 'lucide-react';
import { useState, useRef } from 'react';
import { supportedOrientations, orientationOf, RATIO_LABELS } from '../render/layout.js';
import { PlatformIcon } from './platform-icon.js';
import { findTemplate } from '../templates/templates.js';
import { useOutsidePress } from '../../../hooks/use-outside-press.js';
import type { StudioApi } from './studio-api.js';
import { fieldClass } from '../../ui/field.js';

/** The canvas size, in the brand bar. A custom size takes a width and height at the bottom of the list. */
/** The four post sizes for the studio's top bar, each as the icon the Export sheet gives it and
 *  the size of the bar's other buttons. One click changes the design's size from any tab. A
 *  fifth button after them opens a width and height for a size of the person's own. */
const FORMATS = [
  ['x-post', 'x'],
  ['ig-post', 'instagram'],
  ['linkedin-post', 'linkedin'],
  ['story', 'story'],
] as const;

export function FormatChips({ api }: { api: StudioApi }) {
  const { layout } = api;
  const template = findTemplate(layout.templateId);
  const supported = supportedOrientations(template);
  const ratio = layout.ratio ?? '1:1';
  const [open, setOpen] = useState(false);
  const [w, setW] = useState(layout.customSize?.width ?? 1500);
  const [h, setH] = useState(layout.customSize?.height ?? 500);
  const holder = useRef<HTMLDivElement>(null);
  useOutsidePress(holder, () => setOpen(false), { active: open });
  // The same limits as an export's own custom size.
  const size = (value: number) => Math.min(8000, Math.max(64, Math.round(value) || 64));
  const field = fieldClass('sm', 'w-20');
  return (
    <div ref={holder} className="relative flex items-center gap-1">
      {FORMATS.map(([value, app]) => {
        // A blank canvas has nothing that could conflict with a size, so every one stays enabled.
        const ok = layout.templateId === 'blank' || supported.has(orientationOf(value));
        return (
          <button
            key={value}
            type="button"
            aria-pressed={ratio === value}
            disabled={!ok}
            title={
              ok
                ? RATIO_LABELS[value]
                : `${RATIO_LABELS[value]}. ${template.title} has no layout for this size yet`
            }
            aria-label={RATIO_LABELS[value]}
            onClick={() => api.setRatio(value)}
            className={`rounded p-1 disabled:cursor-not-allowed disabled:opacity-40 ${
              ratio === value
                ? 'text-primary'
                : 'text-canvas-muted-foreground hover:text-canvas-foreground'
            }`}
          >
            <PlatformIcon app={app} />
          </button>
        );
      })}
      <button
        type="button"
        aria-pressed={ratio === 'custom'}
        aria-expanded={open}
        title={
          ratio === 'custom' && layout.customSize
            ? `Custom size, ${layout.customSize.width}×${layout.customSize.height}`
            : 'Custom size'
        }
        aria-label="Custom size"
        onClick={() => setOpen(!open)}
        className={`rounded p-1 ${
          ratio === 'custom'
            ? 'text-primary'
            : 'text-canvas-muted-foreground hover:text-canvas-foreground'
        }`}
      >
        <Scaling className="size-4" />
      </button>
      {open && (
        <form
          className="absolute left-1/2 top-full z-40 mt-2 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-raised p-2 text-label shadow-xl"
          onSubmit={(e) => {
            e.preventDefault();
            api.setCustomSize(size(w), size(h));
            setOpen(false);
          }}
        >
          <input
            type="number"
            min={64}
            max={8000}
            value={w}
            aria-label="Width"
            onChange={(e) => setW(Number(e.target.value))}
            className={field}
          />
          <span className="text-canvas-muted-foreground">×</span>
          <input
            type="number"
            min={64}
            max={8000}
            value={h}
            aria-label="Height"
            onChange={(e) => setH(Number(e.target.value))}
            className={field}
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-2.5 py-1 font-semibold text-primary-foreground hover:bg-primary"
          >
            Set
          </button>
        </form>
      )}
    </div>
  );
}
