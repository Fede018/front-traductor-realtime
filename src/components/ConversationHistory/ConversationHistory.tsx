import { useEffect, useRef } from "react";
import { LANGUAGES } from "../../types/language";
import type { ConversationTurn } from "../../types/conversation";
import styles from "./ConversationHistory.module.css";

interface ConversationHistoryProps {
  turns: ConversationTurn[];
}

function languageLabel(code: string): string {
  return LANGUAGES.find((lang) => lang.code === code)?.label ?? code;
}

export function ConversationHistory({ turns }: ConversationHistoryProps) {
  const lastTurnRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    lastTurnRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length]);

  return (
    <ul className={styles.history}>
      {turns.map((turn, index) => {
        const isLast = index === turns.length - 1;
        return (
          <li key={turn.id} ref={isLast ? lastTurnRef : undefined} className={styles.turn}>
            <p className={styles.direction}>
              {languageLabel(turn.sourceLanguage)} → {languageLabel(turn.targetLanguage)}
            </p>
            <p className={styles.transcript}>{turn.transcript}</p>
            <p className={styles.translation}>{turn.translation}</p>
          </li>
        );
      })}
    </ul>
  );
}
