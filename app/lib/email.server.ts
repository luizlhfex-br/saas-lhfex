import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.titan.email",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

const FROM = process.env.SMTP_FROM || "LHFEX <noreply@lhfex.com.br>";
const APP_URL = process.env.APP_URL || "https://saas.lhfex.com.br";

function baseTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr><td style="background:#1e40af;padding:24px 32px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">LHFEX</h1>
          <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">Comércio Exterior Inteligente</p>
        </td></tr>
        <!-- Title -->
        <tr><td style="padding:32px 32px 16px;">
          <h2 style="color:#111827;margin:0;font-size:20px;">${title}</h2>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:0 32px 32px;color:#374151;font-size:14px;line-height:1.6;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;margin:0;font-size:12px;">
            Este email foi enviado automaticamente pelo sistema LHFEX.<br>
            <a href="${APP_URL}" style="color:#2563eb;">saas.lhfex.com.br</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`[EMAIL] Sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL] Failed to send to ${to}:`, error);
    return false;
  }
}

export async function sendProcessStatusUpdate(params: {
  to: string;
  processRef: string;
  oldStatus: string;
  newStatus: string;
  clientName: string;
}): Promise<boolean> {
  const { to, processRef, oldStatus, newStatus, clientName } = params;

  const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    in_progress: "Em Andamento",
    awaiting_docs: "Aguardando Documentos",
    customs_clearance: "Desembaraço Aduaneiro",
    in_transit: "Em Trânsito",
    delivered: "Entregue",
    completed: "Concluído",
    cancelled: "Cancelado",
  };

  const body = `
    <p>O processo <strong>${processRef}</strong> do cliente <strong>${clientName}</strong> teve uma atualização de status:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding:12px;background:#fef2f2;border-radius:8px 0 0 8px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#991b1b;">Status anterior</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:bold;color:#dc2626;">${statusLabels[oldStatus] || oldStatus}</p>
        </td>
        <td style="padding:12px;text-align:center;font-size:20px;color:#6b7280;">→</td>
        <td style="padding:12px;background:#f0fdf4;border-radius:0 8px 8px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#166534;">Novo status</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:bold;color:#16a34a;">${statusLabels[newStatus] || newStatus}</p>
        </td>
      </tr>
    </table>
    <p><a href="${APP_URL}/processes" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Ver Processo</a></p>
  `;

  return sendEmail({
    to,
    subject: `[LHFEX] Processo ${processRef} - Status atualizado para ${statusLabels[newStatus] || newStatus}`,
    html: baseTemplate("Atualização de Processo", body),
  });
}

export async function sendInvoiceDueReminder(params: {
  to: string;
  invoiceNumber: string;
  clientName: string;
  total: string;
  currency: string;
  dueDate: string;
}): Promise<boolean> {
  const { to, invoiceNumber, clientName, total, currency, dueDate } = params;

  const body = `
    <p>Este é um lembrete de que a fatura abaixo está próxima do vencimento:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;">
      <tr><td style="padding:12px;border-bottom:1px solid #e5e7eb;font-weight:bold;width:40%;">Fatura</td><td style="padding:12px;border-bottom:1px solid #e5e7eb;">${invoiceNumber}</td></tr>
      <tr><td style="padding:12px;border-bottom:1px solid #e5e7eb;font-weight:bold;">Cliente</td><td style="padding:12px;border-bottom:1px solid #e5e7eb;">${clientName}</td></tr>
      <tr><td style="padding:12px;border-bottom:1px solid #e5e7eb;font-weight:bold;">Valor</td><td style="padding:12px;border-bottom:1px solid #e5e7eb;">${currency} ${total}</td></tr>
      <tr><td style="padding:12px;font-weight:bold;">Vencimento</td><td style="padding:12px;color:#dc2626;font-weight:bold;">${dueDate}</td></tr>
    </table>
    <p><a href="${APP_URL}/financial" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Ver Financeiro</a></p>
  `;

  return sendEmail({
    to,
    subject: `[LHFEX] Fatura ${invoiceNumber} - Vencimento em ${dueDate}`,
    html: baseTemplate("Lembrete de Vencimento", body),
  });
}

export async function sendInvoiceEmail(params: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  invoiceId: string;
  total: string;
  currency: string;
  dueDate: string;
  items?: Array<{ description: string; total: string }>;
  companyName?: string;
  companyCnpj?: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  pixKey?: string;
}): Promise<boolean> {
  const {
    to, clientName, invoiceNumber, invoiceId, total, currency, dueDate, items = [],
    companyName = "FREITAS E FREITAS CONSULTORIA E SERVICOS LTDA",
    companyCnpj = "62.180.992/0001-33",
    bankName = "Banco Inter (077)",
    bankAgency = "0001",
    bankAccount = "49691119-8",
    pixKey,
  } = params;

  const viewUrl = `${APP_URL}/financial/fatura-print?invoiceId=${invoiceId}`;
  const pixDisplay = pixKey || companyCnpj;

  const itemsHtml = items.length > 0
    ? `<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">
        <thead>
          <tr style="background:#1e3a5f;color:#fff;">
            <th style="padding:8px 12px;text-align:left;">Descrição</th>
            <th style="padding:8px 12px;text-align:right;width:120px;">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, i) => `
            <tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"};">
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${it.description}</td>
              <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #e2e8f0;">R$ ${it.total}</td>
            </tr>`).join("")}
        </tbody>
      </table>`
    : "";

  const body = `
    <p>Olá, <strong>${clientName}</strong>!</p>
    <p>Segue a fatura de cobrança referente aos serviços prestados pela <strong>${companyName}</strong>.</p>

    <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;">
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:bold;width:40%;background:#f8fafc;">Fatura Nº</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;"><strong>${invoiceNumber}</strong></td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:bold;background:#f8fafc;">Valor Total</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:18px;font-weight:bold;color:#1e3a5f;">${currency} ${total}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:bold;background:#f8fafc;">Vencimento</td><td style="padding:10px 14px;color:#dc2626;font-weight:bold;">${dueDate}</td></tr>
    </table>

    ${itemsHtml}

    <h3 style="margin:20px 0 12px;font-size:14px;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;">Dados para Pagamento</h3>

    <table style="width:100%;border-collapse:collapse;border:2px solid #1e3a5f;border-radius:8px;font-size:13px;">
      <tr><td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;color:#555;font-weight:bold;width:35%;background:#f8fafc;">Banco</td><td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;">${bankName}</td></tr>
      <tr><td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;color:#555;font-weight:bold;background:#f8fafc;">Agência</td><td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;">${bankAgency}</td></tr>
      <tr><td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;color:#555;font-weight:bold;background:#f8fafc;">Conta Corrente</td><td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;">${bankAccount}</td></tr>
      <tr><td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;color:#555;font-weight:bold;background:#f8fafc;">Titular</td><td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;">${companyName}</td></tr>
      <tr><td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;color:#555;font-weight:bold;background:#f8fafc;">CNPJ</td><td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;">${companyCnpj}</td></tr>
      <tr><td style="padding:8px 14px;color:#555;font-weight:bold;background:#f8fafc;">PIX</td><td style="padding:8px 14px;font-weight:bold;color:#1e3a5f;">${pixDisplay} (CNPJ)</td></tr>
    </table>

    <p style="margin-top:12px;color:#dc2626;font-size:13px;font-weight:bold;">⚠️ Prazo: 10 dias corridos a partir da data de emissão.</p>

    <p style="margin-top:20px;">
      <a href="${viewUrl}" style="display:inline-block;background:#1e3a5f;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">
        📄 Visualizar Fatura Completa
      </a>
    </p>

    <p style="margin-top:16px;font-size:12px;color:#9ca3af;">
      Dúvidas? Responda este email ou acesse <a href="${APP_URL}" style="color:#2563eb;">saas.lhfex.com.br</a>
    </p>
  `;

  return sendEmail({
    to,
    subject: `Fatura de Cobrança ${invoiceNumber} — ${companyName}`,
    html: baseTemplate(`Fatura de Cobrança Nº ${invoiceNumber}`, body),
  });
}

export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
}): Promise<boolean> {
  const { to, name } = params;

  const body = `
    <p>Olá, <strong>${name}</strong>!</p>
    <p>Bem-vindo ao sistema LHFEX. Sua conta foi criada com sucesso.</p>
    <p>Acesse o sistema para gerenciar seus processos de comércio exterior:</p>
    <p><a href="${APP_URL}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Acessar LHFEX</a></p>
  `;

  return sendEmail({
    to,
    subject: "[LHFEX] Bem-vindo ao sistema",
    html: baseTemplate("Bem-vindo ao LHFEX", body),
  });
}
