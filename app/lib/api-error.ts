export type ApiErrorCode =
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "FORBIDDEN_MODULE"
  | "METHOD_NOT_ALLOWED"
  | "AI_PROVIDER_ERROR"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export interface ApiErrorPayload {
  error: string;
  code: ApiErrorCode;
  details?: unknown;
  retryAfter?: number;
}

export function buildApiError(
  code: ApiErrorCode,
  error: string,
  extras?: Omit<ApiErrorPayload, "code" | "error">
): ApiErrorPayload {
  return {
    error,
    code,
    ...extras,
  };
}

export function jsonApiError(
  code: ApiErrorCode,
  error: string,
  init?: ResponseInit,
  extras?: Omit<ApiErrorPayload, "code" | "error">
) {
  return Response.json(buildApiError(code, error, extras), init);
}

export async function parseApiErrorResponse(response: Response): Promise<ApiErrorPayload | null> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return null;
  }
}
