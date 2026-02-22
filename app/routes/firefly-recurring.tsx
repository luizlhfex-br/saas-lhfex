import { Form, Link, redirect, useLoaderData, useNavigation } from "react-router";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { companyProfile, fireflyAccounts, fireflyRecurringTransactions, fireflyTransactions } from "../../drizzle/schema";

function getNextRunDate(base: Date, frequency: string) {
  const next = new Date(base);
  if (frequency === "daily") next.setDate(next.getDate() + 1);
  else if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  else if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

export async function loader({ request }: { request: Request }) {
  await requireAuth(request);
  const [company] = await db.select().from(companyProfile).limit(1);
  if (!company) return { company: null, accounts: [], recurring: [] };

  const [accounts, recurring] = await Promise.all([
    db.select().from(fireflyAccounts).where(eq(fireflyAccounts.companyId, company.id)).orderBy(desc(fireflyAccounts.createdAt)),
    db.select().from(fireflyRecurringTransactions).where(eq(fireflyRecurringTransactions.companyId, company.id)).orderBy(desc(fireflyRecurringTransactions.nextRunDate)),
  ]);

  const accountNameById = new Map(accounts.map((item) => [item.id, item.name]));

  return {
    company,
    accounts,
    recurring: recurring.map((item) => ({
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
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const amount = String(formData.get("amount") || "").trim();
    const frequency = String(formData.get("frequency") || "monthly").trim();
    const debitAccountId = String(formData.get("debitAccountId") || "").trim();
    const creditAccountId = String(formData.get("creditAccountId") || "").trim();
    const nextRunDate = String(formData.get("nextRunDate") || "").trim();

    if (name && description && amount && debitAccountId && creditAccountId && nextRunDate) {
      await db.insert(fireflyRecurringTransactions).values({
        companyId: company.id,
        name,
        description,
        amount,
        frequency,
        debitAccountId,
        creditAccountId,
        nextRunDate: new Date(nextRunDate),
        notes: String(formData.get("notes") || "").trim() || null,
        updatedAt: new Date(),
      });
    }
  }

  if (intent === "toggle") {
    const recurringId = String(formData.get("recurringId") || "");
    const isActive = String(formData.get("isActive") || "false") === "true";
    if (recurringId) {
      await db
        .update(fireflyRecurringTransactions)
        .set({ isActive: !isActive, updatedAt: new Date() })
        .where(and(eq(fireflyRecurringTransactions.id, recurringId), eq(fireflyRecurringTransactions.companyId, company.id)));
    }
  }

  if (intent === "run_now") {
    const recurringId = String(formData.get("recurringId") || "");
    const [item] = await db
      .select()
      .from(fireflyRecurringTransactions)
      .where(and(eq(fireflyRecurringTransactions.id, recurringId), eq(fireflyRecurringTransactions.companyId, company.id)))
      .limit(1);

    if (item) {
      const now = new Date();
      await db.insert(fireflyTransactions).values({
        companyId: company.id,
        transactionDate: now,
        description: item.description,
        amount: item.amount,
        debitAccountId: item.debitAccountId,
        creditAccountId: item.creditAccountId,
        notes: item.notes,
        updatedAt: now,
      });

      await db
        .update(fireflyRecurringTransactions)
        .set({
          lastRunDate: now,
          nextRunDate: getNextRunDate(now, item.frequency),
          updatedAt: now,
        })
        .where(eq(fireflyRecurringTransactions.id, item.id));
    }
  }

  if (intent === "delete") {
    const recurringId = String(formData.get("recurringId") || "");
    if (recurringId) {
      await db
        .delete(fireflyRecurringTransactions)
        .where(and(eq(fireflyRecurringTransactions.id, recurringId), eq(fireflyRecurringTransactions.companyId, company.id)));
    }
  }

  return redirect("/personal-life/finances/recurring");
}

export default function FireflyRecurringPage() {
  const { company, accounts, recurring } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  if (!company) {
    return <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm dark:border-gray-800 dark:bg-gray-900">Configure a empresa em Configurações para usar o Firefly.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Firefly • Recorrências</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Automação de lançamentos periódicos</p>
        </div>
        <Link to="/personal-life/finances" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">Voltar ao dashboard</Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Nova recorrência</h2>
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="create" />
          <input required name="name" placeholder="Nome" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <input required name="description" placeholder="Descrição" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <div className="grid grid-cols-2 gap-3">
            <input required name="amount" placeholder="Valor" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <select name="frequency" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
              <option value="daily">Diária</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
              <option value="yearly">Anual</option>
            </select>
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
          <input required type="date" name="nextRunDate" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <textarea name="notes" rows={2} placeholder="Observações" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <button disabled={navigation.state === "submitting" || accounts.length < 2} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60">Salvar recorrência</button>
        </Form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Recorrências ({recurring.length})</h2>
        <div className="space-y-3">
          {recurring.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma recorrência criada.</p>
          ) : (
            recurring.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.debitAccountName} → {item.creditAccountName} • {item.frequency}</p>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">R$ {Number(item.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Próxima execução: {new Date(item.nextRunDate).toLocaleDateString("pt-BR")}</p>
                <div className="mt-2 flex gap-2">
                  <Form method="post">
                    <input type="hidden" name="intent" value="run_now" />
                    <input type="hidden" name="recurringId" value={item.id} />
                    <button className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">Executar agora</button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="toggle" />
                    <input type="hidden" name="recurringId" value={item.id} />
                    <input type="hidden" name="isActive" value={String(item.isActive)} />
                    <button className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700">{item.isActive ? "Desativar" : "Ativar"}</button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="recurringId" value={item.id} />
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
