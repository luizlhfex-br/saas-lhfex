/**
 * GET/POST /personal-life/promotions
 * Promoções e Sorteios + Cadastro de Pessoas
 *
 * Aba 1 — Promoções: registra promoções/sorteios externos (Sorteio Natura, etc.)
 * Aba 2 — Pessoas: cadastro de contatos pessoais com documentos e senhas (para sorteios)
 */

import { Form, useLoaderData, useNavigation, useFetcher } from "react-router";
import { useState, useRef } from "react";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { promotions, pessoas } from "../../drizzle/schema/personal-life";
import { and, asc, desc, eq, isNull, ilike, or } from "drizzle-orm";
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
  Users,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  Search,
  Phone,
  Mail,
  Instagram,
  KeyRound,
  User,
} from "lucide-react";
import { Button } from "~/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────

type Promotion = typeof promotions.$inferSelect;
type Pessoa = typeof pessoas.$inferSelect;
type SenhaEntry = { label: string; login: string; password: string };

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
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function daysUntilEnd(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(dateStr + "T00:00:00");
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function parseSenhas(senhasStr: string | null): SenhaEntry[] {
  if (!senhasStr) return [];
  try {
    return JSON.parse(senhasStr) as SenhaEntry[];
  } catch {
    return [];
  }
}

// ── Loader ─────────────────────────────────────────────────────────────────

export async function loader({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") ?? "active";
  const pessoaSearch = url.searchParams.get("q") ?? "";

  // Promoções
  const allPromotions = await db
    .select()
    .from(promotions)
    .where(and(eq(promotions.userId, user.id), isNull(promotions.deletedAt)))
    .orderBy(desc(promotions.endDate));

  const active = allPromotions.filter(
    (p) => p.participationStatus === "pending" || p.participationStatus === "participated"
  );
  const won = allPromotions.filter((p) => p.participationStatus === "won");
  const expiringSoon = active.filter((p) => {
    const days = daysUntilEnd(p.endDate);
    return days >= 0 && days <= 7;
  });

  const filtered =
    statusFilter === "active"
      ? active
      : statusFilter === "won"
      ? won
      : statusFilter === "lost"
      ? allPromotions.filter((p) => p.participationStatus === "lost")
      : allPromotions;

  // Pessoas
  const pessoasQuery = pessoaSearch
    ? db
        .select()
        .from(pessoas)
        .where(
          and(
            eq(pessoas.userId, user.id),
            isNull(pessoas.deletedAt),
            or(
              ilike(pessoas.nomeCompleto, `%${pessoaSearch}%`),
              ilike(pessoas.celular ?? "", `%${pessoaSearch}%`),
              ilike(pessoas.email ?? "", `%${pessoaSearch}%`)
            )
          )
        )
        .orderBy(asc(pessoas.nomeCompleto))
    : db
        .select()
        .from(pessoas)
        .where(and(eq(pessoas.userId, user.id), isNull(pessoas.deletedAt)))
        .orderBy(asc(pessoas.nomeCompleto));

  const pessoasList = await pessoasQuery;

  return {
    promotions: filtered as Promotion[],
    kpis: {
      active: active.length,
      won: won.length,
      expiringSoon: expiringSoon.length,
      total: allPromotions.length,
    },
    statusFilter,
    pessoasList: pessoasList as Pessoa[],
    pessoaSearch,
  };
}

// ── Action ─────────────────────────────────────────────────────────────────

export async function action({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  // ── Promoções ──
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

  // ── Pessoas ──
  if (intent === "create_pessoa" || intent === "edit_pessoa") {
    const id = formData.get("id") as string | null;
    const nomeCompleto = formData.get("nomeCompleto") as string;
    const cpf = (formData.get("cpf") as string) || null;
    const rg = (formData.get("rg") as string) || null;
    const nascimento = (formData.get("nascimento") as string) || null;
    const celular = (formData.get("celular") as string) || null;
    const email = (formData.get("email") as string) || null;
    const instagram = (formData.get("instagram") as string) || null;
    const endereco = (formData.get("endereco") as string) || null;
    const notas = (formData.get("notas") as string) || null;

    // Senhas: múltiplos campos no formato senha_label_N, senha_login_N, senha_password_N
    const senhasArr: SenhaEntry[] = [];
    let idx = 0;
    while (formData.has(`senha_label_${idx}`)) {
      const label = (formData.get(`senha_label_${idx}`) as string) || "";
      const login = (formData.get(`senha_login_${idx}`) as string) || "";
      const password = (formData.get(`senha_password_${idx}`) as string) || "";
      if (label || login || password) {
        senhasArr.push({ label, login, password });
      }
      idx++;
    }
    const senhasJson = senhasArr.length > 0 ? JSON.stringify(senhasArr) : null;

    if (!nomeCompleto) {
      return data({ error: "Nome obrigatório" }, { status: 400 });
    }

    if (intent === "edit_pessoa" && id) {
      await db
        .update(pessoas)
        .set({
          nomeCompleto,
          cpf,
          rg,
          nascimento,
          celular,
          email,
          instagram,
          endereco,
          senhas: senhasJson,
          notas,
          updatedAt: new Date(),
        })
        .where(and(eq(pessoas.id, id), eq(pessoas.userId, user.id)));
    } else {
      await db.insert(pessoas).values({
        userId: user.id,
        nomeCompleto,
        cpf,
        rg,
        nascimento,
        celular,
        email,
        instagram,
        endereco,
        senhas: senhasJson,
        notas,
      });
    }

    return data({ success: true });
  }

  if (intent === "delete_pessoa") {
    const id = formData.get("id") as string;
    await db
      .update(pessoas)
      .set({ deletedAt: new Date() })
      .where(and(eq(pessoas.id, id), eq(pessoas.userId, user.id)));

    return data({ success: true });
  }

  return data({ error: "Ação inválida" }, { status: 400 });
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
      title="Copiar"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function SenhaField({
  idx,
  defaultLabel,
  defaultLogin,
  defaultPassword,
  onRemove,
}: {
  idx: number;
  defaultLabel?: string;
  defaultLogin?: string;
  defaultPassword?: string;
  onRemove: () => void;
}) {
  const [showPw, setShowPw] = useState(false);
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          <KeyRound className="mr-1 inline h-3.5 w-3.5" />
          Senha #{idx + 1}
        </span>
        <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">
          Remover
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          type="text"
          name={`senha_label_${idx}`}
          defaultValue={defaultLabel}
          placeholder="Site / App"
          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        <input
          type="text"
          name={`senha_login_${idx}`}
          defaultValue={defaultLogin}
          placeholder="Login / E-mail"
          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        <div className="flex gap-1">
          <input
            type={showPw ? "text" : "password"}
            name={`senha_password_${idx}`}
            defaultValue={defaultPassword}
            placeholder="Senha"
            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

type PessoaFormProps = {
  pessoa?: Pessoa;
  onClose: () => void;
};

function PessoaForm({ pessoa, onClose }: PessoaFormProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const initialSenhas = parseSenhas(pessoa?.senhas ?? null);
  const [senhaCount, setSenhaCount] = useState(initialSenhas.length || 0);
  const [senhaList, setSenhaList] = useState<number[]>(
    Array.from({ length: initialSenhas.length || 0 }, (_, i) => i)
  );
  const [nextId, setNextId] = useState(initialSenhas.length || 0);

  const addSenha = () => {
    setSenhaList((prev) => [...prev, nextId]);
    setSenhaCount((c) => c + 1);
    setNextId((n) => n + 1);
  };
  const removeSenha = (id: number) => {
    setSenhaList((prev) => prev.filter((s) => s !== id));
    setSenhaCount((c) => c - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {pessoa ? "Editar Pessoa" : "Nova Pessoa"}
          </h3>
        </div>
        <Form method="post" className="space-y-4 p-6" onSubmit={onClose}>
          <input type="hidden" name="_intent" value={pessoa ? "edit_pessoa" : "create_pessoa"} />
          {pessoa && <input type="hidden" name="id" value={pessoa.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Nome Completo *
              </label>
              <input
                type="text"
                name="nomeCompleto"
                defaultValue={pessoa?.nomeCompleto}
                required
                placeholder="Nome completo"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">CPF</label>
              <input
                type="text"
                name="cpf"
                defaultValue={pessoa?.cpf ?? ""}
                placeholder="000.000.000-00"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">RG</label>
              <input
                type="text"
                name="rg"
                defaultValue={pessoa?.rg ?? ""}
                placeholder="RG"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Data de Nascimento
              </label>
              <input
                type="date"
                name="nascimento"
                defaultValue={pessoa?.nascimento ?? ""}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Celular</label>
              <input
                type="text"
                name="celular"
                defaultValue={pessoa?.celular ?? ""}
                placeholder="(11) 99999-9999"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">E-mail</label>
              <input
                type="email"
                name="email"
                defaultValue={pessoa?.email ?? ""}
                placeholder="email@exemplo.com"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Instagram</label>
              <input
                type="text"
                name="instagram"
                defaultValue={pessoa?.instagram ?? ""}
                placeholder="@usuario"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Endereço</label>
              <input
                type="text"
                name="endereco"
                defaultValue={pessoa?.endereco ?? ""}
                placeholder="Rua, número, bairro, cidade - UF"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Senhas */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                <KeyRound className="mr-1 inline h-3.5 w-3.5" /> Senhas / Acessos
              </label>
              <button
                type="button"
                onClick={addSenha}
                className="flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400"
              >
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {senhaList.map((id, visualIdx) => (
                <SenhaField
                  key={id}
                  idx={id}
                  defaultLabel={initialSenhas[visualIdx]?.label}
                  defaultLogin={initialSenhas[visualIdx]?.login}
                  defaultPassword={initialSenhas[visualIdx]?.password}
                  onRemove={() => removeSenha(id)}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Observações</label>
            <textarea
              name="notas"
              defaultValue={pessoa?.notas ?? ""}
              rows={2}
              placeholder="Anotações gerais..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : pessoa ? "Salvar alterações" : "Cadastrar pessoa"}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}

type PessoaCardProps = { pessoa: Pessoa };

function PessoaCard({ pessoa }: PessoaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [revealedPws, setRevealedPws] = useState<Set<number>>(new Set());
  const fetcher = useFetcher();
  const senhas = parseSenhas(pessoa.senhas);

  const togglePw = (i: number) =>
    setRevealedPws((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const handleDelete = () => {
    if (!confirm(`Remover "${pessoa.nomeCompleto}"?`)) return;
    fetcher.submit({ _intent: "delete_pessoa", id: pessoa.id }, { method: "post" });
  };

  return (
    <>
      {showEdit && <PessoaForm pessoa={pessoa} onClose={() => setShowEdit(false)} />}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        {/* Header do card */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              <User className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{pessoa.nomeCompleto}</p>
              <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                {pessoa.celular && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {pessoa.celular}
                  </span>
                )}
                {pessoa.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {pessoa.email}
                  </span>
                )}
                {pessoa.instagram && (
                  <span className="flex items-center gap-1">
                    <Instagram className="h-3 w-3" /> {pessoa.instagram}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800 dark:hover:text-red-400"
              title="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Conteúdo expandido */}
        {expanded && (
          <div className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-800">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {pessoa.cpf && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">CPF</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs text-gray-800 dark:text-gray-200">{pessoa.cpf}</span>
                    <CopyButton text={pessoa.cpf} />
                  </div>
                </div>
              )}
              {pessoa.rg && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">RG</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs text-gray-800 dark:text-gray-200">{pessoa.rg}</span>
                    <CopyButton text={pessoa.rg} />
                  </div>
                </div>
              )}
              {pessoa.nascimento && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Nascimento</span>
                  <span className="text-xs text-gray-800 dark:text-gray-200">
                    {formatDate(pessoa.nascimento)}
                  </span>
                </div>
              )}
              {pessoa.endereco && (
                <div className="sm:col-span-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Endereço</span>
                  <p className="mt-0.5 text-xs text-gray-800 dark:text-gray-200">{pessoa.endereco}</p>
                </div>
              )}
            </div>

            {senhas.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                  <KeyRound className="h-3.5 w-3.5" /> Senhas / Acessos
                </p>
                <div className="space-y-2">
                  {senhas.map((s, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-gray-800"
                    >
                      <span className="font-medium text-indigo-700 dark:text-indigo-400 min-w-[80px]">
                        {s.label || "—"}
                      </span>
                      <span className="text-gray-600 dark:text-gray-300 flex-1">{s.login}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-gray-800 dark:text-gray-200">
                          {revealedPws.has(i) ? s.password : "••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePw(i)}
                          className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {revealedPws.has(i) ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <CopyButton text={s.password} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pessoa.notas && (
              <div className="mt-3 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-gray-700 dark:bg-yellow-900/20 dark:text-gray-300">
                {pessoa.notas}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Page Component ─────────────────────────────────────────────────────────

export default function PromotionsPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { promotions: promo, kpis, statusFilter, pessoasList, pessoaSearch } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Tabs
  const [activeTab, setActiveTab] = useState<"promocoes" | "pessoas">("promocoes");

  // Promoções state
  const [showForm, setShowForm] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Pessoas state
  const [showPessoaForm, setShowPessoaForm] = useState(false);

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          🎁 Promoções e Sorteios
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Concursos, sorteios e promoções — com cadastro de pessoas para participação
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setActiveTab("promocoes")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "promocoes"
              ? "bg-white text-indigo-700 shadow-sm dark:bg-gray-800 dark:text-indigo-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <Gift className="h-4 w-4" />
          Promoções
          {kpis.active > 0 && (
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              {kpis.active}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pessoas")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "pessoas"
              ? "bg-white text-indigo-700 shadow-sm dark:bg-gray-800 dark:text-indigo-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <Users className="h-4 w-4" />
          Pessoas
          {pessoasList.length > 0 && (
            <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {pessoasList.length}
            </span>
          )}
        </button>
      </div>

      {/* ── ABA PROMOÇÕES ── */}
      {activeTab === "promocoes" && (
        <div className="space-y-6">
          {/* Botão nova promoção */}
          <div className="flex justify-end">
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

                {/* Upload de regulamento PDF */}
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
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Tipo</label>
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
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Prêmio</label>
                    <input
                      ref={prizeRef}
                      type="text"
                      name="prize"
                      placeholder="Ex: iPhone 16, R$ 1.000, Viagem"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Link</label>
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
                          <span>📅 {formatDate(p.startDate)} → {formatDate(p.endDate)}</span>
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
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{p.notes}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
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
      )}

      {/* ── ABA PESSOAS ── */}
      {activeTab === "pessoas" && (
        <div className="space-y-4">
          {showPessoaForm && <PessoaForm onClose={() => setShowPessoaForm(false)} />}

          {/* Header da aba */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form method="get" className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="q"
                  defaultValue={pessoaSearch}
                  placeholder="Buscar por nome, celular..."
                  className="w-64 rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <Button type="submit" variant="outline" size="sm">Buscar</Button>
              {pessoaSearch && (
                <a href="?" className="text-xs text-gray-500 hover:underline dark:text-gray-400">
                  Limpar
                </a>
              )}
            </form>
            <Button onClick={() => setShowPessoaForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Pessoa
            </Button>
          </div>

          {/* Lista de pessoas */}
          {pessoasList.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
              <Users className="mx-auto mb-3 h-10 w-10 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400">
                {pessoaSearch
                  ? `Nenhuma pessoa encontrada para "${pessoaSearch}".`
                  : "Nenhuma pessoa cadastrada ainda."}
              </p>
              {!pessoaSearch && (
                <Button className="mt-4" onClick={() => setShowPessoaForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar pessoa
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {pessoasList.map((p) => (
                <PessoaCard key={p.id} pessoa={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
