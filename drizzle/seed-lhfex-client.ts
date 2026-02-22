/**
 * Seed LHFEX as CRM Client
 * Adds LHFEX company data to the CRM clients table
 * 
 * Run: npx tsx drizzle/seed-lhfex-client.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { eq } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const queryClient = postgres(DATABASE_URL);
const db = drizzle(queryClient, { schema });

async function seedLHFEXClient() {
  console.log("🌱 Seeding LHFEX as CRM client...");

  try {
    // Check if LHFEX already exists
    const existing = await db.query.clients.findFirst({
      where: eq(schema.clients.cnpj, "62180992000133"),
    });

    if (existing) {
      console.log("✅ LHFEX already exists in CRM (id: " + existing.id + ")");
      return;
    }

    // Insert LHFEX client
    const [lhfex] = await db
      .insert(schema.clients)
      .values({
        razaoSocial: "LHFEX IMPORT EXPORT LTDA",
        nomeFantasia: "LHFEX",
        cnpj: "62180992000133",
        cnaeCode: "4691500",
        cnaeDescription: "Comércio atacadista de mercadorias em geral, com predominância de produtos alimentícios",
        address: "Rua Exemplo, 123",
        city: "São Paulo",
        state: "SP",
        zipCode: "01234-567",
        clientType: "importer",
        status: "active",
        notes: "Cliente interno - LHFEX (empresa proprietária do sistema)",
      })
      .returning();

    console.log("✅ LHFEX client created successfully (id: " + lhfex.id + ")");
    console.log("📋 CNPJ: 62.180.992/0001-33");
    console.log("📧 Email: contato@lhfex.com.br");
  } catch (error) {
    console.error("❌ Error seeding LHFEX client:", error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

seedLHFEXClient();
