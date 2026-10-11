import { loadModel, completion, unloadModel, type ToolInput, QWEN3_1_7B_INST_Q4 } from "@qvac/sdk";
import { z } from "zod";

async function main() {
  const modelId = await loadModel({
    modelSrc: QWEN3_1_7B_INST_Q4,
    modelConfig: { ctx_size: 4096, tools: true },
  });

  const weatherSchema = z.object({
    city: z.string().describe("City name"),
    country: z.string().describe("Country code").optional(),
  });

  const tools: ToolInput[] = [
    {
      name: "get_weather",
      description: "Get current weather for a city",
      parameters: weatherSchema,
    },
  ];

  const result = completion({
    modelId,
    history: [{ role: "user", content: "What's the weather in Tokyo?" }],
    tools,
    stream: true,
    captureThinking: true,
  });

  for await (const event of result.events) {
    if (event.type === "toolCall") {
      console.log(`▸ Tool: ${event.call.name}(${JSON.stringify(event.call.arguments)})`);
    }
  }

  await unloadModel({ modelId });
}

main().catch(console.error);
