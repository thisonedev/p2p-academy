import { loadModel, loggingStream, SDK_LOG_ID, LLAMA_3_2_1B_INST_Q4_0 } from "@qvac/sdk";

void (async () => {
  for await (const log of loggingStream({ id: SDK_LOG_ID })) {
    if (log.message.includes("[advisory-fit:")) {
      console.log(`▸ Fit check: ${log.message}`);
    }
  }
})().catch(() => {});

const modelId = await loadModel({ modelSrc: LLAMA_3_2_1B_INST_Q4_0 });
console.log(`▸ Model loaded: ${modelId}`);

process.exit(0);
