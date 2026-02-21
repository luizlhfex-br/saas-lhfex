/**
 * Public Procurement Schema (Compras Públicas)
 * 
 * Sistema de gestão de processos de compras públicas conforme Lei 14.133/21.
 * Módulo focado em apoio jurídico/administrativo para licitações, editais e processos.
 */

import { pgTable, uuid, text, varchar, timestamp, boolean, decimal, date, integer, index, foreignKey } from "drizzle-orm/pg-core";
import { users } from "./auth";

// ── Editais (Anúncios de Processos de Compra) ──
export const publicProcurementNotices = pgTable(
  "public_procurement_notices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(), // "Edital: Aquisição de Equipamentos Informáticos"
    description: text("description"), // Descrição detalhada do processo
    processNumber: varchar("process_number", { length: 50 }).unique().notNull(), // Ex: "UPA-2026-001" (auto-gerado)
    organizationName: varchar("organization_name", { length: 255 }).notNull(), // Ex: "UPA-CS"
    modalityCode: varchar("modality_code", { length: 20 }).notNull(), // Ex: "LICITACAO_ABERTA", "PREGAO_ELETRONICO", "RDC"
    modalityLabel: varchar("modality_label", { length: 100 }).notNull(), // Ex: "Licitação Aberta"
    status: varchar("status", { length: 50 }).notNull(), // "draft", "published", "proposals_open", "proposals_ended", "contracts_executed", "closed", "cancelled"
    budgetEstimate: decimal("budget_estimate", { precision: 15, scale: 2 }), // Valor orçado
    budgetCurrency: varchar("budget_currency", { length: 3 }).default("BRL"),
    publicationDate: date("publication_date"),
    closureDate: date("closure_date"), // Data limite para propostas
    contractedValue: decimal("contracted_value", { precision: 15, scale: 2 }), // Valor final contratado
    contestCount: integer("contest_count").default(0), // Número de impugnações/recursos
    proposalCount: integer("proposal_count").default(0), // Número de propostas recebidas
    notes: text("notes"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("procurement_notices_user_id_idx").on(table.userId),
    processNumberIdx: index("procurement_notices_process_number_idx").on(table.processNumber),
    statusIdx: index("procurement_notices_status_idx").on(table.status),
    closureDateIdx: index("procurement_notices_closure_date_idx").on(table.closureDate),
  })
);

// ── Processos de Compras (Items/Lotes dentro de um Edital) ──
export const publicProcurementProcesses = pgTable(
  "public_procurement_processes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    noticeId: uuid("notice_id").notNull(),
    lotNumber: integer("lot_number").notNull(), // Ex: 1, 2, 3
    itemNumber: integer("item_number").notNull(), // Item dentro do lote
    description: varchar("description", { length: 500 }).notNull(), // "Aquisição de 100 computadores portáteis"
    quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
    unit: varchar("unit", { length: 50 }).notNull(), // "un", "caixa", "kg", etc
    estimatedUnitPrice: decimal("estimated_unit_price", { precision: 15, scale: 2 }),
    estimatedTotalPrice: decimal("estimated_total_price", { precision: 15, scale: 2 }),
    ncmCode: varchar("ncm_code", { length: 8 }), // Código NCM do produto
    specifications: text("specifications"), // Especificações técnicas detalhadas
    status: varchar("status", { length: 50 }).notNull(), // "pending", "in_negotiation", "contracted", "delivered", "cancelled"
    contractorName: varchar("contractor_name", { length: 255 }), // Nome da empresa contratada
    contractorCnpj: varchar("contractor_cnpj", { length: 20 }), // CNPJ da empresa
    agreedPrice: decimal("agreed_price", { precision: 15, scale: 2 }), // Preço final acordado
    deliveryDate: date("delivery_date"), // Data prevista de entrega
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    noticeIdIdx: index("procurement_processes_notice_id_idx").on(table.noticeId),
    statusIdx: index("procurement_processes_status_idx").on(table.status),
    fk_notice: foreignKey({ columns: [table.noticeId], foreignColumns: [publicProcurementNotices.id] }),
  })
);

// ── Modelos de Termo de Referência (TR) ──
export const trTemplates = pgTable(
  "tr_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(), // "TR Padrão - Equipamentos de TI"
    description: text("description"),
    category: varchar("category", { length: 100 }).notNull(), // "TI", "Limpeza", "Serviços", etc
    content: text("content").notNull(), // Conteúdo do TR em markdown/html
    version: integer("version").default(1),
    isActive: boolean("is_active").default(true),
    tags: varchar("tags", { length: 255 }), // "Lei14133,equipamentos,TI"
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("tr_templates_user_id_idx").on(table.userId),
    categoryIdx: index("tr_templates_category_idx").on(table.category),
  })
);

// ── Associação: Edital com Modelos TR ──
export const noticeToTrTemplate = pgTable(
  "notice_to_tr_template",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    noticeId: uuid("notice_id").notNull(),
    templateId: uuid("template_id").notNull(),
    customizedContent: text("customized_content"), // TR customizado para este edital
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    noticeIdIdx: index("notice_to_tr_template_notice_id_idx").on(table.noticeId),
    templateIdIdx: index("notice_to_tr_template_template_id_idx").on(table.templateId),
    fk_notice: foreignKey({ columns: [table.noticeId], foreignColumns: [publicProcurementNotices.id] }),
    fk_template: foreignKey({ columns: [table.templateId], foreignColumns: [trTemplates.id] }),
  })
);

// ── Checklists de Conformidade (Lei 14.133/21) ──
export const complianceChecklists = pgTable(
  "compliance_checklists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    noticeId: uuid("notice_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(), // "Checklist - Habilitação Jurídica"
    phase: varchar("phase", { length: 100 }).notNull(), // "pre_edital", "habilitacao", "julgamento", "contratacao"
    status: varchar("status", { length: 50 }).default("pending"), // "pending", "in_progress", "completed", "failed"
    items: text("items").notNull(), // JSON array: [{id: 1, title: "...", done: true, doneBy: "...", doneAt: "..."}]
    notes: text("notes"),
    requiredBy: date("required_by"), // Data-limite para completação
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    noticeIdIdx: index("compliance_checklists_notice_id_idx").on(table.noticeId),
    phaseIdx: index("compliance_checklists_phase_idx").on(table.phase),
    fk_notice: foreignKey({ columns: [table.noticeId], foreignColumns: [publicProcurementNotices.id] }),
  })
);

// ── Histórico de Mudanças (Auditoria) ──
export const publicProcurementHistory = pgTable(
  "public_procurement_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    noticeId: uuid("notice_id").notNull(),
    changeType: varchar("change_type", { length: 50 }).notNull(), // "status_change", "document_upload", "date_extension", "cancellation"
    previousValue: text("previous_value"), // JSON: estado anterior
    newValue: text("new_value"), // JSON: novo estado
    reason: text("reason"), // Motivo da mudança
    changedBy: uuid("changed_by").notNull(), // Usuário que fez a mudança
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    noticeIdIdx: index("procurement_history_notice_id_idx").on(table.noticeId),
    changeTypeIdx: index("procurement_history_change_type_idx").on(table.changeType),
    fk_notice: foreignKey({ columns: [table.noticeId], foreignColumns: [publicProcurementNotices.id] }),
  })
);

// ── Alertas e Prazos Críticos ──
export const procurementAlerts = pgTable(
  "procurement_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    noticeId: uuid("notice_id"),
    processId: uuid("process_id"),
    alertType: varchar("alert_type", { length: 50 }).notNull(), // "proposal_deadline", "delivery_deadline", "budget_alert", "contest_alert"
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    dueDate: date("due_date").notNull(),
    severity: varchar("severity", { length: 20 }).notNull(), // "low", "medium", "high", "critical"
    status: varchar("status", { length: 50 }).default("pending"), // "pending", "acknowledged", "resolved", "expired"
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    noticeIdIdx: index("procurement_alerts_notice_id_idx").on(table.noticeId),
    dueDateIdx: index("procurement_alerts_due_date_idx").on(table.dueDate),
    severityIdx: index("procurement_alerts_severity_idx").on(table.severity),
  })
);
