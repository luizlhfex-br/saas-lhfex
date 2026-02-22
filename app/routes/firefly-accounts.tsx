import { Form, Link, redirect, useLoaderData, useNavigation } from "react-router";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { companyProfile, fireflyAccounts } from "../../drizzle/schema";

const accountTypeLabel: Record<string, string> = {
  asset: "Ativo",
  liability: "Passivo",
  equity: "Patrimônio",
  revenue: "Receita",
  expense: "Despesa",
};

export async function loader({ request }: { request: Request }) {
  await requireAuth(request);
  const [company] = await db.select().from(companyProfile).limit(1);

  if (!company) return { company: null, accounts: [] };

  const accounts = await db
    .select()
    .from(fireflyAccounts)
    .where(eq(fireflyAccounts.companyId, company.id))
    .orderBy(desc(fireflyAccounts.createdAt));

  return { company, accounts };
}

export async function action({ request }: { request: Request }) {
  await requireAuth(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const [company] = await db.select().from(companyProfile).limit(1);

  if (!company) return redirect("/settings");

  if (intent === "create") {
    const name = String(formData.get("name") || "").trim();
    if (name) {
      await db.insert(fireflyAccounts).values({
        companyId: company.id,
        name,
        accountType: String(formData.get("accountType") || "asset"),
        accountNumber: String(formData.get("accountNumber") || "").trim() || null,
        currentBalance: String(formData.get("currentBalance") || "0").trim() || "0",
        notes: String(formData.get("notes") || "").trim() || null,
        updatedAt: new Date(),
      });
    }
  }

  if (intent === "toggle") {
    const accountId = String(formData.get("accountId") || "");
    const isActive = String(formData.get("isActive") || "false") === "true";
    if (accountId) {
      await db
        .update(fireflyAccounts)
        .set({ isActive: !isActive, updatedAt: new Date() })
        .where(and(eq(fireflyAccounts.id, accountId), eq(fireflyAccounts.companyId, company.id)));
    }
  }

  if (intent === "delete") {
    const accountId = String(formData.get("accountId") || "");
    if (accountId) {
      await db
        .delete(fireflyAccounts)
        .where(and(eq(fireflyAccounts.id, accountId), eq(fireflyAccounts.companyId, company.id)));
    }
  }

  return redirect("/personal-life/finances/accounts");
}

export default function FireflyAccountsPage() {
  const { company, accounts } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  if (!company) {
    return <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm dark:border-gray-800 dark:bg-gray-900">Configure a empresa em Configurações para usar o Firefly.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Firefly • Contas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Plano de contas contábil</p>
        </div>
        <Link to="/personal-life/finances" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">Voltar ao dashboard</Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Nova conta</h2>
          <Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="create" />
            <input required name="name" placeholder="Nome da conta" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <div className="grid grid-cols-2 gap-3">
              <select name="accountType" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                <option value="asset">Ativo</option>
                <option value="liability">Passivo</option>
                <option value="equity">Patrimônio</option>
                <option value="revenue">Receita</option>
                <option value="expense">Despesa</option>
              </select>
              <input name="accountNumber" placeholder="Código" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <input name="currentBalance" placeholder="Saldo inicial" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <textarea name="notes" rows={2} placeholder="Observações" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <button disabled={navigation.state === "submitting"} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">Salvar conta</button>
          </Form>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Contas ({accounts.length})</h2>
          <div className="space-y-3">
            {accounts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma conta criada.</p>
            ) : (
              accounts.map((account) => (
                <div key={account.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{account.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{accountTypeLabel[account.accountType] || account.accountType}{account.accountNumber ? ` • ${account.accountNumber}` : ""}</p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Saldo: R$ {Number(account.currentBalance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  <div className="mt-2 flex gap-2">
                    <Form method="post">
                      <input type="hidden" name="intent" value="toggle" />
                      <input type="hidden" name="accountId" value={account.id} />
                      <input type="hidden" name="isActive" value={String(account.isActive)} />
                      <button className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700">{account.isActive ? "Desativar" : "Ativar"}</button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="accountId" value={account.id} />
                      <button className="rounded bg-red-600 px-2 py-1 text-xs text-white">Excluir</button>
                    </Form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
