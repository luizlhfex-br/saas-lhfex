import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { destroySession, clearSessionCookie } from "~/lib/auth.server";

export async function action({ request }: Route.ActionArgs) {
  await destroySession(request);
  throw redirect("/login", {
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

export async function loader() {
  throw redirect("/login");
}
