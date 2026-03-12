/**
 * ONE-TIME migration endpoint for 0008_multi_tenancy_phase1.sql
 * Protected by OPENCLAW_TOOLS_API_KEY
 * DELETE THIS FILE after migration is confirmed successful.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "~/lib/db.server";
import { sql } from "drizzle-orm";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const apiKey = process.env.OPENCLAW_TOOLS_API_KEY;

  if (!apiKey || !key || key !== apiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const migrationPath = join(process.cwd(), "drizzle", "migrations", "0008_multi_tenancy_phase1.sql");
    const migrationSql = readFileSync(migrationPath, "utf-8");

    // Split on semicolons, preserving multi-line statements
    const rawStatements = migrationSql.split(";");
    const statements: string[] = [];

    for (const raw of rawStatements) {
      // Remove comment lines and trim
      const cleaned = raw
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      if (cleaned.length > 0) {
        statements.push(cleaned);
      }
    }

    const results: Array<{ ok: boolean; stmt: string; error?: string }> = [];

    for (const stmt of statements) {
      const preview = stmt.replace(/\s+/g, " ").trim().substring(0, 100);
      try {
        await db.execute(sql.raw(stmt));
        results.push({ ok: true, stmt: preview });
      } catch (err: any) {
        results.push({ ok: false, stmt: preview, error: err.message });
        // Continue — all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING
      }
    }

    const failed = results.filter((r) => !r.ok);
    return Response.json({
      done: true,
      total: results.length,
      ok: results.filter((r) => r.ok).length,
      failed: failed.length,
      results,
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
