'use client';

import { useState, useEffect, useRef } from 'react';
import { layerBuilder } from '../templates/announce.js';
import { ART, artDefaults, artPalette, artUrl, artFor } from '../art/art.js';
import { type ICBlock, blockStyle, fitBlockLayer, BLOCKS } from '../templates/blocks.js';
import { type ICArtGroup, isFrameVariant, WEB3_GROUPS } from '../art/art-web3.js';
import { canGenerateElements } from '../art/ai-element.js';
import { InfoHint } from '../../ui/info-hint.js';
import { type ICLayout, designRoles, type ICModel } from '../render/layout.js';
import { composeLayout } from '../render/render.js';
import { IMAGE_MODEL_OPTIONS } from '../../playground/flow/node-defs.js';
import { ThemedSelect } from '../../ui/themed-select.js';
import { dragItem, type StudioApi } from './studio-api.js';
import { INPUT, LABEL, SMALL, TILE } from './panel-shared.js';
import { tileArt } from './background-controls.js';

/** A prompt-painted photo behind every layer, at the bottom of the Elements tab. */
function AIBackgroundBlock({ api }: { api: StudioApi }) {
  const { layout } = api;
  if (api.standalone) return null;
  return (
    <div className="mt-4 border-t border-canvas-border pt-3">
      <div className={LABEL}>
        AI background
        <InfoHint text="A photo painted from your prompt when the workflow runs. It sits behind every layer and covers the background color while on." />
      </div>
      {layout.scene.on ? (
        <>
          <textarea
            value={layout.prompt}
            placeholder="e.g. a warm studio wall with soft daylight"
            onChange={(e) => api.update((l) => ({ ...l, prompt: e.target.value }))}
            spellCheck={false}
            className={`${INPUT} min-h-[64px] resize-y leading-relaxed`}
          />
          <div className="mt-2">
            <ThemedSelect
              id="ic-model"
              value={layout.model}
              options={IMAGE_MODEL_OPTIONS}
              onChange={(v) => api.update((l) => ({ ...l, model: v as ICLayout['model'] }))}
            />
          </div>
          <p className="mt-1.5 text-caption leading-relaxed text-canvas-muted-foreground">
            {layout.scene.upload
              ? 'Using your uploaded image.'
              : api.sceneReady
                ? 'Painted on the last run.'
                : 'Generated when the workflow runs.'}
          </p>
          {/* Same place and size as AI element's Cancel, so the two sections read alike. */}
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              className={`${SMALL} py-2`}
              onClick={() => {
                api.update((l) => ({ ...l, scene: { ...l.scene, on: false } }));
                api.select('bg');
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className={`${SMALL} w-full py-2`}
          onClick={() => {
            api.update((l) => ({ ...l, scene: { ...l.scene, on: true } }));
            api.select('scene');
          }}
        >
          Add AI background
        </button>
      )}
    </div>
  );
}

function ArtTile({
  api,
  art,
  small,
}: {
  api: StudioApi;
  art: (typeof ART)[number];
  small?: boolean;
}) {
  // Drawn on the design's own background in the colors addArt gives it, like the block tiles.
  const roles = designRoles(api.layout);
  const colors = { ...artDefaults(art), ...artPalette(art, roles) };
  return (
    <button
      type="button"
      title={art.name}
      {...dragItem({ kind: 'art', id: art.id })}
      onClick={() => api.addArt(art.id)}
      className={small ? `${TILE} h-auto aspect-square p-2.5` : TILE}
      style={{ background: roles.bg }}
    >
      {/* biome-ignore lint/performance/noImgElement: a local SVG data URL */}
      <img
        // A chart with several series shades them from its colors, so it is drawn with the design's.
        src={artUrl(tileArt(artFor({ art: art.id, colors }) ?? art), colors)}
        alt={art.name}
        className="max-h-full max-w-full"
      />
    </button>
  );
}

/** A prompt-painted object with its backdrop cut away, added as a normal image layer. */
function AIElementForm({ api }: { api: StudioApi }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => setAvailable(canGenerateElements()), []);
  const busy = api.genBusy !== null;
  // Collapsed to one button like AI background; it folds back once a generation lands cleanly.
  const [open, setOpen] = useState(busy);
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current && !busy && !api.genError) setOpen(false);
    wasBusy.current = busy;
  }, [busy, api.genError]);
  if (!available) return null;
  const wide = `${SMALL} mt-2 flex w-full items-center justify-center gap-1.5 py-2`;
  return (
    <div className="mt-4 border-t border-canvas-border pt-3">
      <div className={LABEL}>
        AI element
        <InfoHint text="An object painted from your prompt and cut out, added as a layer over your background." />
      </div>
      {!open && !busy ? (
        <button type="button" className={`${SMALL} w-full py-2`} onClick={() => setOpen(true)}>
          Add AI element
        </button>
      ) : (
        <>
          <textarea
            value={api.genPrompt}
            placeholder="e.g. a hand holding a smartphone"
            onChange={(e) => api.setGenPrompt(e.target.value)}
            spellCheck={false}
            className={`${INPUT} min-h-[64px] resize-y leading-relaxed`}
          />
          <div className="mt-2">
            <ThemedSelect
              id="ic-element-model"
              value={api.genModel}
              options={IMAGE_MODEL_OPTIONS}
              onChange={(v) => api.setGenModel(v as ICModel)}
            />
          </div>
          {busy ? (
            <>
              <button type="button" onClick={api.stopElement} className={wide}>
                Stop
              </button>
              <p className="mt-1.5 text-caption text-canvas-muted-foreground">
                Usually 30 seconds to a couple of minutes. Other tabs keep working meanwhile.
              </p>
            </>
          ) : (
            <div className="mt-2 flex gap-1.5">
              <button type="button" onClick={() => setOpen(false)} className={`${SMALL} py-2`}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!api.genPrompt.trim()}
                onClick={() => void api.generateElement(api.genPrompt, api.genModel)}
                className={`${SMALL} flex flex-1 items-center justify-center py-2`}
              >
                Generate
              </button>
            </div>
          )}
          {api.genError && <p className="mt-1.5 text-caption text-danger">{api.genError}</p>}
        </>
      )}
    </div>
  );
}

/** A block drawn on its own in the design's colors, at a size the tile shows whole. */
function BlockTile({ api, block }: { api: StudioApi; block: ICBlock }) {
  const [url, setUrl] = useState<string | null>(null);
  const { layout } = api;
  const roles = designRoles(layout);
  const key = `${block.id}|${JSON.stringify(roles)}|${layout.kit?.id ?? ''}|${JSON.stringify(layout.bg)}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` captures everything the preview depends on
  useEffect(() => {
    let live = true;
    const H = 62.5;
    const built = block.build(layerBuilder(H, roles), blockStyle(layout.kit));
    const scale = Math.min(88 / built.w, (H * 0.84) / built.h);
    const els = built.els.map((e) =>
      fitBlockLayer(e, scale, (100 - built.w * scale) / 2, (100 - (built.h * scale * 100) / H) / 2),
    );
    const preview: ICLayout = {
      ...layout,
      ratio: 'custom',
      customSize: { width: 160, height: 100 },
      scene: { on: false, upload: null },
      els,
    };
    composeLayout(preview, null, { width: 320, format: 'png' })
      .then((u) => live && setUrl(u))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [key]);
  return (
    <button
      type="button"
      title={block.name}
      {...dragItem({ kind: 'block', id: block.id })}
      onClick={() => api.addBlock(block.id)}
      className="overflow-hidden rounded-lg border border-canvas-border bg-canvas-muted text-left hover:border-canvas-muted-foreground"
    >
      <div className="aspect-[8/5]" style={{ background: roles.bg }}>
        {/* biome-ignore lint/performance/noImgElement: a local data URL */}
        {url && <img src={url} alt="" className="size-full" />}
      </div>
      <div className="truncate px-2 py-1.5 text-caption text-canvas-foreground">{block.name}</div>
    </button>
  );
}

/** One group of art shapes, drawn in the design's colors. */
function ShapeSection({ api, group }: { api: StudioApi; group: ICArtGroup }) {
  return (
    <>
      <div className={`${LABEL} mt-4`}>{group}</div>
      <div className="grid grid-cols-4 gap-1.5">
        {/* Streaks stays drawable for designs that have it, but a background pattern replaced it here. */}
        {ART.filter((a) => a.group === group && !isFrameVariant(a.id) && a.id !== 'streaks').map((a) => (
          <ArtTile key={a.id} api={api} art={a} small />
        ))}
      </div>
    </>
  );
}

export function ElementsPanel({ api }: { api: StudioApi }) {
  const add = 'grid grid-cols-2 gap-1.5';
  // Drawn on the design's background in its accent, like the art tiles beside them.
  const { accent, bg } = designRoles(api.layout);
  return (
    <div>
      <div className={LABEL}>Text</div>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          className={SMALL}
          {...dragItem({ kind: 'text' })}
          onClick={() => api.addText('text')}
        >
          Text
        </button>
        <button
          type="button"
          className={SMALL}
          {...dragItem({ kind: 'pill' })}
          onClick={() => api.addText('pill')}
        >
          Badge
        </button>
        <button
          type="button"
          className={SMALL}
          {...dragItem({ kind: 'button' })}
          onClick={() => api.addButton()}
        >
          Button
        </button>
      </div>
      <div className={`${LABEL} mt-4`}>Images</div>
      <div className={add}>
        <button type="button" className={SMALL} onClick={() => api.pickImage('add')}>
          Upload file
        </button>
      </div>
      <AIElementForm api={api} />
      <AIBackgroundBlock api={api} />
      <div className={`${LABEL} mt-4`}>Blocks</div>
      <div className="grid grid-cols-2 gap-1.5">
        {BLOCKS.map((block) => (
          <BlockTile key={block.id} api={api} block={block} />
        ))}
      </div>
      {WEB3_GROUPS.map((g) => (
        <ShapeSection key={g} api={api} group={g} />
      ))}
      <div className={`${LABEL} mt-4`}>Shapes</div>
      <div className="grid grid-cols-4 gap-1.5">
        {(['rect', 'ellipse'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            title={kind === 'rect' ? 'Rectangle' : 'Circle'}
            {...dragItem({ kind })}
            onClick={() => api.addShape(kind)}
            className={`${TILE} aspect-square h-auto`}
            style={{ background: bg }}
          >
            <span
              className={`block ${kind === 'rect' ? 'h-6 w-8 rounded-sm' : 'size-7 rounded-full'}`}
              style={{ background: accent }}
            />
          </button>
        ))}
        <button
          type="button"
          title="Line"
          {...dragItem({ kind: 'line' })}
          onClick={() => api.addLine()}
          className={`${TILE} aspect-square h-auto`}
          style={{ background: bg }}
        >
          <span className="block h-0.5 w-9" style={{ background: accent }} />
        </button>
        {ART.filter((a) => a.kind === 'shape' && !a.group).map((a) => (
          <ArtTile key={a.id} api={api} art={a} small />
        ))}
      </div>
      <div className={`${LABEL} mt-4`}>Characters</div>
      <div className="grid grid-cols-3 gap-1.5">
        {ART.filter((a) => a.kind === 'character').map((a) => (
          <ArtTile key={a.id} api={api} art={a} />
        ))}
      </div>
    </div>
  );
}
