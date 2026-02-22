import { Form, redirect, useLoaderData, useNavigation } from "react-router";
import { useState } from "react";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { companyProfile, companyPromotions } from "../../drizzle/schema";
import { announcePromotion } from "~/lib/openclaw-bot.server";
import { and, desc, eq } from "drizzle-orm";

export async function loader({ request }: { request: Request }) {
  await requireAuth(request);

  const [company] = await db.select().from(companyProfile).limit(1);

  if (!company) {
    return { company: null, promotions: [] };
  }

  const promotions = await db
    .select()
    .from(companyPromotions)
    .where(eq(companyPromotions.companyId, company.id))
    .orderBy(desc(companyPromotions.createdAt));

  return {
    company,
    promotions,
  };
}

export async function action({ request }: { request: Request }) {
  await requireAuth(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  const [company] = await db.select().from(companyProfile).limit(1);
  if (!company) {
    return redirect("/settings");
  }

  if (intent === "create") {
    const title = String(formData.get("title") || "").trim();
    const type = String(formData.get("type") || "discount").trim();
    const description = String(formData.get("description") || "").trim();
    const discountType = String(formData.get("discountType") || "").trim();
    const discountValueRaw = String(formData.get("discountValue") || "").trim();
    const startDateRaw = String(formData.get("startDate") || "").trim();
    const endDateRaw = String(formData.get("endDate") || "").trim();
    const promotionCode = String(formData.get("promotionCode") || "").trim();
    const telegramMessage = String(formData.get("telegramMessage") || "").trim();

    if (title && startDateRaw && endDateRaw) {
      await db.insert(companyPromotions).values({
        companyId: company.id,
        title,
        type,
        description: description || null,
        discountType: discountType || null,
        discountValue: discountValueRaw || null,
        startDate: new Date(startDateRaw),
        endDate: new Date(endDateRaw),
        promotionCode: promotionCode || null,
        telegramMessage: telegramMessage || null,
        updatedAt: new Date(),
      });
    }
  }

  if (intent === "toggle") {
    const promotionId = String(formData.get("promotionId") || "");
    const isActive = String(formData.get("isActive") || "false") === "true";

    if (promotionId) {
      await db
        .update(companyPromotions)
        .set({ isActive: !isActive, updatedAt: new Date() })
        .where(and(eq(companyPromotions.id, promotionId), eq(companyPromotions.companyId, company.id)));
    }
  }

  if (intent === "delete") {
    const promotionId = String(formData.get("promotionId") || "");
    if (promotionId) {
      await db
        .delete(companyPromotions)
        .where(and(eq(companyPromotions.id, promotionId), eq(companyPromotions.companyId, company.id)));
    }
  }

  if (intent === "announce") {
    const promotionId = String(formData.get("promotionId") || "");
    if (promotionId) {
      await announcePromotion(promotionId);
    }
  }

  return redirect("/company-promotions");
}

export default function CompanyPromotionsPage() {
  const { company, promotions } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showNewForm, setShowNewForm] = useState(false);

  if (!company) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Promoções da Empresa</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Configure primeiro o perfil da empresa em Configurações para habilitar promoções.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Promoções da Empresa</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie campanhas e envie anúncios no Telegram</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewForm((prev) => !prev)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showNewForm ? "Fechar" : "Nova Promoção"}
        </button>
      </div>

      {showNewForm && (
        <Form method="post" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <input type="hidden" name="intent" value="create" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Título</label>
              <input name="title" required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
              <select name="type" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                <option value="discount">Desconto</option>
                <option value="gift">Brinde</option>
                <option value="cashback">Cashback</option>
                <option value="raffle">Sorteio</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Início</label>
              <input type="date" name="startDate" required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Fim</label>
              <input type="date" name="endDate" required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de desconto</label>
              <select name="discountType" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                <option value="">Nenhum</option>
                <option value="percentage">Percentual</option>
                <option value="fixed">Valor fixo</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Valor desconto</label>
              <input name="discountValue" placeholder="10.00" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Descrição</label>
              <textarea name="description" rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Código</label>
              <input name="promotionCode" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Mensagem Telegram (opcional)</label>
              <textarea name="telegramMessage" rows={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSubmitting ? "Salvando..." : "Salvar promoção"}
            </button>
          </div>
        </Form>
      )}

      <div className="space-y-3">
        {promotions.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            Nenhuma promoção cadastrada ainda.
          </div>
        ) : (
          promotions.map((promo) => (
            <div key={promo.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{promo.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{promo.description || "Sem descrição"}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(promo.startDate).toLocaleDateString("pt-BR")} até {new Date(promo.endDate).toLocaleDateString("pt-BR")}
                    {promo.promotionCode ? ` • Código: ${promo.promotionCode}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Form method="post">
                    <input type="hidden" name="intent" value="toggle" />
                    <input type="hidden" name="promotionId" value={promo.id} />
                    <input type="hidden" name="isActive" value={String(promo.isActive)} />
                    <button type="submit" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                      {promo.isActive ? "Desativar" : "Ativar"}
                    </button>
                  </Form>

                  <Form method="post">
                    <input type="hidden" name="intent" value="announce" />
                    <input type="hidden" name="promotionId" value={promo.id} />
                    <button type="submit" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                      Anunciar Telegram
                    </button>
                  </Form>

                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="promotionId" value={promo.id} />
                    <button type="submit" className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
                      Excluir
                    </button>
                  </Form>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
