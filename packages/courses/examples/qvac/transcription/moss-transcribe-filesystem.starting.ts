import { loadModel, unloadModel, transcribe, MOSS_TRANSCRIBE_DIARIZE_Q8_0 } from "@qvac/sdk";

const audioFilePath = "./examples/qvac/transcription/input/diarization-sample-16k.wav";

console.log("▸ Loading MOSS-Transcribe-Diarize...");
// 1: load MOSS with its model type and CPU settings

console.log("▸ Transcribing audio...");
// 2: transcribe the file with segment metadata

// 3: log each segment with its time range and speaker

console.log("▸ Unloading model...");
await unloadModel({ modelId });
console.log("▸ Done");
