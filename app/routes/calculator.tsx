import { useState } from "react";
import type { Route } from "./+types/calculator";
import { requireAuth } from "~/lib/auth.server";
import { t, type Locale } from "~/i18n";
import { Calculator, RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;
  return { locale };
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CalculatorPage({ loaderData }: Route.ComponentProps) {
  const { locale } = loaderData;
  const i18n = t(locale);

  const [fob, setFob] = useState(0);
  const [freight, setFreight] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(5.50);
  const [iiRate, setIiRate] = useState(14);
  const [ipiRate, setIpiRate] = useState(0);
  const [pisRate, setPisRate] = useState(2.10);
  const [cofinsRate, setCofinsRate] = useState(9.65);
  const [icmsRate, setIcmsRate] = useState(18);

  const cif = fob + freight + insurance;
  const cifBrl = cif * exchangeRate;
  const ii = cifBrl * (iiRate / 100);
  const ipi = (cifBrl + ii) * (ipiRate / 100);
  const pis = cifBrl * (pisRate / 100);
  const cofins = cifBrl * (cofinsRate / 100);
  const baseIcms = icmsRate < 100 ? (cifBrl + ii + ipi + pis + cofins) / (1 - icmsRate / 100) : 0;
  const icms = baseIcms * (icmsRate / 100);
  const totalTaxes = ii + ipi + pis + cofins + icms;
  const totalCost = cifBrl + totalTaxes;

  const reset = () => { setFob(0); setFreight(0); setInsurance(0); setExchangeRate(5.50); setIiRate(14); setIpiRate(0); setPisRate(2.10); setCofinsRate(9.65); setIcmsRate(18); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.calculator.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{i18n.calculator.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              <Calculator className="h-5 w-5 text-blue-600" /> Valores (USD)
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumInput label={i18n.calculator.productValue} value={fob} onChange={setFob} />
              <NumInput label={i18n.calculator.freight} value={freight} onChange={setFreight} />
              <NumInput label={i18n.calculator.insurance} value={insurance} onChange={setInsurance} />
              <NumInput label={i18n.calculator.exchangeRate} value={exchangeRate} onChange={setExchangeRate} step="0.01" />
            </div>
            <div className="mt-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-blue-700 dark:text-blue-400">{i18n.calculator.cifValue} (USD)</span>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-400">$ {fmt(cif)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="font-medium text-blue-700 dark:text-blue-400">{i18n.calculator.cifValue} (BRL)</span>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-400">R$ {fmt(cifBrl)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Alíquotas (%)</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <NumInput label={i18n.calculator.iiRate} value={iiRate} onChange={setIiRate} step="0.01" />
              <NumInput label={i18n.calculator.ipiRate} value={ipiRate} onChange={setIpiRate} step="0.01" />
              <NumInput label={i18n.calculator.pisRate} value={pisRate} onChange={setPisRate} step="0.01" />
              <NumInput label={i18n.calculator.cofinsRate} value={cofinsRate} onChange={setCofinsRate} step="0.01" />
              <NumInput label={i18n.calculator.icmsRate} value={icmsRate} onChange={setIcmsRate} step="0.01" />
            </div>
            <div className="mt-4">
              <Button variant="outline" onClick={reset}><RotateCcw className="h-4 w-4" />{i18n.calculator.reset}</Button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">{i18n.calculator.results}</h2>
          <div className="space-y-3">
            <TaxRow label={i18n.calculator.ii} rate={`${iiRate}%`} value={ii} />
            <TaxRow label={i18n.calculator.ipi} rate={`${ipiRate}%`} value={ipi} />
            <TaxRow label={i18n.calculator.pis} rate={`${pisRate}%`} value={pis} />
            <TaxRow label={i18n.calculator.cofins} rate={`${cofinsRate}%`} value={cofins} />
            <TaxRow label={i18n.calculator.icms} rate={`${icmsRate}%`} value={icms} />
            <div className="my-4 border-t border-gray-200 dark:border-gray-700" />
            <div className="flex items-center justify-between rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
              <span className="font-semibold text-orange-700 dark:text-orange-400">{i18n.calculator.totalTaxes}</span>
              <span className="text-lg font-bold text-orange-700 dark:text-orange-400">R$ {fmt(totalTaxes)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <span className="text-lg font-semibold text-green-700 dark:text-green-400">{i18n.calculator.totalCost}</span>
              <span className="text-2xl font-bold text-green-700 dark:text-green-400">R$ {fmt(totalCost)}</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-400">* Cálculo simplificado. Consulte um despachante para valores oficiais.</p>
        </div>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange, step = "any" }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input type="number" step={step} value={value || ""} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
    </div>
  );
}

function TaxRow({ label, rate, value }: { label: string; rate: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label} <span className="text-gray-400">({rate})</span></span>
      <span className="font-medium text-gray-900 dark:text-gray-100">R$ {fmt(value)}</span>
    </div>
  );
}
