import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import {
  promotionDiscoveries,
  promotionTagFriends,
  promotionTagFriendUsage,
  promotions,
  promotionWatchSources,
} from "../../drizzle/schema/personal-life";
import { db } from "./db.server";
import { parsePromotionText } from "./ai.server";
import type { PromotionDiscoveryStatus, PromotionMonitorChannel } from "./promotion-monitor.shared";

type PromotionWatchSource = typeof promotionWatchSources.$inferSelect;
type PromotionTagFriend = typeof promotionTagFriends.$inferSelect;
type PromotionDiscovery = typeof promotionDiscoveries.$inferSelect;

export interface PromotionDiscoveryView extends PromotionDiscovery {
  suggestedFriendsList: string[];
}

export interface PromotionMonitorDashboard {
  metrics: {
    totalSources: number;
    activeSources: number;
    totalFriends: number;
    activeFriends: number;
    newDiscoveries: number;
    reviewingDiscoveries: number;
    importedDiscoveries: number;
    dismissedDiscoveries: number;
  };
  sources: PromotionWatchSource[];
  tagFriends: PromotionTagFriend[];
  discoveries: PromotionDiscoveryView[];
}

function decodeHtmlEntities(raw: string) {
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(raw: string) {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(rawHtml: string) {
  const match = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(stripHtml(match[1])) : null;
}

function extractMetaContent(rawHtml: string, selectors: string[]) {
  for (const selector of selectors) {
    const pattern = new RegExp(
      `<meta[^>]+(?:name|property)=["']${selector}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    );
    const match = rawHtml.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1]).trim();
    }
  }
  return null;
}

function extractTextFromHtml(rawHtml: string, url: string) {
  const title = extractTitle(rawHtml);
  const description = extractMetaContent(rawHtml, ["description", "og:description", "twitter:description"]);
  const siteName = extractMetaContent(rawHtml, ["og:site_name", "application-name"]);
  const canonical = rawHtml.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? null;
  const plainText = stripHtml(rawHtml);

  const summaryParts = [
    title ? `Titulo: ${title}` : null,
    siteName ? `Origem: ${siteName}` : null,
    description ? `Descricao: ${description}` : null,
    canonical ? `Canonical: ${canonical}` : null,
    `URL: ${url}`,
  ].filter(Boolean);

  return `${summaryParts.join("\n")}\n\nConteudo extraido:\n${plainText.slice(0, url.includes("instagram.com") ? 12000 : 20000)}`.trim();
}

async function extractTextFromPdfBytes(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractTextFromUrl(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LHFEXBot/1.0; +https://saas.lhfex.com.br)",
      Accept: "text/html,application/pdf,text/plain;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Falha ao ler URL (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("pdf")) {
    return extractTextFromPdfBytes(Buffer.from(await response.arrayBuffer()));
  }

  return extractTextFromHtml(await response.text(), url);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeUrl(raw: string) {
  const url = new URL(raw.trim());
  url.hash = "";
  const normalized = url.toString().replace(/\/$/, "");
  return normalized;
}

export function normalizeInstagramHandle(raw: string) {
  const base = raw.trim().replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  const handle = base.split(/[/?#]/)[0]?.trim().toLowerCase() ?? "";
  return handle ? `@${handle}` : "";
}

export function normalizeMonitorQuery(channel: PromotionMonitorChannel, raw: string) {
  const value = raw.trim();
  if (!value) return "";

  if (channel === "instagram_account") return normalizeInstagramHandle(value);
  if (channel === "instagram_hashtag") return value.startsWith("#") ? value.toLowerCase() : `#${value.toLowerCase()}`;
  if (channel === "promotion_site" || channel === "literary_site") return normalizeUrl(value);

  return value.toLowerCase();
}

function inferNeedsFriends(text: string) {
  return /marque|marcar|marcando|comente.*amig|2 amigos|3 amigos|dois amigos|tres amigos|@amig/i.test(text);
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function buildDiscoveryScore(args: {
  sourcePriority: number;
  endDate: string | null;
  hasPrize: boolean;
  needsFriends: boolean;
  channel: PromotionMonitorChannel;
}) {
  let score = 50;
  score += Math.max(0, 12 - args.sourcePriority * 2);

  if (args.hasPrize) score += 10;
  if (args.channel === "instagram_account") score += 8;
  if (args.channel === "instagram_hashtag") score += 5;
  if (args.channel === "promotion_site") score += 4;
  if (args.needsFriends) score -= 6;

  if (args.endDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(`${args.endDate}T12:00:00`);
    const diff = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) score -= 30;
    else if (diff <= 2) score += 18;
    else if (diff <= 7) score += 12;
    else if (diff <= 14) score += 6;
  }

  return clampScore(score);
}

function getExternalIdFromUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.at(-1) ?? url.hostname;
}

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfWeek() {
  const value = startOfToday();
  const day = value.getDay();
  const diff = day === 0 ? 6 : day - 1;
  value.setDate(value.getDate() - diff);
  return value;
}

export async function suggestTagFriends(userId: string, maxSuggestions = 3) {
  const friends = await db
    .select()
    .from(promotionTagFriends)
    .where(and(eq(promotionTagFriends.userId, userId), eq(promotionTagFriends.isActive, true), isNull(promotionTagFriends.deletedAt)))
    .orderBy(asc(promotionTagFriends.priority), asc(promotionTagFriends.lastTaggedAt), asc(promotionTagFriends.name));

  if (friends.length === 0) return [];

  const friendIds = friends.map((friend) => friend.id);
  const [dailyUsage, weeklyUsage] = await Promise.all([
    db
      .select({
        friendId: promotionTagFriendUsage.friendId,
        count: sql<number>`count(*)::int`,
      })
      .from(promotionTagFriendUsage)
      .where(and(eq(promotionTagFriendUsage.userId, userId), inArray(promotionTagFriendUsage.friendId, friendIds), gte(promotionTagFriendUsage.usedAt, startOfToday())))
      .groupBy(promotionTagFriendUsage.friendId),
    db
      .select({
        friendId: promotionTagFriendUsage.friendId,
        count: sql<number>`count(*)::int`,
      })
      .from(promotionTagFriendUsage)
      .where(and(eq(promotionTagFriendUsage.userId, userId), inArray(promotionTagFriendUsage.friendId, friendIds), gte(promotionTagFriendUsage.usedAt, startOfWeek())))
      .groupBy(promotionTagFriendUsage.friendId),
  ]);

  const dailyMap = new Map(dailyUsage.map((item) => [item.friendId, Number(item.count)]));
  const weeklyMap = new Map(weeklyUsage.map((item) => [item.friendId, Number(item.count)]));

  return friends
    .filter((friend) => {
      const daily = dailyMap.get(friend.id) ?? 0;
      const weekly = weeklyMap.get(friend.id) ?? 0;
      return daily < friend.dailyLimit && weekly < friend.weeklyLimit;
    })
    .slice(0, maxSuggestions);
}

export async function getPromotionMonitorDashboard(userId: string) {
  const [sources, tagFriends, discoveries] = await Promise.all([
    db
      .select()
      .from(promotionWatchSources)
      .where(and(eq(promotionWatchSources.userId, userId), isNull(promotionWatchSources.deletedAt)))
      .orderBy(asc(promotionWatchSources.priority), desc(promotionWatchSources.updatedAt)),
    db
      .select()
      .from(promotionTagFriends)
      .where(and(eq(promotionTagFriends.userId, userId), isNull(promotionTagFriends.deletedAt)))
      .orderBy(asc(promotionTagFriends.priority), asc(promotionTagFriends.name)),
    db
      .select()
      .from(promotionDiscoveries)
      .where(and(eq(promotionDiscoveries.userId, userId), isNull(promotionDiscoveries.deletedAt)))
      .orderBy(desc(promotionDiscoveries.score), desc(promotionDiscoveries.discoveredAt))
      .limit(18),
  ]);

  const metrics = {
    totalSources: sources.length,
    activeSources: sources.filter((item) => item.isActive).length,
    totalFriends: tagFriends.length,
    activeFriends: tagFriends.filter((item) => item.isActive).length,
    newDiscoveries: discoveries.filter((item) => item.status === "new").length,
    reviewingDiscoveries: discoveries.filter((item) => item.status === "reviewing").length,
    importedDiscoveries: discoveries.filter((item) => item.status === "imported").length,
    dismissedDiscoveries: discoveries.filter((item) => item.status === "dismissed").length,
  };

  return {
    metrics,
    sources,
    tagFriends,
    discoveries: discoveries.map((discovery) => ({
      ...discovery,
      suggestedFriendsList: safeJsonParse<string[]>(discovery.suggestedFriends, []),
    })),
  } satisfies PromotionMonitorDashboard;
}

export async function createOrUpdateMonitorSource(input: {
  userId: string;
  channel: PromotionMonitorChannel;
  label: string;
  query: string;
  sourceUrl?: string | null;
  notes?: string | null;
  priority?: number;
}) {
  const normalizedQuery = normalizeMonitorQuery(input.channel, input.query);
  if (!normalizedQuery) {
    throw new Error("Consulta da fonte invalida");
  }

  const sourceUrl = input.sourceUrl?.trim() ? normalizeUrl(input.sourceUrl) : null;
  const existing = await db
    .select({ id: promotionWatchSources.id })
    .from(promotionWatchSources)
    .where(
      and(
        eq(promotionWatchSources.userId, input.userId),
        eq(promotionWatchSources.channel, input.channel),
        eq(promotionWatchSources.query, normalizedQuery)
      )
    )
    .limit(1);

  if (existing[0]?.id) {
    await db
      .update(promotionWatchSources)
      .set({
        label: input.label.trim(),
        sourceUrl,
        notes: input.notes?.trim() || null,
        priority: input.priority ?? 5,
        isActive: true,
        updatedAt: new Date(),
        deletedAt: null,
      })
      .where(and(eq(promotionWatchSources.id, existing[0].id), eq(promotionWatchSources.userId, input.userId)));

    return existing[0].id;
  }

  const [created] = await db
    .insert(promotionWatchSources)
    .values({
      userId: input.userId,
      channel: input.channel,
      label: input.label.trim(),
      query: normalizedQuery,
      sourceUrl,
      notes: input.notes?.trim() || null,
      priority: input.priority ?? 5,
    })
    .returning({ id: promotionWatchSources.id });

  return created?.id ?? null;
}

export async function createOrUpdateTagFriend(input: {
  userId: string;
  name: string;
  instagramHandle: string;
  dailyLimit?: number;
  weeklyLimit?: number;
  priority?: number;
  notes?: string | null;
}) {
  const instagramHandle = normalizeInstagramHandle(input.instagramHandle);
  if (!instagramHandle) {
    throw new Error("Handle do Instagram invalido");
  }

  const existing = await db
    .select({ id: promotionTagFriends.id })
    .from(promotionTagFriends)
    .where(
      and(eq(promotionTagFriends.userId, input.userId), eq(promotionTagFriends.instagramHandle, instagramHandle))
    )
    .limit(1);

  if (existing[0]?.id) {
    await db
      .update(promotionTagFriends)
      .set({
        name: input.name.trim(),
        dailyLimit: input.dailyLimit ?? 5,
        weeklyLimit: input.weeklyLimit ?? 20,
        priority: input.priority ?? 5,
        notes: input.notes?.trim() || null,
        isActive: true,
        updatedAt: new Date(),
        deletedAt: null,
      })
      .where(and(eq(promotionTagFriends.id, existing[0].id), eq(promotionTagFriends.userId, input.userId)));

    return existing[0].id;
  }

  const [created] = await db
    .insert(promotionTagFriends)
    .values({
      userId: input.userId,
      name: input.name.trim(),
      instagramHandle,
      dailyLimit: input.dailyLimit ?? 5,
      weeklyLimit: input.weeklyLimit ?? 20,
      priority: input.priority ?? 5,
      notes: input.notes?.trim() || null,
    })
    .returning({ id: promotionTagFriends.id });

  return created?.id ?? null;
}

export async function createDiscoveryFromUrl(userId: string, rawUrl: string, sourceId?: string | null) {
  const externalUrl = normalizeUrl(rawUrl);
  const [source] = sourceId
    ? await db
        .select()
        .from(promotionWatchSources)
        .where(and(eq(promotionWatchSources.id, sourceId), eq(promotionWatchSources.userId, userId)))
        .limit(1)
    : [null];

  const extractedText = await extractTextFromUrl(externalUrl);
  const fields = await parsePromotionText(extractedText, userId);
  const needsFriends = inferNeedsFriends(`${extractedText}\n${fields.rules ?? ""}\n${fields.name ?? ""}`);
  const suggestedFriends = needsFriends ? await suggestTagFriends(userId, 3) : [];

  const score = buildDiscoveryScore({
    sourcePriority: source?.priority ?? 5,
    endDate: fields.endDate ?? null,
    hasPrize: Boolean(fields.prize),
    needsFriends,
    channel: (source?.channel as PromotionMonitorChannel | undefined) ?? "instagram_account",
  });

  const title = fields.name?.trim() || `Promoção monitorada ${new URL(externalUrl).hostname}`;
  const organizer = fields.company?.trim() || new URL(externalUrl).hostname.replace(/^www\./, "");
  const participationNotes = [
    fields.luckyNumberRule ? `Numero da sorte: ${fields.luckyNumberRule}` : null,
    needsFriends && suggestedFriends.length > 0
      ? `Sugestao de marcacao: ${suggestedFriends.map((friend) => friend.instagramHandle).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const rawPayload = JSON.stringify({
    fields,
    extractedPreview: extractedText.slice(0, 5000),
  });

  const existing = await db
    .select()
    .from(promotionDiscoveries)
    .where(and(eq(promotionDiscoveries.userId, userId), eq(promotionDiscoveries.externalUrl, externalUrl)))
    .limit(1);

  const payload = {
    sourceId: source?.id ?? null,
    channel: source?.channel ?? ("instagram_account" as PromotionMonitorChannel),
    title,
    organizer,
    externalUrl,
    externalId: getExternalIdFromUrl(externalUrl),
    prize: fields.prize?.trim() || null,
    endDate: fields.endDate ?? null,
    rulesSummary: fields.rules?.trim() || null,
    participationNotes: participationNotes || null,
    score,
    needsFriends,
    suggestedFriends: JSON.stringify(suggestedFriends.map((friend) => friend.instagramHandle)),
    rawPayload,
    lastAnalyzedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing[0]?.id) {
    const previousStatus = existing[0].status as PromotionDiscoveryStatus;
    await db
      .update(promotionDiscoveries)
      .set({
        ...payload,
        status: previousStatus === "dismissed" ? "reviewing" : previousStatus,
      })
      .where(and(eq(promotionDiscoveries.id, existing[0].id), eq(promotionDiscoveries.userId, userId)));

    return existing[0].id;
  }

  const [created] = await db
    .insert(promotionDiscoveries)
    .values({
      userId,
      discoveredAt: new Date(),
      status: "new",
      ...payload,
    })
    .returning({ id: promotionDiscoveries.id });

  if (source?.id) {
    await db
      .update(promotionWatchSources)
      .set({
        lastCheckedAt: new Date(),
        lastStatus: "ok",
        lastError: null,
        updatedAt: new Date(),
      })
      .where(and(eq(promotionWatchSources.id, source.id), eq(promotionWatchSources.userId, userId)));
  }

  return created?.id ?? null;
}

export async function importDiscoveryToPromotion(userId: string, discoveryId: string) {
  const [discovery] = await db
    .select()
    .from(promotionDiscoveries)
    .where(and(eq(promotionDiscoveries.id, discoveryId), eq(promotionDiscoveries.userId, userId), isNull(promotionDiscoveries.deletedAt)))
    .limit(1);

  if (!discovery) {
    throw new Error("Descoberta nao encontrada");
  }

  if (discovery.importedPromotionId) {
    return discovery.importedPromotionId;
  }

  const [existingPromotion] = await db
    .select({ id: promotions.id })
    .from(promotions)
    .where(
      and(
        eq(promotions.userId, userId),
        eq(promotions.link, discovery.externalUrl),
        eq(promotions.source, "instagram"),
        isNull(promotions.deletedAt)
      )
    )
    .limit(1);

  const suggestedFriends = safeJsonParse<string[]>(discovery.suggestedFriends, []);
  const proofOfParticipation = suggestedFriends.length > 0 ? `Sugestao de amigos para marcar: ${suggestedFriends.join(", ")}` : null;
  const startDate = discovery.discoveredAt.toISOString().slice(0, 10);

  const promotionId = existingPromotion?.id
    ? existingPromotion.id
    : (
        await db
          .insert(promotions)
          .values({
            userId,
            name: discovery.title,
            company: discovery.organizer || "Instagram",
            type: "giveaway",
            description: discovery.rulesSummary,
            prize: discovery.prize || null,
            startDate,
            endDate: discovery.endDate ?? startDate,
            rules: discovery.rulesSummary,
            participationStatus: "pending",
            link: discovery.externalUrl,
            proofOfParticipation,
            notes: discovery.participationNotes,
            source: "instagram",
          })
          .returning({ id: promotions.id })
      )[0]?.id;

  if (!promotionId) {
    throw new Error("Falha ao importar descoberta");
  }

  await db
    .update(promotionDiscoveries)
    .set({
      importedPromotionId: promotionId,
      status: "imported",
      updatedAt: new Date(),
    })
    .where(and(eq(promotionDiscoveries.id, discovery.id), eq(promotionDiscoveries.userId, userId)));

  return promotionId;
}

export async function registerDiscoveryTagUsage(userId: string, discoveryId: string) {
  const [discovery] = await db
    .select()
    .from(promotionDiscoveries)
    .where(and(eq(promotionDiscoveries.id, discoveryId), eq(promotionDiscoveries.userId, userId), isNull(promotionDiscoveries.deletedAt)))
    .limit(1);

  if (!discovery) {
    throw new Error("Descoberta nao encontrada");
  }

  const handles = safeJsonParse<string[]>(discovery.suggestedFriends, []);
  if (handles.length === 0) return 0;

  const friends = await db
    .select()
    .from(promotionTagFriends)
    .where(
      and(
        eq(promotionTagFriends.userId, userId),
        inArray(promotionTagFriends.instagramHandle, handles),
        eq(promotionTagFriends.isActive, true),
        isNull(promotionTagFriends.deletedAt)
      )
    );

  if (friends.length === 0) return 0;

  await db.insert(promotionTagFriendUsage).values(
    friends.map((friend) => ({
      userId,
      friendId: friend.id,
      discoveryId,
      status: "executed",
      notes: `Marcacao sugerida para ${discovery.title}`,
      usedAt: new Date(),
      createdAt: new Date(),
    }))
  );

  await db
    .update(promotionTagFriends)
    .set({ lastTaggedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(promotionTagFriends.userId, userId), inArray(promotionTagFriends.id, friends.map((friend) => friend.id))));

  if (discovery.status === "new") {
    await db
      .update(promotionDiscoveries)
      .set({ status: "reviewing", updatedAt: new Date() })
      .where(and(eq(promotionDiscoveries.id, discoveryId), eq(promotionDiscoveries.userId, userId)));
  }

  return friends.length;
}
