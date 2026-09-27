import { MessageCircle } from "lucide-react";
import { Sheet } from "../Sheet/Sheet";
import { MessageBubble } from "../MessageBubble/MessageBubble";
import type { ConversationTurn } from "../../types/conversation";
import type { Participant } from "../../types/participant";
import styles from "./HistorySheet.module.css";

interface HistorySheetProps {
  open: boolean;
  onClose: () => void;
  turns: ConversationTurn[];
  participants: Participant[];
  myId: string;
}

export function HistorySheet({ open, onClose, turns, participants, myId }: HistorySheetProps) {
  const findSpeaker = (id: string) => participants.find((p) => p.id === id) ?? null;

  return (
    <Sheet open={open} title="Historial" onClose={onClose}>
      {turns.length === 0 ? (
        <div className={styles.empty}>
          <MessageCircle size={26} strokeWidth={1.5} />
          <p>Todavía no hay mensajes en esta conversación.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {turns.map((turn) => (
            <MessageBubble
              key={turn.id}
              turn={turn}
              speaker={findSpeaker(turn.speakerId)}
              isMine={turn.speakerId === myId}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
