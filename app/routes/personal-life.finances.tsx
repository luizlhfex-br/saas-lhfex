import { Form, Link, redirect, useLoaderData } from "react-router";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import {
	companyProfile,
	fireflyAccounts,
	fireflyTransactions,
	fireflyBudgets,
	fireflyRecurringTransactions,
} from "../../drizzle/schema";

export async function loader({ request }: { request: Request }) {
	await requireAuth(request);

	const [company] = await db.select().from(companyProfile).limit(1);

	if (!company) {
		return {
			company: null,
			kpis: {
				accountsTotal: 0,
				activeAccounts: 0,
				transactionsTotal: 0,
				unreconciledTotal: 0,
				budgetsTotal: 0,
				activeBudgets: 0,
				recurringTotal: 0,
				activeRecurring: 0,
				totalBalance: 0,
			},
			recentTransactions: [],
			recentBudgets: [],
			upcomingRecurring: [],
		};
	}

	const [accounts, txRows, budgetRows, recurringRows, recentTransactions, recentBudgets, upcomingRecurring] = await Promise.all([
		db.select().from(fireflyAccounts).where(eq(fireflyAccounts.companyId, company.id)),
		db
			.select({
				total: sql<number>`count(*)::int`,
				unreconciled: sql<number>`sum(case when ${fireflyTransactions.isReconciled} = false then 1 else 0 end)::int`,
			})
			.from(fireflyTransactions)
			.where(eq(fireflyTransactions.companyId, company.id)),
		db
			.select({
				total: sql<number>`count(*)::int`,
				active: sql<number>`sum(case when ${fireflyBudgets.isActive} = true then 1 else 0 end)::int`,
			})
			.from(fireflyBudgets)
			.where(eq(fireflyBudgets.companyId, company.id)),
		db
			.select({
				total: sql<number>`count(*)::int`,
				active: sql<number>`sum(case when ${fireflyRecurringTransactions.isActive} = true then 1 else 0 end)::int`,
			})
			.from(fireflyRecurringTransactions)
			.where(eq(fireflyRecurringTransactions.companyId, company.id)),
		db
			.select()
			.from(fireflyTransactions)
			.where(eq(fireflyTransactions.companyId, company.id))
			.orderBy(desc(fireflyTransactions.transactionDate))
			.limit(8),
		db
			.select()
			.from(fireflyBudgets)
			.where(eq(fireflyBudgets.companyId, company.id))
			.orderBy(desc(fireflyBudgets.createdAt))
			.limit(5),
		db
			.select()
			.from(fireflyRecurringTransactions)
			.where(and(eq(fireflyRecurringTransactions.companyId, company.id), eq(fireflyRecurringTransactions.isActive, true)))
			.orderBy(desc(fireflyRecurringTransactions.nextRunDate))
			.limit(5),
	]);

	const accountNameById = new Map(accounts.map((item) => [item.id, item.name]));
	const totalBalance = accounts.reduce((sum, item) => sum + Number(item.currentBalance), 0);

	return {
		company,
		kpis: {
			accountsTotal: accounts.length,
			activeAccounts: accounts.filter((item) => item.isActive).length,
			transactionsTotal: Number(txRows[0]?.total || 0),
			unreconciledTotal: Number(txRows[0]?.unreconciled || 0),
			budgetsTotal: Number(budgetRows[0]?.total || 0),
			activeBudgets: Number(budgetRows[0]?.active || 0),
			recurringTotal: Number(recurringRows[0]?.total || 0),
			activeRecurring: Number(recurringRows[0]?.active || 0),
			totalBalance,
		},
		recentTransactions: recentTransactions.map((item) => ({
			...item,
			debitAccountName: accountNameById.get(item.debitAccountId) || "Conta não encontrada",
			creditAccountName: accountNameById.get(item.creditAccountId) || "Conta não encontrada",
		})),
		recentBudgets: recentBudgets.map((item) => ({
			...item,
			accountName: accountNameById.get(item.accountId) || "Conta não encontrada",
		})),
		upcomingRecurring: upcomingRecurring.map((item) => ({
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

	return redirect("/personal-life/finances");
}

export default function PersonalLifeFinancesPage() {
	const { company, kpis, recentTransactions, recentBudgets, upcomingRecurring } = useLoaderData<typeof loader>();

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
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Firefly Accounting</h1>
					<p className="text-sm text-gray-500 dark:text-gray-400">Dashboard contábil completo: contas, lançamentos, orçamentos e recorrências</p>
				</div>
				<Link
					to="/personal-life/finances/analytics"
					className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400"
				>
					📊 Analytics
				</Link>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<Link to="/personal-life/finances/accounts" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800">
					<p className="text-xs text-gray-500 dark:text-gray-400">Contas</p>
					<p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{kpis.accountsTotal}</p>
					<p className="text-xs text-gray-500 dark:text-gray-400">{kpis.activeAccounts} ativas</p>
				</Link>
				<Link to="/personal-life/finances/transactions" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800">
					<p className="text-xs text-gray-500 dark:text-gray-400">Lançamentos</p>
					<p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{kpis.transactionsTotal}</p>
					<p className="text-xs text-amber-600 dark:text-amber-400">{kpis.unreconciledTotal} pendentes</p>
				</Link>
				<Link to="/personal-life/finances/budgets" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800">
					<p className="text-xs text-gray-500 dark:text-gray-400">Orçamentos</p>
					<p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{kpis.budgetsTotal}</p>
					<p className="text-xs text-gray-500 dark:text-gray-400">{kpis.activeBudgets} ativos</p>
				</Link>
				<Link to="/personal-life/finances/recurring" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800">
					<p className="text-xs text-gray-500 dark:text-gray-400">Recorrências</p>
					<p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{kpis.recurringTotal}</p>
					<p className="text-xs text-gray-500 dark:text-gray-400">{kpis.activeRecurring} ativas</p>
				</Link>
			</div>

			<div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
				<p className="text-xs text-gray-500 dark:text-gray-400">Saldo consolidado</p>
				<p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
					R$ {Number(kpis.totalBalance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
				</p>
				<p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Baseado nas contas cadastradas no plano contábil</p>
			</div>

			<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
				<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Lançamentos recentes ({recentTransactions.length})</h2>
						<Link to="/personal-life/finances/transactions" className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">Ver todos</Link>
					</div>
					<div className="space-y-3">
						{recentTransactions.length === 0 ? (
							<p className="text-sm text-gray-500 dark:text-gray-400">Nenhum lançamento registrado.</p>
						) : (
							recentTransactions.map((transaction) => (
								<div key={transaction.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
									<p className="font-medium text-gray-900 dark:text-gray-100">{transaction.description}</p>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										{new Date(transaction.transactionDate).toLocaleDateString("pt-BR")} • {transaction.debitAccountName} → {transaction.creditAccountName}
									</p>
									<p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">R$ {Number(transaction.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
									<div className="mt-2 flex items-center gap-2">
										<span className={`rounded-full px-2 py-0.5 text-xs ${transaction.isReconciled ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"}`}>
											{transaction.isReconciled ? "Conciliado" : "Pendente"}
										</span>
										<Form method="post">
											<input type="hidden" name="intent" value="toggle_reconciled" />
											<input type="hidden" name="transactionId" value={transaction.id} />
											<input type="hidden" name="isReconciled" value={String(transaction.isReconciled)} />
											<button className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
												{transaction.isReconciled ? "Reabrir" : "Conciliar"}
											</button>
										</Form>
									</div>
								</div>
							))
						)}
					</div>
				</div>

				<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Orçamentos recentes ({recentBudgets.length})</h2>
						<Link to="/personal-life/finances/budgets" className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">Ver todos</Link>
					</div>
					<div className="space-y-3">
						{recentBudgets.length === 0 ? (
							<p className="text-sm text-gray-500 dark:text-gray-400">Nenhum orçamento criado.</p>
						) : (
							recentBudgets.map((budget) => (
								<div key={budget.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
									<p className="font-medium text-gray-900 dark:text-gray-100">{budget.name}</p>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										{budget.accountName} • {new Date(budget.startDate).toLocaleDateString("pt-BR")} a {new Date(budget.endDate).toLocaleDateString("pt-BR")}
									</p>
									<p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
										Planejado: R$ {Number(budget.plannedAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
									</p>
								</div>
							))
						)}
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
				<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
					<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Próximas recorrências ({upcomingRecurring.length})</h2>
					<div className="space-y-3">
						{upcomingRecurring.length === 0 ? (
							<p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma recorrência ativa.</p>
						) : (
							upcomingRecurring.map((item) => (
								<div key={item.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
									<p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										{item.debitAccountName} → {item.creditAccountName} • {item.frequency}
									</p>
									<p className="mt-1 text-sm text-gray-800 dark:text-gray-200">R$ {Number(item.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
									<p className="text-xs text-gray-500 dark:text-gray-400">Próxima execução: {new Date(item.nextRunDate).toLocaleDateString("pt-BR")}</p>
								</div>
							))
						)}
					</div>
				</div>

				<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
					<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Ações rápidas</h2>
					<div className="space-y-3">
						<Link to="/personal-life/finances/accounts" className="block rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">
							Gerenciar contas contábeis
						</Link>
						<Link to="/personal-life/finances/transactions" className="block rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">
							Registrar e conciliar lançamentos
						</Link>
						<Link to="/personal-life/finances/budgets" className="block rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">
							Configurar orçamentos e alertas
						</Link>
						<Link to="/personal-life/finances/recurring" className="block rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">
							Gerenciar lançamentos recorrentes
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
