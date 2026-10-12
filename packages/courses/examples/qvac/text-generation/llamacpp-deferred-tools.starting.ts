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

// 1: define the three tools, deferring the two astrology ones

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

// 2: run the first turn and look for the tool_search request

// 3: append the search result, then run the second turn

await unloadModel({ modelId, clearStorage: false });
