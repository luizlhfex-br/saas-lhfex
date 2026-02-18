import { Link } from "react-router";
import type { Route } from "./+types/financial-receipt";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { invoices, clients } from "drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import { Printer, ArrowLeft } from "lucide-react";

// Helper: convert number to words in BRL (simplified)
function numberToWords(value: number): string {
  const intPart = Math.floor(value);
  const centPart = Math.round((value - intPart) * 100);
  const ones = ["", "um", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function toWords(n: number): string {
    if (n === 0) return "zero";
    if (n === 100) return "cem";
    if (n <= 19) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " e " + ones[n % 10] : "");
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return hundreds[h] + (rest ? " e " + toWords(rest) : "");
  }

  function bigToWords(n: number): string {
    if (n < 1000) return toWords(n);
    if (n < 1000000) {
      const thousands = Math.floor(n / 1000);
      const rest = n % 1000;
      const tStr = thousands === 1 ? "mil" : toWords(thousands) + " mil";
      return tStr + (rest ? " e " + toWords(rest) : "");
    }
    return n.toString();
  }

  const intWords = bigToWords(intPart);
  const reaisWord = intPart === 1 ? "real" : "reais";
  if (centPart === 0) return `${intWords} ${reaisWord}`;
  const centWords = toWords(centPart);
  const centavosWord = centPart === 1 ? "centavo" : "centavos";
  return `${intWords} ${reaisWord} e ${centWords} ${centavosWord}`;
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const invoiceId = url.searchParams.get("invoiceId");

  if (!invoiceId) {
    throw new Response("Invoice ID required", { status: 400 });
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1);

  if (!invoice) {
    throw new Response("Invoice not found", { status: 404 });
  }

  const [client] = await db
    .select({ razaoSocial: clients.razaoSocial, cnpj: clients.cnpj })
    .from(clients)
    .where(eq(clients.id, invoice.clientId))
    .limit(1);

  return { invoice, client };
}

export default function FinancialReceiptPage({ loaderData }: Route.ComponentProps) {
  const { invoice, client } = loaderData;
  const amount = parseFloat(invoice.paidAmount || invoice.total);
  const amountWords = numberToWords(amount);
  const receiptNumber = `REC-${invoice.number}`;
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <>
      {/* Print controls — hidden when printing */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          to="/financial"
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Financeiro
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Printer className="h-4 w-4" />
          Imprimir Recibo
        </button>
      </div>

      {/* Receipt — visible on screen and when printing */}
      <div
        id="receipt"
        className="mx-auto max-w-2xl rounded-xl border border-gray-300 bg-white p-10 shadow-lg dark:border-gray-700 dark:bg-white print:border-gray-300 print:shadow-none"
        style={{ fontFamily: "Georgia, serif", color: "#111" }}
      >
        {/* Header */}
        <div className="mb-8 border-b-2 border-gray-800 pb-4 text-center">
          <h1 className="text-3xl font-bold uppercase tracking-widest text-gray-900">LHFEX</h1>
          <p className="mt-1 text-sm text-gray-600">Comercio Exterior e Consultoria</p>
          <p className="text-sm text-gray-600">contato@lhfex.com.br</p>
        </div>

        <h2 className="mb-6 text-center text-2xl font-bold uppercase tracking-widest text-gray-900">
          Recibo de Pagamento
        </h2>

        {/* Receipt number + Date */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-gray-500">Numero do Recibo</span>
            <p className="font-mono text-lg font-bold text-gray-900">{receiptNumber}</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold uppercase text-gray-500">Data</span>
            <p className="text-gray-900">{invoice.paidDate || today}</p>
          </div>
        </div>

        {/* Amount box */}
        <div className="mb-6 rounded-lg border-2 border-gray-800 p-4 text-center">
          <span className="block text-xs font-semibold uppercase text-gray-500 mb-1">Valor Recebido</span>
          <span className="text-4xl font-bold text-gray-900">
            R$ {amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <p className="mt-2 text-sm text-gray-600 italic">
            ({amountWords})
          </p>
        </div>

        {/* Body */}
        <div className="mb-6 space-y-3">
          <p className="text-gray-900">
            <strong>Recebi de:</strong>{" "}
            <span className="underline">{client?.razaoSocial || "—"}</span>
            {client?.cnpj && <span className="ml-2 text-sm text-gray-600">(CNPJ: {client.cnpj})</span>}
          </p>

          <p className="text-gray-900">
            <strong>Referencia:</strong>{" "}
            {invoice.description || invoice.number}
          </p>

          {invoice.notes && (
            <p className="text-gray-900">
              <strong>Observacoes:</strong> {invoice.notes}
            </p>
          )}

          <p className="text-gray-900">
            <strong>Fatura:</strong> {invoice.number}
          </p>
        </div>

        {/* Signature */}
        <div className="mt-16 flex flex-col items-center gap-2">
          <div className="w-64 border-t-2 border-gray-800" />
          <p className="text-center text-sm text-gray-700">
            LHFEX — Comercio Exterior e Consultoria
          </p>
          <p className="text-center text-xs text-gray-500">
            Assinatura e carimbo
          </p>
        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-gray-300 pt-4 text-center text-xs text-gray-400">
          <p>Este recibo e valido como documento comprobatorio de pagamento.</p>
          <p>Emitido em: {today}</p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          #receipt {
            max-width: 100% !important;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
