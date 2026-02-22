import { Form, Link, redirect, useLoaderData, useNavigation } from "react-router";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { companyProfile, fireflyAccounts, fireflyBudgets } from "../../drizzle/schema";

export async function loader({ request }: { request: Request }) {
	await requireAuth(request);
	const [company] = await db.select().from(companyProfile).limit(1);
	if (!company) return { company: null, accounts: [], budgets: [] };

	const [accounts, budgets] = await Promise.all([
		db.select().from(fireflyAccounts).where(eq(fireflyAccounts.companyId, company.id)).orderBy(desc(fireflyAccounts.createdAt)),
		db.select().from(fireflyBudgets).where(eq(fireflyBudgets.companyId, company.id)).orderBy(desc(fireflyBudgets.createdAt)),
	]);

	const accountNameById = new Map(accounts.map((item) => [item.id, item.name]));

	return {
		company,
		accounts,
		budgets: budgets.map((item) => ({
			...item,
			accountName: accountNameById.get(item.accountId) || "Conta não encontrada",
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
		const accountId = String(formData.get("accountId") || "").trim();
		const plannedAmount = String(formData.get("plannedAmount") || "").trim();
		const startDate = String(formData.get("startDate") || "").trim();
		const endDate = String(formData.get("endDate") || "").trim();

		if (name && accountId && plannedAmount && startDate && endDate) {
			await db.insert(fireflyBudgets).values({
				companyId: company.id,
				name,
				accountId,
				period: String(formData.get("period") || "monthly").trim(),
				startDate: new Date(startDate),
				endDate: new Date(endDate),
				plannedAmount,
				alertThreshold: String(formData.get("alertThreshold") || "").trim() ? Number(formData.get("alertThreshold")) : null,
				notes: String(formData.get("notes") || "").trim() || null,
				updatedAt: new Date(),
			});
		}
	}

	if (intent === "toggle") {
		const budgetId = String(formData.get("budgetId") || "");
		const isActive = String(formData.get("isActive") || "false") === "true";
		if (budgetId) {
			await db
				.update(fireflyBudgets)
				.set({ isActive: !isActive, updatedAt: new Date() })
				.where(and(eq(fireflyBudgets.id, budgetId), eq(fireflyBudgets.companyId, company.id)));
		}
	}

	if (intent === "delete") {
		const budgetId = String(formData.get("budgetId") || "");
		if (budgetId) {
			await db
				.delete(fireflyBudgets)
				.where(and(eq(fireflyBudgets.id, budgetId), eq(fireflyBudgets.companyId, company.id)));
		}
	}

	return redirect("/personal-life/finances/budgets");
}

export default function PersonalLifeFinancesBudgetsPage() {
	const { company, accounts, budgets } = useLoaderData<typeof loader>();
	const navigation = useNavigation();

	if (!company) {
		return <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm dark:border-gray-800 dark:bg-gray-900">Configure a empresa em Configurações para usar o Firefly.</div>;
	}

	return (
		<div className="mx-auto max-w-6xl space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Firefly • Orçamentos</h1>
					<p className="text-sm text-gray-500 dark:text-gray-400">Planejamento e controle por conta</p>
				</div>
				<Link to="/personal-life/finances" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">Voltar ao dashboard</Link>
			</div>

			<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
				<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Novo orçamento</h2>
				<Form method="post" className="space-y-3">
					<input type="hidden" name="intent" value="create" />
					<input required name="name" placeholder="Nome do orçamento" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
					<div className="grid grid-cols-2 gap-3">
						<select required name="accountId" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
							<option value="">Conta</option>
							{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
						</select>
						<select name="period" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
							<option value="monthly">Mensal</option>
							<option value="quarterly">Trimestral</option>
							<option value="yearly">Anual</option>
						</select>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<input type="date" required name="startDate" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
						<input type="date" required name="endDate" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
					</div>
					<div className="grid grid-cols-2 gap-3">
						<input required name="plannedAmount" placeholder="Valor planejado" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
						<input name="alertThreshold" placeholder="Alerta %" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
					</div>
					<textarea name="notes" rows={2} placeholder="Observações" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
					<button disabled={navigation.state === "submitting"} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">Salvar orçamento</button>
				</Form>
			</div>

			<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
				<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Orçamentos ({budgets.length})</h2>
				<div className="space-y-3">
					{budgets.length === 0 ? (
						<p className="text-sm text-gray-500 dark:text-gray-400">Nenhum orçamento criado.</p>
					) : (
						budgets.map((item) => (
							<div key={item.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
								<p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
								<p className="text-xs text-gray-500 dark:text-gray-400">{item.accountName} • {new Date(item.startDate).toLocaleDateString("pt-BR")} a {new Date(item.endDate).toLocaleDateString("pt-BR")}</p>
								<p className="mt-1 text-sm text-gray-800 dark:text-gray-200">Planejado: R$ {Number(item.plannedAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} • Atual: R$ {Number(item.actualAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
								<div className="mt-2 flex gap-2">
									<Form method="post">
										<input type="hidden" name="intent" value="toggle" />
										<input type="hidden" name="budgetId" value={item.id} />
										<input type="hidden" name="isActive" value={String(item.isActive)} />
										<button className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700">{item.isActive ? "Desativar" : "Ativar"}</button>
									</Form>
									<Form method="post">
										<input type="hidden" name="intent" value="delete" />
										<input type="hidden" name="budgetId" value={item.id} />
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
