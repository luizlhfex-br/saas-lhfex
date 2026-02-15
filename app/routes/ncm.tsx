import { useState } from "react";
import type { Route } from "./+types/ncm";
import { requireAuth } from "~/lib/auth.server";
import { t, type Locale } from "~/i18n";
import { Search } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;
  return { locale };
}

interface NcmItem {
  code: string;
  description: string;
  ii: number;
  ipi: number;
  pis: number;
  cofins: number;
}

const ncmData: NcmItem[] = [
  { code: "8471.30.19", description: "Máquinas automáticas para processamento de dados, portáteis, peso <= 10 kg (notebooks)", ii: 0, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "8517.13.00", description: "Telefones para redes celulares (smartphones)", ii: 0, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "8528.72.00", description: "Aparelhos receptores de televisão (TV LED/LCD)", ii: 20, ipi: 15, pis: 2.10, cofins: 9.65 },
  { code: "6110.30.00", description: "Suéteres, pulôveres e artigos semelhantes de fibras sintéticas", ii: 35, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "6403.99.90", description: "Outros calçados com sola exterior de borracha e parte superior de couro", ii: 35, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "8703.23.10", description: "Automóveis de passageiros, motor explosão 1500-3000 cm³", ii: 35, ipi: 25, pis: 2.10, cofins: 9.65 },
  { code: "2204.21.00", description: "Vinhos em recipientes de capacidade <= 2 litros", ii: 27, ipi: 10, pis: 2.10, cofins: 9.65 },
  { code: "0901.21.00", description: "Café torrado, não descafeinado", ii: 10, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "1005.90.10", description: "Milho em grão", ii: 8, ipi: 0, pis: 1.65, cofins: 7.60 },
  { code: "1201.90.00", description: "Soja, mesmo triturada", ii: 8, ipi: 0, pis: 1.65, cofins: 7.60 },
  { code: "2710.12.59", description: "Gasolina para motores", ii: 0, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "7204.49.00", description: "Sucata e resíduos de ferro ou aço", ii: 0, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "3004.90.99", description: "Medicamentos (exceto produtos dos itens 30.02, 30.05 ou 30.06)", ii: 0, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "8544.49.00", description: "Condutores elétricos, para tensão <= 1000V", ii: 14, ipi: 10, pis: 2.10, cofins: 9.65 },
  { code: "8481.80.99", description: "Válvulas e outros dispositivos semelhantes", ii: 14, ipi: 5, pis: 2.10, cofins: 9.65 },
  { code: "8429.51.90", description: "Pás carregadoras de carregamento frontal", ii: 0, ipi: 0, pis: 2.10, cofins: 9.65 },
  { code: "3901.10.10", description: "Polietileno de densidade < 0,94, em forma primária", ii: 14, ipi: 5, pis: 2.10, cofins: 9.65 },
  { code: "4011.10.00", description: "Pneus novos de borracha para automóveis de passageiros", ii: 16, ipi: 5, pis: 2.10, cofins: 9.65 },
  { code: "7308.90.90", description: "Construções e suas partes, de ferro fundido, ferro ou aço", ii: 14, ipi: 5, pis: 2.10, cofins: 9.65 },
  { code: "8443.32.99", description: "Impressoras, copiadoras e aparelhos de telecópia", ii: 0, ipi: 0, pis: 2.10, cofins: 9.65 },
];

export default function NcmPage({ loaderData }: Route.ComponentProps) {
  const { locale } = loaderData;
  const i18n = t(locale);
  const [query, setQuery] = useState("");

  const filtered = query.length >= 2
    ? ncmData.filter(
        (item) =>
          item.code.replace(/\./g, "").includes(query.replace(/\./g, "")) ||
          item.description.toLowerCase().includes(query.toLowerCase())
      )
    : ncmData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.ncm.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{i18n.ncm.subtitle}</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder={i18n.ncm.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="block w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <p className="text-xs text-gray-400">{i18n.ncm.searchTip}</p>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{i18n.ncm.code}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{i18n.ncm.description}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{i18n.ncm.iiRate}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{i18n.ncm.ipiRate}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{i18n.ncm.pisRate}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{i18n.ncm.cofinsRate}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">{i18n.ncm.noResults}</td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.code} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-mono font-medium text-blue-600 dark:text-blue-400">{item.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{item.description}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">{item.ii}%</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">{item.ipi}%</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">{item.pis}%</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">{item.cofins}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
