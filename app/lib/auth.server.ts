import { randomBytes } from "crypto";
import { hash, compare } from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { db } from "./db.server";
import { users, sessions } from "../../drizzle/schema";
import { hashToken } from "./crypto.server";

const SESSION_COOKIE = "__session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}

export async function createSession(userId: string, request: Request): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHashed = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await db.insert(sessions).values({
    userId,
    tokenHash: tokenHashed,
    expiresAt,
    ipAddress: request.headers.get("x-forwarded-for") || "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  });

  return token;
}

export function getSessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function getTokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export async function getSession(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  const tokenHashed = hashToken(token);
  const result = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHashed),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (result.length === 0) return null;
  return { session: result[0].session, user: result[0].user };
}

export async function requireAuth(request: Request) {
  const data = await getSession(request);
  if (!data) {
    throw new Response(null, {
      status: 302,
      headers: { Location: "/login" },
    });
  }
  return data;
}

export async function destroySession(request: Request): Promise<void> {
  const token = getTokenFromRequest(request);
  if (!token) return;
  const tokenHashed = hashToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHashed));
}

/**
 * Progressive Login Lockout (Redis-based)
 * Track failed login attempts and temporarily block accounts after threshold
 */

import { checkRateLimit } from "./rate-limit.server";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export interface LoginAttemptResult {
  allowed: boolean;
  attemptsRemaining?: number;
  lockedUntil?: Date;
}

/**
 * Check if email/IP is locked out from login attempts
 * Uses Redis rate limiting under the hood
 */
export async function checkLoginAttempts(email: string, ip: string): Promise<LoginAttemptResult> {
  // Check both email and IP for abuse prevention
  const emailKey = `login-attempts:email:${email.toLowerCase()}`;
  const ipKey = `login-attempts:ip:${ip}`;
  
  const emailCheck = await checkRateLimit(emailKey, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS);
  const ipCheck = await checkRateLimit(ipKey, MAX_FAILED_ATTEMPTS * 3, LOCKOUT_DURATION_MS); // More lenient for IP (shared networks)
  
  // If either is blocked, deny login
  if (!emailCheck.allowed) {
    return {
      allowed: false,
      attemptsRemaining: 0,
      lockedUntil: new Date(Date.now() + (emailCheck.retryAfterSeconds || 30 * 60) * 1000),
    };
  }
  
  if (!ipCheck.allowed) {
    return {
      allowed: false,
      attemptsRemaining: 0,
      lockedUntil: new Date(Date.now() + (ipCheck.retryAfterSeconds || 30 * 60) * 1000),
    };
  }
  
  return {
    allowed: true,
    attemptsRemaining: emailCheck.remaining,
  };
}

/**
 * Record a failed login attempt
 * This is handled automatically by checkRateLimit when called during login
 */
export function recordFailedLogin(email: string, ip: string): void {
  // Rate limit recording happens automatically in checkLoginAttempts
  // This function exists for explicit logging/audit purposes
  console.warn(`[AUTH] Failed login attempt: ${email} from ${ip}`);
}
