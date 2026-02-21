/**
 * Cashflow Schema - Controle de Caixa
 * 
 * Sistema de controle financeiro complementar às faturas/invoices.
 * Foco em fluxo de caixa (receitas e despesas) com organização por categorias.
 */

import { pgTable, uuid, date, varchar, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const cashMovements = pgTable("cash_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(), // Data do lançamento
  type: varchar("type", { length: 10 }).notNull(), // "income" | "expense"
  category: varchar("category", { length: 100 }).notNull(), // Categoria (ex: "Vendas", "Salários", "Marketing")
  subcategory: varchar("subcategory", { length: 100 }),
  description: text("description"), // Descrição detalhada opcional
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(), // Valor sempre positivo (sinal vem de type)
  hasInvoice: varchar("has_invoice", { length: 1 }).notNull().default("N"), // S ou N
  settlementDate: date("settlement_date"), // Data de pagamento/recebimento
  paymentMethod: varchar("payment_method", { length: 50 }), // Forma de pagamento (ex: "PIX", "Cartão", "Boleto")
  costCenter: varchar("cost_center", { length: 50 }), // Centro de custo (ex: "Administrativo", "Comercial")
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("cash_movements_date_idx").on(table.date),
  index("cash_movements_type_idx").on(table.type),
  index("cash_movements_category_idx").on(table.category),
  index("cash_movements_created_by_idx").on(table.createdBy),
]);
