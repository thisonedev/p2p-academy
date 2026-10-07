'use client';

import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import type { BrandElements, BrandKit, BrandType } from './design-brand-kit.js';
import { PreviewButton } from './design-brand-kit-editor.js';
import { BUTTON_LOOKS } from './design-buttons.js';
import { IC_FONT_LIST, type ICFont } from './design-font-list.js';
import { applyBrandKit, type ICRatio, layoutFromTemplate } from './design-layout.js';
import { contrast, mix } from './design-palettes.js';
import { canvasHeight, drawLayout, loadImages } from './design-render.js';
import { findTemplate } from './design-templates.js';

const fontName = (font: ICFont) => IC_FONT_LIST.find((f) => f.id === font)?.label ?? font;

/** Templates shown in the kit, one per size, so the kit is judged where it will be used. */
const EXAMPLES: [id: string, ratio: ICRatio, label: string][] = [
  ['announcement-launch', 'x-post', 'X Post'],
  ['announcement-milestone', 'ig-post', 'IG Post'],
  ['announcement-ama', 'story', 'Story'],
  ['info-growth', 'ig-post', 'IG Post'],
  ['announcement-news', 'x-post', 'X Post'],
  ['cobrand-glow', 'ig-post', 'IG Post'],
];

/** The kit laid out like a UI kit sheet: colors, type, every button style and the blocks designs use. */
export function KitSheet({
  kit,
  name,
  logo,
  type,
  elements,
  headingFont,
  bodyFont,
  onPickButton,
}: {
  /** The kit as it stands, for the template examples. */
  kit: BrandKit;
  name: string;
  logo: string | null;
  type: BrandType;
  elements: BrandElements;
  headingFont: string;
  bodyFont: string;
  /** Clicking a style in the Buttons tile makes it the kit's default. */
  onPickButton: (look: BrandElements['buttons']) => void;
}) {
  const r = kit.roles;
  const radius = elements.corners === 'square' ? 3 : elements.corners === 'rounded' ? 10 : 18;
  const tile: CSSProperties = { background: r.card, borderRadius: 12, border: `1px solid ${mix(r.card, r.ink, 0.08)}` };
  const soft = (c: string, amount: number) => `color-mix(in srgb, ${c} ${amount}%, transparent)`;
  const h = { fontFamily: headingFont, fontWeight: type.heading };
  const title = name.trim() || 'Your Brand';

  const Tile = ({ label, note, span, children }: { label: string; note?: string; span: string; children: ReactNode }) => (
    <section className={`${span} min-w-0 p-3.5`} style={tile}>
      <div className="mb-3 flex font-mono text-[9.5px] uppercase tracking-wider" style={{ color: r.muted }}>
        {label}
        {note && <span className="ml-auto opacity-70">{note}</span>}
      </div>
      {children}
    </section>
  );

  return (
    <div
      className="grid grid-cols-6 gap-3 rounded-2xl p-5"
      style={{ background: r.bg, color: r.ink, fontFamily: bodyFont, fontWeight: type.body }}
    >
      <section className="col-span-6 flex items-center gap-3.5 p-3.5" style={tile}>
        <div
          className="flex size-10 shrink-0 items-center justify-center overflow-hidden"
          style={{ background: logo ? 'transparent' : r.accent, borderRadius: radius, color: r.onAccent }}
        >
          {/* biome-ignore lint/performance/noImgElement: a local data URL */}
          {logo ? <img src={logo} alt="" className="max-h-full max-w-full object-contain" /> : <span style={h}>{title[0]}</span>}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[20px]" style={h}>
            {title}
          </div>
          <div className="font-mono text-[11px]" style={{ color: r.muted }}>
            {fontName(kit.fonts.heading)} · {fontName(kit.fonts.body)}
          </div>
        </div>
      </section>

      <Tile label="Colors" note="text contrast" span="col-span-6">
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ['Background', kit.colors.bg, contrast(r.ink, kit.colors.bg)],
              ['Surface', kit.colors.surface, contrast(r.ink, kit.colors.surface)],
              ['Text', kit.colors.ink, null],
              ['Accent', kit.colors.accent, contrast(r.onAccent, r.accent)],
            ] as [string, string, number | null][]
          ).map(([label, color, ratio]) => (
            <div key={label} className="overflow-hidden rounded-lg" style={{ border: `1px solid ${mix(r.card, r.ink, 0.1)}` }}>
              <div className="flex h-12 items-end justify-end p-1" style={{ background: color }}>
                {ratio !== null && (
                  <span className="rounded bg-black/35 px-1 font-mono text-[9px] text-white">{ratio.toFixed(1)}</span>
                )}
              </div>
              <div className="px-2 py-1 text-[11px]" style={{ background: mix(r.card, r.bg, 0.4) }}>
                {label}
                <div className="font-mono text-[9.5px] uppercase" style={{ color: r.muted }}>
                  {color}
                </div>
              </div>
            </div>
          ))}
        </div>
        {(kit.extra?.length || kit.gradients?.length) ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {kit.extra?.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: two extra colors can match
              <i key={i} className="size-6 rounded-md" style={{ background: c }} />
            ))}
            {kit.gradients?.map(([a, b], i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: gradients have no id
              <i key={`g${i}`} className="h-6 w-16 rounded-md" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} />
            ))}
          </div>
        ) : null}
      </Tile>

      <Tile label="Type" note="at 1080 wide" span="col-span-6 xl:col-span-3">
        {(
          [
            ['Display 96', '$1.2B settled', { ...h, fontSize: 32, lineHeight: 1 }],
            ['H1 64', 'Vaults are live', { ...h, fontSize: 23 }],
            ['H2 44', 'Earn on idle balances', { ...h, fontSize: 17 }],
            ['Body 30', 'Withdraw any time, no lockups.', { fontSize: 13 }],
            ['Label 22', 'NOW LIVE', { fontSize: 10.5, letterSpacing: '0.1em', color: r.accent, fontWeight: 600 }],
            ['Caption 20', 'yourbrand.xyz · Thu 18:00 UTC', { fontSize: 11, color: r.muted }],
          ] as [string, string, CSSProperties][]
        ).map(([size, text, style]) => (
          <div key={size} className="flex items-baseline gap-3 py-1.5" style={{ borderBottom: `1px solid ${mix(r.card, r.ink, 0.06)}` }}>
            <span className="w-16 shrink-0 font-mono text-[9.5px]" style={{ color: r.muted }}>
              {size}
            </span>
            <span className="truncate" style={style}>
              {text}
            </span>
          </div>
        ))}
      </Tile>

      <Tile label="Buttons" note="click one to make it the default" span="col-span-6 xl:col-span-3">
        <div className="flex flex-wrap gap-x-3 gap-y-3">
          {BUTTON_LOOKS.map(([look, label]) => (
            <button
              key={look}
              type="button"
              title="Make this the default button"
              aria-pressed={look === elements.buttons}
              onClick={() => onPickButton(look)}
              className="flex flex-col items-start gap-1.5 text-left"
            >
              <PreviewButton look={look} roles={r} corners={elements.corners} text={look === 'link' ? 'Read more' : 'Get started'} small />
              <span className="font-mono text-[9px]" style={{ color: look === elements.buttons ? r.accent : r.muted }}>
                {label}
                {look === elements.buttons && ' · default'}
              </span>
            </button>
          ))}
        </div>
        {(
          [
            ['Sizes', ['Small', 'Medium', 'Large'].map((t, i) => ({ t, scale: [0.85, 1, 1.18][i], op: 1, glow: 0 }))],
            ['States', ['Default', 'Hover', 'Disabled'].map((t, i) => ({ t, scale: 1, op: i === 2 ? 0.4 : 1, glow: i === 1 ? 1 : 0 }))],
          ] as [string, { t: string; scale: number; op: number; glow: number }[]][]
        ).map(([label, items]) => (
          <div key={label} className="mt-3 flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: `1px solid ${mix(r.card, r.ink, 0.06)}` }}>
            <span className="mr-1 w-10 font-mono text-[9px]" style={{ color: r.muted }}>
              {label}
            </span>
            {items.map(({ t, scale, op, glow }) => (
              <span key={t} style={{ opacity: op, zoom: scale, filter: glow ? 'brightness(1.15)' : undefined }}>
                <PreviewButton look={elements.buttons} roles={r} corners={elements.corners} text={t} />
              </span>
            ))}
          </div>
        ))}
      </Tile>

      <Tile label="Badges" span="col-span-6 md:col-span-2">
        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          <span className="px-2.5 py-0.5" style={{ background: r.accent, color: r.onAccent, borderRadius: 99 }}>Mainnet</span>
          <span className="px-2.5 py-0.5" style={{ background: soft(r.accent, 16), color: r.accent, borderRadius: 99 }}>v2.0</span>
          <span className="px-2.5 py-0.5" style={{ border: `1px solid ${r.panel}`, borderRadius: 99 }}>Beta</span>
          <span className="px-2.5 py-0.5" style={{ background: '#ef4444', color: '#fff', borderRadius: 99 }}>● LIVE</span>
          <span className="px-2.5 py-0.5 font-mono" style={{ background: r.panel, borderRadius: 99 }}>+42%</span>
        </div>
        <div className="mt-3 space-y-1.5 text-[11.5px]">
          {[['Token', '$BRAND'], ['Contract', '0x7a3f…c2b0']].map(([k, v]) => (
            <div key={k} className="flex justify-between px-2.5 py-1.5" style={{ background: mix(r.card, r.bg, 0.5), borderRadius: radius / 1.5 }}>
              {k}
              <span className="font-mono text-[10.5px]" style={{ color: r.muted }}>{v}</span>
            </div>
          ))}
        </div>
      </Tile>

      <Tile label="Stat" span="col-span-3 md:col-span-2">
        <div className="text-[30px] leading-none" style={{ ...h, color: r.accent }}>$1.2B</div>
        <p className="mb-2.5 mt-1.5 text-[11.5px]" style={{ color: r.muted }}>total value settled on {title}</p>
        <div className="flex h-11 items-end gap-1">
          {[35, 55, 45, 70, 100].map((v, i) => (
            <i key={v} className="flex-1 rounded-t" style={{ height: `${v}%`, background: i === 4 ? r.accent : mix(r.accent, r.card, 0.65) }} />
          ))}
        </div>
      </Tile>

      <Tile label="Feature" span="col-span-3 md:col-span-2">
        <div className="mb-2.5 flex size-8 items-center justify-center" style={{ background: soft(r.accent, 16), color: r.accent, borderRadius: radius / 1.3 }}>◆</div>
        <div className="text-[14px]" style={h}>Self-custody</div>
        <p className="mt-1 text-[11.5px] leading-snug" style={{ color: r.muted }}>Your keys stay on your device.</p>
      </Tile>

      <Tile label="Checklist" span="col-span-3 md:col-span-2">
        {['Audited by two firms', 'No lockups', 'Instant withdrawals'].map((t) => (
          <div key={t} className="flex items-center gap-2 py-1 text-[12px]">
            <span className="flex size-4 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: r.accent, color: r.onAccent }}>✓</span>
            {t}
          </div>
        ))}
      </Tile>

      <Tile label="Steps" span="col-span-3 md:col-span-2">
        {['Get a wallet', 'Top up with a card', 'Swap in one tap'].map((t, i) => (
          <div key={t} className="mb-1 flex items-center gap-2.5 px-2 py-1.5 text-[12px]" style={{ background: mix(r.card, r.bg, 0.5), borderRadius: radius / 1.5 }}>
            <span className="font-mono text-[11px]" style={{ color: r.accent }}>0{i + 1}</span>
            {t}
          </div>
        ))}
      </Tile>

      <Tile label="Quote" span="col-span-6 md:col-span-2">
        <p className="text-[13.5px] leading-snug" style={h}>"We moved our payout flow in a weekend."</p>
        <div className="mt-3 flex items-center gap-2 text-[11px]" style={{ color: r.muted }}>
          <span className="size-6 rounded-full" style={{ background: r.panel, border: `2px solid ${r.accent}` }} />
          Jordan Lee · Head of Research
        </div>
      </Tile>

      <Tile label="In use" note="templates in this kit" span="col-span-6">
        <TemplateExamples kit={kit} />
      </Tile>
    </div>
  );
}

/** A few real templates drawn in the kit, straight onto canvases as the kit changes. Each takes a
 *  few milliseconds, so they keep up with a color being dragged. */
function TemplateExamples({ kit }: { kit: BrandKit }) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const run = useRef(0);
  // Only what shows in a picture: typing the kit's name doesn't redraw them.
  const look = JSON.stringify([kit.roles, kit.fonts, kit.type, kit.elements, kit.logo]);
  const latest = useRef(kit);
  latest.current = kit;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `look` stands for the kit's visible parts
  useEffect(() => {
    const mine = ++run.current;
    const frame = requestAnimationFrame(async () => {
      for (const [i, [id, ratio]] of EXAMPLES.entries()) {
        const canvas = canvases.current[i];
        if (!canvas) continue;
        const layout = applyBrandKit(layoutFromTemplate(findTemplate(id), undefined, undefined, ratio), latest.current);
        const images = await loadImages(layout, null);
        // A newer kit has started drawing; this one would only overwrite it with older colors.
        if (mine !== run.current) return;
        const width = ratio === 'story' ? 112 : ratio === 'x-post' ? 356 : 200;
        canvas.width = width;
        canvas.height = canvasHeight(layout, width);
        const ctx = canvas.getContext('2d');
        if (ctx) drawLayout(ctx, layout, images, width);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [look]);
  return (
    <div className="flex items-end gap-2.5 overflow-x-auto pb-1">
      {EXAMPLES.map(([id, ratio, label], i) => (
        <figure key={id} className="shrink-0">
          <canvas
            ref={(el) => {
              canvases.current[i] = el;
            }}
            aria-label={findTemplate(id).title}
            className="block rounded-md bg-black/20"
            style={{ height: 100, aspectRatio: ratio === 'x-post' ? '16 / 9' : ratio === 'story' ? '9 / 16' : '1' }}
          />
          <figcaption className="mt-1 text-center font-mono text-[9px] opacity-60">{label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
