import { data } from "react-router";
import type { Route } from "./+types/api.radio-monitor-song";
import { db } from "~/lib/db.server";
import { radioMonitorSongs } from "../../drizzle/schema/radio-monitor";

export async function action({ request }: Route.ActionArgs) {
  // Valida API key do script da VM (mesmo padrão do api.radio-monitor-event)
  const apiKey = request.headers.get("x-radio-monitor-key");
  const expected = process.env.RADIO_MONITOR_SECRET;
  if (!expected || apiKey !== expected) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    stationId: string;
    title: string;
    artist: string;
    album?: string;
    releaseYear?: number;
    confidence?: number;
    detectedAt?: string;
  };

  try {
    body = await request.json();
  } catch {
    return data({ error: "Invalid JSON" }, { status: 400 });
  }

  const { stationId, title, artist, album, releaseYear, confidence, detectedAt } = body;

  if (!stationId || !title || !artist) {
    return data({ error: "Missing required fields: stationId, title, artist" }, { status: 400 });
  }

  await db.insert(radioMonitorSongs).values({
    stationId,
    title,
    artist,
    album: album ?? null,
    releaseYear: releaseYear ?? null,
    confidence: confidence != null ? String(confidence) : null,
    detectedAt: detectedAt ? new Date(detectedAt) : new Date(),
  });

  return data({ success: true });
}
