/**
 * Personal Life Schema (Vida Pessoal — Módulo Privado)
 * 
 * Sistema pessoal do Luiz para:
 * - Controle de finanças pessoais (receitas/despesas PF)
 * - Investimentos pessoais
 * - Rotinas e hábitos saudáveis
 * - Promoções e sorteios (hobby)
 */

import { pgTable, uuid, text, varchar, timestamp, boolean, decimal, date, integer, index, foreignKey } from "drizzle-orm/pg-core";
import { users } from "./auth";

// ── Finanças Pessoais (Receitas/Despesas) ──
export const personalFinance = pgTable(
  "personal_finance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(), // Sempre será Luiz
    date: date("date").notNull(),
    type: varchar("type", { length: 20 }).notNull(), // "income" | "expense"
    category: varchar("category", { length: 100 }).notNull(), // "salary", "freelance", "food", "transportation", "entertainment", "healthcare", "gifts"
    description: varchar("description", { length: 255 }).notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("BRL"),
    paymentMethod: varchar("payment_method", { length: 50 }), // "cash", "debit_card", "credit_card", "transfer", "pix"
    recurringId: uuid("recurring_id"), // Para despesas recorrentes (aluguel, internet, etc)
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("personal_finance_user_id_idx").on(table.userId),
    dateIdx: index("personal_finance_date_idx").on(table.date),
    categoryIdx: index("personal_finance_category_idx").on(table.category),
    recurringIdIdx: index("personal_finance_recurring_id_idx").on(table.recurringId),
  })
);

// ── Investimentos Pessoais ──
export const personalInvestments = pgTable(
  "personal_investments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    assetType: varchar("asset_type", { length: 50 }).notNull(), // "stock", "crypto", "savings", "bonds", "real_estate", "earns_interest"
    assetName: varchar("asset_name", { length: 255 }).notNull(), // "PETR4", "Bitcoin", "Poupança", "Tesouro Direto", etc
    ticker: varchar("ticker", { length: 20 }), // "PETR4", "BTC", etc
    quantity: decimal("quantity", { precision: 20, scale: 8 }).notNull(),
    purchasePrice: decimal("purchase_price", { precision: 15, scale: 2 }).notNull(), // Preço unitário
    purchaseDate: date("purchase_date").notNull(),
    currentPrice: decimal("current_price", { precision: 15, scale: 2 }), // Atualizar via agente/webhook
    currentValue: decimal("current_value", { precision: 15, scale: 2 }), // quantity * currentPrice
    gainLoss: decimal("gain_loss", { precision: 15, scale: 2 }), // currentValue - (quantity * purchasePrice)
    gainLossPercent: decimal("gain_loss_percent", { precision: 8, scale: 2 }), // (gainLoss / investmentCost) * 100
    broker: varchar("broker", { length: 100 }), // "B3", "Coinbase", "Banco do Brasil", etc
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("personal_investments_user_id_idx").on(table.userId),
    assetTypeIdx: index("personal_investments_asset_type_idx").on(table.assetType),
  })
);

// ── Rotinas Pessoais (Hábitos Saudáveis) ──
export const personalRoutines = pgTable(
  "personal_routines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    routineType: varchar("routine_type", { length: 50 }).notNull(), // "exercise", "meditation", "reading", "sleep", "nutrition", "learning", "hobby"
    name: varchar("name", { length: 255 }).notNull(), // "Treino de corrida", "Meditação matinal", "Livro: Hábitos Atômicos"
    description: text("description"),
    frequency: varchar("frequency", { length: 50 }).notNull(), // "daily", "weekdays", "weekends", "weekly", "monthly"
    targetValue: decimal("target_value", { precision: 10, scale: 2 }), // Para quantificar: minutos/páginas/km
    unit: varchar("unit", { length: 30 }), // "minutes", "pages", "km", "hours", "glasses_of_water"
    startDate: date("start_date"),
    isActive: boolean("is_active").default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("personal_routines_user_id_idx").on(table.userId),
    routineTypeIdx: index("personal_routines_routine_type_idx").on(table.routineType),
  })
);

// ── Logs de Rotinas (Execução Diária) ──
export const routineTracking = pgTable(
  "routine_tracking",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    routineId: uuid("routine_id").notNull(),
    userId: uuid("user_id").notNull(),
    date: date("date").notNull(),
    completed: boolean("completed").notNull(), // true = completou, false = não completou
    value: decimal("value", { precision: 10, scale: 2 }), // Valor realizado (km, minutos, páginas)
    notes: text("notes"), // Notas sobre a execução
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    routineIdIdx: index("routine_tracking_routine_id_idx").on(table.routineId),
    userIdIdx: index("routine_tracking_user_id_idx").on(table.userId),
    dateIdx: index("routine_tracking_date_idx").on(table.date),
    fk_routine: foreignKey({ columns: [table.routineId], foreignColumns: [personalRoutines.id] }),
  })
);

// ── Promoções e Sorteios (Hobby) ──
export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(), // "Sorteio Natura", "Black Friday AmazonAWS"
    company: varchar("company", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(), // "raffle", "contest", "cashback", "lucky_draw"
    description: text("description"),
    prize: varchar("prize", { length: 500 }), // Descrição do prêmio
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    rules: text("rules"), // Regras da promoção
    participationStatus: varchar("participation_status", { length: 50 }).default("pending"), // "pending", "participated", "won", "lost"
    link: varchar("link", { length: 500 }), // Link para promoção
    proofOfParticipation: text("proof_of_participation"), // JSON or markdown with evidence
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("promotions_user_id_idx").on(table.userId),
    typeIdx: index("promotions_type_idx").on(table.type),
    endDateIdx: index("promotions_end_date_idx").on(table.endDate),
    participationStatusIdx: index("promotions_participation_status_idx").on(table.participationStatus),
  })
);

// ── Férias e Planejamento (Time Off) ──
export const plannedTimeOff = pgTable(
  "planned_time_off",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(), // "Férias em Florianópolis", "Recesso de Natal"
    type: varchar("type", { length: 50 }).notNull(), // "vacation", "weekend_trip", "staycation", "retreat"
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    location: varchar("location", { length: 255 }),
    estimatedBudget: decimal("estimated_budget", { precision: 12, scale: 2 }),
    actualSpend: decimal("actual_spend", { precision: 12, scale: 2 }),
    accommodation: text("accommodation"), // Hotel, Airbnb, etc
    activities: text("activities"), // Atividades planejadas
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("planned_time_off_user_id_idx").on(table.userId),
    startDateIdx: index("planned_time_off_start_date_idx").on(table.startDate),
  })
);

// ── Pessoas / Contatos Pessoais ──
export const pessoas = pgTable(
  "pessoas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    nomeCompleto: varchar("nome_completo", { length: 255 }).notNull(),
    cpf: varchar("cpf", { length: 14 }), // "000.000.000-00"
    rg: varchar("rg", { length: 30 }),
    nascimento: date("nascimento"), // "YYYY-MM-DD"
    celular: varchar("celular", { length: 30 }),
    email: varchar("email", { length: 255 }),
    instagram: varchar("instagram", { length: 100 }), // @handle
    endereco: text("endereco"),
    senhas: text("senhas"), // JSON: [{label, login, password}]
    notas: text("notas"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("pessoas_user_id_idx").on(table.userId),
    nomeIdx: index("pessoas_nome_idx").on(table.nomeCompleto),
  })
);

// ── Objetivos Pessoais (Goals) ──
export const personalGoals = pgTable(
  "personal_goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(), // "Correr 5km sem parar", "Ler 24 livros este ano"
    category: varchar("category", { length: 50 }).notNull(), // "health", "finance", "learning", "hobby", "personal_growth"
    description: text("description"),
    targetValue: decimal("target_value", { precision: 15, scale: 2 }), // Valor alvo
    currentValue: decimal("current_value", { precision: 15, scale: 2 }), // Valor atingido
    unit: varchar("unit", { length: 50 }), // "km", "books", "savings_BRL", "days_streak"
    startDate: date("start_date"),
    deadline: date("deadline"),
    priority: varchar("priority", { length: 20 }).default("medium"), // "low", "medium", "high", "critical"
    status: varchar("status", { length: 50 }).default("in_progress"), // "in_progress", "completed", "abandoned"
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("personal_goals_user_id_idx").on(table.userId),
    categoryIdx: index("personal_goals_category_idx").on(table.category),
    deadlineIdx: index("personal_goals_deadline_idx").on(table.deadline),
  })
);
