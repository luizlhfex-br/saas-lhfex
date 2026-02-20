import { hash } from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { users, clients, contacts } from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL não definida");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(sql);

async function seed() {
  console.log("🌱 Iniciando seed...\n");

  // 1. Create admin user (Luiz)
  const passwordHash = await hash("lhfex2025!", 12);

  const [luiz] = await db
    .insert(users)
    .values({
      email: "luiz@lhfex.com.br",
      passwordHash,
      name: "Luiz Henrique",
      locale: "pt-BR",
      theme: "light",
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  if (luiz) {
    console.log(`✅ Usuário criado: ${luiz.name} (${luiz.email})`);
  } else {
    console.log("ℹ️  Usuário luiz@lhfex.com.br já existe, pulando...");
  }

  const userId = luiz?.id;

  // 2. Create sample clients
  if (userId) {
    const sampleClients = [
      {
        cnpj: "11222333000181",
        razaoSocial: "Importadora Brasil Global Ltda",
        nomeFantasia: "Brasil Global",
        cnaeCode: "4713100",
        cnaeDescription: "Comércio de peças e componentes eletrônicos para produtos de consumo não especificados anteriormente",
        address: "Rua das Importações, 500",
        city: "São Paulo",
        state: "SP",
        zipCode: "01310-100",
        clientType: "importer" as const,
        status: "active" as const,
        notes: "Cliente desde 2023. Especializado em eletrônicos da China.",
        createdBy: userId,
      },
      {
        cnpj: "44555666000199",
        razaoSocial: "Exporta Sul Agronegócio S.A.",
        nomeFantasia: "Exporta Sul",
        cnaeCode: "0161000",
        cnaeDescription: "Produção combinada de lavoura e pecuária",
        address: "Av. dos Exportadores, 1200",
        city: "Porto Alegre",
        state: "RS",
        zipCode: "90040-000",
        clientType: "exporter" as const,
        status: "active" as const,
        notes: "Grande exportador de soja e milho. Contrato anual.",
        createdBy: userId,
      },
      {
        cnpj: "77888999000155",
        razaoSocial: "Tech Import Export ME",
        nomeFantasia: "TechImpEx",
        cnaeCode: "4741500",
        cnaeDescription: "Comércio varejista de artigos de informática",
        address: "Rua do Comércio, 88",
        city: "Rio de Janeiro",
        state: "RJ",
        zipCode: "20040-020",
        clientType: "both" as const,
        status: "prospect" as const,
        notes: "Prospecto em fase de negociação.",
        createdBy: userId,
      },
    ];

    const insertedClients = await db
      .insert(clients)
      .values(sampleClients)
      .onConflictDoNothing()
      .returning();

    console.log(`✅ ${insertedClients.length} clientes criados`);

    // 3. Create sample contacts for first client
    if (insertedClients.length > 0) {
      const sampleContacts = [
        {
          clientId: insertedClients[0].id,
          name: "Carlos Silva",
          role: "Diretor Comercial",
          email: "carlos@brasilglobal.com.br",
          phone: "11999001122",
          whatsapp: "5511999001122",
          isPrimary: true,
        },
        {
          clientId: insertedClients[0].id,
          name: "Ana Rodrigues",
          role: "Gerente de Importação",
          email: "ana@brasilglobal.com.br",
          phone: "11998877665",
          whatsapp: "5511998877665",
          isPrimary: false,
        },
        {
          clientId: insertedClients[1].id,
          name: "Roberto Santos",
          role: "CEO",
          email: "roberto@exportasul.com.br",
          phone: "51988001122",
          whatsapp: "5551988001122",
          isPrimary: true,
        },
      ];

      const insertedContacts = await db
        .insert(contacts)
        .values(sampleContacts)
        .onConflictDoNothing()
        .returning();

      console.log(`✅ ${insertedContacts.length} contatos criados`);
    }
  }

  console.log("\n🎉 Seed concluído!");
  await sql.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erro no seed:", err);
  process.exit(1);
});
