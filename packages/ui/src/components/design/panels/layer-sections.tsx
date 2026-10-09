'use client';

import {
  ArrowRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ImageUp,
  Crop,
  FlipHorizontal2,
  RefreshCw,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Bold,
  Italic,
  Underline,
  WrapText,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, type ReactNode } from 'react';
import { artDef, artUrl } from '../art/art.js';
import { isCode } from '../art/code.js';
import { type ICCutout, DEFAULT_CUTOUT } from '../art/cutout.js';
import { isFixedWeight } from '../render/font-list.js';
import { slotTypeOf, cleanSlotName, isSlotName, listSlots } from '../render/slots.js';
import {
  type ICElement,
  isTexture,
  isCroppable,
  isHero,
  swapArt,
  HERO_ART,
  swapColors,
  shuffleTexture,
  type ICLayout,
  IC_OUTPUT_SIZE,
  RATIO_DIMENSIONS,
  type ICPill,
  ratioHeight,
  restyleButton,
  designRoles,
} from '../render/layout.js';
import { isChart } from '../art/charts.js';
import { nextLook, BUTTON_LOOKS, type ButtonLook } from '../art/buttons.js';
import { isScreen, otherScreen } from '../art/screens.js';
import { layerBox, canvasHeight } from '../render/render.js';
import { Row } from './controls.js';
import { ThemedSelect } from '../../ui/themed-select.js';
import { SegmentGroup, SegmentButton } from '../../ui/segment-group.js';
import type { StudioApi } from './studio-api.js';
import { FONT_OPTIONS, INPUT, LABEL, SMALL } from './panel-shared.js';
import {
  BoxIconButton,
  ColorInput,
  FormatToggle,
  NumberField,
  SizeStepper,
  Slider,
} from './panel-fields.js';

function CutoutControls({
  api,
  id,
  source,
}: {
  api: StudioApi;
  id: string;
  source: { cut?: ICCutout; sample?: boolean };
}) {
  const { cut } = source;
  const [draft, setDraft] = useState<ICCutout>(cut ?? DEFAULT_CUTOUT);
  useEffect(() => {
    if (cut) setDraft(cut);
  }, [cut]);
  const busy = api.cutBusy === id;
  const apply = () => void api.cutout(id, draft);
  const range = (label: string, key: keyof ICCutout, max: number, step: number) => (
    <label className="mt-2 flex items-center gap-2 text-caption text-canvas-muted-foreground">
      <span className="w-16">{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
        onPointerUp={apply}
        onKeyUp={apply}
        className="flex-1"
      />
    </label>
  );
  return (
    <div>
      <div className={LABEL}>Remove background</div>
      {source.sample ? (
        <p className="text-caption leading-relaxed text-canvas-muted-foreground">
          Upload a photo to remove its background here.
        </p>
      ) : (
        <>
          {cut ? (
            <>
              {range('Strength', 'tolerance', 100, 1)}
              {range('Edge', 'feather', 4, 0.5)}
              <button
                type="button"
                className={`${SMALL} mt-2.5 w-full`}
                onClick={() => void api.cutout(id, null)}
              >
                Restore original
              </button>
            </>
          ) : (
            <button type="button" className={`${SMALL} w-full`} disabled={busy} onClick={apply}>
              {busy ? 'Removing…' : 'Remove background'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** A square icon-only button, for bar actions shown as a plain glyph. */
/** Names a layer as a slot, so the Create design node shows it as an input a workflow can fill. */
function SlotControls({ api, el }: { api: StudioApi; el: ICElement }) {
  const type = slotTypeOf(el);
  const [draft, setDraft] = useState(el.slot ?? '');
  const [error, setError] = useState<string | null>(null);
  if (!type) return null;
  const commit = () => {
    const name = cleanSlotName(draft);
    setDraft(name);
    if (!name) return setError(null);
    if (!isSlotName(name)) return setError('Start with a letter; use letters, digits and _.');
    const clash = listSlots(api.layout).find((s) => s.name === name && s.type !== type);
    if (clash) return setError(`"${name}" is already a ${clash.type} slot.`);
    setError(null);
    api.patch(el.id, { slot: name });
  };
  return (
    <div>
      <div className={LABEL}>Slot name</div>
      <input
        // biome-ignore lint/a11y/noAutofocus: opened by the user's own Slot click
        autoFocus
        value={draft}
        placeholder="e.g. title, price, photo"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className={INPUT}
      />
      {error && <div className="mt-1.5 text-caption text-danger">{error}</div>}
      <p className="mt-2 text-caption leading-relaxed text-canvas-muted-foreground">
        A Playground workflow can fill this in by name.
      </p>
      {api.standalone && (
        <Link href="/playground" className={`${SMALL} mt-2 flex w-full items-center justify-center gap-1.5`}>
          Open Playground <ArrowRight className="size-3.5" />
        </Link>
      )}
      {el.slot && (
        <button
          type="button"
          className={`${SMALL} mt-2 w-full`}
          onClick={() => {
            api.patch(el.id, { slot: undefined });
            setDraft('');
          }}
        >
          Remove slot
        </button>
      )}
    </div>
  );
}

const ALIGNMENTS = [
  ['left', AlignLeft],
  ['center', AlignCenter],
  ['right', AlignRight],
] as const;

/** A selected layer's sections: first what only its kind has, then Figma's Position, Layout,
 *  Appearance, Typography, Fill, Stroke and Effects, each shown only when the layer uses it. */
export function LayerSections({
  api,
  el,
  section,
}: {
  api: StudioApi;
  el: ICElement;
  section: (title: string, children: ReactNode) => ReactNode;
}) {
  const patch = (p: Partial<Record<string, unknown>>) => api.patch(el.id, p);
  // In the design's own pixels, as Figma shows them: 1600 wide for an X Post, and so on.
  const W = designWidth(api.layout);
  const box = layerBox(el, api.layout, W);
  const px = { W, H: canvasHeight(api.layout, W), x: box.x, y: box.y, w: box.w, h: box.h };
  const isPhoto = el.t === 'subject' || el.t === 'image';
  const isWords = el.t === 'text' || el.t === 'pill';
  const bold = isWords && el.weight >= 700;
  const art = el.t === 'art' ? artDef(el.art) : undefined;
  const artActions =
    el.t === 'art' &&
    (isScreen(el.art) || art?.group === 'Arrows' || isChart(el.art) || isCode(el.art) || isTexture(el));
  const corner =
    el.t === 'image' && el.h !== undefined ? (
      <Row label="Radius">
        <Slider value={el.radius ?? 0} min={0} max={50} step={0.5} onChange={(v) => patch({ radius: v })} />
      </Row>
    ) : el.t === 'shape' ? (
      <Row label="Radius">
        <Slider value={el.radius} min={0} max={50} step={0.5} onChange={(v) => patch({ radius: v })} />
      </Row>
    ) : el.t === 'pill' && el.look !== 'bracket' && el.look !== 'link' ? (
      <Row label="Radius">
        <Slider
          value={roundness(el, api.layout)}
          min={0}
          max={100}
          onChange={(v) => patch({ radius: cornerRadius(el, api.layout, v) })}
        />
      </Row>
    ) : null;
  const fills =
    el.t === 'text' || el.t === 'line'
      ? [['Color', el.color, (v: string) => patch({ color: v })] as const]
      : el.t === 'pill' || el.t === 'shape'
        ? [['Fill', el.fill, (v: string) => patch({ fill: v })] as const]
        : el.t === 'art'
          ? (art?.slots ?? []).map(
              (slot) =>
                [
                  slot.label,
                  el.colors[slot.key] ?? slot.color,
                  (v: string) => patch({ colors: { ...el.colors, [slot.key]: v } }),
                ] as const,
            )
          : [];

  return (
    <>
      {isPhoto &&
        section(
          'Image',
          <>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                className={`${SMALL} flex items-center justify-center gap-1.5`}
                onClick={() => api.pickImage(el.t === 'subject' ? 'subject' : 'layer')}
              >
                <ImageUp className="size-3.5" /> Replace
              </button>
              {isCroppable(el) && (
                <button
                  type="button"
                  title={el.lock ? 'Unlock to crop' : undefined}
                  disabled={el.lock}
                  onClick={() => api.setCrop(api.cropId === el.id ? null : el.id)}
                  className={`${SMALL} flex items-center justify-center gap-1.5 ${api.cropId === el.id ? 'border-primary text-primary-soft' : ''}`}
                >
                  <Crop className="size-3.5" /> {api.cropId === el.id ? 'Done' : 'Crop'}
                </button>
              )}
              <button
                type="button"
                onClick={() => patch({ flip: !el.flip })}
                className={`${SMALL} flex items-center justify-center gap-1.5 ${el.flip ? 'border-primary text-primary-soft' : ''}`}
              >
                <FlipHorizontal2 className="size-3.5" /> Flip
              </button>
              {el.t === 'image' && el.gen && (
                <button
                  type="button"
                  title={api.genError ?? 'A new take of the same prompt'}
                  disabled={api.genBusy !== null}
                  onClick={() => void api.regenerateElement(el.id)}
                  className={`${SMALL} col-span-3 flex items-center justify-center gap-1.5`}
                >
                  <RefreshCw className="size-3.5" /> {api.genBusy === el.id ? 'Regenerating…' : 'Regenerate'}
                </button>
              )}
            </div>
            <CutoutControls
              api={api}
              id={el.id}
              source={el.t === 'subject' ? api.layout.subject : el}
            />
          </>,
        )}
      {el.t === 'pill' &&
        section(
          'Button',
          <>
            <div className="flex items-center justify-between text-caption text-canvas-muted-foreground">
              Style
              <BoxIconButton
                icon={RefreshCw}
                title="Shuffle: the next button style"
                onClick={() => api.update((l) => restyleIn(l, el.id, nextLook(el.look)))}
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {BUTTON_LOOKS.map(([look, name]) => (
                <button
                  key={look}
                  type="button"
                  onClick={() => api.update((l) => restyleIn(l, el.id, look))}
                  className={`${SMALL} ${el.look === look ? 'border-primary text-primary-soft' : ''}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </>,
        )}
      {el.t === 'art' &&
        (isHero(el.art) || artActions) &&
        section(
          'Art',
          <>
            {isHero(el.art) && (
              <>
                <div className="flex items-center justify-between text-caption text-canvas-muted-foreground">
                  Shape
                  <BoxIconButton
                    icon={RefreshCw}
                    title="Shuffle: another shape in the same spot"
                    onClick={() => api.update((l) => swapArt(l, el.id))}
                  />
                </div>
                <div className="grid max-h-60 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
                  {HERO_ART.map((id) => {
                    const def = artDef(id);
                    if (!def) return null;
                    const on = el.art === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        title={def.name}
                        onClick={() => api.update((l) => swapArt(l, el.id, id))}
                        className={`flex aspect-square items-center justify-center rounded-lg border bg-canvas-muted p-1.5 ${
                          on
                            ? 'border-primary'
                            : 'border-canvas-border hover:border-canvas-muted-foreground'
                        }`}
                      >
                        {/* biome-ignore lint/performance/noImgElement: a local SVG data URL */}
                        <img src={artUrl(def, swapColors(api.layout, el, def))} alt={def.name} className="max-h-full max-w-full" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {artActions && (
              <div className="flex flex-wrap gap-1.5">
                {isScreen(el.art) && (
                  <>
                    <BoxIconButton icon={ImageUp} title="Replace screenshot" onClick={() => api.pickImage('shot')} />
                    <BoxIconButton
                      icon={RefreshCw}
                      title="Shuffle: another device of the same kind"
                      onClick={() => api.update((l) => swapArt(l, el.id, otherScreen(el.art)))}
                    />
                  </>
                )}
                {art?.group === 'Arrows' && (
                  <BoxIconButton icon={FlipHorizontal2} title="Flip" active={el.flip} onClick={() => patch({ flip: !el.flip })} />
                )}
                {(isChart(el.art) || isCode(el.art)) && (
                  <button
                    type="button"
                    onClick={() => api.setEdit(api.editId === el.id ? null : el.id)}
                    className={`${SMALL} ${api.editId === el.id ? 'border-primary text-primary-soft' : ''}`}
                  >
                    {isCode(el.art) ? 'Edit code' : 'Edit data'}
                  </button>
                )}
                {isTexture(el) && (
                  <button
                    type="button"
                    title="A new texture in any style"
                    className={`${SMALL} flex items-center gap-1`}
                    onClick={() => api.update(shuffleTexture)}
                  >
                    <RefreshCw className="size-3.5" /> Shuffle
                  </button>
                )}
              </div>
            )}
          </>,
        )}
      {el.t === 'avatar' &&
        section('Avatar', <p className="text-caption text-canvas-muted-foreground">Edit it in the Avatar tab.</p>)}
      {section(
        'Position',
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField label="X" value={px.x} onCommit={(v) => patch({ x: (v / px.W) * 100 })} />
            <NumberField label="Y" value={px.y} onCommit={(v) => patch({ y: (v / px.H) * 100 })} />
          </div>
          <Row label="Rotation">
            <Slider value={el.rot ?? 0} min={-180} max={180} unit="°" onChange={(v) => patch({ rot: v })} />
            <BoxIconButton
              icon={RotateCcw}
              title="Reset rotation"
              disabled={!el.rot}
              onClick={() => patch({ rot: 0 })}
            />
          </Row>
          <Row label="Order">
            <button
              type="button"
              className={`${SMALL} flex flex-1 items-center justify-center gap-1.5`}
              onClick={() => api.move(1)}
            >
              <ArrowUp className="size-3.5" /> Forward
            </button>
            <button
              type="button"
              className={`${SMALL} flex flex-1 items-center justify-center gap-1.5`}
              onClick={() => api.move(-1)}
            >
              <ArrowDown className="size-3.5" /> Back
            </button>
          </Row>
        </>,
      )}
      {'w' in el &&
        section(
          'Layout',
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField label="W" value={px.w} onCommit={(v) => v > 0 && patch({ w: (v / px.W) * 100 })} />
            <NumberField
              label="H"
              value={px.h}
              // Text, and pictures drawn at their own shape, take their height from their width.
              disabled={!hasHeight(el)}
              title={hasHeight(el) ? undefined : 'Follows the width'}
              onCommit={(v) => v > 0 && patch({ h: (v / px.H) * 100 })}
            />
          </div>,
        )}
      {section(
        'Appearance',
        <>
          <Row label="Opacity">
            <Slider
              value={Math.round((el.op ?? 1) * 100)}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => patch({ op: v / 100 })}
            />
          </Row>
          {corner}
        </>,
      )}
      {isWords &&
        section(
          'Typography',
          <>
            <ThemedSelect id="ic-font" value={el.font} options={FONT_OPTIONS} onChange={(v) => patch({ font: v })} />
            <Row label="Size">
              <SizeStepper value={el.size} onChange={(size) => patch({ size })} />
            </Row>
            {el.t === 'pill' && (
              <Row label="Color">
                <ColorInput label="Text color" value={el.color} onChange={(v) => patch({ color: v })} />
              </Row>
            )}
            <Row label="Style">
              <SegmentGroup>
                {!isFixedWeight(el.font) && (
                  <FormatToggle icon={Bold} title="Bold" on={bold} onClick={() => patch({ weight: bold ? 400 : 700 })} />
                )}
                <FormatToggle icon={Italic} title="Italic" on={!!el.italic} onClick={() => patch({ italic: !el.italic })} />
                <FormatToggle
                  icon={Underline}
                  title="Underline"
                  on={!!el.underline}
                  onClick={() => patch({ underline: !el.underline })}
                />
                {el.t === 'text' && (
                  <FormatToggle
                    icon={WrapText}
                    title={el.wrap === false ? 'Wrap lines at the box width' : 'Keep each line on one row'}
                    on={el.wrap !== false}
                    onClick={() => patch({ wrap: el.wrap === false ? undefined : false })}
                  />
                )}
              </SegmentGroup>
              {el.t === 'text' && (
                <SegmentGroup>
                  {ALIGNMENTS.map(([a, Icon]) => (
                    <SegmentButton
                      key={a}
                      on={el.align === a}
                      lit="canvas"
                      className="p-1"
                      title={`Align ${a}`}
                      aria-label={`Align ${a}`}
                      onClick={() => patch({ align: a })}
                    >
                      <Icon className="size-3.5" />
                    </SegmentButton>
                  ))}
                </SegmentGroup>
              )}
            </Row>
          </>,
        )}
      {fills.length > 0 &&
        section(
          'Fill',
          fills.map(([label, value, set]) => (
            <Row key={label} label={label}>
              <ColorInput label={label} value={value} onChange={set} />
            </Row>
          )),
        )}
      {el.t === 'shape' &&
        section(
          'Stroke',
          <Row label="Color">
            <ColorInput label="Stroke" value={el.stroke} onChange={(v) => patch({ stroke: v })} />
          </Row>,
        )}
      {el.t === 'subject' &&
        section(
          'Effects',
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-caption text-canvas-muted-foreground">
              <input
                type="checkbox"
                checked={el.shadow}
                onChange={(e) => patch({ shadow: e.target.checked })}
              />
              Shadow
            </label>
            <label className="flex items-center gap-1.5 text-caption text-canvas-muted-foreground">
              <input
                type="checkbox"
                checked={el.reflect ?? false}
                onChange={(e) => patch({ reflect: e.target.checked })}
              />
              Reflection
            </label>
          </div>,
        )}
      {api.multiSel.length <= 1 && slotTypeOf(el) && section('Playground slot', <SlotControls api={api} el={el} />)}
    </>
  );
}

/** Layers whose height is set on its own, apart from their width. */
const hasHeight = (el: ICElement) =>
  (el.t === 'shape' || el.t === 'pill' || el.t === 'image') && el.h !== undefined;

/** The design's width in pixels: its named size, its custom size, or the 1080 it's drawn at. */
function designWidth(layout: ICLayout): number {
  if (layout.ratio === 'custom') return layout.customSize?.width ?? IC_OUTPUT_SIZE;
  return RATIO_DIMENSIONS[layout.ratio as keyof typeof RATIO_DIMENSIONS]?.width ?? IC_OUTPUT_SIZE;
}

/** A badge's radius in canvas-width percent that makes its corners fully round. */
const fullRadius = (e: ICPill, l: ICLayout) =>
  (e.h * ratioHeight(l.ratio, l.customSize)) / 2;

/** How round a badge's corners are, 0 square to 100 fully round. */
const roundness = (e: ICPill, l: ICLayout) =>
  e.radius === undefined ? 100 : Math.round(Math.min(100, (e.radius / fullRadius(e, l)) * 100));

/** Fully round stays unset, so the badge keeps round ends when resized. */
const cornerRadius = (e: ICPill, l: ICLayout, v: number) =>
  v >= 100 ? undefined : (fullRadius(e, l) * v) / 100;

/** The design with one badge switched to another look, in the design's own colors. */
const restyleIn = (l: ICLayout, id: string, look: ButtonLook): ICLayout => ({
  ...l,
  els: l.els.map((x) => (x.id === id && x.t === 'pill' ? restyleButton(x, look, designRoles(l)) : x)),
});
