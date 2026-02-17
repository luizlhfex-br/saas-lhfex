import { db } from "~/lib/db.server";
import { sql } from "drizzle-orm";

export async function loader() {
  try {
    const [result] = await db.execute(sql`SELECT 1 as ok`);
    return Response.json(
      { status: "ok", database: "connected", timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return Response.json(
      { status: "error", database: "disconnected", timestamp: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
