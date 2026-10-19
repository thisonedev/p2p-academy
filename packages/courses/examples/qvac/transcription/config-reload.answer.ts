import { WHISPER_TINY, loadModel, transcribe, unloadModel } from "@qvac/sdk";

const audioFilePath = "./examples/qvac/transcription/input/sample-16khz.wav";

console.log("▸ Loading Whisper model with English config...");
const modelId = await loadModel({
  modelSrc: WHISPER_TINY,
  modelConfig: {
    language: "en",
  },
});

console.log("▸ Transcribing audio with English config...");
const englishText = await transcribe({ modelId, audioChunk: audioFilePath });
console.log(`Transcription (EN): ${englishText}`);

console.log("▸ Hot reloading config (changing language)...");
const reloadedId = await loadModel({
  modelId,
  modelType: "whispercpp-transcription",
  modelConfig: {
    language: "es",
  },
});
console.log(`▸ Config reloaded, same model ID: ${reloadedId === modelId}`);

console.log("▸ Transcribing with updated config...");
const spanishText = await transcribe({ modelId, audioChunk: audioFilePath });
console.log(`Transcription (ES): ${spanishText}`);

await unloadModel({ modelId });
