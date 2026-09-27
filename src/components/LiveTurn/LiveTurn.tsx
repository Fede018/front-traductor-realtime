import { Loader2 } from "lucide-react";
import { Avatar } from "../Avatar/Avatar";
import type { Participant } from "../../types/participant";
import styles from "./LiveTurn.module.css";

interface LiveTurnProps {
  speaker: Participant | null;
  isMine: boolean;
  statusLabel: string;
  transcript: string;
  translation: string;
}

export function LiveTurn({ speaker, isMine, statusLabel, transcript, translation }: LiveTurnProps) {
  return (
    <div className={`${styles.row} ${isMine ? styles.mine : styles.theirs}`} data-slot={speaker?.slot ?? "a"}>
      <Avatar avatar={speaker?.avatar ?? null} name={speaker?.name ?? null} slot={speaker?.slot ?? "a"} size="sm" speaking />
      <div className={styles.bubble}>
        <div className={styles.status}>
          <Loader2 size={12} className={styles.spinner} />
          {statusLabel}
        </div>
        <p className={styles.original}>{transcript || " "}</p>
        {translation && <p className={styles.translation}>{translation}</p>}
      </div>
    </div>
  );
}
