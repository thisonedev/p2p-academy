import { loadModel, unloadModel, transcribe, PARAKEET_NEMOTRON_3_DIARIZATION_Q8_0 } from "@qvac/sdk";

const audioFilePath = "./examples/qvac/transcription/input/diarization-sample-16k.wav";

console.log("▸ Loading Nemotron 3 Diarization through the Parakeet engine...");
const modelId = await loadModel({
  modelSrc: PARAKEET_NEMOTRON_3_DIARIZATION_Q8_0,
  modelType: "parakeet-transcription",
  modelConfig: {
    maxThreads: 4,
    useGPU: false,
  },
});

console.log("▸ Diarizing audio...");
const segments = await transcribe({ modelId, audioChunk: audioFilePath, metadata: true });
const turns = segments.flatMap((segment) => segment.speakerSegments ?? []);

for (const turn of turns) {
  console.log(
    `[${(turn.startMs / 1000).toFixed(2)}s → ${(turn.endMs / 1000).toFixed(2)}s] Speaker ${turn.speakerId + 1}`,
  );
}
if (turns.length === 0) console.log("▸ No speaker turns returned.");

console.log("▸ Unloading model...");
await unloadModel({ modelId });
console.log("▸ Done");
