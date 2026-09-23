'use client';

import { X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  type BrandColors,
  type BrandKit,
  DEFAULT_BRAND_COLORS,
  LOGO_MAX_SIDE,
  makeBrandKit,
  rolesFrom,
} from './image-constructor-brand-kit.js';
import { IC_FONT_LIST, type ICFont } from './image-constructor-font-list.js';
import { IC_FONT_STACKS } from './image-constructor-layout.js';
import type { ICRole } from './image-constructor-palettes.js';
import { readImage } from './image-constructor-read-image.js';
import { ThemedSelect } from './themed-select.js';

const COLOR_FIELDS: { key: keyof BrandColors; label: string; hint: string }[] = [
  { key: 'bg', label: 'Background', hint: 'Behind everything' },
  { key: 'surface', label: 'Surface', hint: 'Cards and panels' },
  { key: 'ink', label: 'Text', hint: 'Headlines and body copy' },
  { key: 'accent', label: 'Accent', hint: 'Buttons, badges, highlights' },
];

const ROLE_LABELS: Record<ICRole, string> = {
  bg: 'Background',
  bg2: 'Background 2',
  panel: 'Panel',
  card: 'Card',
  ink: 'Text',
  muted: 'Muted text',
  accent: 'Accent',
  onAccent: 'Text on accent',
};

const FONT_OPTIONS = IC_FONT_LIST.map((f) => ({ value: f.id, label: `${f.label} · ${f.group}` }));

const HEX = /^#[0-9a-f]{6}$/i;

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="flex items-center gap-2.5">
      <input
        type="color"
        value={value}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        className="size-9 shrink-0 cursor-pointer rounded-lg border border-canvas-border bg-transparent"
        aria-label={label}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-canvas-foreground">{label}</div>
        <div className="text-[10.5px] text-canvas-muted-foreground">{hint}</div>
      </div>
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (HEX.test(e.target.value)) onChange(e.target.value.toLowerCase());
        }}
        onBlur={() => setDraft(value)}
        className="w-24 rounded-md border border-canvas-border bg-canvas px-2 py-1 font-mono text-[12px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
        aria-label={`${label} hex`}
      />
    </div>
  );
}

/** Enter a brand by hand and review what every design role becomes before saving. */
export function BrandKitEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: BrandKit | null;
  onCancel: () => void;
  onSave: (kit: BrandKit) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [colors, setColors] = useState<BrandColors>(initial?.colors ?? DEFAULT_BRAND_COLORS);
  const [heading, setHeading] = useState<ICFont>(initial?.fonts.heading ?? 'grotesk');
  const [body, setBody] = useState<ICFont>(initial?.fonts.body ?? 'sans');
  const [logo, setLogo] = useState(initial?.logo ? { url: initial.logo, ratio: initial.logoRatio } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { roles, notes } = useMemo(() => rolesFrom(colors), [colors]);

  const save = async () => {
    const title = name.trim();
    if (!title) return setError('Give the kit a name.');
    setBusy(true);
    setError(null);
    try {
      await onSave(makeBrandKit(initial?.id ?? crypto.randomUUID(), title, colors, { heading, body }, logo));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const input =
    'w-full rounded-lg border border-canvas-border bg-canvas px-2.5 py-2 text-[12.5px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60';
  const label = 'mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="flex max-h-[92vh] w-[880px] max-w-full flex-col overflow-hidden rounded-2xl border border-canvas-border bg-canvas-muted font-mono text-canvas-foreground shadow-2xl">
        <div className="flex items-center gap-2 border-b border-canvas-border px-5 py-3.5">
          <div className="text-sm font-semibold">{initial ? 'Edit brand kit' : 'New brand kit'}</div>
          <div className="text-[11.5px] text-canvas-muted-foreground">Colors, fonts and a logo, applied to any design</div>
          <button type="button" onClick={onCancel} className="ml-auto text-canvas-muted-foreground hover:text-canvas-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr] overflow-y-auto">
          <div className="space-y-5 border-r border-canvas-border p-5">
            <div>
              <div className={label}>Name</div>
              <input
                // biome-ignore lint/a11y/noAutofocus: the editor opens to name the kit
                autoFocus
                value={name}
                maxLength={80}
                placeholder="e.g. Acme"
                onChange={(e) => setName(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <div className={label}>Colors</div>
              <div className="space-y-2.5">
                {COLOR_FIELDS.map((f) => (
                  <ColorField
                    key={f.key}
                    label={f.label}
                    hint={f.hint}
                    value={colors[f.key]}
                    onChange={(v) => setColors((c) => ({ ...c, [f.key]: v }))}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={label}>Heading font</div>
                <ThemedSelect value={heading} options={FONT_OPTIONS} onChange={(v) => setHeading(v as ICFont)} />
              </div>
              <div>
                <div className={label}>Body font</div>
                <ThemedSelect value={body} options={FONT_OPTIONS} onChange={(v) => setBody(v as ICFont)} />
              </div>
            </div>
            <div>
              <div className={label}>Logo</div>
              <div className="flex items-center gap-2.5">
                <div className="flex size-14 items-center justify-center rounded-lg border border-canvas-border bg-canvas">
                  {logo ? (
                    <img src={logo.url} alt="Logo" className="max-h-12 max-w-12 object-contain" />
                  ) : (
                    <span className="text-[10.5px] text-canvas-muted-foreground">None</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-md border border-canvas-border px-2.5 py-1.5 text-[12px] hover:bg-canvas"
                >
                  {logo ? 'Replace' : 'Upload'}
                </button>
                {logo && (
                  <button
                    type="button"
                    onClick={() => setLogo(null)}
                    className="rounded-md border border-canvas-border px-2.5 py-1.5 text-[12px] hover:bg-canvas"
                  >
                    Remove
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    const picked = await readImage(file, LOGO_MAX_SIDE).catch(() => null);
                    if (picked) setLogo({ url: picked.url, ratio: picked.ratio });
                    else setError('That file is not an image.');
                  }}
                />
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-canvas-muted-foreground">
                The logo fills any layer slotted <span className="text-canvas-foreground">logo</span>. Add one from
                the kit card.
              </p>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <div className={label}>Preview</div>
              <div className="overflow-hidden rounded-xl border border-canvas-border" style={{ background: roles.bg }}>
                <div className="flex items-center gap-2 px-4 pt-4">
                  {logo && <img src={logo.url} alt="" className="h-6 object-contain" />}
                  <span className="text-[11px]" style={{ color: roles.muted, fontFamily: IC_FONT_STACKS[body] }}>
                    {name.trim() || 'Your brand'}
                  </span>
                </div>
                <div className="px-4 pb-2 pt-3 text-[26px] font-bold leading-tight" style={{ color: roles.ink, fontFamily: IC_FONT_STACKS[heading] }}>
                  Big news, shipped.
                </div>
                <div className="px-4 text-[12.5px]" style={{ color: roles.muted, fontFamily: IC_FONT_STACKS[body] }}>
                  Body copy in your text color, faded for secondary lines.
                </div>
                <div className="m-4 flex items-center justify-between rounded-lg p-3" style={{ background: roles.card }}>
                  <span className="text-[12px]" style={{ color: roles.ink, fontFamily: IC_FONT_STACKS[body] }}>
                    A card on the surface color
                  </span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: roles.accent, color: roles.onAccent, fontFamily: IC_FONT_STACKS[body] }}
                  >
                    Accent
                  </span>
                </div>
              </div>
            </div>
            <div>
              <div className={label}>What each design role becomes</div>
              <div className="space-y-1.5">
                {(Object.keys(ROLE_LABELS) as ICRole[]).map((role) => (
                  <div key={role} className="flex items-center gap-2.5 text-[11.5px]">
                    <span className="size-5 shrink-0 rounded border border-canvas-border" style={{ background: roles[role] }} />
                    <span className="w-28 shrink-0 text-canvas-foreground">{ROLE_LABELS[role]}</span>
                    <span className="truncate text-canvas-muted-foreground">{notes[role] ?? 'Your pick'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-canvas-border px-5 py-3">
          {error && <div className="mr-auto text-[12px] text-red-300">{error}</div>}
          <button type="button" onClick={onCancel} className="rounded-md border border-canvas-border px-3 py-1.5 text-[12.5px] hover:bg-canvas">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="rounded-md bg-emerald-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? 'Saving…' : initial ? 'Save kit' : 'Save and apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
