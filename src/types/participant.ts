import type { LanguageCode } from "./language";

export type ParticipantSlot = "a" | "b";

export type Avatar =
  | { kind: "generic"; variant: number }
  | { kind: "photo"; dataUrl: string };

export const DEFAULT_AVATAR: Avatar = { kind: "generic", variant: 0 };

export interface Participant {
  id: string;
  name: string | null;
  language: LanguageCode | null;
  slot: ParticipantSlot;
  avatar: Avatar | null;
  connected: boolean;
}
