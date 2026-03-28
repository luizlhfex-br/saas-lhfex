import { and, eq, isNull } from "drizzle-orm";
import { auditLogs, clients, contacts } from "../../drizzle/schema";
import { enrichCNPJ } from "./ai.server";
import { db } from "./db.server";
import { syncClientEmbedding } from "./embedding-sync.server";
import { formatCNPJ } from "./utils";

type ClientRow = {
  id: string;
  companyId: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnaeCode: string | null;
  cnaeDescription: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  status: "active" | "inactive" | "prospect";
  notes: string | null;
};

function normalizeStoredCnpj(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 14 ? formatCNPJ(digits) : value;
}

function hasValue(value: string | null | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function pickValue(current: string | null, next: string | null | undefined, overwriteExisting: boolean) {
  if (!hasValue(next)) return current;
  if (!overwriteExisting && hasValue(current)) return current;
  return next;
}

export async function enrichClientById(params: {
  clientId: string;
  companyId: string;
  userId: string;
  requestMeta: {
    ipAddress: string;
    userAgent: string;
  };
  overwriteExisting?: boolean;
}) {
  const { clientId, companyId, userId, requestMeta, overwriteExisting = true } = params;

  const [client] = await db
    .select({
      id: clients.id,
      companyId: clients.companyId,
      cnpj: clients.cnpj,
      razaoSocial: clients.razaoSocial,
      nomeFantasia: clients.nomeFantasia,
      cnaeCode: clients.cnaeCode,
      cnaeDescription: clients.cnaeDescription,
      address: clients.address,
      city: clients.city,
      state: clients.state,
      zipCode: clients.zipCode,
      status: clients.status,
      notes: clients.notes,
    })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.companyId, companyId), isNull(clients.deletedAt)))
    .limit(1);

  if (!client) {
    throw new Error("Cliente nao encontrado");
  }

  const normalizedCnpj = normalizeStoredCnpj(client.cnpj);
  const cleanCnpj = normalizedCnpj.replace(/\D/g, "");
  if (cleanCnpj.length !== 14) {
    throw new Error("CNPJ invalido para enriquecimento");
  }

  const enriched = await enrichCNPJ(cleanCnpj);
  if (!enriched) {
    throw new Error("Nao foi possivel consultar este CNPJ agora");
  }

  const patch = {
    razaoSocial: pickValue(client.razaoSocial, enriched.razaoSocial ?? null, overwriteExisting) ?? client.razaoSocial,
    nomeFantasia: pickValue(client.nomeFantasia, enriched.nomeFantasia ?? null, overwriteExisting),
    cnaeCode: pickValue(client.cnaeCode, enriched.cnaeCode ?? null, overwriteExisting),
    cnaeDescription: pickValue(client.cnaeDescription, enriched.cnaeDescription ?? null, overwriteExisting),
    address: pickValue(client.address, enriched.address ?? null, overwriteExisting),
    city: pickValue(client.city, enriched.city ?? null, overwriteExisting),
    state: pickValue(client.state, enriched.state ?? null, overwriteExisting),
    zipCode: pickValue(client.zipCode, enriched.zipCode ?? null, overwriteExisting),
    updatedAt: new Date(),
  };

  const previous = {
    razaoSocial: client.razaoSocial,
    nomeFantasia: client.nomeFantasia,
    cnaeCode: client.cnaeCode,
    cnaeDescription: client.cnaeDescription,
    address: client.address,
    city: client.city,
    state: client.state,
    zipCode: client.zipCode,
  };

  await db
    .update(clients)
    .set(patch)
    .where(and(eq(clients.id, clientId), eq(clients.companyId, companyId)));

  const contactRows = await db
    .select({
      name: contacts.name,
      role: contacts.role,
      email: contacts.email,
      phone: contacts.phone,
      isPrimary: contacts.isPrimary,
    })
    .from(contacts)
    .where(and(eq(contacts.clientId, clientId), isNull(contacts.deletedAt)));

  try {
    await syncClientEmbedding({
      companyId,
      userId,
      clientId,
      razaoSocial: patch.razaoSocial,
      nomeFantasia: patch.nomeFantasia,
      cnpj: normalizedCnpj,
      cnaeCode: patch.cnaeCode,
      cnaeDescription: patch.cnaeDescription,
      address: patch.address,
      city: patch.city,
      state: patch.state,
      status: client.status,
      notes: client.notes,
      contacts: contactRows,
    });
  } catch (error) {
    console.error("[EMBEDDINGS] Failed to reindex enriched client:", error);
  }

  await db.insert(auditLogs).values({
    userId,
    action: "update",
    entity: "client",
    entityId: clientId,
    changes: {
      enrichment: true,
      overwriteExisting,
      previous,
      next: patch,
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return {
    clientId,
    cnpj: normalizedCnpj,
    razaoSocial: patch.razaoSocial,
  };
}
