// A video's sound: the music under it and the effects its motion makes. Slides say when a sound
// happens, so the sound follows a shuffle, a speed change or a new style with nothing to move.

import type { AcademyAPI } from '@academy/validation';
import type { ICSound } from './design-layout.js';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const SOUND_RATE = 48000;

/** The effects a person can switch off one by one: each recording has its own switch, and
 *  Intro/outro covers whatever the opening and the closing slide of a video play. */
export const SOUND_KINDS = [
  { id: 'intro', name: 'Intro/outro' },
  { id: 'whoosh', name: 'Whoosh' },
  { id: 'type', name: 'Typing' },
  { id: 'click', name: 'Click' },
  { id: 'pop', name: 'Pop' },
  { id: 'ding', name: 'Ding' },
  { id: 'reply', name: 'Reply' },
  { id: 'shine', name: 'Shine' },
  { id: 'riser', name: 'Riser' },
  { id: 'chime', name: 'Chime' },
  { id: 'hit', name: 'Hit' },
] as const;

export type SoundKind = (typeof SOUND_KINDS)[number]['id'];

interface Effect {
  kind: SoundKind;
  /** One recording, so a kind of move always sounds like itself. Keys have two, as typing does. */
  files: string[];
  gain: number;
  /** How far each one strays in pitch and loudness, 0 to 1. */
  vary: number;
}

const EFFECTS = {
  whoosh: { kind: 'whoosh', files: ['whoosh-1'], gain: 0.34, vary: 0.06 },
  // Things sliding in play the whoosh, a little quieter. It is one sound with one switch.
  slide: { kind: 'whoosh', files: ['whoosh-1'], gain: 0.28, vary: 0.08 },
  key: { kind: 'type', files: ['key-1', 'key-2'], gain: 0.2, vary: 0.14 },
  click: { kind: 'click', files: ['click-1'], gain: 0.36, vary: 0.03 },
  pop: { kind: 'pop', files: ['pop-1'], gain: 0.32, vary: 0.06 },
  ding: { kind: 'ding', files: ['ding-1'], gain: 0.26, vary: 0 },
  // A chat's answer arriving. Its last recording is the ding, which it used to share.
  reply: { kind: 'reply', files: ['reply-3'], gain: 0.26, vary: 0 },
  riser: { kind: 'riser', files: ['riser-1'], gain: 0.3, vary: 0 },
  shimmer: { kind: 'shine', files: ['shimmer-1'], gain: 0.26, vary: 0 },
  success: { kind: 'chime', files: ['success-1'], gain: 0.26, vary: 0 },
  hit: { kind: 'hit', files: ['hit-1'], gain: 0.5, vary: 0 },
} satisfies Record<string, Effect>;

export type SoundId = keyof typeof EFFECTS;

/** The kinds with more than one recording to choose from. The one picked plays wherever that
 *  kind does, in place of the effect's own file. Each kind listed has a row in the Sound block. */
export const TAKES: Partial<Record<SoundKind, string[]>> = {
  reply: ['reply-3', 'reply-2', 'ding-1'],
};

/** The files an effect plays under these settings. */
const filesOf = (effect: Effect, sound: ICSound): string[] => {
  const takes = TAKES[effect.kind];
  if (!takes) return effect.files;
  return [takes[(sound.takes?.[effect.kind] ?? 0) % takes.length]];
};

/** Another recording for every kind that has several, as a shuffle draws them. */
export const otherTakes = (sound: ICSound): Record<string, number> =>
  Object.fromEntries(
    Object.entries(TAKES).map(([kind, files]) => {
      const now = sound.takes?.[kind] ?? 0;
      const step = 1 + Math.floor(Math.random() * (files.length - 1));
      return [kind, (now + step) % files.length];
    }),
  );

/** One sound at one moment. */
export interface Cue {
  /** Seconds. A slide gives its own time, and the video turns that into the whole video's. */
  at: number;
  sound: SoundId;
  /** Scales the sound's own loudness. */
  gain?: number;
  /** Above 1 plays it higher and shorter. */
  rate?: number;
  /** The sound finishes at `at` instead of starting there, as a build-up into a moment does. */
  ends?: boolean;
  /** The switch that turns it off, when that is not the sound's own. A video's opening sounds
   *  all answer to Intro, whichever recordings they use. */
  kind?: SoundKind;
  /** Words arriving. They are silent unless the person picks a sound for text, which is then
   *  played in place of `sound`. */
  text?: boolean;
}

/** The bundled tracks in the order the list shows them, named for the mood of a market: the
 *  track's id (the end of its file's name), its name, and the speeds it is offered at as a
 *  video's `pace`: 0.85 calm, 1 normal, 1.35 fast, 1.8 very fast. */
const TRACKS: [string, string, number[]][] = [
  ['accumulation', 'Accumulation', [0.85, 1]],
  ['touching-grass', 'Touching grass', [0.85, 1]],
  ['full-send', 'Full send', [1.8]],
  ['higher-lows', 'Higher lows', [1.35]],
  ['breakout', 'Breakout', [1.35]],
  ['the-dip', 'The dip', [1.35]],
  ['send-it', 'Send it', [1.35, 1.8]],
  ['up-only', 'Up only', [1.35, 1.8]],
  ['im-not-selling', "I'm not selling", [1.8]],
];
/** The fastest speed, as a video's `pace`. */
const QUICK_PACE = 1.8;
/** True for the fastest speed, which a shuffle stays on but never moves to. */
export const quickPace = (pace: number) => pace >= QUICK_PACE;
/** The track a video starts with. */
const FIRST_TRACK = 'higher-lows';
/** What the tracks were called before they had names, for videos saved then. */
const OLD_IDS: Record<string, string> = {
  'track-2': 'price-discovery',
  'track-3': 'higher-lows',
  'track-4': 'breakout',
  'track-5': 'full-send',
  'track-6': 'touching-grass',
  'track-7': 'locked-in',
  'track-8': 'moisturized',
  'track-9': 'the-dip',
};

export const MUSIC = TRACKS.map(([id, name, paces]) => ({ id, name, paces, file: `music-${id}` }));

/** The tracks that fit a video at this speed. */
export const tracksAt = (pace: number) =>
  MUSIC.filter((m) => m.paces.some((p) => Math.abs(p - pace) < 0.01));

/** The track a video names, or the first that fits when it names one its speed does not have. */
export const trackOf = (id: string, pace: number) => {
  const fit = tracksAt(pace);
  const now = OLD_IDS[id] ?? id;
  return fit.find((m) => m.id === now) ?? fit.find((m) => m.id === FIRST_TRACK) ?? fit[0];
};

/** Another track that fits the speed, picked at random. */
export function otherTrack(id: string, pace: number): string {
  const rest = tracksAt(pace).filter((m) => m.id !== trackOf(id, pace).id);
  return (rest[Math.floor(Math.random() * rest.length)] ?? trackOf(id, pace)).id;
}

/** How loud the effects are against the music. */
export const FX_LEVELS = [
  { id: 'quiet', name: 'Quiet', vol: 0.45 },
  { id: 'normal', name: 'Normal', vol: 0.8 },
  { id: 'loud', name: 'Loud', vol: 1.2 },
];

/** A video's sound before the person changes anything: every effect but pops, and music once it
 *  is switched on. */
export const NEW_SOUND: ICSound = {
  music: FIRST_TRACK,
  musicOff: true,
  musicVol: 0.7,
  fx: true,
  fxVol: 0.8,
  off: ['pop', 'intro'],
};

/** Marks sounds as a video's opening or closing, so the Intro/outro switch turns them off. */
export const asIntro = (cues: Cue[]): Cue[] => cues.map((q) => ({ ...q, kind: 'intro' }));

/** Marks sounds as words arriving; see `Cue.text`. */
export const asText = (cues: Cue[]): Cue[] => cues.map((q) => ({ ...q, text: true }));

/** What words arriving can sound like. Absent from a video's settings, they are silent. */
export const TEXT_SOUNDS = [
  { id: 'none', name: 'Silent' },
  { id: 'whoosh', name: 'Whoosh' },
  { id: 'pop', name: 'Pop' },
] as const;

/** The switches as the Sound block lays them out, grouped by what makes the sound. */
export const SOUND_GROUPS: { name: string; ids: SoundKind[] }[] = [
  { name: 'Moves', ids: ['whoosh', 'riser'] },
  { name: 'Hands', ids: ['type', 'click'] },
  { name: 'Accents', ids: ['pop', 'ding', 'shine'] },
  { name: 'Moments', ids: ['chime', 'hit', 'reply'] },
];

/** Key presses for text typed between two moments. A press for every letter would blur into a
 *  buzz, so they come at a typist's pace however fast the letters appear. */
export function keys(from: number, to: number, letters: number): Cue[] {
  const n = Math.max(1, Math.min(letters, Math.round((to - from) / 0.085)));
  return Array.from({ length: n }, (_, i) => ({
    at: from + ((to - from) * i) / n,
    sound: 'key' as const,
  }));
}

/** A bundled sound's bytes. The files ship with the desktop app, not the web build, so the
 *  desktop app hands them over by name. A page served on its own looks under /sounds, where
 *  there is nothing unless someone put the files there. */
async function bundled(name: string): Promise<ArrayBuffer> {
  const read = (window as { academy?: AcademyAPI }).academy?.sounds?.read;
  const file = name.startsWith('music-') ? `music/${name.slice(6)}` : `effects/${name}`;
  if (!read) return (await fetch(`${BASE}/sounds/${file}.ogg`)).arrayBuffer();
  const bytes = await read(name);
  if (!bytes) throw new Error(`No sound called ${name}.`);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

const BUNDLED = 'sound:';

async function bytesOf(url: string): Promise<ArrayBuffer> {
  if (url.startsWith(BUNDLED)) return bundled(url.slice(BUNDLED.length));
  if (!url.startsWith('data:')) return (await fetch(url)).arrayBuffer();
  const raw = atob(url.slice(url.indexOf(',') + 1));
  const all = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) all[i] = raw.charCodeAt(i);
  return all.buffer;
}

const LOADED = new Map<string, Promise<AudioBuffer | null>>();

/** A sound file decoded once and kept. A file that cannot be read plays as silence. */
function load(url: string): Promise<AudioBuffer | null> {
  let got = LOADED.get(url);
  if (!got) {
    got = bytesOf(url)
      .then((bytes) => new OfflineAudioContext(2, 1, SOUND_RATE).decodeAudioData(bytes))
      .catch(() => null);
    LOADED.set(url, got);
  }
  return got;
}

const fileUrl = (name: string) => `${BUNDLED}${name}`;

function musicUrl(sound: ICSound, pace: number): string | null {
  if (sound.music === 'own') return sound.own?.url ?? null;
  return fileUrl(trackOf(sound.music, pace).file);
}

/** A number from 0 to 1 that is always the same for the same cue. */
const chance = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** The whole video's sound as one piece of audio, or null when there is nothing to hear. The
 *  preview and the saved file both play this, so they cannot differ. */
export async function mixSound(
  cues: Cue[],
  length: number,
  sound: ICSound,
  pace: number,
): Promise<AudioBuffer | null> {
  const text = TEXT_SOUNDS.find((t) => t.id === sound.text && t.id !== 'none');
  const heard = sound.fx
    ? cues
        .filter((cue) => !cue.text || text)
        // Words play the sound picked for text, and only Intro can switch that off.
        .map((cue, i) => ({
          cue,
          i,
          effect: EFFECTS[cue.text && text ? (text.id as SoundId) : cue.sound] as Effect,
        }))
        .filter(({ cue, effect }) =>
          cue.text
            ? !(cue.kind && sound.off.includes(cue.kind))
            : !sound.off.includes(cue.kind ?? effect.kind),
        )
    : [];
  const track = sound.musicOff ? null : musicUrl(sound, pace);
  if (!track && !heard.length) return null;
  if (!(length > 0)) return null;

  const ctx = new OfflineAudioContext(2, Math.ceil(length * SOUND_RATE), SOUND_RATE);
  // Many effects at once would clip, so the sum passes a limiter.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 4;
  limiter.ratio.value = 16;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  const master = ctx.createGain();
  master.gain.setValueAtTime(1, Math.max(0, length - 0.06));
  master.gain.linearRampToValueAtTime(0, length);
  master.connect(limiter).connect(ctx.destination);

  const music = track ? await load(track) : null;
  if (music) {
    const src = ctx.createBufferSource();
    src.buffer = music;
    src.loop = music.duration < length;
    const gain = ctx.createGain();
    const fade = Math.min(1.6, length / 3);
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(sound.musicVol, Math.min(0.4, length / 4));
    gain.gain.setValueAtTime(sound.musicVol, length - fade);
    gain.gain.linearRampToValueAtTime(0, length);
    src.connect(gain).connect(master);
    src.start(0);
  }

  const names = [...new Set(heard.flatMap(({ effect }) => filesOf(effect, sound)))];
  const takes = new Map(
    await Promise.all(names.map(async (n) => [n, await load(fileUrl(n))] as const)),
  );
  for (const { cue, i, effect } of heard) {
    const files = filesOf(effect, sound);
    const buffer = takes.get(files[i % files.length]);
    if (!buffer) continue;
    const rate = (cue.rate ?? 1) * (1 + (chance(i, 1) - 0.5) * 2 * effect.vary);
    const start = cue.ends ? cue.at - buffer.duration / rate : cue.at;
    if (start >= length) continue;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value =
      effect.gain * (cue.gain ?? 1) * sound.fxVol * 1.25 * (1 - chance(i, 2) * effect.vary * 2);
    src.connect(gain).connect(master);
    // A sound due before the video begins starts part of the way in.
    src.start(Math.max(0, start), Math.max(0, -start) * rate);
  }
  return ctx.startRendering();
}
