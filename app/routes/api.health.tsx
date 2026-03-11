import { db } from "~/lib/db.server";
import { sql } from "drizzle-orm";

export async function loader() {
  try {
    const [result] = await db.execute(sql`SELECT 1 as ok`);
    const sourceCommit = process.env.SOURCE_COMMIT || process.env.COOLIFY_COMMIT_SHA || null;
    return Response.json(
      {
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
        sourceCommit,
        releaseMarker: "phase-finalization-2026-03-11-r1",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const sourceCommit = process.env.SOURCE_COMMIT || process.env.COOLIFY_COMMIT_SHA || null;
    return Response.json(
      {
        status: "error",
        database: "disconnected",
        timestamp: new Date().toISOString(),
        sourceCommit,
        releaseMarker: "phase-finalization-2026-03-11-r1",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
