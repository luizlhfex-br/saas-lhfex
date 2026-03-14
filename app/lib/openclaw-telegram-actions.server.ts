/**
 * OpenClaw Telegram Actions
 *
 * Handlers para acoes diretas via Telegram:
 * - Cadastrar pessoa
 * - Cadastrar cliente no CRM
 * - Abrir processo
 * - Cancelar processo
 */

import { and, eq, isNull } from "drizzle-orm";
import { pessoas, processTimeline, processes } from "../../drizzle/schema";
import {
  parsePessoaFromTelegram,
  parseClienteFromTelegram,
  parseProcessoFromTelegram,
} from "./ai.server";
import { db } from "./db.server";
import {
  OpenClawActionError,
  createClientFromOpenClaw,
  extractCnpjFromText,
  getProcessTypeLabel,
  openProcessFromOpenClaw,
} from "./openclaw-saas-actions.server";
import { getPrimaryCompanyId } from "./company-context.server";

async function getOpenClawContext() {
  const userId = process.env.OPENCLAW_USER_ID;
  if (!userId) {
    throw new Error("OPENCLAW_USER_ID not configured");
  }

  const companyId = await getPrimaryCompanyId(userId);
  return { userId, companyId };
}

async function sendTg(token: string, chatId: number, text: string, parseMode?: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok && parseMode) {
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
      } catch {
        // noop
      }
    }
  }
}

export async function handleCadastrarPessoa(text: string, chatId: number, botToken: string) {
  await sendTg(botToken, chatId, "⏳ Analisando dados da pessoa...");

  const fields = await parsePessoaFromTelegram(text);
  if (!fields.nomeCompleto) {
    await sendTg(
      botToken,
      chatId,
      "❌ *Nome nao identificado.*\n\nInforme pelo menos o nome completo. Exemplo:\n`/pessoa Joao Silva, CPF: 123.456.789-00, 31999990000, joao@gmail.com`",
      "Markdown",
    );
    return;
  }

  const userId = process.env.OPENCLAW_USER_ID;
  if (!userId) {
    await sendTg(botToken, chatId, "❌ OPENCLAW_USER_ID nao configurado no servidor.");
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
      "\nVer em: saas.lhfex.com.br/personal-life/promotions",
    ].filter(Boolean).join("\n");

    await sendTg(botToken, chatId, linhas, "Markdown");
  } catch (error) {
    console.error("[OpenClaw Actions] handleCadastrarPessoa error:", error);
    await sendTg(botToken, chatId, "❌ Erro ao cadastrar pessoa. Verifique os dados e tente novamente.");
  }
}

export async function handleNovoCliente(text: string, chatId: number, botToken: string) {
  await sendTg(botToken, chatId, "⏳ Analisando dados do cliente...");

  const fields = await parseClienteFromTelegram(text);
  const extractedCnpj = extractCnpjFromText(text);
  const { userId, companyId } = await getOpenClawContext();

  try {
    const result = await createClientFromOpenClaw({
      companyId,
      userId,
      input: {
        ...fields,
        cnpj: (fields.cnpj as string | null) ?? extractedCnpj,
      },
    });

    const linhas = [
      `✅ Cliente *${result.razaoSocial}* cadastrado!`,
      result.cnpj ? `🏢 CNPJ: ${result.cnpj}` : null,
      result.enrichedFromCnpj ? "🟣 Dados cadastrais preenchidos automaticamente pelo CNPJ" : null,
      `\nVer em: saas.lhfex.com.br/crm/${result.clientId}`,
    ].filter(Boolean).join("\n");

    await sendTg(botToken, chatId, linhas, "Markdown");
  } catch (error) {
    if (error instanceof OpenClawActionError) {
      if (error.code === "duplicate_client_cnpj") {
        await sendTg(
          botToken,
          chatId,
          `⚠️ CNPJ *${extractedCnpj || "informado"}* ja cadastrado:\n*${String(error.details?.razaoSocial || "")}*\n\nVer em: saas.lhfex.com.br/crm/${String(error.details?.clientId || "")}`,
          "Markdown",
        );
        return;
      }

      if (error.code === "missing_client_identity") {
        await sendTg(
          botToken,
          chatId,
          "❌ *Nao consegui identificar os dados para cadastro.*\n\nEnvie ao menos um CNPJ valido ou razao social. Exemplo:\n`/cliente 03.954.434/0001-19`",
          "Markdown",
        );
        return;
      }
    }

    console.error("[OpenClaw Actions] handleNovoCliente error:", error);
    await sendTg(botToken, chatId, "❌ Erro ao cadastrar cliente. Verifique os dados e tente novamente.");
  }
}

export async function handleAbrirProcesso(text: string, chatId: number, botToken: string) {
  await sendTg(botToken, chatId, "⏳ Analisando dados do processo...");

  const fields = await parseProcessoFromTelegram(text);
  if (!fields.clientSearch) {
    await sendTg(
      botToken,
      chatId,
      "❌ *Cliente nao identificado.*\n\nInforme o cliente. Exemplo:\n`/processo importacao, cliente: Empresa ABC, produto: texteis, USD 50.000`",
      "Markdown",
    );
    return;
  }

  const { userId, companyId } = await getOpenClawContext();

  try {
    const result = await openProcessFromOpenClaw({
      companyId,
      userId,
      input: {
        ...fields,
        sourceText: text,
      },
    });

    const linhas = [
      `✅ Processo *${result.reference}* aberto!`,
      `📋 Tipo: ${getProcessTypeLabel(result.processType)}`,
      `🏢 Cliente: ${result.clientName}`,
      fields.description ? `📦 ${fields.description}` : null,
      fields.totalValue ? `💰 ${fields.currency ?? "USD"} ${fields.totalValue}` : null,
      fields.incoterm ? `🚢 ${fields.incoterm}` : null,
      "📊 Status: Rascunho",
      `\nVer em: saas.lhfex.com.br/processes/${result.processId}`,
    ].filter(Boolean).join("\n");

    await sendTg(botToken, chatId, linhas, "Markdown");
  } catch (error) {
    if (error instanceof OpenClawActionError) {
      if (error.code === "client_not_found") {
        await sendTg(
          botToken,
          chatId,
          `❌ Cliente *"${String(fields.clientSearch)}"* nao encontrado no CRM.\n\nCadastre primeiro com:\n\`/cliente 03.954.434/0001-19\``,
          "Markdown",
        );
        return;
      }

      if (error.code === "client_ambiguous") {
        const matches = Array.isArray(error.details?.matches)
          ? (error.details.matches as Array<Record<string, unknown>>)
          : [];
        const lista = matches
          .map((client, index) => `${index + 1}. ${String(client.razaoSocial)} - ${String(client.cnpj)}`)
          .join("\n");

        await sendTg(
          botToken,
          chatId,
          `⚠️ *${matches.length} clientes encontrados para "${String(fields.clientSearch)}":*\n\n${lista}\n\nRepita o comando com o nome exato ou CNPJ completo.`,
          "Markdown",
        );
        return;
      }
    }

    console.error("[OpenClaw Actions] handleAbrirProcesso error:", error);
    await sendTg(botToken, chatId, "❌ Erro ao abrir processo. Verifique os dados e tente novamente.");
  }
}

export async function handleCancelarProcesso(text: string, chatId: number, botToken: string) {
  const referenceMatch = text.match(/\b(?:[AMC]\d{2}-\d{3}|(?:IMP|EXP|SRV)-\d{4}-\d{4})\b/i);
  const reference = referenceMatch?.[0]?.toUpperCase() ?? "";
  const { userId, companyId } = await getOpenClawContext();

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
    await sendTg(
      botToken,
      chatId,
      "❌ Nao encontrei a referencia do processo.\n\nUse: `/cancelar_processo A26-001 motivo: cliente desistiu`",
      "Markdown",
    );
    return;
  }

  if (!justification) {
    await sendTg(
      botToken,
      chatId,
      "❌ Informe uma justificativa do cancelamento.\n\nExemplo: `/cancelar_processo A26-001 motivo: documentacao incompleta`",
      "Markdown",
    );
    return;
  }

  const [process] = await db
    .select({
      id: processes.id,
      status: processes.status,
      reference: processes.reference,
    })
    .from(processes)
    .where(and(eq(processes.companyId, companyId), eq(processes.reference, reference), isNull(processes.deletedAt)))
    .limit(1);

  if (!process) {
    await sendTg(botToken, chatId, `❌ Processo *${reference}* nao encontrado.`, "Markdown");
    return;
  }

  if (process.status === "cancelled") {
    await sendTg(botToken, chatId, `ℹ️ O processo *${reference}* ja esta cancelado.`, "Markdown");
    return;
  }

  if (process.status === "completed") {
    await sendTg(botToken, chatId, `⚠️ Processo *${reference}* esta concluido e nao pode ser cancelado.`, "Markdown");
    return;
  }

  try {
    await db
      .update(processes)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(processes.id, process.id));

    await db.insert(processTimeline).values({
      processId: process.id,
      status: "cancelled",
      title: "Processo cancelado via Telegram",
      description: `Justificativa: ${justification}`,
      createdBy: userId,
    });

    await sendTg(
      botToken,
      chatId,
      `✅ Processo *${reference}* cancelado com sucesso.\n📝 Justificativa: ${justification}\n\nEle permanece no historico como inativo.`,
      "Markdown",
    );
  } catch (error) {
    console.error("[OpenClaw Actions] handleCancelarProcesso error:", error);
    await sendTg(botToken, chatId, "❌ Erro ao cancelar processo. Tente novamente.");
  }
}
