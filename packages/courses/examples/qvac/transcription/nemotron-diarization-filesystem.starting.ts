import { loadModel, unloadModel, transcribe, PARAKEET_NEMOTRON_3_DIARIZATION_Q8_0 } from "@qvac/sdk";

const audioFilePath = "./examples/qvac/transcription/input/diarization-sample-16k.wav";

console.log("▸ Loading Nemotron 3 Diarization through the Parakeet engine...");
// 1: load Nemotron with the Parakeet model type

console.log("▸ Diarizing audio...");
// 2: transcribe with metadata and collect the speaker turns

// 3: log each turn with its time range and speaker

console.log("▸ Unloading model...");
await unloadModel({ modelId });
console.log("▸ Done");
