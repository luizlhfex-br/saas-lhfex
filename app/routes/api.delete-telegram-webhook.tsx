/**
 * DELETE Telegram Webhook — one-shot helper
 *
 * GET /api/delete-telegram-webhook?token=OPENCLAW_TELEGRAM_TOKEN
 *
 * Chama deleteWebhook na API do Telegram para liberar o bot do modo webhook
 * (necessário antes de iniciar o openclaw.ai em modo polling/long polling).
 *
 * Após usar, pode remover esta rota ou deixá-la como utilitário.
 */

import type { Route } from "./+types/api.delete-telegram-webhook";
import { requireAuth } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const url = new URL(request.url);
  const token = url.searchParams.get("token") || process.env.OPENCLAW_TELEGRAM_TOKEN;

  if (!token) {
    return new Response(JSON.stringify({ error: "token não informado. Use ?token=SEU_BOT_TOKEN ou configure OPENCLAW_TELEGRAM_TOKEN" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    return new Response(JSON.stringify({ ok: data.ok, description: data.description, result: data.result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
