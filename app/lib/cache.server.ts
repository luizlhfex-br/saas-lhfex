/**
 * Redis Cache Server
 * 
 * Provides caching utilities for expensive external API calls:
 * - Exchange rates (USD/BRL)
 * - CNPJ enrichment (BrasilAPI)
 * - NCM descriptions
 * 
 * Fallback: If Redis is unavailable, returns null (cache miss)
 */

import Redis from "ioredis";

let redis: Redis | null = null;
let redisAvailable = false;

/**
 * Get or create Redis client (reuses connection from rate-limit.server.ts)
 */
function getRedisClient(): Redis | null {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy(times) {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    redis.on("error", (err) => {
      console.error("❌ [Cache] Redis error:", err.message);
      redisAvailable = false;
    });

    redis.on("connect", () => {
      console.log("✅ [Cache] Redis connected");
      redisAvailable = true;
    });

    redis.on("close", () => {
      console.warn("⚠️  [Cache] Redis connection closed");
      redisAvailable = false;
    });

    return redis;
  } catch (error) {
    console.error("❌ [Cache] Failed to initialize Redis:", error);
    return null;
  }
}

/**
 * Get cached value
 * @param key - Cache key
 * @returns Parsed JSON value or null if not found/expired/error
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  
  if (!client || !redisAvailable) {
    return null;
  }

  try {
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`❌ [Cache] Failed to get key "${key}":`, error);
    return null;
  }
}

/**
 * Set cached value with TTL
 * @param key - Cache key
 * @param value - Value to cache (will be JSON stringified)
 * @param ttlSeconds - Time to live in seconds
 */
export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
  const client = getRedisClient();
  
  if (!client || !redisAvailable) {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    await client.setex(key, ttlSeconds, serialized);
    return true;
  } catch (error) {
    console.error(`❌ [Cache] Failed to set key "${key}":`, error);
    return false;
  }
}

/**
 * Delete cached value
 * @param key - Cache key
 */
export async function deleteCache(key: string): Promise<boolean> {
  const client = getRedisClient();
  
  if (!client || !redisAvailable) {
    return false;
  }

  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.error(`❌ [Cache] Failed to delete key "${key}":`, error);
    return false;
  }
}

/**
 * Delete multiple cache keys by pattern
 * @param pattern - Redis key pattern (e.g., "exchange-rate:*")
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  const client = getRedisClient();
  
  if (!client || !redisAvailable) {
    return 0;
  }

  try {
    const keys = await client.keys(pattern);
    if (keys.length === 0) return 0;
    await client.del(...keys);
    return keys.length;
  } catch (error) {
    console.error(`❌ [Cache] Failed to delete pattern "${pattern}":`, error);
    return 0;
  }
}

/**
 * Cache presets with recommended TTLs
 */
export const CACHE_TTL = {
  exchangeRate: 60 * 60,         // 1 hour (cotações mudam frequentemente)
  cnpjData: 24 * 60 * 60,        // 24 hours (dados cadastrais mudam raramente)
  ncmDescription: 7 * 24 * 60 * 60, // 7 days (nomenclaturas são estáticas)
} as const;

/**
 * Graceful shutdown
 */
export async function disconnectCache(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
      console.log("✅ [Cache] Redis disconnected gracefully");
    } catch (error) {
      console.error("❌ [Cache] Error disconnecting Redis:", error);
    } finally {
      redis = null;
      redisAvailable = false;
    }
  }
}
