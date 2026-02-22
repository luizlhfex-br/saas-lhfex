import { Form, redirect, useLoaderData, useNavigation } from "react-router";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { companyProfile, fireflyAccounts, fireflyTransactions } from "../../drizzle/schema";

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

  if (!company) {
    return { company: null, accounts: [], transactions: [] };
  }

  const [accounts, transactions] = await Promise.all([
    db
      .select()
      .from(fireflyAccounts)
      .where(eq(fireflyAccounts.companyId, company.id))
      .orderBy(desc(fireflyAccounts.createdAt)),
    db
      .select()
      .from(fireflyTransactions)
      .where(eq(fireflyTransactions.companyId, company.id))
      .orderBy(desc(fireflyTransactions.transactionDate))
      .limit(30),
  ]);

  const accountNameById = new Map(accounts.map((account) => [account.id, account.name]));

  const transactionsView = transactions.map((transaction) => ({
    ...transaction,
    debitAccountName: accountNameById.get(transaction.debitAccountId) || "Conta não encontrada",
    creditAccountName: accountNameById.get(transaction.creditAccountId) || "Conta não encontrada",
  }));

  return { company, accounts, transactions: transactionsView };
}

export async function action({ request }: { request: Request }) {
  await requireAuth(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  const [company] = await db.select().from(companyProfile).limit(1);
  if (!company) return redirect("/settings");

  if (intent === "create_account") {
    const name = String(formData.get("name") || "").trim();
    const accountType = String(formData.get("accountType") || "asset").trim();
    const accountNumber = String(formData.get("accountNumber") || "").trim();
    const initialBalance = String(formData.get("initialBalance") || "0").trim();
    const notes = String(formData.get("notes") || "").trim();

    if (name) {
      await db.insert(fireflyAccounts).values({
        companyId: company.id,
        name,
        accountType,
        accountNumber: accountNumber || null,
        currentBalance: initialBalance || "0",
        notes: notes || null,
        updatedAt: new Date(),
      });
    }
  }

  if (intent === "toggle_account") {
    const accountId = String(formData.get("accountId") || "");
    const isActive = String(formData.get("isActive") || "false") === "true";
    if (accountId) {
      await db
        .update(fireflyAccounts)
        .set({ isActive: !isActive, updatedAt: new Date() })
        .where(and(eq(fireflyAccounts.id, accountId), eq(fireflyAccounts.companyId, company.id)));
    }
  }

  if (intent === "delete_account") {
    const accountId = String(formData.get("accountId") || "");
    if (accountId) {
      await db
        .delete(fireflyAccounts)
        .where(and(eq(fireflyAccounts.id, accountId), eq(fireflyAccounts.companyId, company.id)));
    }
  }

  if (intent === "create_transaction") {
    const description = String(formData.get("description") || "").trim();
    const amount = String(formData.get("amount") || "").trim();
    const debitAccountId = String(formData.get("debitAccountId") || "").trim();
    const creditAccountId = String(formData.get("creditAccountId") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const reference = String(formData.get("reference") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const transactionDate = String(formData.get("transactionDate") || "").trim();

    if (description && amount && debitAccountId && creditAccountId && transactionDate) {
      await db.insert(fireflyTransactions).values({
        companyId: company.id,
        description,
        amount,
        debitAccountId,
        creditAccountId,
        category: category || null,
        reference: reference || null,
        notes: notes || null,
        transactionDate: new Date(transactionDate),
        updatedAt: new Date(),
      });
    }
  }

  return redirect("/firefly-accounting");
}

export default function FireflyAccountingPage() {
  const { company, accounts, transactions } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (!company) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Firefly Accounting</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Configure primeiro o perfil da empresa em Configurações para ativar o módulo contábil.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Firefly Accounting</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Contas contábeis e lançamentos em partida dobrada</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Nova Conta</h2>
          <Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="create_account" />
            <input name="name" required placeholder="Ex: Caixa Matriz" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <div className="grid grid-cols-2 gap-3">
              <select name="accountType" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                <option value="asset">Ativo</option>
                <option value="liability">Passivo</option>
                <option value="equity">Patrimônio</option>
                <option value="revenue">Receita</option>
                <option value="expense">Despesa</option>
              </select>
              <input name="accountNumber" placeholder="Código conta" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <input name="initialBalance" placeholder="Saldo inicial (ex: 1000.00)" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <textarea name="notes" rows={2} placeholder="Observações" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              Criar conta
            </button>
          </Form>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Novo Lançamento</h2>
          <Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="create_transaction" />
            <input name="description" required placeholder="Descrição" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" name="transactionDate" required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
              <input name="amount" required placeholder="Valor (ex: 250.00)" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select name="debitAccountId" required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                <option value="">Conta débito</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
              <select name="creditAccountId" required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                <option value="">Conta crédito</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input name="category" placeholder="Categoria" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
              <input name="reference" placeholder="Referência" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <textarea name="notes" rows={2} placeholder="Observações" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <button type="submit" disabled={isSubmitting || accounts.length < 2} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
              Registrar lançamento
            </button>
          </Form>
          {accounts.length < 2 && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Crie pelo menos duas contas para lançar transações.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Contas ({accounts.length})</h2>
          <div className="space-y-3">
            {accounts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma conta cadastrada.</p>
            ) : (
              accounts.map((account) => (
                <div key={account.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{account.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {accountTypeLabel[account.accountType] || account.accountType}
                        {account.accountNumber ? ` • ${account.accountNumber}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">Saldo: R$ {Number(account.currentBalance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${account.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                      {account.isActive ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Form method="post">
                      <input type="hidden" name="intent" value="toggle_account" />
                      <input type="hidden" name="accountId" value={account.id} />
                      <input type="hidden" name="isActive" value={String(account.isActive)} />
                      <button className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                        {account.isActive ? "Desativar" : "Ativar"}
                      </button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete_account" />
                      <input type="hidden" name="accountId" value={account.id} />
                      <button className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">Excluir</button>
                    </Form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Lançamentos recentes ({transactions.length})</h2>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum lançamento registrado.</p>
            ) : (
              transactions.map((transaction) => (
                <div key={transaction.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{transaction.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(transaction.transactionDate).toLocaleDateString("pt-BR")} • {transaction.debitAccountName} → {transaction.creditAccountName}
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">R$ {Number(transaction.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  {(transaction.category || transaction.reference) && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {[transaction.category, transaction.reference].filter(Boolean).join(" • ")}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
