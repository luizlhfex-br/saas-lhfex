/**
 * GET/POST /personal-life/investments
 * Módulo de Investimentos Pessoais
 *
 * Portfolio de ações, ETFs, FIIs, cripto, renda fixa e imóveis.
 * Controle de preço de compra vs preço atual, ganho/perda e corretora.
 */

import { data } from "react-router";
import type { Route } from "./+types/personal-life.investments";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { personalInvestments } from "../../drizzle/schema/personal-life";
import { eq, and, isNull, desc } from "drizzle-orm";
import { useState } from "react";
import { useNavigation, Form, Link, useFetcher } from "react-router";
import {
  ArrowLeft,
  Plus,
  X,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { Button } from "~/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────

type Investment = typeof personalInvestments.$inferSelect;

type Totals = {
  totalInvested: number;
  totalCurrentValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  count: number;
};

type ByType = Record<string, Investment[]>;

// ── Config ──────────────────────────────────────────────────────────────────

const ASSET_TYPE_CONFIG: Record<
  string,
  { label: string; badgeClass: string; tab: string }
> = {
  stock: {
    label: "📈 Ação",
    badgeClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    tab: "acoes",
  },
  etf: {
    label: "📊 ETF",
    badgeClass:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    tab: "etf_fii",
  },
  fii: {
    label: "🏢 FII",
    badgeClass:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    tab: "etf_fii",
  },
  crypto: {
    label: "₿ Cripto",
    badgeClass:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    tab: "cripto",
  },
  savings: {
    label: "🏦 Poupança/CDB",
    badgeClass:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    tab: "renda_fixa",
  },
  bonds: {
    label: "📜 Tesouro",
    badgeClass:
      "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    tab: "renda_fixa",
  },
  real_estate: {
    label: "🏠 Imóvel",
    badgeClass:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    tab: "outros",
  },
  earns_interest: {
    label: "💰 Renda Fixa",
    badgeClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    tab: "renda_fixa",
  },
};

const TABS = [
  { key: "all", label: "Todos" },
  { key: "acoes", label: "Ações" },
  { key: "etf_fii", label: "ETF/FII" },
  { key: "cripto", label: "Cripto" },
  { key: "renda_fixa", label: "Renda Fixa" },
  { key: "outros", label: "Outros" },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function calcDerived(
  quantity: number,
  purchasePrice: number,
  currentPrice: number
): { currentValue: number; gainLoss: number; gainLossPercent: number } {
  const cost = quantity * purchasePrice;
  const currentValue = quantity * currentPrice;
  const gainLoss = currentValue - cost;
  const gainLossPercent = cost > 0 ? (gainLoss / cost) * 100 : 0;
  return { currentValue, gainLoss, gainLossPercent };
}

// ── Loader ─────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const investments = await db
    .select()
    .from(personalInvestments)
    .where(
      and(
        eq(personalInvestments.userId, user.id),
        isNull(personalInvestments.deletedAt)
      )
    )
    .orderBy(desc(personalInvestments.createdAt));

  // Calculate totals server-side
  let totalInvested = 0;
  let totalCurrentValue = 0;

  for (const inv of investments) {
    const qty = parseFloat(inv.quantity);
    const purchaseP = parseFloat(inv.purchasePrice);
    const cost = qty * purchaseP;
    totalInvested += cost;

    if (inv.currentValue) {
      totalCurrentValue += parseFloat(inv.currentValue);
    } else {
      // Fallback: use purchase price if no current price set
      totalCurrentValue += cost;
    }
  }

  const totalGainLoss = totalCurrentValue - totalInvested;
  const totalGainLossPercent =
    totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

  const totals: Totals = {
    totalInvested,
    totalCurrentValue,
    totalGainLoss,
    totalGainLossPercent,
    count: investments.length,
  };

  // Group by assetType
  const byType: ByType = {};
  for (const inv of investments) {
    if (!byType[inv.assetType]) byType[inv.assetType] = [];
    byType[inv.assetType]!.push(inv);
  }

  return { investments, totals, byType, user };
}

// ── Action ─────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "create") {
    const assetType = formData.get("assetType") as string;
    const assetName = formData.get("assetName") as string;
    const ticker = (formData.get("ticker") as string) || null;
    const quantity = formData.get("quantity") as string;
    const purchasePrice = formData.get("purchasePrice") as string;
    const purchaseDate = formData.get("purchaseDate") as string;
    const currentPriceRaw = formData.get("currentPrice") as string;
    const broker = (formData.get("broker") as string) || null;
    const notes = (formData.get("notes") as string) || null;

    if (!assetType || !assetName || !quantity || !purchasePrice || !purchaseDate) {
      return data({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const qty = parseFloat(quantity);
    const purchP = parseFloat(purchasePrice);
    const currentP = currentPriceRaw ? parseFloat(currentPriceRaw) : purchP;

    const { currentValue, gainLoss, gainLossPercent } = calcDerived(
      qty,
      purchP,
      currentP
    );

    await db.insert(personalInvestments).values({
      userId: user.id,
      assetType,
      assetName,
      ticker,
      quantity,
      purchasePrice,
      purchaseDate,
      currentPrice: String(currentP),
      currentValue: String(currentValue),
      gainLoss: String(gainLoss),
      gainLossPercent: String(gainLossPercent),
      broker,
      notes,
    });

    return data({ success: true });
  }

  if (intent === "edit") {
    const id = formData.get("id") as string;
    const assetType = formData.get("assetType") as string;
    const assetName = formData.get("assetName") as string;
    const ticker = (formData.get("ticker") as string) || null;
    const quantity = formData.get("quantity") as string;
    const purchasePrice = formData.get("purchasePrice") as string;
    const purchaseDate = formData.get("purchaseDate") as string;
    const currentPriceRaw = formData.get("currentPrice") as string;
    const broker = (formData.get("broker") as string) || null;
    const notes = (formData.get("notes") as string) || null;

    const qty = parseFloat(quantity);
    const purchP = parseFloat(purchasePrice);
    const currentP = currentPriceRaw ? parseFloat(currentPriceRaw) : purchP;

    const { currentValue, gainLoss, gainLossPercent } = calcDerived(
      qty,
      purchP,
      currentP
    );

    await db
      .update(personalInvestments)
      .set({
        assetType,
        assetName,
        ticker,
        quantity,
        purchasePrice,
        purchaseDate,
        currentPrice: String(currentP),
        currentValue: String(currentValue),
        gainLoss: String(gainLoss),
        gainLossPercent: String(gainLossPercent),
        broker,
        notes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(personalInvestments.id, id),
          eq(personalInvestments.userId, user.id)
        )
      );

    return data({ success: true });
  }

  if (intent === "update_price") {
    const id = formData.get("id") as string;
    const newPriceRaw = formData.get("currentPrice") as string;
    const quantityRaw = formData.get("quantity") as string;
    const purchasePriceRaw = formData.get("purchasePrice") as string;

    const newPrice = parseFloat(newPriceRaw);
    const qty = parseFloat(quantityRaw);
    const purchP = parseFloat(purchasePriceRaw);

    const { currentValue, gainLoss, gainLossPercent } = calcDerived(
      qty,
      purchP,
      newPrice
    );

    await db
      .update(personalInvestments)
      .set({
        currentPrice: String(newPrice),
        currentValue: String(currentValue),
        gainLoss: String(gainLoss),
        gainLossPercent: String(gainLossPercent),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(personalInvestments.id, id),
          eq(personalInvestments.userId, user.id)
        )
      );

    return data({ success: true });
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await db
      .update(personalInvestments)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(personalInvestments.id, id),
          eq(personalInvestments.userId, user.id)
        )
      );

    return data({ success: true });
  }

  return data({ error: "Ação inválida" }, { status: 400 });
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  colorClass,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  colorClass: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${colorClass}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
          {label}
        </p>
        <div className="opacity-70">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold leading-tight">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-70">{sub}</p>}
    </div>
  );
}

function InlinePriceUpdater({ inv }: { inv: Investment }) {
  const fetcher = useFetcher();
  const [priceInput, setPriceInput] = useState(
    inv.currentPrice ? parseFloat(inv.currentPrice).toFixed(2) : ""
  );
  const isUpdating = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post" className="flex items-center gap-1.5">
      <input type="hidden" name="_intent" value="update_price" />
      <input type="hidden" name="id" value={inv.id} />
      <input type="hidden" name="quantity" value={inv.quantity} />
      <input type="hidden" name="purchasePrice" value={inv.purchasePrice} />
      <input
        type="number"
        name="currentPrice"
        step="0.01"
        min="0"
        value={priceInput}
        onChange={(e) => setPriceInput(e.target.value)}
        className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        placeholder="0.00"
      />
      <button
        type="submit"
        disabled={isUpdating}
        className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        title="Atualizar preço"
      >
        <RefreshCw className={`h-3 w-3 ${isUpdating ? "animate-spin" : ""}`} />
        {isUpdating ? "" : "Atualizar"}
      </button>
    </fetcher.Form>
  );
}

function InvestmentCard({
  inv,
  onEdit,
  onDelete,
}: {
  inv: Investment;
  onEdit: (inv: Investment) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = ASSET_TYPE_CONFIG[inv.assetType] ?? ASSET_TYPE_CONFIG["stock"]!;
  const qty = parseFloat(inv.quantity);
  const purchP = parseFloat(inv.purchasePrice);
  const cost = qty * purchP;

  const gainLoss = inv.gainLoss ? parseFloat(inv.gainLoss) : 0;
  const gainLossPercent = inv.gainLossPercent ? parseFloat(inv.gainLossPercent) : 0;
  const currentVal = inv.currentValue ? parseFloat(inv.currentValue) : cost;

  const isPositive = gainLoss >= 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-gray-900 dark:text-white">
              {inv.assetName}
            </span>
            {inv.ticker && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {inv.ticker}
              </span>
            )}
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badgeClass}`}
            >
              {cfg.label}
            </span>
          </div>

          {inv.broker && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {inv.broker}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(inv)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
            title="Editar"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(inv.id)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Qtd</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(4)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Compra</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(purchP)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Valor atual</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(currentVal)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Ganho/Perda</p>
          <div className="flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            )}
            <span
              className={`font-semibold ${
                isPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(gainLoss)}{" "}
              <span className="text-xs font-normal">
                ({gainLossPercent >= 0 ? "+" : ""}
                {gainLossPercent.toFixed(2)}%)
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Inline price updater */}
      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
          Preço atual:
        </span>
        <InlinePriceUpdater inv={inv} />
      </div>

      {/* Purchase date */}
      <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
        Comprado em {formatDate(inv.purchaseDate)} · Custo total{" "}
        {formatCurrency(cost)}
      </p>
    </div>
  );
}

function InvestmentModal({
  inv,
  onClose,
  isSubmitting,
}: {
  inv: Investment | null;
  onClose: () => void;
  isSubmitting: boolean;
}) {
  const isEdit = !!inv;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? "Editar Ativo" : "Novo Ativo"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <Form method="post" className="space-y-5 p-6">
          <input
            type="hidden"
            name="_intent"
            value={isEdit ? "edit" : "create"}
          />
          {isEdit && <input type="hidden" name="id" value={inv.id} />}

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo de ativo <span className="text-red-500">*</span>
            </label>
            <select
              name="assetType"
              defaultValue={inv?.assetType ?? "stock"}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="stock">📈 Ação</option>
              <option value="etf">📊 ETF</option>
              <option value="fii">🏢 FII</option>
              <option value="crypto">₿ Cripto</option>
              <option value="savings">🏦 Poupança/CDB</option>
              <option value="bonds">📜 Tesouro Direto</option>
              <option value="real_estate">🏠 Imóvel</option>
              <option value="earns_interest">💰 Renda Fixa</option>
            </select>
          </div>

          {/* Nome + Ticker */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome do ativo <span className="text-red-500">*</span>
              </label>
              <input
                name="assetName"
                type="text"
                required
                defaultValue={inv?.assetName ?? ""}
                placeholder="Ex: Petrobras, Bitcoin, Poupança Nubank"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ticker
              </label>
              <input
                name="ticker"
                type="text"
                defaultValue={inv?.ticker ?? ""}
                placeholder="PETR4"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 uppercase"
              />
            </div>
          </div>

          {/* Quantidade + Preço de compra */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Quantidade <span className="text-red-500">*</span>
              </label>
              <input
                name="quantity"
                type="number"
                step="0.00000001"
                min="0"
                required
                defaultValue={
                  inv?.quantity ? parseFloat(inv.quantity) : ""
                }
                placeholder="1"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Preço de compra (R$) <span className="text-red-500">*</span>
              </label>
              <input
                name="purchasePrice"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={
                  inv?.purchasePrice ? parseFloat(inv.purchasePrice).toFixed(2) : ""
                }
                placeholder="0,00"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
            </div>
          </div>

          {/* Preço atual + Data de compra */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Preço atual (R$)
              </label>
              <input
                name="currentPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={
                  inv?.currentPrice ? parseFloat(inv.currentPrice).toFixed(2) : ""
                }
                placeholder="Igual ao de compra se vazio"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data de compra
              </label>
              <input
                name="purchaseDate"
                type="date"
                required
                defaultValue={inv?.purchaseDate ?? ""}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          {/* Corretora */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Corretora
            </label>
            <input
              name="broker"
              type="text"
              defaultValue={inv?.broker ?? ""}
              placeholder="Ex: XP, Rico, Binance, Nubank"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notas
            </label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={inv?.notes ?? ""}
              placeholder="Observações sobre este ativo..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting
                ? "Salvando..."
                : isEdit
                ? "Salvar alterações"
                : "Adicionar ativo"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function PersonalLifeInvestmentsPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { investments, totals } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [activeTab, setActiveTab] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingInv, setEditingInv] = useState<Investment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleOpenCreate() {
    setEditingInv(null);
    setShowModal(true);
  }

  function handleOpenEdit(inv: Investment) {
    setEditingInv(inv);
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingInv(null);
  }

  // Filter investments by tab
  const filteredInvestments = investments.filter((inv) => {
    if (activeTab === "all") return true;
    const cfg = ASSET_TYPE_CONFIG[inv.assetType];
    return cfg?.tab === activeTab;
  });

  const isPositiveTotal = totals.totalGainLoss >= 0;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/personal-life">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              📈 Investimentos
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Portfolio de ativos e rendimentos
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Ativo
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Investido"
          value={formatCurrency(totals.totalInvested)}
          colorClass="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-100"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KPICard
          label="Valor Atual"
          value={formatCurrency(totals.totalCurrentValue)}
          colorClass="border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-100"
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <KPICard
          label="Ganho / Perda"
          value={formatCurrency(totals.totalGainLoss)}
          sub={`${totals.totalGainLoss >= 0 ? "+" : ""}${totals.totalGainLossPercent.toFixed(2)}% no total`}
          colorClass={
            isPositiveTotal
              ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-100"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-100"
          }
          icon={
            isPositiveTotal ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )
          }
        />
        <KPICard
          label="N° de Ativos"
          value={String(totals.count)}
          sub={`em ${Object.keys(loaderData.byType).length} categorias`}
          colorClass="border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-100"
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-800 pb-0">
        {TABS.map((tab) => {
          const count =
            tab.key === "all"
              ? investments.length
              : investments.filter(
                  (inv) => ASSET_TYPE_CONFIG[inv.assetType]?.tab === tab.key
                ).length;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === tab.key
                  ? "bg-white border border-b-white border-gray-200 text-indigo-600 dark:bg-gray-900 dark:border-gray-700 dark:border-b-gray-900 dark:text-indigo-400 -mb-px"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-bold ${
                    activeTab === tab.key
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Investment list */}
      {filteredInvestments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 py-14 text-center dark:border-indigo-900/40 dark:bg-indigo-900/10">
          <BarChart3 className="mb-3 h-10 w-10 text-indigo-300 dark:text-indigo-600" />
          <p className="font-medium text-indigo-700 dark:text-indigo-300">
            Nenhum ativo nesta categoria
          </p>
          <p className="mt-1 text-sm text-indigo-500 dark:text-indigo-400">
            Adicione seu primeiro investimento!
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Adicionar ativo
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredInvestments.map((inv) => (
            <InvestmentCard
              key={inv.id}
              inv={inv}
              onEdit={handleOpenEdit}
              onDelete={(id) => setDeletingId(id)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <InvestmentModal
          inv={editingInv}
          onClose={handleCloseModal}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Delete confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeletingId(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Confirmar exclusão
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Tem certeza que deseja excluir este ativo? Ele será marcado como
              deletado e não aparecerá mais no seu portfolio.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <Form method="post" onSubmit={() => setDeletingId(null)}>
                <input type="hidden" name="_intent" value="delete" />
                <input type="hidden" name="id" value={deletingId} />
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                >
                  Excluir
                </button>
              </Form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
