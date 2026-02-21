import { data } from "react-router";
import type { Route } from "./+types/api.openclaw-announce";
import { requireAuth } from "~/lib/auth.server";
import { announcePromotion, announceRaffle, getScheduledPromotions, getUpcomingRaffles } from "~/lib/openclaw-bot.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  // GET /api/openclaw-announce?type=promotions|raffles - List scheduled items
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  if (type === "promotions") {
    const promotions = await getScheduledPromotions();
    return data({ success: true, data: promotions }, { status: 200 });
  }

  if (type === "raffles") {
    const raffles = await getUpcomingRaffles();
    return data({ success: true, data: raffles }, { status: 200 });
  }

  return data({ success: false, error: "Invalid type parameter" }, { status: 400 });
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);

  // POST /api/openclaw-announce - Send announcement
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const { type, id } = body;

      if (!type || !id) {
        return data(
          { success: false, error: "Missing type or id" },
          { status: 400 }
        );
      }

      let success = false;

      if (type === "promotion") {
        success = await announcePromotion(id);
      } else if (type === "raffle") {
        success = await announceRaffle(id);
      } else {
        return data(
          { success: false, error: "Invalid type (use 'promotion' or 'raffle')" },
          { status: 400 }
        );
      }

      if (success) {
        return data(
          { success: true, message: "Announcement sent to Telegram" },
          { status: 200 }
        );
      } else {
        return data(
          { success: false, error: "Failed to send Telegram message" },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error("[OpenCLAW API] Error:", error);
      return data(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  return data({ success: false, error: "Method not allowed" }, { status: 405 });
}
