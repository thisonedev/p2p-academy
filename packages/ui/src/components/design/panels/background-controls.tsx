'use client';

import { type ReactNode } from 'react';
import { artDef, artUrl, artDefaults, artPalette, ART } from '../art/art.js';
import { isFrameArt } from '../art/art-web3.js';
import {
  isTexture,
  designRoles,
  setTexture,
  TEXTURES,
  isTextureOn,
  type ICLayout,
  fitFigures,
} from '../render/layout.js';
import { patternId } from '../art/patterns.js';
import { PALETTES } from '../brand/palettes.js';
import type { StudioApi } from './studio-api.js';
import { Segmented } from './panel-fields.js';
import { INPUT, SWATCH } from './panel-shared.js';

/** Color pairs for gradient swatches: each neighbor pair of a palette, then first to last. */
const gradientPairs = (colors: string[]): [string, string][] => [
  ...colors.slice(1).map((c, i): [string, string] => [colors[i], c]),
  [colors[0], colors[colors.length - 1]],
];

/** Every palette's colors in a compact grid, the active palette first. Hover a group for its name. */
/** The applied kit's own swatches, in a row above the palettes. */
function BrandSwatches({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2.5">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted-foreground/70">
        Brand
      </div>
      <div className="grid grid-cols-8 gap-1">{children}</div>
    </div>
  );
}

function PaletteSwatches({
  api,
  children,
}: {
  api: StudioApi;
  children: (colors: string[]) => ReactNode;
}) {
  const active = api.layout.palette;
  const ordered = [...PALETTES].sort((a, b) => Number(b.id === active) - Number(a.id === active));
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
      {ordered.map((p) => (
        <div key={p.id} title={p.name} className="grid grid-cols-4 gap-1">
          {children(p.colors)}
        </div>
      ))}
    </div>
  );
}

/** The one faint layer over the background: None, a pattern style, a frame or streaks. */
export function TextureControls({ api }: { api: StudioApi }) {
  const on = api.layout.els.some(isTexture);
  const roles = designRoles(api.layout);
  const tile = (active: boolean) =>
    `flex aspect-square items-center justify-center overflow-hidden rounded-lg border ${
      active
        ? 'border-primary'
        : 'border-canvas-border hover:border-canvas-muted-foreground'
    }`;
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          title="No texture"
          onClick={() => api.update((l) => setTexture(l, null))}
          // Having no texture isn't a pick, so None never takes the selection ring.
          className={`${tile(false)} text-[11px] ${on ? 'text-canvas-muted-foreground' : 'text-canvas-foreground'}`}
        >
          None
        </button>
        {TEXTURES.map(([texture, name]) => {
          const def = artDef('pattern' in texture ? patternId(texture.pattern, 1) : texture.art);
          return (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => api.update((l) => setTexture(l, texture))}
              className={tile(isTextureOn(api.layout, texture))}
              style={{ background: roles.bg }}
            >
              {def && (
                // biome-ignore lint/performance/noImgElement: a local SVG data URL
                <img
                  src={artUrl(tileArt(def), { ...artDefaults(def), ...artPalette(def, roles) })}
                  alt={name}
                  className="size-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Solid, gradient or transparent background, in the inspector's Fill section. */
export function BackgroundControls({ api }: { api: StudioApi }) {
  const { bg, kit } = api.layout;
  // A kit's own colors and gradients come first, ahead of the stock palettes.
  const brand = kit ? [...new Set([...Object.values(kit.colors), ...(kit.extra ?? [])])] : [];
  const brandGradients = kit?.gradients ?? [];
  // The AI background sits above the background color, so choosing a color turns it off.
  const setBg = (patch: Partial<ICLayout['bg']>) =>
    api.update((l) =>
      fitFigures({ ...l, scene: { ...l.scene, on: false }, bg: { ...l.bg, ...patch } }),
    );
  return (
    <div>
      <Segmented
        value={bg.mode}
        options={[
          ['solid', 'Solid'],
          ['gradient', 'Gradient'],
          ['transparent', 'Transparent'],
        ]}
        onChange={(mode) => setBg({ mode })}
      />
      {bg.mode === 'solid' && (
        <>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bg.color}
              onChange={(e) => setBg({ color: e.target.value })}
              className="h-8 w-10 rounded-md border border-canvas-border bg-canvas p-0.5"
            />
            <input
              value={bg.color}
              maxLength={7}
              spellCheck={false}
              onChange={(e) =>
                /^#[0-9a-fA-F]{6}$/.test(e.target.value) && setBg({ color: e.target.value })
              }
              className={`${INPUT} py-1.5`}
            />
          </div>
          {brand.length > 0 && (
            <BrandSwatches>
              {brand.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  className={SWATCH}
                  style={{ background: c }}
                  onClick={() => setBg({ color: c })}
                />
              ))}
            </BrandSwatches>
          )}
          <PaletteSwatches api={api}>
            {(colors) =>
              colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  className={SWATCH}
                  style={{ background: c }}
                  onClick={() => setBg({ color: c })}
                />
              ))
            }
          </PaletteSwatches>
        </>
      )}
      {bg.mode === 'gradient' && (
        <>
          <div
            className="mb-2 h-8 rounded-lg border border-canvas-border"
            style={{ background: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})` }}
          />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bg.from}
              onChange={(e) => setBg({ from: e.target.value })}
              className="h-8 w-10 rounded-md border border-canvas-border bg-canvas p-0.5"
            />
            <input
              type="color"
              value={bg.to}
              onChange={(e) => setBg({ to: e.target.value })}
              className="h-8 w-10 rounded-md border border-canvas-border bg-canvas p-0.5"
            />
            <input
              type="range"
              min={0}
              max={360}
              value={bg.angle}
              onChange={(e) => setBg({ angle: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="w-9 text-right text-[11px] text-canvas-muted-foreground">
              {bg.angle}°
            </span>
          </div>
          {brandGradients.length > 0 && (
            <BrandSwatches>
              {brandGradients.map(([from, to]) => (
                <button
                  key={`${from}${to}`}
                  type="button"
                  aria-label={`Gradient ${from} to ${to}`}
                  className={SWATCH}
                  style={{ background: `linear-gradient(${bg.angle}deg, ${from}, ${to})` }}
                  onClick={() => setBg({ from, to })}
                />
              ))}
            </BrandSwatches>
          )}
          <PaletteSwatches api={api}>
            {(colors) =>
              gradientPairs(colors).map(([from, to]) => (
                <button
                  key={`${from}${to}`}
                  type="button"
                  aria-label={`Gradient ${from} to ${to}`}
                  className={SWATCH}
                  style={{ background: `linear-gradient(${bg.angle}deg, ${from}, ${to})` }}
                  onClick={() => setBg({ from, to })}
                />
              ))
            }
          </PaletteSwatches>
        </>
      )}
      {bg.mode === 'transparent' && (
        <p className="text-[11px] leading-relaxed text-canvas-muted-foreground">
          The AI background is already off. Export now for a transparent PNG.
        </p>
      )}
    </div>
  );
}

/** Frame lines are hairlines at canvas size, so the tile draws them heavier to be seen. */
export const tileArt = (art: (typeof ART)[number]) =>
  isFrameArt(art.id)
    ? {
        ...art,
        body: art.body
          .replace(/stroke-width="[\d.]+"/g, 'stroke-width="4"')
          .replace(/ opacity="[\d.]+"/g, ''),
      }
    : art;
