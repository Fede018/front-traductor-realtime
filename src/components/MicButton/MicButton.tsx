import { Mic } from "lucide-react";
import type { InteractionState } from "../../hooks/useMockVoiceInteraction";
import styles from "./MicButton.module.css";

interface MicButtonProps {
  state: InteractionState;
  onStart: () => void;
  onStop: () => void;
}

const LABELS: Record<InteractionState, string> = {
  idle: "Mantener para hablar",
  recording: "Grabando...",
  processing: "Procesando...",
  result: "Mantener para hablar",
};

export function MicButton({ state, onStart, onStop }: MicButtonProps) {
  const buttonClassName = [
    styles.button,
    state === "recording" ? styles.recording : "",
    state === "processing" ? styles.processing : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={buttonClassName}
        onMouseDown={onStart}
        onTouchStart={onStart}
        onMouseUp={onStop}
        onTouchEnd={onStop}
        aria-label="Mantener para hablar"
      >
        <Mic size={32} />
      </button>
      <span className={styles.label}>{LABELS[state]}</span>
    </div>
  );
}
