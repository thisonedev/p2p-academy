import { completion, loadModel, unloadModel, VERBOSITY, LLAMA_3_2_1B_INST_Q4_0 } from "@qvac/sdk";

const history = [
  {
    role: "user",
    content: "Explain the difference between pipeline and tensor parallelism in one paragraph.",
  },
];

// 1: split the model's layers evenly across two GPUs

// 2: stream a completion and log its stats

await unloadModel({ modelId, clearStorage: false });
