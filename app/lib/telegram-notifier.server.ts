/**
 * Telegram Notifier - Alertas de Monitoramento
 * 
 * Envia notificações para o Telegram sobre eventos críticos do sistema:
 * - Redis: Falhas e reconexões
 * - Sentry: Erros capturados (opcional)
 * - Aplicação: Inicialização e status
 * 
 * Environment Variables:
 * - TELEGRAM_BOT_TOKEN: Bot token do Telegram
 * - TELEGRAM_CHAT_ID: Chat ID para receber notificações
 */

interface TelegramMessage {
  text: string;
  parse_mode?: "Markdown" | "HTML";
}

/**
 * Envia notificação para o Telegram
 */
export async function sendTelegramNotification(
  message: string,
  options: { parseMode?: "Markdown" | "HTML" } = {}
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Desabilitado se não configurado
  if (!botToken || !chatId) {
    return false;
  }

  try {
    const payload: TelegramMessage = {
      text: message,
      parse_mode: options.parseMode || "Markdown",
    };

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      console.error("[Telegram] Failed to send notification:", response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Telegram] Error sending notification:", error);
    return false;
  }
}

/**
 * Notifica sobre falha na conexão do Redis
 */
export async function notifyRedisFailure(error: Error) {
  const message = `
🔴 *Redis Connection Failed*

*Environment:* ${process.env.NODE_ENV || "unknown"}
*Time:* ${new Date().toISOString()}
*Error:* ${error.message}

⚠️ Sistema rodando com fallback em memória.
`.trim();

  await sendTelegramNotification(message);
}

/**
 * Notifica sobre reconexão do Redis
 */
export async function notifyRedisReconnect() {
  const message = `
🟢 *Redis Reconnected*

*Environment:* ${process.env.NODE_ENV || "unknown"}
*Time:* ${new Date().toISOString()}

✅ Cache operacional novamente.
`.trim();

  await sendTelegramNotification(message);
}

/**
 * Notifica sobre erro capturado pelo Sentry
 */
export async function notifySentryError(
  error: Error,
  context?: { url?: string; user?: string }
) {
  const message = `
⚠️ *Application Error*

*Environment:* ${process.env.NODE_ENV || "unknown"}
*Time:* ${new Date().toISOString()}
*Error:* ${error.message}
${context?.url ? `*URL:* ${context.url}` : ""}
${context?.user ? `*User:* ${context.user}` : ""}

🔍 Check Sentry dashboard for details.
`.trim();

  await sendTelegramNotification(message);
}

/**
 * Notifica sobre inicialização da aplicação
 */
export async function notifyAppStart() {
  const message = `
🚀 *Application Started*

*Environment:* ${process.env.NODE_ENV || "unknown"}
*Time:* ${new Date().toISOString()}
*Commit:* ${process.env.COMMIT_SHA?.substring(0, 7) || "unknown"}

✅ Sistema operacional.
`.trim();

  await sendTelegramNotification(message);
}

/**
 * Notifica sobre erro crítico no sistema
 */
export async function notifyCriticalError(
  title: string,
  error: Error,
  context?: Record<string, unknown>
) {
  const contextStr = context
    ? Object.entries(context)
        .map(([key, value]) => `*${key}:* ${value}`)
        .join("\n")
    : "";

  const message = `
🔥 *${title}*

*Environment:* ${process.env.NODE_ENV || "unknown"}
*Time:* ${new Date().toISOString()}
*Error:* ${error.message}
${contextStr ? `\n${contextStr}` : ""}

⚠️ Ação imediata necessária!
`.trim();

  await sendTelegramNotification(message);
}
