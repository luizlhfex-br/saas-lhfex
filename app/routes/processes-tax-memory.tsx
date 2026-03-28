import type { ReactNode } from "react";
import { Form, Link, data, redirect } from "react-router";
import type { Route } from "./+types/processes-tax-memory";
import { and, asc, eq, isNull } from "drizzle-orm";
import { clients, processTaxExpenses, processTaxItems, processTaxWorkbooks, processes } from "../../drizzle/schema";
import { requireAuth } from "~/lib/auth.server";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import { db } from "~/lib/db.server";
import { calculateProcessTaxMemory, getSuggestedBaseExpenses } from "~/lib/process-tax-memory.server";
import { OperationalHero, OperationalPanel, OperationalStat } from "~/components/ui/operational-page";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Calculator, FileSpreadsheet, Package, Plus, Receipt, Save, Scale, Trash2 } from "lucide-react";

type Scenario = "air" | "sea" | "other";
type ExpenseKind = "tax_base" | "final";

const fieldClassName =
  "block h-11 w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm text-[var(--app-text)] outline-none transition focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10";

function toNumber(value: FormDataEntryValue | string | null | undefined): number {
  const parsed = Number(String(value ?? "").trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: FormDataEntryValue | null | undefined): string {
  return String(value ?? "").trim();
}

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

async function getProcessContext(processId: string, companyId: string) {
  const [process] = await db
    .select({
      id: processes.id,
      companyId: processes.companyId,
      reference: processes.reference,
      processType: processes.processType,
      totalWeight: processes.totalWeight,
      clientName: clients.nomeFantasia,
      clientRazao: clients.razaoSocial,
    })
    .from(processes)
    .innerJoin(clients, eq(processes.clientId, clients.id))
    .where(and(eq(processes.id, processId), eq(processes.companyId, companyId), isNull(processes.deletedAt), isNull(clients.deletedAt)))
    .limit(1);
  return process ?? null;
}

async function ensureWorkbook(processId: string, companyId: string) {
  const [existing] = await db
    .select()
    .from(processTaxWorkbooks)
    .where(and(eq(processTaxWorkbooks.processId, processId), eq(processTaxWorkbooks.companyId, companyId)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(processTaxWorkbooks).values({ processId, companyId }).returning();
  return created;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const process = await getProcessContext(params.id, companyId);
  if (!process) throw new Response("Not found", { status: 404 });
  if (process.processType !== "import") return redirect(`/processes/${params.id}`);

  const [workbook] = await db
    .select()
    .from(processTaxWorkbooks)
    .where(and(eq(processTaxWorkbooks.processId, process.id), eq(processTaxWorkbooks.companyId, companyId)))
    .limit(1);

  const items = workbook
    ? await db.select().from(processTaxItems).where(and(eq(processTaxItems.workbookId, workbook.id), eq(processTaxItems.companyId, companyId))).orderBy(asc(processTaxItems.sortOrder), asc(processTaxItems.createdAt))
    : [];
  const expenses = workbook
    ? await db.select().from(processTaxExpenses).where(and(eq(processTaxExpenses.workbookId, workbook.id), eq(processTaxExpenses.companyId, companyId))).orderBy(asc(processTaxExpenses.kind), asc(processTaxExpenses.sortOrder), asc(processTaxExpenses.createdAt))
    : [];

  return {
    process,
    workbook: workbook ?? null,
    items,
    expenses,
    calculation: calculateProcessTaxMemory({ workbook: workbook ?? null, items, expenses }),
    suggestedBaseExpenses: getSuggestedBaseExpenses(workbook?.scenario),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const process = await getProcessContext(params.id, companyId);
  if (!process) return data({ error: "Processo nao encontrado." }, { status: 404 });
  if (process.processType !== "import") return data({ error: "Memoria de Impostos so existe para importacao." }, { status: 400 });

  const formData = await request.formData();
  const intent = toText(formData.get("intent"));
  if (!intent) return data({ error: "Acao nao informada." }, { status: 400 });
  const workbook = await ensureWorkbook(process.id, companyId);
  const currentPath = new URL(request.url).pathname;

  if (intent === "save-workbook") {
    await db.update(processTaxWorkbooks).set({
      scenario: (toText(formData.get("scenario")) || "other") as Scenario,
      currency: toText(formData.get("currency")) || "USD",
      exchangeRate: String(toNumber(formData.get("exchangeRate"))),
      freightTotalUsd: String(toNumber(formData.get("freightTotalUsd"))),
      stateIcmsRate: String(toNumber(formData.get("stateIcmsRate"))),
      quoteDate: formData.get("quoteDate") ? new Date(String(formData.get("quoteDate"))) : null,
      notes: toText(formData.get("notes")) || null,
      updatedAt: new Date(),
    }).where(and(eq(processTaxWorkbooks.id, workbook.id), eq(processTaxWorkbooks.companyId, companyId)));
    return redirect(currentPath);
  }

  if (intent === "add-item") {
    const count = await db.select({ id: processTaxItems.id }).from(processTaxItems).where(and(eq(processTaxItems.workbookId, workbook.id), eq(processTaxItems.companyId, companyId)));
    await db.insert(processTaxItems).values({
      workbookId: workbook.id,
      companyId,
      partNumber: toText(formData.get("partNumber")) || null,
      description: toText(formData.get("description")) || null,
      ncm: toText(formData.get("ncm")) || null,
      quantity: String(toNumber(formData.get("quantity"))),
      fobUsd: String(toNumber(formData.get("fobUsd"))),
      netWeightKg: String(toNumber(formData.get("netWeightKg"))),
      iiRate: String(toNumber(formData.get("iiRate"))),
      ipiRate: String(toNumber(formData.get("ipiRate"))),
      pisRate: String(toNumber(formData.get("pisRate"))),
      cofinsRate: String(toNumber(formData.get("cofinsRate"))),
      icmsRate: toText(formData.get("icmsRate")) ? String(toNumber(formData.get("icmsRate"))) : null,
      sortOrder: count.length + 1,
    });
    return redirect(currentPath);
  }

  if (intent === "save-item" || intent === "delete-item") {
    const itemId = toText(formData.get("itemId"));
    if (!itemId) return data({ error: "Item nao informado." }, { status: 400 });
    if (intent === "delete-item") {
      await db.delete(processTaxItems).where(and(eq(processTaxItems.id, itemId), eq(processTaxItems.companyId, companyId), eq(processTaxItems.workbookId, workbook.id)));
    } else {
      await db.update(processTaxItems).set({
        partNumber: toText(formData.get("partNumber")) || null,
        description: toText(formData.get("description")) || null,
        ncm: toText(formData.get("ncm")) || null,
        quantity: String(toNumber(formData.get("quantity"))),
        fobUsd: String(toNumber(formData.get("fobUsd"))),
        netWeightKg: String(toNumber(formData.get("netWeightKg"))),
        iiRate: String(toNumber(formData.get("iiRate"))),
        ipiRate: String(toNumber(formData.get("ipiRate"))),
        pisRate: String(toNumber(formData.get("pisRate"))),
        cofinsRate: String(toNumber(formData.get("cofinsRate"))),
        icmsRate: toText(formData.get("icmsRate")) ? String(toNumber(formData.get("icmsRate"))) : null,
        updatedAt: new Date(),
      }).where(and(eq(processTaxItems.id, itemId), eq(processTaxItems.companyId, companyId), eq(processTaxItems.workbookId, workbook.id)));
    }
    return redirect(currentPath);
  }

  if (intent === "add-expense") {
    const count = await db.select({ id: processTaxExpenses.id }).from(processTaxExpenses).where(and(eq(processTaxExpenses.workbookId, workbook.id), eq(processTaxExpenses.companyId, companyId)));
    await db.insert(processTaxExpenses).values({
      workbookId: workbook.id,
      companyId,
      kind: (toText(formData.get("kind")) || "tax_base") as ExpenseKind,
      label: toText(formData.get("label")) || "Despesa",
      amountBrl: String(toNumber(formData.get("amountBrl"))),
      notes: toText(formData.get("notes")) || null,
      sortOrder: count.length + 1,
    });
    return redirect(currentPath);
  }

  if (intent === "save-expense" || intent === "delete-expense") {
    const expenseId = toText(formData.get("expenseId"));
    if (!expenseId) return data({ error: "Despesa nao informada." }, { status: 400 });
    if (intent === "delete-expense") {
      await db.delete(processTaxExpenses).where(and(eq(processTaxExpenses.id, expenseId), eq(processTaxExpenses.companyId, companyId), eq(processTaxExpenses.workbookId, workbook.id)));
    } else {
      await db.update(processTaxExpenses).set({
        kind: (toText(formData.get("kind")) || "tax_base") as ExpenseKind,
        label: toText(formData.get("label")) || "Despesa",
        amountBrl: String(toNumber(formData.get("amountBrl"))),
        notes: toText(formData.get("notes")) || null,
        updatedAt: new Date(),
      }).where(and(eq(processTaxExpenses.id, expenseId), eq(processTaxExpenses.companyId, companyId), eq(processTaxExpenses.workbookId, workbook.id)));
    }
    return redirect(currentPath);
  }

  return data({ error: "Acao nao suportada." }, { status: 400 });
}

export default function ProcessTaxMemoryPage({ loaderData, actionData }: Route.ComponentProps) {
  const { process, workbook, items, expenses, calculation, suggestedBaseExpenses } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;
  const baseExpenses = expenses.filter((expense) => expense.kind === "tax_base");
  const finalExpenses = expenses.filter((expense) => expense.kind === "final");

  return (
    <div className="space-y-6">
      <OperationalHero eyebrow="Memória de Impostos" title={`Fechamento tributário da importação ${process.reference}`} description="Rateio por peso líquido, despesas na base do ICMS e despesas finais do processo." actions={<><Link to={`/processes/${process.id}`}><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar ao processo</Button></Link><Link to={`/calculator?processId=${process.id}`}><Button className="gap-2"><Calculator className="h-4 w-4" />Abrir calculadora</Button></Link></>} aside={<><OperationalStat label="Cliente" value={process.clientName || process.clientRazao || "-"} /><OperationalStat label="Peso do processo" value={process.totalWeight ? `${formatMoney(Number(process.totalWeight))} kg` : "Nao informado"} /><OperationalStat label="Itens" value={items.length} /><OperationalStat label="Custo final estimado" value={`R$ ${formatMoney(calculation.totals.totalLandedCostBrl)}`} /></>} />
      {error ? <div className="rounded-[22px] border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_360px]">
        <div className="space-y-6">
          <OperationalPanel title="Parâmetros do workbook" icon={<FileSpreadsheet className="h-5 w-5" />} description="Define cenário da importação, câmbio, frete e ICMS.">
            <Form method="post" className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="intent" value="save-workbook" />
              <L label="Perfil de despesas"><select name="scenario" defaultValue={workbook?.scenario ?? "other"} className={fieldClassName}><option value="air">Aéreo</option><option value="sea">Marítimo</option><option value="other">Outro</option></select></L>
              <L label="Moeda base"><select name="currency" defaultValue={workbook?.currency ?? "USD"} className={fieldClassName}><option value="USD">USD</option><option value="BRL">BRL</option></select></L>
              <L label="Cotação USD/BRL"><input name="exchangeRate" defaultValue={workbook?.exchangeRate ?? "0"} className={fieldClassName} /></L>
              <L label="Frete total (USD)"><input name="freightTotalUsd" defaultValue={workbook?.freightTotalUsd ?? "0"} className={fieldClassName} /></L>
              <L label="ICMS (%)"><input name="stateIcmsRate" defaultValue={workbook?.stateIcmsRate ?? "18"} className={fieldClassName} /></L>
              <L label="Data da cotação"><input name="quoteDate" type="date" defaultValue={formatDateInput(workbook?.quoteDate)} className={fieldClassName} /></L>
              <L label="Observações" className="md:col-span-2"><textarea name="notes" defaultValue={workbook?.notes ?? ""} rows={3} className={`${fieldClassName} min-h-[120px]`} /></L>
              <div className="md:col-span-2"><Button type="submit" className="gap-2"><Save className="h-4 w-4" />Salvar parâmetros</Button></div>
            </Form>
          </OperationalPanel>

          <OperationalPanel title="Itens da invoice" icon={<Package className="h-5 w-5" />} description="Cadastre os itens com FOB e peso líquido. Se o peso ficar zerado, a alocação cai em fallback.">
            <Form method="post" className="grid gap-3 lg:grid-cols-12">
              <input type="hidden" name="intent" value="add-item" />
              <S className="lg:col-span-2" label="Part number"><input name="partNumber" className={fieldClassName} /></S>
              <S className="lg:col-span-3" label="Descrição"><input name="description" className={fieldClassName} /></S>
              <S className="lg:col-span-2" label="NCM"><input name="ncm" className={fieldClassName} /></S>
              <S className="lg:col-span-1" label="Qtd"><input name="quantity" defaultValue="1" className={fieldClassName} /></S>
              <S className="lg:col-span-2" label="FOB USD"><input name="fobUsd" defaultValue="0" className={fieldClassName} /></S>
              <S className="lg:col-span-2" label="Peso líquido (kg)"><input name="netWeightKg" defaultValue="0" className={fieldClassName} /></S>
              <S className="lg:col-span-2" label="II %"><input name="iiRate" defaultValue="14" className={fieldClassName} /></S>
              <S className="lg:col-span-2" label="IPI %"><input name="ipiRate" defaultValue="0" className={fieldClassName} /></S>
              <S className="lg:col-span-2" label="PIS %"><input name="pisRate" defaultValue="2,10" className={fieldClassName} /></S>
              <S className="lg:col-span-2" label="COFINS %"><input name="cofinsRate" defaultValue="9,65" className={fieldClassName} /></S>
              <S className="lg:col-span-2" label="ICMS %"><input name="icmsRate" placeholder="Usar parâmetro" className={fieldClassName} /></S>
              <div className="lg:col-span-2 flex items-end"><Button type="submit" className="w-full gap-2"><Plus className="h-4 w-4" />Adicionar</Button></div>
            </Form>

            <div className="space-y-3">
              {items.length === 0 ? <div className="rounded-[20px] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-5 text-sm text-[var(--app-muted)]">Nenhum item tributário registrado ainda.</div> : items.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  <Form method="post" className="grid gap-3 lg:grid-cols-12">
                    <input type="hidden" name="intent" value="save-item" /><input type="hidden" name="itemId" value={item.id} />
                    <S className="lg:col-span-2" label="Part number"><input name="partNumber" defaultValue={item.partNumber ?? ""} className={fieldClassName} /></S>
                    <S className="lg:col-span-3" label="Descrição"><input name="description" defaultValue={item.description ?? ""} className={fieldClassName} /></S>
                    <S className="lg:col-span-2" label="NCM"><input name="ncm" defaultValue={item.ncm ?? ""} className={fieldClassName} /></S>
                    <S className="lg:col-span-1" label="Qtd"><input name="quantity" defaultValue={item.quantity ?? "0"} className={fieldClassName} /></S>
                    <S className="lg:col-span-2" label="FOB USD"><input name="fobUsd" defaultValue={item.fobUsd ?? "0"} className={fieldClassName} /></S>
                    <S className="lg:col-span-2" label="Peso líquido"><input name="netWeightKg" defaultValue={item.netWeightKg ?? "0"} className={fieldClassName} /></S>
                    <S className="lg:col-span-1" label="II %"><input name="iiRate" defaultValue={item.iiRate ?? "0"} className={fieldClassName} /></S>
                    <S className="lg:col-span-1" label="IPI %"><input name="ipiRate" defaultValue={item.ipiRate ?? "0"} className={fieldClassName} /></S>
                    <S className="lg:col-span-1" label="PIS %"><input name="pisRate" defaultValue={item.pisRate ?? "0"} className={fieldClassName} /></S>
                    <S className="lg:col-span-1" label="COFINS %"><input name="cofinsRate" defaultValue={item.cofinsRate ?? "0"} className={fieldClassName} /></S>
                    <S className="lg:col-span-1" label="ICMS %"><input name="icmsRate" defaultValue={item.icmsRate ?? ""} className={fieldClassName} /></S>
                    <div className="lg:col-span-2 flex items-end"><Button type="submit" className="w-full gap-2"><Save className="h-4 w-4" />Salvar</Button></div>
                  </Form>
                  <Form method="post" className="mt-3 flex justify-end"><input type="hidden" name="intent" value="delete-item" /><input type="hidden" name="itemId" value={item.id} /><Button type="submit" variant="outline" className="gap-2 text-red-200"><Trash2 className="h-4 w-4" />Excluir item</Button></Form>
                </div>
              ))}
            </div>
          </OperationalPanel>

          <div className="grid gap-6 lg:grid-cols-2">
            <ExpensePanel title="Despesas na base do ICMS" description={`Rateadas por ${calculation.allocationBasis === "net_weight" ? "peso líquido" : calculation.allocationBasis === "fob" ? "FOB (fallback)" : "divisão igual"}. Sugestões: ${suggestedBaseExpenses.join(", ")}.`} items={baseExpenses} kind="tax_base" />
            <ExpensePanel title="Despesas finais do processo" description="Ficam fora da base dos tributos, mas entram no fechamento final do embarque." items={finalExpenses} kind="final" />
          </div>

          <OperationalPanel title="Resumo por NCM" icon={<Scale className="h-5 w-5" />} description="Consolida peso, tributos e custo final por NCM.">
            {calculation.ncmSummary.length === 0 ? <p className="text-sm text-[var(--app-muted)]">Sem itens suficientes para consolidar por NCM.</p> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)]"><tr><th className="pb-3 pr-4">NCM</th><th className="pb-3 pr-4">Itens</th><th className="pb-3 pr-4">Peso</th><th className="pb-3 pr-4">FOB USD</th><th className="pb-3 pr-4">ICMS</th><th className="pb-3 pr-4">Custo final</th></tr></thead><tbody>{calculation.ncmSummary.map((row) => <tr key={row.ncm} className="border-t border-[var(--app-border)]"><td className="py-3 pr-4 font-medium text-[var(--app-text)]">{row.ncm}</td><td className="py-3 pr-4 text-[var(--app-muted)]">{row.itemCount}</td><td className="py-3 pr-4 text-[var(--app-muted)]">{formatMoney(row.netWeightKg)}</td><td className="py-3 pr-4 text-[var(--app-muted)]">USD {formatMoney(row.fobUsd)}</td><td className="py-3 pr-4 text-[var(--app-muted)]">R$ {formatMoney(row.icmsBrl)}</td><td className="py-3 pr-4 font-medium text-[var(--app-text)]">R$ {formatMoney(row.landedCostBrl)}</td></tr>)}</tbody></table></div>}
          </OperationalPanel>
        </div>

        <div className="space-y-6">
          <OperationalPanel title="Resumo executivo" icon={<Receipt className="h-5 w-5" />} description="Leitura rápida do fechamento tributário atual.">
            <SummaryRow label="Base de rateio" value={calculation.allocationBasis === "net_weight" ? "Peso líquido" : calculation.allocationBasis === "fob" ? "FOB (fallback)" : "Divisão igual"} />
            <SummaryRow label="Peso total dos itens" value={`${formatMoney(calculation.totals.totalNetWeightKg)} kg`} />
            <SummaryRow label="FOB total" value={`USD ${formatMoney(calculation.totals.totalFobUsd)}`} />
            <SummaryRow label="Frete total" value={`USD ${formatMoney(calculation.totals.totalFreightUsd)}`} />
            <SummaryRow label="CIF total BRL" value={`R$ ${formatMoney(calculation.totals.totalCifBrl)}`} />
            <SummaryRow label="II" value={`R$ ${formatMoney(calculation.totals.totalIiBrl)}`} />
            <SummaryRow label="IPI" value={`R$ ${formatMoney(calculation.totals.totalIpiBrl)}`} />
            <SummaryRow label="PIS" value={`R$ ${formatMoney(calculation.totals.totalPisBrl)}`} />
            <SummaryRow label="COFINS" value={`R$ ${formatMoney(calculation.totals.totalCofinsBrl)}`} />
            <SummaryRow label="ICMS" value={`R$ ${formatMoney(calculation.totals.totalIcmsBrl)}`} />
            <SummaryRow label="Despesas base" value={`R$ ${formatMoney(calculation.totals.totalBaseExpensesBrl)}`} />
            <SummaryRow label="Despesas finais" value={`R$ ${formatMoney(calculation.totals.totalFinalExpensesBrl)}`} />
            <SummaryRow label="Custo importação" value={`R$ ${formatMoney(calculation.totals.totalImportCostBrl)}`} />
            <SummaryRow label="Custo final processo" value={`R$ ${formatMoney(calculation.totals.totalLandedCostBrl)}`} />
          </OperationalPanel>

          <OperationalPanel title="Como preencher" icon={<FileSpreadsheet className="h-5 w-5" />} description="A próxima etapa é gerar a planilha final no formato operacional da LHFEX.">
            <ul className="space-y-3 text-sm text-[var(--app-muted)]">
              <li>1. Feche câmbio, frete total e ICMS em Parâmetros.</li>
              <li>2. Cadastre cada item da invoice com FOB USD e peso líquido.</li>
              <li>3. Lance em Despesas na base apenas o que compõe a base do ICMS.</li>
              <li>4. Lance em Despesas finais os custos operacionais que vão para o cliente.</li>
              <li>5. Revise o Resumo por NCM antes do fechamento final.</li>
            </ul>
          </OperationalPanel>
        </div>
      </div>
    </div>
  );
}

function ExpensePanel({ title, description, items, kind }: { title: string; description: string; items: Array<typeof processTaxExpenses.$inferSelect>; kind: ExpenseKind }) {
  return (
    <OperationalPanel title={title} icon={<Receipt className="h-5 w-5" />} description={description}>
      <Form method="post" className="grid gap-3 md:grid-cols-12">
        <input type="hidden" name="intent" value="add-expense" /><input type="hidden" name="kind" value={kind} />
        <S className="md:col-span-4" label="Descrição"><input name="label" className={fieldClassName} /></S>
        <S className="md:col-span-3" label="Valor (R$)"><input name="amountBrl" defaultValue="0" className={fieldClassName} /></S>
        <S className="md:col-span-3" label="Observações"><input name="notes" className={fieldClassName} /></S>
        <div className="md:col-span-2 flex items-end"><Button type="submit" className="w-full gap-2"><Plus className="h-4 w-4" />Adicionar</Button></div>
      </Form>
      <div className="space-y-3">{items.length === 0 ? <div className="rounded-[20px] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-5 text-sm text-[var(--app-muted)]">Nenhuma despesa registrada.</div> : items.map((expense) => <div key={expense.id} className="rounded-[20px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4"><Form method="post" className="grid gap-3 md:grid-cols-12"><input type="hidden" name="intent" value="save-expense" /><input type="hidden" name="expenseId" value={expense.id} /><S className="md:col-span-4" label="Descrição"><input name="label" defaultValue={expense.label} className={fieldClassName} /></S><S className="md:col-span-2" label="Tipo"><select name="kind" defaultValue={expense.kind} className={fieldClassName}><option value="tax_base">Base do ICMS</option><option value="final">Final do processo</option></select></S><S className="md:col-span-2" label="Valor (R$)"><input name="amountBrl" defaultValue={expense.amountBrl ?? "0"} className={fieldClassName} /></S><S className="md:col-span-3" label="Observações"><input name="notes" defaultValue={expense.notes ?? ""} className={fieldClassName} /></S><div className="md:col-span-1 flex items-end"><Button type="submit" className="w-full gap-2"><Save className="h-4 w-4" />Salvar</Button></div></Form><Form method="post" className="mt-3 flex justify-end"><input type="hidden" name="intent" value="delete-expense" /><input type="hidden" name="expenseId" value={expense.id} /><Button type="submit" variant="outline" className="gap-2 text-red-200"><Trash2 className="h-4 w-4" />Excluir</Button></Form></div>)}</div>
    </OperationalPanel>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 rounded-[18px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm"><span className="text-[var(--app-muted)]">{label}</span><span className="text-right font-medium text-[var(--app-text)]">{value}</span></div>;
}

function L({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={className}><span className="mb-1.5 block text-sm font-medium text-[var(--app-text)]">{label}</span>{children}</label>;
}

function S({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={className}><span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--app-muted)]">{label}</span>{children}</label>;
}
