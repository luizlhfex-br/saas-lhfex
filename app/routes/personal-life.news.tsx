import { and, eq, isNull } from "drizzle-orm";
import {
  Bot,
  ExternalLink,
  Eye,
  EyeOff,
  Globe2,
  MapPinned,
  Newspaper,
  Plus,
  RefreshCcw,
  Send,
  Ship,
  Sparkles,
  Star,
  StarOff,
} from "lucide-react";
import { Form, data, useActionData, useLoaderData, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/auth.server";
import {
  DEFAULT_PERSONAL_NEWS_SOURCES,
  PERSONAL_NEWS_TOPIC_META,
  type PersonalNewsTopic,
} from "~/lib/personal-news.shared";
import { db } from "~/lib/db.server";
import {
  generatePersonalNewsDigest,
  getPersonalNewsDashboard,
} from "~/lib/personal-news.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { personalNewsItems, personalNewsSources } from "../../drizzle/schema";

const panelClass =
  "rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] shadow-[var(--app-card-shadow)]";

const topicIcons: Record<PersonalNewsTopic, typeof Newspaper> = {
  ai: Sparkles,
  bh: MapPinned,
  world: Globe2,
  comex: Ship,
};

function formatDate(value: string | Date | null) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
}

function formatDateTime(value: Date | string | null) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR");
}

export async function loader({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const dashboard = await getPersonalNewsDashboard(user.id);
  return { user, dashboard };
}

export async function action({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "generate_digest") {
    const sendTelegram = String(formData.get("sendTelegram") || "false") === "true";
    const result = await generatePersonalNewsDigest(user.id, { sendTelegram });
    return data({
      ok: true,
      message:
        result.totalItems === 0
          ? "Nenhuma noticia nova encontrada para montar o digest."
          : sendTelegram && result.sent
            ? `Digest gerado e enviado no Telegram com ${result.totalItems} itens.`
            : `Digest gerado no SaaS com ${result.totalItems} itens.`,
    });
  }

  if (intent === "create_source") {
    const topic = String(formData.get("topic") || "") as PersonalNewsTopic;
    const name = String(formData.get("name") || "").trim();
    const query = String(formData.get("query") || "").trim();
    const maxItems = Math.max(1, Math.min(10, Number(formData.get("maxItems") || 4)));

    if (!["ai", "bh", "world", "comex"].includes(topic) || !name || !query) {
      return data({ ok: false, message: "Preencha tema, nome e query da fonte." }, { status: 400 });
    }

    await db.insert(personalNewsSources).values({
      userId: user.id,
      topic,
      name,
      query,
      sourceType: "google_news_rss",
      sourceUrl: "https://news.google.com",
      maxItems,
      priority: 5,
      isActive: true,
    });

    return data({ ok: true, message: "Fonte adicionada ao radar." });
  }

  if (intent === "seed_defaults") {
    const existing = await db
      .select({ id: personalNewsSources.id })
      .from(personalNewsSources)
      .where(and(eq(personalNewsSources.userId, user.id), isNull(personalNewsSources.deletedAt)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(personalNewsSources).values(
        DEFAULT_PERSONAL_NEWS_SOURCES.map((source) => ({
          userId: user.id,
          topic: source.topic,
          name: source.name,
          query: source.query,
          sourceType: "google_news_rss",
          sourceUrl: source.sourceUrl ?? "https://news.google.com",
          maxItems: source.maxItems ?? 4,
          priority: source.priority ?? 5,
          isActive: true,
        }))
      );
      return data({ ok: true, message: "Fontes padrao registradas." });
    }

    return data({ ok: true, message: "As fontes padrao ja estavam registradas." });
  }

  if (intent === "toggle_source") {
    const sourceId = String(formData.get("sourceId") || "");
    const current = String(formData.get("current") || "true") === "true";

    await db
      .update(personalNewsSources)
      .set({ isActive: !current, updatedAt: new Date() })
      .where(and(eq(personalNewsSources.id, sourceId), eq(personalNewsSources.userId, user.id)));

    return data({ ok: true, message: !current ? "Fonte reativada." : "Fonte pausada." });
  }

  if (intent === "delete_source") {
    const sourceId = String(formData.get("sourceId") || "");

    await db
      .update(personalNewsSources)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(personalNewsSources.id, sourceId), eq(personalNewsSources.userId, user.id)));

    return data({ ok: true, message: "Fonte removida do radar." });
  }

  if (intent === "toggle_item") {
    const itemId = String(formData.get("itemId") || "");
    const field = String(formData.get("field") || "");
    const current = String(formData.get("current") || "false") === "true";

    if (field !== "isRead" && field !== "isStarred") {
      return data({ ok: false, message: "Campo invalido." }, { status: 400 });
    }

    await db
      .update(personalNewsItems)
      .set({ [field]: !current, updatedAt: new Date() })
      .where(and(eq(personalNewsItems.id, itemId), eq(personalNewsItems.userId, user.id)));

    return data({ ok: true, message: "Item atualizado." });
  }

  return data({ ok: false, message: "Acao nao reconhecida." }, { status: 400 });
}

export default function PersonalLifeNewsPage() {
  const { dashboard } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const topicOrder: PersonalNewsTopic[] = ["ai", "bh", "world", "comex"];
  const latestDigest = dashboard.digests[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-[var(--app-border-strong)] bg-[linear-gradient(135deg,#081322_0%,#10253a_52%,#173b54_100%)] px-6 py-6 text-slate-100 shadow-[0_28px_70px_rgba(15,23,42,0.16)] lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.20),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_32%)]" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.55fr_0.95fr]">
          <div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
              Radar pessoal
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white lg:text-4xl">
              Noticias em quatro frentes: IA, BH, mundo e comex.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              O modulo organiza fontes, coleta manchetes por query, salva o digest no SaaS e pode disparar o resumo diario no Telegram.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Form method="post">
                <input type="hidden" name="intent" value="generate_digest" />
                <input type="hidden" name="sendTelegram" value="false" />
                <Button className="rounded-full border border-white/12 bg-white/10 text-white hover:bg-white/15" disabled={isSubmitting}>
                  <RefreshCcw className="h-4 w-4" />
                  Atualizar radar
                </Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="generate_digest" />
                <input type="hidden" name="sendTelegram" value="true" />
                <Button className="rounded-full border border-emerald-300/20 bg-emerald-500/15 text-white hover:bg-emerald-500/25" disabled={isSubmitting}>
                  <Send className="h-4 w-4" />
                  Gerar digest + Telegram
                </Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="seed_defaults" />
                <Button className="rounded-full border border-white/12 bg-white/5 text-white hover:bg-white/10" disabled={isSubmitting}>
                  <Bot className="h-4 w-4" />
                  Reaplicar fontes padrao
                </Button>
              </Form>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Fontes ativas</p>
              <p className="mt-2 text-3xl font-semibold text-white">{dashboard.metrics.activeSources}</p>
              <p className="mt-1 text-sm text-slate-300">Queries de monitoramento ligadas no radar.</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Ultimo digest</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {latestDigest ? formatDate(latestDigest.digestDate) : "Sem digest"}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {latestDigest ? `${latestDigest.itemCount} itens consolidados` : "Gere o primeiro resumo para abastecer o painel."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {actionData?.message ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${actionData.ok ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "border-rose-300/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"}`}>
          {actionData.message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={`${panelClass} p-5`}>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--app-muted)]">Itens nao lidos</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--app-text)]">{dashboard.metrics.unreadItems}</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Headlines ainda sem leitura no SaaS.</p>
        </div>
        <div className={`${panelClass} p-5`}>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--app-muted)]">Favoritas</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--app-text)]">{dashboard.metrics.starredItems}</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Itens salvos para acompanhar depois.</p>
        </div>
        <div className={`${panelClass} p-5`}>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--app-muted)]">Itens recentes</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--app-text)]">{dashboard.items.length}</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Ultimos artigos salvos no radar.</p>
        </div>
        <div className={`${panelClass} p-5`}>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--app-muted)]">Digests salvos</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--app-text)]">{dashboard.digests.length}</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Historico local pronto para consulta e Telegram.</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_1.35fr]">
        <div className={`${panelClass} p-5 lg:p-6`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--app-text)]">Fontes do radar</h2>
              <p className="text-sm text-[var(--app-muted)]">Cada fonte vira uma query fixa de monitoramento.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {dashboard.sources.map((source) => {
              const meta = PERSONAL_NEWS_TOPIC_META[source.topic as PersonalNewsTopic];
              const Icon = topicIcons[source.topic as PersonalNewsTopic] ?? Newspaper;
              const lastStatusColor =
                source.lastStatus === "error"
                  ? "text-rose-600 dark:text-rose-200"
                  : source.lastStatus === "ok"
                    ? "text-emerald-600 dark:text-emerald-200"
                    : "text-[var(--app-muted)]";

              return (
                <div key={source.id} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-surface-2)] text-[var(--app-text)]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[var(--app-text)]">{source.name}</p>
                          <p className="text-xs text-[var(--app-muted)]">{meta.label}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-[var(--app-muted)]">{source.query}</p>
                      <p className={`mt-2 text-xs ${lastStatusColor}`}>
                        Ultima coleta: {formatDateTime(source.lastCheckedAt)} | status: {source.lastStatus}
                      </p>
                      {source.lastError ? (
                        <p className="mt-1 text-xs text-rose-600 dark:text-rose-200">{source.lastError}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Form method="post">
                        <input type="hidden" name="intent" value="toggle_source" />
                        <input type="hidden" name="sourceId" value={source.id} />
                        <input type="hidden" name="current" value={String(source.isActive)} />
                        <Button size="sm" className="rounded-full" disabled={isSubmitting}>
                          {source.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {source.isActive ? "Pausar" : "Ativar"}
                        </Button>
                      </Form>
                      <Form method="post">
                        <input type="hidden" name="intent" value="delete_source" />
                        <input type="hidden" name="sourceId" value={source.id} />
                        <Button size="sm" variant="ghost" className="rounded-full" disabled={isSubmitting}>
                          Remover
                        </Button>
                      </Form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface)] p-4">
            <h3 className="text-sm font-semibold text-[var(--app-text)]">Adicionar fonte manual</h3>
            <Form method="post" className="mt-4 grid gap-3 md:grid-cols-2">
              <input type="hidden" name="intent" value="create_source" />
              <select name="topic" className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-2.5 text-sm text-[var(--app-text)]">
                <option value="ai">IA / LLM / AI</option>
                <option value="bh">BH</option>
                <option value="world">Mundo</option>
                <option value="comex">Comex</option>
              </select>
              <input
                type="text"
                name="name"
                placeholder="Nome da fonte"
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-2.5 text-sm text-[var(--app-text)]"
              />
              <input
                type="text"
                name="query"
                placeholder="Query do Google News RSS"
                className="md:col-span-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-2.5 text-sm text-[var(--app-text)]"
              />
              <input
                type="number"
                name="maxItems"
                min="1"
                max="10"
                defaultValue="4"
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-2.5 text-sm text-[var(--app-text)]"
              />
              <Button className="rounded-full md:justify-self-start" disabled={isSubmitting}>
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </Form>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${panelClass} p-5 lg:p-6`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--app-text)]">Ultimo digest</h2>
                <p className="text-sm text-[var(--app-muted)]">Resumo salvo no SaaS e pronto para Telegram.</p>
              </div>
              {latestDigest ? (
                <span className="rounded-full bg-[var(--app-surface-2)] px-3 py-1 text-xs font-medium text-[var(--app-muted)]">
                  {formatDate(latestDigest.digestDate)}
                </span>
              ) : null}
            </div>

            {latestDigest ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  <p className="text-sm font-semibold text-[var(--app-text)]">{latestDigest.title}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--app-text)]">
                    {latestDigest.digestMarkdown}
                  </p>
                </div>
                <div className="text-xs text-[var(--app-muted)]">
                  Itens: {latestDigest.itemCount} | Status: {latestDigest.status} | Telegram: {formatDateTime(latestDigest.telegramSentAt)}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface)] p-5 text-sm text-[var(--app-muted)]">
                Ainda nao existe digest salvo. Use "Atualizar radar" para gerar o primeiro.
              </div>
            )}
          </div>

          <div className={`${panelClass} p-5 lg:p-6`}>
            <div>
              <h2 className="text-lg font-semibold text-[var(--app-text)]">Headlines por tema</h2>
              <p className="text-sm text-[var(--app-muted)]">Feed curto para leitura rapida dentro do SaaS.</p>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {topicOrder.map((topic) => {
                const meta = PERSONAL_NEWS_TOPIC_META[topic];
                const Icon = topicIcons[topic];
                const items = dashboard.itemsByTopic[topic].slice(0, 4);

                return (
                  <div key={topic} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-surface-2)] text-[var(--app-text)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[var(--app-text)]">{meta.label}</p>
                        <p className="text-xs text-[var(--app-muted)]">{meta.description}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {items.length === 0 ? (
                        <p className="text-sm text-[var(--app-muted)]">Sem headlines coletadas ainda.</p>
                      ) : (
                        items.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-[var(--app-text)]">{item.title}</p>
                                <p className="mt-1 text-xs text-[var(--app-muted)]">
                                  {(item.sourceName || "Fonte") + " | " + formatDateTime(item.publishedAt)}
                                </p>
                                {item.summary ? (
                                  <p className="mt-2 text-sm text-[var(--app-muted)]">{item.summary.slice(0, 180)}</p>
                                ) : null}
                              </div>
                              <div className="flex flex-col gap-2">
                                <Form method="post">
                                  <input type="hidden" name="intent" value="toggle_item" />
                                  <input type="hidden" name="itemId" value={item.id} />
                                  <input type="hidden" name="field" value="isStarred" />
                                  <input type="hidden" name="current" value={String(item.isStarred)} />
                                  <Button size="sm" variant="ghost" className="rounded-full px-2" disabled={isSubmitting}>
                                    {item.isStarred ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                                  </Button>
                                </Form>
                                <Form method="post">
                                  <input type="hidden" name="intent" value="toggle_item" />
                                  <input type="hidden" name="itemId" value={item.id} />
                                  <input type="hidden" name="field" value="isRead" />
                                  <input type="hidden" name="current" value={String(item.isRead)} />
                                  <Button size="sm" variant="ghost" className="rounded-full px-2" disabled={isSubmitting}>
                                    {item.isRead ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                </Form>
                              </div>
                            </div>

                            <div className="mt-3">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-500 dark:text-sky-300"
                              >
                                Abrir materia
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
