import { User } from "lucide-react";
import type { Avatar as AvatarType, ParticipantSlot } from "../../types/participant";
import styles from "./Avatar.module.css";

interface AvatarProps {
  avatar: AvatarType | null;
  name: string | null;
  slot: ParticipantSlot;
  size?: "sm" | "md" | "lg" | "xl";
  speaking?: boolean;
  ring?: boolean;
}

const GENERIC_VARIANTS = 6;

function initial(name: string | null): string {
  return name?.trim() ? name.trim()[0].toUpperCase() : "";
}

export function Avatar({ avatar, name, slot, size = "md", speaking = false, ring = true }: AvatarProps) {
  const classNames = [styles.avatar, styles[size], ring ? styles.ring : ""].filter(Boolean).join(" ");
  const variant = avatar?.kind === "generic" ? avatar.variant % GENERIC_VARIANTS : 0;

  return (
    <span className={classNames} data-slot={slot} data-variant={variant}>
      {avatar?.kind === "photo" ? (
        <img src={avatar.dataUrl} alt={name ?? "Avatar"} className={styles.photo} />
      ) : name ? (
        <span className={styles.initial}>{initial(name)}</span>
      ) : (
        <User size={size === "xl" ? 32 : size === "lg" ? 24 : 16} className={styles.icon} />
      )}
      {speaking && <span className={styles.pulse} aria-hidden="true" />}
    </span>
  );
}
