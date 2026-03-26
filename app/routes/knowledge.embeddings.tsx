import { useMemo, type ReactNode } from "react";
import { Form, Link, type ActionFunctionArgs, type LoaderFunctionArgs, useActionData, useNavigation, useSearchParams } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import type { Locale } from "~/i18n";
import {
  indexEmbeddingDocument,
  getEmbeddingSystemStatus,
  searchEmbeddingChunks,
  type EmbeddingScopeType,
} from "~/lib/embeddings.server";
import { db } from "~/lib/db.server";
import { clients, contacts, processes } from "../../drizzle/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Brain, ArrowLeft, Search, Sparkles, Database, Layers3 } from "lucide-react";

const SCOPE_LABELS: Record<EmbeddingScopeType, string> = {
  business: "Negocio",
  personal: "Pessoal",
  system: "Sistema",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const scope = (url.searchParams.get("scope") as EmbeddingScopeType | null) || "business";

  const [status, results] = await Promise.all([
    getEmbeddingSystemStatus(),
    q ? searchEmbeddingChunks({ query: q, scopeType: scope, companyId }) : Promise.resolve([]),
  ]);

  return {
    locale,
    status,
    scope,
    q,
    results,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent !== "backfill_business") {
    return { error: "Acao invalida." };
  }

  const [clientRows, processRows] = await Promise.all([
    db
      .select({
        id: clients.id,
        razaoSocial: clients.razaoSocial,
        nomeFantasia: clients.nomeFantasia,
        cnpj: clients.cnpj,
        cnaeCode: clients.cnaeCode,
        cnaeDescription: clients.cnaeDescription,
        city: clients.city,
        state: clients.state,
        status: clients.status,
        notes: clients.notes,
      })
      .from(clients)
      .where(and(eq(clients.companyId, companyId), isNull(clients.deletedAt)))
      .orderBy(desc(clients.updatedAt))
      .limit(250),
    db
      .select({
        id: processes.id,
        reference: processes.reference,
        processType: processes.processType,
        status: processes.status,
        description: processes.description,
        hsCode: processes.hsCode,
        incoterm: processes.incoterm,
        originCountry: processes.originCountry,
        destinationCountry: processes.destinationCountry,
        portOfOrigin: processes.portOfOrigin,
        portOfDestination: processes.portOfDestination,
        customsBroker: processes.customsBroker,
        notes: processes.notes,
        costNotes: processes.costNotes,
        clientName: clients.razaoSocial,
      })
      .from(processes)
      .innerJoin(clients, eq(processes.clientId, clients.id))
      .where(and(eq(processes.companyId, companyId), isNull(processes.deletedAt)))
      .orderBy(desc(processes.updatedAt))
      .limit(250),
  ]);

  let indexed = 0;
  let skipped = 0;

  for (const client of clientRows) {
    const body = [
      `Cliente: ${client.razaoSocial}`,
      client.nomeFantasia ? `Nome fantasia: ${client.nomeFantasia}` : null,
      `CNPJ: ${client.cnpj}`,
      client.cnaeCode ? `CNAE: ${client.cnaeCode}` : null,
      client.cnaeDescription ? `CNAE descricao: ${client.cnaeDescription}` : null,
      client.city ? `Cidade: ${client.city}` : null,
      client.state ? `UF: ${client.state}` : null,
      client.status ? `Status: ${client.status}` : null,
      client.notes ? `Observacoes: ${client.notes}` : null,
    ].filter(Boolean).join("\n");

    const result = await indexEmbeddingDocument({
      scopeType: "business",
      sourceType: "client",
      sourceId: client.id,
      title: client.razaoSocial,
      body,
      companyId,
      userId: user.id,
      metadata: { cnpj: client.cnpj, status: client.status },
    });

    if (result.skipped) skipped += 1;
    else indexed += 1;
  }

  for (const process of processRows) {
    const body = [
      `Processo: ${process.reference}`,
      `Cliente: ${process.clientName}`,
      `Tipo: ${process.processType}`,
      `Status: ${process.status}`,
      process.description ? `Descricao: ${process.description}` : null,
      process.hsCode ? `NCM/HS: ${process.hsCode}` : null,
      process.incoterm ? `Incoterm: ${process.incoterm}` : null,
      process.originCountry ? `Origem: ${process.originCountry}` : null,
      process.destinationCountry ? `Destino: ${process.destinationCountry}` : null,
      process.portOfOrigin ? `Porto origem: ${process.portOfOrigin}` : null,
      process.portOfDestination ? `Porto destino: ${process.portOfDestination}` : null,
      process.customsBroker ? `Despachante: ${process.customsBroker}` : null,
      process.costNotes ? `Notas de custo: ${process.costNotes}` : null,
      process.notes ? `Observacoes: ${process.notes}` : null,
    ].filter(Boolean).join("\n");

    const result = await indexEmbeddingDocument({
      scopeType: "business",
      sourceType: "process",
      sourceId: process.id,
      title: process.reference,
      body,
      companyId,
      userId: user.id,
      metadata: {
        clientName: process.clientName,
        status: process.status,
        processType: process.processType,
      },
    });

    if (result.skipped) skipped += 1;
    else indexed += 1;
  }

  return {
    success: true,
    message: `Backfill concluido: ${indexed} documentos indexados, ${skipped} pulados.`,
  };
}

type KnowledgeEmbeddingsLoaderData = Awaited<ReturnType<typeof loader>>;

export default function KnowledgeEmbeddingsPage({ loaderData }: { loaderData: KnowledgeEmbeddingsLoaderData }) {
  const { status, scope, q, results } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const scopeOptions = useMemo(
    () => [
      { value: "business" as const, label: "Business / SaaS" },
      { value: "personal" as const, label: "Pessoal" },
      { value: "system" as const, label: "Sistema / Hermes Agent" },
    ],
    [],
  );

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Conhecimento</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--app-text)]">
            Memória Semântica
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--app-muted)]">
            Base para embeddings, busca semântica e RAG do SaaS e do Hermes Agent.
          </p>
        </div>
        <Link
          to="/agents"
          className="hidden rounded-full border border-[var(--app-border-strong)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition-colors hover:bg-black/5 lg:inline-flex"
        >
          Voltar aos agentes
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard title="Extensão vector" value={status.extensionEnabled ? "Ativa" : "Pendente"} icon={<Database className="h-5 w-5" />} highlight={status.extensionEnabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"} />
        <StatusCard title="Provider" value={status.provider} icon={<Sparkles className="h-5 w-5" />} />
        <StatusCard title="Modelo" value={status.model} icon={<Brain className="h-5 w-5" />} />
        <StatusCard title="Dimensões" value={`${status.dimensions}`} icon={<Layers3 className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatusCard title="Documentos" value={`${status.documents}`} />
        <StatusCard title="Chunks" value={`${status.chunks}`} />
        <StatusCard title="Jobs pendentes" value={`${status.pendingJobs}`} highlight={status.pendingJobs > 0 ? "bg-amber-50 text-amber-700" : undefined} />
        <StatusCard title="Jobs falhos" value={`${status.failedJobs}`} highlight={status.failedJobs > 0 ? "bg-rose-50 text-rose-700" : undefined} />
      </div>

      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-card-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Busca semântica</h2>
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              Procure por significado em documentos já indexados do seu contexto.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/agents?tab=knowledge"
              className="rounded-full bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-[var(--app-on-accent)]"
            >
              Abrir conhecimento IA
            </Link>
            <Form method="post">
              <input type="hidden" name="intent" value="backfill_business" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full border border-[var(--app-border-strong)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition-colors hover:bg-black/5 disabled:opacity-60"
              >
                {isSubmitting ? "Indexando..." : "Indexar CRM + Processos"}
              </button>
            </Form>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
            <input
              type="text"
              value={q}
              onChange={(event) => updateParam("q", event.target.value)}
              placeholder="Ex.: processo com atraso no embarque, cliente com observacao critica..."
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] py-3 pl-10 pr-4 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-accent)]"
            />
          </div>

          <select
            value={scope}
            onChange={(event) => updateParam("scope", event.target.value)}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-3 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-accent)]"
          >
            {scopeOptions.map((option: (typeof scopeOptions)[number]) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <Link
            to="?"
            className="rounded-xl border border-[var(--app-border-strong)] px-4 py-3 text-center text-sm font-medium text-[var(--app-text)] transition-colors hover:bg-black/5"
          >
            Limpar
          </Link>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-card-shadow)]">
          <h2 className="text-lg font-semibold">Fontes prioritárias</h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--app-muted)]">
            <li>CRM: clientes, contatos e observações relevantes.</li>
            <li>Processos: descrição, timeline e contexto operacional.</li>
            <li>Promos e rádio: links, regras e vigências futuras.</li>
            <li>Docs internos: changelog, memory e arquivos de operação.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-card-shadow)]">
          <h2 className="text-lg font-semibold">Próximas ações automáticas</h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--app-muted)]">
            <li>Backfill inicial de clientes e processos com hash incremental.</li>
            <li>Indexação incremental ao salvar cliente, processo ou observação.</li>
            <li>Tool do Hermes Agent para recuperar contexto semântico por domínio.</li>
            <li>RAG operacional para briefing e investigação de incidentes.</li>
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-card-shadow)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Resultados da busca</h2>
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              {q ? `${results.length} resultado(s) para "${q}" em ${SCOPE_LABELS[scope]}` : "Digite uma busca para consultar o índice."}
            </p>
          </div>
          <Link
            to="/agents"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border-strong)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition-colors hover:bg-black/5"
          >
            <ArrowLeft className="h-4 w-4" />
            Agentes
          </Link>
        </div>

        {actionData && "message" in actionData ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {actionData.message}
          </div>
        ) : null}
        {actionData && "error" in actionData ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionData.error}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {results.length > 0 ? (
            results.map((item: KnowledgeEmbeddingsLoaderData["results"][number]) => (
              <article key={item.chunkId} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--app-text)]">{item.title}</p>
                    <p className="text-xs text-[var(--app-muted)]">{item.sourceType} · {item.sourceId}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    score {(item.score * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--app-muted)]">{item.chunkText}</p>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--app-border)] p-8 text-center text-sm text-[var(--app-muted)]">
              Sem resultados ainda. Depois do backfill, esta tela vira a entrada do RAG do Hermes Agent.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatusCard({
  title,
  value,
  icon,
  highlight,
}: {
  title: string;
  value: string;
  icon?: ReactNode;
  highlight?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-card-shadow)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--app-muted)]">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{value}</p>
        </div>
        {icon ? (
          <div className={`rounded-xl px-3 py-2 ${highlight ?? "bg-slate-100 text-slate-600"}`}>
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
