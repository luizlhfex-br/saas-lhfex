import { and, asc, eq, ilike } from "drizzle-orm";
import { ExternalLink, Link2, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { Form, type ActionFunctionArgs, type LoaderFunctionArgs, useActionData, useNavigation } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import type { Locale } from "~/i18n";
import { promotionSites } from "../../drizzle/schema/personal-life";

const SOURCE_MARKER = "[IA-UPDATES]";

const DEFAULT_SOURCES = [
  { name: "OpenClaw Releases", url: "https://github.com/openclaw/openclaw/releases", notes: "Releases oficiais do OpenClaw." },
  { name: "Awesome OpenClaw Agents", url: "https://github.com/mergisi/awesome-openclaw-agents", notes: "Repositorio com referencias e exemplos." },
  { name: "Coolify Releases", url: "https://github.com/coollabsio/coolify/releases", notes: "Novidades de deploy e plataforma." },
  { name: "skills.sh", url: "https://skills.sh/", notes: "Catalogo de skills." },
  { name: "MCP Market", url: "https://mcpmarket.com/", notes: "Ferramentas e skills MCP." },
  { name: "ClawHub Skills", url: "https://clawhub.ai/skills?sort=downloads", notes: "Skills populares no ecossistema OpenClaw." },
];

function buildDescription(notes: string) {
  const normalized = notes.trim();
  return normalized ? `${SOURCE_MARKER} ${normalized}` : SOURCE_MARKER;
}

function extractNotes(description: string | null) {
  if (!description) return "";
  if (!description.startsWith(SOURCE_MARKER)) return "";
  return description.slice(SOURCE_MARKER.length).trim();
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireAuth(request);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const sources = await db
    .select({
      id: promotionSites.id,
      name: promotionSites.name,
      url: promotionSites.url,
      description: promotionSites.description,
      isActive: promotionSites.isActive,
      updatedAt: promotionSites.updatedAt,
    })
    .from(promotionSites)
    .where(and(eq(promotionSites.userId, user.id), ilike(promotionSites.description, `${SOURCE_MARKER}%`)))
    .orderBy(asc(promotionSites.name));

  return {
    locale,
    sources: sources.map((source) => ({
      ...source,
      notes: extractNotes(source.description),
    })),
    defaultSources: DEFAULT_SOURCES,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "seed_defaults") {
    let inserted = 0;
    let reactivated = 0;

    for (const source of DEFAULT_SOURCES) {
      const [existing] = await db
        .select({ id: promotionSites.id, isActive: promotionSites.isActive })
        .from(promotionSites)
        .where(and(eq(promotionSites.userId, user.id), eq(promotionSites.url, source.url)))
        .limit(1);

      if (existing) {
        if (!existing.isActive) {
          await db
            .update(promotionSites)
            .set({ isActive: true, updatedAt: new Date() })
            .where(and(eq(promotionSites.id, existing.id), eq(promotionSites.userId, user.id)));
          reactivated += 1;
        }
        continue;
      }

      await db.insert(promotionSites).values({
        userId: user.id,
        name: source.name,
        url: source.url,
        description: buildDescription(source.notes),
        isActive: true,
      });
      inserted += 1;
    }

    return { message: `Fontes sugeridas aplicadas: ${inserted} novas, ${reactivated} reativadas.` };
  }

  if (intent === "add_source") {
    const name = String(formData.get("name") || "").trim();
    const url = String(formData.get("url") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    if (!name) return { error: "Informe o nome da fonte." };
    if (!url) return { error: "Informe a URL da fonte." };
    if (!isValidHttpUrl(url)) return { error: "URL invalida. Use http:// ou https://." };

    const [existing] = await db
      .select({ id: promotionSites.id })
      .from(promotionSites)
      .where(and(eq(promotionSites.userId, user.id), eq(promotionSites.url, url)))
      .limit(1);

    if (existing) {
      await db
        .update(promotionSites)
        .set({
          name,
          description: buildDescription(notes),
          isActive: true,
          updatedAt: new Date(),
        })
        .where(and(eq(promotionSites.id, existing.id), eq(promotionSites.userId, user.id)));

      return { message: "Fonte atualizada com sucesso." };
    }

    await db.insert(promotionSites).values({
      userId: user.id,
      name,
      url,
      description: buildDescription(notes),
      isActive: true,
    });

    return { message: "Fonte adicionada com sucesso." };
  }

  if (intent === "toggle_source") {
    const id = String(formData.get("id") || "").trim();
    const current = String(formData.get("current") || "").trim() === "true";
    if (!id) return { error: "Fonte invalida." };

    await db
      .update(promotionSites)
      .set({ isActive: !current, updatedAt: new Date() })
      .where(and(eq(promotionSites.id, id), eq(promotionSites.userId, user.id)));

    return { message: current ? "Fonte pausada." : "Fonte reativada." };
  }

  if (intent === "remove_source") {
    const id = String(formData.get("id") || "").trim();
    if (!id) return { error: "Fonte invalida." };

    await db.delete(promotionSites).where(and(eq(promotionSites.id, id), eq(promotionSites.userId, user.id)));
    return { message: "Fonte removida." };
  }

  return { error: "Acao invalida." };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function AIUpdatesPage({ loaderData }: { loaderData: LoaderData }) {
  const { sources, defaultSources } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--app-muted)]">IA & AUTO</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--app-text)]">Fontes de atualizacao</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--app-muted)]">
          Cadastre links para acompanhar updates de OpenClaw, Coolify, skills e ecossistema IA.
        </p>
      </div>

      {actionData && "message" in actionData ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {actionData.message}
        </div>
      ) : null}
      {actionData && "error" in actionData ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionData.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-card-shadow)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--app-text)]">Adicionar fonte</h2>
            <Form method="post">
              <input type="hidden" name="intent" value="seed_defaults" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border-strong)] px-4 py-2 text-xs font-medium text-[var(--app-text)] transition-colors hover:bg-black/5 disabled:opacity-60"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Aplicar links sugeridos
              </button>
            </Form>
          </div>

          <Form method="post" className="mt-4 space-y-3">
            <input type="hidden" name="intent" value="add_source" />
            <input
              name="name"
              placeholder="Nome da fonte (ex.: OpenClaw Releases)"
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-accent)]"
            />
            <input
              name="url"
              type="url"
              placeholder="https://..."
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-accent)]"
            />
            <textarea
              name="notes"
              rows={3}
              placeholder="Observacoes (opcional)"
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-accent)]"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-[var(--app-on-accent)] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Salvar fonte
            </button>
          </Form>
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-card-shadow)]">
          <h2 className="text-lg font-semibold text-[var(--app-text)]">Sugeridos</h2>
          <ul className="mt-4 space-y-3">
            {defaultSources.map((source) => (
              <li key={source.url} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3">
                <p className="text-sm font-medium text-[var(--app-text)]">{source.name}</p>
                <p className="mt-1 text-xs text-[var(--app-muted)]">{source.notes}</p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--app-accent)] hover:underline"
                >
                  Abrir link
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-card-shadow)]">
        <h2 className="text-lg font-semibold text-[var(--app-text)]">Fontes cadastradas ({sources.length})</h2>
        <div className="mt-4 space-y-3">
          {sources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-muted)]">
              Nenhuma fonte cadastrada ainda.
            </div>
          ) : (
            sources.map((source) => (
              <article key={source.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--app-text)]">{source.name}</p>
                    <p className="mt-1 text-xs text-[var(--app-muted)] break-all">{source.url}</p>
                    {source.notes ? (
                      <p className="mt-2 text-xs text-[var(--app-muted)]">{source.notes}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--app-text)] transition-colors hover:bg-black/5"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Abrir
                    </a>

                    <Form method="post">
                      <input type="hidden" name="intent" value="toggle_source" />
                      <input type="hidden" name="id" value={source.id} />
                      <input type="hidden" name="current" value={source.isActive ? "true" : "false"} />
                      <button
                        type="submit"
                        className="rounded-full border border-[var(--app-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--app-text)] transition-colors hover:bg-black/5"
                      >
                        {source.isActive ? "Pausar" : "Ativar"}
                      </button>
                    </Form>

                    <Form method="post">
                      <input type="hidden" name="intent" value="remove_source" />
                      <input type="hidden" name="id" value={source.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 rounded-full border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </Form>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
