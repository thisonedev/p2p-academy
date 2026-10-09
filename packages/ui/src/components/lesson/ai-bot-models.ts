import { CHAT_MODELS } from '@academy/constants';

export const AI_BOT_MODEL_NAMES = CHAT_MODELS.map((m) => m.file);

const AI_BOT_MODEL_SET: ReadonlySet<string> = new Set(AI_BOT_MODEL_NAMES);

export function isAiBotModel(name: string): boolean {
  return AI_BOT_MODEL_SET.has(name);
}
