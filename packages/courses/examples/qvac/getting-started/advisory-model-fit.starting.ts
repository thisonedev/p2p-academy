import { loadModel, unloadModel, loggingStream, SDK_LOG_ID, LLAMA_3_2_1B_INST_Q4_0 } from "@qvac/sdk";

// 1: watch the SDK log stream for fit verdicts

// 2: load the model

await unloadModel({ modelId });
console.log("▸ Model unloaded");
process.exit(0);
