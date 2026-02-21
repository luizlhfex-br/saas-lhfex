-- Add latency_ms column to ai_usage_logs for P2 metrics tracking
ALTER TABLE "ai_usage_logs" ADD COLUMN "latency_ms" integer;
