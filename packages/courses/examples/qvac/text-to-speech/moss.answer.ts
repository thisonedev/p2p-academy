import {
  loadModel,
  textToSpeech,
  unloadModel,
  TTS_DELAY_LLM_MOSS_TTS_F16,
  TTS_CODEC_DECODER_MOSS_TTS_F16,
} from "@qvac/sdk";
import fs from "node:fs";

// Only a fallback: the engine reports the rate it actually produced.
const MOSS_SAMPLE_RATE = 24000;

const modelId = await loadModel({
  modelSrc: TTS_DELAY_LLM_MOSS_TTS_F16,
  modelConfig: {
    ttsEngine: "moss",
    language: "en",
    mossCodecDecoderModelSrc: TTS_CODEC_DECODER_MOSS_TTS_F16,
    streamChunkTokens: 25,
    useGPU: true,
    seed: 7,
  },
});
console.log(`▸ Model loaded: ${modelId}`);

console.log("▸ Streaming MOSS Text-to-Speech...");
const started = Date.now();
const result = textToSpeech({
  modelId,
  text: "Hold on [pause 1.0s] here it comes: speech that starts playing while the rest is still being generated.",
  stream: true,
});

const samples: number[] = [];
for await (const sample of result.bufferStream) {
  if (samples.length === 0) console.log(`▸ First audio after ${Date.now() - started} ms`);
  samples.push(sample);
}

const sampleRate = (await result.sampleRate) ?? MOSS_SAMPLE_RATE;
const stats = await result.stats;
console.log(
  `▸ TTS complete: ${samples.length} samples, ${stats?.generatedFrames ?? "?"} codec frames, RTF ${stats?.realTimeFactor?.toFixed(2) ?? "?"}`,
);

fs.writeFileSync(
  "output/text-to-speech/moss-output.wav",
  createWav(Int16Array.from(samples), sampleRate),
);
console.log("▸ Saved output/text-to-speech/moss-output.wav");

await unloadModel({ modelId });
console.log("▸ Model unloaded");

function createWav(pcm: Int16Array, sampleRate: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const byteLength = pcm.byteLength;
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + byteLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, byteLength, true);

  const wav = new Uint8Array(44 + byteLength);
  wav.set(new Uint8Array(header), 0);
  wav.set(new Uint8Array(pcm.buffer, pcm.byteOffset, byteLength), 44);
  return wav;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index++) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
