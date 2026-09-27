import { Languages, QrCode, KeyRound } from "lucide-react";
import { Button } from "../../components/Button/Button";
import styles from "./Welcome.module.css";

interface WelcomeProps {
  onCreate: () => void;
  onJoin: () => void;
}

export function Welcome({ onCreate, onJoin }: WelcomeProps) {
  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <span className={styles.brandIcon}>
          <Languages size={26} />
        </span>
        <h1 className={styles.title}>Vocera</h1>
        <p className={styles.tagline}>Dos personas. Dos teléfonos. Una conversación.</p>

        <div className={styles.actions}>
          <Button variant="primary" fullWidth icon={<QrCode size={18} />} onClick={onCreate}>
            Crear conversación
          </Button>
          <Button variant="secondary" fullWidth icon={<KeyRound size={18} />} onClick={onJoin}>
            Unirme
          </Button>
        </div>
      </div>
    </div>
  );
}
