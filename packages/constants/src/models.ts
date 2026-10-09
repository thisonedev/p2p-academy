import { GIB, MIB } from './units.js';

// The AI bot's chat models, smallest first. The desktop loads them by sdkKey and
// sizes its download and RAM checks from here; the UI lists them by file.
export const CHAT_MODELS = [
  { file: 'Qwen3-0.6B-Q4_0.gguf', sdkKey: 'QWEN3_600M_INST_Q4', sizeBytes: 480 * MIB, minRamBytes: 4 * GIB, gpu: 'optional' },
  { file: 'Qwen3-1.7B-Q4_0.gguf', sdkKey: 'QWEN3_1_7B_INST_Q4', sizeBytes: 1.1 * GIB, minRamBytes: 8 * GIB, gpu: 'optional' },
  { file: 'Qwen3-4B-Q4_K_M.gguf', sdkKey: 'QWEN3_4B_INST_Q4_K_M', sizeBytes: 2.4 * GIB, minRamBytes: 12 * GIB, gpu: 'preferred' },
  { file: 'Qwen3-8B-Q4_K_M.gguf', sdkKey: 'QWEN3_8B_INST_Q4_K_M', sizeBytes: 4.7 * GIB, minRamBytes: 20 * GIB, gpu: 'preferred' },
] as const;

export type ChatModelFile = (typeof CHAT_MODELS)[number]['file'];
