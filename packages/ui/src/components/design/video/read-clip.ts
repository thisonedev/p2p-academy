import type { ICFrameSheet } from '../render/layout.js';

// A video file's opening seconds, kept as one picture of its frames side by side. A video is then
// stored and drawn like any picture, and any frame of it can be drawn at once, which saving a
// video frame by frame needs.

/** How much of a video is kept, how often a frame is taken, and how wide a frame is. */
export const CLIP_SECONDS = 4;
const FPS = 12;
// Wide enough to stay sharp where a style shows the screen at more than twice its size.
const WIDE = 1080;
const COLS = 8;

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

function seek(video: HTMLVideoElement, at: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    video.addEventListener('error', () => reject(new Error('Could not read that video.')), {
      once: true,
    });
    video.currentTime = at;
  });
}

/** Reads a few seconds of a video file, from `from` seconds in, into a sheet of its frames. */
export async function readClip(
  file: File,
  from = 0,
): Promise<{ name: string; url: string; clip: ICFrameSheet }> {
  const src = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('That file is not a video this app can read.'));
      video.src = src;
    });
    if (!video.videoWidth || !video.videoHeight) throw new Error('That video has no picture.');
    const scale = Math.min(1, WIDE / video.videoWidth);
    const w = even(video.videoWidth * scale);
    const h = even(video.videoHeight * scale);
    const length = Number.isFinite(video.duration) ? video.duration : from + CLIP_SECONDS;
    const start = Math.max(0, Math.min(from, length - 1 / FPS));
    const frames = Math.max(1, Math.min(CLIP_SECONDS * FPS, Math.floor((length - start) * FPS)));
    const sheet = document.createElement('canvas');
    sheet.width = w * Math.min(COLS, frames);
    sheet.height = h * Math.ceil(frames / COLS);
    const g = sheet.getContext('2d');
    if (!g) throw new Error('Could not read that video.');
    let poster = '';
    for (let k = 0; k < frames; k++) {
      // A touch inside the frame's time, so a seek never lands on the one before it.
      await seek(video, Math.min(length - 0.01, start + k / FPS + 0.001));
      g.drawImage(video, (k % COLS) * w, Math.floor(k / COLS) * h, w, h);
      if (k === 0) {
        const first = document.createElement('canvas');
        first.width = 320;
        first.height = even((320 * h) / w);
        first.getContext('2d')?.drawImage(video, 0, 0, first.width, first.height);
        poster = first.toDataURL('image/jpeg', 0.8);
      }
    }
    return {
      name: file.name,
      url: sheet.toDataURL('image/jpeg', 0.82),
      clip: { frames, cols: Math.min(COLS, frames), w, h, fps: FPS, poster },
    };
  } finally {
    URL.revokeObjectURL(src);
  }
}
