/**
 * Scheduled job runner for AI metrics monitoring
 * Run this as a cron job or scheduled task
 * 
 * Usage with Node:
 * node --loader ts-node/esm scripts/ai-metrics-cron.mjs
 * 
 * Cron schedule (every 15 minutes):
 * */15 * * * * cd /app && node scripts/ai-metrics-cron.mjs >> /var/log/ai-metrics.log 2>&1
 */

import { runMetricsCheck } from "../app/lib/ai-metrics.server.js";

async function main() {
  console.log(`[CRON] AI Metrics Check started at ${new Date().toISOString()}`);
  
  try {
    await runMetricsCheck();
    console.log(`[CRON] AI Metrics Check completed successfully`);
    process.exit(0);
  } catch (error) {
    console.error(`[CRON] AI Metrics Check failed:`, error);
    process.exit(1);
  }
}

main();
