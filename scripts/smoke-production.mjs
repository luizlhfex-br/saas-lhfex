const baseUrl = process.env.SMOKE_BASE_URL || "https://saas.lhfex.com.br";

async function readText(response) {
  return await response.text();
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

  const openClawResponse = await assertOk("openclaw-monitor", "/api/monitor-openclaw", {
    headers: { Accept: "application/json" },
  });
  const openClaw = await openClawResponse.json();
  if (openClaw.ok !== true || openClaw.openclaw === "offline") {
    throw new Error(`openclaw-monitor: retorno inesperado ${JSON.stringify(openClaw)}`);
  }

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
