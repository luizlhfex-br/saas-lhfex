/**
 * OpenClaw Telegram Actions
 *
 * Handlers para ações diretas via Telegram:
 * - Cadastrar Pessoa (contato pessoal)
 * - Cadastrar Cliente LHFEX (CRM)
 * - Abrir Processo LHFEX (importação/exportação/serviços)
 *
 * Cada handler: parse NLP via IA → validação → insert DB → confirmação Telegram
 */

import { db } from "./db.server";
import { pessoas, clients, contacts, processes, processTimeline } from "../../drizzle/schema";
import { eq, isNull, ilike, or, and, count } from "drizzle-orm";
import {
  parsePessoaFromTelegram,
  parseClienteFromTelegram,
  parseProcessoFromTelegram,
  enrichCNPJ,
} from "./ai.server";

function normalizeCnpj(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 14) return "";
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function extractCnpjFromText(text: string): string {
  const m = text.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/);
  if (!m) return "";
  return normalizeCnpj(m[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: send Telegram message with Markdown retry
// ─────────────────────────────────────────────────────────────────────────────

async function sendTg(token: string, chatId: number, text: string, parseMode?: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok && parseMode) {
      // Retry sem formatação se Markdown falhar
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: text.replace(/[*_`\[]/g, "") }),
        signal: AbortSignal.timeout(10000),
      });
    }
  } catch (error) {
    console.error("[OpenClaw Actions] sendTg failed:", error);
    if (parseMode) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: text.replace(/[*_`\[]/g, "") }),
          signal: AbortSignal.timeout(10000),
        });
      } catch { /* silent */ }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Cadastrar Pessoa
// ─────────────────────────────────────────────────────────────────────────────

export async function handleCadastrarPessoa(text: string, chatId: number, botToken: string) {
  await sendTg(botToken, chatId, "⏳ Analisando dados da pessoa...");

  const fields = await parsePessoaFromTelegram(text);

  if (!fields.nomeCompleto) {
    await sendTg(botToken, chatId,
      `❌ *Nome não identificado.*\n\n` +
      `Informe pelo menos o nome completo. Exemplo:\n` +
      `\`/pessoa João Silva, CPF: 123.456.789-00, 31999990000, joao@gmail.com\``,
      "Markdown"
    );
    return;
  }

  const userId = process.env.OPENCLAW_USER_ID;
  if (!userId) {
    await sendTg(botToken, chatId, "❌ OPENCLAW\\_USER\\_ID não configurado no servidor.", "Markdown");
    return;
  }

  try {
    await db.insert(pessoas).values({
      userId,
      nomeCompleto: fields.nomeCompleto as string,
      cpf: fields.cpf ?? null,
      rg: fields.rg ?? null,
      nascimento: fields.nascimento ?? null,
      celular: fields.celular ?? null,
      email: fields.email ?? null,
      instagram: fields.instagram ?? null,
      endereco: fields.endereco ?? null,
      notas: fields.notas ?? null,
      senhas: null,
    });

    const linhas = [
      `✅ *${fields.nomeCompleto}* cadastrada!`,
      fields.cpf ? `🪪 CPF: ${fields.cpf}` : null,
      fields.celular ? `📱 ${fields.celular}` : null,
      fields.email ? `📧 ${fields.email}` : null,
      fields.instagram ? `📷 @${fields.instagram}` : null,
      `\nVer em: saas.lhfex.com.br/personal-life/promotions`,
    ].filter(Boolean).join("\n");

    await sendTg(botToken, chatId, linhas, "Markdown");
  } catch (error) {
    console.error("[OpenClaw Actions] handleCadastrarPessoa error:", error);
    await sendTg(botToken, chatId, "❌ Erro ao cadastrar pessoa. Verifique os dados e tente novamente.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Cadastrar Cliente LHFEX
// ─────────────────────────────────────────────────────────────────────────────

export async function handleNovoCliente(text: string, chatId: number, botToken: string) {
  await sendTg(botToken, chatId, "⏳ Analisando dados do cliente...");

  const fields = await parseClienteFromTelegram(text);
  const extractedCnpj = extractCnpjFromText(text);
  const cnpj = normalizeCnpj(((fields.cnpj as string | null) ?? extractedCnpj) || "");
  let razaoSocial = (fields.razaoSocial as string | undefined)?.trim() || "";
  let nomeFantasia = (fields.nomeFantasia as string | null) ?? null;
  let city = (fields.city as string | null) ?? null;
  let state = (fields.state as string | null) ?? null;
  let notes = (fields.notes as string | null) ?? null;

  if (!razaoSocial && cnpj) {
    try {
      const enriched = await enrichCNPJ(cnpj);
      if (enriched) {
        razaoSocial = enriched.razaoSocial || razaoSocial;
        nomeFantasia = nomeFantasia || enriched.nomeFantasia || null;
        city = city || enriched.city || null;
        state = state || enriched.state || null;
        notes = notes || (enriched.situacao ? `Situação cadastral: ${enriched.situacao}` : null);
      }
    } catch (error) {
      console.error("[OpenClaw Actions] CNPJ enrichment failed:", error);
    }
  }

  if (!razaoSocial) {
    await sendTg(botToken, chatId,
      `❌ *Não consegui identificar os dados para cadastro.*\n\n` +
      `Envie ao menos um CNPJ válido ou razão social. Exemplo:\n` +
      `\`/cliente 03.954.434/0001-19\``,
      "Markdown"
    );
    return;
  }

  const userId = process.env.OPENCLAW_USER_ID;
  const contact = (fields.contact as Record<string, string> | null) ?? {};

  // Verifica CNPJ duplicado
  if (cnpj) {
    const existing = await db.select({ id: clients.id, razaoSocial: clients.razaoSocial })
      .from(clients)
      .where(and(eq(clients.cnpj, cnpj), isNull(clients.deletedAt)))
      .limit(1);

    if (existing.length > 0) {
      await sendTg(botToken, chatId,
        `⚠️ CNPJ *${cnpj}* já cadastrado:\n*${existing[0].razaoSocial}*\n\nVer em: saas.lhfex.com.br/crm/${existing[0].id}`,
        "Markdown"
      );
      return;
    }
  }

  try {
    const clientType = (fields.clientType as "importer" | "exporter" | "both") || "importer";

    const [newClient] = await db.insert(clients).values({
      cnpj: cnpj || "00.000.000/0000-00",
      razaoSocial,
      nomeFantasia,
      clientType,
      city,
      state,
      notes,
      status: "active",
      createdBy: userId ?? null,
    }).returning();

    // Insere contato principal
    if (contact.name) {
      await db.insert(contacts).values({
        clientId: newClient.id,
        name: contact.name,
        role: contact.role ?? null,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        isPrimary: true,
      });
    }

    const linhas = [
      `✅ Cliente *${newClient.razaoSocial}* cadastrado!`,
      cnpj ? `🏢 CNPJ: ${cnpj}` : null,
      contact.name ? `👤 Contato: ${contact.name}${contact.phone ? ` — ${contact.phone}` : ""}` : null,
      `\nVer em: saas.lhfex.com.br/crm/${newClient.id}`,
    ].filter(Boolean).join("\n");

    await sendTg(botToken, chatId, linhas, "Markdown");
  } catch (error) {
    console.error("[OpenClaw Actions] handleNovoCliente error:", error);
    await sendTg(botToken, chatId, "❌ Erro ao cadastrar cliente. Verifique os dados e tente novamente.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Abrir Processo LHFEX
// ─────────────────────────────────────────────────────────────────────────────

export async function handleAbrirProcesso(text: string, chatId: number, botToken: string) {
  await sendTg(botToken, chatId, "⏳ Analisando dados do processo...");

  const fields = await parseProcessoFromTelegram(text);

  if (!fields.clientSearch) {
    await sendTg(botToken, chatId,
      `❌ *Cliente não identificado.*\n\n` +
      `Informe o cliente. Exemplo:\n` +
      `\`/processo importação, cliente: Empresa ABC, produto: têxteis, USD 50.000\``,
      "Markdown"
    );
    return;
  }

  const search = fields.clientSearch as string;

  // Busca cliente por nome ou CNPJ
  const found = await db.select({
    id: clients.id,
    razaoSocial: clients.razaoSocial,
    cnpj: clients.cnpj,
  })
    .from(clients)
    .where(and(
      isNull(clients.deletedAt),
      or(
        ilike(clients.razaoSocial, `%${search}%`),
        ilike(clients.nomeFantasia, `%${search}%`),
        ilike(clients.cnpj, `%${search}%`)
      )
    ))
    .limit(5);

  if (found.length === 0) {
    await sendTg(botToken, chatId,
      `❌ Cliente *"${search}"* não encontrado no CRM.\n\n` +
      `Cadastre primeiro com:\n\`/cliente CNPJ: ..., Razão Social: ...\``,
      "Markdown"
    );
    return;
  }

  if (found.length > 1) {
    const lista = found.map((c, i) => `${i + 1}. ${c.razaoSocial} — ${c.cnpj}`).join("\n");
    await sendTg(botToken, chatId,
      `⚠️ *${found.length} clientes encontrados para "${search}":*\n\n${lista}\n\nRepita o comando com o nome exato ou CNPJ completo.`,
      "Markdown"
    );
    return;
  }

  const client = found[0];
  const userId = process.env.OPENCLAW_USER_ID;
  const processType = (fields.processType as "import" | "export" | "services") || "import";

  // Gera referência única: IMP/EXP/SRV-ANO-NNNN
  const prefix = processType === "import" ? "IMP" : processType === "export" ? "EXP" : "SRV";
  const year = new Date().getFullYear();
  const [countResult] = await db.select({ total: count() }).from(processes);
  const nextNum = String((countResult?.total ?? 0) + 1).padStart(4, "0");
  const reference = `${prefix}-${year}-${nextNum}`;

  try {
    const [newProcess] = await db.insert(processes).values({
      reference,
      processType,
      clientId: client.id,
      status: "draft",
      description: (fields.description as string | null) ?? null,
      originCountry: (fields.originCountry as string | null) ?? null,
      destinationCountry: (fields.destinationCountry as string | null) ?? "Brasil",
      incoterm: (fields.incoterm as string | null) ?? null,
      totalValue: (fields.totalValue as string | null) ?? null,
      currency: (fields.currency as string | null) ?? "USD",
      hsCode: (fields.hsCode as string | null) ?? null,
      notes: (fields.notes as string | null) ?? null,
      requiresApproval: false,
      createdBy: userId ?? null,
    }).returning();

    await db.insert(processTimeline).values({
      processId: newProcess.id,
      status: "draft",
      title: "Processo criado via Telegram",
      description: `Referência ${reference} criada pelo OpenClaw`,
      createdBy: userId ?? null,
    });

    const typeLabel = processType === "import" ? "Importação" : processType === "export" ? "Exportação" : "Serviços";

    const linhas = [
      `✅ Processo *${reference}* aberto!`,
      `📋 Tipo: ${typeLabel}`,
      `🏢 Cliente: ${client.razaoSocial}`,
      fields.description ? `📦 ${fields.description}` : null,
      fields.totalValue ? `💰 ${fields.currency ?? "USD"} ${fields.totalValue}` : null,
      fields.incoterm ? `🚢 ${fields.incoterm}` : null,
      `📊 Status: Rascunho`,
      `\nVer em: saas.lhfex.com.br/processes/${newProcess.id}`,
    ].filter(Boolean).join("\n");

    await sendTg(botToken, chatId, linhas, "Markdown");
  } catch (error) {
    console.error("[OpenClaw Actions] handleAbrirProcesso error:", error);
    await sendTg(botToken, chatId, "❌ Erro ao abrir processo. Verifique os dados e tente novamente.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Cancelar Processo LHFEX (com justificativa)
// ─────────────────────────────────────────────────────────────────────────────

export async function handleCancelarProcesso(text: string, chatId: number, botToken: string) {
  const referenceMatch = text.match(/\b(?:IMP|EXP|SRV)-\d{4}-\d{4}\b/i);
  const reference = referenceMatch?.[0]?.toUpperCase() ?? "";

  const justificationMatch = text.match(/(?:justificativa|motivo)\s*[:\-]\s*(.+)$/i);
  let justification = (justificationMatch?.[1] ?? "").trim();

  if (!justification) {
    const cleaned = text
      .replace(/^\/cancelar(?:_processo)?\s*/i, "")
      .replace(/cancelar\s+processo\s*/i, "")
      .replace(reference, "")
      .replace(/^[-,:\s]+/, "")
      .trim();
    justification = cleaned;
  }

  if (!reference) {
    await sendTg(botToken, chatId,
      "❌ Não encontrei a referência do processo.\n\nUse: `/cancelar_processo IMP-2026-0001 motivo: cliente desistiu`",
      "Markdown"
    );
    return;
  }

  if (!justification) {
    await sendTg(botToken, chatId,
      "❌ Informe uma justificativa do cancelamento.\n\nExemplo: `/cancelar_processo IMP-2026-0001 motivo: documentação incompleta`",
      "Markdown"
    );
    return;
  }

  const [proc] = await db.select({
    id: processes.id,
    status: processes.status,
    reference: processes.reference,
  })
    .from(processes)
    .where(and(eq(processes.reference, reference), isNull(processes.deletedAt)))
    .limit(1);

  if (!proc) {
    await sendTg(botToken, chatId, `❌ Processo *${reference}* não encontrado.`, "Markdown");
    return;
  }

  if (proc.status === "cancelled") {
    await sendTg(botToken, chatId, `ℹ️ O processo *${reference}* já está cancelado.`, "Markdown");
    return;
  }

  if (proc.status === "completed") {
    await sendTg(botToken, chatId, `⚠️ Processo *${reference}* está concluído e não pode ser cancelado.`, "Markdown");
    return;
  }

  const userId = process.env.OPENCLAW_USER_ID;

  try {
    await db.update(processes)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(processes.id, proc.id));

    await db.insert(processTimeline).values({
      processId: proc.id,
      status: "cancelled",
      title: "Processo cancelado via Telegram",
      description: `Justificativa: ${justification}`,
      createdBy: userId ?? null,
    });

    await sendTg(botToken, chatId,
      `✅ Processo *${reference}* cancelado com sucesso.\n📝 Justificativa: ${justification}\n\nEle permanece no histórico como inativo.`,
      "Markdown"
    );
  } catch (error) {
    console.error("[OpenClaw Actions] handleCancelarProcesso error:", error);
    await sendTg(botToken, chatId, "❌ Erro ao cancelar processo. Tente novamente.");
  }
}
