import { data } from "react-router";
import type { Route } from "./+types/api.theme";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const theme = String(formData.get("theme") ?? "");

  if (!["light", "dark"].includes(theme)) {
    return data({ error: "Invalid theme" }, { status: 400 });
  }

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return data(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `theme=${theme}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${60 * 60 * 24 * 365}`,
      },
    }
  );
}

export async function loader() {
  return data({ error: "Method not allowed" }, { status: 405 });
}
