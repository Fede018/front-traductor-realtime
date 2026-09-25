import { Volume2 } from "lucide-react";
import type { InteractionState, MockResult } from "../../hooks/useMockVoiceInteraction";
import styles from "./ConversationPanel.module.css";

interface ConversationPanelProps {
  state: InteractionState;
  result: MockResult | null;
}

export function ConversationPanel({ state, result }: ConversationPanelProps) {
  const showResult = state === "result" && result !== null;

  return (
    <div className={styles.panel}>
      <div className={styles.block}>
        <Volume2 size={18} />
        <div>
          <p className={styles.label}>Vos</p>
          <p className={showResult ? styles.text : `${styles.text} ${styles.placeholder}`}>
            {showResult ? result.transcript : "—"}
          </p>
        </div>
      </div>

      <div className={styles.block}>
        <Volume2 size={18} />
        <div>
          <p className={styles.label}>Otra persona</p>
          <p className={showResult ? styles.text : `${styles.text} ${styles.placeholder}`}>
            {showResult ? result.translation : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
