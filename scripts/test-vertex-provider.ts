import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const envPath = resolve(process.cwd(), ".env.codex");
if (existsSync(envPath)) {
  loadEnvFile(envPath);
}

const { getVertexAuthState } = await import("../app/lib/vertex-auth.server");
const { askAgent } = await import("../app/lib/ai.server");

async function run() {
  const authState = getVertexAuthState();

  console.log("=== Ambiente Vertex (ADC) ===");
  console.log(
    JSON.stringify(
      {
        projectId: authState.projectId,
        authMode: authState.authMode,
        credentialsPathConfigured: Boolean(authState.credentialsPath),
        credentialsFileExists: authState.credentialsFileExists,
        defaultCredentialsPathConfigured: Boolean(authState.defaultCredentialsPath),
        defaultCredentialsFileExists: authState.defaultCredentialsFileExists,
      },
      null,
      2,
    ),
  );

  console.log("=== Teste 1: Vertex forçado ===");
  try {
    const vertex = await askAgent("airton", "Responda apenas OK.", "", {
      feature: "chat",
      forceProvider: "vertex_gemini",
      allowPaidFallback: false,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "vertex_forcado",
          provider: vertex.provider,
          model: vertex.model,
          content: vertex.content,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          mode: "vertex_forcado",
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
  }

  console.log("=== Teste 2: chain real ===");
  try {
    const chained = await askAgent("airton", "Responda apenas OK.", "", {
      feature: "chat",
      allowPaidFallback: false,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "chain_real",
          provider: chained.provider,
          model: chained.model,
          content: chained.content,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          mode: "chain_real",
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
  }
}

run().catch((error) => {
  console.error("[test-vertex-provider] fatal:", error);
  process.exitCode = 1;
});
