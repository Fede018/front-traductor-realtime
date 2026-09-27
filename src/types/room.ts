import type { ConversationTurn } from "./conversation";
import type { Participant } from "./participant";

export type SpeakingState = "idle" | "recording" | "processing" | "live";

// Mensajes que el cliente envía al servidor.
export type RoomClientMessage =
  | { type: "profile"; participant: Partial<Pick<Participant, "name" | "language" | "avatar">> }
  | { type: "speaking"; state: SpeakingState }
  | { type: "live"; transcript: string; translation: string }
  | { type: "turn"; turn: ConversationTurn }
  | { type: "ping" };

// Mensajes que el servidor envía al cliente.
export type RoomServerMessage =
  | { type: "room.state"; selfId: string; participants: Participant[]; turns: ConversationTurn[] }
  | { type: "participant.joined"; participant: Participant }
  | { type: "participant.updated"; participant: Participant }
  | { type: "participant.left"; participantId: string }
  | { type: "speaking"; participantId: string; state: SpeakingState }
  | { type: "live"; participantId: string; transcript: string; translation: string }
  | { type: "turn"; turn: ConversationTurn }
  | { type: "pong" };
