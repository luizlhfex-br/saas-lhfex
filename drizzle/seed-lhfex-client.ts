/**
 * Seed LHFEX as CRM client.
 *
 * Run: npx tsx drizzle/seed-lhfex-client.ts
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const queryClient = postgres(DATABASE_URL);
const db = drizzle(queryClient, { schema });

async function seedLHFEXClient() {
  console.log("Seeding LHFEX as CRM client...");

  try {
    let company = await db.query.companies.findFirst({
      where: eq(schema.companies.slug, "lhfex-default"),
    });

    if (!company) {
      [company] = await db
        .insert(schema.companies)
        .values({
          slug: "lhfex-default",
          nomeFantasia: "LHFEX",
          razaoSocial: "LHFEX IMPORT EXPORT LTDA",
          cnpj: "62.180.992/0001-33",
          city: "Belo Horizonte",
          state: "MG",
        })
        .returning();
    }

    const existing = await db.query.clients.findFirst({
      where: eq(schema.clients.cnpj, "62180992000133"),
    });

    if (existing) {
      console.log(`LHFEX already exists in CRM (id: ${existing.id})`);
      return;
    }

    const [lhfex] = await db
      .insert(schema.clients)
      .values({
        companyId: company.id,
        razaoSocial: "LHFEX IMPORT EXPORT LTDA",
        nomeFantasia: "LHFEX",
        cnpj: "62180992000133",
        cnaeCode: "4691500",
        cnaeDescription: "Comercio atacadista de mercadorias em geral",
        address: "Rua Exemplo, 123",
        city: "Belo Horizonte",
        state: "MG",
        zipCode: "30110-000",
        clientType: "importer",
        status: "active",
        notes: "Cliente interno da LHFEX",
      })
      .returning();

    console.log(`LHFEX client created successfully (id: ${lhfex.id})`);
  } catch (error) {
    console.error("Error seeding LHFEX client:", error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

seedLHFEXClient();
