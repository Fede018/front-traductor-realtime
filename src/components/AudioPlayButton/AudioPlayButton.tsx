import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { base64ToObjectUrl } from "../../utils/audio";
import styles from "./AudioPlayButton.module.css";

interface AudioPlayButtonProps {
  audioBase64?: string | null;
  audioUrl?: string | null;
  mimeType?: string;
  autoPlay?: boolean;
  label?: string;
}

export function AudioPlayButton({
  audioBase64,
  audioUrl,
  mimeType = "audio/mpeg",
  autoPlay = false,
  label = "Reproducir traducción",
}: AudioPlayButtonProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(audioUrl ?? null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (audioUrl) {
      setResolvedUrl(audioUrl);
      return;
    }
    if (!audioBase64) {
      setResolvedUrl(null);
      return;
    }
    const url = base64ToObjectUrl(audioBase64, mimeType);
    setResolvedUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBase64, audioUrl, mimeType]);

  useEffect(() => {
    if (autoPlay && resolvedUrl) {
      audioRef.current?.play().catch(() => {
        // autoplay bloqueado por el navegador: queda el botón manual
      });
    }
  }, [autoPlay, resolvedUrl]);

  if (!resolvedUrl) return null;

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  };

  return (
    <button type="button" className={styles.button} onClick={toggle} aria-label={label}>
      <span className={styles.iconWrapper}>
        <svg className={styles.progressRing} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" className={styles.track} />
          <circle
            cx="12"
            cy="12"
            r="10"
            className={styles.fill}
            style={{ strokeDashoffset: 62.8 * (1 - progress) }}
          />
        </svg>
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </span>
      <span className={styles.label}>{playing ? "Reproduciendo..." : label}</span>
      <audio
        ref={audioRef}
        src={resolvedUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          if (audio.duration) setProgress(audio.currentTime / audio.duration);
        }}
      />
    </button>
  );
}
