import { useState } from "react";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/ncm";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { ncmClassifications } from "drizzle/schema";
import { classifyNCM } from "~/lib/ai.server";
import { ncmClassificationSchema } from "~/lib/validators";
import { t, type Locale } from "~/i18n";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Search, Sparkles, Check, Edit, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { data } from "react-router";
import { eq, desc } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const history = await db
    .select()
    .from(ncmClassifications)
    .where(eq(ncmClassifications.userId, user.id))
    .orderBy(desc(ncmClassifications.createdAt))
    .limit(20);

  return { locale, history, userId: user.id };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "classify") {
    const inputDescription = formData.get("inputDescription") as string;
    const result = ncmClassificationSchema.safeParse({ inputDescription });

    if (!result.success) {
      return data({ error: result.error.issues[0]?.message || "Dados invalidos" }, { status: 400 });
    }

    try {
      const classification = await classifyNCM(result.data.inputDescription, user.id);

      const [saved] = await db.insert(ncmClassifications).values({
        userId: user.id,
        inputDescription: result.data.inputDescription,
        suggestedNcm: classification.ncm,
        generatedDescription: classification.description,
        promptVersion: "2.0",
        status: "draft",
        notes: classification.justification,
      }).returning();

      return data({
        success: true,
        classification: saved,
        result: classification,
      });
    } catch (error) {
      console.error("[NCM] Classification error:", error);
      return data({ error: "Erro ao classificar. Tente novamente." }, { status: 500 });
    }
  }

  if (intent === "approve") {
    const id = formData.get("id") as string;
    const approvedNcm = formData.get("approvedNcm") as string;

    await db.update(ncmClassifications)
      .set({ status: "approved", approvedNcm: approvedNcm || undefined, updatedAt: new Date() })
      .where(eq(ncmClassifications.id, id));

    return data({ approved: true });
  }

  if (intent === "revise") {
    const id = formData.get("id") as string;
    const approvedNcm = formData.get("approvedNcm") as string;

    await db.update(ncmClassifications)
      .set({ status: "revised", approvedNcm, updatedAt: new Date() })
      .where(eq(ncmClassifications.id, id));

    return data({ revised: true });
  }

  return null;
}

export default function NcmPage({ loaderData, actionData }: Route.ComponentProps) {
  const { locale, history } = loaderData;
  const i18n = t(locale);
  const navigation = useNavigation();
  const isClassifying = navigation.state === "submitting" && navigation.formData?.get("intent") === "classify";
  const [showHistory, setShowHistory] = useState(false);
  const [correctedNcm, setCorrectedNcm] = useState("");

  const ad = actionData as {
    success?: boolean;
    error?: string;
    classification?: typeof history[0];
    result?: { ncm: string; description: string; justification: string };
    approved?: boolean;
    revised?: boolean;
  } | undefined;

  const statusVariant: Record<string, "default" | "info" | "success" | "warning"> = {
    draft: "default",
    approved: "success",
    revised: "warning",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.ncm.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Classificacao fiscal inteligente com IA - Prompt Blindado 2.0
        </p>
      </div>

      {/* Classification Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nova Classificacao</h2>
        </div>

        <Form method="post">
          <input type="hidden" name="intent" value="classify" />
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Descricao do Produto
              </label>
              <textarea
                name="inputDescription"
                rows={4}
                required
                minLength={5}
                placeholder="Ex: Empilhadeira eletrica contrabalancada, capacidade 2.500 kg, motor eletrico AC, mastil triplex com deslocamento lateral..."
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                Descreva o produto em qualquer idioma. Quanto mais detalhes tecnicos, melhor a classificacao.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button type="submit" disabled={isClassifying} className="bg-violet-600 hover:bg-violet-700">
                {isClassifying ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Classificando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Classificar com IA
                  </>
                )}
              </Button>
            </div>
          </div>
        </Form>

        {ad?.error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-400">{ad.error}</p>
          </div>
        )}
      </div>

      {/* Classification Result */}
      {ad?.success && ad.result && ad.classification && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-6 shadow-sm dark:border-violet-900 dark:bg-violet-900/10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Resultado da Classificacao</h2>
            <Badge variant="info">Prompt Blindado 2.0</Badge>
          </div>

          <div className="mb-4 flex items-center gap-4 rounded-lg bg-white p-4 dark:bg-gray-900">
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">NCM Sugerido</p>
              <p className="text-2xl font-bold font-mono text-violet-600 dark:text-violet-400">
                {ad.result.ncm || "Nao identificado"}
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-lg bg-white p-4 dark:bg-gray-900">
            <p className="mb-2 text-xs font-medium uppercase text-gray-500">Descricao Gerada (Prompt Blindado 2.0)</p>
            <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{ad.result.description}</div>
          </div>

          {ad.result.justification && (
            <div className="mb-4 rounded-lg bg-white p-4 dark:bg-gray-900">
              <p className="mb-2 text-xs font-medium uppercase text-gray-500">Justificativa (RGI 1 e 6)</p>
              <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{ad.result.justification}</div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <Form method="post" className="flex items-center gap-2">
              <input type="hidden" name="intent" value="approve" />
              <input type="hidden" name="id" value={ad.classification.id} />
              <input type="hidden" name="approvedNcm" value={ad.result.ncm} />
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                <Check className="h-4 w-4" /> Aprovar NCM
              </Button>
            </Form>

            <Form method="post" className="flex items-center gap-2">
              <input type="hidden" name="intent" value="revise" />
              <input type="hidden" name="id" value={ad.classification.id} />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  name="approvedNcm"
                  placeholder="NCM correto (ex: 8427.10.19)"
                  value={correctedNcm}
                  onChange={(e) => setCorrectedNcm(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <Button type="submit" variant="outline" disabled={!correctedNcm}>
                  <Edit className="h-4 w-4" /> Corrigir NCM
                </Button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* History */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="flex w-full items-center justify-between p-6"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Historico de Classificacoes</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {history.length}
            </span>
          </div>
          {showHistory ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </button>

        {showHistory && (
          <div className="border-t border-gray-200 dark:border-gray-800">
            {history.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500">Nenhuma classificacao realizada ainda</p>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {history.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-violet-600 dark:text-violet-400">
                            {item.approvedNcm || item.suggestedNcm || "--"}
                          </span>
                          <Badge variant={statusVariant[item.status] || "default"}>
                            {item.status === "draft" ? "Pendente" : item.status === "approved" ? "Aprovado" : "Corrigido"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{item.inputDescription}</p>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Static NCM Reference Table */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Referencia Rapida de NCMs</h2>
        </div>
        <NcmReferenceTable />
      </div>
    </div>
  );
}

const ncmData = [
  { code: "8471.30.19", description: "Notebooks / laptops portateis", ii: 0, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "8517.13.00", description: "Smartphones", ii: 0, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "8528.72.00", description: "TVs LED/LCD", ii: 20, ipi: 15, pis: 2.10, cofins: 9.65 },
  { code: "8703.23.10", description: "Automoveis 1500-3000 cm3", ii: 35, ipi: 25, pis: 2.10, cofins: 9.65 },
  { code: "8429.51.90", description: "Pas carregadoras frontais", ii: 0, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "8427.10.19", description: "Empilhadeiras eletricas", ii: 0, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "6110.30.00", description: "Vestuario de fibras sinteticas", ii: 35, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "2204.21.00", description: "Vinhos ate 2 litros", ii: 27, ipi: 10, pis: 2.10, cofins: 9.65 },
  { code: "3004.90.99", description: "Medicamentos diversos", ii: 0, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "4011.10.00", description: "Pneus para automoveis", ii: 16, ipi: 5, pis: 2.10, cofins: 9.65 },
];

function NcmReferenceTable() {
  const [query, setQuery] = useState("");
  const filtered = query.length >= 2
    ? ncmData.filter(
        (item) =>
          item.code.replace(/\./g, "").includes(query.replace(/\./g, "")) ||
          item.description.toLowerCase().includes(query.toLowerCase())
      )
    : ncmData;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar NCM ou descricao..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm text-gray-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">NCM</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Descricao</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-gray-500">II%</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-gray-500">IPI%</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-gray-500">PIS%</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-gray-500">COFINS%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {filtered.map((item) => (
              <tr key={item.code} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="whitespace-nowrap px-3 py-2 text-sm font-mono font-medium text-violet-600 dark:text-violet-400">{item.code}</td>
                <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{item.description}</td>
                <td className="px-3 py-2 text-center text-sm text-gray-600 dark:text-gray-400">{item.ii}%</td>
                <td className="px-3 py-2 text-center text-sm text-gray-600 dark:text-gray-400">{item.ipi}%</td>
                <td className="px-3 py-2 text-center text-sm text-gray-600 dark:text-gray-400">{item.pis}%</td>
                <td className="px-3 py-2 text-center text-sm text-gray-600 dark:text-gray-400">{item.cofins}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
