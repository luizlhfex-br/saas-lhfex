import { useState } from "react";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/descricao-ncm";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { descriptionNcmItems } from "drizzle/schema";
import { classifyDescriptionNCM } from "~/lib/ai.server";
import { descricaoNcmSchema } from "~/lib/validators";
import { checkRateLimit, RATE_LIMITS } from "~/lib/rate-limit.server";
import { t, type Locale } from "~/i18n";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Sparkles, Check, Edit, Clock, FileSearch, Trash2 } from "lucide-react";
import { data } from "react-router";
import { eq, desc } from "drizzle-orm";
import { buildApiError } from "~/lib/api-error";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const history = await db
    .select()
    .from(descriptionNcmItems)
    .where(eq(descriptionNcmItems.userId, user.id))
    .orderBy(desc(descriptionNcmItems.createdAt))
    .limit(50);

  return { locale, history, userId: user.id };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "classify") {
    const rateCheck = await checkRateLimit(
      `desc-ncm:${user.id}`,
      RATE_LIMITS.aiNcmClassify.maxAttempts,
      RATE_LIMITS.aiNcmClassify.windowMs,
    );

    if (!rateCheck.allowed) {
      return data(
        buildApiError("RATE_LIMITED", `Limite excedido. Tente novamente em ${rateCheck.retryAfterSeconds}s.`),
        { status: 429 },
      );
    }

    const inputDescription = formData.get("inputDescription") as string;
    const supplier = (formData.get("supplier") as string | null)?.trim() || null;
    const referenceNumber = (formData.get("referenceNumber") as string | null)?.trim() || null;
    const observations = (formData.get("observations") as string | null)?.trim() || null;

    const result = descricaoNcmSchema.safeParse({ inputDescription });
    if (!result.success) {
      return data(buildApiError("INVALID_INPUT", result.error.issues[0]?.message || "Dados inválidos."), { status: 400 });
    }

    try {
      const classification = await classifyDescriptionNCM(
        result.data.inputDescription,
        supplier,
        referenceNumber,
        user.id,
      );

      const [saved] = await db.insert(descriptionNcmItems).values({
        userId: user.id,
        referenceNumber,
        supplier,
        inputDescription: result.data.inputDescription,
        generatedDescription: classification.description,
        suggestedNcm: classification.ncm,
        status: "draft",
        observations: [observations, classification.justification].filter(Boolean).join("\n\n---\n\n") || null,
        promptVersion: "1.0",
      }).returning();

      return data({
        success: true,
        classification: saved,
        result: classification,
      });
    } catch (error) {
      console.error("[DescriptionNCM] Classification error:", error);
      return data(buildApiError("AI_PROVIDER_ERROR", "Não foi possível classificar agora. Tente novamente em instantes."), {
        status: 500,
      });
    }
  }

  if (intent === "approve") {
    const id = formData.get("id") as string;
    const approvedNcm = (formData.get("approvedNcm") as string | null)?.trim() || undefined;

    await db.update(descriptionNcmItems)
      .set({ status: "approved", approvedNcm, updatedAt: new Date() })
      .where(eq(descriptionNcmItems.id, id));

    return data({ approved: true });
  }

  if (intent === "revise") {
    const id = formData.get("id") as string;
    const approvedNcm = (formData.get("approvedNcm") as string)?.trim();

    await db.update(descriptionNcmItems)
      .set({ status: "revised", approvedNcm, updatedAt: new Date() })
      .where(eq(descriptionNcmItems.id, id));

    return data({ revised: true });
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await db.delete(descriptionNcmItems).where(eq(descriptionNcmItems.id, id));
    return data({ deleted: true });
  }

  return null;
}

export default function DescricaoNcmPage({ loaderData, actionData }: Route.ComponentProps) {
  const { history } = loaderData;
  const navigation = useNavigation();
  const isClassifying = navigation.state === "submitting" && navigation.formData?.get("intent") === "classify";
  const [correctedNcm, setCorrectedNcm] = useState("");

  const ad = actionData as {
    success?: boolean;
    error?: string;
    code?: string;
    classification?: (typeof history)[0];
    result?: { ncm: string; description: string; justification: string };
    approved?: boolean;
    revised?: boolean;
    deleted?: boolean;
  } | undefined;

  const errorMessage = (() => {
    if (!ad?.error) return "";
    if (ad.code === "INVALID_INPUT") return "Descrição inválida. Inclua mais detalhes do produto.";
    if (ad.code === "AI_PROVIDER_ERROR") return "IA indisponível no momento. Tente novamente.";
    if (ad.code === "RATE_LIMITED") return ad.error;
    return ad.error;
  })();

  const statusVariant: Record<string, "default" | "info" | "success" | "warning"> = {
    draft: "default",
    approved: "success",
    revised: "warning",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Descrição / NCM</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Gere descrições robustas e classifique NCMs usando IA — pronto para DI/DUIMP
        </p>
      </div>

      {/* Classification Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nova Descrição + NCM</h2>
        </div>

        <Form method="post">
          <input type="hidden" name="intent" value="classify" />
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nº Referência
                </label>
                <input
                  type="text"
                  name="referenceNumber"
                  placeholder="Ex: PO-2026-001, SKU-12345"
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Fornecedor
                </label>
                <input
                  type="text"
                  name="supplier"
                  placeholder="Ex: Shenzhen Tech Co., Ltd."
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Descrição do Item <span className="text-red-500">*</span>
              </label>
              <textarea
                name="inputDescription"
                rows={4}
                required
                minLength={5}
                placeholder="Descreva o produto com o máximo de detalhes técnicos: tipo, função, material, modelo, uso previsto..."
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                Quanto mais detalhes técnicos, melhor a descrição e classificação geradas pela IA.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Observações
              </label>
              <textarea
                name="observations"
                rows={2}
                placeholder="Notas adicionais, contexto, uso especial..."
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button type="submit" disabled={isClassifying} className="bg-violet-600 hover:bg-violet-700">
                {isClassifying ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Gerar Descrição + NCM
                  </>
                )}
              </Button>
            </div>
          </div>
        </Form>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
          </div>
        )}
      </div>

      {/* Classification Result */}
      {ad?.success && ad.result && ad.classification && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-6 shadow-sm dark:border-violet-900 dark:bg-violet-900/10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Resultado</h2>
            <Badge variant="info">Novo</Badge>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">NCM Sugerida</h3>
              <p className="mt-1 text-2xl font-bold text-violet-700 dark:text-violet-400">{ad.result.ncm || "—"}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Descrição Robusta</h3>
              <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-white p-4 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                {ad.result.description}
              </pre>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Justificativa</h3>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{ad.result.justification}</p>
            </div>

            {/* Approve / Revise actions */}
            <div className="flex gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
              <Form method="post">
                <input type="hidden" name="intent" value="approve" />
                <input type="hidden" name="id" value={ad.classification.id} />
                <Button type="submit" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400">
                  <Check className="h-4 w-4" /> Aprovar
                </Button>
              </Form>
              <Form method="post" className="flex items-center gap-2">
                <input type="hidden" name="intent" value="revise" />
                <input type="hidden" name="id" value={ad.classification.id} />
                <input
                  type="text"
                  name="approvedNcm"
                  value={correctedNcm}
                  onChange={(e) => setCorrectedNcm(e.target.value)}
                  placeholder="NCM corrigida"
                  className="w-32 rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
                <Button type="submit" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400">
                  <Edit className="h-4 w-4" /> Revisar
                </Button>
              </Form>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Histórico ({history.length})</h2>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {history.map((item) => (
              <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant={statusVariant[item.status] || "default"}>
                        {item.status === "draft" && <><Clock className="mr-1 h-3 w-3" />Rascunho</>}
                        {item.status === "approved" && <><Check className="mr-1 h-3 w-3" />Aprovado</>}
                        {item.status === "revised" && <><Edit className="mr-1 h-3 w-3" />Revisado</>}
                      </Badge>
                      {item.suggestedNcm && (
                        <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                          NCM: {item.approvedNcm || item.suggestedNcm}
                        </span>
                      )}
                      {item.referenceNumber && (
                        <span className="text-xs text-gray-400">Ref: {item.referenceNumber}</span>
                      )}
                      {item.supplier && (
                        <span className="text-xs text-gray-400">| {item.supplier}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {item.inputDescription}
                    </p>
                    {item.generatedDescription && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-violet-600 hover:underline dark:text-violet-400">
                          Ver descrição gerada
                        </summary>
                        <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {item.generatedDescription}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {item.status === "draft" && (
                      <>
                        <Form method="post">
                          <input type="hidden" name="intent" value="approve" />
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" title="Aprovar" className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20">
                            <Check className="h-4 w-4" />
                          </button>
                        </Form>
                        <Form method="post">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" title="Excluir" className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </Form>
                      </>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
