import {
  getModelInfo,
  loadModel,
  transcribe,
  unloadModel,
  PARAKEET_UNIFIED_0_6B_Q4_0,
} from "@qvac/sdk";

if (process.platform !== "darwin") throw new Error("Core ML requires macOS");

console.log("▸ Loading Parakeet Unified with its Core ML encoder sidecar...");
const modelId = await loadModel({
  modelSrc: PARAKEET_UNIFIED_0_6B_Q4_0,
  modelType: "parakeet-transcription",
  modelConfig: { useGPU: true },
});

const info = await getModelInfo({ name: "PARAKEET_UNIFIED_0_6B_Q4_0" });
for (const file of info.cacheFiles) console.log(`▸ ${file.filename}`);

console.log("▸ Transcribing audio...");
const text = await transcribe({
  modelId,
  audioChunk: "./examples/qvac/transcription/input/sample-16khz.wav",
});
if (!text.trim()) throw new Error("Parakeet Unified returned an empty transcription");
console.log(text);

await unloadModel({ modelId });
