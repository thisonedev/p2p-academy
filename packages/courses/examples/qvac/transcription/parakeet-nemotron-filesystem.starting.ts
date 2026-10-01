import { loadModel, unloadModel, transcribe, PARAKEET_NEMOTRON_0_6B_Q4_0 } from "@qvac/sdk";

// 1: load Nemotron with a locale in modelConfig

// 2: transcribe the sample file and log the text

await unloadModel({ modelId });
console.log("▸ Model unloaded");
