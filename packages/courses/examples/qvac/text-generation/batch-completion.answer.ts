import { batchCompletion, loadModel, unloadModel, LLAMA_3_2_1B_INST_Q4_0 } from "@qvac/sdk";

const modelId = await loadModel({
  modelSrc: LLAMA_3_2_1B_INST_Q4_0,
  modelType: "llm",
  modelConfig: { ctx_size: 4096, parallel: 4 },
});
console.log(`▸ Model loaded: ${modelId}`);

const run = batchCompletion({
  modelId,
  prompts: [
    {
      id: "cherry",
      history: [{ role: "user", content: "Reply with only the word CHERRY." }],
      generationParams: { temp: 0, seed: 42, predict: 16 },
    },
    {
      id: "banana",
      history: [{ role: "user", content: "Reply with only the word BANANA." }],
      generationParams: { temp: 0, seed: 42, predict: 16 },
    },
    {
      id: "grape",
      history: [{ role: "user", content: "Reply with only the word GRAPE." }],
      generationParams: { temp: 0, seed: 42, predict: 16 },
    },
  ],
});

console.log("\n▸ Merged event stream (interleaved across prompts):");
for await (const { id, event } of run.events) {
  if (event.type === "contentDelta") {
    process.stdout.write(`[${id}] ${event.text}`);
  }
}

const results = await run.results;
console.log("\n\n▸ Ordered results:");
for (const { id, final } of results) {
  console.log(`  ▸ ${id}: ${final.contentText.replace(/\s+/g, " ").trim()}`);
}

const ids = await run.ids;
const firstFinal = await run.byId(ids[0]!).final;
console.log(`\n▸ byId("${ids[0]}").final -> ${firstFinal.contentText.trim()}`);

const stats = await run.stats;
if (stats) {
  console.log(`\n▸ Batch stats: ${stats.tokensPerSecond?.toFixed(1)} tok/s across the batch`);
}

await unloadModel({ modelId, clearStorage: false });
