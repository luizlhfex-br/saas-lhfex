/**
 * Sentry Client Integration
 * 
 * Simplified client-side error logging
 */

/**
 * Log error to console (client-side fallback)
 * In production, errors are also sent to server via ErrorBoundary
 */
export function logErrorToSentry(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
) {
  // In development, log to console
  if (import.meta.env.DEV) {
    console.error("🔴 [Sentry Client]", error);
    if (context) {
      console.error("Context:", context);
    }
  }
  
  // In production, errors are caught by ErrorBoundary and sent to server
  // where they are logged to Sentry via sentry.server.ts
}
