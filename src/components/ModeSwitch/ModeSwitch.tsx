import styles from "./ModeSwitch.module.css";

export type InteractionMode = "manual" | "realtime";

interface ModeSwitchProps {
  mode: InteractionMode;
  onChange: (mode: InteractionMode) => void;
  disabled?: boolean;
}

export function ModeSwitch({ mode, onChange, disabled = false }: ModeSwitchProps) {
  return (
    <div className={styles.switch} role="radiogroup" aria-label="Modo de conversación">
      <button
        type="button"
        role="radio"
        aria-checked={mode === "manual"}
        className={`${styles.option} ${mode === "manual" ? styles.active : ""}`}
        onClick={() => onChange("manual")}
        disabled={disabled}
      >
        Manual
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "realtime"}
        className={`${styles.option} ${mode === "realtime" ? styles.active : ""}`}
        onClick={() => onChange("realtime")}
        disabled={disabled}
      >
        En vivo
      </button>
    </div>
  );
}
