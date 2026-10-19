import { batchCompletion, loadModel, unloadModel, LLAMA_3_2_1B_INST_Q4_0 } from "@qvac/sdk";

// 1: load Llama 3.2 1B with four parallel slots
console.log(`▸ Model loaded: ${modelId}`);

// 2: submit the three prompts in one batchCompletion() run

console.log("\n▸ Merged event stream (interleaved across prompts):");
// 3: print each contentDelta with its prompt id

// 4: log the ordered results, one prompt's final, and the batch stats

await unloadModel({ modelId, clearStorage: false });
