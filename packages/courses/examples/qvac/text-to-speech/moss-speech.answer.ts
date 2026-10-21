import {
  loadModel,
  textToSpeech,
  unloadModel,
  TTS_MOSS_SPEECH_Q8_0,
  TTS_CODEC_MOSS_SPEECH_F16,
} from "@qvac/sdk";

console.log("▸ Loading MOSS-Speech...");
const modelId = await loadModel({
  modelSrc: TTS_MOSS_SPEECH_Q8_0,
  modelType: "tts-ggml",
  modelConfig: {
    ttsEngine: "moss-speech",
    mossSpeechCodecModelSrc: TTS_CODEC_MOSS_SPEECH_F16,
    useGPU: true,
    seed: 42,
  },
});
console.log(`▸ Model loaded: ${modelId}`);

console.log("▸ Generating a text-only reply...");
const result = textToSpeech({
  modelId,
  text: "What is two plus two? Answer in one short sentence.",
  stream: false,
  textReply: true,
  greedy: true,
  maxNewTokens: 128,
  maxReplySeconds: 5,
  systemPrompt: "You are a helpful assistant. Give short, direct answers.",
});

const samples = await result.buffer;
const reply = await result.text;
console.log(`▸ Reply: ${reply?.trim()}`);
console.log(`▸ Audio samples: ${samples.length}`);

await unloadModel({ modelId });
console.log("▸ Model unloaded");
