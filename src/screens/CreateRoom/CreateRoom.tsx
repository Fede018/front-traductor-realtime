import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../../components/Button/Button";
import { RoomCodeCard } from "../../components/RoomCodeCard/RoomCodeCard";
import { createRoom } from "../../api/roomClient";
import styles from "./CreateRoom.module.css";

interface CreateRoomProps {
  onReady: (code: string) => void;
  onContinue: () => void;
}

export function CreateRoom({ onReady, onContinue }: CreateRoomProps) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createRoom()
      .then((room) => {
        if (cancelled) return;
        setCode(room.code);
        onReady(room.code);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        {error ? (
          <p className={styles.error}>{error}</p>
        ) : !code ? (
          <div className={styles.loading}>
            <Loader2 size={22} className={styles.spin} />
            <p>Creando conversación...</p>
          </div>
        ) : (
          <>
            <h1 className={styles.title}>Tu conversación está lista</h1>
            <RoomCodeCard code={code} />
            <p className={styles.hint}>Compartí el código o el QR con la otra persona.</p>
            <Button variant="primary" fullWidth onClick={onContinue}>
              Continuar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
