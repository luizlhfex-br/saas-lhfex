import { Link } from "react-router";
import type { Route } from "./+types/other-business";
import { requireAuth } from "~/lib/auth.server";
import { Briefcase, Globe, ExternalLink, TrendingUp, ShoppingCart, Megaphone, ChevronRight } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return {};
}

export default function OtherBusinessPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Outros Negócios</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Gestão de outros projetos e negócios além do comércio exterior.
        </p>
      </div>

      {/* Quick access cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Compras Públicas */}
        <Link
          to="/public-procurement"
          className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-violet-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-violet-700"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
            <Briefcase className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-gray-100">Compras Públicas</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Editais, licitações e processos governamentais</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-hover:translate-x-1" />
        </Link>

        {/* Negócios na Internet */}
        <Link
          to="/other-business/internet"
          className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Globe className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-gray-100">Negócios na Internet</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">E-commerce, afiliados, infoprodutos e renda digital</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* Quick links externos */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Links Rápidos</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Mercado Livre", url: "https://www.mercadolivre.com.br", icon: ShoppingCart },
            { label: "Shopee Seller", url: "https://seller.shopee.com.br", icon: ShoppingCart },
            { label: "Amazon Seller", url: "https://sellercentral.amazon.com.br", icon: ShoppingCart },
            { label: "Google Analytics", url: "https://analytics.google.com", icon: TrendingUp },
            { label: "Meta Ads", url: "https://business.facebook.com", icon: Megaphone },
            { label: "Google Ads", url: "https://ads.google.com", icon: Megaphone },
          ].map(({ label, url, icon: Icon }) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
            >
              <Icon className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="flex-1 font-medium text-gray-700 dark:text-gray-300">{label}</span>
              <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
