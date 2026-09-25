import { ArrowLeftRight } from "lucide-react";
import { LANGUAGES, type LanguageCode, type LanguagePair } from "../../types/language";
import styles from "./LanguageSelector.module.css";

interface LanguageSelectorProps {
  pair: LanguagePair;
  onChange: (pair: LanguagePair) => void;
}

export function LanguageSelector({ pair, onChange }: LanguageSelectorProps) {
  const handleSourceChange = (code: LanguageCode) => {
    onChange({ ...pair, source: code });
  };

  const handleTargetChange = (code: LanguageCode) => {
    onChange({ ...pair, target: code });
  };

  const handleSwap = () => {
    onChange({ source: pair.target, target: pair.source });
  };

  return (
    <div className={styles.container}>
      <select
        className={styles.select}
        value={pair.source}
        onChange={(e) => handleSourceChange(e.target.value as LanguageCode)}
      >
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={styles.swapButton}
        onClick={handleSwap}
        aria-label="Invertir idiomas"
      >
        <ArrowLeftRight size={18} />
      </button>

      <select
        className={styles.select}
        value={pair.target}
        onChange={(e) => handleTargetChange(e.target.value as LanguageCode)}
      >
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </div>
  );
}
