import { assessModelFit, MOSS_TRANSCRIBE_DIARIZE_Q8_0 } from "@qvac/sdk";

const audioSeconds = 300;

console.log("▸ Assessing MOSS memory for the declared recording...");
const result = await assessModelFit({
  models: [
    {
      modelType: "moss-transcribe",
      modelSrc: MOSS_TRANSCRIBE_DIARIZE_Q8_0,
      modelConfig: { useGPU: false, maxThreads: 4 },
      transcriptionWorkload: { audioSeconds, maxNewTokens: 0 },
    },
  ],
});
console.log(JSON.stringify(result, null, 2));
