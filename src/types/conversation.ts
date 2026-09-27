import type { LanguageCode } from "./language";

export interface ConversationTurn {
  id: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  transcript: string;
  translation: string;
  timestamp: string;
}
