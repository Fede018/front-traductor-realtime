import { useRef, useState } from "react";
import { Camera, Shuffle } from "lucide-react";
import { Avatar } from "../../components/Avatar/Avatar";
import { LanguagePicker } from "../../components/LanguagePicker/LanguagePicker";
import { Sheet } from "../../components/Sheet/Sheet";
import { Button } from "../../components/Button/Button";
import { fileToSquareDataUrl } from "../../utils/image";
import type { LanguageCode } from "../../types/language";
import type { Avatar as AvatarType } from "../../types/participant";
import styles from "./Identity.module.css";

interface IdentityProps {
  initialName: string;
  initialLanguage: LanguageCode | null;
  initialAvatar: AvatarType;
  onSubmit: (data: { name: string; language: LanguageCode; avatar: AvatarType }) => void;
}

const GENERIC_VARIANTS = [0, 1, 2, 3, 4, 5];

export function Identity({ initialName, initialLanguage, initialAvatar, onSubmit }: IdentityProps) {
  const [name, setName] = useState(initialName);
  const [language, setLanguage] = useState<LanguageCode | null>(initialLanguage);
  const [avatar, setAvatar] = useState<AvatarType>(initialAvatar);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = name.trim().length > 0 && language !== null;

  const handleFile = async (file: File) => {
    try {
      const dataUrl = await fileToSquareDataUrl(file);
      setAvatar({ kind: "photo", dataUrl });
      setAvatarSheetOpen(false);
    } catch {
      // no se pudo procesar la foto: se mantiene el avatar anterior
    }
  };

  const handleSubmit = () => {
    if (!canSubmit || !language) return;
    onSubmit({ name: name.trim(), language, avatar });
  };

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <h1 className={styles.title}>¿Cómo te identificamos?</h1>

        <button type="button" className={styles.avatarButton} onClick={() => setAvatarSheetOpen(true)}>
          <Avatar avatar={avatar} name={name || null} slot="a" size="xl" />
          <span className={styles.changePhoto}>
            <Camera size={13} />
            Cambiar foto
          </span>
        </button>

        <label className={styles.label} htmlFor="display-name">
          Nombre
        </label>
        <input
          id="display-name"
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          placeholder="Tu nombre"
          maxLength={24}
          autoComplete="off"
        />

        <span className={styles.label}>Tu idioma</span>
        <LanguagePicker value={language} onChange={setLanguage} />

        <div className={styles.submitBar}>
          <Button variant="primary" fullWidth disabled={!canSubmit} onClick={handleSubmit}>
            Entrar a la conversación
          </Button>
        </div>
      </div>

      <Sheet open={avatarSheetOpen} title="Elegí tu foto" onClose={() => setAvatarSheetOpen(false)}>
        <div className={styles.sheetContent}>
          <button
            type="button"
            className={styles.uploadOption}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera size={18} />
            Subir foto
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className={styles.hiddenInput}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />

          <span className={styles.sheetLabel}>
            <Shuffle size={13} />
            O elegí un avatar genérico
          </span>
          <div className={styles.genericGrid}>
            {GENERIC_VARIANTS.map((variant) => (
              <button
                key={variant}
                type="button"
                className={styles.genericOption}
                onClick={() => {
                  setAvatar({ kind: "generic", variant });
                  setAvatarSheetOpen(false);
                }}
              >
                <Avatar avatar={{ kind: "generic", variant }} name={null} slot="a" size="lg" ring={false} />
              </button>
            ))}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
