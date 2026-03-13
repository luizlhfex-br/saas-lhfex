import { hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { clients, companies, contacts, userCompanies, users } from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL nao definida");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(sql, { schema: { users, clients, contacts, companies, userCompanies } });

async function ensureCompany() {
  const existing = await db.query.companies.findFirst({
    where: eq(companies.slug, "lhfex-default"),
  });
  if (existing) return existing;

  const [company] = await db
    .insert(companies)
    .values({
      slug: "lhfex-default",
      nomeFantasia: "LHFEX",
      razaoSocial: "LHFEX IMPORT EXPORT LTDA",
      cnpj: "62.180.992/0001-33",
      city: "Belo Horizonte",
      state: "MG",
      email: "luiz@lhfex.com.br",
    })
    .returning();

  return company;
}

async function ensureUser() {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, "luiz@lhfex.com.br"),
  });
  if (existing) return existing;

  const passwordHash = await hash("lhfex2025!", 12);
  const [user] = await db
    .insert(users)
    .values({
      email: "luiz@lhfex.com.br",
      passwordHash,
      name: "Luiz Henrique",
      locale: "pt-BR",
      theme: "light",
    })
    .returning();

  return user;
}

async function ensurePrimaryMembership(userId: string, companyId: string) {
  const existing = await db.query.userCompanies.findFirst({
    where: and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, companyId)),
  });

  if (!existing) {
    await db.insert(userCompanies).values({
      userId,
      companyId,
      role: "owner",
      isPrimary: true,
    });
  }
}

async function seedClients(companyId: string, userId: string) {
  const sampleClients = [
    {
      cnpj: "11222333000181",
      razaoSocial: "Importadora Brasil Global Ltda",
      nomeFantasia: "Brasil Global",
      cnaeCode: "4713100",
      cnaeDescription: "Comercio de pecas e componentes eletronicos",
      address: "Rua das Importacoes, 500",
      city: "Sao Paulo",
      state: "SP",
      zipCode: "01310-100",
      clientType: "importer" as const,
      status: "active" as const,
      notes: "Cliente desde 2023. Especializado em eletronicos da China.",
    },
    {
      cnpj: "44555666000199",
      razaoSocial: "Exporta Sul Agronegocio S.A.",
      nomeFantasia: "Exporta Sul",
      cnaeCode: "0161000",
      cnaeDescription: "Producao combinada de lavoura e pecuaria",
      address: "Av. dos Exportadores, 1200",
      city: "Porto Alegre",
      state: "RS",
      zipCode: "90040-000",
      clientType: "exporter" as const,
      status: "active" as const,
      notes: "Grande exportador de soja e milho. Contrato anual.",
    },
    {
      cnpj: "77888999000155",
      razaoSocial: "Tech Import Export ME",
      nomeFantasia: "TechImpEx",
      cnaeCode: "4741500",
      cnaeDescription: "Comercio varejista de artigos de informatica",
      address: "Rua do Comercio, 88",
      city: "Rio de Janeiro",
      state: "RJ",
      zipCode: "20040-020",
      clientType: "both" as const,
      status: "prospect" as const,
      notes: "Prospecto em fase de negociacao.",
    },
  ];

  let created = 0;
  for (const client of sampleClients) {
    const existing = await db.query.clients.findFirst({
      where: and(eq(clients.companyId, companyId), eq(clients.cnpj, client.cnpj)),
    });

    if (existing) continue;

    await db.insert(clients).values({
      ...client,
      companyId,
      createdBy: userId,
    });
    created += 1;
  }

  console.log(`${created} clientes criados`);

  const brasilGlobal = await db.query.clients.findFirst({
    where: and(eq(clients.companyId, companyId), eq(clients.cnpj, "11222333000181")),
  });
  const exportaSul = await db.query.clients.findFirst({
    where: and(eq(clients.companyId, companyId), eq(clients.cnpj, "44555666000199")),
  });

  const sampleContacts: typeof contacts.$inferInsert[] = [];

  if (brasilGlobal) {
    sampleContacts.push({
      clientId: brasilGlobal.id,
      name: "Carlos Silva",
      role: "Diretor Comercial",
      email: "carlos@brasilglobal.com.br",
      phone: "11999001122",
      whatsapp: "5511999001122",
      isPrimary: true,
    });

    sampleContacts.push({
      clientId: brasilGlobal.id,
      name: "Ana Rodrigues",
      role: "Gerente de Importacao",
      email: "ana@brasilglobal.com.br",
      phone: "11998877665",
      whatsapp: "5511998877665",
      isPrimary: false,
    });
  }

  if (exportaSul) {
    sampleContacts.push({
      clientId: exportaSul.id,
      name: "Roberto Santos",
      role: "CEO",
      email: "roberto@exportasul.com.br",
      phone: "51988001122",
      whatsapp: "5551988001122",
      isPrimary: true,
    });
  }

  let contactsCreated = 0;
  for (const contact of sampleContacts) {
    const existing = await db.query.contacts.findFirst({
      where: and(eq(contacts.clientId, contact.clientId), eq(contacts.name, contact.name)),
    });

    if (existing) continue;

    await db.insert(contacts).values(contact);
    contactsCreated += 1;
  }

  console.log(`${contactsCreated} contatos criados`);
}

async function seed() {
  console.log("Iniciando seed...\n");

  const company = await ensureCompany();
  const user = await ensureUser();
  await ensurePrimaryMembership(user.id, company.id);
  await seedClients(company.id, user.id);

  console.log("\nSeed concluido!");
  await sql.end();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("Erro no seed:", err);
  await sql.end();
  process.exit(1);
});
