import { Form, useLoaderData, useNavigation, data } from "react-router";
import type { Route } from "./+types/financial-categories";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { financialCategories } from "drizzle/schema";
import { eq } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { Search, Plus, Trash2, ChevronRight } from "lucide-react";
import { financialCategorySchema } from "~/lib/validators";

// Default categories to seed when user has none
const DEFAULT_CATEGORIES = [
  // Receitas
  { type: "income" as const, name: "Investimento", parentId: null },
  { type: "income" as const, name: "Aporte Pessoal", parentId: null },
  { type: "income" as const, name: "Venda à Vista", parentId: null },
  { type: "income" as const, name: "Venda a Prazo", parentId: null },
  { type: "income" as const, name: "Consultoria", parentId: null },
  { type: "income" as const, name: "Transporte", parentId: null },
  // Despesas
  { type: "expense" as const, name: "Fornecedor", parentId: null },
  { type: "expense" as const, name: "Empréstimo / Financiamento", parentId: null },
  { type: "expense" as const, name: "Retirada", parentId: null },
  { type: "expense" as const, name: "Pró-labore", parentId: null },
  { type: "expense" as const, name: "Salários", parentId: null },
  { type: "expense" as const, name: "Impostos", parentId: null },
  { type: "expense" as const, name: "Aluguel", parentId: null },
  { type: "expense" as const, name: "Marketing", parentId: null },
  { type: "expense" as const, name: "Serviços / Assinaturas", parentId: null },
  { type: "expense" as const, name: "Despesas Bancárias", parentId: null },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").toLowerCase();

  const categories = await db
    .select()
    .from(financialCategories)
    .where(eq(financialCategories.createdBy, user.id));

  const filtered = query
    ? categories.filter((category) => category.name.toLowerCase().includes(query))
    : categories;

  // Separate parents from subcategories
  const parents = filtered.filter((c) => !c.parentId);
  const allParents = categories.filter((c) => !c.parentId); // for dropdown (unfiltered)

  return {
    query,
    hasCategories: categories.length > 0,
    incomeCategories: parents.filter((c) => c.type === "income"),
    expenseCategories: parents.filter((c) => c.type === "expense"),
    incomeSubcategories: filtered.filter((c) => c.type === "income" && !!c.parentId),
    expenseSubcategories: filtered.filter((c) => c.type === "expense" && !!c.parentId),
    allParents,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "create");

  if (intent === "seed") {
    // Seed default categories for the user
    await db.insert(financialCategories).values(
      DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        createdBy: user.id,
      }))
    );
    return data({ success: true, seeded: true });
  }

  if (intent === "create") {
    const parsed = financialCategorySchema.safeParse({
      type: String(formData.get("type") || ""),
      name: String(formData.get("name") || ""),
      parentId: String(formData.get("parentId") || ""),
    });

    if (!parsed.success) {
      return data({ error: "Dados inválidos" }, { status: 400 });
    }

    await db.insert(financialCategories).values({
      type: parsed.data.type,
      name: parsed.data.name,
      parentId: parsed.data.parentId || null,
      createdBy: user.id,
    });

    return data({ success: true });
  }

  if (intent === "delete") {
    const categoryId = String(formData.get("categoryId") || "");
    await db
      .delete(financialCategories)
      .where(eq(financialCategories.id, categoryId));
    return data({ success: true });
  }

  return data({ error: "Ação inválida" }, { status: 400 });
}

function CategoryRow({ category, isSubcategory = false }: { category: { id: string; name: string; parentId: string | null }; isSubcategory?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 dark:border-gray-800 ${isSubcategory ? "ml-6 border-l-2 border-l-gray-200 dark:border-l-gray-700" : ""}`}>
      <div className="flex items-center gap-2">
        {isSubcategory && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{category.name}</p>
          {isSubcategory && <p className="text-xs text-gray-500 dark:text-gray-400">Subcategoria</p>}
        </div>
      </div>
      <Form method="post">
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="categoryId" value={category.id} />
        <button type="submit" className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
          <Trash2 className="h-4 w-4" />
        </button>
      </Form>
    </div>
  );
}

export default function FinancialCategoriesPage() {
  const { query, hasCategories, incomeCategories, expenseCategories, incomeSubcategories, expenseSubcategories, allParents } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const incomeParents = allParents.filter((c) => c.type === "income");
  const expenseParents = allParents.filter((c) => c.type === "expense");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Categorias Financeiras</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Organize receitas e despesas para o controle de caixa.</p>
      </div>

      {/* Seed banner — show only when no categories */}
      {!hasCategories && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">Nenhuma categoria cadastrada ainda</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">Crie categorias manualmente ou use as sugeridas abaixo (Receitas: Consultoria, Venda, etc; Despesas: Fornecedor, Pró-labore, etc)</p>
            </div>
            <Form method="post">
              <input type="hidden" name="intent" value="seed" />
              <Button type="submit" disabled={isSubmitting}>
                ✨ Criar categorias sugeridas
              </Button>
            </Form>
          </div>
        </div>
      )}

      {/* Search */}
      <Form method="get" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Pesquisar categoria..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </Form>

      {/* Add new category form */}
      <Form method="post" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <input type="hidden" name="intent" value="create" />
        <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Adicionar categoria</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <select name="type" required className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <option value="income">Receita</option>
            <option value="expense">Despesa</option>
          </select>
          <input name="name" required placeholder="Nome da categoria" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
          {/* Parent category dropdown (much better than UUID raw input) */}
          <select name="parentId" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <option value="">Categoria principal</option>
            <optgroup label="Receitas">
              {incomeParents.map((c) => (
                <option key={c.id} value={c.id}>{c.name} (subcategoria)</option>
              ))}
            </optgroup>
            <optgroup label="Despesas">
              {expenseParents.map((c) => (
                <option key={c.id} value={c.id}>{c.name} (subcategoria)</option>
              ))}
            </optgroup>
          </select>
          <Button type="submit" disabled={isSubmitting}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </Form>

      {/* Categories grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Income */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">💰 Receitas</h2>
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {incomeCategories.length} categorias
            </span>
          </div>
          <div className="space-y-2">
            {incomeCategories.map((category) => (
              <div key={category.id}>
                <CategoryRow category={category} />
                {/* Subcategories under this parent */}
                {incomeSubcategories
                  .filter((s) => s.parentId === category.id)
                  .map((sub) => (
                    <CategoryRow key={sub.id} category={sub} isSubcategory />
                  ))}
              </div>
            ))}
            {incomeCategories.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma categoria de receita</p>
            )}
          </div>
        </div>

        {/* Expense */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">💸 Despesas</h2>
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {expenseCategories.length} categorias
            </span>
          </div>
          <div className="space-y-2">
            {expenseCategories.map((category) => (
              <div key={category.id}>
                <CategoryRow category={category} />
                {/* Subcategories under this parent */}
                {expenseSubcategories
                  .filter((s) => s.parentId === category.id)
                  .map((sub) => (
                    <CategoryRow key={sub.id} category={sub} isSubcategory />
                  ))}
              </div>
            ))}
            {expenseCategories.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma categoria de despesa</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
