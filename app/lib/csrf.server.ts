/**
 * CSRF Protection for Forms
 * 
 * Protects against Cross-Site Request Forgery attacks by validating tokens
 * in POST/PUT/DELETE requests.
 * 
 * Usage:
 * 1. In loader: generate token and pass to client
 * 2. In form: include hidden input with token
 * 3. In action: validate token before processing
 */

import { createCookie } from "react-router";
import crypto from "crypto";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = "__Host-csrf";

// Cookie for storing CSRF token (httpOnly, secure, sameSite)
export const csrfCookie = createCookie(CSRF_COOKIE_NAME, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: 60 * 60 * 24, // 24 hours
});

/**
 * Generate a new CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("base64url");
}

/**
 * Get CSRF token from request cookie or generate new one
 */
export async function getCSRFToken(request: Request): Promise<string> {
  const cookieHeader = request.headers.get("Cookie");
  const token = await csrfCookie.parse(cookieHeader);
  
  if (typeof token === "string" && token.length > 0) {
    return token;
  }
  
  return generateCSRFToken();
}

/**
 * Validate CSRF token from form data against cookie token
 * @throws Error if token is missing or invalid
 */
export async function validateCSRFToken(request: Request, formToken: string | null): Promise<void> {
  const cookieHeader = request.headers.get("Cookie");
  const cookieToken = await csrfCookie.parse(cookieHeader);

  if (!formToken) {
    throw new Error("CSRF token missing from form data");
  }

  if (!cookieToken) {
    throw new Error("CSRF token missing from cookie");
  }

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(formToken), Buffer.from(cookieToken))) {
    throw new Error("CSRF token mismatch");
  }
}

/**
 * Create response headers with CSRF cookie
 */
export async function setCSRFCookie(token: string): Promise<string> {
  return await csrfCookie.serialize(token);
}

/**
 * Helper: Extract CSRF token from FormData and validate
 */
export async function requireValidCSRF(request: Request, formData: FormData): Promise<void> {
  const token = formData.get("csrf") as string | null;
  await validateCSRFToken(request, token);
}
