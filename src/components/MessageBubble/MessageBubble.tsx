import { Radio } from "lucide-react";
import { Avatar } from "../Avatar/Avatar";
import { AudioPlayButton } from "../AudioPlayButton/AudioPlayButton";
import { getLanguage } from "../../types/language";
import type { ConversationTurn } from "../../types/conversation";
import type { Participant } from "../../types/participant";
import styles from "./MessageBubble.module.css";

interface MessageBubbleProps {
  turn: ConversationTurn;
  speaker: Participant | null;
  isMine: boolean;
  /** Reproducir automáticamente al montar. Solo debe usarse para el turno recién llegado, nunca en un listado de historial. */
  autoPlay?: boolean;
}

export function MessageBubble({ turn, speaker, isMine, autoPlay = false }: MessageBubbleProps) {
  const sourceLang = getLanguage(turn.sourceLanguage);
  const targetLang = getLanguage(turn.targetLanguage);
  const time = new Date(turn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`${styles.row} ${isMine ? styles.mine : styles.theirs}`} data-slot={speaker?.slot ?? "a"}>
      <Avatar avatar={speaker?.avatar ?? null} name={speaker?.name ?? null} slot={speaker?.slot ?? "a"} size="sm" />
      <div className={styles.bubble}>
        <div className={styles.meta}>
          <span className={styles.name}>{speaker?.name ?? "Participante"}</span>
          <span className={styles.lang}>
            {sourceLang.flag} {sourceLang.label}
          </span>
          <span className={styles.time}>{time}</span>
        </div>

        <p className={styles.original}>{turn.transcript}</p>

        <div className={styles.translationRow}>
          <span className={styles.translationLang}>
            {targetLang.flag} {targetLang.label}
          </span>
          <p className={styles.translation}>{turn.translation}</p>
        </div>

        {turn.mode === "manual" && turn.audioBase64 ? (
          <AudioPlayButton audioBase64={turn.audioBase64} autoPlay={autoPlay} />
        ) : turn.mode === "realtime" ? (
          <span className={styles.liveTag}>
            <Radio size={12} />
            Traducido en vivo
          </span>
        ) : null}
      </div>
    </div>
  );
}
