import { useEffect, useRef, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import type { InteractionState } from "../../hooks/useVoiceRecorder";
import { base64ToObjectUrl } from "../../utils/audio";
import styles from "./ConversationPanel.module.css";

interface ConversationPanelProps {
  state: InteractionState;
  audioUrl: string | null;
  transcript: string | null;
  translation: string | null;
  translationAudioBase64: string | null;
  errorMessage: string | null;
}

export function ConversationPanel({
  state,
  audioUrl,
  transcript,
  translation,
  translationAudioBase64,
  errorMessage,
}: ConversationPanelProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const translationAudioRef = useRef<HTMLAudioElement>(null);
  const [translationAudioUrl, setTranslationAudioUrl] = useState<string | null>(null);
  const showPlayback = audioUrl !== null;

  const handlePlay = () => {
    audioRef.current?.play();
  };

  const handlePlayTranslation = () => {
    translationAudioRef.current?.play();
  };

  useEffect(() => {
    if (!translationAudioBase64) {
      setTranslationAudioUrl(null);
      return;
    }
    const url = base64ToObjectUrl(translationAudioBase64, "audio/mpeg");
    setTranslationAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [translationAudioBase64]);

  useEffect(() => {
    if (translationAudioUrl) {
      translationAudioRef.current?.play().catch(() => {
        // autoplay bloqueado por el navegador: queda el botón manual de respaldo
      });
    }
  }, [translationAudioUrl]);

  return (
    <div className={styles.panel}>
      <div className={styles.block}>
        <Volume2 size={18} />
        <div>
          <p className={styles.label}>Vos</p>
          {showPlayback ? (
            <button type="button" className={styles.playButton} onClick={handlePlay}>
              <Volume2 size={16} />
              Reproducir audio
            </button>
          ) : (
            <p className={`${styles.text} ${styles.placeholder}`}>—</p>
          )}
          {state === "sending" && (
            <p className={`${styles.text} ${styles.status}`}>
              <Loader2 size={14} className={styles.spinner} />
              Enviando...
            </p>
          )}
          {state === "sent" && (
            <>
              <p className={`${styles.text} ${styles.status}`}>Enviado ✓</p>
              {transcript && <p className={styles.text}>{transcript}</p>}
            </>
          )}
          {state === "error" && errorMessage && (
            <p className={`${styles.text} ${styles.error}`}>{errorMessage}</p>
          )}
          {audioUrl && <audio ref={audioRef} src={audioUrl} />}
        </div>
      </div>

      <div className={styles.block}>
        <Volume2 size={18} />
        <div>
          <p className={styles.label}>Otra persona</p>
          {state === "sent" && translation ? (
            <p className={styles.text}>{translation}</p>
          ) : (
            <p className={`${styles.text} ${styles.placeholder}`}>—</p>
          )}
          {translationAudioUrl && (
            <button type="button" className={styles.playButton} onClick={handlePlayTranslation}>
              <Volume2 size={16} />
              Reproducir traducción
            </button>
          )}
          {translationAudioUrl && <audio ref={translationAudioRef} src={translationAudioUrl} />}
        </div>
      </div>
    </div>
  );
}
