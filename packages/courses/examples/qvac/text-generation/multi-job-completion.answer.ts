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

const modelId = await loadModel({
  modelSrc: LLAMA_3_2_1B_INST_Q4_0,
  modelType: "llm",
  modelConfig: { ctx_size: 4096, parallel: 4 },
});
console.log(`▸ Model loaded: ${modelId}`);

console.log("\n▸ Firing 4 completions concurrently:");
const started = Date.now();
const runs = PROMPTS.map(({ ask }) =>
  completion({
    modelId,
    history: [{ role: "user", content: ask }],
    generationParams: { temp: 0, seed: 42, predict: 16 },
    stream: true,
  }),
);

const outputs = await Promise.all(
  runs.map(async (run, i) => {
    const final = await run.final;
    return {
      id: PROMPTS[i]!.id,
      text: final.contentText.replace(/\s+/g, " ").trim(),
      stats: final.stats,
    };
  }),
);
const elapsed = Date.now() - started;

for (const { id, text, stats } of outputs) {
  const tps = stats?.tokensPerSecond?.toFixed(1) ?? "n/a";
  console.log(`  ▸ ${id}: "${text}"  (own ${tps} tok/s)`);
}

const peakConcurrent = Math.max(...outputs.map((o) => o.stats?.avgConcurrentSeq ?? 0));
console.log(
  `\n▸ All 4 finished in ${elapsed} ms; engine avg concurrent sequences: ${peakConcurrent.toFixed(1)} (> 1 = decoded together).`,
);

console.log("\n▸ Per-request cancel: cancelling one of two in-flight completions:");
const doomed = completion({
  modelId,
  history: [{ role: "user", content: "Write a long story about an otter." }],
  generationParams: { temp: 0, seed: 1, predict: 256 },
  stream: true,
});
const survivor = completion({
  modelId,
  history: [{ role: "user", content: "Write a long story about a melon." }],
  generationParams: { temp: 0, seed: 42, predict: 256 },
  stream: true,
});

const survivorTokens = survivor.events[Symbol.asyncIterator]();
await Promise.all([doomed.events[Symbol.asyncIterator]().next(), survivorTokens.next()]);

await cancel({ requestId: doomed.requestId });

let doomedCancelled = false;
try {
  await doomed.final;
} catch (err) {
  doomedCancelled = err instanceof InferenceCancelledError;
}

let tokensAfterCancel = 0;
for (let next = await survivorTokens.next(); !next.done; next = await survivorTokens.next()) {
  tokensAfterCancel++;
}
console.log(`  ▸ cancelled run -> ${doomedCancelled ? "cancelled" : "NOT cancelled"}`);
console.log(`  ▸ peer kept decoding -> +${tokensAfterCancel} tokens after the cancel ack`);

await unloadModel({ modelId, clearStorage: false });
