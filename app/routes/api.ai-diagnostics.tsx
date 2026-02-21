/**
 * AI Diagnostic Endpoint
 * Provides comprehensive status of all AI providers and features
 * without exposing sensitive API keys
 */

export async function loader() {
  const diagnostics: {
    status: "healthy" | "degraded" | "unhealthy";
    providers: Record<string, {
      configured: boolean;
      status: "available" | "unavailable" | "unknown";
      features: string[];
      priority: number;
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
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const openrouterConfigured = Boolean(process.env.OPENROUTER_API_KEY);
  const deepseekConfigured = Boolean(process.env.DEEPSEEK_API_KEY);

  diagnostics.providers.gemini = {
    configured: geminiConfigured,
    status: geminiConfigured ? "available" : "unavailable",
    features: ["chat", "ncm_classification", "life_agent", "ocr"],
    priority: 1, // Free tier, highest priority
  };

  diagnostics.providers.openrouter_free = {
    configured: openrouterConfigured,
    status: openrouterConfigured ? "available" : "unavailable",
    features: ["chat", "ncm_classification", "life_agent"],
    priority: 2, // Free tier fallback
  };

  diagnostics.providers.deepseek = {
    configured: deepseekConfigured || openrouterConfigured,
    status: deepseekConfigured || openrouterConfigured ? "available" : "unavailable",
    features: ["chat", "ncm_classification", "ocr"],
    priority: 3, // Paid tier, last resort
  };

  // Feature Status
  const hasAnyProvider = geminiConfigured || openrouterConfigured || deepseekConfigured;

  diagnostics.features.chat = {
    status: hasAnyProvider ? "enabled" : "disabled",
    preferredProvider: geminiConfigured ? "gemini" : openrouterConfigured ? "openrouter_free" : "deepseek",
    fallbackChain: ["gemini", "openrouter_free", "deepseek"].filter((p) => {
      if (p === "gemini") return geminiConfigured;
      if (p === "openrouter_free") return openrouterConfigured;
      if (p === "deepseek") return deepseekConfigured || openrouterConfigured;
      return false;
    }),
    constraints: {
      minLength: 1,
      maxLength: 5000,
      maxOutputTokens: 2000,
      timeoutMs: 30000,
    },
  };

  diagnostics.features.ncm_classification = {
    status: hasAnyProvider ? "enabled" : "disabled",
    preferredProvider: deepseekConfigured || openrouterConfigured ? "deepseek" : "gemini",
    fallbackChain: ["deepseek", "gemini", "openrouter_free"].filter((p) => {
      if (p === "gemini") return geminiConfigured;
      if (p === "openrouter_free") return openrouterConfigured;
      if (p === "deepseek") return deepseekConfigured || openrouterConfigured;
      return false;
    }),
    constraints: {
      minLength: 5,
      maxLength: 5000,
      maxOutputTokens: 3000,
      timeoutMs: 45000,
    },
  };

  diagnostics.features.life_agent = {
    status: geminiConfigured || openrouterConfigured ? "enabled" : "disabled",
    preferredProvider: geminiConfigured ? "gemini" : "openrouter_free",
    fallbackChain: ["gemini", "openrouter_free"].filter((p) => {
      if (p === "gemini") return geminiConfigured;
      if (p === "openrouter_free") return openrouterConfigured;
      return false;
    }),
    constraints: {
      minLength: 5,
      maxLength: 3000,
      maxOutputTokens: 1200,
      timeoutMs: 30000,
    },
  };

  diagnostics.features.ocr = {
    status: deepseekConfigured || openrouterConfigured ? "enabled" : "disabled",
    preferredProvider: "deepseek",
    fallbackChain: ["deepseek"].filter(() => deepseekConfigured || openrouterConfigured),
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
