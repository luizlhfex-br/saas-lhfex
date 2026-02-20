/**
 * Redis-based Rate Limiter
 * 
 * Protects endpoints from abuse using Redis for distributed rate limiting.
 * Survives deploys and scales across multiple instances.
 * 
 * Fallback: If Redis is unavailable, fails open (allows requests) to prevent blocking all traffic.
 */

import Redis from "ioredis";

let redis: Redis | null = null;
let redisAvailable = false;

/**
 * Get or create Redis client (lazy initialization)
 */
function getRedisClient(): Redis | null {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL;
  
  // If no Redis URL configured, skip Redis (fail open)
  if (!redisUrl) {
    if (!redisAvailable) {
      console.warn("⚠️  REDIS_URL not configured, rate limiting disabled");
      redisAvailable = true; // Prevent log spam
    }
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy(times) {
        if (times > 3) {
          console.error("❌ Redis max retries reached, disabling rate limiting");
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
      },
    });

    redis.on("error", (err) => {
      console.error("❌ Redis error:", err.message);
      redisAvailable = false;
    });

    redis.on("connect", () => {
      console.log("✅ Redis connected (rate limiting enabled)");
      redisAvailable = true;
    });

    redis.on("close", () => {
      console.warn("⚠️  Redis connection closed");
      redisAvailable = false;
    });

    return redis;
  } catch (error) {
    console.error("❌ Failed to initialize Redis:", error);
    return null;
  }
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

/**
 * Check rate limit using Redis sorted sets for precise sliding window
 * @param key - Unique identifier (e.g., IP address, userId)
 * @param maxAttempts - Maximum attempts allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitResult> {
  const client = getRedisClient();

  // Fail open if Redis unavailable
  if (!client || !redisAvailable) {
    return { allowed: true, remaining: maxAttempts };
  }

  try {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `ratelimit:${key}`;

    // Use Redis Sorted Set (ZSET) for sliding window rate limiting
    const multi = client.multi();

    // 1. Remove expired entries (outside time window)
    multi.zremrangebyscore(redisKey, 0, windowStart);

    // 2. Count remaining requests in current window
    multi.zcard(redisKey);

    // 3. Add current request with timestamp as score
    multi.zadd(redisKey, now, `${now}-${Math.random()}`);

    // 4. Set expiration on key (cleanup)
    multi.expire(redisKey, Math.ceil(windowMs / 1000));

    const results = await multi.exec();

    if (!results) {
      throw new Error("Redis multi command failed");
    }

    // Extract count before current request (index 1 is ZCARD result)
    const count = (results[1][1] as number) || 0;
    const remaining = Math.max(0, maxAttempts - count - 1);

    if (count >= maxAttempts) {
      const retryAfterSeconds = Math.ceil(windowMs / 1000);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    return { allowed: true, remaining };
  } catch (error) {
    console.error("❌ Rate limit check failed:", error);
    // Fail open: allow request if Redis operation fails
    return { allowed: true, remaining: maxAttempts };
  }
}

/**
 * Extract client IP from request headers (Cloudflare, proxy, or direct)
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Preset rate limit configurations (backward compatible)
 */
export const RATE_LIMITS = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },      // 5 attempts / 15 min
  chatApi: { maxAttempts: 20, windowMs: 60 * 1000 },        // 20 requests / min
  generalApi: { maxAttempts: 60, windowMs: 60 * 1000 },     // 60 requests / min
  export: { maxAttempts: 10, windowMs: 60 * 60 * 1000 },    // 10 exports / hour
} as const;

/**
 * Graceful shutdown (call on server stop)
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
      console.log("✅ Redis disconnected gracefully");
    } catch (error) {
      console.error("❌ Error disconnecting Redis:", error);
    } finally {
      redis = null;
      redisAvailable = false;
    }
  }
}
