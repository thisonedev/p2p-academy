'use client';

import { Shuffle, ImagePlus, Loader2, X, RotateCcw } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { type ICVideo, type ICSound, type ICUpload } from '../render/layout.js';
import type { StudioApi } from '../panels/studio-api.js';
import { readClip } from './read-clip.js';
import { readImage } from '../render/read-image.js';
import { NEW_SOUND, trackOf, tracksAt, quickPace, otherTakes } from '../sound/sound.js';
import { useSoundControls, MusicShuffle } from '../sound/sound-panel.js';
import { PreviewSelect } from './video-previews.js';
import { Row } from '../panels/controls.js';
import { Segments } from '../panels/segments.js';
import { NEW_VIDEO } from './storyboards.js';
import {
  shuffle,
  PACES,
  CUTS,
  ENDINGS,
  MARKS,
  POINTERS,
  CLICKS,
  type Place,
  lookId,
  LOOKS,
  FEELS,
  PACE_NAMES,
} from './video.js';
import { ThemedSelect } from '../../ui/themed-select.js';
import { IconButton, iconButtonClass } from '../../ui/icon-button.js';
import { FoldSection } from '../panels/fold-section.js';
import type { Clock, Story } from './story.js';
import { VideoSlide, patchVideo } from './video-slide.js';
import { CENTERED, ClipStart, PlaceSheet } from './place-sheet.js';
import './video-scenes.js';
import './video-styles.js';

/** Sections the person opened or folded by hand, by title, kept while the studio is open. */
const OPENED = new Map<string, boolean>();

/** A section that folds shut from its title, as the Design tab's sections do. */
function Block({
  title,
  children,
  action,
  quiet,
  id,
  shut,
}: {
  title: string;
  children: ReactNode;
  /** A control beside the fold arrow at the end of the title row. */
  action?: ReactNode;
  /** Draws the body faint, for a slide that is switched off. */
  quiet?: boolean;
  id?: string;
  /** Starts folded, until the person opens it. A slide that is switched off does. */
  shut?: boolean;
}) {
  const [, refold] = useState(0);
  const open = OPENED.get(title) ?? !shut;
  return (
    <FoldSection
      title={title}
      open={open}
      action={action}
      id={id}
      quiet={quiet}
      onToggle={() => {
        OPENED.set(title, !open);
        refold((n) => n + 1);
      }}
    >
      {children || undefined}
    </FoldSection>
  );
}

/** The Video tab: what every slide shares, its pictures, then a section for each slide. */
export function VideoPanel({
  api,
  story,
  player,
  slide,
  onSlide,
}: {
  api: StudioApi;
  story: Story | null;
  player: Clock;
  /** The slide picked here or in the strip under the canvas. */
  slide: string;
  onSlide: (id: string) => void;
}) {
  const video = api.layout.video ?? NEW_VIDEO;
  const set = (patch: Partial<ICVideo>) => patchVideo(api, (v) => ({ ...v, ...patch }));
  const setSound = (patch: Partial<ICSound>) =>
    patchVideo(api, (v) => ({ ...v, sound: { ...(v.sound ?? NEW_SOUND), ...patch } }));
  const soundControls = useSoundControls(video.sound ?? NEW_SOUND, video.pace, setSound);

  // A slide the design gives nothing to show is left out.
  const ready = story?.slides.filter((sl) => sl.ready) ?? [];
  const picked = ready.find((sl) => sl.id === slide) ?? ready[0];

  const reshuffle = () => {
    if (!story) return;
    const seed = video.seed + 1;
    const next = shuffle(story.spec, seed);
    const variants = { ...video.variants };
    for (const s of next.scenes) if (s.variant) variants[s.kind] = s.variant;
    // The music is not this shuffle's to change. A track only fits some speeds, so with music
    // on, the new speed is one the playing track fits. The fastest speed is left for the person
    // to pick: the shuffle only stays on it, never moves to it.
    const sound = video.sound ?? NEW_SOUND;
    const playing =
      sound.musicOff || sound.music === 'own' ? null : trackOf(sound.music, video.pace);
    const fits = PACES.filter(
      (p) =>
        (!playing || tracksAt(p).includes(playing)) && (!quickPace(p) || quickPace(video.pace)),
    );
    const pace = fits.includes(next.pace) ? next.pace : (fits[seed % fits.length] ?? video.pace);
    set({
      look: next.skin.look,
      feel: next.feel,
      pace,
      variants,
      seed,
      cut: other(CUTS, video.cut),
      ending: other(ENDINGS, story.text.ending),
      mark: other(MARKS, story.text.mark),
      pointer: other(POINTERS, video.pointer),
      click: other(CLICKS, video.click),
      // The effects' recordings are the shuffle's to change. The music is not.
      sound: { ...sound, takes: otherTakes(sound) },
    });
    player.t = 0;
    player.playing = true;
  };

  // The upload whose zoom and position the sliders under the grid set.
  const [placing, setPlacing] = useState<number | null>(null);
  const placed = placing === null ? undefined : video.media[placing];
  // Null puts the picture back around its middle.
  const place = (place: Place | null) =>
    set({
      media: video.media.map((m, k) => {
        if (k !== placing) return m;
        const { place: _was, ...rest } = m;
        return place ? { ...rest, place } : rest;
      }),
    });
  // Videos wait here to be given a start, one at a time. Pictures are added at once.
  const [waiting, setWaiting] = useState<File[]>([]);
  const [reading, setReading] = useState(0);
  const addMedia = (got: ICUpload[]) => {
    if (got.length) patchVideo(api, (v) => ({ ...v, media: [...v.media, ...got] }));
  };
  const addPictures = async (files: FileList | null) => {
    const all = Array.from(files ?? []);
    setWaiting((w) => [...w, ...all.filter((f) => f.type.startsWith('video/'))]);
    const read = await Promise.all(
      all
        .filter((f) => !f.type.startsWith('video/'))
        .map((f) => readImage(f, 1600).catch(() => null)),
    );
    addMedia(read.filter((x) => x !== null).map((x) => ({ name: x.name, url: x.url })));
  };
  const addClip = (file: File, from: number) => {
    setWaiting((w) => w.filter((f) => f !== file));
    setReading((n) => n + 1);
    void readClip(file, from)
      .then((clip) => addMedia([clip]))
      .catch(() => undefined)
      .finally(() => setReading((n) => n - 1));
  };

  return (
    <>
      <Block
        title="Style"
        action={
          <IconButton
            look="small"
            onClick={reshuffle}
            title="Shuffle"
            aria-label="Shuffle"
          >
            <Shuffle className="size-3.5" />
          </IconButton>
        }
      >
        <Row label="Look">
          <ThemedSelect
            value={lookId(video.look)}
            options={LOOKS.map((l) => ({ value: l.id, label: l.name }))}
            onChange={(look) => set({ look })}
          />
        </Row>
        <Row label="Motion">
          <ThemedSelect
            value={video.feel}
            options={FEELS.map((f) => ({ value: f.id, label: f.name }))}
            onChange={(feel) => set({ feel })}
          />
        </Row>
        <Row label="Cuts">
          <ThemedSelect
            value={CUTS.find((x) => x.id === video.cut)?.id ?? CUTS[0].id}
            options={CUTS.map((x) => ({ value: x.id, label: x.name }))}
            onChange={(cut) => set({ cut })}
          />
        </Row>
        <Row label="Speed">
          <ThemedSelect
            value={String(video.pace)}
            options={PACES.map((p, i) => ({ value: String(p), label: PACE_NAMES[i] }))}
            onChange={(pace) => set({ pace: Number(pace) })}
          />
        </Row>
        <Row label="Pointer">
          <PreviewSelect
            set="pointer"
            what="pointer"
            value={video.pointer ?? POINTERS[0].id}
            list={POINTERS}
            onPick={(pointer) => set({ pointer })}
          />
        </Row>
        <Row label="Click">
          <PreviewSelect
            set="click"
            what="click"
            value={video.click ?? CLICKS[0].id}
            list={CLICKS}
            onPick={(click) => set({ click })}
          />
        </Row>
      </Block>
      <Block
        title="Sound"
        action={<MusicShuffle sound={video.sound ?? NEW_SOUND} pace={video.pace} set={setSound} />}
      >
        {soundControls}
      </Block>
      <Block
        title="Images/videos"
        action={
          <label title="Add images or videos" className={iconButtonClass('small', 'cursor-pointer')}>
            <ImagePlus className="size-3.5" />
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              aria-label="Add images or videos"
              onChange={(e) => {
                void addPictures(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        }
      >
        {waiting[0] && (
          <ClipStart
            key={`${waiting[0].name}${waiting[0].size}`}
            file={waiting[0]}
            onAdd={(from) => addClip(waiting[0], from)}
            onCancel={() => setWaiting((w) => w.slice(1))}
          />
        )}
        {reading > 0 && (
          <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] text-canvas-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Reading video…
          </div>
        )}
        {video.media.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {video.media.map((m, i) => (
              <div key={`${m.name}${i}`} className="group relative">
                <button
                  type="button"
                  title={m.name}
                  aria-pressed={i === placing}
                  onClick={() => setPlacing(i === placing ? null : i)}
                  className={`block aspect-video w-full overflow-hidden rounded border ${
                    i === placing ? 'border-primary' : 'border-canvas-border'
                  }`}
                >
                  <img src={m.clip?.poster ?? m.url} alt={m.name} className="size-full object-cover" />
                </button>
                <button
                  type="button"
                  title={`Remove ${m.name}`}
                  aria-label={`Remove ${m.name}`}
                  onClick={() => {
                    setPlacing(null);
                    set({ media: video.media.filter((_, k) => k !== i) });
                  }}
                  className="absolute right-0.5 top-0.5 hidden rounded bg-black/70 p-0.5 text-white group-hover:block"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {placed && placing !== null && (
          <PlaceSheet
            src={placed.clip?.poster ?? placed.url}
            name={placed.name}
            place={placed.place ?? CENTERED}
            moved={placed.place !== undefined}
            onPlace={place}
            onClose={() => setPlacing(null)}
          />
        )}
      </Block>
      {story && picked && (
        <Block
          title="Slides"
          action={
            // Shown once a word was typed over, which is the only time there is something to undo.
            Object.keys(video.text).length > 0 && (
              <IconButton
                look="small"
                onClick={() => patchVideo(api, (v) => ({ ...v, text: {} }))}
                title="Use the design's words"
                aria-label="Use the design's words"
              >
                <RotateCcw className="size-3.5" />
              </IconButton>
            )
          }
        >
          <Segments
            cols={3}
            options={ready.map((sl) => ({
              key: sl.id,
              label: sl.name,
              on: sl.id === picked.id,
              struck: !sl.on,
              onPick: () => {
                const shot = story.built.shots.find((s) => s.id === sl.id);
                if (shot) player.t = shot.start;
                onSlide(sl.id);
              },
            }))}
          />
          <VideoSlide api={api} story={story} picked={picked} />
        </Block>
      )}
    </>
  );
}

/** One of the list at random that is not the one in use. */
function other(list: readonly { id: string }[], now: string | undefined): string {
  const rest = list.filter((x) => x.id !== (now ?? list[0].id));
  return rest[Math.floor(Math.random() * rest.length)].id;
}
