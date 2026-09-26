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
  rolesFrom,
} from './image-constructor-brand-kit.js';
import { BUTTON_LOOKS, type ButtonLook } from './image-constructor-buttons.js';
import { IC_FONT_LIST, type ICFont } from './image-constructor-font-list.js';
import { IC_FONT_STACKS } from './image-constructor-layout.js';
import type { ICRole, ICRoles } from './image-constructor-palettes.js';
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

const WEIGHTS = [400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) }));
const MAX_EXTRA = 8;
const MAX_GRADIENTS = 4;

type Section = 'colors' | 'fonts' | 'elements';

/** Square, rounded or fully round, as a CSS radius for a box `h` tall. */
const cornerRadius = (corners: BrandElements['corners'], h: number) =>
  corners === 'pill' ? h / 2 : corners === 'rounded' ? h * 0.28 : 3;

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-canvas-border p-0.5 text-[12px]">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex-1 rounded-md px-2 py-1 ${value === v ? 'bg-canvas text-canvas-foreground' : 'text-canvas-muted-foreground hover:text-canvas-foreground'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

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
        className="absolute -right-1.5 -top-1.5 hidden rounded-full border border-canvas-border bg-canvas p-0.5 text-canvas-muted-foreground hover:text-canvas-foreground group-hover:block"
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
  copy,
  onCancel,
  onSave,
}: {
  initial: BrandKit | null;
  /** `initial` is a built-in kit's copy: saving makes a new kit of the person's own. */
  copy?: boolean;
  onCancel: () => void;
  onSave: (kit: BrandKit) => Promise<void>;
}) {
  const editing = Boolean(initial) && !copy;
  const [section, setSection] = useState<Section>('colors');
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
  const { roles, notes } = useMemo(() => rolesFrom(colors), [colors]);

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
  const guideLabel = 'mb-2 text-[10px] font-semibold uppercase tracking-wide';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="flex max-h-[92vh] w-[980px] max-w-full flex-col overflow-hidden rounded-2xl border border-canvas-border bg-canvas-muted font-mono text-canvas-foreground shadow-2xl">
        <div className="flex items-center gap-2 border-b border-canvas-border px-5 py-3.5">
          <div className="text-sm font-semibold">
            {editing ? 'Edit brand kit' : copy ? `Customize ${initial?.name}` : 'New brand kit'}
          </div>
          <div className="text-[11.5px] text-canvas-muted-foreground">Colors, fonts and elements, applied to any design</div>
          <button type="button" onClick={onCancel} className="ml-auto text-canvas-muted-foreground hover:text-canvas-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[380px_1fr] overflow-y-auto">
          <div className="space-y-5 border-r border-canvas-border p-5">
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

            <Segmented<Section>
              value={section}
              options={[
                ['colors', 'Colors'],
                ['fonts', 'Fonts'],
                ['elements', 'Elements'],
              ]}
              onChange={setSection}
            />

            {section === 'colors' && (
              <>
                <div>
                  <div className={label}>Primary</div>
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
              </>
            )}

            {section === 'fonts' && (
              <>
                <div>
                  <div className={label}>Heading font</div>
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
                  <div className={label}>Body font</div>
                  <div className="grid grid-cols-[1fr_84px] gap-2">
                    <ThemedSelect value={body} options={FONT_OPTIONS} onChange={(v) => setBody(v as ICFont)} />
                    <ThemedSelect
                      value={String(type.body)}
                      options={WEIGHTS}
                      onChange={(v) => setType((t) => ({ ...t, body: Number(v) }))}
                    />
                  </div>
                </div>
                <p className="text-[10.5px] leading-relaxed text-canvas-muted-foreground">
                  Big lines take the heading font and weight, the rest the body&apos;s. Labels and other bold lines
                  keep their own weight.
                </p>
              </>
            )}

            {section === 'elements' && (
              <>
                <div>
                  <div className={label}>Corners</div>
                  <Segmented<BrandElements['corners']>
                    value={elements.corners}
                    options={[
                      ['square', 'Square'],
                      ['rounded', 'Rounded'],
                      ['pill', 'Round'],
                    ]}
                    onChange={(corners) => setElements((el) => ({ ...el, corners }))}
                  />
                </div>
                <div>
                  <div className={label}>Buttons</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {BUTTON_LOOKS.map(([look, text]) => (
                      <button
                        key={look}
                        type="button"
                        onClick={() => setElements((el) => ({ ...el, buttons: look }))}
                        className={`rounded-md border px-2 py-1.5 text-[12px] ${elements.buttons === look ? 'border-fuchsia-400 text-fuchsia-300' : 'border-canvas-border text-canvas-muted-foreground hover:text-canvas-foreground'}`}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10.5px] leading-relaxed text-canvas-muted-foreground">
                  Buttons and badges in the accent take this style and shape; square corners also square off cards.
                  The logo fills any layer slotted <span className="text-canvas-foreground">logo</span>.
                </p>
              </>
            )}
          </div>

          {/* The style guide: the kit laid out the way a brand book shows it. */}
          <div className="space-y-6 p-6" style={{ background: roles.bg, color: roles.ink }}>
            <div className="flex items-center gap-2">
              {logo && <img src={logo.url} alt="" className="h-6 object-contain" />}
              <span className="text-[13px] font-semibold" style={{ fontFamily: hf }}>
                {name.trim() || 'Your Brand'}
              </span>
              <span className="text-[11px]" style={{ color: roles.muted, fontFamily: bf }}>
                Style guide
              </span>
            </div>

            <section>
              <div className={guideLabel} style={{ color: roles.muted }}>
                Colors
              </div>
              <div className="flex flex-wrap gap-3">
                {[...COLOR_FIELDS.map((f) => [colors[f.key], f.label] as const), ...extra.map((c) => [c, ''] as const)].map(
                  ([c, text], i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: two swatches can share a color
                    <div key={i} className="w-16">
                      <div className="h-12 rounded-lg border" style={{ background: c, borderColor: roles.panel }} />
                      <div className="mt-1 text-[10px]" style={{ fontFamily: bf }}>
                        {text || 'Brand'}
                      </div>
                      <div className="text-[9.5px] uppercase" style={{ color: roles.muted }}>
                        {c}
                      </div>
                    </div>
                  ),
                )}
              </div>
              {gradients.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {gradients.map(([from, to], i) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: gradients have no id of their own
                      key={i}
                      className="h-10 w-36 rounded-lg"
                      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className={guideLabel} style={{ color: roles.muted }}>
                Fonts
              </div>
              <div className="mb-3 flex gap-3">
                {[
                  [hf, type.heading, 'Heading'],
                  [bf, type.body, 'Body'],
                ].map(([font, weight, text]) => (
                  <div key={text} className="w-24 rounded-lg p-3" style={{ background: roles.card }}>
                    <div className="text-[28px] leading-none" style={{ fontFamily: font as string, fontWeight: weight as number }}>
                      Aa
                    </div>
                    <div className="mt-2 text-[10px]" style={{ color: roles.muted }}>
                      {text}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: hf, fontWeight: type.heading }} className="space-y-1 leading-tight">
                <div className="text-[30px]">Big news, shipped</div>
                <div className="text-[22px]">A second-level heading</div>
                <div className="text-[17px]">A third-level heading</div>
              </div>
              <p className="mt-2 max-w-md text-[12.5px] leading-relaxed" style={{ fontFamily: bf, fontWeight: type.body, color: roles.muted }}>
                Body copy sits under the headings in the text color, faded for secondary lines.
              </p>
            </section>

            <section>
              <div className={guideLabel} style={{ color: roles.muted }}>
                Elements
              </div>
              <div className="flex flex-wrap items-center gap-3" style={{ fontFamily: bf }}>
                <PreviewButton look={elements.buttons} roles={roles} corners={elements.corners} text="Get started" />
                <PreviewButton look={elements.buttons} roles={roles} corners={elements.corners} text="New" small />
                <span
                  className="px-3 py-1 text-[11px]"
                  style={{ borderRadius: cornerRadius(elements.corners, 24), background: roles.card, color: roles.ink }}
                >
                  Tag
                </span>
              </div>
              <div
                className="mt-3 flex max-w-sm items-center justify-between p-4"
                style={{ background: roles.card, borderRadius: elements.corners === 'square' ? 3 : 12, fontFamily: bf }}
              >
                <div>
                  <div className="text-[13px]" style={{ fontFamily: hf, fontWeight: type.heading }}>
                    A card
                  </div>
                  <div className="text-[11px]" style={{ color: roles.muted }}>
                    On the surface color
                  </div>
                </div>
                <span className="size-8 rounded-full" style={{ background: roles.accent }} />
              </div>
            </section>
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
