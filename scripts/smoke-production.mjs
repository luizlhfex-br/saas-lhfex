const baseUrl = process.env.SMOKE_BASE_URL || "https://saas.lhfex.com.br";
const retryAttempts = Number(process.env.SMOKE_RETRY_ATTEMPTS || 6);
const retryDelayMs = Number(process.env.SMOKE_RETRY_DELAY_MS || 15000);

async function readText(response) {
  return await response.text();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertOk(name, path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    redirect: "follow",
    ...options,
  });

  if (!response.ok) {
    const body = await readText(response);
    throw new Error(`${name}: HTTP ${response.status} ${response.statusText}\n${body.slice(0, 500)}`);
  }

  return response;
}

async function waitForCheck(name, check, attempts = retryAttempts) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await check();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      console.warn(`${name}: tentativa ${attempt}/${attempts} falhou, aguardando ${retryDelayMs}ms`);
      await sleep(retryDelayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function main() {
  const loginResponse = await assertOk("login", "/login");
  const loginBody = await readText(loginResponse);
  if (!/LHFEX/i.test(loginBody)) {
    throw new Error("login: marcador esperado nao encontrado");
  }

  const healthResponse = await assertOk("health", "/api/health", {
    headers: { Accept: "application/json" },
  });
  const health = await healthResponse.json();
  if (health.status !== "ok") {
    throw new Error(`health: status inesperado ${JSON.stringify(health)}`);
  }

  const { response: openClawResponse, payload: openClaw } = await waitForCheck("openclaw-monitor", async () => {
    const response = await assertOk("openclaw-monitor", "/api/monitor-openclaw", {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();
    if (payload.ok !== true || payload.openclaw === "offline") {
      throw new Error(`openclaw-monitor: retorno inesperado ${JSON.stringify(payload)}`);
    }
    return { response, payload };
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        checks: [
          { name: "login", status: loginResponse.status },
          { name: "health", status: healthResponse.status, payload: health },
          { name: "openclaw-monitor", status: openClawResponse.status, payload: openClaw },
        ],
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
