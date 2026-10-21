import { loadModel, decide, unloadModel, LAYA_MULTILINGUAL_322M_Q8_0 } from "@qvac/sdk";

console.log("▸ Loading decision model");
// 1: load Laya with the decision model type on the CPU

// 2: ask three questions about the ticket and log the result

console.log("▸ Unloading model...");
await unloadModel({ modelId });
console.log("▸ Done");
