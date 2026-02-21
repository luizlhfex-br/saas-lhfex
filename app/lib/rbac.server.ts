/**
 * Role-based Access Control (RBAC)
 * Define access rules based on user email
 */

import { redirect } from "react-router";
import type { Session } from "~/lib/auth.server";

export const ROLES = {
  ADMIN: "admin", // All access
  LUIZ: "luiz", // Access to vida-pessoal + public-procurement
  FINANCEIRO: "financeiro", // Access only to core comex (financial, crm, processes, etc)
  DEFAULT: "default", // Limited access to core modules only
} as const;

export const EMAIL_ROLES: Record<string, string> = {
  "luiz@lhfex.com.br": ROLES.LUIZ,
  "financeiro@lhfex.com.br": ROLES.FINANCEIRO,
  // Add more mappings as needed
};

/**
 * Determine user role based on email
 */
export function getUserRole(email: string): string {
  return EMAIL_ROLES[email.toLowerCase()] || ROLES.DEFAULT;
}

/**
 * Guard function for route protection
 * Use in loaders to require specific role
 */
export async function requireRole(
  session: Session,
  allowedRoles: string[]
): Promise<void> {
  const userRole = getUserRole(session.email);

  // Admin has access to everything
  if (userRole === ROLES.ADMIN) {
    return;
  }

  if (!allowedRoles.includes(userRole)) {
    console.warn(`Access denied for role ${userRole} to resource requiring ${allowedRoles.join(", ")}`);
    throw redirect("/dashboard?error=access_denied");
  }
}

/**
 * Check if user has access to a module
 */
export function hasAccess(session: Session, module: "vida-pessoal" | "public-procurement" | "core"): boolean {
  const role = getUserRole(session.email);

  // Admin has access to everything
  if (role === ROLES.ADMIN) return true;

  // Luiz has access to everything
  if (role === ROLES.LUIZ) return true;

  // Financeiro only has access to core (comex)
  if (role === ROLES.FINANCEIRO && module === "core") return true;

  // Default users only have core access
  if (role === ROLES.DEFAULT && module === "core") return true;

  return false;
}
