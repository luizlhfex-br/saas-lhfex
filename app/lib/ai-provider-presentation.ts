export function getAiProviderBadge(provider: string, model?: string): string {
  if (model === "fallback-free-only") {
    return "⚪ Free indisponivel";
  }

  if (model === "fallback") {
    return "⚪ IA indisponivel";
  }

  switch (provider) {
    case "vertex_gemini":
      return "🟣 Vertex";
    case "openrouter_qwen":
      return "🔵 OpenRouter Free";
    case "openrouter_llama":
      return "🔵 Llama Free";
    case "openrouter_deepseek_free":
      return "🔵 R1 Free";
    case "deepseek_direct":
      return "🟠 DeepSeek Direct";
    default:
      return "⚪";
  }
}
