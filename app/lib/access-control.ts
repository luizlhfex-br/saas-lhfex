export const ACCESS_ROLES = {
  ADMIN: "admin",
  LUIZ: "luiz",
  FINANCEIRO: "financeiro",
  DEFAULT: "default",
} as const;

export const ACCESS_EMAIL_ROLES: Record<string, string> = {
  "luiz@lhfex.com.br": ACCESS_ROLES.LUIZ,
  "financeiro@lhfex.com.br": ACCESS_ROLES.FINANCEIRO,
};

export function getEmailRole(email: string): string {
  return ACCESS_EMAIL_ROLES[email.toLowerCase()] || ACCESS_ROLES.DEFAULT;
}

export function canAccessLuizModules(email: string): boolean {
  const role = getEmailRole(email);
  return role === ACCESS_ROLES.LUIZ || role === ACCESS_ROLES.ADMIN;
}

export function canManageGlobalAutomations(email: string): boolean {
  return canAccessLuizModules(email);
}
