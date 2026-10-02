import {
  loadModel,
  textToSpeech,
  unloadModel,
  TTS_T3_TURBO_EN_CHATTERBOX_Q8_0,
  TTS_S3GEN_EN_CHATTERBOX,
  TTS_ENHANCER_LAVASR_FP16,
} from "@qvac/sdk";
import fs from "node:fs";

const ENHANCED_SAMPLE_RATE = 48000;

const modelId = await loadModel({
  modelSrc: TTS_T3_TURBO_EN_CHATTERBOX_Q8_0,
  modelConfig: {
    ttsEngine: "chatterbox",
    language: "en",
    s3genModelSrc: TTS_S3GEN_EN_CHATTERBOX.src,
    lavasrEnhancerModelSrc: TTS_ENHANCER_LAVASR_FP16.src,
  },
});

console.log(`▸ Model loaded: ${modelId}`);

const result = textToSpeech({
  modelId,
  text: "QVAC SDK is the canonical entry point to QVAC.",
  inputType: "text",
  stream: false,
});

const audioBuffer = Int16Array.from(await result.buffer);
const sampleRate = (await result.sampleRate) ?? ENHANCED_SAMPLE_RATE;
console.log(`▸ TTS complete. Total samples: ${audioBuffer.length}`);
console.log(`▸ Sample rate: ${sampleRate} Hz`);

fs.writeFileSync("output/text-to-speech/chatterbox-enhanced-output.wav", createWav(audioBuffer, sampleRate));
console.log("▸ Saved output/text-to-speech/chatterbox-enhanced-output.wav");

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
