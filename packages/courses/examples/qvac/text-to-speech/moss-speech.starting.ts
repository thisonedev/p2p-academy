import {
  loadModel,
  textToSpeech,
  unloadModel,
  TTS_MOSS_SPEECH_Q8_0,
  TTS_CODEC_MOSS_SPEECH_F16,
} from "@qvac/sdk";

console.log("▸ Loading MOSS-Speech...");
// 1: load MOSS-Speech with its codec

console.log("▸ Generating a text-only reply...");
// 2: ask the question with textReply: true

// 3: read the reply text and the audio buffer

await unloadModel({ modelId });
console.log("▸ Model unloaded");
