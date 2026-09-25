export type LanguageCode = "es" | "pt" | "en" | "fr";

export interface Language {
  code: LanguageCode;
  label: string; // "Español", "Português", ...
}

export const LANGUAGES: Language[] = [
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

export interface LanguagePair {
  source: LanguageCode;
  target: LanguageCode;
}
