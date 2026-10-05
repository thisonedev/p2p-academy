// H.264 video from canvas frames, using the encoder built into Chromium and a small MP4 writer.
// Nothing leaves the machine and nothing is downloaded.

type Part = number[] | Uint8Array;

const u16 = (n: number) => [(n >> 8) & 255, n & 255];
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const text = (s: string) => [...s].map((c) => c.charCodeAt(0));
const zeros = (n: number) => new Array<number>(n).fill(0);

function join(parts: Part[]): Uint8Array {
  const size = parts.reduce((n, p) => n + p.length, 0);
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
}

function box(type: string, ...parts: Part[]): Uint8Array {
  const body = join(parts);
  return join([u32(body.length + 8), text(type), body]);
}

const full = (type: string, version: number, flags: number, ...parts: Part[]) =>
  box(type, [version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255], ...parts);

const MATRIX = [...u32(0x10000), ...zeros(12), ...u32(0x10000), ...zeros(12), ...u32(0x40000000)];

interface Sample {
  data: Uint8Array;
  key: boolean;
}

interface Movie {
  width: number;
  height: number;
  fps: number;
  /** The encoder's avcC record. */
  description: Uint8Array;
  /** H.273 codes for primaries, transfer and matrix, when the encoder reports them. */
  color?: [number, number, number, boolean];
  samples: Sample[];
}

/** One video track, every frame the same length, with the index before the frames so it streams. */
function mux(m: Movie): Uint8Array {
  const scale = m.fps * 100;
  const length = m.samples.length * 100;
  const moov = (offset: number) => {
    const avc1 = box(
      'avc1',
      zeros(6),
      u16(1),
      zeros(16),
      u16(m.width),
      u16(m.height),
      u32(0x480000),
      u32(0x480000),
      zeros(4),
      u16(1),
      zeros(32),
      u16(0x18),
      [0xff, 0xff],
      box('avcC', m.description),
      m.color
        ? box('colr', text('nclx'), u16(m.color[0]), u16(m.color[1]), u16(m.color[2]), [
            m.color[3] ? 0x80 : 0,
          ])
        : [],
    );
    const keys = m.samples.flatMap((s, i) => (s.key ? [i + 1] : []));
    const stbl = box(
      'stbl',
      full('stsd', 0, 0, u32(1), avc1),
      full('stts', 0, 0, u32(1), u32(m.samples.length), u32(100)),
      full('stss', 0, 0, u32(keys.length), keys.flatMap(u32)),
      full('stsc', 0, 0, u32(1), u32(1), u32(m.samples.length), u32(1)),
      full(
        'stsz',
        0,
        0,
        u32(0),
        u32(m.samples.length),
        m.samples.flatMap((s) => u32(s.data.length)),
      ),
      full('stco', 0, 0, u32(1), u32(offset)),
    );
    const minf = box(
      'minf',
      full('vmhd', 0, 1, zeros(8)),
      box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))),
      stbl,
    );
    const mdia = box(
      'mdia',
      full('mdhd', 0, 0, u32(0), u32(0), u32(scale), u32(length), u16(0x55c4), u16(0)),
      full('hdlr', 0, 0, u32(0), text('vide'), zeros(12), text('VideoHandler'), [0]),
      minf,
    );
    const tkhd = full(
      'tkhd',
      0,
      3,
      u32(0),
      u32(0),
      u32(1),
      u32(0),
      u32(length),
      zeros(8),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      MATRIX,
      u32(m.width << 16),
      u32(m.height << 16),
    );
    const mvhd = full(
      'mvhd',
      0,
      0,
      u32(0),
      u32(0),
      u32(scale),
      u32(length),
      u32(0x10000),
      u16(0x100),
      zeros(10),
      MATRIX,
      zeros(24),
      u32(2),
    );
    return box('moov', mvhd, box('trak', tkhd, mdia));
  };
  const ftyp = box('ftyp', text('isom'), u32(0x200), text('isomiso2avc1mp41'));
  const head = ftyp.length + moov(0).length;
  return join([ftyp, moov(head + 8), box('mdat', ...m.samples.map((s) => s.data))]);
}

// Each level's frame size and speed limits in macroblocks, smallest first.
const LEVELS: [string, number, number][] = [
  ['1f', 3600, 108000],
  ['28', 8192, 245760],
  ['2a', 8704, 522240],
  ['32', 22080, 589824],
  ['33', 36864, 983040],
  ['34', 36864, 2073600],
];

const CODES: Record<string, number> = {
  bt709: 1,
  bt470bg: 5,
  smpte170m: 6,
  'iec61966-2-1': 13,
  rgb: 0,
};

async function pickConfig(width: number, height: number, fps: number): Promise<VideoEncoderConfig> {
  if (typeof VideoEncoder === 'undefined') throw new Error('This browser has no video encoder.');
  const blocks = Math.ceil(width / 16) * Math.ceil(height / 16);
  const level = LEVELS.find(([, frame, rate]) => blocks <= frame && blocks * fps <= rate)?.[0];
  if (!level) throw new Error('That size is too large for video.');
  const bitrate = Math.min(24e6, Math.round(width * height * 4.5 * Math.sqrt(fps / 30)));
  // High profile first, then Main, then Baseline, whichever this machine can encode.
  for (const profile of ['6400', '4d00', '42e0']) {
    const config: VideoEncoderConfig = {
      codec: `avc1.${profile}${level}`,
      width,
      height,
      bitrate,
      framerate: fps,
      latencyMode: 'quality',
      avc: { format: 'avc' },
    };
    if ((await VideoEncoder.isConfigSupported(config)).supported) return config;
  }
  throw new Error('This machine cannot encode H.264 video.');
}

export interface VideoJob {
  canvas: HTMLCanvasElement;
  fps: number;
  seconds: number;
  /** Paints the frame at `t` seconds onto the canvas. */
  draw: (t: number) => void;
  onProgress?: (done: number) => void;
}

/** Draws and encodes every frame, then returns the finished MP4. Canvas sides must be even. */
export async function encodeMp4(job: VideoJob): Promise<Blob> {
  const { canvas, fps } = job;
  const config = await pickConfig(canvas.width, canvas.height, fps);
  const samples: Sample[] = [];
  let description: Uint8Array | null = null;
  let color: Movie['color'];
  let failed: Error | null = null;
  const encoder = new VideoEncoder({
    output(chunk, meta) {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      samples.push({ data, key: chunk.type === 'key' });
      const dc = meta?.decoderConfig;
      if (dc?.description && !description) {
        const d = dc.description;
        description = ArrayBuffer.isView(d)
          ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength).slice()
          : new Uint8Array(d).slice();
        const cs = dc.colorSpace;
        if (cs?.primaries && cs.transfer && cs.matrix) {
          color = [
            CODES[cs.primaries] ?? 1,
            CODES[cs.transfer] ?? 1,
            CODES[cs.matrix] ?? 1,
            !!cs.fullRange,
          ];
        }
      }
    },
    error(e) {
      failed = e;
    },
  });
  encoder.configure(config);
  const total = Math.round(job.seconds * fps);
  const tick = Math.round(1e6 / fps);
  for (let i = 0; i < total && !failed; i++) {
    job.draw(i / fps);
    const frame = new VideoFrame(canvas, { timestamp: i * tick, duration: tick, alpha: 'discard' });
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    // Lets the encoder catch up, and the page repaint its progress.
    if (encoder.encodeQueueSize > 4 || i % 8 === 0) await new Promise((r) => setTimeout(r, 0));
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 2));
    job.onProgress?.((i + 1) / total);
  }
  if (!failed) await encoder.flush();
  encoder.close();
  if (failed) throw failed;
  if (!description) throw new Error('The encoder returned no video.');
  const file = mux({
    width: canvas.width,
    height: canvas.height,
    fps,
    description,
    color,
    samples,
  });
  return new Blob([file.buffer as ArrayBuffer], { type: 'video/mp4' });
}
