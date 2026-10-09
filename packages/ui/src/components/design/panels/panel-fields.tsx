'use client';

import { Minus, Plus } from 'lucide-react';
import { useState, useEffect, type ComponentType } from 'react';
import { Segments } from './segments.js';
import { SegmentButton } from '../../ui/segment-group.js';
import { SMALL } from './panel-shared.js';

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-2.5">
      <Segments
        options={options.map(([key, label]) => ({
          key,
          label,
          on: value === key,
          onPick: () => onChange(key),
        }))}
      />
    </div>
  );
}

/** Font size as minus, the size in pixels at the 1080 wide design, and plus. */
export function SizeStepper({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  const px = Math.round(value * 10.8);
  const set = (next: number) => onChange(Math.min(648, Math.max(16, next)) / 10.8);
  const [draft, setDraft] = useState(String(px));
  useEffect(() => setDraft(String(px)), [px]);
  const step =
    'flex size-7 items-center justify-center text-canvas-muted-foreground hover:text-canvas-foreground';
  return (
    <div className="flex h-7 items-center rounded-md border border-canvas-border" title="Font size">
      <button type="button" aria-label="Smaller" className={step} onClick={() => set(px - 1)}>
        <Minus className="size-3.5" />
      </button>
      <input
        aria-label="Font size"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={() => (draft ? set(Number(draft)) : setDraft(String(px)))}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="h-full w-10 border-x border-canvas-border bg-transparent text-center text-[12px] text-canvas-foreground focus:outline-none"
      />
      <button type="button" aria-label="Bigger" className={step} onClick={() => set(px + 1)}>
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    // The name shows on hover, so the bar stays on one row.
    <input
      type="color"
      title={label}
      aria-label={label}
      value={value || '#000000'}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-8 cursor-pointer rounded-md border border-canvas-border bg-canvas p-0.5"
    />
  );
}

/** One of the bold, italic and underline toggles, sharing a frame like the alignment buttons. */
export function FormatToggle({
  icon: Icon,
  title,
  on,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <SegmentButton on={on} lit="canvas" className="p-1" title={title} aria-label={title} onClick={onClick}>
      <Icon className="size-3.5" />
    </SegmentButton>
  );
}

export function BoxIconButton({
  icon: Icon,
  title,
  active,
  disabled,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`${SMALL} px-2 ${active ? 'border-primary text-primary-soft' : ''}`}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

export function SwatchRow({
  colors,
  value,
  onChange,
}: {
  colors: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{ background: c }}
          className={`size-5 rounded-full border-2 ${value === c ? 'border-primary' : 'border-transparent'}`}
        />
      ))}
    </div>
  );
}

export function ChipRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Segments
      cols={3}
      options={options.map((o) => ({
        key: o,
        label: o.charAt(0).toUpperCase() + o.slice(1),
        on: value === o,
        onPick: () => onChange(o),
      }))}
    />
  );
}

/** A slider that fills its row, with the value beside it. */
export function Slider({
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1"
      />
      <span className="w-9 text-right text-[11px] text-canvas-muted-foreground">
        {Math.round(value)}
        {unit}
      </span>
    </>
  );
}

/** Width as a slider, kept centered, plus a fit for layers wider than the canvas, whose handles can
 *  sit out of reach. Boxes that also have a height scale with it, so the shape keeps its proportions. */
/** A pixel value with a one-letter label, like Figma's X, Y, W and H. Enter or leaving it applies it. */
export function NumberField({
  label,
  value,
  onCommit,
  disabled,
  title,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  disabled?: boolean;
  title?: string;
}) {
  const shown = String(Math.round(value));
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  const commit = () => {
    const v = Number(draft);
    if (draft.trim() && Number.isFinite(v) && v !== Math.round(value)) onCommit(v);
    else setDraft(shown);
  };
  return (
    <label
      title={title}
      className={`flex h-7 items-center gap-1.5 rounded-md border border-canvas-border bg-canvas px-2 text-[12px] ${disabled ? 'opacity-50' : ''}`}
    >
      <span className="text-canvas-muted-foreground">{label}</span>
      <input
        value={draft}
        disabled={disabled}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.-]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            onCommit(Math.round(value) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-canvas-foreground focus:outline-none"
      />
    </label>
  );
}
