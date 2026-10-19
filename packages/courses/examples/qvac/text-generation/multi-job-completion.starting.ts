import {
  cancel,
  completion,
  loadModel,
  unloadModel,
  InferenceCancelledError,
  LLAMA_3_2_1B_INST_Q4_0,
} from "@qvac/sdk";

const PROMPTS = [
  { id: "cherry", ask: "Reply with only the word CHERRY." },
  { id: "banana", ask: "Reply with only the word BANANA." },
  { id: "grape", ask: "Reply with only the word GRAPE." },
  { id: "lemon", ask: "Reply with only the word LEMON." },
];

// 1: load Llama 3.2 1B with four parallel slots
console.log(`▸ Model loaded: ${modelId}`);

console.log("\n▸ Firing 4 completions concurrently:");
// 2: start one completion() per prompt before awaiting any of them

// 3: await every final, then log each reply, its tok/s and the peak avgConcurrentSeq

console.log("\n▸ Per-request cancel: cancelling one of two in-flight completions:");
// 4: start two long completions, wait for the first event of each, cancel one by requestId

// 5: check the cancelled final, count the events the other run still emits, and log both

await unloadModel({ modelId, clearStorage: false });
