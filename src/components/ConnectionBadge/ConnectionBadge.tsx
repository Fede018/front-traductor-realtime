import type { RoomConnectionStatus } from "../../hooks/useRoom";
import styles from "./ConnectionBadge.module.css";

interface ConnectionBadgeProps {
  status: RoomConnectionStatus;
  realtimeActive?: boolean;
  onReconnect?: () => void;
}

const LABELS: Record<RoomConnectionStatus, string> = {
  connecting: "Conectando...",
  connected: "Conectado",
  reconnecting: "Reconectando...",
  lost: "Conexión perdida",
};

export function ConnectionBadge({ status, realtimeActive = false, onReconnect }: ConnectionBadgeProps) {
  if (status === "lost") {
    return (
      <div className={styles.lostBanner}>
        <span>Conexión perdida</span>
        {onReconnect && (
          <button type="button" className={styles.reconnectButton} onClick={onReconnect}>
            Reconectar
          </button>
        )}
      </div>
    );
  }

  const dotClass = status === "connected" ? styles.dotLive : status === "connecting" ? styles.dotPending : styles.dotWarn;
  const label = realtimeActive && status === "connected" ? "En vivo" : LABELS[status];

  return (
    <span className={styles.badge}>
      <span className={`${styles.dot} ${dotClass}`} />
      {label}
    </span>
  );
}
