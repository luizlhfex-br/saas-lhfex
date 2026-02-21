/**
 * I18n Server Utilities
 * 
 * Server-side internationalization helpers
 */

type UserLike = { locale?: string | null };

/**
 * Get user locale from preferences or default to pt-BR
 */
export async function getUserLocale(request: Request, user: UserLike): Promise<string> {
  // In the future, this could read from user preferences or Accept-Language header
  // For now, default to Brazilian Portuguese
  return "pt-BR";
}
