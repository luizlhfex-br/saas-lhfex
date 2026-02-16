import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { destroySession, clearSessionCookie, getSession } from "~/lib/auth.server";
import { logAudit } from "~/lib/audit.server";

export async function action({ request }: Route.ActionArgs) {
  const sessionData = await getSession(request);
  if (sessionData) {
    await logAudit({ userId: sessionData.user.id, action: "logout", entity: "session", request });
  }
  await destroySession(request);
  throw redirect("/login", {
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

export async function loader() {
  throw redirect("/login");
}
