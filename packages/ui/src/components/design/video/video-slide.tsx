'use client';

import { Shuffle, Eye, EyeOff, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { type ICVideo, type ICVideoText } from '../render/layout.js';
import type { StudioApi } from '../panels/studio-api.js';
import { PreviewSelect } from './video-previews.js';
import { Row, FIELD } from '../panels/controls.js';
import { NEW_VIDEO, type Slide } from './storyboards.js';
import { variantsOf, lookId, ENDINGS, MARKS, FRAMES } from './video.js';
import { ThemedSelect } from '../../ui/themed-select.js';
import { IconButton } from '../../ui/icon-button.js';
import type { Story } from './story.js';

const MAX_FEATURES = 5;

const BUTTON =
  'rounded-md border border-canvas-border px-2.5 py-1.5 text-[12px] text-canvas-foreground hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-40';

function Text({
  label,
  value,
  onChange,
  lines,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  lines?: number;
}) {
  return (
    <Row label={label}>
      {lines ? (
        <textarea
          rows={lines}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD} block resize-none`}
        />
      ) : (
        <input
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          className={FIELD}
        />
      )}
    </Row>
  );
}

export const patchVideo = (api: StudioApi, fn: (v: ICVideo) => ICVideo) =>
  api.update((l) => ({ ...l, video: fn(l.video ?? NEW_VIDEO) }));

/** The picked slide's own controls: whether it plays, how it is drawn and the words on it. */
export function VideoSlide({ api, story, picked }: { api: StudioApi; story: Story; picked: Slide }) {
  const video = api.layout.video ?? NEW_VIDEO;
  const slide = picked.id;
  const t = story.text;
  const text = (patch: Partial<ICVideoText>) =>
    patchVideo(api, (v) => ({ ...v, text: { ...v.text, ...patch } }));
  const feature = (i: number, patch: Partial<ICVideoText['features'][number]>) =>
    text({ features: t.features.map((f, k) => (k === i ? { ...f, ...patch } : f)) });
  const stat = (i: number, patch: Partial<ICVideoText['stats'][number]>) =>
    text({ stats: t.stats.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const kind = picked.kind;
  // The look's own styles come first in the list, then the ones that go with any look.
  const fits = variantsOf(kind, lookId(video.look));
  const variants = [...fits.filter((v) => v.look), ...fits.filter((v) => !v.look)];
  const shot = story.built.shots.find((s) => s.id === slide);
  const style = shot?.variant.id ?? video.variants[kind] ?? variants[0]?.id;
  const setStyle = (id: string) =>
    patchVideo(api, (v) => ({ ...v, variants: { ...v.variants, [kind]: id } }));
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-canvas-foreground">
        <span className="min-w-0 flex-1 truncate">{picked.name}</span>
        {kind === 'working' && (
          <IconButton
            look="small"
            title="Other steps"
            aria-label="Other steps"
            // Typed steps give way too, or the shuffle would show nothing new.
            onClick={() =>
              patchVideo(api, (v) => {
                const { steps: _typed, ...kept } = v.text;
                return { ...v, text: kept, stepsTurn: (v.stepsTurn ?? 0) + 1 };
              })
            }
          >
            <Shuffle className="size-3.5" />
          </IconButton>
        )}
        <IconButton
          look="small"
          aria-label={picked.on ? `Hide ${picked.name}` : `Show ${picked.name}`}
          aria-pressed={picked.on}
          onClick={() =>
            patchVideo(api, (v) => ({ ...v, slides: { ...v.slides, [slide]: !picked.on } }))
          }
        >
          {picked.on ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </IconButton>
      </div>
      {/* One height for every slide, so the panel does not jump as slides are picked. A slide with
          more than fits scrolls inside. */}
      <div
        className={`mt-2 h-60 space-y-1.5 overflow-y-auto pr-1 ${picked.on ? '' : 'opacity-45'}`}
      >
        {variants.length > 1 && (
          <Row label="Style">
            <span className="flex w-full min-w-0 items-center gap-1.5">
              <span className="min-w-0 flex-1">
                <ThemedSelect
                  value={style}
                  options={variants.map((v) => ({ value: v.id, label: v.name }))}
                  onChange={setStyle}
                />
              </span>
              <IconButton
                look="small"
                title="Another style"
                aria-label="Another style"
                onClick={() => {
                  const others = variants.filter((v) => v.id !== style);
                  setStyle(others[Math.floor(Math.random() * others.length)].id);
                }}
              >
                <Shuffle className="size-3.5" />
              </IconButton>
            </span>
          </Row>
        )}
        {kind === 'working' && (
          <Row label="Ending">
            <PreviewSelect
              set="ending"
              what="ending"
              value={t.ending ?? ENDINGS[0].id}
              list={ENDINGS}
              onPick={(ending) => patchVideo(api, (v) => ({ ...v, ending }))}
            />
          </Row>
        )}
        {kind === 'working' && style === 'status' && (
          <Row label="Mark">
            <PreviewSelect
              set="mark"
              what="mark"
              value={t.mark ?? MARKS[0].id}
              list={MARKS}
              onPick={(mark) => patchVideo(api, (v) => ({ ...v, mark }))}
            />
          </Row>
        )}
        {/* The phone styles are always a phone. The others take the frame picked here. */}
        {kind === 'features' && ['split', 'flip', 'stage', 'deck'].includes(style ?? '') && (
          <Row label="Frame">
            <ThemedSelect
              value={FRAMES.find((f) => f.id === video.frame)?.id ?? FRAMES[0].id}
              options={FRAMES.map((f) => ({ value: f.id, label: f.name }))}
              onChange={(frame) => patchVideo(api, (v) => ({ ...v, frame }))}
            />
          </Row>
        )}
        {kind === 'hook' && (
          <>
            <Text label="Lines" value={t.hook} onChange={(hook) => text({ hook })} lines={3} />
            {shot?.variant.id === 'bands' && (
              <Text label="Bands" value={t.bands} onChange={(bands) => text({ bands })} />
            )}
            {shot?.variant.id === 'slam' && (
              <Text label="Caption" value={t.caption} onChange={(caption) => text({ caption })} />
            )}
            <Row
              label="Brand"
              dim={t.hookBrandOff}
              end={
                <IconButton
                  look="small"
                  aria-label={t.hookBrandOff ? 'Show brand in hook' : 'Hide brand in hook'}
                  aria-pressed={!t.hookBrandOff}
                  onClick={() => text({ hookBrandOff: !t.hookBrandOff })}
                >
                  {t.hookBrandOff ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </IconButton>
              }
            >
              <input
                value={t.brand}
                aria-label="Brand"
                onChange={(e) => text({ brand: e.target.value })}
                className={FIELD}
              />
            </Row>
            <Text label="Version" value={t.version} onChange={(version) => text({ version })} />
          </>
        )}
        {kind === 'pair' && (
          <>
            <Text label="Brand" value={t.brand} onChange={(brand) => text({ brand })} />
            <Text label="Partner" value={t.partner} onChange={(partner) => text({ partner })} />
          </>
        )}
        {kind === 'input' && (
          <>
            <Text label="Label" value={t.ask} onChange={(ask) => text({ ask })} />
            <Text label="Text" value={t.prompt} onChange={(prompt) => text({ prompt })} />
            {shot?.variant.id === 'chat' && (
              <Text label="Reply" value={t.reply} onChange={(reply) => text({ reply })} />
            )}
          </>
        )}
        {kind === 'working' &&
          t.steps.map((step, i) => (
            <Text
              key={i}
              label={`Step ${i + 1}`}
              value={step}
              onChange={(v) => text({ steps: t.steps.map((s, k) => (k === i ? v : s)) })}
            />
          ))}
        {kind === 'wall' && (
          <Text label="Label" value={t.wall} onChange={(wall) => text({ wall })} />
        )}
        {kind === 'features' && (
          <>
            {t.features.map((f, i) => {
              const pic = (f.pic ?? i) % Math.max(1, story.thumbs.length);
              const move = (by: number) => {
                const list = t.features.map((x, k) => ({ ...x, pic: x.pic ?? k }));
                [list[i], list[i + by]] = [list[i + by], list[i]];
                text({ features: list });
              };
              return (
                <div
                  key={i}
                  className="space-y-1.5 border-t-2 border-[#0c0e12] pt-2.5 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Next picture"
                      aria-label={`Change the picture of highlight ${i + 1}`}
                      disabled={story.thumbs.length < 2}
                      onClick={() => feature(i, { pic: (pic + 1) % story.thumbs.length })}
                      className="h-9 w-14 shrink-0 overflow-hidden rounded border border-canvas-border hover:border-emerald-400 disabled:hover:border-canvas-border"
                    >
                      {story.thumbs[pic] && (
                        <img src={story.thumbs[pic]} alt="" className="size-full object-cover" />
                      )}
                    </button>
                    <span className="flex-1 pl-1 text-[11px] text-canvas-muted-foreground/70">
                      {i + 1}
                    </span>
                    <IconButton
                      look="small"
                      aria-label={`Move highlight ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => move(-1)}
                      className="disabled:opacity-30"
                    >
                      <ArrowUp className="size-3.5" />
                    </IconButton>
                    <IconButton
                      look="small"
                      aria-label={`Move highlight ${i + 1} down`}
                      disabled={i === t.features.length - 1}
                      onClick={() => move(1)}
                      className="disabled:opacity-30"
                    >
                      <ArrowDown className="size-3.5" />
                    </IconButton>
                    <IconButton
                      look="small"
                      aria-label={`Remove highlight ${i + 1}`}
                      onClick={() => text({ features: t.features.filter((_, k) => k !== i) })}
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </div>
                  <Text label="Title" value={f.title} onChange={(title) => feature(i, { title })} />
                  <Text
                    label="Line"
                    value={f.body}
                    onChange={(body) => feature(i, { body })}
                    lines={2}
                  />
                  <Text label="Badge" value={f.tag} onChange={(tag) => feature(i, { tag })} />
                </div>
              );
            })}
            <button
              type="button"
              disabled={t.features.length >= MAX_FEATURES}
              onClick={() =>
                text({ features: [...t.features, { title: 'New highlight', body: '', tag: '' }] })
              }
              className={`${BUTTON} w-full`}
            >
              Add highlight
            </button>
          </>
        )}
        {kind === 'stats' && (
          <>
            {t.stats.map((s, i) => (
              <div key={i} className="space-y-1.5 pb-1.5">
                <Text
                  label={`${i + 1}. Number`}
                  value={s.value}
                  onChange={(value) => stat(i, { value })}
                />
                <Text label="Label" value={s.label} onChange={(label) => stat(i, { label })} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={t.stats.length >= 3}
                onClick={() => text({ stats: [...t.stats, { value: '100%', label: '' }] })}
                className={BUTTON}
              >
                Add number
              </button>
              <button
                type="button"
                disabled={t.stats.length === 0}
                onClick={() => text({ stats: t.stats.slice(0, -1) })}
                className={BUTTON}
              >
                Remove last
              </button>
            </div>
          </>
        )}
        {kind === 'design' && (
          <Text
            label="Label"
            value={t.designLabel}
            onChange={(designLabel) => text({ designLabel })}
          />
        )}
        {kind === 'outro' && (
          <>
            <Text
              label="Tagline"
              value={t.tagline}
              onChange={(tagline) => text({ tagline })}
              lines={2}
            />
            <Text label="Link" value={t.link} onChange={(link) => text({ link })} />
          </>
        )}
      </div>
    </div>
  );
}
