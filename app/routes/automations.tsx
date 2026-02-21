import { useEffect, useMemo, useState } from "react";
import { Form, Link, useActionData, useFetcher, useNavigation } from "react-router";
import type { Route } from "./+types/automations";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automations, automationLogs } from "../../drizzle/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { data, redirect } from "react-router";
import { Zap, Plus, ToggleLeft, ToggleRight, Trash2, Clock, CheckCircle2, XCircle, SkipForward, ArrowLeft, Play, RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";

const TRIGGER_LABELS: Record<string, string> = {
  process_status_change: "Processo mudou de status",
  invoice_due_soon: "Fatura próxima do vencimento",
  new_client: "Novo cliente cadastrado",
  eta_approaching: "ETA se aproximando",
  scheduled: "Agendado (horário fixo)",
};

const ACTION_LABELS: Record<string, string> = {
  send_email: "Enviar e-mail",
  create_notification: "Criar notificação",
  call_agent: "Chamar agente IA",
  webhook: "Webhook externo",
};

const TRIGGER_ICONS: Record<string, string> = {
  process_status_change: "📦",
  invoice_due_soon: "💰",
  new_client: "👤",
  eta_approaching: "🚢",
  scheduled: "⏰",
};

const ACTION_ICONS: Record<string, string> = {
  send_email: "📧",
  create_notification: "🔔",
  call_agent: "🤖",
  webhook: "🔗",
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const allAutomations = await db
    .select()
    .from(automations)
    .orderBy(desc(automations.createdAt));

  // Get last log for each automation
  const logs = await db
    .select({
      automationId: automationLogs.automationId,
      lastRun: sql<string>`max(${automationLogs.executedAt})`,
      totalRuns: sql<number>`count(*)::int`,
      successCount: sql<number>`count(*) filter (where ${automationLogs.status} = 'success')::int`,
      errorCount: sql<number>`count(*) filter (where ${automationLogs.status} = 'error')::int`,
    })
    .from(automationLogs)
    .groupBy(automationLogs.automationId);

  const logMap = new Map(logs.map((l) => [l.automationId, l]));

  // Recent logs for the activity feed
  const recentLogs = await db
    .select({
      id: automationLogs.id,
      automationId: automationLogs.automationId,
      automationName: automations.name,
      status: automationLogs.status,
      input: automationLogs.input,
      errorMessage: automationLogs.errorMessage,
      executedAt: automationLogs.executedAt,
    })
    .from(automationLogs)
    .leftJoin(automations, eq(automationLogs.automationId, automations.id))
    .orderBy(desc(automationLogs.executedAt))
    .limit(20);

  return {
    automations: allAutomations.map((a) => ({
      ...a,
      stats: logMap.get(a.id) || null,
    })),
    recentLogs,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "toggle") {
    const id = formData.get("id") as string;
    const currentlyEnabled = formData.get("enabled") === "true";
    await db.update(automations).set({ enabled: !currentlyEnabled, updatedAt: new Date() }).where(eq(automations.id, id));
    return data({ ok: true });
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await db.delete(automations).where(eq(automations.id, id));
    return data({ ok: true });
  }

  if (intent === "create") {
    const name = formData.get("name") as string;
    const triggerType = formData.get("triggerType") as string;
    const actionType = formData.get("actionType") as string;

    if (!name || !triggerType || !actionType) {
      return data({ error: "Preencha todos os campos" }, { status: 400 });
    }

    // Build trigger config based on type
    const triggerConfig: Record<string, unknown> = {};
    if (triggerType === "process_status_change") {
      triggerConfig.targetStatus = formData.get("targetStatus") || undefined;
    }
    if (triggerType === "invoice_due_soon") {
      triggerConfig.daysBeforeDue = parseInt(formData.get("daysBeforeDue") as string) || 3;
    }
    if (triggerType === "eta_approaching") {
      triggerConfig.hoursBeforeEta = parseInt(formData.get("hoursBeforeEta") as string) || 48;
    }

    // Build action config based on type
    const actionConfig: Record<string, unknown> = {};
    if (actionType === "create_notification") {
      actionConfig.title = formData.get("notifTitle") || name;
      actionConfig.message = formData.get("notifMessage") || `Automação "${name}" executada.`;
      actionConfig.userId = user.id;
    }
    if (actionType === "send_email") {
      actionConfig.to = formData.get("emailTo") || "";
    }
    if (actionType === "call_agent") {
      actionConfig.agentId = formData.get("agentId") || "airton";
      actionConfig.prompt = formData.get("agentPrompt") || "";
    }
    if (actionType === "webhook") {
      actionConfig.url = formData.get("webhookUrl") || "";
    }

    await db.insert(automations).values({
      name,
      triggerType: triggerType as any,
      triggerConfig,
      actionType: actionType as any,
      actionConfig,
      createdBy: user.id,
    });

    return data({ ok: true, created: true });
  }

  return data({ error: "Invalid intent" }, { status: 400 });
}

export default function AutomationsPage({ loaderData }: Route.ComponentProps) {
  const { automations: autoList, recentLogs } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const runFetcher = useFetcher();
  const logsFetcher = useFetcher();
  const cleanupFetcher = useFetcher();
  const [showCreate, setShowCreate] = useState(false);
  const [triggerType, setTriggerType] = useState("process_status_change");
  const [actionType, setActionType] = useState("create_notification");
  const [logSearch, setLogSearch] = useState("");
  const [logMode, setLogMode] = useState<"all" | "manual" | "automatic">("all");
  const [logStatus, setLogStatus] = useState<"all" | "success" | "error" | "skipped">("all");
  const [logPeriod, setLogPeriod] = useState<"24h" | "7d" | "30d">("7d");
  const [logPage, setLogPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [retentionDays, setRetentionDays] = useState("90");
  const [cleanupConfirm, setCleanupConfirm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(logSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [logSearch]);

  const logsUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: String(logPage),
      pageSize: "10",
      mode: logMode,
      status: logStatus,
      period: logPeriod,
      q: debouncedSearch,
    });
    return `/api/automations-logs?${params.toString()}`;
  }, [debouncedSearch, logMode, logPage, logStatus, logPeriod]);

  const csvUrl = useMemo(() => {
    const params = new URLSearchParams({
      mode: logMode,
      status: logStatus,
      period: logPeriod,
      q: debouncedSearch,
      format: "csv",
    });
    return `/api/automations-logs?${params.toString()}`;
  }, [debouncedSearch, logMode, logStatus, logPeriod]);

  useEffect(() => {
    logsFetcher.load(logsUrl);
  }, [logsUrl]);

  useEffect(() => {
    if ((runFetcher.data as any)?.ok) {
      logsFetcher.load(logsUrl);
    }
  }, [runFetcher.data, logsUrl]);

  const logsData = logsFetcher.data as any;
  const hasPrev = logsData?.hasPrev ?? false;
  const hasNext = logsData?.hasNext ?? false;
  const metrics = logsData?.metrics;
  const topErrorAutomations = logsData?.topErrorAutomations ?? [];

  const filteredLogs = useMemo(() => {
    if (logsData?.logs) return logsData.logs;
    const term = logSearch.trim().toLowerCase();

    return recentLogs.filter((log) => {
      const isManual = Boolean((log.input as any)?._manualRun);
      const modeMatches =
        logMode === "all" ||
        (logMode === "manual" && isManual) ||
        (logMode === "automatic" && !isManual);

      if (!modeMatches) return false;
      if (!term) return true;

      const name = String(log.automationName || "").toLowerCase();
      const status = String(log.status || "").toLowerCase();
      const error = String(log.errorMessage || "").toLowerCase();

      return name.includes(term) || status.includes(term) || error.includes(term);
    });
  }, [logsData, recentLogs, logMode, logSearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Automações</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Regras "Se-Então" para automatizar o seu fluxo</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4" /> Nova Automação
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-900 dark:bg-yellow-950/30">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Criar Automação</h2>
          <Form method="post" className="space-y-4" onSubmit={() => { if (actionData?.created) setShowCreate(false); }}>
            <input type="hidden" name="intent" value="create" />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Nome da Automação</label>
              <input type="text" name="name" required placeholder="Ex: Notificar quando processo embarcar"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Trigger */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">SE (Gatilho)</label>
                <select name="triggerType" value={triggerType} onChange={(e) => setTriggerType(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{TRIGGER_ICONS[k]} {v}</option>
                  ))}
                </select>

                {/* Trigger-specific config */}
                {triggerType === "process_status_change" && (
                  <div className="mt-2">
                    <select name="targetStatus"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                      <option value="">Qualquer status</option>
                      <option value="in_progress">Em Andamento</option>
                      <option value="awaiting_docs">Aguardando Docs</option>
                      <option value="customs_clearance">Desembaraço</option>
                      <option value="in_transit">Em Trânsito</option>
                      <option value="delivered">Entregue</option>
                      <option value="completed">Concluído</option>
                    </select>
                  </div>
                )}
                {triggerType === "invoice_due_soon" && (
                  <div className="mt-2">
                    <input type="number" name="daysBeforeDue" defaultValue={3} min={1} max={30} placeholder="Dias antes"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    <p className="mt-1 text-xs text-gray-400">Dias antes do vencimento</p>
                  </div>
                )}
                {triggerType === "eta_approaching" && (
                  <div className="mt-2">
                    <input type="number" name="hoursBeforeEta" defaultValue={48} min={1} max={168} placeholder="Horas antes"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    <p className="mt-1 text-xs text-gray-400">Horas antes do ETA</p>
                  </div>
                )}
              </div>

              {/* Action */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ENTÃO (Ação)</label>
                <select name="actionType" value={actionType} onChange={(e) => setActionType(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  {Object.entries(ACTION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{ACTION_ICONS[k]} {v}</option>
                  ))}
                </select>

                {/* Action-specific config */}
                {actionType === "create_notification" && (
                  <div className="mt-2 space-y-2">
                    <input type="text" name="notifTitle" placeholder="Título da notificação"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    <input type="text" name="notifMessage" placeholder="Mensagem (use {{processRef}}, {{status}}, etc)"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                  </div>
                )}
                {actionType === "send_email" && (
                  <div className="mt-2">
                    <input type="email" name="emailTo" placeholder="email@exemplo.com"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                  </div>
                )}
                {actionType === "call_agent" && (
                  <div className="mt-2 space-y-2">
                    <select name="agentId" className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                      <option value="airton">AIrton (Maestro)</option>
                      <option value="iana">IAna (Comex)</option>
                      <option value="maria">marIA (Financeiro)</option>
                      <option value="iago">IAgo (Infra)</option>
                    </select>
                    <input type="text" name="agentPrompt" placeholder="Prompt para o agente"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                  </div>
                )}
                {actionType === "webhook" && (
                  <div className="mt-2">
                    <input type="url" name="webhookUrl" placeholder="https://..."
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                  </div>
                )}
              </div>
            </div>

            {actionData?.error && <p className="text-sm text-red-500">{actionData.error}</p>}

            <div className="flex gap-2">
              <Button type="submit" loading={navigation.state === "submitting"}>
                <Zap className="h-4 w-4" /> Criar Automação
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            </div>
          </Form>
        </div>
      )}

      {/* Automations list */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {autoList.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-800 dark:bg-gray-900">
            <Zap className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-700" />
            <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Nenhuma automação criada</p>
            <p className="mt-1 text-sm text-gray-400">Clique em "Nova Automação" para começar</p>
          </div>
        ) : (
          autoList.map((auto) => (
            <div key={auto.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{TRIGGER_ICONS[auto.triggerType]}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{auto.name}</h3>
                    <p className="text-xs text-gray-400">
                      {TRIGGER_LABELS[auto.triggerType]} → {ACTION_LABELS[auto.actionType]}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Form method="post">
                    <input type="hidden" name="intent" value="toggle" />
                    <input type="hidden" name="id" value={auto.id} />
                    <input type="hidden" name="enabled" value={String(auto.enabled)} />
                    <button type="submit" title={auto.enabled ? "Desativar" : "Ativar"}>
                      {auto.enabled ? (
                        <ToggleRight className="h-6 w-6 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-gray-400" />
                      )}
                    </button>
                  </Form>
                  <Form method="post" onSubmit={(e) => { if (!confirm("Excluir esta automação?")) e.preventDefault(); }}>
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={auto.id} />
                    <button type="submit" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Form>
                  <runFetcher.Form method="post" action="/api/automations-run">
                    <input type="hidden" name="automationId" value={auto.id} />
                    <button
                      type="submit"
                      title="Executar manualmente"
                      className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  </runFetcher.Form>
                </div>
              </div>

              {/* Flow visualization */}
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-gray-800">
                <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  SE {TRIGGER_LABELS[auto.triggerType]}
                </span>
                <span className="text-gray-400">→</span>
                <span className="rounded bg-green-100 px-2 py-0.5 font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  ENTÃO {ACTION_LABELS[auto.actionType]}
                </span>
              </div>

              {/* Stats */}
              {auto.stats && (
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Última: {auto.stats.lastRun ? new Date(auto.stats.lastRun).toLocaleString("pt-BR") : "nunca"}
                  </span>
                  <span className="flex items-center gap-1 text-green-500">
                    <CheckCircle2 className="h-3 w-3" /> {auto.stats.successCount}
                  </span>
                  {(auto.stats.errorCount ?? 0) > 0 && (
                    <span className="flex items-center gap-1 text-red-500">
                      <XCircle className="h-3 w-3" /> {auto.stats.errorCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Recent Execution Log */}
      {recentLogs.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <Clock className="h-5 w-5 text-gray-400" />
            Log de Execuções Recentes
          </h2>
          {metrics && (
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Execuções</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{metrics.totalExecutions}</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900/40 dark:bg-green-950/20">
                <p className="text-[11px] text-green-700 dark:text-green-300">Taxa de sucesso</p>
                <p className="text-lg font-semibold text-green-700 dark:text-green-300">{metrics.successRate}%</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/20">
                <p className="text-[11px] text-red-700 dark:text-red-300">Taxa de erro</p>
                <p className="text-lg font-semibold text-red-700 dark:text-red-300">{metrics.errorRate}%</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                <p className="text-[11px] text-blue-700 dark:text-blue-300">Execuções manuais</p>
                <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">{metrics.manualCount}</p>
              </div>
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
                <p className="text-[11px] text-violet-700 dark:text-violet-300">Intervalo médio</p>
                <p className="text-lg font-semibold text-violet-700 dark:text-violet-300">{metrics.averageIntervalMinutes} min</p>
              </div>
            </div>
          )}

          {metrics && metrics.totalExecutions >= 10 && metrics.errorRate >= 20 && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              Alerta operacional: taxa de erro alta ({metrics.errorRate}%) no período selecionado.
            </div>
          )}

          {topErrorAutomations.length > 0 && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
              <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">Top automações com erro</p>
              <div className="flex flex-wrap gap-2">
                {topErrorAutomations.map((item: any) => (
                  <span key={item.automationId} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {item.automationName || "—"}: {item.errors}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
            <input
              type="text"
              placeholder="Buscar por automação, status ou erro"
              value={logSearch}
              onChange={(event) => {
                setLogSearch(event.target.value);
                setLogPage(1);
              }}
              className="sm:col-span-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <select
              value={logMode}
              onChange={(event) => {
                setLogMode(event.target.value as "all" | "manual" | "automatic");
                setLogPage(1);
              }}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="all">Todos</option>
              <option value="manual">Somente manuais</option>
              <option value="automatic">Somente automáticos</option>
            </select>
            <select
              value={logStatus}
              onChange={(event) => {
                setLogStatus(event.target.value as "all" | "success" | "error" | "skipped");
                setLogPage(1);
              }}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="all">Todos status</option>
              <option value="success">Sucesso</option>
              <option value="error">Erro</option>
              <option value="skipped">Ignorado</option>
            </select>
            <select
              value={logPeriod}
              onChange={(event) => {
                setLogPeriod(event.target.value as "24h" | "7d" | "30d");
                setLogPage(1);
              }}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="24h">Últimas 24h</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>
          </div>

          <div className="mb-3 flex justify-end">
            <a
              href={csvUrl}
              className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-transparent px-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              Exportar CSV
            </a>
          </div>

          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-300">
              Limpeza de logs antigos (retenção)
            </p>
            <cleanupFetcher.Form
              method="post"
              action="/api/automations-logs-cleanup"
              className="grid grid-cols-1 gap-2 sm:grid-cols-4"
            >
              <input
                type="number"
                name="retentionDays"
                min={1}
                max={3650}
                value={retentionDays}
                onChange={(event) => setRetentionDays(event.target.value)}
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-amber-800 dark:bg-gray-900 dark:text-gray-100"
                placeholder="Dias de retenção"
              />
              <input
                type="text"
                name="confirmation"
                value={cleanupConfirm}
                onChange={(event) => setCleanupConfirm(event.target.value)}
                className="sm:col-span-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-amber-800 dark:bg-gray-900 dark:text-gray-100"
                placeholder='Digite "LIMPAR LOGS"'
              />
              <Button
                type="submit"
                variant="danger"
                size="sm"
                disabled={cleanupConfirm.trim().toUpperCase() !== "LIMPAR LOGS" || cleanupFetcher.state === "submitting"}
              >
                Limpar antigos
              </Button>
            </cleanupFetcher.Form>
            {cleanupFetcher.data && (cleanupFetcher.data as any).ok && (
              <p className="mt-2 text-xs text-green-700 dark:text-green-300">
                Limpeza concluída: {(cleanupFetcher.data as any).deletedCount} log(s) removido(s).
              </p>
            )}
            {cleanupFetcher.data && (cleanupFetcher.data as any).error && (
              <p className="mt-2 text-xs text-red-700 dark:text-red-300">{(cleanupFetcher.data as any).error}</p>
            )}
          </div>

          {runFetcher.data && (runFetcher.data as any).ok && (
            <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
              Execução concluída. Log: {(runFetcher.data as any).logId}
            </p>
          )}
          {runFetcher.data && (runFetcher.data as any).error && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {(runFetcher.data as any).error}
            </p>
          )}

          {logsFetcher.state === "loading" && (
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Atualizando logs...</p>
          )}

          <div className="space-y-2">
            {filteredLogs.map((log: any) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-gray-800">
                <div className="flex items-center gap-2">
                  {log.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {log.status === "error" && <XCircle className="h-4 w-4 text-red-500" />}
                  {log.status === "skipped" && <SkipForward className="h-4 w-4 text-gray-400" />}
                  <span className="font-medium text-gray-700 dark:text-gray-300">{log.automationName || "—"}</span>
                  {String((log as any).input?._manualRun) === "true" && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      MANUAL
                    </span>
                  )}
                  {log.errorMessage && <span className="text-xs text-red-400">{log.errorMessage.slice(0, 60)}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {(log.status === "error" || log.status === "skipped") && (
                    <runFetcher.Form method="post" action="/api/automations-run">
                      <input type="hidden" name="automationId" value={log.automationId || ""} />
                      <input type="hidden" name="logId" value={log.id} />
                      <button
                        type="submit"
                        title="Reexecutar a partir deste log"
                        className="rounded p-1 text-gray-400 hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-900/20"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </runFetcher.Form>
                  )}
                  <span className="text-xs text-gray-400">{new Date(log.executedAt).toLocaleString("pt-BR")}</span>
                </div>
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Nenhum log encontrado com os filtros atuais.
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">Página {logPage}</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasPrev || logsFetcher.state === "loading"}
                onClick={() => setLogPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNext || logsFetcher.state === "loading"}
                onClick={() => setLogPage((prev) => prev + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
