/**
 * Application Version Configuration
 * Update this file whenever releasing a new version
 */

export const APP_VERSION = "2.0.1";
export const APP_RELEASE_DATE = "2026-02-21";
export const APP_NAME = "LHFEX SaaS";

export type ChangelogItemType = "feature" | "improvement" | "fix" | "infra";

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: {
    type: ChangelogItemType;
    text: string;
  }[];
}

export const VERSION_HISTORY: ChangelogEntry[] = [
  {
    version: APP_VERSION,
    date: APP_RELEASE_DATE,
    title: "Aurora UI + Login + Deploy visivel",
    items: [
      { type: "improvement", text: "Tema Aurora aplicado no layout (sidebar, topbar, mobile)" },
      { type: "improvement", text: "Tela de login com logo maior e visual alinhado ao novo tema" },
      { type: "feature", text: "Previews de UI (A/B/C) publicados para comparacao" },
      { type: "fix", text: "Correcoes de compatibilidade do React Router no runtime" },
    ],
  },
  {
    version: "2.0.0",
    date: "2026-02-20",
    title: "Compras Publicas + Vida Pessoal",
    items: [
      { type: "feature", text: "Modulo de Compras Publicas com editais, processos e alertas" },
      { type: "feature", text: "Vida Pessoal com financas, investimentos, rotinas e metas" },
      { type: "improvement", text: "RBAC por email e navegacao atualizada" },
      { type: "infra", text: "Config de versao centralizada em app/config/version.ts" },
    ],
  },
];
