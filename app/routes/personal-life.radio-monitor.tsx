/**
 * GET/POST /personal-life/radio-monitor
 * Monitor de Rádio — estações com keywords por estação + feed de eventos
 */

import { Form, redirect, useLoaderData, useNavigation } from "react-router";
import { useState } from "react";
import { db } from "~/lib/db.server";
import { requireAuth } from "~/lib/auth.server";
import { radioStations, radioMonitorEvents, radioMonitorKeywords, radioMonitorSongs } from "../../drizzle/schema";
import { desc, eq, or, isNull } from "drizzle-orm";
import {
  Radio,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Wifi,
  WifiOff,
  Tag,
  Globe,
  Music2,
} from "lucide-react";
import { Button } from "~/components/ui/button";

type Station = typeof radioStations.$inferSelect;
type Keyword = typeof radioMonitorKeywords.$inferSelect;
type Event = typeof radioMonitorEvents.$inferSelect;
type Song = typeof radioMonitorSongs.$inferSelect;

export async function loader({ request }: { request: Request }) {
  await requireAuth(request);

  const [stations, keywords, events, songs] = await Promise.all([
    db.select().from(radioStations).orderBy(desc(radioStations.createdAt)),
    db.select().from(radioMonitorKeywords).orderBy(desc(radioMonitorKeywords.createdAt)),
    db.select().from(radioMonitorEvents).orderBy(desc(radioMonitorEvents.recordedAt)).limit(20),
    db.select().from(radioMonitorSongs).orderBy(desc(radioMonitorSongs.detectedAt)).limit(50),
  ]);

  return { stations, keywords, events, songs };
}

export async function action({ request }: { request: Request }) {
  await requireAuth(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "create_station") {
    const name = String(formData.get("name") || "").trim();
    if (name) {
      await db.insert(radioStations).values({
        name,
        frequency: String(formData.get("frequency") || "").trim() || null,
        city: String(formData.get("city") || "").trim() || null,
        state: String(formData.get("state") || "").trim().toUpperCase() || null,
        streamUrl: String(formData.get("streamUrl") || "").trim() || null,
        monitoringEnabled: String(formData.get("monitoringEnabled") || "false") === "true",
        updatedAt: new Date(),
      });
    }
  }

  if (intent === "toggle_station") {
    const stationId = String(formData.get("stationId") || "");
    const current = String(formData.get("current") || "false") === "true";
    if (stationId) {
      await db
        .update(radioStations)
        .set({ monitoringEnabled: !current, updatedAt: new Date() })
        .where(eq(radioStations.id, stationId));
    }
  }

  if (intent === "edit_stream") {
    const stationId = String(formData.get("stationId") || "");
    const streamUrl = String(formData.get("streamUrl") || "").trim() || null;
    if (stationId) {
      await db
        .update(radioStations)
        .set({ streamUrl, updatedAt: new Date() })
        .where(eq(radioStations.id, stationId));
    }
  }

  if (intent === "delete_station") {
    const stationId = String(formData.get("stationId") || "");
    if (stationId) {
      // Also delete station keywords
      await db.delete(radioMonitorKeywords).where(eq(radioMonitorKeywords.stationId, stationId));
      await db.delete(radioStations).where(eq(radioStations.id, stationId));
    }
  }

  if (intent === "create_keyword") {
    const keyword = String(formData.get("keyword") || "").trim();
    if (keyword) {
      const stationId = String(formData.get("stationId") || "").trim() || null;
      await db.insert(radioMonitorKeywords).values({
        keyword,
        stationId,
        category: String(formData.get("category") || "promotion").trim() || null,
        priority: String(formData.get("priority") || "medium").trim(),
      });
    }
  }

  if (intent === "toggle_keyword") {
    const keywordId = String(formData.get("keywordId") || "");
    const isActive = String(formData.get("isActive") || "false") === "true";
    if (keywordId) {
      await db
        .update(radioMonitorKeywords)
        .set({ isActive: !isActive })
        .where(eq(radioMonitorKeywords.id, keywordId));
    }
  }

  if (intent === "delete_keyword") {
    const keywordId = String(formData.get("keywordId") || "");
    if (keywordId) {
      await db.delete(radioMonitorKeywords).where(eq(radioMonitorKeywords.id, keywordId));
    }
  }

  if (intent === "mark_reviewed") {
    const eventId = String(formData.get("eventId") || "");
    if (eventId) {
      await db
        .update(radioMonitorEvents)
        .set({ reviewed: true })
        .where(eq(radioMonitorEvents.id, eventId));
    }
  }

  return redirect("/personal-life/radio-monitor");
}

const CATEGORY_LABELS: Record<string, string> = {
  promotion: "Promoção",
  raffle: "Sorteio",
  discount: "Desconto",
  contest: "Concurso",
};

function KeywordBadge({ kw, onDelete, onToggle, isSubmitting }: {
  kw: Keyword;
  onDelete: () => void;
  onToggle: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${
      kw.isActive
        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
        : "border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800"
    }`}>
      <Tag className="h-3 w-3 shrink-0" />
      <span className={kw.isActive ? "" : "line-through"}>{kw.keyword}</span>
      <span className="text-[10px] opacity-60">{CATEGORY_LABELS[kw.category ?? ""] ?? kw.category}</span>
      <button onClick={onToggle} disabled={isSubmitting} title={kw.isActive ? "Desativar" : "Ativar"} className="ml-0.5 opacity-70 hover:opacity-100">
        {kw.isActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
      </button>
      <button onClick={onDelete} disabled={isSubmitting} title="Remover" className="opacity-50 hover:text-red-500 hover:opacity-100">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function StationCard({ station, keywords }: { station: Station; keywords: Keyword[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showAddKw, setShowAddKw] = useState(false);
  const [editStream, setEditStream] = useState(false);
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const stationKws = keywords.filter(k => k.stationId === station.id);
  const activeCount = stationKws.filter(k => k.isActive).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Card header */}
      <div className="flex items-center gap-3 p-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          station.monitoringEnabled
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-gray-100 text-gray-400 dark:bg-gray-800"
        }`}>
          <Radio className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{station.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {[station.frequency, station.city, station.state].filter(Boolean).join(" • ")}
            {activeCount > 0 && <span className="ml-2 text-blue-500">{activeCount} keyword{activeCount !== 1 ? "s" : ""}</span>}
          </p>
        </div>

        {/* Toggle monitoring */}
        <Form method="post">
          <input type="hidden" name="intent" value="toggle_station" />
          <input type="hidden" name="stationId" value={station.id} />
          <input type="hidden" name="current" value={String(station.monitoringEnabled)} />
          <button
            type="submit"
            title={station.monitoringEnabled ? "Pausar monitoramento" : "Ativar monitoramento"}
            className={`rounded-lg p-1.5 transition-colors ${
              station.monitoringEnabled
                ? "text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {station.monitoringEnabled ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          </button>
        </Form>

        {/* Delete station */}
        <Form method="post" onSubmit={(e) => { if (!confirm(`Excluir ${station.name} e todas as suas keywords?`)) e.preventDefault(); }}>
          <input type="hidden" name="intent" value="delete_station" />
          <input type="hidden" name="stationId" value={station.id} />
          <button type="submit" title="Excluir estação" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30">
            <Trash2 className="h-4 w-4" />
          </button>
        </Form>

        {/* Expand */}
        <button onClick={() => setExpanded(!expanded)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-800">
          {/* Stream URL */}
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Stream URL</p>
            {editStream ? (
              <Form method="post" className="flex gap-2" onSubmit={() => setEditStream(false)}>
                <input type="hidden" name="intent" value="edit_stream" />
                <input type="hidden" name="stationId" value={station.id} />
                <input
                  type="url"
                  name="streamUrl"
                  defaultValue={station.streamUrl ?? ""}
                  placeholder="https://stream.exemplo.com/radio.mp3"
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <Button type="submit" size="sm" className="h-7 text-xs">Salvar</Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditStream(false)}>Cancelar</Button>
              </Form>
            ) : (
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-xs text-gray-600 dark:text-gray-300">
                  {station.streamUrl || <span className="italic text-gray-400">Não configurado</span>}
                </span>
                <button onClick={() => setEditStream(true)} className="text-xs text-blue-500 hover:underline">Editar</button>
              </div>
            )}
          </div>

          {/* Keywords for this station */}
          <div className="mb-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Keywords desta estação</p>
              <button onClick={() => setShowAddKw(!showAddKw)} className="flex items-center gap-0.5 text-xs text-blue-500 hover:underline">
                <Plus className="h-3 w-3" />
                Adicionar
              </button>
            </div>

            {stationKws.length === 0 && !showAddKw && (
              <p className="text-xs italic text-gray-400">Nenhuma keyword específica. Serão usadas as keywords globais.</p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {stationKws.map(kw => (
                <Form key={kw.id} method="post">
                  <KeywordBadge
                    kw={kw}
                    isSubmitting={isSubmitting}
                    onToggle={() => {
                      const fd = new FormData();
                      fd.set("intent", "toggle_keyword");
                      fd.set("keywordId", kw.id);
                      fd.set("isActive", String(kw.isActive));
                      fetch("/personal-life/radio-monitor", { method: "POST", body: fd });
                    }}
                    onDelete={() => {
                      if (!confirm(`Remover keyword "${kw.keyword}"?`)) return;
                      const fd = new FormData();
                      fd.set("intent", "delete_keyword");
                      fd.set("keywordId", kw.id);
                      fetch("/personal-life/radio-monitor", { method: "POST", body: fd }).then(() => window.location.reload());
                    }}
                  />
                </Form>
              ))}
            </div>

            {/* Add keyword inline */}
            {showAddKw && (
              <Form method="post" className="mt-2 flex flex-wrap gap-2" onSubmit={() => setShowAddKw(false)}>
                <input type="hidden" name="intent" value="create_keyword" />
                <input type="hidden" name="stationId" value={station.id} />
                <input
                  type="text"
                  name="keyword"
                  placeholder="Palavra-chave"
                  required
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <select name="category" className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  <option value="promotion">Promoção</option>
                  <option value="raffle">Sorteio</option>
                  <option value="discount">Desconto</option>
                  <option value="contest">Concurso</option>
                </select>
                <select name="priority" className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="low">Baixa</option>
                </select>
                <Button type="submit" size="sm" className="h-7 text-xs">Adicionar</Button>
              </Form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  const val = Number(confidence ?? 0);
  if (val >= 70) return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">{val}%</span>;
  if (val >= 40) return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">{val}%</span>;
  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">{val}%</span>;
}

function SongConfidenceBadge({ confidence }: { confidence: string | null }) {
  const val = Number(confidence ?? 0);
  if (val >= 85) return <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">{val}%</span>;
  if (val >= 70) return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">{val}%</span>;
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800">{val}%</span>;
}

export default function PersonalLifeRadioMonitorPage() {
  const { stations, keywords, events, songs } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showAddStation, setShowAddStation] = useState(false);

  // Global keywords (no stationId)
  const globalKeywords = keywords.filter(k => !k.stationId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Radio className="h-7 w-7 text-cyan-500" />
            Radio Monitor
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitore streams de rádio em busca de promoções e sorteios
          </p>
        </div>
        <Button onClick={() => setShowAddStation(!showAddStation)} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Nova Estação
        </Button>
      </div>

      {/* Add Station Form */}
      {showAddStation && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-5 dark:border-cyan-900 dark:bg-cyan-900/10">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Adicionar Estação</h2>
          <Form method="post" className="space-y-3" onSubmit={() => setShowAddStation(false)}>
            <input type="hidden" name="intent" value="create_station" />
            <input
              type="text"
              name="name"
              placeholder="Nome da estação *"
              required
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <input name="frequency" placeholder="FM 104.5" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
              <input name="city" placeholder="Cidade" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
              <input name="state" placeholder="SP" maxLength={2} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm uppercase dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" name="monitoringEnabled" value="true" className="h-4 w-4" />
                Monitorar
              </label>
            </div>
            <input
              type="url"
              name="streamUrl"
              placeholder="https://stream.exemplo.com/radio.mp3 (opcional)"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isSubmitting}>Salvar estação</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddStation(false)}>Cancelar</Button>
            </div>
          </Form>
        </div>
      )}

      {/* Stations */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Estações ({stations.length})
        </h2>
        {stations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
            <Radio className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Nenhuma estação cadastrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stations.map(s => (
              <StationCard key={s.id} station={s as Station} keywords={keywords as Keyword[]} />
            ))}
          </div>
        )}
      </div>

      {/* Global Keywords */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Keywords Globais ({globalKeywords.length})
            </h2>
          </div>
        </div>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Aplicadas a todas as estações que não têm keywords próprias.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {globalKeywords.map(kw => (
            <Form key={kw.id} method="post">
              <KeywordBadge
                kw={kw}
                isSubmitting={isSubmitting}
                onToggle={() => {
                  const fd = new FormData();
                  fd.set("intent", "toggle_keyword");
                  fd.set("keywordId", kw.id);
                  fd.set("isActive", String(kw.isActive));
                  fetch("/personal-life/radio-monitor", { method: "POST", body: fd });
                }}
                onDelete={() => {
                  if (!confirm(`Remover keyword "${kw.keyword}"?`)) return;
                  const fd = new FormData();
                  fd.set("intent", "delete_keyword");
                  fd.set("keywordId", kw.id);
                  fetch("/personal-life/radio-monitor", { method: "POST", body: fd }).then(() => window.location.reload());
                }}
              />
            </Form>
          ))}
        </div>

        {/* Add global keyword */}
        <Form method="post" className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="intent" value="create_keyword" />
          {/* No stationId = global */}
          <input
            type="text"
            name="keyword"
            placeholder="Nova keyword global"
            className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <select name="category" className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            <option value="promotion">Promoção</option>
            <option value="raffle">Sorteio</option>
            <option value="discount">Desconto</option>
            <option value="contest">Concurso</option>
          </select>
          <select name="priority" className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="low">Baixa</option>
          </select>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Adicionar
          </Button>
        </Form>
      </div>

      {/* Songs Feed */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <Music2 className="h-4 w-4 text-purple-500" />
          Músicas Identificadas (últimas {songs.length})
        </h2>
        <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
          Identificação via ACRCloud (Projeto 2). Script <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">musicas.py</code> rodando na VM.
        </p>

        {songs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-purple-200 py-10 text-center dark:border-purple-900">
            <Music2 className="mx-auto h-9 w-9 text-purple-200 dark:text-purple-900" />
            <p className="mt-2 text-sm text-gray-400">Nenhuma música identificada ainda</p>
            <p className="mt-1 text-xs text-gray-400">Configure as env vars <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">ACRCLOUD_HOST</code>, <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">ACRCLOUD_ACCESS_KEY</code> e <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">ACRCLOUD_ACCESS_SECRET</code> e inicie o <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">musicas.py</code></p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estação</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Música</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Artista</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Álbum</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Conf.</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Horário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                {(songs as Song[]).map(song => {
                  const station = stations.find(s => s.id === song.stationId);
                  return (
                    <tr key={song.id}>
                      <td className="px-4 py-3 text-xs font-medium text-gray-700 dark:text-gray-300">
                        {station?.name ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {song.title}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                        {song.artist}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {song.album
                          ? <>{song.album}{song.releaseYear ? <span className="ml-1 opacity-60">({song.releaseYear})</span> : null}</>
                          : <span className="text-gray-300 dark:text-gray-600">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <SongConfidenceBadge confidence={song.confidence} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(song.detectedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Events Feed */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Feed de Eventos (últimos {events.length})
        </h2>

        {events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center dark:border-gray-700">
            <p className="text-sm text-gray-400">Nenhum evento detectado ainda</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Data/Hora</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estação</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Keywords</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Confiança</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Promoção?</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Revisar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {events.map(ev => {
                  const station = stations.find(s => s.id === ev.stationId);
                  const keywords_found = (() => {
                    try { return JSON.parse(ev.detectedPromotionKeywords ?? "[]") as string[]; } catch { return []; }
                  })();
                  return (
                    <tr key={ev.id} className={ev.reviewed ? "opacity-50" : ""}>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                        {new Date(ev.recordedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-900 dark:text-gray-100">
                        {station?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {keywords_found.length > 0
                            ? keywords_found.map((k, i) => (
                                <span key={i} className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{k}</span>
                              ))
                            : <span className="text-xs text-gray-400">—</span>
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ConfidenceBadge confidence={ev.confidence} />
                      </td>
                      <td className="px-4 py-3">
                        {ev.isPromotion
                          ? <span className="text-green-600">✅ Sim</span>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {!ev.reviewed ? (
                          <Form method="post">
                            <input type="hidden" name="intent" value="mark_reviewed" />
                            <input type="hidden" name="eventId" value={ev.id} />
                            <button type="submit" className="text-xs text-blue-500 hover:underline">Revisar</button>
                          </Form>
                        ) : (
                          <span className="text-xs text-gray-400">✓ Revisado</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
