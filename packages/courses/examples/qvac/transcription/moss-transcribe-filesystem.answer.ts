import { loadModel, unloadModel, transcribe, MOSS_TRANSCRIBE_DIARIZE_Q8_0 } from "@qvac/sdk";

const audioFilePath = "./examples/qvac/transcription/input/diarization-sample-16k.wav";

console.log("▸ Loading MOSS-Transcribe-Diarize...");
const modelId = await loadModel({
  modelType: "moss-transcribe",
  modelSrc: MOSS_TRANSCRIBE_DIARIZE_Q8_0,
  modelConfig: {
    maxThreads: 4,
    useGPU: false,
  },
});
console.log(`▸ MOSS model loaded with ID: ${modelId}`);

console.log("▸ Transcribing audio...");
const segments = await transcribe({
  modelId,
  audioChunk: audioFilePath,
  metadata: true,
  maxNewTokens: 0,
});

for (const segment of segments) {
  const start = (segment.startMs / 1000).toFixed(2);
  const end = (segment.endMs / 1000).toFixed(2);
  const speaker =
    segment.speaker ??
    (segment.speakerId !== undefined ? `Speaker ${segment.speakerId}` : "Unknown speaker");
  console.log(`[${start}s → ${end}s] ${speaker}: ${segment.text.trim()}`);
}

console.log("▸ Unloading model...");
await unloadModel({ modelId });
console.log("▸ Done");
