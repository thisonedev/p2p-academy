import {
  QWEN3_5_0_8B_MULTIMODAL_Q8_0,
  completion,
  loadModel,
  unloadModel,
  type ToolCall,
  type ToolInput,
} from "@qvac/sdk";
import { z } from "zod";

const modelSrc = process.argv[2] ?? QWEN3_5_0_8B_MULTIMODAL_Q8_0;

const modelId = await loadModel({
  modelSrc,
  modelType: "llamacpp-completion",
  modelConfig: { ctx_size: 4096, tools: true },
});
console.log(`▸ Model loaded: ${modelId}`);

const history = [
  {
    role: "system",
    content: "You are a helpful assistant that can call tools to look up weather and horoscopes.",
  },
  {
    role: "user",
    content: "What's the weather in Tokyo and my horoscope for Aquarius?",
  },
];

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

const result = completion({ modelId, history, stream: true, tools });

const tokensTask = (async () => {
  for await (const token of result.tokenStream) {
    process.stdout.write(token);
  }
})();

const toolsTask = (async () => {
  for await (const evt of result.toolCallStream) {
    if (evt.type === "toolCall") {
      console.log(`\n▸ ${evt.call.name}(${JSON.stringify(evt.call.arguments)})`);
    }
  }
})();

await Promise.all([tokensTask, toolsTask]);

const toolCalls: ToolCall[] = await result.toolCalls;

console.log("\n\n▸ Final tool calls:");
if (toolCalls.length > 0) {
  for (const call of toolCalls) {
    console.log(`▸ ${call.name}(${JSON.stringify(call.arguments)})`);
  }
} else {
  console.log("▸ (none)");
}

await unloadModel({ modelId, clearStorage: false });