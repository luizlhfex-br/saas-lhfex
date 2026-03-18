import { indexEmbeddingDocument } from "~/lib/embeddings.server";

type EmbeddingContact = {
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
};

type SyncResult =
  | Awaited<ReturnType<typeof indexEmbeddingDocument>>
  | { skipped: true; reason: string };

function joinLines(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => typeof part === "string" && part.trim().length > 0).join("\n");
}

export async function syncClientEmbedding(input: {
  companyId: string;
  userId: string;
  clientId: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  cnaeCode?: string | null;
  cnaeDescription?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  notes?: string | null;
  contacts?: EmbeddingContact[];
}) {
  const body = joinLines([
    `Cliente: ${input.razaoSocial}`,
    input.nomeFantasia ? `Nome fantasia: ${input.nomeFantasia}` : null,
    input.cnpj ? `CNPJ: ${input.cnpj}` : null,
    input.cnaeCode ? `CNAE: ${input.cnaeCode}` : null,
    input.cnaeDescription ? `CNAE descricao: ${input.cnaeDescription}` : null,
    input.address ? `Endereco: ${input.address}` : null,
    input.city ? `Cidade: ${input.city}` : null,
    input.state ? `UF: ${input.state}` : null,
    input.status ? `Status: ${input.status}` : null,
    input.notes ? `Observacoes: ${input.notes}` : null,
    input.contacts?.length
      ? [
          "Contatos:",
          ...input.contacts.map((contact) =>
            `- ${contact.name}${contact.role ? ` (${contact.role})` : ""}${contact.isPrimary ? " [principal]" : ""}${contact.email ? ` | email: ${contact.email}` : ""}${contact.phone ? ` | telefone: ${contact.phone}` : ""}`,
          ),
        ].join("\n")
      : null,
  ]);

  if (!body) {
    return { skipped: true, reason: "empty_client_body" };
  }

  return indexEmbeddingDocument({
    scopeType: "business",
    sourceType: "client",
    sourceId: input.clientId,
    title: input.razaoSocial,
    body,
    companyId: input.companyId,
    userId: input.userId,
    metadata: {
      cnpj: input.cnpj ?? null,
      status: input.status ?? null,
      contacts: input.contacts?.length ?? 0,
    },
  });
}

export async function syncProcessEmbedding(input: {
  companyId: string;
  userId: string;
  processId: string;
  reference: string;
  clientName?: string | null;
  processType?: string | null;
  status?: string | null;
  description?: string | null;
  hsCode?: string | null;
  incoterm?: string | null;
  originCountry?: string | null;
  destinationCountry?: string | null;
  portOfOrigin?: string | null;
  portOfDestination?: string | null;
  vessel?: string | null;
  bl?: string | null;
  diNumber?: string | null;
  customsBroker?: string | null;
  currency?: string | null;
  totalValue?: string | null;
  totalWeight?: string | null;
  containerCount?: number | null;
  containerType?: string | null;
  costNotes?: string | null;
  notes?: string | null;
}) {
  const body = joinLines([
    `Processo: ${input.reference}`,
    input.clientName ? `Cliente: ${input.clientName}` : null,
    input.processType ? `Tipo: ${input.processType}` : null,
    input.status ? `Status: ${input.status}` : null,
    input.description ? `Descricao: ${input.description}` : null,
    input.hsCode ? `NCM/HS: ${input.hsCode}` : null,
    input.incoterm ? `Incoterm: ${input.incoterm}` : null,
    input.originCountry ? `Origem: ${input.originCountry}` : null,
    input.destinationCountry ? `Destino: ${input.destinationCountry}` : null,
    input.portOfOrigin ? `Porto origem: ${input.portOfOrigin}` : null,
    input.portOfDestination ? `Porto destino: ${input.portOfDestination}` : null,
    input.vessel ? `Navio: ${input.vessel}` : null,
    input.bl ? `BL: ${input.bl}` : null,
    input.diNumber ? `DI: ${input.diNumber}` : null,
    input.customsBroker ? `Despachante: ${input.customsBroker}` : null,
    input.currency || input.totalValue ? `Valor: ${[input.currency ?? "USD", input.totalValue].filter(Boolean).join(" ")}` : null,
    input.totalWeight ? `Peso total: ${input.totalWeight}` : null,
    input.containerCount !== null && input.containerCount !== undefined ? `Containers: ${input.containerCount}` : null,
    input.containerType ? `Tipo de container: ${input.containerType}` : null,
    input.costNotes ? `Notas de custo: ${input.costNotes}` : null,
    input.notes ? `Observacoes: ${input.notes}` : null,
  ]);

  if (!body) {
    return { skipped: true, reason: "empty_process_body" };
  }

  return indexEmbeddingDocument({
    scopeType: "business",
    sourceType: "process",
    sourceId: input.processId,
    title: input.reference,
    body,
    companyId: input.companyId,
    userId: input.userId,
    metadata: {
      reference: input.reference,
      clientName: input.clientName ?? null,
      status: input.status ?? null,
      processType: input.processType ?? null,
      totalValue: input.totalValue ?? null,
    },
  });
}

export type { SyncResult };
