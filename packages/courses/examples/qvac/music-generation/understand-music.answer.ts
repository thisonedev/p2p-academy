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

const run = audioUnderstand({
  modelId,
  sourceAudio: sourcePath,
  seed: 11,
});

for await (const progress of run.progressStream) {
  console.log(`▸ ${progress.stage}: ${progress.step}/${progress.total}`);
}

const description = await run.description;
console.log(`▸ Caption: ${description.caption}`);
console.log(`▸ ${description.bpm} BPM, ${description.keyscale}, ${description.timesignature}`);
console.log(`▸ Vocal language: ${description.vocalLanguage}`);
console.log(`▸ Estimated duration: ${description.duration.toFixed(1)} s`);
console.log(`▸ Recovered ${description.audioCodes.length} semantic codes`);

await unloadModel({ modelId });
console.log("▸ Model unloaded");
