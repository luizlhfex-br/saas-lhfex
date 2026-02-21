import { db } from "~/lib/db.server";
import { chatConversations } from "drizzle/schema";
import { sql } from "drizzle-orm";

/**
 * Chat Health Check Endpoint
 * Validates:
 * - Database connection
 * - Chat tables exist
 * - AI provider configuration
 * - Session availability
 * 
 * Returns detailed health status for diagnostics
 */
export async function loader({ request }: { request: Request }) {
  const healthStatus: {
    status: "healthy" | "degraded" | "unhealthy";
    checks: Record<string, { status: "pass" | "fail"; message: string; details?: unknown }>;
    timestamp: string;
  } = {
    status: "healthy",
    checks: {},
    timestamp: new Date().toISOString(),
  };

  // Check 1: Database connection
  try {
    await db.execute(sql`SELECT 1`);
    healthStatus.checks.database = {
      status: "pass",
      message: "Database connection OK",
    };
  } catch (error) {
    healthStatus.checks.database = {
      status: "fail",
      message: "Database connection failed",
      details: error instanceof Error ? error.message : String(error),
    };
    healthStatus.status = "unhealthy";
  }

  // Check 2: Chat tables exist
  try {
    await db.select({ count: sql<number>`count(*)` }).from(chatConversations).limit(1);
    healthStatus.checks.chatTables = {
      status: "pass",
      message: "Chat tables exist",
    };
  } catch (error) {
    healthStatus.checks.chatTables = {
      status: "fail",
      message: "Chat tables not found - run migrations",
      details: error instanceof Error ? error.message : String(error),
    };
    healthStatus.status = "unhealthy";
  }

  // Check 3: AI Provider Configuration
  const providers: Record<string, boolean> = {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
  };

  const activeProviders = Object.entries(providers)
    .filter(([_, enabled]) => enabled)
    .map(([name]) => name);

  if (activeProviders.length === 0) {
    healthStatus.checks.aiProviders = {
      status: "fail",
      message: "No AI providers configured",
      details: { configured: providers },
    };
    healthStatus.status = "unhealthy";
  } else {
    healthStatus.checks.aiProviders = {
      status: "pass",
      message: `${activeProviders.length} provider(s) configured`,
      details: { active: activeProviders },
    };
  }

  // Check 4: Session middleware (basic check)
  const hasCookie = request.headers.get("cookie");
  healthStatus.checks.sessionSupport = {
    status: hasCookie ? "pass" : "pass", // Pass regardless - just informational
    message: hasCookie
      ? "Session cookie present (user authenticated)"
      : "No session cookie (user not authenticated - expected for health check)",
  };

  // Check 5: Rate limiting service
  try {
    const redisUrl = process.env.REDIS_URL;
    healthStatus.checks.rateLimiting = {
      status: redisUrl ? "pass" : "fail",
      message: redisUrl
        ? "Redis configured for rate limiting"
        : "Redis not configured - rate limiting may not work",
    };
    if (!redisUrl) {
      healthStatus.status = healthStatus.status === "healthy" ? "degraded" : healthStatus.status;
    }
  } catch (error) {
    healthStatus.checks.rateLimiting = {
      status: "fail",
      message: "Rate limiting check failed",
      details: error instanceof Error ? error.message : String(error),
    };
    healthStatus.status = "degraded";
  }

  // Determine HTTP status code
  const httpStatus = healthStatus.status === "healthy" ? 200 : healthStatus.status === "degraded" ? 200 : 503;

  return Response.json(healthStatus, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Type": "application/json",
    },
  });
}
