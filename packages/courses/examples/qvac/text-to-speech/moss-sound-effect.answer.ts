import { writeFileSync } from "node:fs";
import {
  loadModel,
  textToSpeech,
  unloadModel,
  AUDIOGEN_MOSS_SFX_V2_Q8_0,
} from "@qvac/sdk";

console.log("▸ Loading MOSS-SoundEffect...");
const modelId = await loadModel({
  modelSrc: AUDIOGEN_MOSS_SFX_V2_Q8_0.src,
  modelType: "tts-ggml",
  modelConfig: { ttsEngine: "moss-sfx", useGPU: true, seed: 42 },
});
console.log(`▸ Model loaded: ${modelId}`);

console.log("▸ Generating a sound effect...");
const result = textToSpeech({
  modelId,
  text: "Heavy rain falling on a tin roof.",
  stream: false,
  seconds: 2,
  steps: 20,
});

const samples = await result.buffer;
if (!(await result.done)) throw new Error("Sound-effect generation did not complete.");
const sampleRate = await result.sampleRate;
if (sampleRate !== 48000) throw new Error(`Unexpected sound-effect sample rate: ${sampleRate}`);
saveWav(samples, sampleRate, "output/text-to-speech/moss-sound-effect-output.wav");

await unloadModel({ modelId });
console.log("▸ Model unloaded");

function saveWav(samples: number[], sampleRate: number, filename: string) {
  if (samples.length === 0 || samples.some((sample) => !Number.isFinite(sample))) {
    throw new Error("The model returned no usable audio.");
  }
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i]!))), 44 + i * 2);
  }
  writeFileSync(filename, wav);
  console.log(
    `▸ Saved ${filename}: ${sampleRate} Hz, ${(samples.length / sampleRate).toFixed(2)} seconds`,
  );
}
