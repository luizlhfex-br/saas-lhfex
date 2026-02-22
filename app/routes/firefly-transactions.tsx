import { Form, Link, redirect, useLoaderData, useNavigation } from "react-router";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { companyProfile, fireflyAccounts, fireflyTransactions } from "../../drizzle/schema";

export async function loader({ request }: { request: Request }) {
  await requireAuth(request);
  const [company] = await db.select().from(companyProfile).limit(1);
  if (!company) return { company: null, accounts: [], transactions: [] };

  const [accounts, transactions] = await Promise.all([
    db.select().from(fireflyAccounts).where(eq(fireflyAccounts.companyId, company.id)).orderBy(desc(fireflyAccounts.createdAt)),
    db.select().from(fireflyTransactions).where(eq(fireflyTransactions.companyId, company.id)).orderBy(desc(fireflyTransactions.transactionDate)).limit(80),
  ]);

  const accountNameById = new Map(accounts.map((item) => [item.id, item.name]));

  return {
    company,
    accounts,
    transactions: transactions.map((item) => ({
      ...item,
      debitAccountName: accountNameById.get(item.debitAccountId) || "Conta não encontrada",
      creditAccountName: accountNameById.get(item.creditAccountId) || "Conta não encontrada",
    })),
  };
}

export async function action({ request }: { request: Request }) {
  await requireAuth(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const [company] = await db.select().from(companyProfile).limit(1);

  if (!company) return redirect("/settings");

  if (intent === "create") {
    const description = String(formData.get("description") || "").trim();
    const amount = String(formData.get("amount") || "").trim();
    const transactionDate = String(formData.get("transactionDate") || "").trim();
    const debitAccountId = String(formData.get("debitAccountId") || "").trim();
    const creditAccountId = String(formData.get("creditAccountId") || "").trim();

    if (description && amount && transactionDate && debitAccountId && creditAccountId) {
      await db.insert(fireflyTransactions).values({
        companyId: company.id,
        description,
        amount,
        transactionDate: new Date(transactionDate),
        debitAccountId,
        creditAccountId,
        category: String(formData.get("category") || "").trim() || null,
        reference: String(formData.get("reference") || "").trim() || null,
        notes: String(formData.get("notes") || "").trim() || null,
        updatedAt: new Date(),
      });
    }
  }

  if (intent === "toggle_reconciled") {
    const transactionId = String(formData.get("transactionId") || "");
    const isReconciled = String(formData.get("isReconciled") || "false") === "true";
    if (transactionId) {
      await db
        .update(fireflyTransactions)
        .set({
          isReconciled: !isReconciled,
          reconciledAt: !isReconciled ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(eq(fireflyTransactions.id, transactionId), eq(fireflyTransactions.companyId, company.id)));
    }
  }

  if (intent === "delete") {
    const transactionId = String(formData.get("transactionId") || "");
    if (transactionId) {
      await db
        .delete(fireflyTransactions)
        .where(and(eq(fireflyTransactions.id, transactionId), eq(fireflyTransactions.companyId, company.id)));
    }
  }

  return redirect("/personal-life/finances/transactions");
}

export default function FireflyTransactionsPage() {
  const { company, accounts, transactions } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  if (!company) {
    return <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm dark:border-gray-800 dark:bg-gray-900">Configure a empresa em Configurações para usar o Firefly.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Firefly • Lançamentos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Partida dobrada com reconciliação</p>
        </div>
        <Link to="/personal-life/finances" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">Voltar ao dashboard</Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Novo lançamento</h2>
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="create" />
          <input required name="description" placeholder="Descrição" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <div className="grid grid-cols-2 gap-3">
            <input required type="date" name="transactionDate" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <input required name="amount" placeholder="Valor" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select required name="debitAccountId" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
              <option value="">Conta débito</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
            <select required name="creditAccountId" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
              <option value="">Conta crédito</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input name="category" placeholder="Categoria" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <input name="reference" placeholder="Referência" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          </div>
          <textarea name="notes" rows={2} placeholder="Observações" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <button disabled={navigation.state === "submitting" || accounts.length < 2} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">Salvar lançamento</button>
        </Form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Lançamentos ({transactions.length})</h2>
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum lançamento cadastrado.</p>
          ) : (
            transactions.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                <p className="font-medium text-gray-900 dark:text-gray-100">{item.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(item.transactionDate).toLocaleDateString("pt-BR")} • {item.debitAccountName} → {item.creditAccountName}</p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">R$ {Number(item.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Form method="post">
                    <input type="hidden" name="intent" value="toggle_reconciled" />
                    <input type="hidden" name="transactionId" value={item.id} />
                    <input type="hidden" name="isReconciled" value={String(item.isReconciled)} />
                    <button className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700">{item.isReconciled ? "Reabrir" : "Conciliar"}</button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="transactionId" value={item.id} />
                    <button className="rounded bg-red-600 px-2 py-1 text-xs text-white">Excluir</button>
                  </Form>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
