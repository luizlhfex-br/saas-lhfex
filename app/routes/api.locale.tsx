import { data } from "react-router";
import type { Route } from "./+types/api.locale";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const locale = formData.get("locale") as string;

  if (!locale || !["pt-BR", "en"].includes(locale)) {
    return data({ error: "Invalid locale" }, { status: 400 });
  }

  return data(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `locale=${locale}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`,
      },
    }
  );
}

export async function loader() {
  return data({ error: "Method not allowed" }, { status: 405 });
}
