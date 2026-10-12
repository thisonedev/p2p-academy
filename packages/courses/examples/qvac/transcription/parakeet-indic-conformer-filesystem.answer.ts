import {
  loadModel,
  unloadModel,
  transcribe,
  PARAKEET_INDIC_CONFORMER_600M_Q8_0,
} from "@qvac/sdk";

const language = "hi";

console.log("▸ Loading Indic Conformer CTC model...");
const modelId = await loadModel({
  modelSrc: PARAKEET_INDIC_CONFORMER_600M_Q8_0,
  modelType: "parakeet-transcription",
  modelConfig: { language },
});
console.log(`▸ Indic Conformer CTC model loaded with ID: ${modelId}`);
console.log(`▸ Language: ${language}`);

console.log("▸ Transcribing audio...");
const text = await transcribe({
  modelId,
  audioChunk: "./examples/qvac/transcription/input/sample-hi.wav",
});
console.log(text);

console.log("▸ Unloading model...");
await unloadModel({ modelId });
console.log("▸ Done");
