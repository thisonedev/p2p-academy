import {
  getModelInfo,
  loadModel,
  transcribe,
  unloadModel,
  PARAKEET_UNIFIED_0_6B_Q4_0,
} from "@qvac/sdk";

if (process.platform !== "darwin") throw new Error("Core ML requires macOS");

console.log("▸ Loading Parakeet Unified with its Core ML encoder sidecar...");
// 1: load Parakeet Unified from the registry

// 2: list the files the SDK cached for the model

console.log("▸ Transcribing audio...");
// 3: transcribe the sample and reject an empty result

await unloadModel({ modelId });
