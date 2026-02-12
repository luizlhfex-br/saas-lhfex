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
