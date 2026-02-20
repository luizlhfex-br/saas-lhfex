const appUrl = (process.env.APP_URL || 'https://saas.lhfex.com.br').replace(/\/$/, '');

const checks = [
  {
    name: 'health',
    url: `${appUrl}/api/health`,
    expectedStatus: 200,
    expectedContains: '"status":"ok"',
  },
  {
    name: 'telegram-webhook',
    url: `${appUrl}/api/telegram-webhook`,
    expectedStatus: 200,
    expectedContains: '"status":"ok"',
  },
  {
    name: 'telegram-webhook-setup',
    url: `${appUrl}/api/telegram-webhook?setup=1`,
    expectedStatus: 200,
    expectedContains: '"ok":true',
  },
];

function log(message) {
  console.log(`[SMOKE] ${message}`);
}

async function runCheck(check) {
  const startedAt = Date.now();
  const response = await fetch(check.url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  const durationMs = Date.now() - startedAt;
  const body = await response.text();

  if (response.status !== check.expectedStatus) {
    throw new Error(`${check.name}: status ${response.status} (expected ${check.expectedStatus})`);
  }

  if (check.expectedContains && !body.includes(check.expectedContains)) {
    throw new Error(`${check.name}: body does not contain expected token ${check.expectedContains}`);
  }

  log(`${check.name} OK (${response.status}, ${durationMs}ms)`);
}

let failed = false;
log(`Starting smoke tests for ${appUrl}`);

for (const check of checks) {
  try {
    await runCheck(check);
  } catch (error) {
    failed = true;
    log(`${check.name} FAIL -> ${error.message}`);
  }
}

if (failed) {
  log('Smoke test FAILED');
  process.exit(1);
}

log('Smoke test PASSED');
