import { pgTable, uuid, varchar, boolean, timestamp, foreignKey } from "drizzle-orm/pg-core";
import { companyProfile } from "./company-profile";

export const companyBankAccounts = pgTable(
  "company_bank_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull(),
    bankName: varchar("bank_name", { length: 100 }).notNull(),
    bankAgency: varchar("bank_agency", { length: 20 }).notNull(),
    bankAccount: varchar("bank_account", { length: 30 }).notNull(),
    bankPix: varchar("bank_pix", { length: 255 }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.companyId],
      foreignColumns: [companyProfile.id],
      name: "company_bank_company_fk",
    }),
  ]
);
