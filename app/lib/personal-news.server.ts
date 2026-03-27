import { and, desc, eq, isNull } from "drizzle-orm";
import { personalNewsDigests, personalNewsItems, personalNewsSources, users } from "../../drizzle/schema";
import { db } from "./db.server";
import {
  DEFAULT_PERSONAL_NEWS_SOURCES,
  PERSONAL_NEWS_TOPIC_META,
  type PersonalNewsTopic,
} from "./personal-news.shared";

type ParsedFeedItem = {
  title: string;
  url: string;
  summary: string | null;
  sourceName: string | null;
  publishedAt: Date | null;
};


function decodeXmlEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function stripHtml(value: string) {
  return decodeXmlEntities(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTagValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}(?: [^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

function parseGoogleNewsFeed(xml: string): ParsedFeedItem[] {
  const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));

  return itemMatches
    .map((match) => {
      const itemXml = match[1] ?? "";
      const title = stripHtml(extractTagValue(itemXml, "title") ?? "");
      const url = decodeXmlEntities(extractTagValue(itemXml, "link") ?? "").trim();
      const summary = stripHtml(extractTagValue(itemXml, "description") ?? "");
      const sourceName = stripHtml(extractTagValue(itemXml, "source") ?? "");
      const pubDateRaw = extractTagValue(itemXml, "pubDate");
      const publishedAt = pubDateRaw ? new Date(pubDateRaw) : null;

      return {
        title,
        url,
        summary: summary || null,
        sourceName: sourceName || null,
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
      };
    })
    .filter((item) => item.title && item.url);
}

function buildGoogleNewsFeedUrl(query: string) {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "BR");
  url.searchParams.set("ceid", "BR:pt-419");
  return url.toString();
}

function normalizeDigestDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function topicOrder(topic: PersonalNewsTopic) {
  return ["ai", "bh", "world", "comex"].indexOf(topic);
}

function buildDigestSections(groupedItems: Record<PersonalNewsTopic, ParsedFeedItem[]>) {
  const lines: string[] = [];
  const topics: PersonalNewsTopic[] = ["ai", "bh", "world", "comex"];

  for (const topic of topics) {
    const entries = groupedItems[topic] ?? [];
    if (entries.length === 0) continue;

    const meta = PERSONAL_NEWS_TOPIC_META[topic];
    lines.push(meta.label);
    for (const entry of entries.slice(0, 3)) {
      const summary = entry.summary ? ` - ${entry.summary.slice(0, 140)}` : "";
      const source = entry.sourceName ? ` (${entry.sourceName})` : "";
      lines.push(`- ${entry.title}${source}${summary}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

function buildTelegramMessage(digestDate: string, groupedItems: Record<PersonalNewsTopic, ParsedFeedItem[]>) {
  const lines: string[] = [`Radar de noticias - ${digestDate.split("-").reverse().join("/")}`, ""];
  const topics: PersonalNewsTopic[] = ["ai", "bh", "world", "comex"];

  for (const topic of topics) {
    const entries = groupedItems[topic] ?? [];
    if (entries.length === 0) continue;

    const meta = PERSONAL_NEWS_TOPIC_META[topic];
    lines.push(meta.label);
    for (const entry of entries.slice(0, 2)) {
      const source = entry.sourceName ? ` - ${entry.sourceName}` : "";
      lines.push(`- ${entry.title}${source}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim().slice(0, 3900);
}

async function fetchSourceItems(source: typeof personalNewsSources.$inferSelect) {
  const response = await fetch(buildGoogleNewsFeedUrl(source.query), {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Feed respondeu ${response.status}`);
  }

  const xml = await response.text();
  return parseGoogleNewsFeed(xml).slice(0, source.maxItems);
}

async function sendDigestToTelegram(message: string) {
  const botToken =
    process.env.NEWS_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.OPENCLAW_TELEGRAM_TOKEN ||
    process.env.TELEGRAM_OPENCLAW_BOT_TOKEN;
  const chatId =
    process.env.NEWS_BOT_CHAT_ID ||
    process.env.OPENCLAW_CHAT_ID ||
    process.env.TELEGRAM_CHANNEL_ID;

  if (!botToken || !chatId) {
    return { sent: false, reason: "telegram_not_configured" as const };
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram falhou: ${response.status} ${errorText}`);
  }

  return { sent: true as const };
}

export async function getPersonalNewsOwnerUserId() {
  const ownerEmail = (process.env.PERSONAL_NEWS_USER_EMAIL || "luiz@lhfex.com.br").toLowerCase();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ownerEmail))
    .limit(1);

  return user?.id ?? null;
}

export async function seedDefaultPersonalNewsSources(userId: string) {
  const existing = await db
    .select({ id: personalNewsSources.id })
    .from(personalNewsSources)
    .where(and(eq(personalNewsSources.userId, userId), isNull(personalNewsSources.deletedAt)))
    .limit(1);

  if (existing.length > 0) return { created: 0 };

  await db.insert(personalNewsSources).values(
    DEFAULT_PERSONAL_NEWS_SOURCES.map((source) => ({
      userId,
      topic: source.topic,
      name: source.name,
      sourceType: "google_news_rss",
      query: source.query,
      sourceUrl: source.sourceUrl ?? null,
      maxItems: source.maxItems ?? 4,
      priority: source.priority ?? 5,
      isActive: true,
    }))
  );

  return { created: DEFAULT_PERSONAL_NEWS_SOURCES.length };
}

export async function collectPersonalNews(userId: string, digestDate = normalizeDigestDate()) {
  await seedDefaultPersonalNewsSources(userId);

  const sources = await db
    .select()
    .from(personalNewsSources)
    .where(
      and(
        eq(personalNewsSources.userId, userId),
        eq(personalNewsSources.isActive, true),
        isNull(personalNewsSources.deletedAt)
      )
    )
    .orderBy(personalNewsSources.priority, personalNewsSources.name);

  const grouped: Record<PersonalNewsTopic, ParsedFeedItem[]> = {
    ai: [],
    bh: [],
    world: [],
    comex: [],
  };

  for (const source of sources) {
    try {
      const items = await fetchSourceItems(source);
      grouped[source.topic as PersonalNewsTopic].push(...items);

      for (const item of items) {
        await db
          .insert(personalNewsItems)
          .values({
            userId,
            sourceId: source.id,
            topic: source.topic,
            title: item.title.slice(0, 500),
            summary: item.summary,
            url: item.url,
            sourceName: item.sourceName,
            publishedAt: item.publishedAt,
            digestDate,
            relevanceScore: Math.max(10, 100 - topicOrder(source.topic as PersonalNewsTopic) * 10),
          })
          .onConflictDoNothing({
            target: [personalNewsItems.userId, personalNewsItems.url],
          });
      }

      await db
        .update(personalNewsSources)
        .set({
          lastCheckedAt: new Date(),
          lastStatus: "ok",
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(personalNewsSources.id, source.id));
    } catch (error) {
      await db
        .update(personalNewsSources)
        .set({
          lastCheckedAt: new Date(),
          lastStatus: "error",
          lastError: error instanceof Error ? error.message : "Falha desconhecida",
          updatedAt: new Date(),
        })
        .where(eq(personalNewsSources.id, source.id));
    }
  }

  const deduped: Record<PersonalNewsTopic, ParsedFeedItem[]> = {
    ai: [],
    bh: [],
    world: [],
    comex: [],
  };

  for (const topic of Object.keys(grouped) as PersonalNewsTopic[]) {
    const seen = new Set<string>();
    deduped[topic] = grouped[topic]
      .filter((item) => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      })
      .slice(0, 6);
  }

  return { sources, groupedItems: deduped };
}

export async function generatePersonalNewsDigest(
  userId: string,
  options?: { digestDate?: string; sendTelegram?: boolean }
) {
  const digestDate = options?.digestDate ?? normalizeDigestDate();
  const { groupedItems } = await collectPersonalNews(userId, digestDate);

  const totalItems = Object.values(groupedItems).reduce((acc, items) => acc + items.length, 0);
  if (totalItems === 0) {
    return { digestDate, totalItems: 0, sent: false, digestId: null };
  }

  const digestMarkdown = buildDigestSections(groupedItems);
  const telegramMessage = buildTelegramMessage(digestDate, groupedItems);

  const [digest] = await db
    .insert(personalNewsDigests)
    .values({
      userId,
      digestDate,
      title: `Radar diario de noticias - ${digestDate.split("-").reverse().join("/")}`,
      topics: JSON.stringify(["ai", "bh", "world", "comex"]),
      digestMarkdown,
      telegramMessage,
      itemCount: totalItems,
      status: "draft",
    })
    .onConflictDoUpdate({
      target: [personalNewsDigests.userId, personalNewsDigests.digestDate],
      set: {
        title: `Radar diario de noticias - ${digestDate.split("-").reverse().join("/")}`,
        topics: JSON.stringify(["ai", "bh", "world", "comex"]),
        digestMarkdown,
        telegramMessage,
        itemCount: totalItems,
        status: "draft",
        updatedAt: new Date(),
      },
    })
    .returning({ id: personalNewsDigests.id });

  let sent = false;

  if (options?.sendTelegram) {
    await sendDigestToTelegram(telegramMessage);
    sent = true;

    await db
      .update(personalNewsDigests)
      .set({
        status: "sent",
        telegramSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(personalNewsDigests.id, digest.id));

    await db
      .update(personalNewsItems)
      .set({
        telegramSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(personalNewsItems.userId, userId), eq(personalNewsItems.digestDate, digestDate)));
  }

  return { digestDate, totalItems, sent, digestId: digest.id };
}

export async function getPersonalNewsDashboard(userId: string) {
  await seedDefaultPersonalNewsSources(userId);

  const [sources, items, digests] = await Promise.all([
    db
      .select()
      .from(personalNewsSources)
      .where(and(eq(personalNewsSources.userId, userId), isNull(personalNewsSources.deletedAt)))
      .orderBy(personalNewsSources.priority, personalNewsSources.name),
    db
      .select()
      .from(personalNewsItems)
      .where(and(eq(personalNewsItems.userId, userId), isNull(personalNewsItems.deletedAt)))
      .orderBy(desc(personalNewsItems.publishedAt), desc(personalNewsItems.createdAt))
      .limit(32),
    db
      .select()
      .from(personalNewsDigests)
      .where(and(eq(personalNewsDigests.userId, userId), isNull(personalNewsDigests.deletedAt)))
      .orderBy(desc(personalNewsDigests.digestDate), desc(personalNewsDigests.createdAt))
      .limit(8),
  ]);

  const itemsByTopic: Record<PersonalNewsTopic, typeof items> = {
    ai: [],
    bh: [],
    world: [],
    comex: [],
  };

  for (const item of items) {
    const topic = item.topic as PersonalNewsTopic;
    if (itemsByTopic[topic]) {
      itemsByTopic[topic].push(item);
    }
  }

  return {
    sources,
    items,
    digests,
    itemsByTopic,
    metrics: {
      activeSources: sources.filter((source) => source.isActive && !source.deletedAt).length,
      unreadItems: items.filter((item) => !item.isRead).length,
      starredItems: items.filter((item) => item.isStarred).length,
      lastDigestDate: digests[0]?.digestDate ?? null,
    },
  };
}

