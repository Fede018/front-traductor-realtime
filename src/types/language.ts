export type LanguageCode = "es" | "pt" | "en" | "fr" | "it" | "de";

export interface Language {
  code: LanguageCode;
  label: string; // nombre nativo: "Español", "Português", ...
  flag: string; // emoji de bandera
}

export const LANGUAGES: Language[] = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
];

export function getLanguage(code: LanguageCode | string): Language {
  return LANGUAGES.find((language) => language.code === code) ?? { code: code as LanguageCode, label: code, flag: "🌐" };
}

export interface LanguagePair {
  source: LanguageCode;
  target: LanguageCode;
}
