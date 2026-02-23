/**
 * GET/POST /personal-life/pessoas
 * Módulo de Contatos/Pessoas — cadastro de dados pessoais
 *
 * Armazena Nome, CPF, RG, Nascimento, Celular, E-mail, Instagram, Endereço, Senhas.
 */

import { data, redirect } from "react-router";
import type { Route } from "./+types/personal-life.pessoas";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { pessoas } from "../../drizzle/schema/personal-life";
import { eq, and, isNull, asc, ilike } from "drizzle-orm";
import { useState, useRef } from "react";
import {
  Plus,
  Users,
  Search,
  Edit,
  Trash2,
  X,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Copy,
  Check,
  Instagram,
  Phone,
  Mail,
  MapPin,
  Lock,
  Calendar,
  CreditCard,
  FileText,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Link, useSearchParams } from "react-router";

// ── Types ──────────────────────────────────────────────────────────────────

type Pessoa = {
  id: string;
  nomeCompleto: string;
  cpf: string | null;
  rg: string | null;
  nascimento: string | null;
  celular: string | null;
  email: string | null;
  instagram: string | null;
  endereco: string | null;
  senhas: string | null;
  notas: string | null;
};

type SenhaEntry = {
  label: string;
  login: string;
  password: string;
};

// ── Loader ─────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  const rows = await db
    .select()
    .from(pessoas)
    .where(
      and(
        eq(pessoas.userId, user.id),
        isNull(pessoas.deletedAt),
        ...(q ? [ilike(pessoas.nomeCompleto, `%${q}%`)] : [])
      )
    )
    .orderBy(asc(pessoas.nomeCompleto));

  return { rows, q };
}

// ── Action ─────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const fd = await request.formData();
  const intent = fd.get("intent") as string;

  if (intent === "create" || intent === "edit") {
    const id = fd.get("id") as string | null;

    // Montar JSON de senhas a partir dos campos dinâmicos
    const senhasRaw: SenhaEntry[] = [];
    let i = 0;
    while (fd.has(`senha_label_${i}`)) {
      const label = (fd.get(`senha_label_${i}`) as string).trim();
      const login = (fd.get(`senha_login_${i}`) as string).trim();
      const password = (fd.get(`senha_password_${i}`) as string).trim();
      if (label || login || password) {
        senhasRaw.push({ label, login, password });
      }
      i++;
    }

    const values = {
      userId: user.id,
      nomeCompleto: (fd.get("nomeCompleto") as string).trim(),
      cpf: (fd.get("cpf") as string).trim() || null,
      rg: (fd.get("rg") as string).trim() || null,
      nascimento: (fd.get("nascimento") as string).trim() || null,
      celular: (fd.get("celular") as string).trim() || null,
      email: (fd.get("email") as string).trim() || null,
      instagram: (fd.get("instagram") as string).trim() || null,
      endereco: (fd.get("endereco") as string).trim() || null,
      senhas: senhasRaw.length > 0 ? JSON.stringify(senhasRaw) : null,
      notas: (fd.get("notas") as string).trim() || null,
      updatedAt: new Date(),
    };

    if (intent === "create") {
      await db.insert(pessoas).values(values);
    } else {
      if (!id) return data({ error: "ID ausente" }, { status: 400 });
      await db
        .update(pessoas)
        .set(values)
        .where(and(eq(pessoas.id, id), eq(pessoas.userId, user.id)));
    }

    return redirect("/personal-life/pessoas");
  }

  if (intent === "delete") {
    const id = fd.get("id") as string;
    await db
      .update(pessoas)
      .set({ deletedAt: new Date() })
      .where(and(eq(pessoas.id, id), eq(pessoas.userId, user.id)));
    return redirect("/personal-life/pessoas");
  }

  return data({ error: "Intent inválido" }, { status: 400 });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseSenhas(raw: string | null): SenhaEntry[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SenhaEntry[];
  } catch {
    return [];
  }
}

function formatCPF(v: string) {
  return v.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatDate(s: string | null) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

// ── Sub-components ────────────────────────────────────────────────────────

function SenhaField({
  index,
  initial,
}: {
  index: number;
  initial?: SenhaEntry;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
      <input
        type="text"
        name={`senha_label_${index}`}
        defaultValue={initial?.label ?? ""}
        placeholder="Plataforma (ex: Gmail)"
        className="rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
      />
      <input
        type="text"
        name={`senha_login_${index}`}
        defaultValue={initial?.login ?? ""}
        placeholder="Login / E-mail"
        className="rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
      />
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          name={`senha_password_${index}`}
          defaultValue={initial?.password ?? ""}
          placeholder="Senha"
          className="w-full rounded border border-gray-300 px-2 py-1.5 pr-8 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function PessoaForm({
  initial,
  onClose,
}: {
  initial?: Pessoa;
  onClose: () => void;
}) {
  const senhasInit = parseSenhas(initial?.senhas ?? null);
  const [senhaCount, setSenhaCount] = useState(Math.max(senhasInit.length, 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {initial ? "Editar Pessoa" : "Nova Pessoa"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form method="post" className="space-y-5 p-6">
          <input type="hidden" name="intent" value={initial ? "edit" : "create"} />
          {initial && <input type="hidden" name="id" value={initial.id} />}

          {/* Nome */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nome Completo *
            </label>
            <input
              type="text"
              name="nomeCompleto"
              required
              defaultValue={initial?.nomeCompleto ?? ""}
              placeholder="Nome completo da pessoa"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {/* CPF + RG */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                CPF
              </label>
              <input
                type="text"
                name="cpf"
                defaultValue={initial?.cpf ?? ""}
                placeholder="000.000.000-00"
                maxLength={14}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                RG
              </label>
              <input
                type="text"
                name="rg"
                defaultValue={initial?.rg ?? ""}
                placeholder="00.000.000-0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Nascimento + Celular */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Data de Nascimento
              </label>
              <input
                type="date"
                name="nascimento"
                defaultValue={initial?.nascimento ?? ""}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Celular
              </label>
              <input
                type="tel"
                name="celular"
                defaultValue={initial?.celular ?? ""}
                placeholder="(31) 9 9999-9999"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {/* E-mail + Instagram */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                E-mail
              </label>
              <input
                type="email"
                name="email"
                defaultValue={initial?.email ?? ""}
                placeholder="email@exemplo.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Instagram
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
                <input
                  type="text"
                  name="instagram"
                  defaultValue={initial?.instagram?.replace(/^@/, "") ?? ""}
                  placeholder="usuario"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Endereço
            </label>
            <textarea
              name="endereco"
              rows={2}
              defaultValue={initial?.endereco ?? ""}
              placeholder="Rua, número, bairro, cidade, CEP"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {/* Senhas */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-gray-400" />
                Senhas e Logins
              </label>
              <button
                type="button"
                onClick={() => setSenhaCount((c) => c + 1)}
                className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
              >
                + Adicionar mais
              </button>
            </div>
            <div className="mb-1.5 grid grid-cols-3 gap-2 px-1 text-xs font-medium text-gray-400 dark:text-gray-500">
              <span>Plataforma</span>
              <span>Login</span>
              <span>Senha</span>
            </div>
            <div className="space-y-2">
              {Array.from({ length: senhaCount }, (_, i) => (
                <SenhaField key={i} index={i} initial={senhasInit[i]} />
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Observações
            </label>
            <textarea
              name="notas"
              rows={3}
              defaultValue={initial?.notas ?? ""}
              placeholder="Informações adicionais, relacionamento, contexto..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {initial ? "Salvar alterações" : "Criar cadastro"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function PessoaCard({
  p,
  onEdit,
  onDelete,
}: {
  p: Pessoa;
  onEdit: (p: Pessoa) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showSenhas, setShowSenhas] = useState(false);
  const senhas = parseSenhas(p.senhas);

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            <span className="text-sm font-bold">
              {p.nomeCompleto.trim().charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white">{p.nomeCompleto}</p>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
              {p.celular && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {p.celular}
                </span>
              )}
              {p.email && (
                <span className="flex items-center gap-1 truncate max-w-[200px]">
                  <Mail className="h-3 w-3" />
                  {p.email}
                </span>
              )}
              {p.instagram && (
                <span className="flex items-center gap-1">
                  <Instagram className="h-3 w-3" />@{p.instagram.replace(/^@/, "")}
                </span>
              )}
            </div>
          </div>
          <div className="ml-2 flex-shrink-0">
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </button>
        <div className="ml-3 flex gap-1">
          <button
            type="button"
            onClick={() => onEdit(p)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(p.id)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800 space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {p.cpf && (
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <CreditCard className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-500 mr-1">CPF:</span>
                <span className="font-mono">{p.cpf}</span>
                <CopyButton value={p.cpf} />
              </div>
            )}
            {p.rg && (
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-500 mr-1">RG:</span>
                <span className="font-mono">{p.rg}</span>
                <CopyButton value={p.rg} />
              </div>
            )}
            {p.nascimento && (
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <Calendar className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-500 mr-1">Nascimento:</span>
                <span>{formatDate(p.nascimento)}</span>
              </div>
            )}
            {p.celular && (
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-500 mr-1">Cel:</span>
                <span>{p.celular}</span>
                <CopyButton value={p.celular} />
              </div>
            )}
            {p.email && (
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 col-span-2">
                <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-500 mr-1">E-mail:</span>
                <span className="truncate">{p.email}</span>
                <CopyButton value={p.email} />
              </div>
            )}
            {p.instagram && (
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <Instagram className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-500 mr-1">IG:</span>
                <a
                  href={`https://instagram.com/${p.instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  @{p.instagram.replace(/^@/, "")}
                </a>
              </div>
            )}
            {p.endereco && (
              <div className="flex items-start gap-1.5 text-gray-700 dark:text-gray-300 col-span-2">
                <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-gray-500 mr-1">End.:</span>
                <span className="whitespace-pre-wrap">{p.endereco}</span>
              </div>
            )}
          </div>

          {/* Senhas */}
          {senhas.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowSenhas((s) => !s)}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
              >
                <Lock className="h-3.5 w-3.5" />
                {showSenhas ? "Ocultar" : "Mostrar"} senhas ({senhas.length})
              </button>
              {showSenhas && (
                <div className="mt-2 space-y-1.5">
                  {senhas.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800"
                    >
                      <span className="w-28 flex-shrink-0 text-xs font-medium text-gray-600 dark:text-gray-400 truncate">
                        {s.label || `Conta ${i + 1}`}
                      </span>
                      <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{s.login}</span>
                      <span className="font-mono text-gray-700 dark:text-gray-300 flex items-center gap-1">
                        {s.password}
                        <CopyButton value={s.password} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {p.notas && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-1">Observações</p>
              <p className="whitespace-pre-wrap">{p.notas}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function PessoasPage({
  loaderData,
}: {
  loaderData: { rows: Pessoa[]; q: string };
}) {
  const { rows, q } = loaderData;
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Pessoa | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState(q);
  const formRef = useRef<HTMLFormElement>(null);

  function handleEdit(p: Pessoa) {
    setEditTarget(p);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditTarget(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/personal-life">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-7 w-7 text-indigo-500" />
            Pessoas
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Cadastro de contatos com dados pessoais, documentos e senhas
          </p>
        </div>
        <Button onClick={() => { setEditTarget(null); setShowForm(true); }}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova Pessoa
        </Button>
      </div>

      {/* Search */}
      <form method="get" className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Buscar
        </Button>
      </form>

      {/* Count */}
      {rows.length > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {rows.length} pessoa{rows.length !== 1 ? "s" : ""} cadastrada{rows.length !== 1 ? "s" : ""}
          {q && ` para "${q}"`}
        </p>
      )}

      {/* List */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16 dark:border-gray-700">
          <Users className="h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {q ? `Nenhuma pessoa encontrada para "${q}"` : "Nenhuma pessoa cadastrada ainda"}
          </p>
          {!q && (
            <Button
              className="mt-4"
              onClick={() => { setEditTarget(null); setShowForm(true); }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Cadastrar primeira pessoa
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <PessoaCard
              key={p.id}
              p={p}
              onEdit={handleEdit}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <PessoaForm initial={editTarget ?? undefined} onClose={closeForm} />
      )}

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Excluir pessoa?
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Este cadastro será removido permanentemente. Ação irreversível.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancelar
              </Button>
              <form method="post">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={deleteId} />
                <Button
                  type="submit"
                  variant="destructive"
                  onClick={() => setDeleteId(null)}
                >
                  Excluir
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
