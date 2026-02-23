/**
 * GET/POST /personal-life/promotions
 * Promoções e Sorteios Pessoais — hobby do Luiz
 *
 * Registra promoções/sorteios externos em que o Luiz participa
 * (Sorteio Natura, Black Friday, concursos, etc.)
 * Usa a tabela `promotions` do schema personal-life, com userId.
 */

import { Form, useLoaderData, useNavigation } from "react-router";
import { useState, useRef } from "react";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { promotions } from "../../drizzle/schema/personal-life";
import { and, desc, eq, isNull } from "drizzle-orm";
import { data } from "react-router";
import {
  Plus,
  Gift,
  Trophy,
  Clock,
  XCircle,
  ExternalLink,
  Trash2,
  FileText,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "~/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────

type Promotion = typeof promotions.$inferSelect;

const TYPE_LABELS: Record<string, string> = {
  raffle: "Sorteio",
  contest: "Concurso",
  cashback: "Cashback",
  lucky_draw: "Raspadinha/Cupom",
  giveaway: "Giveaway",
  other: "Outro",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: "Participando",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    icon: <Clock className="h-3 w-3" />,
  },
  participated: {
    label: "Aguardando resultado",
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    icon: <Clock className="h-3 w-3" />,
  },
  won: {
    label: "Ganhei! 🎉",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    icon: <Trophy className="h-3 w-3" />,
  },
  lost: {
    label: "Não ganhei",
    color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    icon: <XCircle className="h-3 w-3" />,
  },
};

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function daysUntilEnd(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(dateStr + "T00:00:00");
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Loader ─────────────────────────────────────────────────────────────────

export async function loader({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") ?? "active";

  // Busca promoções pessoais do usuário
  const allPromotions = await db
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.userId, user.id),
        isNull(promotions.deletedAt),
      )
    )
    .orderBy(desc(promotions.endDate));

  // KPIs
  const active = allPromotions.filter(
    (p) => p.participationStatus === "pending" || p.participationStatus === "participated"
  );
  const won = allPromotions.filter((p) => p.participationStatus === "won");
  const expiringSoon = active.filter((p) => {
    const days = daysUntilEnd(p.endDate);
    return days >= 0 && days <= 7;
  });

  // Filtra para exibição
  const filtered =
    statusFilter === "active"
      ? allPromotions.filter(
          (p) => p.participationStatus === "pending" || p.participationStatus === "participated"
        )
      : statusFilter === "won"
      ? allPromotions.filter((p) => p.participationStatus === "won")
      : statusFilter === "lost"
      ? allPromotions.filter((p) => p.participationStatus === "lost")
      : allPromotions;

  return {
    promotions: filtered as Promotion[],
    kpis: {
      active: active.length,
      won: won.length,
      expiringSoon: expiringSoon.length,
      total: allPromotions.length,
    },
    statusFilter,
  };
}

// ── Action ─────────────────────────────────────────────────────────────────

export async function action({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "create") {
    const name = formData.get("name") as string;
    const company = formData.get("company") as string;
    const type = (formData.get("type") as string) || "raffle";
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const prize = formData.get("prize") as string | null;
    const link = formData.get("link") as string | null;
    const rules = formData.get("rules") as string | null;
    const notes = formData.get("notes") as string | null;

    if (!name || !company || !startDate || !endDate) {
      return data({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    await db.insert(promotions).values({
      userId: user.id,
      name,
      company,
      type,
      startDate,
      endDate,
      prize: prize || null,
      link: link || null,
      rules: rules || null,
      notes: notes || null,
      participationStatus: "pending",
    });

    return data({ success: true });
  }

  if (intent === "update_status") {
    const promotionId = formData.get("promotionId") as string;
    const status = formData.get("status") as string;

    await db
      .update(promotions)
      .set({ participationStatus: status, updatedAt: new Date() })
      .where(and(eq(promotions.id, promotionId), eq(promotions.userId, user.id)));

    return data({ success: true });
  }

  if (intent === "delete") {
    const promotionId = formData.get("promotionId") as string;
    await db
      .update(promotions)
      .set({ deletedAt: new Date() })
      .where(and(eq(promotions.id, promotionId), eq(promotions.userId, user.id)));

    return data({ success: true });
  }

  return data({ error: "Ação inválida" }, { status: 400 });
}

// ── Page Component ─────────────────────────────────────────────────────────

export default function PromotionsPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { promotions: promo, kpis, statusFilter } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showForm, setShowForm] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Refs para auto-fill via IA
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);
  const prizeRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const today = new Date().toISOString().split("T")[0];

  async function handlePdfExtract(file: File) {
    setExtracting(true);
    setExtractError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/promotion-extract", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) {
        setExtractError(json.error || "Erro na extração");
        return;
      }
      const f = json.fields as Record<string, string | null>;
      if (nameRef.current && f.name)           nameRef.current.value = f.name;
      if (companyRef.current && f.company)     companyRef.current.value = f.company;
      if (typeRef.current && f.type)           typeRef.current.value = f.type;
      if (prizeRef.current && f.prize)         prizeRef.current.value = f.prize;
      if (startDateRef.current && f.startDate) startDateRef.current.value = f.startDate;
      if (endDateRef.current && f.endDate)     endDateRef.current.value = f.endDate;
      if (linkRef.current && f.link)           linkRef.current.value = f.link;
      if (notesRef.current && f.rules)         notesRef.current.value = f.rules;
    } catch {
      setExtractError("Falha ao conectar com o servidor");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🎁 Promoções e Sorteios
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Concursos, sorteios e promoções em que você está participando
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" />
          {showForm ? "Fechar" : "Nova Promoção"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
          <p className="text-xs font-medium uppercase text-blue-700 dark:text-blue-400">Participando</p>
          <p className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-200">{kpis.active}</p>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">promoções ativas</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-900/20">
          <p className="text-xs font-medium uppercase text-yellow-700 dark:text-yellow-400">Encerrando em breve</p>
          <p className="mt-2 text-2xl font-bold text-yellow-900 dark:text-yellow-200">{kpis.expiringSoon}</p>
          <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">nos próximos 7 dias</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-900/20">
          <p className="text-xs font-medium uppercase text-green-700 dark:text-green-400">Ganhei!</p>
          <p className="mt-2 text-2xl font-bold text-green-900 dark:text-green-200">{kpis.won}</p>
          <p className="mt-1 text-xs text-green-700 dark:text-green-400">prêmios conquistados</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Total cadastrado</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{kpis.total}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">promoções registradas</p>
        </div>
      </div>

      {/* Formulário inline */}
      {showForm && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-900 dark:bg-indigo-950/30">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Nova Promoção / Sorteio</h3>
          <Form method="post" className="space-y-4" onSubmit={() => setShowForm(false)}>
            <input type="hidden" name="_intent" value="create" />

            {/* Upload de regulamento PDF para auto-preenchimento com IA */}
            <div className="rounded-lg border border-dashed border-indigo-300 bg-white p-3 dark:border-indigo-700 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <FileText className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  Anexar regulamento em PDF para auto-preencher os campos
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {extracting && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={extracting}
                  >
                    <Sparkles className="mr-1 h-3 w-3 text-indigo-500" />
                    {extracting ? "Extraindo..." : "Extrair com IA"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePdfExtract(f);
                    }}
                  />
                </div>
              </div>
              {extractError && (
                <p className="mt-1.5 text-xs text-red-500">{extractError}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Nome da Promoção *
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  name="name"
                  required
                  placeholder="Ex: Sorteio Natal Natura"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Empresa / Marca *
                </label>
                <input
                  ref={companyRef}
                  type="text"
                  name="company"
                  required
                  placeholder="Ex: Natura, Amazon, Magazine Luiza"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Tipo
                </label>
                <select
                  ref={typeRef}
                  name="type"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Data Início *
                </label>
                <input
                  ref={startDateRef}
                  type="date"
                  name="startDate"
                  required
                  defaultValue={today}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Data Fim *
                </label>
                <input
                  ref={endDateRef}
                  type="date"
                  name="endDate"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Prêmio
                </label>
                <input
                  ref={prizeRef}
                  type="text"
                  name="prize"
                  placeholder="Ex: iPhone 16, R$ 1.000, Viagem"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Link
                </label>
                <input
                  ref={linkRef}
                  type="url"
                  name="link"
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Observações / Regras
              </label>
              <textarea
                ref={notesRef}
                name="notes"
                rows={2}
                placeholder="Regras, como participar, código de participação..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Adicionar promoção"}
              </Button>
            </div>
          </Form>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: "active", label: "Ativas" },
          { value: "won", label: "Ganhei 🏆" },
          { value: "lost", label: "Encerradas" },
          { value: "all", label: "Todas" },
        ].map((f) => (
          <a
            key={f.value}
            href={`?status=${f.value}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-indigo-600 text-white"
                : "border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {/* Lista de promoções */}
      {promo.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <Gift className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">
            {statusFilter === "active"
              ? "Nenhuma promoção ativa. Adicione uma!"
              : "Nenhuma promoção nesta categoria."}
          </p>
          <Button className="mt-4" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar promoção
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {promo.map((p) => {
            const days = daysUntilEnd(p.endDate);
            const statusCfg = STATUS_CONFIG[p.participationStatus ?? "pending"] ?? STATUS_CONFIG.pending;
            const isExpired = days < 0;

            return (
              <div
                key={p.id}
                className={`rounded-xl border bg-white p-4 transition-colors dark:bg-gray-950 ${
                  p.participationStatus === "won"
                    ? "border-green-300 dark:border-green-700"
                    : isExpired
                    ? "border-gray-200 opacity-70 dark:border-gray-800"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">{p.name}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                      <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        {TYPE_LABELS[p.type] ?? p.type}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      <strong>{p.company}</strong>
                      {p.prize ? ` · Prêmio: ${p.prize}` : ""}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        📅 {formatDate(p.startDate)} → {formatDate(p.endDate)}
                      </span>
                      {!isExpired && (p.participationStatus === "pending" || p.participationStatus === "participated") && (
                        <span className={days <= 3 ? "font-semibold text-red-500" : days <= 7 ? "text-yellow-600" : ""}>
                          {days === 0 ? "Encerra hoje!" : days === 1 ? "Encerra amanhã" : `${days} dias restantes`}
                        </span>
                      )}
                      {p.link && (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver promoção
                        </a>
                      )}
                    </div>

                    {p.notes && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {p.notes}
                      </p>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    {/* Update status */}
                    <Form method="post" className="flex gap-1">
                      <input type="hidden" name="_intent" value="update_status" />
                      <input type="hidden" name="promotionId" value={p.id} />
                      <select
                        name="status"
                        defaultValue={p.participationStatus ?? "pending"}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      >
                        <option value="pending">Participando</option>
                        <option value="participated">Aguardando resultado</option>
                        <option value="won">Ganhei! 🏆</option>
                        <option value="lost">Não ganhei</option>
                      </select>
                    </Form>

                    {/* Delete */}
                    <Form
                      method="post"
                      onSubmit={(e) => !confirm("Remover esta promoção?") && e.preventDefault()}
                    >
                      <input type="hidden" name="_intent" value="delete" />
                      <input type="hidden" name="promotionId" value={p.id} />
                      <button
                        type="submit"
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800 dark:hover:text-red-400"
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
