/**
 * Personal Studies Schema — Módulo Estudos (Vida Pessoal)
 *
 * Rastreia faculdades, matérias, provas e trabalhos do Luiz.
 */

import { pgTable, uuid, text, varchar, timestamp, boolean, decimal, date, integer, index } from "drizzle-orm/pg-core";

// ── 1. Cursos / Faculdades ──────────────────────────────────────────────────
export const personalStudyCourses = pgTable(
  "personal_study_courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    nome: varchar("nome", { length: 255 }).notNull(),
    nivel: varchar("nivel", { length: 20 }).notNull().default("graduacao"), // graduacao | pos | mba | tecnico | livre
    instituicao: varchar("instituicao", { length: 255 }),
    periodoAtual: varchar("periodo_atual", { length: 50 }), // ex: "3º semestre", "2026/1"
    status: varchar("status", { length: 20 }).notNull().default("ativo"), // ativo | concluido | trancado
    observacoes: text("observacoes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("psc_user_id_idx").on(table.userId),
  })
);

// ── 2. Matérias por Curso ───────────────────────────────────────────────────
export const personalStudySubjects = pgTable(
  "personal_study_subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id").notNull().references(() => personalStudyCourses.id),
    userId: uuid("user_id").notNull(),
    nome: varchar("nome", { length: 255 }).notNull(),
    professor: varchar("professor", { length: 255 }),
    cargaHoraria: integer("carga_horaria"), // horas
    notaFinal: decimal("nota_final", { precision: 5, scale: 2 }), // ex: 8.50
    frequencia: decimal("frequencia", { precision: 5, scale: 2 }), // ex: 87.50 (%)
    status: varchar("status", { length: 20 }).notNull().default("cursando"), // cursando | aprovado | reprovado | trancado
    anotacoes: text("anotacoes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    courseIdIdx: index("pss_course_id_idx").on(table.courseId),
    userIdIdx: index("pss_user_id_idx").on(table.userId),
  })
);

// ── 3. Eventos: Provas, Trabalhos, Prazos ──────────────────────────────────
export const personalStudyEvents = pgTable(
  "personal_study_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectId: uuid("subject_id").notNull().references(() => personalStudySubjects.id),
    userId: uuid("user_id").notNull(),
    tipo: varchar("tipo", { length: 30 }).notNull().default("prova"), // prova | trabalho | apresentacao | entrega | outro
    titulo: varchar("titulo", { length: 255 }).notNull(),
    data: date("data").notNull(),
    peso: decimal("peso", { precision: 5, scale: 2 }), // peso na nota (ex: 30.00 = 30%)
    nota: decimal("nota", { precision: 5, scale: 2 }), // nota obtida
    concluido: boolean("concluido").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    subjectIdIdx: index("pse_subject_id_idx").on(table.subjectId),
    userIdIdx: index("pse_user_id_idx").on(table.userId),
    dataIdx: index("pse_data_idx").on(table.data),
  })
);
