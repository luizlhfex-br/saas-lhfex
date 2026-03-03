/**
 * GET /financial/fatura-print?invoiceId=:id
 *
 * Fatura de Cobrança — template profissional para impressão/PDF
 * Inclui branding LHFEX, itens, dados de pagamento Banco Inter
 */

import type { Route } from "./+types/financial-fatura-print";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { invoices, invoiceItems, clients, companyProfile, companyBankAccounts } from "../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import { Printer, ArrowLeft } from "lucide-react";
import { Link } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const invoiceId = url.searchParams.get("invoiceId");

  if (!invoiceId) {
    throw new Response("invoiceId required", { status: 400 });
  }

  const [invoiceResult, company, bankAccounts] = await Promise.all([
    db.select().from(invoices).where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt))).limit(1),
    db.select().from(companyProfile).limit(1),
    db.select().from(companyBankAccounts).limit(3),
  ]);

  if (invoiceResult.length === 0) {
    throw new Response("Not Found", { status: 404 });
  }

  const invoice = invoiceResult[0];

  const [clientResult, items] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, invoice.clientId)).limit(1),
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id)),
  ]);

  const client = clientResult[0] || null;
  const co = company[0] || null;

  return { invoice, client, items, company: co, bankAccounts };
}

function fmt(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (d) return `${d}/${m}/${y}`;
  // BCB format DD/MM/YYYY passthrough
  return iso;
}

export default function FaturaPrintPage({ loaderData }: Route.ComponentProps) {
  const { invoice, client, items, company, bankAccounts } = loaderData;

  // LHFEX defaults (hardcoded as fallback per plan)
  const razaoSocial = company?.razaoSocial || "FREITAS E FREITAS CONSULTORIA E SERVICOS LTDA";
  const cnpj = company?.cnpj || "62.180.992/0001-33";
  const addressLine = [company?.address, company?.city, company?.state].filter(Boolean).join(", ") || "Belo Horizonte — MG";
  const phone = company?.phone || "";
  const emailAddr = company?.email || "financeiro@lhfex.com.br";

  // Bank accounts — try to find Inter first
  const interBank = bankAccounts.find((b) => (b.bankName ?? "").toLowerCase().includes("inter")) || bankAccounts[0];

  // Invoice sequence number for display (use last chars of UUID if no sequential)
  const displayNumber = invoice.number;
  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <>
      {/* Screen toolbar */}
      <div className="print:hidden flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800">
        <Link
          to={`/financial/${invoice.id}`}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Printer className="h-4 w-4" />
          Imprimir / Salvar PDF
        </button>
        <span className="text-xs text-gray-400">Use "Salvar como PDF" no diálogo de impressão</span>
      </div>

      {/* ── FATURA ──────────────────────────────────────────────── */}
      <div
        id="fatura"
        className="mx-auto max-w-[800px] bg-white p-10 text-gray-900 print:max-w-full print:p-8"
        style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}
      >
        {/* ── HEADER ── */}
        <table width="100%" style={{ borderCollapse: "collapse", marginBottom: "24px" }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: "top", width: "120px" }}>
                <img
                  src="/images/logo-circle.png"
                  alt="LHFEX"
                  style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover" }}
                />
              </td>
              <td style={{ verticalAlign: "top", paddingLeft: "16px" }}>
                <div style={{ fontWeight: "bold", fontSize: "18px", letterSpacing: "1px" }}>
                  {razaoSocial}
                </div>
                <div style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
                  CNPJ: {cnpj}
                </div>
                <div style={{ fontSize: "12px", color: "#555" }}>{addressLine}</div>
                {phone && <div style={{ fontSize: "12px", color: "#555" }}>Tel: {phone}</div>}
                <div style={{ fontSize: "12px", color: "#555" }}>{emailAddr}</div>
              </td>
              <td style={{ verticalAlign: "top", textAlign: "right" }}>
                <div style={{
                  display: "inline-block",
                  background: "#1e3a5f",
                  color: "#fff",
                  padding: "8px 20px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                }}>
                  Fatura de Cobrança
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <hr style={{ borderColor: "#1e3a5f", borderWidth: "2px", margin: "0 0 20px" }} />

        {/* ── INVOICE META ── */}
        <table width="100%" style={{ borderCollapse: "collapse", marginBottom: "20px", fontSize: "13px" }}>
          <tbody>
            <tr>
              <td style={{ width: "50%", verticalAlign: "top" }}>
                <strong>Fatura Nº:</strong> {displayNumber}<br />
                <strong>Data de Emissão:</strong> {today}<br />
                <strong>Vencimento:</strong> <span style={{ color: "#dc2626" }}>{fmtDate(invoice.dueDate)}</span>
              </td>
              <td style={{ width: "50%", verticalAlign: "top", textAlign: "right" }}>
                <strong>Status:</strong>{" "}
                <span style={{
                  display: "inline-block",
                  padding: "2px 10px",
                  borderRadius: "12px",
                  background: invoice.status === "paid" ? "#dcfce7" : invoice.status === "overdue" ? "#fee2e2" : "#dbeafe",
                  color: invoice.status === "paid" ? "#166534" : invoice.status === "overdue" ? "#991b1b" : "#1e40af",
                  fontSize: "11px",
                  fontWeight: "bold",
                }}>
                  {invoice.status === "draft" ? "Rascunho"
                   : invoice.status === "sent" ? "Enviada"
                   : invoice.status === "paid" ? "Paga"
                   : invoice.status === "overdue" ? "Vencida"
                   : "Cancelada"}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── CLIENTE ── */}
        <div style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "20px",
          fontSize: "13px",
        }}>
          <div style={{ fontWeight: "bold", fontSize: "11px", textTransform: "uppercase", color: "#64748b", marginBottom: "8px" }}>
            Cobrar de
          </div>
          <div style={{ fontWeight: "bold", fontSize: "15px" }}>{client?.razaoSocial || "—"}</div>
          {client?.nomeFantasia && client.nomeFantasia !== client.razaoSocial && (
            <div style={{ fontSize: "12px", color: "#555" }}>{client.nomeFantasia}</div>
          )}
          {client?.cnpj && <div style={{ fontSize: "12px", color: "#555" }}>CNPJ: {client.cnpj}</div>}
          {client?.email && <div style={{ fontSize: "12px", color: "#555" }}>E-mail: {client.email}</div>}
          {client?.phone && <div style={{ fontSize: "12px", color: "#555" }}>Tel: {client.phone}</div>}
        </div>

        {/* ── DESCRIPTION ── */}
        {invoice.description && (
          <div style={{ marginBottom: "16px", fontSize: "13px" }}>
            <strong>Referência:</strong> {invoice.description}
          </div>
        )}

        {/* ── ITENS ── */}
        <table width="100%" style={{ borderCollapse: "collapse", marginBottom: "20px", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#1e3a5f", color: "#fff" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "bold" }}>Descrição</th>
              <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "bold", width: "80px" }}>Qtd</th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "bold", width: "120px" }}>Valor Unit.</th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "bold", width: "120px" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? items.map((item, i) => (
              <tr key={item.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>{item.description}</td>
                <td style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>
                  {parseFloat(item.quantity || "1").toLocaleString("pt-BR")}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>
                  R$ {fmt(item.unitPrice)}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "bold" }}>
                  R$ {fmt(item.total)}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>
                  {invoice.description || "Serviços de consultoria"}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            {parseFloat(invoice.taxes || "0") > 0 && (
              <tr>
                <td colSpan={3} style={{ padding: "8px 12px", textAlign: "right", color: "#555" }}>Impostos</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "#555" }}>R$ {fmt(invoice.taxes || "0")}</td>
              </tr>
            )}
            <tr style={{ background: "#f0f4f8" }}>
              <td colSpan={3} style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "15px" }}>
                TOTAL
              </td>
              <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "18px", color: "#1e3a5f" }}>
                R$ {fmt(invoice.total)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ── DADOS PARA PAGAMENTO ── */}
        <div style={{
          border: "2px solid #1e3a5f",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "20px",
          fontSize: "13px",
        }}>
          <div style={{ fontWeight: "bold", fontSize: "11px", textTransform: "uppercase", color: "#1e3a5f", marginBottom: "12px", letterSpacing: "1px" }}>
            Dados para Pagamento
          </div>

          {/* Inter Bank data */}
          {interBank ? (
            <table width="100%" style={{ borderCollapse: "collapse", fontSize: "13px" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 8px", width: "35%", color: "#555", fontWeight: "bold" }}>Banco</td>
                  <td style={{ padding: "4px 8px" }}>{interBank.bankName || "Banco Inter"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", color: "#555", fontWeight: "bold" }}>Agência</td>
                  <td style={{ padding: "4px 8px" }}>{interBank.bankAgency || "0001"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", color: "#555", fontWeight: "bold" }}>Conta Corrente</td>
                  <td style={{ padding: "4px 8px" }}>{interBank.bankAccount || "49691119-8"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", color: "#555", fontWeight: "bold" }}>Titular</td>
                  <td style={{ padding: "4px 8px" }}>{razaoSocial}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", color: "#555", fontWeight: "bold" }}>CNPJ</td>
                  <td style={{ padding: "4px 8px" }}>{cnpj}</td>
                </tr>
                {(interBank.bankPix || cnpj) && (
                  <tr>
                    <td style={{ padding: "4px 8px", color: "#555", fontWeight: "bold" }}>PIX</td>
                    <td style={{ padding: "4px 8px", fontWeight: "bold", color: "#1e3a5f" }}>
                      {interBank.bankPix || cnpj} (CNPJ)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table width="100%" style={{ borderCollapse: "collapse", fontSize: "13px" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 8px", width: "35%", color: "#555", fontWeight: "bold" }}>Banco</td>
                  <td style={{ padding: "4px 8px" }}>Banco Inter (077)</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", color: "#555", fontWeight: "bold" }}>Agência</td>
                  <td style={{ padding: "4px 8px" }}>0001</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", color: "#555", fontWeight: "bold" }}>Conta Corrente</td>
                  <td style={{ padding: "4px 8px" }}>49691119-8</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", color: "#555", fontWeight: "bold" }}>Titular</td>
                  <td style={{ padding: "4px 8px" }}>{razaoSocial}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", color: "#555", fontWeight: "bold" }}>CNPJ</td>
                  <td style={{ padding: "4px 8px" }}>{cnpj}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", color: "#555", fontWeight: "bold" }}>PIX</td>
                  <td style={{ padding: "4px 8px", fontWeight: "bold", color: "#1e3a5f" }}>
                    {cnpj} (CNPJ)
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          <div style={{ marginTop: "12px", fontSize: "12px", color: "#dc2626", fontWeight: "bold" }}>
            ⚠️ Prazo: 10 dias corridos a partir da data de emissão.
          </div>
        </div>

        {/* ── CONTACT / FOOTER ── */}
        <div style={{
          background: "#f8fafc",
          borderTop: "2px solid #e2e8f0",
          padding: "12px 16px",
          fontSize: "12px",
          color: "#555",
        }}>
          <strong>Dúvidas:</strong> {emailAddr}
          {phone && <> &nbsp;|&nbsp; <strong>Tel/WhatsApp:</strong> {phone}</>}
          <span style={{ float: "right", color: "#94a3b8" }}>
            Emitida em: {today} &nbsp;|&nbsp; {razaoSocial}
          </span>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; margin: 0; }
          .print\\:hidden { display: none !important; }
          #fatura {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 1.5cm !important;
            box-shadow: none !important;
          }
          @page {
            margin: 1cm;
            size: A4;
          }
        }
      `}</style>
    </>
  );
}
