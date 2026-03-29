import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "./db.server";
import { enrichCNPJ } from "./ai.server";
import { formatCNPJ } from "./utils";
import { clients, contacts, deals, dealActivities, processes, processTimeline } from "../../drizzle/schema";
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
export type OpenClawDealStage =
  | "prospect"
  | "qualification"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

type OpenClawClientType = "importer" | "exporter" | "both";

type ClientMatch = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
};

type DealMatch = {
  id: string;
  title: string;
  stage: OpenClawDealStage;
  clientId: string | null;
  clientRazao: string | null;
  clientFantasia: string | null;
  value: string | null;
  currency: string | null;
  nextAction: string | null;
  nextFollowUpAt: Date | null;
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

function parseOptionalDateTime(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new OpenClawActionError(
      "invalid_datetime",
      `Data/hora invalida: ${raw}`,
    );
  }
  return parsed;
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

export function normalizeDealStage(value: unknown): OpenClawDealStage | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized === "prospect" || normalized.includes("lead")) return "prospect";
  if (normalized.includes("qualific") || normalized.includes("contato inicial") || normalized.includes("diagnostic")) {
    return "prospect";
  }
  if (normalized.includes("proposta") || normalized.includes("orcamento")) return "proposal";
  if (normalized.includes("negoci")) return "negotiation";
  if (normalized.includes("won") || normalized.includes("ganho") || normalized.includes("fechado")) return "won";
  if (normalized.includes("lost") || normalized.includes("perd")) return "lost";
  return null;
}

export function getProcessTypeLabel(value: OpenClawProcessType): string {
  if (value === "export") return "Exportacao";
  if (value === "services") return "Outros";
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

export function getDealStageLabel(value: OpenClawDealStage): string {
  switch (value) {
    case "prospect":
      return "Lead";
    case "qualification":
      return "Lead";
    case "proposal":
      return "Proposta / negociacao";
    case "negotiation":
      return "Proposta / negociacao";
    case "won":
      return "Fechado";
    case "lost":
      return "Perdido";
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

async function findDealMatches(companyId: string, search: string, limit = 5): Promise<DealMatch[]> {
  return db
    .select({
      id: deals.id,
      title: deals.title,
      stage: deals.stage,
      clientId: deals.clientId,
      clientRazao: clients.razaoSocial,
      clientFantasia: clients.nomeFantasia,
      value: deals.value,
      currency: deals.currency,
      nextAction: deals.nextAction,
      nextFollowUpAt: deals.nextFollowUpAt,
    })
    .from(deals)
    .leftJoin(clients, eq(deals.clientId, clients.id))
    .where(
      and(
        eq(deals.companyId, companyId),
        isNull(deals.deletedAt),
        or(
          ilike(deals.title, `%${search}%`),
          ilike(clients.razaoSocial, `%${search}%`),
          ilike(clients.nomeFantasia, `%${search}%`),
        ),
      ),
    )
    .limit(limit);
}

async function generateProcessReference(companyId: string, prefix: "A" | "M" | "C") {
  const yearShort = String(new Date().getFullYear()).slice(-2);
  const yearlyPattern = `__${yearShort}-%`;
  const sequenceResult = await db.execute(sql`
    SELECT COALESCE(
      MAX(
        CASE
          WHEN reference ~ ${`^[AMC]${yearShort}-[0-9]+$`}
            THEN substring(reference from '-([0-9]+)$')::int
          ELSE 0
        END
      ),
      0
    ) AS last_seq
    FROM processes
    WHERE company_id = ${companyId}
      AND reference LIKE ${yearlyPattern}
  `);

  const nextNum = String(Number(sequenceResult[0]?.last_seq || 0) + 1).padStart(3, "0");
  return `${prefix}${yearShort}-${nextNum}`;
}

function buildProcessChangeSummary(changedFields: string[], note: string | null) {
  const parts = [...changedFields];
  if (note) parts.push(`obs: ${note}`);
  return parts.join(" | ");
}

function buildDealChangeSummary(changedFields: string[], note: string | null) {
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
  const clientTypeInput = getOptionalString(input.clientType);
  const clientType = clientTypeInput ? normalizeClientType(clientTypeInput) : null;
  let enrichedFromCnpj = false;

  if (cnpj) {
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
      ...(clientType ? { clientType } : {}),
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

export async function createDealFromOpenClaw(params: {
  companyId: string;
  userId: string;
  input: Record<string, unknown>;
}) {
  const { companyId, userId, input } = params;
  const title =
    getOptionalString(input.title) ??
    getOptionalString(input.nome) ??
    getOptionalString(input.opportunity) ??
    getOptionalString(input.dealTitle);

  if (!title) {
    throw new OpenClawActionError("missing_deal_title", "title e obrigatorio para criar oportunidade");
  }

  const clientSearch =
    getOptionalString(input.clientSearch) ??
    getOptionalString(input.client) ??
    getOptionalString(input.clientName) ??
    (normalizeCnpj(input.cnpj) || "");

  let clientId: string | null = null;
  let clientName: string | null = null;

  if (clientSearch) {
    const matches = await findClientMatches(companyId, clientSearch, 5);
    if (matches.length === 0) {
      throw new OpenClawActionError("client_not_found", `Nenhum cliente encontrado: ${clientSearch}`);
    }
    if (matches.length > 1) {
      throw new OpenClawActionError(
        "client_ambiguous",
        `Multiplos clientes encontrados para: ${clientSearch}`,
        { matches },
      );
    }

    clientId = matches[0].id;
    clientName = matches[0].nomeFantasia || matches[0].razaoSocial;
  }

  const stage = normalizeDealStage(input.stage ?? input.status ?? input.etapa) ?? "prospect";
  const value = normalizeDecimal(input.value ?? input.amount ?? input.estimatedValue);
  const currency = normalizeCurrency(input.currency, "BRL");
  const nextAction = getOptionalString(input.nextAction ?? input.proximoPasso);
  const nextFollowUpAt = parseOptionalDateTime(input.nextFollowUpAt ?? input.followUpAt ?? input.followUpDate);
  const lostReason = getOptionalString(input.lostReason ?? input.motivoPerda);
  const notes = getOptionalString(input.notes ?? input.note ?? input.observacao);

  if (stage === "lost" && !lostReason) {
    throw new OpenClawActionError(
      "missing_lost_reason",
      "Informe lostReason ao criar uma oportunidade ja perdida",
    );
  }

  const [deal] = await db
    .insert(deals)
    .values({
      companyId,
      clientId,
      title,
      value,
      currency,
      stage,
      nextAction,
      nextFollowUpAt,
      lostReason,
      notes,
      createdBy: userId,
    })
    .returning({ id: deals.id, title: deals.title, stage: deals.stage });

  await db.insert(dealActivities).values({
    dealId: deal.id,
    content: `Oportunidade criada via Hermes Agent em ${getDealStageLabel(stage)}`,
    type: "created",
    createdBy: userId,
  });

  return {
    success: true as const,
    dealId: deal.id,
    title: deal.title,
    stage: deal.stage,
    stageLabel: getDealStageLabel(deal.stage),
    clientId,
    clientName,
    nextAction,
    nextFollowUpAt: nextFollowUpAt?.toISOString() ?? null,
  };
}

export async function updateDealFromOpenClaw(params: {
  companyId: string;
  userId: string;
  input: Record<string, unknown>;
}) {
  const { companyId, userId, input } = params;
  const dealId = getOptionalString(input.dealId);
  const search =
    getOptionalString(input.search) ??
    getOptionalString(input.dealSearch) ??
    getOptionalString(input.title) ??
    getOptionalString(input.opportunity);

  let currentDeal:
    | (DealMatch & {
        notes?: string | null;
        lostReason?: string | null;
      })
    | null = null;

  if (dealId) {
    const [deal] = await db
      .select({
        id: deals.id,
        title: deals.title,
        stage: deals.stage,
        clientId: deals.clientId,
        clientRazao: clients.razaoSocial,
        clientFantasia: clients.nomeFantasia,
        value: deals.value,
        currency: deals.currency,
        nextAction: deals.nextAction,
        nextFollowUpAt: deals.nextFollowUpAt,
        notes: deals.notes,
        lostReason: deals.lostReason,
      })
      .from(deals)
      .leftJoin(clients, eq(deals.clientId, clients.id))
      .where(and(eq(deals.companyId, companyId), eq(deals.id, dealId), isNull(deals.deletedAt)))
      .limit(1);

    currentDeal = deal ?? null;
  } else {
    const matches = await findDealMatches(companyId, search || "", 5);
    if (matches.length === 0) {
      throw new OpenClawActionError("deal_not_found", `Nenhuma oportunidade encontrada para: ${search || ""}`);
    }
    if (matches.length > 1) {
      throw new OpenClawActionError(
        "deal_ambiguous",
        `Multiplas oportunidades encontradas para: ${search || ""}`,
        {
          matches: matches.map((match) => ({
            id: match.id,
            title: match.title,
            stage: match.stage,
            stageLabel: getDealStageLabel(match.stage),
            clientName: match.clientFantasia || match.clientRazao,
          })),
        },
      );
    }

    currentDeal = matches[0];
  }

  if (!currentDeal) {
    throw new OpenClawActionError(
      "deal_not_found",
      dealId ? `Oportunidade ${dealId} nao encontrada` : `Nenhuma oportunidade encontrada para: ${search || ""}`,
    );
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  const changedFields: string[] = [];

  const nextStage = normalizeDealStage(input.stage ?? input.status ?? input.etapa);
  if (nextStage && nextStage !== currentDeal.stage) {
    updateData.stage = nextStage;
    changedFields.push(`etapa=${getDealStageLabel(nextStage)}`);
  }

  const nextTitle = getOptionalString(input.title);
  if (nextTitle && nextTitle !== currentDeal.title) {
    updateData.title = nextTitle;
    changedFields.push("titulo");
  }

  if (Object.prototype.hasOwnProperty.call(input, "value") || Object.prototype.hasOwnProperty.call(input, "amount")) {
    const nextValue = normalizeDecimal(input.value ?? input.amount);
    if (nextValue !== currentDeal.value) {
      updateData.value = nextValue;
      changedFields.push("valor");
    }
  }

  const nextCurrency = getOptionalString(input.currency);
  if (nextCurrency) {
    const normalizedCurrency = normalizeCurrency(nextCurrency, currentDeal.currency || "BRL");
    if (normalizedCurrency !== currentDeal.currency) {
      updateData.currency = normalizedCurrency;
      changedFields.push("moeda");
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "nextAction") || Object.prototype.hasOwnProperty.call(input, "proximoPasso")) {
    const normalizedNextAction = getOptionalString(input.nextAction ?? input.proximoPasso);
    if (normalizedNextAction !== currentDeal.nextAction) {
      updateData.nextAction = normalizedNextAction;
      changedFields.push("proximo passo");
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(input, "nextFollowUpAt") ||
    Object.prototype.hasOwnProperty.call(input, "followUpAt") ||
    Object.prototype.hasOwnProperty.call(input, "followUpDate")
  ) {
    const nextFollowUpAt = parseOptionalDateTime(input.nextFollowUpAt ?? input.followUpAt ?? input.followUpDate);
    const currentFollowUp = currentDeal.nextFollowUpAt?.toISOString() ?? null;
    const nextFollowUp = nextFollowUpAt?.toISOString() ?? null;
    if (nextFollowUp !== currentFollowUp) {
      updateData.nextFollowUpAt = nextFollowUpAt;
      changedFields.push("follow-up");
    }
  }

  const currentLostReason = currentDeal.lostReason ?? null;
  if (Object.prototype.hasOwnProperty.call(input, "lostReason") || Object.prototype.hasOwnProperty.call(input, "motivoPerda")) {
    const nextLostReason = getOptionalString(input.lostReason ?? input.motivoPerda);
    if (nextLostReason !== currentLostReason) {
      updateData.lostReason = nextLostReason;
      changedFields.push("motivo da perda");
    }
  }

  const currentNotes = currentDeal.notes ?? null;
  if (Object.prototype.hasOwnProperty.call(input, "notes") || Object.prototype.hasOwnProperty.call(input, "note") || Object.prototype.hasOwnProperty.call(input, "observacao")) {
    const nextNotes = getOptionalString(input.notes ?? input.note ?? input.observacao);
    if (nextNotes !== currentNotes) {
      updateData.notes = nextNotes;
      changedFields.push("notas");
    }
  }

  const note = getOptionalString(input.activityNote ?? input.timelineNote ?? input.noteSummary);
  const finalStage = (updateData.stage as OpenClawDealStage | undefined) ?? currentDeal.stage;
  const finalLostReason = (updateData.lostReason as string | null | undefined) ?? currentLostReason;

  if (finalStage === "lost" && !finalLostReason) {
    throw new OpenClawActionError(
      "missing_lost_reason",
      "Informe lostReason para mover uma oportunidade para Perdido",
    );
  }

  if (changedFields.length === 0 && !note) {
    throw new OpenClawActionError(
      "missing_deal_updates",
      "Informe ao menos um campo para atualizar a oportunidade",
    );
  }

  await db
    .update(deals)
    .set(updateData)
    .where(and(eq(deals.companyId, companyId), eq(deals.id, currentDeal.id)));

  await db.insert(dealActivities).values({
    dealId: currentDeal.id,
    content: buildDealChangeSummary(changedFields, note),
    type: nextStage && nextStage !== currentDeal.stage ? "stage_change" : "update",
    createdBy: userId,
  });

  return {
    success: true as const,
    dealId: currentDeal.id,
    title: (updateData.title as string | undefined) ?? currentDeal.title,
    stage: finalStage,
    stageLabel: getDealStageLabel(finalStage),
    updatedFields: changedFields,
    nextAction: (updateData.nextAction as string | null | undefined) ?? currentDeal.nextAction ?? null,
    nextFollowUpAt:
      ((updateData.nextFollowUpAt as Date | null | undefined)?.toISOString() ??
        currentDeal.nextFollowUpAt?.toISOString() ??
        null),
    clientName: currentDeal.clientFantasia || currentDeal.clientRazao,
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
