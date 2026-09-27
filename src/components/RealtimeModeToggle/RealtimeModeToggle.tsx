import type { RealtimeModeStatus } from "../../hooks/useRealtimeMode";
import styles from "./RealtimeModeToggle.module.css";

interface RealtimeModeToggleProps {
  status: RealtimeModeStatus;
  errorMessage: string | null;
  liveUserTranscript: string;
  liveTranslation: string;
  onEnable: () => void;
  onDisable: () => void;
}

const STATUS_LABELS: Record<RealtimeModeStatus, string> = {
  idle: "Modo tiempo real",
  connecting: "Conectando...",
  active: "Modo tiempo real activo",
  error: "Error al activar el modo tiempo real",
};

export function RealtimeModeToggle({
  status,
  errorMessage,
  liveUserTranscript,
  liveTranslation,
  onEnable,
  onDisable,
}: RealtimeModeToggleProps) {
  const isOn = status === "active" || status === "connecting";

  const handleToggle = () => {
    if (isOn) {
      onDisable();
    } else {
      onEnable();
    }
  };

  return (
    <div className={styles.wrapper}>
      <label className={styles.switchRow}>
        <input
          type="checkbox"
          checked={isOn}
          disabled={status === "connecting"}
          onChange={handleToggle}
          aria-label="Modo tiempo real"
        />
        <span className={styles.statusLabel}>{STATUS_LABELS[status]}</span>
      </label>

      {status === "error" && errorMessage && <p className={styles.error}>{errorMessage}</p>}

      {status === "active" && (
        <div className={styles.liveTranscript}>
          <p>
            <strong>Vos:</strong> {liveUserTranscript || "..."}
          </p>
          <p>
            <strong>Traducción:</strong> {liveTranslation || "..."}
          </p>
        </div>
      )}
    </div>
  );
}
