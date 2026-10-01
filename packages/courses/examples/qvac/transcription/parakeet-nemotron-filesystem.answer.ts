import { loadModel, unloadModel, transcribe, PARAKEET_NEMOTRON_0_6B_Q4_0 } from "@qvac/sdk";

const modelId = await loadModel({
  modelSrc: PARAKEET_NEMOTRON_0_6B_Q4_0,
  modelType: "parakeet-transcription",
  modelConfig: { language: "auto" },
});

const text = await transcribe({
  modelId,
  audioChunk: "./examples/qvac/transcription/input/sample-16khz.wav",
});
console.log(`▸ Transcript: ${text}`);

await unloadModel({ modelId });
console.log("▸ Model unloaded");
