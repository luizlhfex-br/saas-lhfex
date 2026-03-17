import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GoogleGenAI } from "@google/genai";

function buildExpressHint(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("API keys are not supported by this API")
    ? "A chave atual nao esta sendo aceita como chave de Vertex AI Express Mode. Gere ou copie uma API key criada no console do Google Cloud em express mode."
    : null;
}

function loadEnvFile(filePath: string) {
  const processWithLoader = process as NodeJS.Process & {
    loadEnvFile?: (path?: string) => void;
  };

  if (typeof processWithLoader.loadEnvFile === "function") {
    processWithLoader.loadEnvFile(filePath);
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!key || process.env[key]) continue;

    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

async function run() {
  const envPath = resolve(process.cwd(), ".env.codex");
  if (existsSync(envPath)) {
    loadEnvFile(envPath);
  }

  const apiKey = process.env.GEMINI_VERTEX_EXPRESS_API_KEY?.trim() || process.env.GEMINI_VERTEX_API_KEY?.trim();
  const model = process.env.GEMINI_VERTEX_EXPRESS_MODEL?.trim() || process.env.GEMINI_VERTEX_MODEL?.trim() || "gemini-2.0-flash";
  const apiVersion = process.env.GEMINI_VERTEX_EXPRESS_API_VERSION?.trim() || "v1";

  if (!apiKey) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          mode: "vertex_express_mode",
          error: "GEMINI_VERTEX_EXPRESS_API_KEY (ou GEMINI_VERTEX_API_KEY) not configured",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const ai = new GoogleGenAI({
    vertexai: true,
    apiKey,
    apiVersion,
  });

  console.log("=== Teste 1: Vertex Express countTokens ===");
  try {
    const countTokens = await ai.models.countTokens({
      model,
      contents: "Responda apenas OK.",
    });

    console.log(
      JSON.stringify(
        {
          mode: "vertex_express_count_tokens",
          model,
          apiVersion,
          ok: true,
          totalTokens: countTokens.totalTokens ?? null,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          mode: "vertex_express_count_tokens",
          model,
          apiVersion,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          hint: buildExpressHint(error),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }

  console.log("=== Teste 2: Vertex Express generateContent ===");
  try {
    const response = await ai.models.generateContent({
      model,
      contents: "Responda apenas OK.",
      config: {
        temperature: 0,
        maxOutputTokens: 32,
      },
    });

    console.log(
      JSON.stringify(
        {
          mode: "vertex_express_generate_content",
          model,
          apiVersion,
          ok: true,
          text: response.text,
          usageMetadata: response.usageMetadata ?? null,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          mode: "vertex_express_generate_content",
          model,
          apiVersion,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          hint: buildExpressHint(error),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("[test-vertex-express-mode] fatal:", error);
  process.exitCode = 1;
});
