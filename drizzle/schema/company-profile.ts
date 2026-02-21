import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const companyProfile = pgTable("company_profile", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Identificação
  cnpj: varchar("cnpj", { length: 18 }),
  razaoSocial: varchar("razao_social", { length: 500 }),
  nomeFantasia: varchar("nome_fantasia", { length: 500 }),
  // Endereço
  address: text("address"),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  country: varchar("country", { length: 100 }).notNull().default("Brasil"),
  // Contato
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 500 }),
  // Fiscal
  ie: varchar("ie", { length: 30 }), // Inscrição Estadual
  im: varchar("im", { length: 30 }), // Inscrição Municipal
  cnae: varchar("cnae", { length: 7 }),
  cnaeDescription: varchar("cnae_description", { length: 500 }),
  // Bancário
  bankName: varchar("bank_name", { length: 100 }),
  bankAgency: varchar("bank_agency", { length: 20 }),
  bankAccount: varchar("bank_account", { length: 30 }),
  bankPix: varchar("bank_pix", { length: 255 }),
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
