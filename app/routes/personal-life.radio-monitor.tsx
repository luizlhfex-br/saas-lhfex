import { Form, redirect, useLoaderData, useNavigation } from "react-router";
import { db } from "~/lib/db.server";
import { requireAuth } from "~/lib/auth.server";
import { radioStations, radioMonitorEvents, radioMonitorKeywords } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";

export async function loader({ request }: { request: Request }) {
	await requireAuth(request);

	const [stations, keywords, events] = await Promise.all([
		db.select().from(radioStations).orderBy(desc(radioStations.createdAt)),
		db.select().from(radioMonitorKeywords).orderBy(desc(radioMonitorKeywords.createdAt)),
		db.select().from(radioMonitorEvents).orderBy(desc(radioMonitorEvents.recordedAt)).limit(20),
	]);

	return { stations, keywords, events };
}

export async function action({ request }: { request: Request }) {
	await requireAuth(request);
	const formData = await request.formData();
	const intent = String(formData.get("intent") || "");

	if (intent === "create_station") {
		const name = String(formData.get("name") || "").trim();
		if (name) {
			await db.insert(radioStations).values({
				name,
				frequency: String(formData.get("frequency") || "").trim() || null,
				city: String(formData.get("city") || "").trim() || null,
				state: String(formData.get("state") || "").trim() || null,
				streamUrl: String(formData.get("streamUrl") || "").trim() || null,
				monitoringEnabled: String(formData.get("monitoringEnabled") || "false") === "true",
				updatedAt: new Date(),
			});
		}
	}

	if (intent === "toggle_station") {
		const stationId = String(formData.get("stationId") || "");
		const monitoringEnabled = String(formData.get("monitoringEnabled") || "false") === "true";
		if (stationId) {
			await db
				.update(radioStations)
				.set({ monitoringEnabled: !monitoringEnabled, updatedAt: new Date() })
				.where(eq(radioStations.id, stationId));
		}
	}

	if (intent === "create_keyword") {
		const keyword = String(formData.get("keyword") || "").trim();
		if (keyword) {
			await db.insert(radioMonitorKeywords).values({
				keyword,
				category: String(formData.get("category") || "").trim() || null,
				priority: String(formData.get("priority") || "medium").trim() || "medium",
			});
		}
	}

	if (intent === "toggle_keyword") {
		const keywordId = String(formData.get("keywordId") || "");
		const isActive = String(formData.get("isActive") || "false") === "true";
		if (keywordId) {
			await db
				.update(radioMonitorKeywords)
				.set({ isActive: !isActive })
				.where(eq(radioMonitorKeywords.id, keywordId));
		}
	}

	if (intent === "delete_station") {
		const stationId = String(formData.get("stationId") || "");
		if (stationId) {
			await db.delete(radioStations).where(eq(radioStations.id, stationId));
		}
	}

	if (intent === "delete_keyword") {
		const keywordId = String(formData.get("keywordId") || "");
		if (keywordId) {
			await db.delete(radioMonitorKeywords).where(eq(radioMonitorKeywords.id, keywordId));
		}
	}

	return redirect("/personal-life/radio-monitor");
}

export default function PersonalLifeRadioMonitorPage() {
	const { stations, keywords, events } = useLoaderData<typeof loader>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	return (
		<div className="mx-auto max-w-6xl space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Radio Monitor</h1>
				<p className="text-sm text-gray-500 dark:text-gray-400">Gerencie emissoras, palavras-chave e eventos detectados</p>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
					<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Nova Estação</h2>
					<Form method="post" className="space-y-3">
						<input type="hidden" name="intent" value="create_station" />
						<input name="name" placeholder="Nome da estação" required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
						<div className="grid grid-cols-2 gap-3">
							<input name="frequency" placeholder="FM 104.5" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
							<input name="state" placeholder="SP" maxLength={2} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase dark:border-gray-700 dark:bg-gray-800" />
						</div>
						<input name="city" placeholder="Cidade" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
						<input name="streamUrl" placeholder="https://stream.exemplo.com" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
						<label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
							<input type="checkbox" name="monitoringEnabled" value="true" className="h-4 w-4" />
							Habilitar monitoramento
						</label>
						<button disabled={isSubmitting} type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
							Adicionar estação
						</button>
					</Form>
				</div>

				<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
					<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Nova Palavra-chave</h2>
					<Form method="post" className="space-y-3">
						<input type="hidden" name="intent" value="create_keyword" />
						<input name="keyword" placeholder="ex: sorteio" required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
						<div className="grid grid-cols-2 gap-3">
							<select name="category" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
								<option value="promotion">Promoção</option>
								<option value="raffle">Sorteio</option>
								<option value="discount">Desconto</option>
								<option value="contest">Concurso</option>
							</select>
							<select name="priority" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
								<option value="low">Baixa</option>
								<option value="medium">Média</option>
								<option value="high">Alta</option>
							</select>
						</div>
						<button disabled={isSubmitting} type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
							Adicionar palavra-chave
						</button>
					</Form>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
					<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Estações ({stations.length})</h2>
					<div className="space-y-3">
						{stations.length === 0 ? (
							<p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma estação cadastrada.</p>
						) : (
							stations.map((station) => (
								<div key={station.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
									<p className="font-medium text-gray-900 dark:text-gray-100">{station.name}</p>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										{[station.frequency, station.city, station.state].filter(Boolean).join(" • ")}
									</p>
									<div className="mt-3 flex gap-2">
										<Form method="post">
											<input type="hidden" name="intent" value="toggle_station" />
											<input type="hidden" name="stationId" value={station.id} />
											<input type="hidden" name="monitoringEnabled" value={String(station.monitoringEnabled)} />
											<button className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
												{station.monitoringEnabled ? "Desativar" : "Ativar"}
											</button>
										</Form>
										<Form method="post">
											<input type="hidden" name="intent" value="delete_station" />
											<input type="hidden" name="stationId" value={station.id} />
											<button className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">Excluir</button>
										</Form>
									</div>
								</div>
							))
						)}
					</div>
				</div>

				<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
					<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Palavras-chave ({keywords.length})</h2>
					<div className="space-y-3">
						{keywords.length === 0 ? (
							<p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma palavra-chave cadastrada.</p>
						) : (
							keywords.map((keyword) => (
								<div key={keyword.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
									<p className="font-medium text-gray-900 dark:text-gray-100">{keyword.keyword}</p>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										{keyword.category || "Sem categoria"} • Prioridade {keyword.priority}
									</p>
									<div className="mt-3 flex gap-2">
										<Form method="post">
											<input type="hidden" name="intent" value="toggle_keyword" />
											<input type="hidden" name="keywordId" value={keyword.id} />
											<input type="hidden" name="isActive" value={String(keyword.isActive)} />
											<button className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
												{keyword.isActive ? "Desativar" : "Ativar"}
											</button>
										</Form>
										<Form method="post">
											<input type="hidden" name="intent" value="delete_keyword" />
											<input type="hidden" name="keywordId" value={keyword.id} />
											<button className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">Excluir</button>
										</Form>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</div>

			<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
				<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Eventos recentes ({events.length})</h2>
				<div className="space-y-2">
					{events.length === 0 ? (
						<p className="text-sm text-gray-500 dark:text-gray-400">Nenhum evento detectado ainda.</p>
					) : (
						events.map((event) => (
							<div key={event.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800">
								<p className="font-medium text-gray-900 dark:text-gray-100">
									{event.companyName || "Empresa não identificada"} {event.isPromotion ? "• Promoção" : "• Menção"}
								</p>
								<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
									{new Date(event.recordedAt).toLocaleString("pt-BR")} • Confiança: {event.confidence || "N/D"}
								</p>
								{event.transcriptionText && (
									<p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">{event.transcriptionText}</p>
								)}
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
