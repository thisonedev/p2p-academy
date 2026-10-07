'use client';

import { Shuffle, Volume2, VolumeX } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ICON, Row, Switch } from './design-controls.js';
import type { ICSound } from './design-layout.js';
import { Segments } from './design-segments.js';
import {
  type Cue,
  FX_LEVELS,
  mixSound,
  otherTrack,
  SOUND_GROUPS,
  SOUND_KINDS,
  type SoundKind,
  TAKES,
  TEXT_SOUNDS,
  trackOf,
  tracksAt,
} from './design-sound.js';
import { ThemedSelect } from './themed-select.js';

// What the Video and Motion tabs share for sound: the preview's playback and the controls.

/** The part of a player's clock that sound follows. */
export interface SoundClock {
  t: number;
  playing: boolean;
  /** Silences the preview. The saved video keeps its sound. */
  muted?: boolean;
}

let speaker: AudioContext | null = null;

/** Plays the video's sound in step with its clock: a pause, a jump or a new loop is followed
 *  within a moment. The sound is mixed again a beat after the video or its settings change. */
export function useSound(
  cues: Cue[],
  length: number,
  sound: ICSound,
  /** The video's speed, which some tracks need; see `tracksAt`. */
  pace: number,
  player: SoundClock,
  silent = false,
): void {
  const [mix, setMix] = useState<AudioBuffer | null>(null);
  // The same sounds in a new list are not a reason to mix and start over.
  const same = JSON.stringify(cues);
  useEffect(() => {
    if (silent) {
      setMix(null);
      return;
    }
    let live = true;
    // The old mix is dropped at once, so a new style never starts on the last one's sounds.
    setMix(null);
    const wait = setTimeout(() => {
      void mixSound(cues, length, sound, pace)
        .catch(() => null)
        .then((buffer) => {
          if (live) setMix(buffer);
        });
    }, 200);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [same, length, sound, pace, silent]);
  useEffect(() => {
    if (!mix) return;
    speaker ??= new AudioContext();
    const ctx = speaker;
    // A browser keeps sound off until the person has clicked or pressed a key on the page.
    const wake = () => void ctx.resume();
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    let playing: { src: AudioBufferSourceNode; gain: GainNode; from: number; at: number } | null =
      null;
    const stop = () => {
      if (!playing) return;
      const { src, gain } = playing;
      // A short fade, since a sound cut dead clicks.
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.012);
      src.stop(ctx.currentTime + 0.08);
      playing = null;
    };
    let raf = requestAnimationFrame(function tick() {
      const want = player.playing && !player.muted && ctx.state === 'running';
      const due = playing ? playing.from + ctx.currentTime - playing.at : 0;
      if (playing && (!want || Math.abs(due - player.t) > 0.15)) stop();
      if (want && !playing && player.t < mix.duration) {
        const src = ctx.createBufferSource();
        src.buffer = mix;
        const gain = ctx.createGain();
        src.connect(gain).connect(ctx.destination);
        src.start(0, player.t);
        playing = { src, gain, from: player.t, at: ctx.currentTime };
      }
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(raf);
      stop();
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [mix, player]);
}

/** The icon for the Sound section's title: another track that fits the video's speed. The
 *  Style section's own shuffle leaves the music alone. */
export function MusicShuffle({
  sound,
  pace,
  set,
}: {
  sound: ICSound;
  pace: number;
  set: (patch: Partial<ICSound>) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => set({ music: otherTrack(sound.music, pace), musicOff: false })}
      title="Shuffle music"
      aria-label="Shuffle music"
      className="rounded p-0.5 text-canvas-muted-foreground hover:text-canvas-foreground"
    >
      <Shuffle className="size-3.5" />
    </button>
  );
}

/** The mute button beside a player's play button. `className` and `icon` fit it to that row. */
export function MuteButton({
  player,
  className = 'flex size-7 items-center justify-center rounded-md border border-canvas-border hover:bg-canvas-muted',
  icon = 'size-3.5',
}: {
  player: SoundClock;
  className?: string;
  icon?: string;
}) {
  const [muted, setMuted] = useState(!!player.muted);
  return (
    <button
      type="button"
      onClick={() => {
        player.muted = !muted;
        setMuted(!muted);
      }}
      aria-label={muted ? 'Unmute' : 'Mute'}
      aria-pressed={muted}
      className={className}
    >
      {muted ? <VolumeX className={icon} /> : <Volume2 className={icon} />}
    </button>
  );
}

/** A person's own music is kept inside the design, so a very large file is left out. */
const MAX_MUSIC = 12 * 1024 * 1024;

/** One line of the Sound block: what plays, and a switch that turns it off without losing it. */
function SoundRow({
  label,
  on,
  onToggle,
  children,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Row label={label} dim={!on} end={<Switch label={label} on={on} onChange={onToggle} />}>
      {children}
    </Row>
  );
}

/** The controls for a video's music and effects: one choice and one switch each, then what words
 *  sound like, the opening's own switch, and a named toggle for every effect in rows by group. */
export function useSoundControls(
  sound: ICSound,
  pace: number,
  set: (patch: Partial<ICSound>) => void,
): ReactNode {
  const file = useRef<HTMLInputElement>(null);
  const addMusic = (f: File | undefined) => {
    if (!f || f.size > MAX_MUSIC) return;
    const reader = new FileReader();
    reader.onload = () =>
      set({ music: 'own', musicOff: false, own: { name: f.name, url: String(reader.result) } });
    reader.readAsDataURL(f);
  };
  const flip = (id: SoundKind) =>
    set({ off: sound.off.includes(id) ? sound.off.filter((x) => x !== id) : [...sound.off, id] });
  const level = FX_LEVELS.reduce((best, l) =>
    Math.abs(l.vol - sound.fxVol) < Math.abs(best.vol - sound.fxVol) ? l : best,
  );
  return (
    <>
      <SoundRow
        label="Music"
        on={!sound.musicOff}
        onToggle={() => set({ musicOff: !sound.musicOff })}
      >
        <ThemedSelect
          value={sound.music === 'own' && sound.own ? 'own' : trackOf(sound.music, pace).id}
          options={[
            ...tracksAt(pace).map((m) => ({ value: m.id, label: m.name })),
            ...(sound.own ? [{ value: 'own', label: sound.own.name }] : []),
            { value: 'add', label: 'Your own file…' },
          ]}
          onChange={(music) => (music === 'add' ? file.current?.click() : set({ music }))}
        />
      </SoundRow>
      <SoundRow label="Effects" on={sound.fx} onToggle={() => set({ fx: !sound.fx })}>
        <ThemedSelect
          value={level.id}
          options={FX_LEVELS.map((l) => ({ value: l.id, label: l.name }))}
          onChange={(id) => set({ fxVol: FX_LEVELS.find((l) => l.id === id)?.vol ?? sound.fxVol })}
        />
      </SoundRow>
      <div className={`space-y-1.5 ${sound.fx ? '' : 'pointer-events-none opacity-40'}`}>
        {(Object.keys(TAKES) as SoundKind[]).map((kind) => {
          const name = SOUND_KINDS.find((k) => k.id === kind)?.name ?? kind;
          const count = TAKES[kind]?.length ?? 1;
          const now = (sound.takes?.[kind] ?? 0) % count;
          const pick = (n: number) => set({ takes: { ...sound.takes, [kind]: n } });
          return (
            <Row key={kind} label={name}>
              <span className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1">
                  <ThemedSelect
                    value={String(now)}
                    options={Array.from({ length: count }, (_, n) => ({
                      value: String(n),
                      label: `${name} ${n + 1}`,
                    }))}
                    onChange={(n) => pick(Number(n))}
                  />
                </span>
                <button
                  type="button"
                  title={`Another ${name.toLowerCase()}`}
                  aria-label={`Another ${name.toLowerCase()}`}
                  onClick={() => pick((now + 1 + Math.floor(Math.random() * (count - 1))) % count)}
                  className={ICON}
                >
                  <Shuffle className="size-3.5" />
                </button>
              </span>
            </Row>
          );
        })}
        <Row label="Text">
          <ThemedSelect
            value={TEXT_SOUNDS.find((t) => t.id === sound.text)?.id ?? 'none'}
            options={TEXT_SOUNDS.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(id) => set({ text: id === 'none' ? undefined : id })}
          />
        </Row>
        <Row
          label="Intro"
          end={
            <Switch
              label="Intro"
              on={!sound.off.includes('intro')}
              onChange={() => flip('intro')}
            />
          }
        />
        {SOUND_GROUPS.map((group) => (
          <div key={group.name} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-16 shrink-0 text-canvas-muted-foreground">{group.name}</span>
            <div className="min-w-0 flex-1">
              <Segments
                options={group.ids.map((id) => ({
                  key: id,
                  label: SOUND_KINDS.find((k) => k.id === id)?.name ?? id,
                  on: !sound.off.includes(id),
                  onPick: () => flip(id),
                }))}
              />
            </div>
          </div>
        ))}
      </div>
      <input
        ref={file}
        type="file"
        accept="audio/*"
        hidden
        aria-label="Your own music file"
        onChange={(e) => {
          addMusic(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </>
  );
}
