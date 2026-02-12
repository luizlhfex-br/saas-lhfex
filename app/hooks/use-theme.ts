import { useFetcher } from "react-router";

export function useTheme(currentTheme: string) {
  const fetcher = useFetcher();
  const optimisticTheme = fetcher.formData?.get("theme") as string | null;
  const theme = optimisticTheme || currentTheme;

  function toggleTheme() {
    const newTheme = theme === "light" ? "dark" : "light";
    fetcher.submit({ theme: newTheme, intent: "theme" }, { method: "post", action: "/api/preferences" });
  }

  return { theme, toggleTheme, isDark: theme === "dark" };
}
