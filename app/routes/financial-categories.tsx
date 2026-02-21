import { Form, useLoaderData, useNavigation, data } from "react-router";
import type { Route } from "./+types/financial-categories";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { financialCategories } from "drizzle/schema";
import { eq } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { Search, Plus, Trash2 } from "lucide-react";
import { financialCategorySchema } from "~/lib/validators";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
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

  return {
    query,
    incomeCategories: filtered.filter((category) => category.type === "income"),
    expenseCategories: filtered.filter((category) => category.type === "expense"),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "create");

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

function CategoryBlock({
  title,
  categories,
}: {
  title: string;
  categories: Array<{ id: string; name: string; parentId: string | null }>;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="space-y-2">
        {categories.map((category) => (
          <div key={category.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 dark:border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{category.name}</p>
              {category.parentId && <p className="text-xs text-gray-500 dark:text-gray-400">Subcategoria</p>}
            </div>
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="categoryId" value={category.id} />
              <button type="submit" className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                <Trash2 className="h-4 w-4" />
              </button>
            </Form>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma categoria cadastrada</p>
        )}
      </div>
    </div>
  );
}

export default function FinancialCategoriesPage() {
  const { query, incomeCategories, expenseCategories } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gerenciar categorias e subcategorias</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Organize receitas e despesas para o fluxo de caixa.</p>
      </div>

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

      <Form method="post" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <input type="hidden" name="intent" value="create" />
        <div className="grid gap-3 sm:grid-cols-4">
          <select name="type" required className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800">
            <option value="income">Receita</option>
            <option value="expense">Despesa</option>
          </select>
          <input name="name" required placeholder="Nova categoria" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <input name="parentId" placeholder="ID da categoria pai (opcional)" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <Button type="submit" disabled={isSubmitting}>
            <Plus className="h-4 w-4" />
            Nova categoria
          </Button>
        </div>
      </Form>

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBlock title="Categorias de Receitas" categories={incomeCategories} />
        <CategoryBlock title="Categorias de Despesas" categories={expenseCategories} />
      </div>
    </div>
  );
}
