import { useRef } from "react";
import { Volume2 } from "lucide-react";
import type { InteractionState } from "../../hooks/useVoiceRecorder";
import styles from "./ConversationPanel.module.css";

interface ConversationPanelProps {
  state: InteractionState;
  audioUrl: string | null;
  errorMessage: string | null;
}

export function ConversationPanel({ state, audioUrl, errorMessage }: ConversationPanelProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const showPlayback = state === "ready" && audioUrl !== null;

  const handlePlay = () => {
    audioRef.current?.play();
  };

  return (
    <div className={styles.panel}>
      <div className={styles.block}>
        <Volume2 size={18} />
        <div>
          <p className={styles.label}>Vos</p>
          {showPlayback ? (
            <button type="button" className={styles.playButton} onClick={handlePlay}>
              <Volume2 size={16} />
              Reproducir audio
            </button>
          ) : (
            <p className={`${styles.text} ${styles.placeholder}`}>
              {state === "error" && errorMessage ? (
                <span className={styles.error}>{errorMessage}</span>
              ) : (
                "—"
              )}
            </p>
          )}
          {audioUrl && <audio ref={audioRef} src={audioUrl} />}
        </div>
      </div>

      <div className={styles.block}>
        <Volume2 size={18} />
        <div>
          <p className={styles.label}>Otra persona</p>
          <p className={`${styles.text} ${styles.placeholder}`}>—</p>
        </div>
      </div>
    </div>
  );
}
