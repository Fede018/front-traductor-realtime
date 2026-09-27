import { LANGUAGES, type LanguageCode } from "../../types/language";
import styles from "./LanguagePicker.module.css";

interface LanguagePickerProps {
  value: LanguageCode | null;
  onChange: (code: LanguageCode) => void;
}

export function LanguagePicker({ value, onChange }: LanguagePickerProps) {
  return (
    <div className={styles.grid} role="radiogroup" aria-label="Tu idioma">
      {LANGUAGES.map((language) => (
        <button
          key={language.code}
          type="button"
          role="radio"
          aria-checked={value === language.code}
          className={`${styles.option} ${value === language.code ? styles.selected : ""}`}
          onClick={() => onChange(language.code)}
        >
          <span className={styles.flag}>{language.flag}</span>
          <span className={styles.label}>{language.label}</span>
        </button>
      ))}
    </div>
  );
}
