import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "./db.server";
import { enrichCNPJ } from "./ai.server";
import { formatCNPJ } from "./utils";
import { clients, contacts, processes, processTimeline } from "../../drizzle/schema";
import { syncClientEmbedding, syncProcessEmbedding } from "./embedding-sync.server";

export type OpenClawProcessType = "import" | "export" | "services";
export type OpenClawProcessStatus =
  | "draft"
  | "in_progress"
  | "awaiting_docs"
  | "customs_clearance"
  | "in_transit"
  | "delivered"
  | "completed"
  | "cancelled"
  | "pending_approval";

type OpenClawClientType = "importer" | "exporter" | "both";

type ClientMatch = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
};

export class OpenClawActionError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OpenClawActionError";
  }
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeCnpj(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 14 ? formatCNPJ(digits) : "";
}

function normalizeCurrency(value: unknown, fallback = "USD"): string {
  const raw = getOptionalString(value)?.toUpperCase();
  if (!raw) return fallback;
  const letters = raw.replace(/[^A-Z]/g, "");
  return letters.slice(0, 3) || fallback;
}

function normalizeDecimal(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(2);

  const raw = String(value).trim();
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}

function normalizeClientType(value: unknown): OpenClawClientType {
  const normalized = normalizeText(value);
  if (normalized.includes("both") || normalized.includes("ambos")) return "both";
  if (normalized.includes("export")) return "exporter";
  return "importer";
}

export function extractCnpjFromText(text: string): string {
  const match = text.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/);
  return match ? normalizeCnpj(match[0]) : "";
}

export function resolveReferenceModalPrefix(value: unknown): "A" | "M" | "C" {
  const normalized = normalizeText(value);
  if (/(aer|air|awb|voo)/.test(normalized)) return "A";
  if (/(marit|sea|navio|container|bl)/.test(normalized)) return "M";
  return "C";
}

export function normalizeProcessType(value: unknown): OpenClawProcessType | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/(servic|servico)/.test(normalized)) return "services";
  if (normalized.includes("export")) return "export";
  if (normalized.includes("import")) return "import";
  return null;
}

export function normalizeProcessStatus(value: unknown): OpenClawProcessStatus | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized === "draft" || normalized.includes("rascunho")) return "draft";
  if (normalized === "in_progress" || normalized.includes("andamento")) return "in_progress";
  if (normalized === "awaiting_docs" || normalized.includes("aguardando docs") || normalized.includes("document")) {
    return "awaiting_docs";
  }
  if (normalized === "customs_clearance" || normalized.includes("desembaraco")) return "customs_clearance";
  if (normalized === "in_transit" || normalized.includes("transito")) return "in_transit";
  if (normalized === "delivered" || normalized.includes("entreg")) return "delivered";
  if (normalized === "completed" || normalized.includes("conclu") || normalized.includes("finaliz")) return "completed";
  if (normalized === "cancelled" || normalized.includes("cancel")) return "cancelled";
  if (normalized === "pending_approval" || normalized.includes("aprov")) return "pending_approval";
  return null;
}

export function getProcessTypeLabel(value: OpenClawProcessType): string {
  if (value === "export") return "Exportacao";
  if (value === "services") return "Servicos";
  return "Importacao";
}

export function getProcessStatusLabel(value: OpenClawProcessStatus): string {
  switch (value) {
    case "draft":
      return "Rascunho";
    case "in_progress":
      return "Em andamento";
    case "awaiting_docs":
      return "Aguardando documentos";
    case "customs_clearance":
      return "Desembaraco aduaneiro";
    case "in_transit":
      return "Em transito";
    case "delivered":
      return "Entregue";
    case "completed":
      return "Concluido";
    case "cancelled":
      return "Cancelado";
    case "pending_approval":
      return "Aguardando aprovacao";
  }
}

async function findClientMatches(companyId: string, search: string, limit = 5): Promise<ClientMatch[]> {
  return db
    .select({
      id: clients.id,
      razaoSocial: clients.razaoSocial,
      nomeFantasia: clients.nomeFantasia,
      cnpj: clients.cnpj,
    })
    .from(clients)
    .where(
      and(
        eq(clients.companyId, companyId),
        isNull(clients.deletedAt),
        or(
          ilike(clients.razaoSocial, `%${search}%`),
          ilike(clients.nomeFantasia, `%${search}%`),
          ilike(clients.cnpj, `%${search}%`),
        ),
      ),
    )
    .limit(limit);
}

async function generateProcessReference(companyId: string, prefix: "A" | "M" | "C") {
  const yearShort = String(new Date().getFullYear()).slice(-2);
  const prefixPattern = `${prefix}${yearShort}%`;
  const sequenceResult = await db.execute(sql`
    SELECT COALESCE(
      MAX(
        CASE
          WHEN reference ~ ${`^${prefix}${yearShort}-[0-9]+$`}
            THEN substring(reference from '-([0-9]+)$')::int
          ELSE 0
        END
      ),
      0
    ) AS last_seq
    FROM processes
    WHERE company_id = ${companyId}
      AND reference LIKE ${prefixPattern}
  `);

  const nextNum = String(Number(sequenceResult[0]?.last_seq || 0) + 1).padStart(3, "0");
  return `${prefix}${yearShort}-${nextNum}`;
}

function buildProcessChangeSummary(changedFields: string[], note: string | null) {
  const parts = [...changedFields];
  if (note) parts.push(`obs: ${note}`);
  return parts.join(" | ");
}

export async function createClientFromOpenClaw(params: {
  companyId: string;
  userId: string;
  input: Record<string, unknown>;
}) {
  const { companyId, userId, input } = params;
  const contactInput = getRecord(input.contact);

  const cnpj = normalizeCnpj(input.cnpj ?? input.clientCnpj);
  let razaoSocial = getOptionalString(input.razaoSocial);
  let nomeFantasia = getOptionalString(input.nomeFantasia);
  let city = getOptionalString(input.city);
  let state = getOptionalString(input.state)?.toUpperCase() ?? null;
  let address = getOptionalString(input.address);
  let zipCode = getOptionalString(input.zipCode);
  let cnaeCode = getOptionalString(input.cnaeCode);
  let cnaeDescription = getOptionalString(input.cnaeDescription);
  let notes = getOptionalString(input.notes);
  let contactName = getOptionalString(contactInput.name ?? input.contato);
  let contactRole = getOptionalString(contactInput.role ?? input.cargo);
  let contactPhone = getOptionalString(contactInput.phone ?? input.telefone);
  let contactEmail = getOptionalString(contactInput.email ?? input.email);
  const clientType = normalizeClientType(input.clientType);
  let enrichedFromCnpj = false;

  if (!razaoSocial && cnpj) {
    const enriched = await enrichCNPJ(cnpj);
    if (enriched) {
      enrichedFromCnpj = true;
      razaoSocial = razaoSocial ?? (enriched.razaoSocial || null);
      nomeFantasia = nomeFantasia ?? (enriched.nomeFantasia || null);
      city = city ?? (enriched.city || null);
      state = state ?? (enriched.state || null);
      address = address ?? (enriched.address || null);
      zipCode = zipCode ?? (enriched.zipCode || null);
      cnaeCode = cnaeCode ?? (enriched.cnaeCode || null);
      cnaeDescription = cnaeDescription ?? (enriched.cnaeDescription || null);
      notes = notes ?? (enriched.situacao ? `Situacao cadastral: ${enriched.situacao}` : null);
      contactPhone = contactPhone ?? (enriched.phone || null);
      contactEmail = contactEmail ?? (enriched.email || null);
    }
  }

  if (!razaoSocial) {
    throw new OpenClawActionError(
      "missing_client_identity",
      "Envie ao menos um CNPJ valido ou razaoSocial",
    );
  }

  if (cnpj) {
    const [existing] = await db
      .select({ id: clients.id, razaoSocial: clients.razaoSocial, cnpj: clients.cnpj })
      .from(clients)
      .where(and(eq(clients.companyId, companyId), eq(clients.cnpj, cnpj), isNull(clients.deletedAt)))
      .limit(1);

    if (existing) {
      throw new OpenClawActionError(
        "duplicate_client_cnpj",
        `Cliente com CNPJ ${cnpj} ja existe`,
        { clientId: existing.id, razaoSocial: existing.razaoSocial, cnpj: existing.cnpj },
      );
    }
  }

  const [client] = await db
    .insert(clients)
    .values({
      companyId,
      cnpj: cnpj || "00.000.000/0000-00",
      razaoSocial,
      nomeFantasia,
      cnaeCode,
      cnaeDescription,
      address,
      city,
      state,
      zipCode,
      clientType,
      status: "active",
      notes,
      createdBy: userId,
    })
    .returning({ id: clients.id, razaoSocial: clients.razaoSocial });

  const shouldCreateContact = Boolean(contactName || contactPhone || contactEmail || contactRole);
  if (shouldCreateContact) {
    await db.insert(contacts).values({
      clientId: client.id,
      name: contactName || razaoSocial,
      role: contactRole,
      phone: contactPhone,
      email: contactEmail,
      isPrimary: true,
    });
  }

  try {
    await syncClientEmbedding({
      companyId,
      userId,
      clientId: client.id,
      razaoSocial,
      nomeFantasia,
      cnpj: cnpj || null,
      cnaeCode,
      cnaeDescription,
      address,
      city,
      state,
      notes,
      contacts: shouldCreateContact
        ? [
            {
              name: contactName || razaoSocial,
              role: contactRole,
              email: contactEmail,
              phone: contactPhone,
              isPrimary: true,
            },
          ]
        : [],
    });
  } catch (error) {
    console.error("[EMBEDDINGS] Failed to index OpenClaw client:", error);
  }

  return {
    success: true as const,
    clientId: client.id,
    razaoSocial: client.razaoSocial,
    cnpj: cnpj || null,
    enrichedFromCnpj,
    createdPrimaryContact: shouldCreateContact,
  };
}

export async function openProcessFromOpenClaw(params: {
  companyId: string;
  userId: string;
  input: Record<string, unknown>;
}) {
  const { companyId, userId, input } = params;
  const clientSearch =
    getOptionalString(input.clientSearch) ??
    getOptionalString(input.client) ??
    getOptionalString(input.clientName) ??
    (normalizeCnpj(input.cnpj) || "");

  if (!clientSearch) {
    throw new OpenClawActionError("missing_client_search", "clientSearch e obrigatorio");
  }

  const clientRows = await findClientMatches(companyId, clientSearch, 5);
  if (clientRows.length === 0) {
    throw new OpenClawActionError("client_not_found", `Nenhum cliente encontrado: ${clientSearch}`);
  }
  if (clientRows.length > 1) {
    throw new OpenClawActionError(
      "client_ambiguous",
      `Multiplos clientes encontrados para: ${clientSearch}`,
      { matches: clientRows },
    );
  }

  const client = clientRows[0];
  const processType =
    normalizeProcessType(input.processType ?? input.tipo ?? input.operacao ?? input.operationType) ?? "import";
  const modalPrefix = resolveReferenceModalPrefix(
    input.referenceModal ?? input.modal ?? input.transportMode ?? input.modalidade ?? input.sourceText,
  );
  const reference = await generateProcessReference(companyId, modalPrefix);

  const [process] = await db
    .insert(processes)
    .values({
      companyId,
      reference,
      processType,
      status: "draft",
      clientId: client.id,
      description: getOptionalString(input.description),
      hsCode: getOptionalString(input.hsCode),
      incoterm: getOptionalString(input.incoterm)?.toUpperCase() ?? null,
      originCountry: getOptionalString(input.originCountry),
      destinationCountry: getOptionalString(input.destinationCountry) ?? "Brasil",
      currency: normalizeCurrency(input.currency),
      totalValue: normalizeDecimal(input.totalValue ?? input.valueAmount),
      notes: getOptionalString(input.notes),
      createdBy: userId,
    })
    .returning({ id: processes.id });

  await db.insert(processTimeline).values({
    processId: process.id,
    status: "draft",
    title: "Processo criado via OpenClaw",
    description: `Referencia ${reference} criada pelo OpenClaw`,
    createdBy: userId,
  });

  try {
    await syncProcessEmbedding({
      companyId,
      userId,
      processId: process.id,
      reference,
      clientName: client.razaoSocial,
      processType,
      status: "draft",
      description: getOptionalString(input.description),
      hsCode: getOptionalString(input.hsCode),
      incoterm: getOptionalString(input.incoterm)?.toUpperCase() ?? null,
      originCountry: getOptionalString(input.originCountry),
      destinationCountry: getOptionalString(input.destinationCountry) ?? "Brasil",
      currency: normalizeCurrency(input.currency),
      totalValue: normalizeDecimal(input.totalValue ?? input.valueAmount),
      notes: getOptionalString(input.notes),
    });
  } catch (error) {
    console.error("[EMBEDDINGS] Failed to index OpenClaw process:", error);
  }

  return {
    success: true as const,
    processId: process.id,
    reference,
    clientId: client.id,
    clientName: client.razaoSocial,
    processType,
  };
}

export async function updateProcessFromOpenClaw(params: {
  companyId: string;
  userId: string;
  input: Record<string, unknown>;
}) {
  const { companyId, userId, input } = params;
  const reference = getOptionalString(input.reference)?.toUpperCase() ?? "";
  if (!reference) {
    throw new OpenClawActionError("missing_reference", "reference e obrigatoria");
  }

  const [currentProcess] = await db
    .select({
      id: processes.id,
      reference: processes.reference,
      status: processes.status,
      processType: processes.processType,
      description: processes.description,
      hsCode: processes.hsCode,
      incoterm: processes.incoterm,
      originCountry: processes.originCountry,
      destinationCountry: processes.destinationCountry,
      portOfOrigin: processes.portOfOrigin,
      portOfDestination: processes.portOfDestination,
      vessel: processes.vessel,
      bl: processes.bl,
      diNumber: processes.diNumber,
      customsBroker: processes.customsBroker,
      currency: processes.currency,
      totalValue: processes.totalValue,
      totalWeight: processes.totalWeight,
      containerCount: processes.containerCount,
      containerType: processes.containerType,
      costNotes: processes.costNotes,
      notes: processes.notes,
      companyId: processes.companyId,
      clientName: clients.razaoSocial,
    })
    .from(processes)
    .leftJoin(clients, eq(processes.clientId, clients.id))
    .where(and(eq(processes.companyId, companyId), eq(processes.reference, reference), isNull(processes.deletedAt)))
    .limit(1);

  if (!currentProcess) {
    throw new OpenClawActionError("process_not_found", `Processo ${reference} nao encontrado`);
  }

  const nextStatus = normalizeProcessStatus(input.status ?? input.processStatus ?? input.etapa);
  const note =
    getOptionalString(input.note) ??
    getOptionalString(input.notes) ??
    getOptionalString(input.observacao) ??
    getOptionalString(input.justificativa);

  if (nextStatus === "cancelled" && !note) {
    throw new OpenClawActionError(
      "missing_cancellation_note",
      "Informe uma justificativa ao cancelar um processo",
    );
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  const changedFields: string[] = [];

  if (nextStatus && nextStatus !== currentProcess.status) {
    updateData.status = nextStatus;
    changedFields.push(`status=${getProcessStatusLabel(nextStatus)}`);
  }

  const stringMappings: Array<[string, unknown, string, (value: string) => string | null]> = [
    ["description", input.description, "descricao", (value) => value],
    ["incoterm", input.incoterm, "incoterm", (value) => value.toUpperCase()],
    ["hsCode", input.hsCode, "hsCode", (value) => value],
    ["originCountry", input.originCountry, "origem", (value) => value],
    ["destinationCountry", input.destinationCountry, "destino", (value) => value],
    ["vessel", input.vessel, "navio", (value) => value],
    ["bl", input.bl, "BL", (value) => value],
    ["diNumber", input.diNumber, "DI", (value) => value],
    ["customsBroker", input.customsBroker, "despachante", (value) => value],
    ["notes", input.notes, "notas", (value) => value],
  ];

  for (const [field, value, label, transform] of stringMappings) {
    const normalized = getOptionalString(value);
    if (normalized !== null) {
      updateData[field] = transform(normalized);
      changedFields.push(label);
    }
  }

  const totalValue = normalizeDecimal(input.totalValue ?? input.valueAmount);
  if (totalValue !== null) {
    updateData.totalValue = totalValue;
    changedFields.push("valor");
  }

  const currency = getOptionalString(input.currency);
  if (currency !== null) {
    updateData.currency = normalizeCurrency(currency);
    changedFields.push("moeda");
  }

  if (changedFields.length === 0 && !note) {
    throw new OpenClawActionError(
      "missing_process_updates",
      "Informe ao menos um campo para atualizar o processo",
    );
  }

  await db
    .update(processes)
    .set(updateData)
    .where(eq(processes.id, currentProcess.id));

  const finalStatus = nextStatus ?? currentProcess.status;
  await db.insert(processTimeline).values({
    processId: currentProcess.id,
    status: finalStatus,
    title: nextStatus ? "Status atualizado via OpenClaw" : "Processo atualizado via OpenClaw",
    description: buildProcessChangeSummary(changedFields, note),
    createdBy: userId,
  });

  try {
    await syncProcessEmbedding({
      companyId,
      userId,
      processId: currentProcess.id,
      reference: currentProcess.reference,
      clientName: currentProcess.clientName,
      processType: currentProcess.processType,
      status: finalStatus,
      description: currentProcess.description,
      hsCode: currentProcess.hsCode,
      incoterm: currentProcess.incoterm,
      originCountry: currentProcess.originCountry,
      destinationCountry: currentProcess.destinationCountry,
      portOfOrigin: currentProcess.portOfOrigin,
      portOfDestination: currentProcess.portOfDestination,
      vessel: currentProcess.vessel,
      bl: currentProcess.bl,
      diNumber: currentProcess.diNumber,
      customsBroker: currentProcess.customsBroker,
      currency: currentProcess.currency,
      totalValue: currentProcess.totalValue,
      totalWeight: currentProcess.totalWeight,
      containerCount: currentProcess.containerCount,
      containerType: currentProcess.containerType,
      costNotes: currentProcess.costNotes,
      notes: currentProcess.notes,
    });
  } catch (error) {
    console.error("[EMBEDDINGS] Failed to reindex OpenClaw process:", error);
  }

  return {
    success: true as const,
    processId: currentProcess.id,
    reference: currentProcess.reference,
    status: finalStatus,
    updatedFields: changedFields,
  };
}
