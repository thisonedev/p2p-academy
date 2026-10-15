import { assessModelFit, MOSS_TRANSCRIBE_DIARIZE_Q8_0 } from "@qvac/sdk";

const audioSeconds = 300;

console.log("▸ Assessing MOSS memory for the declared recording...");
// 1: assess MOSS with a transcription workload and log the result
