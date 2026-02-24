import { data } from "react-router";
import type { Route } from "./+types/api.radio-monitor-config";
import { db } from "~/lib/db.server";
import { radioStations, radioMonitorKeywords } from "../../drizzle/schema/radio-monitor";
import { eq, and } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  // Valida API key do script da VM
  const apiKey = request.headers.get("x-radio-monitor-key");
  const expected = process.env.RADIO_MONITOR_SECRET;
  if (!expected || apiKey !== expected) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  const [stations, keywords] = await Promise.all([
    db
      .select()
      .from(radioStations)
      .where(and(eq(radioStations.isActive, true), eq(radioStations.monitoringEnabled, true))),
    db
      .select()
      .from(radioMonitorKeywords)
      .where(eq(radioMonitorKeywords.isActive, true)),
  ]);

  return data({
    stations: stations.map((s) => ({
      id: s.id,
      name: s.name,
      streamUrl: s.streamUrl,
      frequency: s.frequency,
      city: s.city,
    })),
    keywords: keywords.map((k) => ({
      id: k.id,
      keyword: k.keyword,
      category: k.category,
      priority: k.priority,
      stationId: k.stationId,
    })),
    acrcloud: {
      host: process.env.ACRCLOUD_HOST ?? "",
      access_key: process.env.ACRCLOUD_ACCESS_KEY ?? "",
      access_secret: process.env.ACRCLOUD_ACCESS_SECRET ?? "",
    },
  });
}
