/**
 * Application Version Configuration
 * Update this file whenever releasing a new version
 */

export const APP_VERSION = "2.2.0";
export const APP_RELEASE_DATE = "2026-02-22";
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
    title: "Expansão Completa: Cadastros, IA Marketing e Contabilidade",
    items: [
      { type: "fix",         text: "Taxa do dolar agora usa Banco Central (serie 10813 - USD Importacao)" },
      { type: "feature",     text: "Auto-enriquecimento CNPJ via ReceitaWS no carregamento de Settings" },
      { type: "improvement", text: "Perfil da Empresa com UI compacta e modal expansivel (18 campos)" },
      { type: "feature",     text: "Suporte a multiplas contas bancarias (schema company_bank_accounts)" },
      { type: "feature",     text: "OpenCLAW: orquestrador de bot Telegram para promocoes e sorteios" },
      { type: "feature",     text: "Radio Monitor: sistema de monitoramento de promocoes em radios com transcricao" },
      { type: "feature",     text: "Firefly Phase 1: contabilidade triple-entry (contas, transacoes, orcamentos)" },
    ],
  },
  {
    version: "2.1.0",
    date: "2026-02-21",
    title: "Infraestrutura, IA e Segurança",
    items: [
      { type: "infra",       text: "Redis (Upstash) integrado para cache e sessoes distribuidas" },
      { type: "infra",       text: "CI/CD completo: lint, testes e deploy automatico via GitHub Actions" },
      { type: "improvement", text: "78 erros TypeScript corrigidos — codigo 100% tipado" },
      { type: "feature",     text: "Life Agent MVP ativado com automacao de vida pessoal" },
      { type: "improvement", text: "Chat estabilizado com telemetria e metricas de IA por provider" },
      { type: "feature",     text: "Rate limiting por feature: login, chat, OCR, CNPJ" },
      { type: "fix",         text: "Dependencia @sentry/remix incompativel com React 19 removida" },
    ],
  },
  {
    version: "2.0.1",
    date: "2026-02-21",
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
