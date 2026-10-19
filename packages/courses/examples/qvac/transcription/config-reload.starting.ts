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
// 1: reload the config with Spanish as the language

console.log("▸ Transcribing with updated config...");
// 2: transcribe the same file again and log the text

await unloadModel({ modelId });
