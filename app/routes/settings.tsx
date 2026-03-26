import { Form, useNavigation, Link } from "react-router";
import type { Route } from "./+types/settings";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { users, googleTokens, companyProfile, companyBankAccounts } from "../../drizzle/schema";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { Save, User, Globe, Palette, Sparkles, Bug, Wrench, Rocket, CheckCircle2, Clock, Zap, LogOut, Building2, CreditCard, ChevronDown, Shield, ArrowRight, ExternalLink, Plus, Trash2 } from "lucide-react";
import { data } from "react-router";
import { eq, and, isNull } from "drizzle-orm";
import { disconnectGoogle } from "~/lib/google.server";
import { VERSION_HISTORY, type ChangelogEntry } from "~/config/version";
import { useState } from "react";
import { getCSRFFormState, requireValidCSRF } from "~/lib/csrf.server";
import { CompanyProfileCard } from "~/components/settings/company-profile-card";
import { getOrCreatePrimaryCompanyProfile } from "~/lib/company-profile.server";
import { enrichCNPJ } from "~/lib/ai.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const { csrfToken, csrfCookieHeader } = await getCSRFFormState(request);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  try {
    // Check if user has Google OAuth connected
    const googleToken = await db.query.googleTokens.findFirst({
      where: and(eq(googleTokens.userId, user.id), isNull(googleTokens.disconnectedAt)),
    });

    let company = await getOrCreatePrimaryCompanyProfile();

    // Load bank accounts
    let bankAccounts: typeof companyBankAccounts.$inferSelect[] = [];
    if (company?.id) {
      bankAccounts = await db
        .select()
        .from(companyBankAccounts)
        .where(eq(companyBankAccounts.companyId, company.id));
    }

    // Auto-enrich CNPJ if key registration data is still missing
    if (company?.cnpj && (!company.razaoSocial || !company.cnae || !company.address)) {
      try {
        const enrichData = await enrichCNPJ(company.cnpj);
        if (enrichData) {
          await db
            .update(companyProfile)
            .set({
              razaoSocial: company.razaoSocial || enrichData.razaoSocial || null,
              nomeFantasia: company.nomeFantasia || enrichData.nomeFantasia || null,
              address: company.address || enrichData.address || null,
              city: company.city || enrichData.city || null,
              state: company.state || enrichData.state || null,
              zipCode: company.zipCode || enrichData.zipCode || null,
              cnae: company.cnae || enrichData.cnaeCode || null,
              cnaeDescription: company.cnaeDescription || enrichData.cnaeDescription || null,
              updatedAt: new Date(),
            })
            .where(eq(companyProfile.id, company.id));

          const refreshed = await db.select().from(companyProfile).where(eq(companyProfile.id, company.id)).limit(1);
          company = refreshed[0] || company;
        }
      } catch (err) {
        console.warn("Auto-enrich CNPJ failed:", err);
      }
    }

    return data(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          locale: user.locale,
          theme: user.theme,
        },
        locale,
        googleConnected: !!googleToken,
        company,
        bankAccounts,
        loadError: null,
        csrfToken,
      },
      {
        headers: {
          "Set-Cookie": csrfCookieHeader,
        },
      }
    );
  } catch (error) {
    console.error("[settings.loader] failed", error);
    return data(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          locale: user.locale,
          theme: user.theme,
        },
        locale,
        googleConnected: false,
        company: null,
        bankAccounts: [],
        loadError: "Nao foi possivel carregar as configuracoes no momento.",
        csrfToken,
      },
      {
        headers: {
          "Set-Cookie": csrfCookieHeader,
        },
      }
    );
  }
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);

  try {
    const formData = await request.formData();
    await requireValidCSRF(request, formData);

    // Handle Google disconnect
    const actionIntent = formData.get("action") as string;
    if (actionIntent === "disconnect_google") {
      try {
        await disconnectGoogle(user.id);
        return data({ success: "Google desconectado com sucesso" });
      } catch (error) {
        console.error("Error disconnecting Google:", error);
        return data({ error: "Erro ao desconectar Google" }, { status: 500 });
      }
    }

    if (actionIntent === "save_company") {
      const profile = await getOrCreatePrimaryCompanyProfile();
      const cnpj = String(formData.get("cnpj") || "").trim() || null;
      const enriched = cnpj ? await enrichCNPJ(cnpj) : null;

      const companyValues = {
        cnpj,
        razaoSocial: String(formData.get("razaoSocial") || "").trim() || enriched?.razaoSocial || null,
        nomeFantasia: String(formData.get("nomeFantasia") || "").trim() || enriched?.nomeFantasia || null,
        address: String(formData.get("address") || "").trim() || enriched?.address || null,
        city: String(formData.get("city") || "").trim() || enriched?.city || null,
        state: String(formData.get("state") || "").trim() || enriched?.state || null,
        zipCode: String(formData.get("zipCode") || "").trim() || enriched?.zipCode || null,
        country: String(formData.get("country") || "Brasil").trim() || "Brasil",
        contactName: String(formData.get("contactName") || "").trim() || null,
        contactRole: String(formData.get("contactRole") || "").trim() || null,
        contactRegistration: String(formData.get("contactRegistration") || "").trim() || null,
        phone: String(formData.get("phone") || "").trim() || null,
        email: String(formData.get("email") || "").trim() || null,
        website: String(formData.get("website") || "").trim() || null,
        ie: String(formData.get("ie") || "").trim() || null,
        im: String(formData.get("im") || "").trim() || null,
        cnae: String(formData.get("cnae") || "").trim() || enriched?.cnaeCode || null,
        cnaeDescription: String(formData.get("cnaeDescription") || "").trim() || enriched?.cnaeDescription || null,
        bankName: String(formData.get("bankName") || "").trim() || null,
        bankHolder: String(formData.get("bankHolder") || "").trim() || null,
        bankAgency: String(formData.get("bankAgency") || "").trim() || null,
        bankAccount: String(formData.get("bankAccount") || "").trim() || null,
        bankPix: String(formData.get("bankPix") || "").trim() || null,
        updatedAt: new Date(),
      };

      await db.update(companyProfile).set(companyValues).where(eq(companyProfile.id, profile.id));

      if (companyValues.bankName && companyValues.bankAgency && companyValues.bankAccount) {
        const [defaultBank] = await db
          .select()
          .from(companyBankAccounts)
          .where(and(eq(companyBankAccounts.companyId, profile.id), eq(companyBankAccounts.isDefault, true)))
          .limit(1);

        const defaultBankValues = {
          companyId: profile.id,
          bankName: companyValues.bankName,
          accountHolder: companyValues.bankHolder,
          bankAgency: companyValues.bankAgency,
          bankAccount: companyValues.bankAccount,
          bankPix: companyValues.bankPix,
          isDefault: true,
          updatedAt: new Date(),
        };

        if (defaultBank) {
          await db
            .update(companyBankAccounts)
            .set(defaultBankValues)
            .where(eq(companyBankAccounts.id, defaultBank.id));
        } else {
          await db.insert(companyBankAccounts).values(defaultBankValues);
        }
      }

      return data({ success: true, section: "company" });
    }

    if (actionIntent === "add_bank_account") {
      const profile = await getOrCreatePrimaryCompanyProfile();
      const bankName = String(formData.get("extraBankName") || "").trim();
      const accountHolder = String(formData.get("extraAccountHolder") || "").trim() || null;
      const bankAgency = String(formData.get("extraBankAgency") || "").trim();
      const bankAccount = String(formData.get("extraBankAccount") || "").trim();
      const bankPix = String(formData.get("extraBankPix") || "").trim() || null;

      if (!bankName || !bankAgency || !bankAccount) {
        return data({ error: "Preencha banco, agencia e conta para adicionar uma nova conta bancaria." }, { status: 400 });
      }

      await db.insert(companyBankAccounts).values({
        companyId: profile.id,
        bankName,
        accountHolder,
        bankAgency,
        bankAccount,
        bankPix,
        isDefault: false,
        updatedAt: new Date(),
      });

      return data({ success: true, section: "bank_accounts" });
    }

    if (actionIntent === "update_bank_account") {
      const profile = await getOrCreatePrimaryCompanyProfile();
      const bankId = String(formData.get("bankId") || "").trim();
      const bankName = String(formData.get("bankName") || "").trim();
      const accountHolder = String(formData.get("accountHolder") || "").trim() || null;
      const bankAgency = String(formData.get("bankAgency") || "").trim();
      const bankAccount = String(formData.get("bankAccount") || "").trim();
      const bankPix = String(formData.get("bankPix") || "").trim() || null;

      if (!bankId || !bankName || !bankAgency || !bankAccount) {
        return data({ error: "Preencha banco, agencia e conta para salvar a conta bancaria." }, { status: 400 });
      }

      await db
        .update(companyBankAccounts)
        .set({ bankName, accountHolder, bankAgency, bankAccount, bankPix, updatedAt: new Date() })
        .where(and(eq(companyBankAccounts.id, bankId), eq(companyBankAccounts.companyId, profile.id), eq(companyBankAccounts.isDefault, false)));

      return data({ success: true, section: "bank_accounts" });
    }

    if (actionIntent === "delete_bank_account") {
      const profile = await getOrCreatePrimaryCompanyProfile();
      const bankId = String(formData.get("bankId") || "").trim();

      if (!bankId) {
        return data({ error: "Conta bancaria invalida." }, { status: 400 });
      }

      await db
        .delete(companyBankAccounts)
        .where(and(eq(companyBankAccounts.id, bankId), eq(companyBankAccounts.companyId, profile.id), eq(companyBankAccounts.isDefault, false)));

      return data({ success: true, section: "bank_accounts" });
    }

    // Handle profile update
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
  } catch (error) {
    console.error("[settings.action] failed", error);
    const message = error instanceof Error ? error.message : "Nao foi possivel salvar as configuracoes. Tente novamente.";
    return data({ error: message }, { status: 500 });
  }
}

const changelog: ChangelogEntry[] = VERSION_HISTORY;

const typeConfig = {
  feature: { icon: Sparkles, label: "Novo", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  improvement: { icon: Rocket, label: "Melhoria", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  fix: { icon: Bug, label: "Correcao", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  infra: { icon: Wrench, label: "Infra", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

// Componente Company Profile Section (Compact + Expandable)
interface CompanyProfileProps {
  company: any;
  isSubmitting: boolean;
  csrfToken: string;
  bankAccounts?: any[];
}

function CompanyProfileSection(props: CompanyProfileProps) {
  return <CompanyProfileCard {...props} />;
}

export default function SettingsPage({ loaderData }: Route.ComponentProps) {
  const { user, locale, company, bankAccounts, csrfToken } = loaderData;
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
        <input type="hidden" name="csrf" value={csrfToken} />
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

        {/* Google Integrations */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Integracoes com Google
            </h2>
          </div>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Conecte sua conta Google para acessar Google Drive e Sheets.
          </p>

          {loaderData.googleConnected ? (
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-300">
                    Google conectado
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400">
                    Voce pode gerar relatorios em Google Sheets
                  </p>
                </div>
              </div>
              <Form method="post">
                <input type="hidden" name="csrf" value={csrfToken} />
                <input type="hidden" name="action" value="disconnect_google" />
                <Button type="submit" variant="destructive" size="sm">
                  <LogOut className="h-4 w-4" />
                  Desconectar
                </Button>
              </Form>
            </div>
          ) : (
            <Form action="/api/google-auth" method="post">
              <Button type="submit" variant="primary">
                <Zap className="h-4 w-4" />
                Conectar Google
              </Button>
            </Form>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            {i18n.common.save}
          </Button>
        </div>
      </Form>

      {/* Company Profile - Compact + Expandable */}
      <CompanyProfileCard company={company} isSubmitting={isSubmitting} csrfToken={csrfToken} bankAccounts={bankAccounts} />

      {/* APIs & Consumo */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            APIs &amp; Consumo
          </h2>
        </div>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Acesse os dashboards de uso e limites de cada provedor de IA.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { name: "OpenRouter", url: "https://openrouter.ai/activity", color: "text-purple-600 dark:text-purple-400" },
            { name: "DeepSeek", url: "https://platform.deepseek.com/usage", color: "text-blue-600 dark:text-blue-400" },
            { name: "Gemini", url: "https://aistudio.google.com/app/usage", color: "text-green-600 dark:text-green-400" },
            { name: "Anthropic", url: "https://console.anthropic.com/usage", color: "text-orange-600 dark:text-orange-400" },
            { name: "Groq", url: "https://console.groq.com/usage", color: "text-emerald-600 dark:text-emerald-400" },
            { name: "AwesomeAPI", url: "https://docs.awesomeapi.com.br/api-de-moedas", color: "text-cyan-600 dark:text-cyan-400" },
          ].map(({ name, url, color }) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <span className={color}>{name}</span>
              <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
            </a>
          ))}
        </div>
      </div>

      {/* Changelog */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Changelog</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ultimas entregas e melhorias por data</p>
            </div>
          </div>
          <Link
            to="/changelog"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Ver completo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="space-y-4">
          {changelog.slice(0, 3).map((entry) => {
            const fallbackType = entry.items?.[0]?.type ?? "improvement";
            const cfg = typeConfig[fallbackType] ?? typeConfig.improvement;
            const Icon = cfg.icon;
            return (
              <div key={entry.version} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {cfg.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{entry.title}</span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">v{entry.version}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(entry.date).toLocaleDateString("pt-BR")}</p>
                {entry.items?.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    {entry.items.slice(0, 3).map((item, idx) => (
                      <li key={`${entry.version}-${idx}`}>- {item.text}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Logs de Auditoria */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <Shield className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Logs de Auditoria</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Registro de todas as acoes realizadas no sistema
              </p>
            </div>
          </div>
          <Link
            to="/audit"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Ver logs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
