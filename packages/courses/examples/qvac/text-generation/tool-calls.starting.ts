import { loadModel, completion, unloadModel, type ToolInput, QWEN3_1_7B_INST_Q4 } from "@qvac/sdk";
import { z } from "zod";

async function main() {
  const modelId = await loadModel({
    modelSrc: QWEN3_1_7B_INST_Q4,
    modelConfig: { ctx_size: 4096, tools: true },
  });

  // 1: define a tools array with one tool (name, description, parameters)

  // 2: call completion() with tools and stream result.events

  // 3: log toolCall events

  await unloadModel({ modelId });
}

main().catch(console.error);
