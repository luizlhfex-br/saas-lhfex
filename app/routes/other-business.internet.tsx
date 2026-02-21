import { Link } from "react-router";
import type { Route } from "./+types/other-business.internet";
import { requireAuth } from "~/lib/auth.server";
import {
  Globe, ShoppingCart, TrendingUp, Megaphone, Package,
  ExternalLink, ChevronLeft, DollarSign, Users, BarChart3, Lightbulb
} from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return {};
}

const platforms = [
  {
    category: "Marketplace / E-commerce",
    icon: ShoppingCart,
    color: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
    items: [
      { label: "Mercado Livre", url: "https://www.mercadolivre.com.br", desc: "Maior marketplace do Brasil" },
      { label: "Shopee Seller", url: "https://seller.shopee.com.br", desc: "Plataforma com baixa comissão" },
      { label: "Amazon Seller BR", url: "https://sellercentral.amazon.com.br", desc: "Amazon marketplace" },
      { label: "Magalu Seller", url: "https://seller.magazineluiza.com.br", desc: "Magazine Luiza" },
      { label: "Bling (ERP)", url: "https://www.bling.com.br", desc: "Gestão de pedidos e estoque" },
    ],
  },
  {
    category: "Marketing & Ads",
    icon: Megaphone,
    color: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    items: [
      { label: "Meta Ads", url: "https://business.facebook.com", desc: "Facebook & Instagram Ads" },
      { label: "Google Ads", url: "https://ads.google.com", desc: "Search, Display e YouTube" },
      { label: "TikTok Ads", url: "https://ads.tiktok.com", desc: "Anúncios no TikTok" },
      { label: "Canva", url: "https://www.canva.com", desc: "Design de criativos" },
    ],
  },
  {
    category: "Analytics & Dados",
    icon: TrendingUp,
    color: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
    items: [
      { label: "Google Analytics 4", url: "https://analytics.google.com", desc: "Tráfego e comportamento" },
      { label: "Google Search Console", url: "https://search.google.com/search-console", desc: "SEO e indexação" },
      { label: "Hotjar", url: "https://www.hotjar.com", desc: "Mapas de calor e sessões" },
      { label: "SimilarWeb", url: "https://www.similarweb.com", desc: "Análise de concorrentes" },
    ],
  },
  {
    category: "Infoprodutos & Afiliados",
    icon: Lightbulb,
    color: "bg-yellow-100 dark:bg-yellow-900/30",
    iconColor: "text-yellow-600 dark:text-yellow-400",
    items: [
      { label: "Hotmart", url: "https://www.hotmart.com", desc: "Venda de cursos e ebooks" },
      { label: "Kiwify", url: "https://www.kiwify.com.br", desc: "Plataforma de checkout" },
      { label: "Monetizze", url: "https://www.monetizze.com.br", desc: "Afiliados e produtos digitais" },
      { label: "Eduzz", url: "https://www.eduzz.com", desc: "Infoprodutos e afiliados" },
    ],
  },
  {
    category: "Dropshipping & Fornecedores",
    icon: Package,
    color: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
    items: [
      { label: "Alibaba", url: "https://www.alibaba.com", desc: "Fornecedores internacionais" },
      { label: "AliExpress", url: "https://www.aliexpress.com", desc: "Dropshipping direto" },
      { label: "Made-in-China", url: "https://www.made-in-china.com", desc: "Fabricantes chineses" },
      { label: "1688.com", url: "https://www.1688.com", desc: "Atacado chinês (sem markup)" },
    ],
  },
  {
    category: "Receita & Financeiro",
    icon: DollarSign,
    color: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    items: [
      { label: "Mercado Pago", url: "https://www.mercadopago.com.br", desc: "Pagamentos e split" },
      { label: "PagSeguro", url: "https://pagseguro.uol.com.br", desc: "Gateway de pagamento" },
      { label: "Stripe", url: "https://dashboard.stripe.com", desc: "Pagamentos internacionais" },
      { label: "Contabilizei", url: "https://app.contabilizei.com.br", desc: "Contabilidade online" },
    ],
  },
];

export default function InternetBusinessPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/other-business"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Negócios na Internet</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Links rápidos para plataformas de e-commerce, marketing digital e renda online.
          </p>
        </div>
      </div>

      {/* Stats placeholder — futuro: puxar dados reais */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Canais ativos", value: "—", icon: Globe, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Receita digital (mês)", value: "—", icon: DollarSign, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
          { label: "Leads / Seguidores", value: "—", icon: Users, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Platform grids */}
      <div className="grid gap-6 lg:grid-cols-2">
        {platforms.map(({ category, icon: Icon, color, iconColor, items }) => (
          <div key={category} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{category}</h3>
            </div>
            <div className="space-y-2">
              {items.map(({ label, url, desc }) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Coming soon */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-900/50">
        <BarChart3 className="mx-auto mb-3 h-8 w-8 text-gray-400" />
        <p className="font-medium text-gray-700 dark:text-gray-300">Dashboard de Métricas — Em breve</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Integração com APIs de marketplaces para ver receita, pedidos e reviews em um só lugar.
        </p>
      </div>
    </div>
  );
}
