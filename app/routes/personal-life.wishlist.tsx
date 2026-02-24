/**
 * GET/POST /personal-life/wishlist
 * Lista de desejos — Livros, Filmes, Séries, Discos
 */

import { Form, useLoaderData, useNavigation, useSearchParams } from "react-router";
import { useState } from "react";
import { db } from "~/lib/db.server";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { personalWishlist } from "../../drizzle/schema";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { redirect, data } from "react-router";
import {
  BookOpen,
  Film,
  Tv,
  Music,
  Plus,
  Trash2,
  Star,
  Search,
  CheckCircle2,
  Play,
  Bookmark,
} from "lucide-react";
import { Button } from "~/components/ui/button";

type WishlistItem = typeof personalWishlist.$inferSelect;

const TYPES = [
  { key: "book",   label: "Livros",  icon: BookOpen, emoji: "📚" },
  { key: "movie",  label: "Filmes",  icon: Film,     emoji: "🎬" },
  { key: "series", label: "Séries",  icon: Tv,       emoji: "📺" },
  { key: "album",  label: "Discos",  icon: Music,    emoji: "🎵" },
] as const;

const STATUS_CONFIG = {
  want:     { label: "Quero ver",    icon: Bookmark,     color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  watching: { label: "Em andamento", icon: Play,          color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  finished: { label: "Finalizado",   icon: CheckCircle2, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
} as const;

export async function loader({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const activeTab = (url.searchParams.get("tab") || "book") as "book" | "movie" | "series" | "album";
  const search = url.searchParams.get("q") || "";

  const baseWhere = and(eq(personalWishlist.userId, user.id), isNull(personalWishlist.deletedAt));

  const [items, kpis] = await Promise.all([
    db.select().from(personalWishlist)
      .where(and(baseWhere, eq(personalWishlist.type, activeTab)))
      .orderBy(
        sql`CASE status WHEN 'watching' THEN 1 WHEN 'want' THEN 2 ELSE 3 END`,
        desc(personalWishlist.createdAt)
      ),
    db.select({
      type: personalWishlist.type,
      total: sql<number>`count(*)::int`,
      want: sql<number>`sum(case when status = 'want' then 1 else 0 end)::int`,
      watching: sql<number>`sum(case when status = 'watching' then 1 else 0 end)::int`,
      finished: sql<number>`sum(case when status = 'finished' then 1 else 0 end)::int`,
    }).from(personalWishlist)
      .where(baseWhere)
      .groupBy(personalWishlist.type),
  ]);

  const kpiMap = Object.fromEntries(kpis.map(k => [k.type, k]));

  const filteredItems = search
    ? items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()) ||
                        (i.creator ?? "").toLowerCase().includes(search.toLowerCase()))
    : items;

  return { items: filteredItems, kpiMap, activeTab, search };
}

export async function action({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const tab = String(formData.get("tab") || "book");

  if (intent === "create") {
    const title = String(formData.get("title") || "").trim();
    if (!title) return data({ error: "Título obrigatório" }, { status: 400 });

    await db.insert(personalWishlist).values({
      userId: user.id,
      type: String(formData.get("type") || "book") as "book" | "movie" | "series" | "album",
      title,
      creator: String(formData.get("creator") || "").trim() || null,
      year: Number(formData.get("year") || 0) || null,
      genre: String(formData.get("genre") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      updatedAt: new Date(),
    });
    return redirect(`/personal-life/wishlist?tab=${tab}`);
  }

  if (intent === "start") {
    const id = String(formData.get("id") || "");
    await db.update(personalWishlist)
      .set({ status: "watching", updatedAt: new Date() })
      .where(and(eq(personalWishlist.id, id), eq(personalWishlist.userId, user.id)));
    return redirect(`/personal-life/wishlist?tab=${tab}`);
  }

  if (intent === "finish") {
    const id = String(formData.get("id") || "");
    const rating = Number(formData.get("rating") || 0) || null;
    await db.update(personalWishlist)
      .set({ status: "finished", rating, finishedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(personalWishlist.id, id), eq(personalWishlist.userId, user.id)));
    return redirect(`/personal-life/wishlist?tab=${tab}`);
  }

  if (intent === "want") {
    const id = String(formData.get("id") || "");
    await db.update(personalWishlist)
      .set({ status: "want", rating: null, finishedAt: null, updatedAt: new Date() })
      .where(and(eq(personalWishlist.id, id), eq(personalWishlist.userId, user.id)));
    return redirect(`/personal-life/wishlist?tab=${tab}`);
  }

  if (intent === "delete") {
    const id = String(formData.get("id") || "");
    await db.update(personalWishlist)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(personalWishlist.id, id), eq(personalWishlist.userId, user.id)));
    return redirect(`/personal-life/wishlist?tab=${tab}`);
  }

  return redirect(`/personal-life/wishlist?tab=${tab}`);
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`h-4 w-4 cursor-pointer transition-colors ${
            n <= (hover || value) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
          }`}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange?.(n)}
        />
      ))}
    </div>
  );
}

function WishlistCard({ item, tab }: { item: WishlistItem; tab: string }) {
  const [finishMode, setFinishMode] = useState(false);
  const [rating, setRating] = useState(item.rating ?? 0);
  const statusCfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.want;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
          {item.creator && <p className="text-xs text-gray-500 dark:text-gray-400">{item.creator}{item.year ? ` • ${item.year}` : ""}</p>}
          {item.genre && <p className="text-xs text-gray-400">{item.genre}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1 ${statusCfg.color}`}>
          <StatusIcon className="h-3 w-3" />
          {statusCfg.label}
        </span>
      </div>

      {item.rating && item.status === "finished" && (
        <StarRating value={item.rating} />
      )}

      {item.notes && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{item.notes}</p>}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        {item.status === "want" && (
          <Form method="post">
            <input type="hidden" name="intent" value="start" />
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="tab" value={tab} />
            <button type="submit" className="rounded-lg bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
              ▶ Iniciar
            </button>
          </Form>
        )}

        {item.status === "watching" && !finishMode && (
          <button
            onClick={() => setFinishMode(true)}
            className="rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
          >
            ✓ Finalizar
          </button>
        )}

        {finishMode && (
          <Form method="post" className="flex items-center gap-2" onSubmit={() => setFinishMode(false)}>
            <input type="hidden" name="intent" value="finish" />
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="tab" value={tab} />
            <input type="hidden" name="rating" value={String(rating)} />
            <StarRating value={rating} onChange={setRating} />
            <Button type="submit" size="sm" className="h-7 text-xs">Salvar</Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setFinishMode(false)}>✕</Button>
          </Form>
        )}

        {item.status === "finished" && (
          <Form method="post">
            <input type="hidden" name="intent" value="want" />
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="tab" value={tab} />
            <button type="submit" className="rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">
              Reler/Reverter
            </button>
          </Form>
        )}

        <Form method="post" onSubmit={(e) => { if (!confirm("Remover este item?")) e.preventDefault(); }}>
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="tab" value={tab} />
          <button type="submit" className="rounded-lg p-1 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </Form>
      </div>
    </div>
  );
}

export default function PersonalLifeWishlistPage() {
  const { items, kpiMap, activeTab, search } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [searchVal, setSearchVal] = useState(search);
  const isSubmitting = navigation.state === "submitting";

  const currentType = TYPES.find(t => t.key === activeTab) ?? TYPES[0]!;
  const kpi = kpiMap[activeTab];

  const handleSearch = (val: string) => {
    setSearchVal(val);
    const p = new URLSearchParams(searchParams);
    if (val) p.set("q", val); else p.delete("q");
    setSearchParams(p);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wishlist</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Livros, filmes, séries e discos para descobrir</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TYPES.map(t => {
          const k = kpiMap[t.key];
          return (
            <button
              key={t.key}
              onClick={() => {
                const p = new URLSearchParams(searchParams);
                p.set("tab", t.key);
                p.delete("q");
                setSearchParams(p);
                setSearchVal("");
              }}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              <span>{t.emoji}</span>
              {t.label}
              {k && <span className="rounded-full bg-white/20 px-1.5 text-xs">{k.total}</span>}
            </button>
          );
        })}
      </div>

      {/* KPI strip */}
      {kpi && (
        <div className="flex gap-3 text-sm">
          <span className="text-gray-500">🔖 Quero: <strong>{kpi.want ?? 0}</strong></span>
          <span className="text-gray-500">▶ Em andamento: <strong>{kpi.watching ?? 0}</strong></span>
          <span className="text-gray-500">✅ Finalizados: <strong>{kpi.finished ?? 0}</strong></span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchVal}
          onChange={e => handleSearch(e.target.value)}
          placeholder={`Buscar ${currentType.label.toLowerCase()}...`}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-900/10">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Adicionar {currentType.emoji} {currentType.label.slice(0, -1)}
          </h2>
          <Form method="post" className="space-y-3" onSubmit={() => setShowForm(false)}>
            <input type="hidden" name="intent" value="create" />
            <input type="hidden" name="type" value={activeTab} />
            <input type="hidden" name="tab" value={activeTab} />
            <input
              type="text"
              name="title"
              placeholder="Título *"
              required
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                name="creator"
                placeholder={activeTab === "book" ? "Autor" : activeTab === "album" ? "Artista" : "Diretor / Criador"}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              <input
                type="number"
                name="year"
                placeholder="Ano"
                min={1900}
                max={2099}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <input
              type="text"
              name="genre"
              placeholder="Gênero (ex: Romance, Ficção Científica, Jazz)"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <textarea
              name="notes"
              placeholder="Notas ou motivo de interesse"
              rows={2}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isSubmitting}>Salvar</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </Form>
        </div>
      )}

      {/* Items grid */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center dark:border-gray-700">
          <span className="text-4xl">{currentType.emoji}</span>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {search ? `Nenhum resultado para "${search}"` : `Nenhum ${currentType.label.toLowerCase().slice(0, -1)} na lista`}
          </p>
          <p className="mt-1 text-xs text-gray-400">Clique em "Adicionar" para começar</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(item => (
            <WishlistCard key={item.id} item={item as WishlistItem} tab={activeTab} />
          ))}
        </div>
      )}
    </div>
  );
}
