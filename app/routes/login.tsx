import { Form, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/login";
import { 
  getSession, 
  verifyPassword, 
  createSession, 
  getSessionCookie,
  checkLoginAttempts,
  recordFailedLogin
} from "~/lib/auth.server";
import { loginSchema } from "~/lib/validators";
import { db } from "~/lib/db.server";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "~/lib/audit.server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "~/lib/rate-limit.server";
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
  // Rate limiting — 5 attempts per 15 minutes per IP (basic flood protection)
  const ip = getClientIP(request);
  const rateCheck = await checkRateLimit(`login:${ip}`, RATE_LIMITS.login.maxAttempts, RATE_LIMITS.login.windowMs);
  if (!rateCheck.allowed) {
    return data(
      { error: `Muitas tentativas de login. Tente novamente em ${rateCheck.retryAfterSeconds} segundos.`, fields: { email: "", password: "" } },
      { status: 429 }
    );
  }

  const formData = await request.formData();
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const result = loginSchema.safeParse(raw);
  if (!result.success) {
    return data(
      { error: "Email ou senha incorretos", fields: raw },
      { status: 400 }
    );
  }

  const { email, password } = result.data;

  // Progressive lockout: Check if account/IP is temporarily blocked
  const lockoutCheck = await checkLoginAttempts(email, ip);
  if (!lockoutCheck.allowed && lockoutCheck.lockedUntil) {
    const minutesLeft = Math.ceil((lockoutCheck.lockedUntil.getTime() - Date.now()) / 60000);
    return data(
      { 
        error: `Conta temporariamente bloqueada devido a múltiplas tentativas incorretas. Tente novamente em ${minutesLeft} minutos.`,
        fields: raw 
      },
      { status: 429 }
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    recordFailedLogin(email, ip);
    await logAudit({ 
      userId: null, 
      action: "login_failed", 
      entity: "session", 
      details: { reason: "user_not_found", email, ip },
      request 
    });
    return data(
      { error: "Email ou senha incorretos", fields: raw },
      { status: 400 }
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    recordFailedLogin(email, ip);
    await logAudit({ 
      userId: user.id, 
      action: "login_failed", 
      entity: "session",
      details: { reason: "invalid_password", ip },
      request 
    });
    return data(
      { error: "Email ou senha incorretos", fields: raw },
      { status: 400 }
    );
  }

  if (!user.isActive) {
    await logAudit({ 
      userId: user.id, 
      action: "login_blocked", 
      entity: "session",
      details: { reason: "account_inactive", ip },
      request 
    });
    return data(
      { error: "Conta desativada. Entre em contato com o administrador.", fields: raw },
      { status: 403 }
    );
  }

  const token = await createSession(user.id, request);
  const cookie = getSessionCookie(token);

  await logAudit({ userId: user.id, action: "login", entity: "session", details: { ip }, request });

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4">
      <div className="w-full max-w-md">
        {/* Logo and branding */}
        <div className="mb-8 text-center">
          <img
            src="/images/logo-horizontal.png"
            alt="LHFEX Consultoria"
            className="mx-auto mb-4 h-28 w-auto sm:h-32"
          />
          <h1 className="text-2xl font-bold text-[var(--app-text)]">
            {i18n.auth.welcome}
          </h1>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            {i18n.auth.subtitle}
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-[var(--app-card-shadow)]">
          <Form method="post" className="space-y-5">
            {/* Error message */}
            {actionData?.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionData.error}
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-[var(--app-text)]"
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
                className="block w-full rounded-lg border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/20"
                placeholder="seu@email.com"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-[var(--app-text)]"
              >
                {i18n.auth.password}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full rounded-lg border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/20"
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
        <div className="mt-6 text-center text-xs text-[var(--app-muted)]">
          <p>LHFEX &copy; {new Date().getFullYear()} &mdash; Sistema de Gestao de Comercio Exterior</p>
          <p className="mt-1">
            <a href="mailto:contato@lhfex.com.br" className="transition-colors hover:text-[var(--app-accent)]">
              contato@lhfex.com.br
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
