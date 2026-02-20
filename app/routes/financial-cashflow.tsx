import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/financial-cashflow";
import { requireAuth } from "~/lib/auth.server";
import { getUserLocale } from "~/lib/i18n.server";
import { t } from "~/i18n";
import { ChevronLeft, ChevronRight, Plus, Upload, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Button } from "~/components/ui/button";

export async function loader({ request }: Route.LoaderArgs) {
  const { getCashFlowForMonth } = await import("~/lib/cashflow.server");
  const { user } = await requireAuth(request);
  const locale = await getUserLocale(request, user);

  const url = new URL(request.url);
  const now = new Date();
  const year = parseInt(url.searchParams.get("year") || String(now.getFullYear()));
  const month = parseInt(url.searchParams.get("month") || String(now.getMonth() + 1));

  const cashflow = await getCashFlowForMonth(year, month);

  return {
    cashflow,
    year,
    month,
    locale,
  };
}

export default function FinancialCashflowPage({ loaderData }: Route.ComponentProps) {
  const { cashflow, year, month, locale } = loaderData;
  const i18n = t(locale);

  // Format currency helper (client-side)
  const formatBRL = (value: number) => 
    value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {i18n.financial.cashflowTitle || "Controle de Caixa"}
        </h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/financial/cashflow/import">
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Link>
          </Button>
          <Button asChild>
            <Link to="/financial/cashflow/new">
              <Plus className="h-4 w-4 mr-2" />
              Novo Lançamento
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex gap-6">
          <Link
            to="/financial"
            className="border-b-2 border-transparent px-1 py-4 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Faturas
          </Link>
          <Link
            to="/financial/report"
            className="border-b-2 border-transparent px-1 py-4 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Relatório Financeiro
          </Link>
          <span className="border-b-2 border-blue-600 px-1 py-4 text-sm font-medium text-blue-600 dark:border-blue-500 dark:text-blue-500">
            Controle de Caixa
          </span>
        </nav>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/financial/cashflow?year=${prevYear}&month=${prevMonth}`}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h2 className="text-lg font-semibold capitalize">{monthName}</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/financial/cashflow?year=${nextYear}&month=${nextMonth}`}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/20">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Receitas</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                R$ {formatBRL(cashflow.totalIncome)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/20">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Despesas</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                R$ {formatBRL(cashflow.totalExpense)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-3 ${cashflow.balance >= 0 ? "bg-blue-100 dark:bg-blue-900/20" : "bg-orange-100 dark:bg-orange-900/20"}`}>
              <DollarSign className={`h-5 w-5 ${cashflow.balance >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Saldo</p>
              <p className={`text-2xl font-bold ${cashflow.balance >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}>
                R$ {formatBRL(Math.abs(cashflow.balance))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Summary */}
      {cashflow.byCategory.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-lg font-semibold">Resumo por Categoria</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="pb-3 font-medium text-gray-600 dark:text-gray-400">Categoria</th>
                  <th className="pb-3 text-right font-medium text-gray-600 dark:text-gray-400">Receitas</th>
                  <th className="pb-3 text-right font-medium text-gray-600 dark:text-gray-400">Despesas</th>
                  <th className="pb-3 text-right font-medium text-gray-600 dark:text-gray-400">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {cashflow.byCategory.map((cat) => (
                  <tr key={cat.category} className="border-b border-gray-100 dark:border-gray-800/50">
                    <td className="py-3 font-medium">{cat.category}</td>
                    <td className="py-3 text-right text-green-600 dark:text-green-400">
                      {cat.income > 0 ? `R$ ${formatBRL(cat.income)}` : "-"}
                    </td>
                    <td className="py-3 text-right text-red-600 dark:text-red-400">
                      {cat.expense > 0 ? `R$ ${formatBRL(cat.expense)}` : "-"}
                    </td>
                    <td className={`py-3 text-right font-semibold ${cat.net >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}>
                      R$ {formatBRL(Math.abs(cat.net))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Movements Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-6 dark:border-gray-800">
          <h3 className="text-lg font-semibold">Lançamentos do Mês ({cashflow.movements.length})</h3>
        </div>
        {cashflow.movements.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">Nenhum lançamento neste mês</p>
            <Button asChild className="mt-4">
              <Link to="/financial/cashflow/new">Criar primeiro lançamento</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Data</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Tipo</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Categoria</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Descrição</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Pagamento</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Centro Custo</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Valor</th>
                </tr>
              </thead>
              <tbody>
                {cashflow.movements.map((mov) => (
                  <tr key={mov.id} className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/30">
                    <td className="px-6 py-4 text-gray-900 dark:text-gray-100">
                      {new Date(mov.date).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${mov.type === "income" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                        {mov.type === "income" ? "Receita" : "Despesa"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{mov.category}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{mov.description || "-"}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{mov.paymentMethod || "-"}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{mov.costCenter || "-"}</td>
                    <td className={`px-6 py-4 text-right font-semibold ${mov.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      R$ {formatBRL(mov.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
