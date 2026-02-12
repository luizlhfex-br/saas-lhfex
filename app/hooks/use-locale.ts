import { useFetcher } from "react-router";
import { t, type Locale } from "../i18n";

export function useLocale(currentLocale: Locale) {
  const fetcher = useFetcher();
  const optimisticLocale = fetcher.formData?.get("locale") as Locale | null;
  const locale = optimisticLocale || currentLocale;

  function setLocale(newLocale: Locale) {
    fetcher.submit({ locale: newLocale, intent: "locale" }, { method: "post", action: "/api/preferences" });
  }

  return { locale, setLocale, t: t(locale) };
}
