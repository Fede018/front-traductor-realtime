import type { LanguageCode } from "./language";

export type ConversationMode = "manual" | "realtime";

export interface ConversationTurn {
  id: string;
  speakerId: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  transcript: string;
  translation: string;
  timestamp: string;
  mode: ConversationMode;
  /** Solo presente en memoria del lado emisor / al llegar al oyente; nunca se persiste en la sala. */
  audioBase64?: string | null;
}
