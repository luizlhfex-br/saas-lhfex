import { data, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/personal-life.health";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { personalRoutines, routineTracking } from "../../drizzle/schema/personal-life";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { ArrowLeft, Activity, Scale, Ruler, Save } from "lucide-react";
import { Button } from "~/components/ui/button";

const WEIGHT_ROUTINE = "weight_tracking";
const MEASURE_ROUTINE = "body_measurements";

function todayBr(): string {
	return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function parseDecimal(raw: FormDataEntryValue | null): string | null {
	if (typeof raw !== "string") return null;
	const normalized = raw.trim().replace(",", ".");
	if (!normalized) return null;
	const value = Number(normalized);
	if (!Number.isFinite(value) || value <= 0) return null;
	return value.toFixed(2);
}

async function ensureRoutine(userId: string, routineType: string, name: string, unit: string) {
	const [existing] = await db
		.select({ id: personalRoutines.id })
		.from(personalRoutines)
		.where(and(eq(personalRoutines.userId, userId), eq(personalRoutines.routineType, routineType)))
		.orderBy(asc(personalRoutines.createdAt))
		.limit(1);

	if (existing) return existing.id;

	const [created] = await db
		.insert(personalRoutines)
		.values({
			userId,
			routineType,
			name,
			frequency: "daily",
			unit,
			isActive: true,
			startDate: todayBr(),
		})
		.returning({ id: personalRoutines.id });

	return created.id;
}

export async function loader({ request }: Route.LoaderArgs) {
	const { user } = await requireAuth(request);
	await requireRole(user, [ROLES.LUIZ]);

	const [weightRoutineId, measureRoutineId] = await Promise.all([
		ensureRoutine(user.id, WEIGHT_ROUTINE, "Peso corporal", "kg"),
		ensureRoutine(user.id, MEASURE_ROUTINE, "Medidas corporais", "cm"),
	]);

	const since = new Date(todayBr());
	since.setDate(since.getDate() - 120);

	const rows = await db
		.select()
		.from(routineTracking)
		.where(
			and(
				eq(routineTracking.userId, user.id),
				gte(routineTracking.date, since.toISOString().slice(0, 10))
			)
		)
		.orderBy(desc(routineTracking.date), desc(routineTracking.createdAt));

	const weightHistory = rows.filter((row) => row.routineId === weightRoutineId);
	const measuresHistory = rows.filter((row) => row.routineId === measureRoutineId);

	return {
		today: todayBr(),
		weightHistory,
		measuresHistory,
	};
}

export async function action({ request }: Route.ActionArgs) {
	const { user } = await requireAuth(request);
	await requireRole(user, [ROLES.LUIZ]);

	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "");
	const date = String(formData.get("date") ?? todayBr());

	if (intent !== "save_weight" && intent !== "save_measure") {
		return data({ error: "Intent inválido" }, { status: 400 });
	}

	const [weightRoutineId, measureRoutineId] = await Promise.all([
		ensureRoutine(user.id, WEIGHT_ROUTINE, "Peso corporal", "kg"),
		ensureRoutine(user.id, MEASURE_ROUTINE, "Medidas corporais", "cm"),
	]);

	if (intent === "save_weight") {
		const value = parseDecimal(formData.get("weight"));
		if (!value) {
			return data({ error: "Informe um peso válido" }, { status: 400 });
		}

		await db.insert(routineTracking).values({
			userId: user.id,
			routineId: weightRoutineId,
			date,
			completed: true,
			value,
			notes: null,
		});

		return data({ ok: true });
	}

	const measureValue = parseDecimal(formData.get("measure"));
	const measureType = String(formData.get("measureType") ?? "").trim();
	if (!measureValue || !measureType) {
		return data({ error: "Informe tipo e medida válidos" }, { status: 400 });
	}

	await db.insert(routineTracking).values({
		userId: user.id,
		routineId: measureRoutineId,
		date,
		completed: true,
		value: measureValue,
		notes: measureType,
	});

	return data({ ok: true });
}

export default function PersonalLifeHealthPage() {
	const { today, weightHistory, measuresHistory } = useLoaderData<typeof loader>();

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-8">
			<div className="flex items-center gap-3">
				<Link to="/personal-life" className="text-[var(--app-muted)] hover:text-[var(--app-text)]">
					<ArrowLeft className="h-5 w-5" />
				</Link>
				<div>
					<h1 className="text-xl font-bold text-[var(--app-text)]">Saúde Corporal</h1>
					<p className="text-sm text-[var(--app-muted)]">Peso e medidas corporais</p>
				</div>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-card-shadow)]">
					<div className="mb-3 flex items-center gap-2 text-[var(--app-text)]">
						<Scale className="h-5 w-5 text-indigo-500" />
						<h2 className="font-semibold">Registrar peso</h2>
					</div>
					<form method="post" className="space-y-3">
						<input type="hidden" name="intent" value="save_weight" />
						<input type="hidden" name="date" value={today} />
						<input
							type="text"
							name="weight"
							placeholder="Ex: 82,4"
							className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2 text-sm"
							required
						/>
						<Button type="submit" className="w-full">
							<Save className="mr-2 h-4 w-4" /> Salvar peso
						</Button>
					</form>
				</div>

				<div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-card-shadow)]">
					<div className="mb-3 flex items-center gap-2 text-[var(--app-text)]">
						<Ruler className="h-5 w-5 text-emerald-500" />
						<h2 className="font-semibold">Registrar medida</h2>
					</div>
					<form method="post" className="space-y-3">
						<input type="hidden" name="intent" value="save_measure" />
						<input type="hidden" name="date" value={today} />
						<select
							name="measureType"
							className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2 text-sm"
							required
						>
							<option value="">Selecione a medida</option>
							<option value="cintura">Cintura</option>
							<option value="abdomen">Abdomen</option>
							<option value="quadril">Quadril</option>
							<option value="peito">Peito</option>
							<option value="braco">Braço</option>
							<option value="coxa">Coxa</option>
						</select>
						<input
							type="text"
							name="measure"
							placeholder="Ex: 94,0"
							className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2 text-sm"
							required
						/>
						<Button type="submit" className="w-full">
							<Activity className="mr-2 h-4 w-4" /> Salvar medida
						</Button>
					</form>
				</div>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-card-shadow)]">
					<h3 className="mb-3 font-semibold text-[var(--app-text)]">Histórico de peso</h3>
					<div className="space-y-2">
						{weightHistory.length === 0 && <p className="text-sm text-[var(--app-muted)]">Sem registros ainda.</p>}
						{weightHistory.map((row) => (
							<div key={row.id} className="flex items-center justify-between rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm">
								<span>{new Date(`${row.date}T12:00:00`).toLocaleDateString("pt-BR")}</span>
								<strong>{row.value} kg</strong>
							</div>
						))}
					</div>
				</div>

				<div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-card-shadow)]">
					<h3 className="mb-3 font-semibold text-[var(--app-text)]">Histórico de medidas</h3>
					<div className="space-y-2">
						{measuresHistory.length === 0 && <p className="text-sm text-[var(--app-muted)]">Sem registros ainda.</p>}
						{measuresHistory.map((row) => (
							<div key={row.id} className="flex items-center justify-between rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm">
								<span>{new Date(`${row.date}T12:00:00`).toLocaleDateString("pt-BR")} · {row.notes || "medida"}</span>
								<strong>{row.value} cm</strong>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
