import { randomBytes } from "crypto";
import { hash, compare } from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { db } from "./db.server";
import { users, sessions, userCompanies } from "../../drizzle/schema";
import { hashToken } from "./crypto.server";

const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-session" : "__session";
const LEGACY_SESSION_COOKIE = "__session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function buildSessionCookie(name: string, value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${value}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

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

  const [primaryCompany] = await db
    .select({ companyId: userCompanies.companyId })
    .from(userCompanies)
    .where(and(eq(userCompanies.userId, userId), eq(userCompanies.isPrimary, true)))
    .limit(1);

  await db.insert(sessions).values({
    userId,
    companyId: primaryCompany?.companyId ?? null,
    tokenHash: tokenHashed,
    expiresAt,
    ipAddress: request.headers.get("x-forwarded-for") || "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  });

  return token;
}

export function getSessionCookie(token: string): string {
  return buildSessionCookie(SESSION_COOKIE, token, SESSION_MAX_AGE);
}

export function clearSessionCookie(): string {
  return buildSessionCookie(SESSION_COOKIE, "", 0);
}

export function getSessionCookieHeaders(token: string): string[] {
  const cookies = [buildSessionCookie(SESSION_COOKIE, token, SESSION_MAX_AGE)];
  if (LEGACY_SESSION_COOKIE !== SESSION_COOKIE) {
    cookies.push(buildSessionCookie(LEGACY_SESSION_COOKIE, "", 0));
  }
  return cookies;
}

export function clearSessionCookieHeaders(): string[] {
  return Array.from(new Set([SESSION_COOKIE, LEGACY_SESSION_COOKIE])).map((cookieName) =>
    buildSessionCookie(cookieName, "", 0)
  );
}

function parseCookieValue(cookie: string, name: string): string | null {
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}

function getTokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  return (
    parseCookieValue(cookie, SESSION_COOKIE) ||
    (LEGACY_SESSION_COOKIE !== SESSION_COOKIE ? parseCookieValue(cookie, LEGACY_SESSION_COOKIE) : null)
  );
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

import { getRateLimitStatus, recordRateLimitHit } from "./rate-limit.server";

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
  
  const emailCheck = await getRateLimitStatus(emailKey, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS);
  const ipCheck = await getRateLimitStatus(ipKey, MAX_FAILED_ATTEMPTS * 3, LOCKOUT_DURATION_MS); // More lenient for IP (shared networks)
  
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
 * Record a failed login attempt without penalizing successful logins.
 */
export async function recordFailedLogin(email: string, ip: string): Promise<void> {
  await Promise.all([
    recordRateLimitHit(`login-attempts:email:${email.toLowerCase()}`, LOCKOUT_DURATION_MS),
    recordRateLimitHit(`login-attempts:ip:${ip}`, LOCKOUT_DURATION_MS),
  ]);
  console.warn(`[AUTH] Failed login attempt: ${email} from ${ip}`);
}
