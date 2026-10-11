import { completion, loadModel, unloadModel, type ToolCall, type ToolInput } from "@qvac/sdk";
import { z } from "zod";

const weatherSchema = z.object({
  city: z.string().describe("City name"),
  country: z.string().describe("Country code").optional(),
});

const horoscopeSchema = z.object({
  sign: z.string().describe("An astrological sign like Taurus or Aquarius"),
});

const tools: ToolInput[] = [
  {
    name: "get_weather",
    description: "Get current weather for a city",
    parameters: weatherSchema,
  },
  {
    name: "get_horoscope",
    description: "Get today's horoscope for an astrological sign",
    parameters: horoscopeSchema,
  },
];

async function main() {
  // 1: load a tool-capable GGUF with modelType llamacpp-completion, modelConfig.tools: true

  // 2: call completion() with the tools array and the user prompt

  // 3: drain tokenStream and toolCallStream in parallel, then await result.toolCalls

  void modelId;
  await unloadModel({ modelId: "" });
  void tools;
}

main().catch(console.error);