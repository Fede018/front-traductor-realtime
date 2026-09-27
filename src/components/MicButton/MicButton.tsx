import { Mic, Square, Loader2 } from "lucide-react";
import styles from "./MicButton.module.css";

export type MicVisualState = "idle" | "recording" | "processing" | "ready" | "error";

interface MicButtonProps {
  state: MicVisualState;
  onPress: () => void;
  labels?: Partial<Record<MicVisualState, string>>;
}

const DEFAULT_LABELS: Record<MicVisualState, string> = {
  idle: "Tocá para hablar",
  recording: "Escuchando... tocá para terminar",
  processing: "Procesando...",
  ready: "Traducción lista",
  error: "Tocá para reintentar",
};

export function MicButton({ state, onPress, labels }: MicButtonProps) {
  const label = { ...DEFAULT_LABELS, ...labels }[state];
  const disabled = state === "processing";

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.button} ${styles[state]}`}
        onClick={onPress}
        disabled={disabled}
        aria-label={label}
      >
        {state === "recording" && <span className={styles.ring} aria-hidden="true" />}
        {state === "processing" ? (
          <Loader2 size={30} className={styles.spin} />
        ) : state === "recording" ? (
          <Square size={26} fill="currentColor" />
        ) : (
          <Mic size={32} />
        )}
      </button>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
