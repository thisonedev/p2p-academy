import {
  TOOL_SEARCH_NAME,
  completion,
  executeToolSearch,
  loadModel,
  unloadModel,
  type ToolInput,
  QWEN3_1_7B_INST_Q4,
} from "@qvac/sdk";
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
    deferLoading: true,
    group: "astrology",
  },
  {
    name: "get_moon_phase",
    description: "Get the current phase of the moon",
    parameters: z.object({ date: z.string().describe("ISO date").optional() }),
    deferLoading: true,
    group: "astrology",
  },
];

const modelId = await loadModel({
  modelSrc: QWEN3_1_7B_INST_Q4,
  modelConfig: { ctx_size: 4096, tools: true },
});
console.log(`▸ Model loaded. Model ID: ${modelId}`);

const history = [
  {
    role: "system",
    content: "You are a helpful assistant. Search for a tool before calling it.",
  },
  { role: "user", content: "What's my horoscope for Aquarius?" },
];

const first = completion({ modelId, history, stream: true, tools });
for await (const token of first.tokenStream) process.stdout.write(token);

const calls = await first.toolCalls;
const search = calls.find((call) => call.name === TOOL_SEARCH_NAME);

if (!search) {
  console.log("\n\n▸ The model answered without searching; nothing more to show.");
} else {
  console.log(`\n\n▸ The model searched: ${JSON.stringify(search.arguments)}`);

  history.push({ role: "assistant", content: await first.text });
  history.push({
    role: "tool",
    content: executeToolSearch(tools, search.arguments, history),
  });

  const second = completion({ modelId, history, stream: true, tools });
  for await (const token of second.tokenStream) process.stdout.write(token);

  for (const call of await second.toolCalls) {
    console.log(`\n\n▸ Tool call: ${call.name}(${JSON.stringify(call.arguments)})`);
  }
}

await unloadModel({ modelId, clearStorage: false });
