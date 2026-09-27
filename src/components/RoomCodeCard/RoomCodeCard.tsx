import { QRCodeSVG } from "qrcode.react";
import { Share2, Copy, Check } from "lucide-react";
import { useState } from "react";
import styles from "./RoomCodeCard.module.css";

interface RoomCodeCardProps {
  code: string;
  compact?: boolean;
}

function joinUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(code)}`;
}

export function RoomCodeCard({ code, compact = false }: RoomCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const url = joinUrl(code);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Vocera", text: `Unite a nuestra conversación: ${code}`, url });
        return;
      } catch {
        // el usuario canceló el share nativo; caemos al copiado
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard no disponible: no hay más fallback razonable
    }
  };

  return (
    <div className={`${styles.card} ${compact ? styles.compact : ""}`}>
      <p className={styles.code}>{code}</p>
      <div className={styles.qrWrapper}>
        <QRCodeSVG value={url} size={compact ? 96 : 176} bgColor="transparent" fgColor="var(--text)" level="M" />
      </div>
      {!compact && (
        <button type="button" className={styles.shareButton} onClick={handleShare}>
          {copied ? <Check size={16} /> : <Share2 size={16} />}
          {copied ? "Copiado" : "Compartir"}
        </button>
      )}
      {compact && (
        <button type="button" className={styles.shareButtonSmall} onClick={handleShare} aria-label="Compartir código">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
}
