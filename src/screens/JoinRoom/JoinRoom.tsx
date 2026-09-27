import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../../components/Button/Button";
import { getRoom } from "../../api/roomClient";
import styles from "./JoinRoom.module.css";

interface JoinRoomProps {
  initialCode?: string;
  onJoined: (code: string) => void;
  onBack: () => void;
}

function formatCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
}

export function JoinRoom({ initialCode = "", onJoined, onBack }: JoinRoomProps) {
  const [code, setCode] = useState(formatCode(initialCode));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (code.length < 7 || loading) return;

    setLoading(true);
    setError(null);
    try {
      const room = await getRoom(code);
      if (room.full) {
        setError("Esa conversación ya tiene dos participantes.");
        return;
      }
      onJoined(room.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo unir a la conversación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.screen}>
      <form className={styles.content} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Unirme a una conversación</h1>
        <label className={styles.label} htmlFor="room-code">
          Código de la conversación
        </label>
        <input
          id="room-code"
          className={styles.input}
          value={code}
          onChange={(e) => setCode(formatCode(e.target.value))}
          placeholder="ABC-742"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoFocus
          maxLength={7}
        />
        {error && <p className={styles.error}>{error}</p>}

        <Button variant="primary" fullWidth type="submit" disabled={code.length < 7 || loading}>
          {loading ? <Loader2 size={18} className={styles.spin} /> : "Unirme a la conversación"}
        </Button>
        <Button variant="ghost" fullWidth type="button" onClick={onBack}>
          Volver
        </Button>
      </form>
    </div>
  );
}
