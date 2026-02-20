/**
 * Sentry Integration for Error Tracking and Performance Monitoring
 * 
 * Environment Variables:
 * - SENTRY_DSN: Sentry project DSN (required)
 * - NODE_ENV: Environment (production, development)
 * - COMMIT_SHA: Git commit SHA for release tracking
 */

import * as Sentry from "@sentry/remix";
import { notifySentryError } from "./telegram-notifier.server";

let sentryInitialized = false;

/**
 * Initialize Sentry for server-side error tracking
 */
export function initSentryServer() {
  if (sentryInitialized) return;

  const sentryDsn = process.env.SENTRY_DSN;
  
  if (!sentryDsn) {
    console.warn("⚠️  SENTRY_DSN not configured, error tracking disabled");
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || "development",
      
      // Performance Monitoring
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0, // 10% in prod, 100% in dev
      
      // Release tracking (uses git commit SHA)
      release: process.env.COMMIT_SHA || "unknown",
      
      // Filter sensitive data
      beforeSend(event, hint) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
        
        // Remove password fields from form data
        if (event.request?.data && typeof event.request.data === "object") {
          const data = event.request.data as Record<string, unknown>;
          if (data.password) data.password = "[REDACTED]";
          if (data.passwordHash) data.passwordHash = "[REDACTED]";
        }
        
        return event;
      },
      
      // Ignore common non-errors
      ignoreErrors: [
        "ResizeObserver loop limit exceeded",
        "Non-Error promise rejection captured",
        "Network request failed",
        "Failed to fetch",
      ],
      
      // Integration configuration
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Postgres(),
      ],
    });

    sentryInitialized = true;
    console.log("✅ Sentry initialized (server-side)");
  } catch (error) {
    console.error("❌ Failed to initialize Sentry:", error);
  }
}

/**
 * Capture error with Sentry
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!sentryInitialized) return;
  
  Sentry.captureException(error, {
    extra: context,
  });

  void notifySentryError(error);
}

/**
 * Capture message with Sentry
 */
export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
  if (!sentryInitialized) return;
  
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for Sentry
 */
export function setUserContext(user: { id: string; email: string; name?: string | null }) {
  if (!sentryInitialized) return;
  
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name || undefined,
  });
}

/**
 * Clear user context on logout
 */
export function clearUserContext() {
  if (!sentryInitialized) return;
  
  Sentry.setUser(null);
}

/**
 * Start a Sentry transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
  if (!sentryInitialized) return null;
  
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Flush Sentry events (useful before process exit)
 */
export async function flushSentry(timeout = 2000): Promise<void> {
  if (!sentryInitialized) return;
  
  try {
    await Sentry.close(timeout);
    console.log("✅ Sentry flushed");
  } catch (error) {
    console.error("❌ Error flushing Sentry:", error);
  }
}
