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

// 1: load the MOSS backbone with its codec decoder

console.log("▸ Streaming MOSS Text-to-Speech...");
const started = Date.now();
// 2: stream the speech and time the first sample

// 3: read the sample rate and stats, then log the totals

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
