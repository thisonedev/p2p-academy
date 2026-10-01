import {
  AUDIOGEN_ACESTEP_5HZ_LM_0_6B_Q8_0,
  AUDIOGEN_ACESTEP_V15_TURBO_Q4_K_M,
  AUDIOGEN_QWEN3_EMBEDDING_0_6B_Q8_0,
  AUDIOGEN_VAE_BF16,
  audioUnderstand,
  loadModel,
  unloadModel,
} from "@qvac/sdk";

const sourcePath =
  process.argv[2] ?? "./examples/qvac/music-generation/input/lofi-coding-loop.wav";

const modelId = await loadModel({
  modelType: "audiogen",
  modelConfig: {
    textEncModelSrc: AUDIOGEN_QWEN3_EMBEDDING_0_6B_Q8_0,
    lmModelSrc: AUDIOGEN_ACESTEP_5HZ_LM_0_6B_Q8_0,
    ditModelSrc: AUDIOGEN_ACESTEP_V15_TURBO_Q4_K_M,
    vaeModelSrc: AUDIOGEN_VAE_BF16,
    useGPU: true,
  },
});

// 1: run audioUnderstand() on the source and drain progress

// 2: await the description and log its fields

await unloadModel({ modelId });
console.log("▸ Model unloaded");
