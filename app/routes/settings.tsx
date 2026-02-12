import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/settings";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { users } from "../../drizzle/schema";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { Save, User, Globe, Palette } from "lucide-react";
import { data } from "react-router";
import { eq } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      locale: user.locale,
      theme: user.theme,
    },
    locale,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const locale = formData.get("locale") as string;
  const theme = formData.get("theme") as string;

  if (!name || name.trim().length < 2) {
    return data({ error: "Nome deve ter pelo menos 2 caracteres" }, { status: 400 });
  }

  await db
    .update(users)
    .set({
      name: name.trim(),
      locale: locale || "pt-BR",
      theme: theme || "light",
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  const headers = new Headers();
  headers.append("Set-Cookie", `locale=${locale || "pt-BR"}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);
  headers.append("Set-Cookie", `theme=${theme || "light"}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

  return data({ success: true }, { headers });
}

export default function SettingsPage({ loaderData }: Route.ComponentProps) {
  const { user, locale } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const i18n = t(locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {i18n.nav.settings}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {i18n.nav.personal}
        </p>
      </div>

      <Form method="post" className="space-y-6">
        {/* Profile */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Perfil
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nome
              </label>
              <input
                type="text"
                name="name"
                defaultValue={user.name}
                required
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Locale */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Idioma
            </h2>
          </div>
          <div className="flex gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:border-gray-700 dark:has-[:checked]:border-blue-500 dark:has-[:checked]:bg-blue-900/20">
              <input type="radio" name="locale" value="pt-BR" defaultChecked={user.locale === "pt-BR"} className="text-blue-600" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Portugues (BR)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:border-gray-700 dark:has-[:checked]:border-blue-500 dark:has-[:checked]:bg-blue-900/20">
              <input type="radio" name="locale" value="en" defaultChecked={user.locale === "en"} className="text-blue-600" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">English</span>
            </label>
          </div>
        </div>

        {/* Theme */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Tema
            </h2>
          </div>
          <div className="flex gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:border-gray-700 dark:has-[:checked]:border-blue-500 dark:has-[:checked]:bg-blue-900/20">
              <input type="radio" name="theme" value="light" defaultChecked={user.theme === "light"} className="text-blue-600" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Claro</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:border-gray-700 dark:has-[:checked]:border-blue-500 dark:has-[:checked]:bg-blue-900/20">
              <input type="radio" name="theme" value="dark" defaultChecked={user.theme === "dark"} className="text-blue-600" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Escuro</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            {i18n.common.save}
          </Button>
        </div>
      </Form>
    </div>
  );
}
