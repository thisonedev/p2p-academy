import {
  completion,
  loadModel,
  textToSpeechStream,
  unloadModel,
  LLAMA_3_2_1B_INST_Q4_0,
  TTS_MULTILINGUAL_SUPERTONIC3_Q8_0,
} from "@qvac/sdk";
import fs from "node:fs";

const SUPERTONIC_SAMPLE_RATE = 44100;

const llmModelId = await loadModel({
  modelSrc: LLAMA_3_2_1B_INST_Q4_0,
  modelConfig: { ctx_size: 2048 },
});
console.log(`▸ LLM ready: ${llmModelId}`);

const ttsModelId = await loadModel({
  modelSrc: TTS_MULTILINGUAL_SUPERTONIC3_Q8_0,
  modelConfig: {
    ttsEngine: "supertonic",
    language: "en",
    voice: "F1",
    ttsSpeed: 1.05,
    ttsNumInferenceSteps: 10,
  },
});
console.log(`▸ TTS ready: ${ttsModelId}`);

const prompt = "What is a constellation?";
console.log(`▸ User: ${prompt}`);

const result = completion({
  modelId: llmModelId,
  history: [{ role: "user", content: prompt }],
  stream: true,
});

const filterChunk = createAngleBracketAndStarFilter();
const combinedPcm: number[] = [];
let sampleRate = SUPERTONIC_SAMPLE_RATE;
let phraseIndex = 0;

const ttsSession = await textToSpeechStream({
  modelId: ttsModelId,
  inputType: "text",
  accumulateSentences: true,
});

const drainPcm = (async () => {
  for await (const m of ttsSession) {
    if (m.buffer.length === 0) continue;
    if (m.sampleRate !== undefined) sampleRate = m.sampleRate;
    appendPcmSamples(combinedPcm, m.buffer);
    phraseIndex += 1;
    console.log(`\n▸ [TTS phrase ${phraseIndex}] ${m.buffer.length} samples`);
  }
})();

for await (const token of result.tokenStream) {
  const cleaned = filterChunk(token);
  if (cleaned.length > 0) {
    process.stdout.write(cleaned);
    ttsSession.write(cleaned);
  }
}
ttsSession.end();
await drainPcm;

fs.writeFileSync(
  "output/text-to-speech/llm-to-tts-streaming-output.wav",
  createWav(Int16Array.from(combinedPcm), sampleRate),
);
console.log("\n▸ Saved output/text-to-speech/llm-to-tts-streaming-output.wav");

await unloadModel({ modelId: llmModelId });
await unloadModel({ modelId: ttsModelId });
console.log("▸ Models unloaded");

// Drops `<...>` spans (such as `<think>` blocks) even when split across tokens, and strips `*`.
function createAngleBracketAndStarFilter() {
  let inAngle = false;
  return function filterChunk(chunk: string): string {
    let out = "";
    for (const c of chunk) {
      if (inAngle) {
        if (c === ">") inAngle = false;
        continue;
      }
      if (c === "<") {
        inAngle = true;
        continue;
      }
      if (c !== "*") out += c;
    }
    return out;
  };
}

// Appends in batches: spreading hundreds of thousands of samples into push() overflows the argument limit.
function appendPcmSamples(target: number[], chunk: number[]) {
  for (let i = 0; i < chunk.length; i += 8192) {
    Array.prototype.push.apply(target, chunk.slice(i, i + 8192));
  }
}

function createWav(pcm: Int16Array, sampleRate: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const byteLength = pcm.byteLength;
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + byteLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, byteLength, true);

  const wav = new Uint8Array(44 + byteLength);
  wav.set(new Uint8Array(header), 0);
  wav.set(new Uint8Array(pcm.buffer, pcm.byteOffset, byteLength), 44);
  return wav;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index++) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
