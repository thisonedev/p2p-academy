// H.264 video from canvas frames, with AAC sound when the video has some, using the encoders built
// into Chromium and a small MP4 writer.
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
  sound?: Sound;
}

/** AAC frames, each 1024 samples long. */
interface Sound {
  rate: number;
  channels: number;
  /** The encoder's AudioSpecificConfig. */
  config: Uint8Array;
  frames: Uint8Array[];
  /** Samples the encoder adds ahead of the sound, which a player must skip. */
  lead: number;
}

const AAC_FRAME = 1024;

/** The sound's track. `offset` is where its frames begin in the file, `scale` the movie's clock
 *  and `most` the video's length on that clock, which the sound never outlasts. */
function soundTrack(a: Sound, offset: number, scale: number, most: number): Uint8Array {
  const length = a.frames.length * AAC_FRAME;
  const played = Math.min(most, Math.round(((length - a.lead) / a.rate) * scale));
  const decoder = [0x05, a.config.length, ...a.config];
  const stream = [0x04, 13 + decoder.length, 0x40, 0x15, ...zeros(11), ...decoder];
  const esds = full('esds', 0, 0, [0x03, 3 + stream.length + 3, 0, 0, 0], stream, [0x06, 1, 2]);
  const mp4a = box(
    'mp4a',
    zeros(6),
    u16(1),
    zeros(8),
    u16(a.channels),
    u16(16),
    zeros(4),
    u32(a.rate << 16),
    esds,
  );
  const stbl = box(
    'stbl',
    full('stsd', 0, 0, u32(1), mp4a),
    full('stts', 0, 0, u32(1), u32(a.frames.length), u32(AAC_FRAME)),
    full('stsc', 0, 0, u32(1), u32(1), u32(a.frames.length), u32(1)),
    full(
      'stsz',
      0,
      0,
      u32(0),
      u32(a.frames.length),
      a.frames.flatMap((f) => u32(f.length)),
    ),
    full('stco', 0, 0, u32(1), u32(offset)),
  );
  const mdia = box(
    'mdia',
    full('mdhd', 0, 0, u32(0), u32(0), u32(a.rate), u32(length), u16(0x55c4), u16(0)),
    full('hdlr', 0, 0, u32(0), text('soun'), zeros(12), text('SoundHandler'), [0]),
    box(
      'minf',
      full('smhd', 0, 0, zeros(4)),
      box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))),
      stbl,
    ),
  );
  const tkhd = full(
    'tkhd',
    0,
    3,
    u32(0),
    u32(0),
    u32(2),
    u32(0),
    u32(played),
    zeros(8),
    u16(0),
    u16(0),
    u16(0x100),
    u16(0),
    MATRIX,
    zeros(8),
  );
  // Starts playback after the encoder's lead, so the sound lines up with the picture.
  const edts = box('edts', full('elst', 0, 0, u32(1), u32(played), u32(a.lead), u32(0x10000)));
  return box('trak', tkhd, edts, mdia);
}

/** The video's track, every frame the same length, and the sound's when there is one. The index
 *  comes before the frames so the file streams. */
function mux(m: Movie): Uint8Array {
  const scale = m.fps * 100;
  const length = m.samples.length * 100;
  const pictures = m.samples.reduce((n, s) => n + s.data.length, 0);
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
      u32(m.sound ? 3 : 2),
    );
    const sound = m.sound ? soundTrack(m.sound, offset + pictures, scale, length) : [];
    return box('moov', mvhd, box('trak', tkhd, mdia), sound);
  };
  const ftyp = box('ftyp', text('isom'), u32(0x200), text('isomiso2avc1mp41'));
  const head = ftyp.length + moov(0).length;
  const data = [...m.samples.map((s) => s.data), ...(m.sound?.frames ?? [])];
  return join([ftyp, moov(head + 8), box('mdat', ...data)]);
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
  // The machine's own encoder first, since it is several times quicker than the built-in one,
  // which is used when there is none. Asked for nothing, the browser picks the built-in one.
  // High profile first, then Main, then Baseline, whichever can be encoded.
  for (const hardwareAcceleration of ['prefer-hardware', 'no-preference'] as const) {
    for (const profile of ['6400', '4d00', '42e0']) {
      const config: VideoEncoderConfig = {
        codec: `avc1.${profile}${level}`,
        width,
        height,
        bitrate,
        framerate: fps,
        latencyMode: 'quality',
        hardwareAcceleration,
        avc: { format: 'avc' },
      };
      if ((await VideoEncoder.isConfigSupported(config)).supported) return config;
    }
  }
  throw new Error('This machine cannot encode H.264 video.');
}

interface Aac {
  chunks: EncodedAudioChunk[];
  description: Uint8Array | null;
}

async function aacOf(planes: Float32Array[], rate: number): Promise<Aac> {
  const channels = planes.length;
  const total = planes[0].length;
  const chunks: EncodedAudioChunk[] = [];
  let description: Uint8Array | null = null;
  let failed: Error | null = null;
  const encoder = new AudioEncoder({
    output(chunk, meta) {
      chunks.push(chunk);
      const d = meta?.decoderConfig?.description;
      if (d && !description) {
        description = ArrayBuffer.isView(d)
          ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength).slice()
          : new Uint8Array(d).slice();
      }
    },
    error(e) {
      failed = e;
    },
  });
  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: rate,
    numberOfChannels: channels,
    bitrate: 192_000,
  });
  const step = rate;
  for (let at = 0; at < total && !failed; at += step) {
    const n = Math.min(step, total - at);
    const data = new Float32Array(n * channels);
    for (let c = 0; c < channels; c++) data.set(planes[c].subarray(at, at + n), c * n);
    const piece = new AudioData({
      format: 'f32-planar',
      sampleRate: rate,
      numberOfFrames: n,
      numberOfChannels: channels,
      timestamp: Math.round((at / rate) * 1e6),
      data,
    });
    encoder.encode(piece);
    piece.close();
  }
  if (!failed) await encoder.flush();
  encoder.close();
  if (failed) throw failed;
  return { chunks, description };
}

const RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000];

/** AAC-LC's two-byte record, for an encoder that gives none. */
function plainConfig(rate: number, channels: number): Uint8Array {
  const index = Math.max(0, RATES.indexOf(rate));
  return new Uint8Array([(2 << 3) | (index >> 1), ((index & 1) << 7) | (channels << 3)]);
}

const LEADS = new Map<string, Promise<number>>();

/** How many samples this machine's AAC encoder puts ahead of the sound. Encoders differ and do
 *  not say, so a click at a known place is encoded, decoded and found again. */
function leadOf(rate: number, channels: number): Promise<number> {
  const key = `${rate}/${channels}`;
  let got = LEADS.get(key);
  if (!got) {
    got = (async () => {
      const at = AAC_FRAME * 8;
      const planes = Array.from({ length: channels }, () => {
        const plane = new Float32Array(AAC_FRAME * 16);
        plane.fill(0.9, at, at + 32);
        return plane;
      });
      const { chunks, description } = await aacOf(planes, rate);
      let seen = 0;
      let loudest = 0;
      let where = at;
      const decoder = new AudioDecoder({
        output(data) {
          const plane = new Float32Array(data.numberOfFrames);
          data.copyTo(plane, { planeIndex: 0, format: 'f32-planar' });
          plane.forEach((v, i) => {
            if (Math.abs(v) > loudest) {
              loudest = Math.abs(v);
              where = seen + i;
            }
          });
          seen += data.numberOfFrames;
          data.close();
        },
        error() {},
      });
      decoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: rate,
        numberOfChannels: channels,
        description: description ?? plainConfig(rate, channels),
      });
      for (const chunk of chunks) decoder.decode(chunk);
      await decoder.flush();
      decoder.close();
      // The click is 32 samples wide and a decoder smears it, so the loudest sample is near its
      // middle.
      return Math.max(0, where - at - 16);
    })().catch(() => 0);
    LEADS.set(key, got);
  }
  return got;
}

/** Encodes the video's sound as AAC. The track's times cut it to the video's length. */
async function encodeAac(audio: AudioBuffer): Promise<Sound> {
  const rate = audio.sampleRate;
  const channels = audio.numberOfChannels;
  const can =
    typeof AudioEncoder !== 'undefined' &&
    (
      await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: rate,
        numberOfChannels: channels,
        bitrate: 192_000,
      })
    ).supported;
  if (!can) throw new Error('This machine cannot encode AAC sound. Save the video without sound.');
  const planes = Array.from({ length: channels }, (_, c) => audio.getChannelData(c));
  const [{ chunks, description }, lead] = await Promise.all([
    aacOf(planes, rate),
    leadOf(rate, channels),
  ]);
  const frames = chunks.map((chunk) => {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    return data;
  });
  return { rate, channels, config: description ?? plainConfig(rate, channels), frames, lead };
}

export interface VideoJob {
  canvas: HTMLCanvasElement;
  fps: number;
  seconds: number;
  /** The video's sound, as long as the video. Absent, the file is silent. */
  audio?: AudioBuffer | null;
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
  const sound = job.audio ? await encodeAac(job.audio) : undefined;
  const file = mux({
    width: canvas.width,
    height: canvas.height,
    fps,
    description,
    color,
    samples,
    sound,
  });
  return new Blob([file.buffer as ArrayBuffer], { type: 'video/mp4' });
}
