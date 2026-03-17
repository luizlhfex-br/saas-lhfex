/**
 * AI Diagnostic Endpoint
 * Provides comprehensive status of all AI providers and features
 * without exposing sensitive API keys
 */

import type { Route } from "./+types/api.ai-diagnostics";
import { requireAuth } from "~/lib/auth.server";
import { getUserRole, ROLES } from "~/lib/rbac.server";
import { getVertexAuthState, isVertexConfigured } from "~/lib/vertex-auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  if (getUserRole(user.email) !== ROLES.LUIZ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const diagnostics: {
    status: "healthy" | "degraded" | "unhealthy";
    providers: Record<string, {
      configured: boolean;
      status: "available" | "unavailable" | "unknown";
      features: string[];
      priority: number;
      details?: Record<string, unknown>;
    }>;
    features: Record<string, {
      status: "enabled" | "disabled";
      preferredProvider: string;
      fallbackChain: string[];
      constraints: {
        minLength: number;
        maxLength: number;
        maxOutputTokens: number;
        timeoutMs: number;
      };
    }>;
    timestamp: string;
  } = {
    status: "healthy",
    providers: {},
    features: {},
    timestamp: new Date().toISOString(),
  };

  // Check Provider Configuration
  const vertexAuth = getVertexAuthState();
  const vertexConfigured = isVertexConfigured();
  const openrouterConfigured = Boolean(process.env.OPENROUTER_API_KEY);
  const deepseekConfigured = Boolean(process.env.DEEPSEEK_API_KEY);

  diagnostics.providers.vertex_gemini = {
    configured: vertexConfigured,
    status: !vertexAuth.projectId
      ? "unavailable"
      : vertexAuth.authMode === "service-account-file" || vertexAuth.authMode === "application-default-credentials"
        ? "available"
        : vertexAuth.authMode === "service-account-file-missing" || vertexAuth.authMode === "application-default-credentials-missing"
          ? "unavailable"
          : "unknown",
    features: ["chat", "ncm_classification", "life_agent", "ocr"],
    priority: 1,
    details: {
      authMode: vertexAuth.authMode,
      projectConfigured: Boolean(vertexAuth.projectId),
      credentialsPathConfigured: Boolean(vertexAuth.credentialsPath),
      credentialsFileExists: vertexAuth.credentialsFileExists,
      defaultCredentialsPathConfigured: Boolean(vertexAuth.defaultCredentialsPath),
      defaultCredentialsFileExists: vertexAuth.defaultCredentialsFileExists,
    },
  };

  diagnostics.providers.openrouter_qwen = {
    configured: openrouterConfigured,
    status: openrouterConfigured ? "available" : "unavailable",
    features: ["chat", "ncm_classification", "life_agent"],
    priority: 2,
  };

  diagnostics.providers.openrouter_llama = {
    configured: openrouterConfigured,
    status: openrouterConfigured ? "available" : "unavailable",
    features: ["chat", "ncm_classification", "life_agent"],
    priority: 3,
  };

  diagnostics.providers.openrouter_deepseek_free = {
    configured: openrouterConfigured,
    status: openrouterConfigured ? "available" : "unavailable",
    features: ["chat", "ncm_classification", "life_agent", "ocr"],
    priority: 4,
  };

  diagnostics.providers.deepseek_direct = {
    configured: deepseekConfigured,
    status: deepseekConfigured ? "available" : "unavailable",
    features: ["chat", "ncm_classification", "ocr"],
    priority: 5,
  };

  // Feature Status
  const hasAnyProvider = vertexConfigured || openrouterConfigured || deepseekConfigured;
  const fullFallbackChain = [
    "vertex_gemini",
    "openrouter_qwen",
    "openrouter_llama",
    "openrouter_deepseek_free",
    "deepseek_direct",
  ].filter((provider) => {
    if (provider === "vertex_gemini") return vertexConfigured;
    if (provider === "deepseek_direct") return deepseekConfigured;
    return openrouterConfigured;
  });

  diagnostics.features.chat = {
    status: hasAnyProvider ? "enabled" : "disabled",
    preferredProvider: fullFallbackChain[0] || "none",
    fallbackChain: fullFallbackChain,
    constraints: {
      minLength: 1,
      maxLength: 5000,
      maxOutputTokens: 2000,
      timeoutMs: 30000,
    },
  };

  diagnostics.features.ncm_classification = {
    status: hasAnyProvider ? "enabled" : "disabled",
    preferredProvider: fullFallbackChain[0] || "none",
    fallbackChain: fullFallbackChain,
    constraints: {
      minLength: 5,
      maxLength: 5000,
      maxOutputTokens: 3000,
      timeoutMs: 45000,
    },
  };

  diagnostics.features.life_agent = {
    status: hasAnyProvider ? "enabled" : "disabled",
    preferredProvider: fullFallbackChain[0] || "none",
    fallbackChain: fullFallbackChain,
    constraints: {
      minLength: 5,
      maxLength: 3000,
      maxOutputTokens: 1200,
      timeoutMs: 30000,
    },
  };

  diagnostics.features.ocr = {
    status: hasAnyProvider ? "enabled" : "disabled",
    preferredProvider: fullFallbackChain[0] || "none",
    fallbackChain: fullFallbackChain,
    constraints: {
      minLength: 10,
      maxLength: 50000,
      maxOutputTokens: 2000,
      timeoutMs: 60000,
    },
  };

  // Determine overall health
  const enabledFeatures = Object.values(diagnostics.features).filter((f) => f.status === "enabled").length;
  const totalFeatures = Object.keys(diagnostics.features).length;

  if (enabledFeatures === 0) {
    diagnostics.status = "unhealthy";
  } else if (enabledFeatures < totalFeatures) {
    diagnostics.status = "degraded";
  } else {
    diagnostics.status = "healthy";
  }

  const httpStatus = diagnostics.status === "healthy" ? 200 : diagnostics.status === "degraded" ? 200 : 503;

  return Response.json(diagnostics, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Type": "application/json",
    },
  });
}
