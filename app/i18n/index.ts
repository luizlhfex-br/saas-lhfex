import { ptBR } from "./pt-BR";
import { en } from "./en";
import type { Translations } from "./pt-BR";

const translations = { "pt-BR": ptBR, en } as const;
export type Locale = keyof typeof translations;

export function t(locale: Locale | string): Translations {
  const normalized = locale in translations ? (locale as Locale) : "pt-BR";
  return translations[normalized];
}

export function getLocales(): { value: Locale; label: string }[] {
  return [
    { value: "pt-BR", label: "PT" },
    { value: "en", label: "EN" },
  ];
}
