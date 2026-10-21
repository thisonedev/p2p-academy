import { loadModel, decide, unloadModel, LAYA_MULTILINGUAL_322M_Q8_0 } from "@qvac/sdk";

console.log("▸ Loading decision model");
const modelId = await loadModel({
  modelSrc: LAYA_MULTILINGUAL_322M_Q8_0,
  modelType: "llamacpp-decision",
  modelConfig: { device: "cpu" },
});

const result = await decide({
  modelId,
  state: "My payment failed twice and I was charged both times. Please refund the duplicate.",
  questions: {
    department: {
      type: "choice",
      instructions: "Which team should handle this ticket?",
      criteria: ["billing", "technical"],
    },
    urgency: {
      type: "score",
      instructions: "How urgent is this?",
      criteria: ["not urgent", "somewhat urgent", "very urgent"],
    },
    refund: { type: "noul", instructions: "The customer asks for a refund." },
  },
});
console.log(JSON.stringify(result, null, 2));

console.log("▸ Unloading model...");
await unloadModel({ modelId });
console.log("▸ Done");
