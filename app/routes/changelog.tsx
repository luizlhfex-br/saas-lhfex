/**
 * GET /changelog
 * Log de atualizações do sistema LHFEX SaaS
 * Mantido manualmente — registra cada deploy/feature relevante
 */

import type { Route } from "./+types/changelog";
import { requireAuth } from "~/lib/auth.server";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { ArrowLeft, GitCommit, Zap, Bug, Wrench, Star } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return {};
}

type ChangeType = "feat" | "fix" | "refactor" | "docs" | "release";

type Entry = {
  date: string;
  version?: string;
  commit?: string;
  type: ChangeType;
  title: string;
  items: string[];
};

const CHANGELOG: Entry[] = [
  {
    date: "2026-02-23",
    type: "feat",
    title: "Módulo Pessoas + Melhorias gerais",
    items: [
      "Novo módulo 👥 Pessoas em /personal-life/pessoas — cadastro de contatos com Nome, CPF, RG, Nascimento, Celular, E-mail, Instagram, Endereço, Senhas e Observações",
      "Cards expansíveis com toggle de senha e botões de cópia (CPF, celular, senha)",
      "Busca por nome com filtro GET",
      "Tabela 'pessoas' criada no Postgres com soft-delete",
      "Fix: Firefly removido das abas do módulo financeiro LHFEX (era link para /personal-life/finances)",
      "Fix: VPS Monitor — substituído os.loadavg() por leitura real de /proc/stat (dual-snapshot 500ms) — elimina alertas falsos de 100% CPU",
      "Radio Monitor VM: APIs /api/radio-monitor-config e /api/radio-monitor-event criadas para integração com script VOSK na VPS",
      "Changelog criado em /changelog",
    ],
  },
  {
    date: "2026-02-22",
    type: "feat",
    commit: "cafe620",
    title: "PDF auto-fill em Promoções + Radio Monitor ativado",
    items: [
      "Promoções: botão 'Extrair com IA' — upload de PDF de regulamento, openclaw extrai nome/empresa/prêmio/datas/regras e preenche o formulário automaticamente",
      "Rota POST /api/promotion-extract com pdf-parse + openclaw (hub multi-provedor)",
      "Radio Monitor: captura de stream HTTP (~30s) + transcrição Groq Whisper (whisper-large-v3-turbo gratuito)",
      "Detecção de palavras-chave na transcrição + notificação Telegram via openclaw bot",
      "Cron 'radio_monitor' adicionado (a cada 2h)",
      "radio-monitor.server.ts criado com captureStreamSegment() e runRadioMonitor()",
      "transcribeRadioSegment() e detectPromotionKeywords() em ai.server.ts",
      "Fix: parsePromotionText usa openclaw com userId real (não 'system') para evitar erro UUID no Postgres",
      "Fix: provider padrão hub multi-provedor (Gemini FREE → OpenRouter FREE → DeepSeek) sem forceProvider",
    ],
  },
  {
    date: "2026-02-21",
    type: "feat",
    commit: "56560ff",
    title: "Promoções pessoais + Visão Geral de Automações",
    items: [
      "Módulo 🎁 Promoções em /personal-life/promotions com CRUD completo",
      "Tabela 'promotions' no schema personal-life.ts (soft-delete, participationStatus)",
      "Visão Geral de Automações em /automations/overview — catálogo de todos os crons e webhooks",
      "Agente openclaw como responsável por tudo na aba Vida Pessoal",
    ],
  },
  {
    date: "2026-02-20",
    type: "feat",
    commit: "a4b358e",
    title: "Módulo Vencimentos + alertas VPS semanais",
    items: [
      "Módulo 📋 Vencimentos em /personal-life/bills — gestão de assinaturas, boletos, aluguel",
      "Alertas via Telegram: diário (pendentes do dia) e semanal (resumo da semana)",
      "Schema bills.ts com billPayments, isRecurring, alertDaysBefore, alertOneDayBefore",
      "Cron 'bill_alerts' (diário 8h) e 'vps_weekly_report' (seg 9h)",
      "Fix: cron scheduler — boot imediato e parseInterval corrigido",
    ],
  },
  {
    date: "2026-02-19",
    type: "feat",
    commit: "5fbffd7",
    title: "Multi-bot Telegram + VPS Monitor",
    items: [
      "Separação de bots: MONITOR_BOT_TOKEN (VPS), OPENCLAW_TELEGRAM_TOKEN (vida pessoal), NEWS_BOT_TOKEN (notícias)",
      "Monitor VPS: alerta de CPU, RAM e disco acima dos limites configuráveis",
      "Automações de notícias com NewsAPI + resumo IA",
      "Badge de provider (Gemini/OpenRouter/DeepSeek) nas respostas do chat",
    ],
  },
  {
    date: "2026-02-18",
    type: "feat",
    commit: "239aed8",
    title: "Provider strategy inteligente + budget control",
    items: [
      "Hub multi-provedor: tenta Gemini FREE → OpenRouter FREE → DeepSeek (último recurso)",
      "Budget control: limite diário por provedor configurável via env",
      "forceProvider: opção para forçar DeepSeek em casos que exigem mais capacidade",
      "ai-usage.tsx: dashboard de uso de tokens por provedor e feature",
    ],
  },
  {
    date: "2026-02-15",
    type: "release",
    version: "v2.2.1",
    commit: "afaa75e",
    title: "Fixes críticos e notificações melhoradas",
    items: [
      "Fix: radio monitor schema e rotas corrigidos",
      "Fix: Firefly accounting pages com CRUD completo",
      "OpenClaw bot Telegram integrado — webhook e comandos básicos",
      "Radio Monitor UI com gerenciamento de estações e keywords",
    ],
  },
  {
    date: "2026-02-10",
    type: "release",
    version: "v2.2.0",
    commit: "46e5a98",
    title: "OpenCLAW + Radio Monitor + Firefly",
    items: [
      "Schema: radioStations, radioMonitorEvents, radioMonitorKeywords, fireflyAccounts, fireflyTransactions",
      "Módulo Firefly (finanças pessoais): contas, lançamentos, orçamentos, recorrências",
      "Módulo Radio Monitor: CRUD de estações e palavras-chave",
      "OpenClaw: agente de vida pessoal, webhook Telegram, getPersonalLifeContext()",
      "Company Profile: multi-contas bancárias, enriquecimento CNPJ automático",
    ],
  },
];

const TYPE_CONFIG: Record<ChangeType, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  feat: { label: "Feature", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300", icon: Star },
  fix: { label: "Fix", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", icon: Bug },
  refactor: { label: "Refactor", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300", icon: Wrench },
  docs: { label: "Docs", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: GitCommit },
  release: { label: "Release", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", icon: Zap },
};

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return new Date(`${y}-${m}-${d}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            📋 Changelog
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Histórico de atualizações do LHFEX SaaS
          </p>
        </div>
      </div>

      {/* Entries */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="space-y-8">
          {CHANGELOG.map((entry, idx) => {
            const cfg = TYPE_CONFIG[entry.type];
            const Icon = cfg.icon;
            return (
              <div key={idx} className="relative pl-12">
                {/* Dot */}
                <div className="absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm ring-1 ring-gray-200 dark:border-gray-900 dark:bg-gray-900 dark:ring-gray-700">
                  <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  {/* Meta */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
                      {entry.version ?? cfg.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(entry.date)}
                    </span>
                    {entry.commit && (
                      <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                        #{entry.commit}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {entry.title}
                  </h2>

                  {/* Items */}
                  <ul className="mt-3 space-y-1.5">
                    {entry.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-400 dark:bg-gray-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
