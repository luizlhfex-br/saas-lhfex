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
    date: "2026-03-02",
    type: "fix",
    title: "openclaw: heartbeat model + deepseek fallback + RUNBOOK",
    items: [
      "Heartbeat model: gemini-2.0-flash-lite → gemini-2.0-flash (lite retornava FailoverError: Unknown model)",
      "Fallback deepseek: removido sufixo :free que causava 404 No endpoints found",
      "RUNBOOK.md criado em openclaw-gateway/ com diagnóstico dos 7 bugs e guia de operação",
    ],
  },
  {
    date: "2026-03-02",
    type: "fix",
    title: "TypeScript: 5 erros corrigidos + E2E timeout",
    items: [
      "ai.server.ts: removido .toISOString() em campos SQL DATE (já retornam string YYYY-MM-DD)",
      "ai.server.ts: Blob([new Uint8Array(audioBuffer)]) para compatibilidade TypeScript",
      "api.openclaw-tools.tsx: removido campo createdBy inexistente na tabela contacts",
      "notifications.ts: enum notification_type alinhado com valores usados no código",
      "playwright.config.ts: reuseExistingServer=true, timeout aumentado para 180s",
    ],
  },
  {
    date: "2026-03-02",
    type: "feat",
    title: "Módulo Estudos — /personal-life/studies",
    items: [
      "Schema: 3 tabelas — personal_study_courses, personal_study_subjects, personal_study_events",
      "UI: tabs Cursos, Matérias e Agenda com formulários inline",
      "Agenda: botão 📅 Adicionar ao Google Calendar via deep link (sem OAuth)",
      "API: /api/personal-studies com CRUD completo (GET + POST)",
      "Integrado ao dashboard Vida Pessoal com card 🎓 Estudos",
    ],
  },
  {
    date: "2026-02-26",
    type: "feat",
    title: "OpenClaw AI Gateway",
    items: [
      "Container Docker autônomo em openclaw-gateway/ — build via Coolify a partir do repo público",
      "Modelo primário Gemini 2.0 Flash + roteamento por tarefa (brain, subagent, coding, research)",
      "Slack Socket Mode — openclaw.ai conectado ao workspace LHFEX via xapp token",
      "Heartbeat a cada 15 min — verifica WORKING.md e notifica urgências via Telegram",
      "Backup de memória automático no GitHub (luizlhfex-br/saas-lhfex)",
      "Morning brief às 8h e alertas de processos às 18h nos dias úteis",
      "Sonar (Perplexity) adicionado como modelo 'research' para perguntas com dados em tempo real",
    ],
  },
  {
    date: "2026-02-26",
    type: "feat",
    title: "Mission Control & Crons",
    items: [
      "Kanban com 6 colunas em /agents — inbox, todo, in_progress, review, done, blocked",
      "Tab 'Crons' em /agents — visualização e gerenciamento dos crons do openclaw.ai",
      "Tab 'Conhecimento IA' em /agents — gestão de memória e arquivos do agente",
      "Schema mission_control_tasks criado no Postgres",
      "Schema openclaw_crons criado no Postgres",
      "API /api/openclaw-tools: actions criar_tarefa_mc e atualizar_tarefa_mc",
    ],
  },
  {
    date: "2026-02-25",
    type: "feat",
    title: "Audit Log — Recuperar deleções",
    items: [
      "Botão ↩ Recuperar no Audit Log para deleções com menos de 30 dias",
      "Restauração de clientes: reativa registro soft-deleted na tabela clients",
      "Restauração de processos: reativa registro soft-deleted na tabela processes",
      "API /api/audit-log com action restore_deletion",
    ],
  },
  {
    date: "2026-02-25",
    type: "feat",
    title: "API openclaw-tools",
    items: [
      "Endpoint GET/POST /api/openclaw-tools com autenticação via header X-OpenClaw-Key",
      "14 actions: resumo_processos, buscar_processos, ver_financeiro_pessoal, listar_promocoes, buscar_clientes, system_status, criar_cliente, abrir_processo, adicionar_transacao, ask_agent (IAna/marIA/AIrton), criar_tarefa_mc, atualizar_tarefa_mc",
    ],
  },
  {
    date: "2026-02-24",
    type: "feat",
    title: "Integração SCPC",
    items: [
      "Busca de CPF/CNPJ em tempo real via scraping do portal SCPC",
      "Exibe pendências financeiras e alertas integrados ao CRM de clientes",
      "Dados sempre frescos — sem cache, consulta ao vivo a cada busca",
    ],
  },
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
