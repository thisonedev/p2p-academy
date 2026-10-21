import { completion, loadModel, unloadModel, VERBOSITY, LLAMA_3_2_1B_INST_Q4_0 } from "@qvac/sdk";

const history = [
  {
    role: "user",
    content: "Explain the difference between pipeline and tensor parallelism in one paragraph.",
  },
];

const modelId = await loadModel({
  modelSrc: LLAMA_3_2_1B_INST_Q4_0,
  modelType: "llamacpp-completion",
  modelConfig: {
    "split-mode": "layer",
    "tensor-split": "1,1",
    "main-gpu": 0,
    ctx_size: 4096,
    gpu_layers: 99,
    verbosity: VERBOSITY.ERROR,
  },
});

const result = completion({ modelId, history, stream: true });
for await (const token of result.tokenStream) {
  process.stdout.write(token);
}
const stats = await result.stats;
console.log("\n\n▸ Stats:", stats);

await unloadModel({ modelId, clearStorage: false });
