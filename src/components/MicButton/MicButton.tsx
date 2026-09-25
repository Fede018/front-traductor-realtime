import { Mic } from "lucide-react";
import type { InteractionState } from "../../hooks/useVoiceRecorder";
import styles from "./MicButton.module.css";

interface MicButtonProps {
  state: InteractionState;
  onStart: () => void;
  onStop: () => void;
}

const LABELS: Record<InteractionState, string> = {
  idle: "Mantener para hablar",
  recording: "Grabando...",
  ready: "Mantené para grabar de nuevo",
  error: "Error de micrófono, tocá para reintentar",
};

export function MicButton({ state, onStart, onStop }: MicButtonProps) {
  const buttonClassName = [
    styles.button,
    state === "recording" ? styles.recording : "",
    state === "error" ? styles.processing : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = () => {
    if (state === "error") {
      onStart();
    }
  };

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={buttonClassName}
        onMouseDown={onStart}
        onTouchStart={onStart}
        onMouseUp={onStop}
        onTouchEnd={onStop}
        onClick={handleClick}
        aria-label="Mantener para hablar"
      >
        <Mic size={32} />
      </button>
      <span className={styles.label}>{LABELS[state]}</span>
    </div>
  );
}
