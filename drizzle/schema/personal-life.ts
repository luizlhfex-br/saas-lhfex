/**
 * Personal Life Schema (Vida Pessoal — Módulo Privado)
 * 
 * Sistema pessoal do Luiz para:
 * - Controle de finanças pessoais (receitas/despesas PF)
 * - Investimentos pessoais
 * - Rotinas e hábitos saudáveis
 * - Promoções e sorteios (hobby)
 */

import { pgTable, uuid, text, varchar, timestamp, boolean, decimal, date, integer, index, foreignKey, smallint, uniqueIndex } from "drizzle-orm/pg-core";
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
    status: varchar("status", { length: 20 }).default("settled").notNull(), // "planned" | "settled" | "cancelled"
    settledAt: date("settled_at"),
    isFixed: boolean("is_fixed").default(false).notNull(),
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
    statusIdx: index("personal_finance_status_idx").on(table.status),
  })
);

// ── Investimentos Pessoais ──
export const personalFinanceGoals = pgTable(
  "personal_finance_goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
    incomeGoal: decimal("income_goal", { precision: 12, scale: 2 }),
    expenseLimit: decimal("expense_limit", { precision: 12, scale: 2 }),
    savingsGoal: decimal("savings_goal", { precision: 12, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("personal_finance_goals_user_id_idx").on(table.userId),
    monthIdx: index("personal_finance_goals_month_idx").on(table.month),
    userMonthUniqueIdx: uniqueIndex("personal_finance_goals_user_month_uidx").on(table.userId, table.month),
  })
);

// â”€â”€ Investimentos Pessoais â”€â”€
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

// —— Avaliacoes corporais e fotos de progresso —— 
export const personalHealthAssessments = pgTable(
  "personal_health_assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    entryDate: date("entry_date").notNull(),
    calculationProfile: varchar("calculation_profile", { length: 20 }).notNull().default("male"),
    activityLevel: varchar("activity_level", { length: 30 }).notNull().default("moderate"),
    customActivityFactor: decimal("custom_activity_factor", { precision: 4, scale: 3 }),
    heightCm: decimal("height_cm", { precision: 6, scale: 2 }),
    weightKg: decimal("weight_kg", { precision: 6, scale: 2 }),
    neckCm: decimal("neck_cm", { precision: 6, scale: 2 }),
    chestCm: decimal("chest_cm", { precision: 6, scale: 2 }),
    waistCm: decimal("waist_cm", { precision: 6, scale: 2 }),
    hipCm: decimal("hip_cm", { precision: 6, scale: 2 }),
    leftArmCm: decimal("left_arm_cm", { precision: 6, scale: 2 }),
    rightArmCm: decimal("right_arm_cm", { precision: 6, scale: 2 }),
    leftThighCm: decimal("left_thigh_cm", { precision: 6, scale: 2 }),
    rightThighCm: decimal("right_thigh_cm", { precision: 6, scale: 2 }),
    leftCalfCm: decimal("left_calf_cm", { precision: 6, scale: 2 }),
    rightCalfCm: decimal("right_calf_cm", { precision: 6, scale: 2 }),
    bodyFatPercent: decimal("body_fat_percent", { precision: 5, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("personal_health_assessment_user_idx").on(table.userId),
    entryDateIdx: index("personal_health_assessment_entry_date_idx").on(table.entryDate),
    userDateUniqueIdx: uniqueIndex("personal_health_assessment_user_date_uidx").on(table.userId, table.entryDate),
  })
);

export const personalHealthPhotos = pgTable(
  "personal_health_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assessmentId: uuid("assessment_id").notNull(),
    userId: uuid("user_id").notNull(),
    pose: varchar("pose", { length: 20 }).notNull(),
    fileUrl: text("file_url").notNull(),
    fileSize: integer("file_size"),
    takenAt: date("taken_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    assessmentIdIdx: index("personal_health_photo_assessment_idx").on(table.assessmentId),
    userIdIdx: index("personal_health_photo_user_idx").on(table.userId),
    assessmentPoseUniqueIdx: uniqueIndex("personal_health_photo_assessment_pose_uidx").on(table.assessmentId, table.pose),
    fkAssessment: foreignKey({ columns: [table.assessmentId], foreignColumns: [personalHealthAssessments.id] }),
  })
);

// ── Promoções e Sorteios (Hobby) ──
export const personalNewsSources = pgTable(
  "personal_news_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    topic: varchar("topic", { length: 30 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    sourceType: varchar("source_type", { length: 30 }).notNull().default("google_news_rss"),
    query: text("query").notNull(),
    sourceUrl: text("source_url"),
    maxItems: integer("max_items").notNull().default(4),
    priority: smallint("priority").notNull().default(5),
    isActive: boolean("is_active").notNull().default(true),
    lastCheckedAt: timestamp("last_checked_at"),
    lastStatus: varchar("last_status", { length: 20 }).notNull().default("idle"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("personal_news_sources_user_id_idx").on(table.userId),
    topicIdx: index("personal_news_sources_topic_idx").on(table.topic),
    activeIdx: index("personal_news_sources_active_idx").on(table.isActive),
  })
);

export const personalNewsItems = pgTable(
  "personal_news_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    sourceId: uuid("source_id"),
    topic: varchar("topic", { length: 30 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    summary: text("summary"),
    url: text("url").notNull(),
    sourceName: varchar("source_name", { length: 255 }),
    publishedAt: timestamp("published_at"),
    digestDate: date("digest_date"),
    relevanceScore: smallint("relevance_score").notNull().default(50),
    isRead: boolean("is_read").notNull().default(false),
    isStarred: boolean("is_starred").notNull().default(false),
    telegramSentAt: timestamp("telegram_sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("personal_news_items_user_id_idx").on(table.userId),
    topicIdx: index("personal_news_items_topic_idx").on(table.topic),
    digestDateIdx: index("personal_news_items_digest_date_idx").on(table.digestDate),
    starredIdx: index("personal_news_items_starred_idx").on(table.isStarred),
    userUrlUniqueIdx: uniqueIndex("personal_news_items_user_url_uidx").on(table.userId, table.url),
    fkSource: foreignKey({ columns: [table.sourceId], foreignColumns: [personalNewsSources.id] }),
  })
);

export const personalNewsDigests = pgTable(
  "personal_news_digests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    digestDate: date("digest_date").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    topics: text("topics").notNull(),
    digestMarkdown: text("digest_markdown").notNull(),
    telegramMessage: text("telegram_message"),
    telegramSentAt: timestamp("telegram_sent_at"),
    itemCount: integer("item_count").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("personal_news_digests_user_id_idx").on(table.userId),
    digestDateIdx: index("personal_news_digests_digest_date_idx").on(table.digestDate),
    statusIdx: index("personal_news_digests_status_idx").on(table.status),
    userDateUniqueIdx: uniqueIndex("personal_news_digests_user_date_uidx").on(table.userId, table.digestDate),
  })
);

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
    userLuckyNumbers: text("user_lucky_numbers"), // números informados pelo usuário (texto livre/lista)
    officialLuckyNumber: varchar("official_lucky_number", { length: 120 }), // número oficial sorteado
    inferredLuckyNumber: varchar("inferred_lucky_number", { length: 120 }), // número inferido via regra
    externalId: varchar("external_id", { length: 100 }), // ID externo (ex: numeroCA do SCPC)
    source: varchar("source", { length: 50 }).default("manual"), // "manual" | "scpc"
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

// ── TO-DO / Tarefas Pessoais ──
export const personalTasks = pgTable(
  "personal_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    dueDate: date("due_date"), // nullable — tarefas sem prazo definido
    priority: varchar("priority", { length: 20 }).default("medium"), // "low"|"medium"|"high"|"critical"
    status: varchar("status", { length: 20 }).default("pending"), // "pending"|"in_progress"|"done"|"cancelled"
    category: varchar("category", { length: 50 }).default("personal"), // "work"|"personal"|"financial"|"health"|"errand"|"other"
    notifyTelegram: boolean("notify_telegram").default(true),
    notifyDaysBefore: integer("notify_days_before").default(1),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("personal_tasks_user_id_idx").on(table.userId),
    statusIdx: index("personal_tasks_status_idx").on(table.status),
    dueDateIdx: index("personal_tasks_due_date_idx").on(table.dueDate),
    priorityIdx: index("personal_tasks_priority_idx").on(table.priority),
  })
);

// ── Wishlist (Livros, Filmes, Séries, Discos) ──
export const personalWishlist = pgTable(
  "personal_wishlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    type: varchar("type", { length: 20 }).notNull(), // "book"|"movie"|"series"|"album"
    title: varchar("title", { length: 255 }).notNull(),
    creator: varchar("creator", { length: 255 }), // autor/diretor/artista
    year: integer("year"),
    genre: varchar("genre", { length: 100 }),
    notes: text("notes"),
    status: varchar("status", { length: 20 }).default("want"), // "want"|"watching"|"finished"
    rating: smallint("rating"), // 1-5, preenchido ao finalizar
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("personal_wishlist_user_id_idx").on(table.userId),
    typeIdx: index("personal_wishlist_type_idx").on(table.type),
    statusIdx: index("personal_wishlist_status_idx").on(table.status),
  })
);

// ── Concursos Literários ──
export const literaryContests = pgTable(
  "literary_contests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    organizer: varchar("organizer", { length: 255 }),
    theme: text("theme"),
    modality: varchar("modality", { length: 50 }), // "poema" | "conto" | "cronica" | "microconto" | "outro"
    deadline: date("deadline"),
    link: varchar("link", { length: 500 }),
    prize: varchar("prize", { length: 255 }),
    status: varchar("status", { length: 50 }).default("rascunho"), // "rascunho" | "enviado" | "premiado" | "nao_premiado"
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("literary_contests_user_id_idx").on(table.userId),
    deadlineIdx: index("literary_contests_deadline_idx").on(table.deadline),
    statusIdx: index("literary_contests_status_idx").on(table.status),
  })
);

// ── Sites de Promoções ──
export const promotionSites = pgTable(
  "promotion_sites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(), // Nome do site, ex: "Pelando"
    url: text("url").notNull(),                        // URL, ex: "https://www.pelando.com.br"
    description: text("description"),                  // O que postam, categorias, etc.
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("promotion_sites_user_id_idx").on(table.userId),
    activeIdx: index("promotion_sites_active_idx").on(table.isActive),
  })
);

// ── Loterias (controle manual) ──
export const personalLotteries = pgTable(
  "personal_lotteries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    gameType: varchar("game_type", { length: 50 }).notNull(), // "mega_sena" | "lotofacil" | ...
    gameName: varchar("game_name", { length: 255 }).notNull(),
    drawDate: date("draw_date"),
    betNumbers: text("bet_numbers"),
    drawResults: text("draw_results"),
    isChecked: boolean("is_checked").notNull().default(false),
    hasWon: boolean("has_won").notNull().default(false),
    winAmount: decimal("win_amount", { precision: 12, scale: 2 }),
    status: varchar("status", { length: 50 }).notNull().default("pending"), // "pending" | "closed_no_win" | "won"
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("personal_lotteries_user_id_idx").on(table.userId),
    gameTypeIdx: index("personal_lotteries_game_type_idx").on(table.gameType),
    drawDateIdx: index("personal_lotteries_draw_date_idx").on(table.drawDate),
    statusIdx: index("personal_lotteries_status_idx").on(table.status),
  })
);
