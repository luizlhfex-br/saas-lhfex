import { Form, useNavigation, Link } from "react-router";
import type { Route } from "./+types/settings";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { users, googleTokens, companyProfile } from "../../drizzle/schema";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { Save, User, Globe, Palette, Sparkles, Bug, Wrench, Rocket, CheckCircle2, Clock, Zap, LogOut, Building2, CreditCard, ChevronDown } from "lucide-react";
import { data } from "react-router";
import { eq, and, isNull } from "drizzle-orm";
import { disconnectGoogle } from "~/lib/google.server";
import { VERSION_HISTORY, type ChangelogEntry } from "~/config/version";
import { useState } from "react";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  // Check if user has Google OAuth connected
  const googleToken = await db.query.googleTokens.findFirst({
    where: and(eq(googleTokens.userId, user.id), isNull(googleTokens.disconnectedAt)),
  });

  // Load company profile
  let profiles = await db.select().from(companyProfile).limit(1);
  let company = profiles[0] || null;

  // Auto-enrich CNPJ if it's LHFEX and not yet filled
  if (
    company &&
    company.cnpj === "62.180.992/0001-33" &&
    !company.razaoSocial
  ) {
    try {
      const enrichRes = await fetch(
        `${new URL(request.url).origin}/api/enrich-cnpj?cnpj=62.180.992/0001-33`,
        { headers: { Authorization: request.headers.get("cookie") || "" } }
      );
      if (enrichRes.ok) {
        const enrichData = await enrichRes.json();
        if (enrichData.cnpj) {
          // Update company with enriched data
          await db
            .update(companyProfile)
            .set({
              razaoSocial: enrichData.razaoSocial || company.razaoSocial,
              nomeFantasia: enrichData.nomeFantasia || company.nomeFantasia,
              city: enrichData.city || company.city,
              state: enrichData.state || company.state,
              zipCode: enrichData.zipCode || company.zipCode,
              cnae: enrichData.cnae || company.cnae,
              cnaeDescription: enrichData.cnaeDescription || company.cnaeDescription,
              updatedAt: new Date(),
            });
          // Reload from DB
          profiles = await db.select().from(companyProfile).limit(1);
          company = profiles[0] || null;
        }
      }
    } catch (err) {
      console.warn("Auto-enrich CNPJ failed:", err);
      // Continue with existing company data
    }
  }

  return {
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
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();

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

  // Handle company profile update
  if (actionIntent === "save_company") {
    const companyValues = {
      cnpj: String(formData.get("cnpj") || "").trim() || null,
      razaoSocial: String(formData.get("razaoSocial") || "").trim() || null,
      nomeFantasia: String(formData.get("nomeFantasia") || "").trim() || null,
      address: String(formData.get("address") || "").trim() || null,
      city: String(formData.get("city") || "").trim() || null,
      state: String(formData.get("state") || "").trim() || null,
      zipCode: String(formData.get("zipCode") || "").trim() || null,
      country: String(formData.get("country") || "Brasil").trim() || "Brasil",
      phone: String(formData.get("phone") || "").trim() || null,
      email: String(formData.get("email") || "").trim() || null,
      website: String(formData.get("website") || "").trim() || null,
      ie: String(formData.get("ie") || "").trim() || null,
      im: String(formData.get("im") || "").trim() || null,
      cnae: String(formData.get("cnae") || "").trim() || null,
      cnaeDescription: String(formData.get("cnaeDescription") || "").trim() || null,
      bankName: String(formData.get("bankName") || "").trim() || null,
      bankAgency: String(formData.get("bankAgency") || "").trim() || null,
      bankAccount: String(formData.get("bankAccount") || "").trim() || null,
      bankPix: String(formData.get("bankPix") || "").trim() || null,
      updatedAt: new Date(),
    };

    const existing = await db.select({ id: companyProfile.id }).from(companyProfile).limit(1);
    if (existing.length > 0) {
      await db.update(companyProfile).set(companyValues);
    } else {
      await db.insert(companyProfile).values(companyValues);
    }

    return data({ success: true, section: "company" });
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
}

const changelog: ChangelogEntry[] = VERSION_HISTORY;

const typeConfig = {
  feature: { icon: Sparkles, label: "Novo", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  improvement: { icon: Rocket, label: "Melhoria", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  fix: { icon: Bug, label: "Correção", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  infra: { icon: Wrench, label: "Infra", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

// Componente Company Profile Section (Compact + Expandable)
interface CompanyProfileProps {
  company: any;
  isSubmitting: boolean;
}

function CompanyProfileSection({ company, isSubmitting }: CompanyProfileProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!company) return null;

  return (
    <Form method="post">
      <input type="hidden" name="action" value="save_company" />
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {/* Compact Header */}
        <div
          className="flex cursor-pointer items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-gray-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {company.nomeFantasia || "Dados Cadastrais"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {company.cnpj || "CNPJ não configurado"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="transition-transform"
            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <ChevronDown className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Expanded Form */}
        {isExpanded && (
          <>
            <div className="border-t border-gray-200 p-6 dark:border-gray-800">
              {/* Identification */}
              <div className="mb-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Identificação
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      CNPJ
                    </label>
                    <input
                      type="text"
                      name="cnpj"
                      defaultValue={company?.cnpj || ""}
                      placeholder="00.000.000/0001-00"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Razão Social
                    </label>
                    <input
                      type="text"
                      name="razaoSocial"
                      defaultValue={company?.razaoSocial || ""}
                      placeholder="Nome completo da empresa"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nome Fantasia
                    </label>
                    <input
                      type="text"
                      name="nomeFantasia"
                      defaultValue={company?.nomeFantasia || ""}
                      placeholder="Nome comercial"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      E-mail
                    </label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={company?.email || ""}
                      placeholder="contato@empresa.com.br"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Telefone
                    </label>
                    <input
                      type="text"
                      name="phone"
                      defaultValue={company?.phone || ""}
                      placeholder="(31) 99999-9999"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Site
                    </label>
                    <input
                      type="url"
                      name="website"
                      defaultValue={company?.website || ""}
                      placeholder="https://www.empresa.com.br"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="mb-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Endereço
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Logradouro
                    </label>
                    <input
                      type="text"
                      name="address"
                      defaultValue={company?.address || ""}
                      placeholder="Rua, número, complemento"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Cidade
                    </label>
                    <input
                      type="text"
                      name="city"
                      defaultValue={company?.city || ""}
                      placeholder="Belo Horizonte"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Estado
                    </label>
                    <select
                      name="state"
                      defaultValue={company?.state || "MG"}
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      CEP
                    </label>
                    <input
                      type="text"
                      name="zipCode"
                      defaultValue={company?.zipCode || ""}
                      placeholder="30000-000"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Fiscal */}
              <div className="mb-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Dados Fiscais
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      IE
                    </label>
                    <input
                      type="text"
                      name="ie"
                      defaultValue={company?.ie || ""}
                      placeholder="Isento"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      IM
                    </label>
                    <input
                      type="text"
                      name="im"
                      defaultValue={company?.im || ""}
                      placeholder="IM"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      CNAE
                    </label>
                    <input
                      type="text"
                      name="cnae"
                      defaultValue={company?.cnae || ""}
                      placeholder="0000000"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Descrição CNAE
                    </label>
                    <input
                      type="text"
                      name="cnaeDescription"
                      defaultValue={company?.cnaeDescription || ""}
                      placeholder="Descrição"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Banking */}
              <div className="mb-5">
                <div className="mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Dados Bancários
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Banco
                    </label>
                    <input
                      type="text"
                      name="bankName"
                      defaultValue={company?.bankName || ""}
                      placeholder="Banco Inter"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Agência
                    </label>
                    <input
                      type="text"
                      name="bankAgency"
                      defaultValue={company?.bankAgency || ""}
                      placeholder="0001"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Conta
                    </label>
                    <input
                      type="text"
                      name="bankAccount"
                      defaultValue={company?.bankAccount || ""}
                      placeholder="123456-7"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      PIX
                    </label>
                    <input
                      type="text"
                      name="bankPix"
                      defaultValue={company?.bankPix || ""}
                      placeholder="CNPJ ou e-mail"
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" loading={isSubmitting}>
                  <Save className="h-4 w-4" />
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Form>
  );
}

export default function SettingsPage({ loaderData }: Route.ComponentProps) {
  const { user, locale, company } = loaderData;
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

        {/* Google Integrations */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Integrações com Google
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
                    ✓ Google Conectado
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400">
                    Você pode gerar relatórios em Google Sheets
                  </p>
                </div>
              </div>
              <Form method="post">
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
      <CompanyProfileSection company={company} isSubmitting={isSubmitting} />


        {/* Prompting Best Practices */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Boas praticas de prompt
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Guia rapido para extrair respostas mais precisas da IA.
          </p>
          <div className="mt-4 grid gap-3 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/60">
              <p className="font-semibold">5 principios</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tarefa, Contexto, Referencias, Avaliacao, Iteracao.
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/60">
              <p className="font-semibold">Estrutura</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Prompt dividido, restricoes e exemplos reais.
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/60">
              <p className="font-semibold">Fluxo</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Encadeamento, avaliacao e iteracao sistematica.
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/60">
              <p className="font-semibold">Seguranca</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Humano no controle e verifique fatos criticos.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Link
              to="/knowledge/prompting"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Abrir guia completo
            </Link>
          </div>
        </div>

      {/* Changelog / System Updates */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Atualizações do Sistema
          </h2>
        </div>

        <div className="space-y-8">
          {changelog.map((release, idx) => (
            <div key={release.version}>
              {/* Version Header */}
              <div className="mb-3 flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${idx === 0 ? "bg-blue-100 dark:bg-blue-900/30" : "bg-gray-100 dark:bg-gray-800"}`}>
                  {idx === 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">v{release.version}</span>
                    {idx === 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        Atual
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {release.date} — {release.title}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="ml-11 space-y-2">
                {release.items.map((item, i) => {
                  const config = typeConfig[item.type];
                  const Icon = config.icon;
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.text}</span>
                    </div>
                  );
                })}
              </div>

              {/* Divider */}
              {idx < changelog.length - 1 && (
                <div className="mt-6 border-t border-gray-100 dark:border-gray-800" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
