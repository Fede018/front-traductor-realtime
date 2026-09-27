import { Avatar } from "../Avatar/Avatar";
import { getLanguage } from "../../types/language";
import type { Participant } from "../../types/participant";
import styles from "./ParticipantBar.module.css";

interface ParticipantBarProps {
  me: Participant | null;
  partner: Participant | null;
  meSpeaking: boolean;
  partnerSpeaking: boolean;
}

export function ParticipantBar({ me, partner, meSpeaking, partnerSpeaking }: ParticipantBarProps) {
  const meLang = me?.language ? getLanguage(me.language) : null;
  const partnerLang = partner?.language ? getLanguage(partner.language) : null;

  return (
    <div className={styles.bar}>
      <div className={styles.side}>
        <Avatar avatar={me?.avatar ?? null} name={me?.name ?? null} slot="a" size="sm" speaking={meSpeaking} />
        <div className={styles.info}>
          <span className={styles.name}>{me?.name ?? "Vos"}</span>
          {meLang && <span className={styles.lang}>{meLang.flag} {meLang.label}</span>}
        </div>
      </div>

      <span className={styles.divider}>↔</span>

      <div className={`${styles.side} ${styles.reverse}`}>
        <Avatar avatar={partner?.avatar ?? null} name={partner?.name ?? null} slot="b" size="sm" speaking={partnerSpeaking} />
        <div className={`${styles.info} ${styles.infoReverse}`}>
          <span className={styles.name}>{partner?.name ?? "Esperando..."}</span>
          {partnerLang && <span className={styles.lang}>{partnerLang.flag} {partnerLang.label}</span>}
        </div>
      </div>
    </div>
  );
}
