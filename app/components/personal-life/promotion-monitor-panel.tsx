import type { ReactNode } from "react";
import { useState } from "react";
import { Form } from "react-router";
import {
  AtSign,
  ExternalLink,
  Globe,
  Hash,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import type { PromotionMonitorDashboard } from "~/lib/promotion-monitor.server";
import {
  PROMOTION_MONITOR_CHANNEL_META,
  type PromotionMonitorChannel,
} from "~/lib/promotion-monitor.shared";
import { Button } from "~/components/ui/button";

const CHANNEL_ICONS: Record<PromotionMonitorChannel, typeof Hash> = {
  instagram_hashtag: Hash,
  instagram_account: AtSign,
  instagram_keyword: Search,
  promotion_site: Globe,
  literary_site: Globe,
};

const STATUS_LABELS: Record<string, string> = {
  new: "Nova",
  reviewing: "Em revisão",
  imported: "Importada",
  dismissed: "Descartada",
};

export function PromotionMonitorPanel({
  dashboard,
  actionPayload,
}: {
  dashboard: PromotionMonitorDashboard;
  actionPayload?: { success?: boolean; intent?: string; error?: string };
}) {
  const [channel, setChannel] = useState<PromotionMonitorChannel>("instagram_account");
  const meta = PROMOTION_MONITOR_CHANNEL_META[channel];
  const isMonitorIntent = actionPayload?.intent?.includes("monitor") || actionPayload?.intent?.includes("discovery") || actionPayload?.intent?.includes("tag_friend");

  return (
    <div className="space-y-6 rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 via-white to-purple-50 p-5 shadow-sm dark:border-pink-900/40 dark:from-pink-950/20 dark:via-gray-950 dark:to-purple-950/20">
      <div className="flex flex-col gap-3 rounded-2xl border border-pink-200 bg-white/80 p-4 dark:border-pink-900/40 dark:bg-gray-950/70 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-pink-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
            <Sparkles className="h-3.5 w-3.5" />
            Radar Instagram
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Descoberta assistida de sorteios
            </h3>
            <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
              Cadastre perfis, hashtags e sites para monitorar. As descobertas podem ser importadas para a aba Insta,
              e a lista de amigos autorizados ajuda a girar marcacoes sem repetir sempre as mesmas pessoas.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-xs text-pink-700 dark:border-pink-900/40 dark:bg-pink-900/20 dark:text-pink-200">
          Navegador logado e automacao ativa ficam no runtime do Hermes Agent. Aqui voce controla as fontes, os links e a fila de importacao.
        </div>
      </div>

      {isMonitorIntent && actionPayload?.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {actionPayload.error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Fontes ativas" value={dashboard.metrics.activeSources} hint={`${dashboard.metrics.totalSources} cadastradas`} tone="pink" />
        <MetricCard label="Novas descobertas" value={dashboard.metrics.newDiscoveries} hint={`${dashboard.metrics.reviewingDiscoveries} em revisao`} tone="violet" />
        <MetricCard label="Importadas" value={dashboard.metrics.importedDiscoveries} hint={`${dashboard.metrics.dismissedDiscoveries} descartadas`} tone="green" />
        <MetricCard label="Amigos autorizados" value={dashboard.metrics.activeFriends} hint={`${dashboard.metrics.totalFriends} no rodizio`} tone="blue" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-pink-500" />
              <h4 className="font-semibold text-gray-900 dark:text-white">Nova fonte monitorada</h4>
            </div>
            <Form method="post" className="grid gap-3 lg:grid-cols-2">
              <input type="hidden" name="_intent" value="create_monitor_source" />
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Canal</label>
                <select
                  name="channel"
                  value={channel}
                  onChange={(event) => setChannel(event.currentTarget.value as PromotionMonitorChannel)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  {Object.entries(PROMOTION_MONITOR_CHANNEL_META).map(([value, item]) => (
                    <option key={value} value={value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Nome da fonte</label>
                <input
                  type="text"
                  name="label"
                  placeholder="Ex: Marcas com bons sorteios"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{meta.shortLabel}</label>
                <input
                  type="text"
                  name="query"
                  placeholder={meta.placeholder}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">URL opcional</label>
                <input
                  type="text"
                  name="sourceUrl"
                  placeholder="https://instagram.com/... ou site oficial"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Prioridade</label>
                <input
                  type="number"
                  name="priority"
                  min={1}
                  max={9}
                  defaultValue={5}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Notas</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Observacoes sobre frequencia, premios esperados ou contas que valem acompanhar"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="lg:col-span-2 flex justify-end">
                <Button type="submit">
                  <Search className="mr-2 h-4 w-4" />
                  Salvar fonte
                </Button>
              </div>
            </Form>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              <h4 className="font-semibold text-gray-900 dark:text-white">Amigos autorizados para marcacao</h4>
            </div>
            <Form method="post" className="grid gap-3 lg:grid-cols-2">
              <input type="hidden" name="_intent" value="create_tag_friend" />
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Nome</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Ex: Joao do sorteio"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Handle do Instagram</label>
                <input
                  type="text"
                  name="instagramHandle"
                  placeholder="@amigo_autorizado"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Limite diario</label>
                <input
                  type="number"
                  name="dailyLimit"
                  min={1}
                  max={20}
                  defaultValue={5}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Limite semanal</label>
                <input
                  type="number"
                  name="weeklyLimit"
                  min={1}
                  max={100}
                  defaultValue={20}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Prioridade</label>
                <input
                  type="number"
                  name="priority"
                  min={1}
                  max={9}
                  defaultValue={5}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Notas</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Preferencias, observacoes ou limites combinados"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="lg:col-span-2 flex justify-end">
                <Button type="submit" variant="outline">
                  <Users className="mr-2 h-4 w-4" />
                  Salvar amigo
                </Button>
              </div>
            </Form>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="mb-4 flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-pink-500" />
              <h4 className="font-semibold text-gray-900 dark:text-white">Analisar link e gerar descoberta</h4>
            </div>
            <Form method="post" className="space-y-3">
              <input type="hidden" name="_intent" value="discover_from_url" />
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Fonte vinculada</label>
                <select
                  name="sourceId"
                  defaultValue=""
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="">Sem fonte vinculada</option>
                  {dashboard.sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.label} · {source.query}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">URL oficial</label>
                <input
                  type="url"
                  name="url"
                  placeholder="https://www.instagram.com/p/... ou landing da campanha"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Ler link com IA
                </Button>
              </div>
            </Form>
          </section>

          <RegistryCard
            title="Fontes cadastradas"
            emptyLabel="Nenhuma fonte cadastrada ainda."
            items={dashboard.sources.map((source) => {
              const Icon = CHANNEL_ICONS[source.channel as PromotionMonitorChannel] ?? Globe;
              return (
                <div key={source.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-pink-500" />
                        <span className="font-medium text-gray-900 dark:text-white">{source.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${source.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                          {source.isActive ? "Ativa" : "Pausada"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{source.query}</p>
                      {source.sourceUrl ? (
                        <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                          <ExternalLink className="h-3.5 w-3.5" />
                          {source.sourceUrl}
                        </a>
                      ) : null}
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Prioridade {source.priority} · ultimo status {source.lastStatus}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Form method="post">
                        <input type="hidden" name="_intent" value="toggle_monitor_source" />
                        <input type="hidden" name="id" value={source.id} />
                        <input type="hidden" name="isActive" value={String(source.isActive)} />
                        <Button type="submit" variant="outline" size="sm">
                          {source.isActive ? "Pausar" : "Ativar"}
                        </Button>
                      </Form>
                      <Form method="post">
                        <input type="hidden" name="_intent" value="delete_monitor_source" />
                        <input type="hidden" name="id" value={source.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Remover
                        </Button>
                      </Form>
                    </div>
                  </div>
                </div>
              );
            })}
          />

          <RegistryCard
            title="Amigos no rodizio"
            emptyLabel="Nenhum amigo autorizado ainda."
            items={dashboard.tagFriends.map((friend) => (
              <div key={friend.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">{friend.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${friend.isActive ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                        {friend.isActive ? "Liberado" : "Pausado"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{friend.instagramHandle}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Prioridade {friend.priority} · {friend.dailyLimit}/dia · {friend.weeklyLimit}/semana
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Form method="post">
                      <input type="hidden" name="_intent" value="toggle_tag_friend" />
                      <input type="hidden" name="id" value={friend.id} />
                      <input type="hidden" name="isActive" value={String(friend.isActive)} />
                      <Button type="submit" variant="outline" size="sm">
                        {friend.isActive ? "Pausar" : "Ativar"}
                      </Button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="_intent" value="delete_tag_friend" />
                      <input type="hidden" name="id" value={friend.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Remover
                      </Button>
                    </Form>
                  </div>
                </div>
              </div>
            ))}
          />
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-pink-500" />
          <h4 className="font-semibold text-gray-900 dark:text-white">Fila de descobertas</h4>
        </div>
        {dashboard.discoveries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Nenhuma descoberta gerada ainda. Use um link do Instagram ou de uma campanha para criar a primeira.
          </div>
        ) : (
          <div className="space-y-3">
            {dashboard.discoveries.map((discovery) => (
              <div key={discovery.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">{discovery.title}</span>
                      <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
                        Score {discovery.score}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {STATUS_LABELS[discovery.status] ?? discovery.status}
                      </span>
                      {discovery.needsFriends ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          Precisa marcar amigos
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <strong>{discovery.organizer || "Origem não identificada"}</strong>
                      {discovery.prize ? ` · Premio: ${discovery.prize}` : ""}
                      {discovery.endDate ? ` · Encerra em ${discovery.endDate}` : ""}
                    </p>
                    {discovery.rulesSummary ? (
                      <p className="text-sm text-gray-600 dark:text-gray-300">{discovery.rulesSummary}</p>
                    ) : null}
                    {discovery.participationNotes ? (
                      <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                        {discovery.participationNotes}
                      </p>
                    ) : null}
                    {discovery.suggestedFriendsList.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {discovery.suggestedFriendsList.map((friend) => (
                          <span key={friend} className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {friend}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <a
                      href={discovery.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir origem
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:w-[260px] lg:flex-col">
                    <Form method="post">
                      <input type="hidden" name="_intent" value="import_discovery" />
                      <input type="hidden" name="id" value={discovery.id} />
                      <Button type="submit" className="w-full" size="sm">
                        Importar para a aba Insta
                      </Button>
                    </Form>
                    {discovery.suggestedFriendsList.length > 0 ? (
                      <Form method="post">
                        <input type="hidden" name="_intent" value="register_discovery_tags" />
                        <input type="hidden" name="id" value={discovery.id} />
                        <Button type="submit" variant="outline" className="w-full" size="sm">
                          Registrar marcacoes sugeridas
                        </Button>
                      </Form>
                    ) : null}
                    <Form method="post">
                      <input type="hidden" name="_intent" value="dismiss_discovery" />
                      <input type="hidden" name="id" value={discovery.id} />
                      <Button type="submit" variant="ghost" className="w-full" size="sm">
                        Descartar
                      </Button>
                    </Form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "pink" | "violet" | "green" | "blue";
}) {
  const tones = {
    pink: "border-pink-200 bg-pink-50 text-pink-900 dark:border-pink-900/40 dark:bg-pink-900/20 dark:text-pink-200",
    violet: "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/40 dark:bg-violet-900/20 dark:text-violet-200",
    green: "border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-200",
    blue: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200",
  } as const;

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs opacity-80">{hint}</p>
    </div>
  );
}

function RegistryCard({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: ReactNode[];
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <h4 className="mb-4 font-semibold text-gray-900 dark:text-white">{title}</h4>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">{items}</div>
      )}
    </section>
  );
}
