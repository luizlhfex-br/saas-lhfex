/**
 * Bills Schema — Módulo de Vencimentos (Vida Pessoal)
 *
 * Gerencia qualquer tipo de pagamento recorrente ou pontual:
 * assinaturas, boletos, cartão, aluguel, seguros, etc.
 *
 * Alertas via @lhfex_monitor_bot:
 * - X dias antes (configurável por conta, padrão 3 dias)
 * - Sempre 1 dia antes (opcional)
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// ── Enums ──────────────────────────────────────────────────────────────────

export const billStatusEnum = pgEnum("bill_status", [
  "active",
  "paused",
  "cancelled",
]);

export const billCategoryEnum = pgEnum("bill_category", [
  "subscription",   // Netflix, Spotify, SaaS tools…
  "rent",           // Aluguel físico ou virtual
  "credit_card",    // Fatura de cartão de crédito
  "utility",        // Água, luz, internet, telefone…
  "loan",           // Empréstimo, financiamento
  "insurance",      // Seguro de vida, auto, residência…
  "tax",            // IPTU, IPVA, tributos…
  "other",          // Qualquer outro
]);

// ── Tabela principal: bills ────────────────────────────────────────────────

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),

    // Identificação
    name: varchar("name", { length: 200 }).notNull(), // "Netflix", "Aluguel Virtual"
    category: billCategoryEnum("category").notNull(),
    description: text("description"),

    // Valor
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("BRL"),

    // Datas e recorrência
    dueDay: integer("due_day"),                           // Dia do mês (1-31) para recorrentes
    nextDueDate: date("next_due_date").notNull(),          // Próximo vencimento
    startDate: date("start_date"),                        // Início do contrato/assinatura
    endDate: date("end_date"),                            // Fim do contrato (null = sem fim)

    // Configuração de recorrência
    isRecurring: boolean("is_recurring").default(true),
    recurrenceMonths: integer("recurrence_months").default(1), // 1=mensal, 3=trimestral, 12=anual

    // Pagamento
    isAutoDebit: boolean("is_auto_debit").default(false),       // Débito automático?
    paymentMethod: varchar("payment_method", { length: 50 }),   // "Nubank", "Inter", "Boleto", "Pix"

    // Alertas via Telegram
    alertDaysBefore: integer("alert_days_before").default(3),         // Alertar X dias antes
    alertOneDayBefore: boolean("alert_one_day_before").default(true),  // Sempre alertar 1 dia antes

    // Status
    status: billStatusEnum("status").default("active"),

    // Extras
    link: text("link"),   // URL do site/app para pagar
    notes: text("notes"), // Observações livres

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"), // Soft delete
  },
  (t) => [
    index("bills_user_id_idx").on(t.userId),
    index("bills_next_due_date_idx").on(t.nextDueDate),
    index("bills_status_idx").on(t.status),
    index("bills_deleted_at_idx").on(t.deletedAt),
  ]
);

// ── Tabela de histórico de pagamentos: bill_payments ──────────────────────

export const billPayments = pgTable(
  "bill_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),

    paidAt: date("paid_at").notNull(),                             // Data em que foi pago
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // Valor pago (pode diferir do valor nominal)
    notes: text("notes"),                                          // Observação opcional do pagamento

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("bill_payments_bill_id_idx").on(t.billId),
    index("bill_payments_user_id_idx").on(t.userId),
    index("bill_payments_paid_at_idx").on(t.paidAt),
  ]
);

// ── Types inferidos ────────────────────────────────────────────────────────

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type BillPayment = typeof billPayments.$inferSelect;
export type NewBillPayment = typeof billPayments.$inferInsert;
export type BillStatus = (typeof billStatusEnum.enumValues)[number];
export type BillCategory = (typeof billCategoryEnum.enumValues)[number];
