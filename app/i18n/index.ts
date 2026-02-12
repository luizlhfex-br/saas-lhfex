import { ptBR } from "./pt-BR";
import { en } from "./en";

const translations = { "pt-BR": ptBR, en } as const;
export type Locale = keyof typeof translations;

export function t(locale: Locale) {
  return translations[locale];
}

export function getLocales(): { value: Locale; label: string }[] {
  return [
    { value: "pt-BR", label: "PT" },
    { value: "en", label: "EN" },
  ];
}
