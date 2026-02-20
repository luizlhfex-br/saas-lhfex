const healthUrl = process.env.HEALTHCHECK_URL || 'https://saas.lhfex.com.br/api/health';
const intervalSeconds = Number(process.env.HEALTHCHECK_INTERVAL_SECONDS || 20);
const failThreshold = Number(process.env.HEALTHCHECK_FAIL_THRESHOLD || 3);
const appName = process.env.HEALTHCHECK_APP_NAME || 'saas-lhfex';
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

let consecutiveFailures = 0;
let alertOpen = false;

function timestamp() {
  return new Date().toISOString();
}

async function sendTelegram(text) {
  if (!telegramBotToken || !telegramChatId) return;

  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegramChatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[${timestamp()}] Telegram send failed: ${response.status} ${body}`);
  }
}

async function checkHealth() {
  const startedAt = Date.now();

  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const isHealthy = text.includes('"status":"ok"');
    if (!isHealthy) {
      throw new Error('Unexpected health payload');
    }

    if (alertOpen) {
      await sendTelegram(
        `✅ ${appName} recovered\nURL: ${healthUrl}\nTime: ${timestamp()}`
      );
      alertOpen = false;
    }

    consecutiveFailures = 0;
    console.log(`[${timestamp()}] OK (${durationMs}ms)`);
  } catch (error) {
    consecutiveFailures += 1;
    console.error(`[${timestamp()}] FAIL #${consecutiveFailures}: ${error.message}`);

    if (consecutiveFailures >= failThreshold && !alertOpen) {
      alertOpen = true;
      await sendTelegram(
        `🚨 ${appName} possible restart loop / downtime\nURL: ${healthUrl}\nFailures: ${consecutiveFailures}\nTime: ${timestamp()}`
      );
    }
  }
}

console.log(`[${timestamp()}] Starting watchdog for ${appName}`);
console.log(`[${timestamp()}] URL=${healthUrl} interval=${intervalSeconds}s threshold=${failThreshold}`);

await checkHealth();
setInterval(() => {
  checkHealth().catch((error) => {
    console.error(`[${timestamp()}] watchdog error: ${error.message}`);
  });
}, intervalSeconds * 1000);
