import { useState } from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/automations";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automations, automationLogs } from "../../drizzle/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { data, redirect } from "react-router";
import { Zap, Plus, ToggleLeft, ToggleRight, Trash2, Clock, CheckCircle2, XCircle, SkipForward, ArrowLeft } from "lucide-react";
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
  const [showCreate, setShowCreate] = useState(false);
  const [triggerType, setTriggerType] = useState("process_status_change");
  const [actionType, setActionType] = useState("create_notification");

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
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-gray-800">
                <div className="flex items-center gap-2">
                  {log.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {log.status === "error" && <XCircle className="h-4 w-4 text-red-500" />}
                  {log.status === "skipped" && <SkipForward className="h-4 w-4 text-gray-400" />}
                  <span className="font-medium text-gray-700 dark:text-gray-300">{log.automationName || "—"}</span>
                  {log.errorMessage && <span className="text-xs text-red-400">{log.errorMessage.slice(0, 60)}</span>}
                </div>
                <span className="text-xs text-gray-400">{new Date(log.executedAt).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
