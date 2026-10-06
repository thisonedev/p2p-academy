'use client';

import { Plus, X } from 'lucide-react';
import { type CSSProperties, useMemo, useRef, useState } from 'react';
import {
  type BrandColors,
  type BrandElements,
  type BrandKit,
  type BrandType,
  DEFAULT_BRAND_COLORS,
  DEFAULT_BRAND_ELEMENTS,
  DEFAULT_BRAND_TYPE,
  LOGO_MAX_SIDE,
  makeBrandKit,
} from './design-brand-kit.js';
import type { ButtonLook } from './design-buttons.js';
import { IC_FONT_LIST, type ICFont } from './design-font-list.js';
import { IC_FONT_STACKS } from './design-layout.js';
import type { ICRoles } from './design-palettes.js';
import { readImage } from './design-read-image.js';
import { KitSheet } from './design-kit-sheet.js';
import { ThemedSelect } from './themed-select.js';

const COLOR_FIELDS: { key: keyof BrandColors; label: string; hint: string }[] = [
  { key: 'bg', label: 'Background', hint: 'Behind everything' },
  { key: 'surface', label: 'Surface', hint: 'Cards and panels' },
  { key: 'ink', label: 'Text', hint: 'Headlines and body copy' },
  { key: 'accent', label: 'Accent', hint: 'Buttons, badges, highlights' },
];

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

const WEIGHTS = [400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) }));
const MAX_EXTRA = 8;
const MAX_GRADIENTS = 4;

/** Square, rounded or fully round, as a CSS radius for a box `h` tall. */
const cornerRadius = (corners: BrandElements['corners'], h: number) =>
  corners === 'pill' ? h / 2 : corners === 'rounded' ? h * 0.28 : 3;

/** A color swatch that opens the system picker, with a remove button beside it. */
function Swatch({ value, onChange, onRemove }: { value: string; onChange: (v: string) => void; onRemove: () => void }) {
  return (
    <div className="group relative">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 cursor-pointer rounded-lg border border-canvas-border bg-transparent"
        aria-label={`Color ${value}`}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${value}`}
        className="absolute -right-1.5 -top-1.5 hidden rounded border border-canvas-border bg-canvas p-0.5 text-canvas-muted-foreground hover:text-canvas-foreground group-hover:block"
      >
        <X className="size-2.5" />
      </button>
    </div>
  );
}

/** A button in a look, drawn in HTML the way the canvas draws it: for the style guide and the
 *  Elements tab. */
export function PreviewButton({
  look,
  roles,
  corners,
  text,
  small,
}: {
  look: ButtonLook;
  roles: ICRoles;
  corners: BrandElements['corners'];
  text: string;
  small?: boolean;
}) {
  const h = small ? 24 : 34;
  const box = look !== 'bracket' && look !== 'link';
  const radius = look === 'soft' || look === 'dot' ? h / 2 : cornerRadius(corners, h);
  const style: CSSProperties = {
    borderRadius: box ? radius : 0,
    padding: box ? (small ? '4px 12px' : '8px 16px') : '4px 0',
    fontSize: small ? 11 : 12,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: look === 'solid' || look === 'offset' || look === 'tag' ? roles.onAccent : look === 'dot' ? roles.ink : roles.accent,
    background:
      look === 'solid' || look === 'offset' || look === 'tag'
        ? roles.accent
        : look === 'soft'
          ? `color-mix(in srgb, ${roles.accent} 16%, transparent)`
          : look === 'dot'
            ? `color-mix(in srgb, ${roles.ink} 8%, transparent)`
            : undefined,
    border: look === 'outline' ? `1.5px solid ${roles.accent}` : look === 'dot' ? `1px solid color-mix(in srgb, ${roles.ink} 14%, transparent)` : undefined,
    boxShadow: look === 'offset' ? `3px 3px 0 color-mix(in srgb, ${roles.accent} 40%, ${roles.bg})` : undefined,
    textDecoration: look === 'link' ? 'underline' : undefined,
    textUnderlineOffset: 4,
    whiteSpace: 'nowrap',
  };
  return (
    <span style={style}>
      {look === 'dot' && <span style={{ width: 7, height: 7, borderRadius: 9, background: roles.accent }} />}
      {look === 'tag' && <span style={{ opacity: 0.7 }}>+</span>}
      {look === 'bracket' ? `[ ${text} ]` : text}
      {look === 'link' && ' \u2192'}
    </span>
  );
}

/** Enter a brand by hand, as a style guide of colors, fonts and elements, and see it laid out. */
export function BrandKitEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: BrandKit | null;
  onCancel: () => void;
  onSave: (kit: BrandKit) => Promise<void>;
}) {
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? '');
  const [colors, setColors] = useState<BrandColors>(initial?.colors ?? DEFAULT_BRAND_COLORS);
  const [extra, setExtra] = useState<string[]>(initial?.extra ?? []);
  const [gradients, setGradients] = useState<[string, string][]>(initial?.gradients ?? []);
  const [heading, setHeading] = useState<ICFont>(initial?.fonts.heading ?? 'grotesk');
  const [body, setBody] = useState<ICFont>(initial?.fonts.body ?? 'sans');
  const [type, setType] = useState<BrandType>(initial?.type ?? DEFAULT_BRAND_TYPE);
  const [elements, setElements] = useState<BrandElements>(initial?.elements ?? DEFAULT_BRAND_ELEMENTS);
  const [logo, setLogo] = useState(initial?.logo ? { url: initial.logo, ratio: initial.logoRatio } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // The kit as it stands, so the sheet and its template examples show every edit.
  const kit = useMemo(
    () =>
      makeBrandKit(initial?.id ?? 'draft', name.trim() || 'Your Brand', colors, { heading, body }, logo, {
        extra: extra.length ? extra : undefined,
        gradients: gradients.length ? gradients : undefined,
        type,
        elements,
      }),
    [initial?.id, name, colors, heading, body, logo, extra, gradients, type, elements],
  );

  const save = async () => {
    const title = name.trim();
    if (!title) return setError('Give the kit a name.');
    setBusy(true);
    setError(null);
    try {
      await onSave(
        makeBrandKit(initial?.id ?? crypto.randomUUID(), title, colors, { heading, body }, logo, {
          extra: extra.length ? extra : undefined,
          gradients: gradients.length ? gradients : undefined,
          type,
          elements,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const input =
    'w-full rounded-lg border border-canvas-border bg-canvas px-2.5 py-2 text-[12.5px] text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/60';
  const label = 'mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70';
  const small = 'rounded-md border border-canvas-border px-2.5 py-1.5 text-[12px] hover:bg-canvas';
  const hf = IC_FONT_STACKS[heading];
  const bf = IC_FONT_STACKS[body];
  const group = 'space-y-3 border-b border-canvas-border px-5 py-4';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="flex max-h-[92vh] w-[1240px] max-w-full flex-col overflow-hidden rounded-2xl border border-canvas-border bg-canvas-muted font-mono text-canvas-foreground shadow-2xl">
        <div className="flex items-center gap-2 border-b border-canvas-border px-5 py-3.5">
          <div className="text-sm font-semibold">
            {editing ? 'Edit UI kit' : 'New UI kit'}
          </div>
          <button type="button" onClick={onCancel} className="ml-auto text-canvas-muted-foreground hover:text-canvas-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] overflow-hidden">
          <div className="min-h-0 overflow-y-auto border-r border-canvas-border">
            <div className={group}>
              <div className={label}>Identity</div>
              <div className="flex items-end gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className={label}>Name</div>
                  <input
                    // biome-ignore lint/a11y/noAutofocus: the editor opens to name the kit
                    autoFocus
                    value={name}
                    maxLength={80}
                    placeholder="e.g. Your Brand"
                    onChange={(e) => setName(e.target.value)}
                    className={input}
                  />
                </div>
                <button
                  type="button"
                  title={logo ? 'Replace the logo' : 'Upload a logo'}
                  onClick={() => fileRef.current?.click()}
                  className="flex size-[38px] shrink-0 items-center justify-center rounded-lg border border-canvas-border bg-canvas text-[10px] text-canvas-muted-foreground"
                >
                  {logo ? <img src={logo.url} alt="Logo" className="max-h-7 max-w-7 object-contain" /> : 'Logo'}
                </button>
                {logo && (
                  <button type="button" onClick={() => setLogo(null)} className={small}>
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
            </div>

            <div className={group}>
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
              <div>
                <div className={label}>More colors</div>
                <div className="flex flex-wrap gap-2">
                  {extra.map((c, i) => (
                    <Swatch
                      // biome-ignore lint/suspicious/noArrayIndexKey: two swatches can share a color
                      key={i}
                      value={c}
                      onChange={(v) => setExtra((xs) => xs.map((x, j) => (j === i ? v : x)))}
                      onRemove={() => setExtra((xs) => xs.filter((_, j) => j !== i))}
                    />
                  ))}
                  {extra.length < MAX_EXTRA && (
                    <button
                      type="button"
                      aria-label="Add a color"
                      onClick={() => setExtra((xs) => [...xs, colors.accent])}
                      className="flex size-9 items-center justify-center rounded-lg border border-dashed border-canvas-border text-canvas-muted-foreground hover:text-canvas-foreground"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <div className={label}>Gradients</div>
                <div className="space-y-2">
                  {gradients.map(([from, to], i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: gradients have no id of their own
                    <div key={i} className="flex items-center gap-2">
                      {[from, to].map((c, k) => (
                        <input
                          key={k}
                          type="color"
                          value={c}
                          aria-label={k ? 'Gradient end' : 'Gradient start'}
                          onChange={(e) =>
                            setGradients((gs) =>
                              gs.map((g, j) =>
                                j === i ? ((k ? [g[0], e.target.value] : [e.target.value, g[1]]) as [string, string]) : g,
                              ),
                            )
                          }
                          className="size-8 cursor-pointer rounded-lg border border-canvas-border bg-transparent"
                        />
                      ))}
                      <div className="h-8 flex-1 rounded-lg" style={{ background: `linear-gradient(90deg, ${from}, ${to})` }} />
                      <button
                        type="button"
                        aria-label="Remove gradient"
                        onClick={() => setGradients((gs) => gs.filter((_, j) => j !== i))}
                        className="text-canvas-muted-foreground hover:text-canvas-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {gradients.length < MAX_GRADIENTS && (
                    <button
                      type="button"
                      onClick={() => setGradients((gs) => [...gs, [colors.bg, colors.accent]])}
                      className={`${small} flex items-center gap-1`}
                    >
                      <Plus className="size-3" /> Add gradient
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={group}>
              <div className={label}>Type</div>
              <div>
                <div className="mb-1 text-[10.5px] text-canvas-muted-foreground">Headings</div>
                <div className="grid grid-cols-[1fr_84px] gap-2">
                  <ThemedSelect value={heading} options={FONT_OPTIONS} onChange={(v) => setHeading(v as ICFont)} />
                  <ThemedSelect
                    value={String(type.heading)}
                    options={WEIGHTS}
                    onChange={(v) => setType((t) => ({ ...t, heading: Number(v) }))}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10.5px] text-canvas-muted-foreground">Body</div>
                <div className="grid grid-cols-[1fr_84px] gap-2">
                  <ThemedSelect value={body} options={FONT_OPTIONS} onChange={(v) => setBody(v as ICFont)} />
                  <ThemedSelect
                    value={String(type.body)}
                    options={WEIGHTS}
                    onChange={(v) => setType((t) => ({ ...t, body: Number(v) }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto bg-black/30 p-5">
            <KitSheet
              kit={kit}
              name={name}
              logo={logo?.url ?? null}
              type={type}
              elements={elements}
              headingFont={hf}
              bodyFont={bf}
              onPickButton={(buttons) => setElements((el) => ({ ...el, buttons }))}
            />
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
            {busy ? 'Saving…' : editing ? 'Save kit' : 'Save and apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
