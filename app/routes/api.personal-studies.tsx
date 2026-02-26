/**
 * API /api/personal-studies
 * CRUD para Cursos, Matérias e Eventos do Módulo Estudos
 */

import { data } from "react-router";
import type { Route } from "./+types/api.personal-studies";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import {
  personalStudyCourses,
  personalStudySubjects,
  personalStudyEvents,
} from "../../drizzle/schema";
import { eq, and, isNull, asc, desc } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "listar_cursos") {
    const cursos = await db
      .select()
      .from(personalStudyCourses)
      .where(eq(personalStudyCourses.userId, user.id))
      .orderBy(asc(personalStudyCourses.createdAt));
    return data({ cursos });
  }

  if (action === "listar_materias") {
    const courseId = url.searchParams.get("courseId");
    const where = courseId
      ? and(
          eq(personalStudySubjects.userId, user.id),
          eq(personalStudySubjects.courseId, courseId),
          isNull(personalStudySubjects.deletedAt)
        )
      : and(
          eq(personalStudySubjects.userId, user.id),
          isNull(personalStudySubjects.deletedAt)
        );
    const materias = await db
      .select()
      .from(personalStudySubjects)
      .where(where)
      .orderBy(asc(personalStudySubjects.nome));
    return data({ materias });
  }

  if (action === "listar_eventos") {
    const subjectId = url.searchParams.get("subjectId");
    const where = subjectId
      ? and(
          eq(personalStudyEvents.userId, user.id),
          eq(personalStudyEvents.subjectId, subjectId)
        )
      : eq(personalStudyEvents.userId, user.id);
    const eventos = await db
      .select()
      .from(personalStudyEvents)
      .where(where)
      .orderBy(asc(personalStudyEvents.data));
    return data({ eventos });
  }

  return data({ error: "Action inválida" }, { status: 400 });
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const body = await request.json();
  const { action: act, ...fields } = body;

  if (act === "criar_curso") {
    const [curso] = await db
      .insert(personalStudyCourses)
      .values({
        userId: user.id,
        nome: fields.nome,
        nivel: fields.nivel ?? "graduacao",
        instituicao: fields.instituicao ?? null,
        periodoAtual: fields.periodoAtual ?? null,
        status: fields.status ?? "ativo",
        observacoes: fields.observacoes ?? null,
      })
      .returning();
    return data({ curso });
  }

  if (act === "criar_materia") {
    const [materia] = await db
      .insert(personalStudySubjects)
      .values({
        courseId: fields.courseId,
        userId: user.id,
        nome: fields.nome,
        professor: fields.professor ?? null,
        cargaHoraria: fields.cargaHoraria ?? null,
        status: fields.status ?? "cursando",
        anotacoes: fields.anotacoes ?? null,
      })
      .returning();
    return data({ materia });
  }

  if (act === "criar_evento") {
    const [evento] = await db
      .insert(personalStudyEvents)
      .values({
        subjectId: fields.subjectId,
        userId: user.id,
        tipo: fields.tipo ?? "prova",
        titulo: fields.titulo,
        data: fields.data,
        peso: fields.peso ?? null,
        concluido: false,
      })
      .returning();
    return data({ evento });
  }

  if (act === "atualizar_materia") {
    const [materia] = await db
      .update(personalStudySubjects)
      .set({
        nome: fields.nome,
        professor: fields.professor,
        cargaHoraria: fields.cargaHoraria,
        notaFinal: fields.notaFinal,
        frequencia: fields.frequencia,
        status: fields.status,
        anotacoes: fields.anotacoes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(personalStudySubjects.id, fields.id),
          eq(personalStudySubjects.userId, user.id)
        )
      )
      .returning();
    return data({ materia });
  }

  if (act === "atualizar_evento") {
    const [evento] = await db
      .update(personalStudyEvents)
      .set({
        titulo: fields.titulo,
        data: fields.data,
        peso: fields.peso,
        nota: fields.nota,
        concluido: fields.concluido,
      })
      .where(
        and(
          eq(personalStudyEvents.id, fields.id),
          eq(personalStudyEvents.userId, user.id)
        )
      )
      .returning();
    return data({ evento });
  }

  if (act === "deletar_materia") {
    await db
      .update(personalStudySubjects)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(personalStudySubjects.id, fields.id),
          eq(personalStudySubjects.userId, user.id)
        )
      );
    return data({ ok: true });
  }

  if (act === "deletar_evento") {
    await db
      .delete(personalStudyEvents)
      .where(
        and(
          eq(personalStudyEvents.id, fields.id),
          eq(personalStudyEvents.userId, user.id)
        )
      );
    return data({ ok: true });
  }

  return data({ error: "Action inválida" }, { status: 400 });
}
