/**
 * GET /personal-life/studies
 * Módulo Estudos — Faculdades, Matérias, Provas e Trabalhos
 */

import { useState } from "react";
import { useLoaderData, useFetcher, Link } from "react-router";
import type { Route } from "./+types/personal-life.studies";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import {
  personalStudyCourses,
  personalStudySubjects,
  personalStudyEvents,
} from "../../drizzle/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { ArrowLeft, Plus, Calendar, BookOpen, GraduationCap, ClipboardList, CheckCircle2, Circle } from "lucide-react";
import { Button } from "~/components/ui/button";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const cursos = await db
    .select()
    .from(personalStudyCourses)
    .where(eq(personalStudyCourses.userId, user.id))
    .orderBy(asc(personalStudyCourses.createdAt));

  const materias = await db
    .select()
    .from(personalStudySubjects)
    .where(and(eq(personalStudySubjects.userId, user.id), isNull(personalStudySubjects.deletedAt)))
    .orderBy(asc(personalStudySubjects.nome));

  const eventos = await db
    .select()
    .from(personalStudyEvents)
    .where(eq(personalStudyEvents.userId, user.id))
    .orderBy(asc(personalStudyEvents.data));

  return { cursos, materias, eventos };
}

type Tab = "cursos" | "materias" | "agenda";

const NIVEL_LABEL: Record<string, string> = {
  graduacao: "Graduação",
  pos: "Pós-graduação",
  mba: "MBA",
  tecnico: "Técnico",
  livre: "Curso livre",
};

const STATUS_CURSO_COLOR: Record<string, string> = {
  ativo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  concluido: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  trancado: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_MATERIA_COLOR: Record<string, string> = {
  cursando: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  aprovado: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  reprovado: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  trancado: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const TIPO_EVENTO_LABEL: Record<string, string> = {
  prova: "📝 Prova",
  trabalho: "📄 Trabalho",
  apresentacao: "🎤 Apresentação",
  entrega: "📬 Entrega",
  outro: "📌 Outro",
};

function buildCalendarLink(titulo: string, data: string, nomeCurso: string, nomeMateria: string) {
  const dateStr = data.replace(/-/g, "");
  const title = encodeURIComponent(`${titulo} — ${nomeMateria}`);
  const details = encodeURIComponent(`Matéria: ${nomeMateria} | Curso: ${nomeCurso}`);
  return `https://calendar.google.com/calendar/r/eventedit?text=${title}&dates=${dateStr}/${dateStr}&details=${details}`;
}

function formatDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function daysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export default function StudiesPage({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  const { cursos, materias, eventos } = loaderData;
  const fetcher = useFetcher();
  const [tab, setTab] = useState<Tab>("cursos");

  // Forms state
  const [showCursoForm, setShowCursoForm] = useState(false);
  const [showMateriaForm, setShowMateriaForm] = useState(false);
  const [showEventoForm, setShowEventoForm] = useState(false);
  const [selectedCursoId, setSelectedCursoId] = useState<string>(cursos[0]?.id ?? "");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(materias[0]?.id ?? "");

  const cursosAtivos = cursos.filter((c) => c.status === "ativo");
  const materiasFiltered = selectedCursoId
    ? materias.filter((m) => m.courseId === selectedCursoId)
    : materias;
  const eventosProximos = eventos.filter((e) => !e.concluido && daysUntil(e.data) >= 0);

  // Lookup maps
  const cursoById = Object.fromEntries(cursos.map((c) => [c.id, c]));
  const materiaById = Object.fromEntries(materias.map((m) => [m.id, m]));

  function submitJSON(payload: object) {
    fetcher.submit(JSON.stringify(payload), {
      method: "POST",
      action: "/api/personal-studies",
      encType: "application/json",
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link to="/personal-life" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🎓 Estudos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Faculdades, matérias, provas e trabalhos
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{cursosAtivos.length}</p>
            <p className="text-xs text-gray-500">Cursos ativos</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{materias.filter(m => m.status === "cursando").length}</p>
            <p className="text-xs text-gray-500">Matérias em curso</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-orange-500">{eventosProximos.length}</p>
            <p className="text-xs text-gray-500">Eventos pendentes</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2 border-b border-gray-200 dark:border-gray-800">
          {(["cursos", "materias", "agenda"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 px-3 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t === "cursos" ? "🏫 Cursos" : t === "materias" ? "📚 Matérias" : "📅 Agenda"}
            </button>
          ))}
        </div>

        {/* ── TAB: CURSOS ───────────────────────────────────── */}
        {tab === "cursos" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowCursoForm(!showCursoForm)}>
                <Plus className="mr-1 h-4 w-4" /> Novo Curso
              </Button>
            </div>

            {showCursoForm && (
              <form
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  submitJSON({
                    action: "criar_curso",
                    nome: fd.get("nome"),
                    nivel: fd.get("nivel"),
                    instituicao: fd.get("instituicao"),
                    periodoAtual: fd.get("periodoAtual"),
                    status: "ativo",
                  });
                  setShowCursoForm(false);
                }}
              >
                <h3 className="font-semibold text-gray-900 dark:text-white">Novo Curso</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Nome *</label>
                    <input name="nome" required className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Nível</label>
                    <select name="nivel" className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm">
                      {Object.entries(NIVEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Instituição</label>
                    <input name="instituicao" className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Período atual</label>
                    <input name="periodoAtual" placeholder="ex: 3º semestre" className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowCursoForm(false)}>Cancelar</Button>
                  <Button type="submit" size="sm">Salvar</Button>
                </div>
              </form>
            )}

            {cursos.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-gray-500">
                <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p className="text-sm">Nenhum curso cadastrado ainda.</p>
              </div>
            ) : (
              cursos.map((curso) => (
                <div key={curso.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{curso.nome}</h3>
                      <p className="text-sm text-gray-500">{curso.instituicao} · {NIVEL_LABEL[curso.nivel] ?? curso.nivel}</p>
                      {curso.periodoAtual && <p className="text-xs text-gray-400 mt-0.5">{curso.periodoAtual}</p>}
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_CURSO_COLOR[curso.status] ?? ""}`}>
                      {curso.status}
                    </span>
                  </div>
                  {curso.observacoes && <p className="mt-2 text-xs text-gray-500">{curso.observacoes}</p>}
                  <div className="mt-2 text-xs text-gray-400">
                    {materias.filter(m => m.courseId === curso.id).length} matéria(s)
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TAB: MATÉRIAS ─────────────────────────────────── */}
        {tab === "materias" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              {cursosAtivos.length > 0 && (
                <select
                  value={selectedCursoId}
                  onChange={(e) => setSelectedCursoId(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                >
                  <option value="">Todos os cursos</option>
                  {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              )}
              <Button size="sm" onClick={() => setShowMateriaForm(!showMateriaForm)} disabled={cursos.length === 0}>
                <Plus className="mr-1 h-4 w-4" /> Nova Matéria
              </Button>
            </div>

            {showMateriaForm && (
              <form
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  submitJSON({
                    action: "criar_materia",
                    courseId: fd.get("courseId"),
                    nome: fd.get("nome"),
                    professor: fd.get("professor"),
                    cargaHoraria: fd.get("cargaHoraria") ? Number(fd.get("cargaHoraria")) : null,
                    status: "cursando",
                  });
                  setShowMateriaForm(false);
                }}
              >
                <h3 className="font-semibold text-gray-900 dark:text-white">Nova Matéria</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">Curso *</label>
                    <select name="courseId" required defaultValue={selectedCursoId} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm">
                      {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Matéria *</label>
                    <input name="nome" required className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Professor</label>
                    <input name="professor" className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Carga horária (h)</label>
                    <input name="cargaHoraria" type="number" min="0" className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowMateriaForm(false)}>Cancelar</Button>
                  <Button type="submit" size="sm">Salvar</Button>
                </div>
              </form>
            )}

            {materiasFiltered.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-gray-500">
                <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p className="text-sm">Nenhuma matéria cadastrada.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Matéria</th>
                      <th className="px-4 py-3 text-left">Professor</th>
                      <th className="px-4 py-3 text-center">Nota</th>
                      <th className="px-4 py-3 text-center">Freq.</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {materiasFiltered.map((m) => (
                      <tr key={m.id} className="bg-white dark:bg-gray-900">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{m.nome}</td>
                        <td className="px-4 py-3 text-gray-500">{m.professor ?? "—"}</td>
                        <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{m.notaFinal ?? "—"}</td>
                        <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{m.frequencia ? `${m.frequencia}%` : "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_MATERIA_COLOR[m.status] ?? ""}`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: AGENDA ───────────────────────────────────── */}
        {tab === "agenda" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{eventosProximos.length} evento(s) pendente(s)</p>
              <Button size="sm" onClick={() => setShowEventoForm(!showEventoForm)} disabled={materias.length === 0}>
                <Plus className="mr-1 h-4 w-4" /> Novo Evento
              </Button>
            </div>

            {showEventoForm && (
              <form
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  submitJSON({
                    action: "criar_evento",
                    subjectId: fd.get("subjectId"),
                    tipo: fd.get("tipo"),
                    titulo: fd.get("titulo"),
                    data: fd.get("data"),
                    peso: fd.get("peso") ? Number(fd.get("peso")) : null,
                  });
                  setShowEventoForm(false);
                }}
              >
                <h3 className="font-semibold text-gray-900 dark:text-white">Novo Evento</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">Matéria *</label>
                    <select name="subjectId" required defaultValue={selectedSubjectId} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm">
                      {materias.map((m) => <option key={m.id} value={m.id}>{m.nome} ({cursoById[m.courseId]?.nome ?? ""})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Tipo</label>
                    <select name="tipo" className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm">
                      {Object.entries(TIPO_EVENTO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Data *</label>
                    <input name="data" type="date" required className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">Título *</label>
                    <input name="titulo" required placeholder="ex: Prova N1, Trabalho em grupo..." className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Peso (%)</label>
                    <input name="peso" type="number" min="0" max="100" step="0.01" placeholder="ex: 30" className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowEventoForm(false)}>Cancelar</Button>
                  <Button type="submit" size="sm">Salvar</Button>
                </div>
              </form>
            )}

            {eventos.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-gray-500">
                <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p className="text-sm">Nenhum evento cadastrado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {eventos.map((ev) => {
                  const materia = materiaById[ev.subjectId];
                  const curso = materia ? cursoById[materia.courseId] : null;
                  const days = daysUntil(ev.data);
                  const isPast = days < 0;
                  return (
                    <div
                      key={ev.id}
                      className={`rounded-xl border p-4 ${ev.concluido ? "opacity-60 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => submitJSON({ action: "atualizar_evento", id: ev.id, titulo: ev.titulo, data: ev.data, concluido: !ev.concluido })}
                            className="mt-0.5 text-gray-400 hover:text-green-500"
                          >
                            {ev.concluido ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4" />}
                          </button>
                          <div>
                            <p className={`font-medium text-sm ${ev.concluido ? "line-through text-gray-400" : "text-gray-900 dark:text-white"}`}>
                              {TIPO_EVENTO_LABEL[ev.tipo] ?? ev.tipo} — {ev.titulo}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {materia?.nome ?? "?"} · {curso?.nome ?? "?"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-medium ${isPast ? "text-gray-400" : days === 0 ? "text-red-500" : days <= 3 ? "text-orange-500" : "text-gray-500"}`}>
                            {formatDate(ev.data)}
                            {!ev.concluido && !isPast && (
                              <span className="block">{days === 0 ? "Hoje!" : `${days}d`}</span>
                            )}
                          </p>
                          {!ev.concluido && materia && curso && (
                            <a
                              href={buildCalendarLink(ev.titulo, ev.data, curso.nome, materia.nome)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs text-green-600 hover:underline dark:text-green-400"
                            >
                              📅 Calendar
                            </a>
                          )}
                        </div>
                      </div>
                      {ev.peso && (
                        <p className="mt-1 text-xs text-gray-400 ml-6">Peso: {ev.peso}%{ev.nota ? ` · Nota: ${ev.nota}` : ""}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
