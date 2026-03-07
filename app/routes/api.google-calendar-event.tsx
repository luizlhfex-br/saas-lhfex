import { data } from "react-router";
import type { Route } from "./+types/api.google-calendar-event";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { askAgent } from "~/lib/ai.server";
import {
  createGoogleCalendarEvent,
  getValidGoogleToken,
} from "~/lib/google.server";

type ParsedNaturalEvent = {
  title?: string;
  description?: string;
  location?: string;
  startDateTime?: string;
  endDateTime?: string;
};

function extractJsonObject(text: string): ParsedNaturalEvent | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function parseNaturalEventText(naturalText: string, nowIso: string): Promise<ParsedNaturalEvent | null> {
  const prompt = [
    "Converta o texto abaixo em um evento de agenda.",
    "Retorne APENAS JSON válido sem markdown com as chaves:",
    '{"title":"...","description":"...","location":"...","startDateTime":"ISO-8601","endDateTime":"ISO-8601"}',
    "Regras:",
    "- fuso: America/Sao_Paulo",
    "- se não houver horário final, use +1h",
    "- se faltar título, gere um título curto objetivo",
    `Agora (referência): ${nowIso}`,
    `Texto: ${naturalText}`,
  ].join("\n");

  const response = await askAgent("airton", prompt, "calendar-natural-parser", {
    restricted: false,
    feature: "chat",
  });

  return extractJsonObject(response.content);
}

function toIsoDate(input?: string | null): string | null {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const token = await getValidGoogleToken(user.id);
  return data({ connected: !!token });
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const googleToken = await getValidGoogleToken(user.id);
  if (!googleToken) {
    return data({ error: "Google não conectado. Conecte em Configurações e reautorize para Calendar." }, { status: 400 });
  }

  const contentType = request.headers.get("content-type") || "";
  let title = "";
  let description = "";
  let location = "";
  let timeZone = "America/Sao_Paulo";
  let startDateTime = "";
  let endDateTime = "";
  let naturalText = "";
  let remindersMinutes: number[] = [];

  if (contentType.includes("application/json")) {
    const body = await request.json() as Record<string, unknown>;
    title = String(body.title || "").trim();
    description = String(body.description || "").trim();
    location = String(body.location || "").trim();
    timeZone = String(body.timeZone || "America/Sao_Paulo");
    startDateTime = String(body.startDateTime || "").trim();
    endDateTime = String(body.endDateTime || "").trim();
    naturalText = String(body.naturalText || "").trim();
    remindersMinutes = Array.isArray(body.remindersMinutes)
      ? body.remindersMinutes.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v >= 0)
      : [];
  } else {
    const formData = await request.formData();
    title = String(formData.get("title") || "").trim();
    description = String(formData.get("description") || "").trim();
    location = String(formData.get("location") || "").trim();
    timeZone = String(formData.get("timeZone") || "America/Sao_Paulo");
    startDateTime = String(formData.get("startDateTime") || "").trim();
    endDateTime = String(formData.get("endDateTime") || "").trim();
    naturalText = String(formData.get("naturalText") || "").trim();

    const remindersRaw = String(formData.get("remindersMinutes") || "").trim();
    remindersMinutes = remindersRaw
      ? remindersRaw
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value) && value >= 0)
      : [];
  }

  if (naturalText && (!startDateTime || !endDateTime || !title)) {
    const parsed = await parseNaturalEventText(naturalText, new Date().toISOString());
    if (parsed) {
      title = title || String(parsed.title || "").trim();
      description = description || String(parsed.description || "").trim();
      location = location || String(parsed.location || "").trim();
      startDateTime = startDateTime || String(parsed.startDateTime || "").trim();
      endDateTime = endDateTime || String(parsed.endDateTime || "").trim();
    }
  }

  const startIso = toIsoDate(startDateTime);
  const endIso = toIsoDate(endDateTime);

  if (!title || !startIso || !endIso) {
    return data(
      {
        error:
          "Dados insuficientes para criar evento. Envie title/startDateTime/endDateTime ou naturalText claro.",
      },
      { status: 400 },
    );
  }

  if (new Date(endIso) <= new Date(startIso)) {
    return data({ error: "endDateTime deve ser maior que startDateTime." }, { status: 400 });
  }

  const created = await createGoogleCalendarEvent(user.id, {
    title,
    description: description || undefined,
    location: location || undefined,
    startDateTime: startIso,
    endDateTime: endIso,
    timeZone,
    remindersMinutes,
  });

  if (!created) {
    return data({ error: "Falha ao criar evento no Google Calendar." }, { status: 500 });
  }

  return data({
    success: true,
    event: {
      ...created,
      title,
      startDateTime: startIso,
      endDateTime: endIso,
      timeZone,
    },
  });
}
