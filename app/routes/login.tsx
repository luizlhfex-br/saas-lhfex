import { Form, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/login";
import { getSession, verifyPassword, createSession, getSessionCookie } from "~/lib/auth.server";
import { loginSchema } from "~/lib/validators";
import { db } from "~/lib/db.server";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { t } from "~/i18n";
import { Button } from "~/components/ui/button";
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  if (session) {
    throw redirect("/");
  }
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const result = loginSchema.safeParse(raw);
  if (!result.success) {
    return data(
      { error: "Email ou senha incorretos", fields: raw },
      { status: 400 }
    );
  }

  const { email, password } = result.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    return data(
      { error: "Email ou senha incorretos", fields: raw },
      { status: 400 }
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return data(
      { error: "Email ou senha incorretos", fields: raw },
      { status: 400 }
    );
  }

  if (!user.isActive) {
    return data(
      { error: "Conta desativada. Entre em contato com o administrador.", fields: raw },
      { status: 403 }
    );
  }

  const token = await createSession(user.id, request);
  const cookie = getSessionCookie(token);

  throw redirect("/", {
    headers: { "Set-Cookie": cookie },
  });
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const i18n = t("pt-BR");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md">
        {/* Logo and branding */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-lg">
            LH
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {i18n.auth.welcome}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {i18n.auth.subtitle}
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <Form method="post" className="space-y-5">
            {/* Error message */}
            {actionData?.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {actionData.error}
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {i18n.auth.email}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={actionData?.fields?.email ?? ""}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                placeholder="seu@email.com"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {i18n.auth.password}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                placeholder="********"
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full"
              size="lg"
            >
              {i18n.auth.login}
            </Button>
          </Form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-600">
          LHFEX &copy; {new Date().getFullYear()} &mdash; Sistema de Gestao de Comercio Exterior
        </p>
      </div>
    </div>
  );
}
