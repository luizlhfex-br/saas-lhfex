import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { destroySession, clearSessionCookieHeaders, getSession } from "~/lib/auth.server";
import { logAudit } from "~/lib/audit.server";
import { requireValidCSRF } from "~/lib/csrf.server";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  await requireValidCSRF(request, formData);

  const sessionData = await getSession(request);
  if (sessionData) {
    await logAudit({ userId: sessionData.user.id, action: "logout", entity: "session", request });
  }
  await destroySession(request);
  const headers = new Headers();
  for (const cookie of clearSessionCookieHeaders()) {
    headers.append("Set-Cookie", cookie);
  }
  throw redirect("/login", {
    headers,
  });
}

export async function loader() {
  throw redirect("/login");
}
