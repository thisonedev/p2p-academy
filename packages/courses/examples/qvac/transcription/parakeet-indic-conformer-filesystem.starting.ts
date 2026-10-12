import {
  loadModel,
  unloadModel,
  transcribe,
  PARAKEET_INDIC_CONFORMER_600M_Q8_0,
} from "@qvac/sdk";

const language = "hi";

console.log("▸ Loading Indic Conformer CTC model...");
// 1: load Indic Conformer with the language id

console.log("▸ Transcribing audio...");
// 2: transcribe the Hindi sample and log the text

console.log("▸ Unloading model...");
await unloadModel({ modelId });
console.log("▸ Done");
