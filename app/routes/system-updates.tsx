import { Link } from "react-router";
import type { Route } from "./+types/system-updates";
import { requireAuth } from "~/lib/auth.server";
import { t, type Locale } from "~/i18n";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CheckCircle,
  Heart,
  Info,
  Palette,
  Shield,
} from "lucide-react";
import { canAccessLuizModules } from "~/lib/access-control";

export async function loader({ request }: Route["LoaderArgs"]) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  return {
    user,
    locale,
    releaseDate: "20 de fevereiro de 2026",
    version: "v2.0.0",
  };
}

export default function SystemUpdatesPage({ loaderData }: Route["ComponentProps"]) {
  const { user, locale, releaseDate, version } = loaderData;
  const i18n = t(locale);
  const isLuiz = canAccessLuizModules(user.email);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Atualizações do Sistema</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {version} - {releaseDate}
        </p>
      </div>

      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
          <div>
            <p className="font-medium text-indigo-900 dark:text-indigo-200">
              Importante: recarregue a página com `Ctrl+Shift+R`
            </p>
            <p className="mt-1 text-sm text-indigo-800 dark:text-indigo-300">
              Se os novos módulos ou cores não aparecerem, faça um hard refresh para limpar o cache.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {isLuiz ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                  <Briefcase className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Compras Públicas (Wave 7.0)</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Novo módulo | Lei 14.133/21</p>
                </div>
              </div>
              <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
            </div>

            <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>Controle de processos licitatórios</p>
              <p>7 tabelas no banco</p>
              <p>4 rotas de API</p>
              <p>3 páginas de interface</p>
              <p>Automações e alertas integrados</p>
            </div>

            <Link
              to="/public-procurement"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              Acessar módulo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}

        {isLuiz ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/30">
                  <Heart className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Vida Pessoal (Wave 8.0)</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Novo módulo | Privado</p>
                </div>
              </div>
              <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
            </div>

            <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>Finanças pessoais e investimentos</p>
              <p>Rotinas e tracking de hábitos</p>
              <p>Gestão de promoções e férias</p>
              <p>7 tabelas customizadas</p>
              <p>5 rotas de API especializadas</p>
            </div>

            <Link
              to="/personal-life"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500"
            >
              Acessar módulo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}

        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Palette className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Novo tema visual</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Option 4 + 5</p>
              </div>
            </div>
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
          </div>

          <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>Cor primária: <code className="rounded bg-gray-100 px-2 py-1 font-mono dark:bg-gray-800">indigo-600</code></p>
            <p>Cor de acento: <code className="rounded bg-gray-100 px-2 py-1 font-mono dark:bg-gray-800">teal-500</code></p>
            <p>18 arquivos atualizados</p>
            <p>Direção data-first / brutalist</p>
            <p>Leve, legível e funcional</p>
          </div>

          <div className="mt-4 flex gap-2">
            <div className="h-8 w-8 rounded bg-indigo-600" />
            <div className="h-8 w-8 rounded bg-teal-500" />
            <div className="h-8 w-8 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Controle de acesso (RBAC)</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Por e-mail</p>
              </div>
            </div>
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">luiz@lhfex.com.br</p>
              <p className="text-gray-600 dark:text-gray-400">Compras Públicas + Vida Pessoal + módulos padrão</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">financeiro@lhfex.com.br</p>
              <p className="text-gray-600 dark:text-gray-400">Apenas módulos padrão</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Outros</p>
              <p className="text-gray-600 dark:text-gray-400">Dashboard e acesso padrão restrito</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Estatísticas da release</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">10</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Módulos totais</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">18</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Arquivos alterados</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">31</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Rotas UI</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">0</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Erros TypeScript</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-900/40 dark:bg-yellow-950/20">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
          <div>
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-200">Como conferir as mudanças</h4>
            <ol className="mt-2 space-y-1 text-sm text-yellow-800 dark:text-yellow-300">
              <li>1. Faça `Ctrl+Shift+R` para hard refresh.</li>
              <li>2. Confira a sidebar com "Compras Públicas" e "Vida Pessoal".</li>
              <li>3. Acesse os módulos pelos cards acima.</li>
              <li>4. A cor primária agora é <strong>indigo</strong>.</li>
              <li>5. Se estiver com outro e-mail, faça logout e teste com o perfil do Luiz.</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6 dark:border-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Para detalhes completos, veja <code className="rounded bg-gray-100 px-2 py-1 font-mono dark:bg-gray-800">docs/history/CHANGELOG-2026-02-20.md</code>
        </p>
      </div>
    </div>
  );
}
