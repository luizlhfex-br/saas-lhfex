import { useState, useCallback } from "react";
import type { Route } from "./+types/calculator";
import { requireAuth } from "~/lib/auth.server";
import { t, type Locale } from "~/i18n";
import { Calculator, RotateCcw, Search, Ship, Plane, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;
  return { locale };
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type ModalType = "air" | "sea";
type SeaType = "lcl" | "fcl";

export default function CalculatorPage({ loaderData }: Route.ComponentProps) {
  const { locale } = loaderData;
  const i18n = t(locale);

  // NCM
  const [ncm, setNcm] = useState("");
  const [ncmDescription, setNcmDescription] = useState("");
  const [ncmLoading, setNcmLoading] = useState(false);
  const [ncmSource, setNcmSource] = useState("");

  // Modal & Freight Type
  const [modal, setModal] = useState<ModalType>("sea");
  const [seaType, setSeaType] = useState<SeaType>("fcl");

  // Values
  const [fob, setFob] = useState(0);
  const [freight, setFreight] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(5.50);
  const [iiRate, setIiRate] = useState(14);
  const [ipiRate, setIpiRate] = useState(0);
  const [pisRate, setPisRate] = useState(2.10);
  const [cofinsRate, setCofinsRate] = useState(9.65);
  const [icmsRate, setIcmsRate] = useState(18);

  // Calculations
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

  const reset = () => {
    setFob(0); setFreight(0); setInsurance(0); setExchangeRate(5.50);
    setIiRate(14); setIpiRate(0); setPisRate(2.10); setCofinsRate(9.65); setIcmsRate(18);
    setNcm(""); setNcmDescription(""); setNcmSource("");
    setModal("sea"); setSeaType("fcl");
  };

  // NCM lookup
  const lookupNCM = useCallback(async (code: string) => {
    const clean = code.replace(/[.\s-]/g, "");
    if (clean.length < 4) return;

    setNcmLoading(true);
    try {
      const res = await fetch(`/api/ncm-taxes?code=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        setIiRate(data.ii);
        setIpiRate(data.ipi);
        setPisRate(data.pis);
        setCofinsRate(data.cofins);
        setNcmDescription(data.ncmDescription || data.description || "");
        setNcmSource(data.source === "tec_table" ? "TEC" : "Padrão");
      }
    } catch {
      // Ignore
    } finally {
      setNcmLoading(false);
    }
  }, []);

  // Format NCM as XXXX.XX.XX
  const handleNcmChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + "." + digits.slice(4);
    if (digits.length > 6) formatted = digits.slice(0, 4) + "." + digits.slice(4, 6) + "." + digits.slice(6);
    setNcm(formatted);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.calculator.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{i18n.calculator.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-6">
          {/* NCM Lookup */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              <Search className="h-5 w-5 text-purple-600" /> NCM
            </h2>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Código NCM
                </label>
                <input
                  type="text"
                  value={ncm}
                  onChange={(e) => handleNcmChange(e.target.value)}
                  placeholder="0000.00.00"
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <Button
                onClick={() => lookupNCM(ncm)}
                disabled={ncm.replace(/\D/g, "").length < 4 || ncmLoading}
                className="shrink-0"
              >
                {ncmLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
            {ncmDescription && (
              <div className="mt-3 rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
                <p className="text-xs font-medium text-purple-700 dark:text-purple-400">
                  {ncmDescription}
                </p>
                {ncmSource && (
                  <p className="mt-1 text-xs text-purple-500 dark:text-purple-500">
                    Fonte: {ncmSource} — alíquotas preenchidas automaticamente (editáveis)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Modal Type */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Tipo de Transporte</h2>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModal("sea")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                  modal === "sea"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-400"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400"
                }`}
              >
                <Ship className="h-5 w-5" />
                Marítimo
              </button>
              <button
                type="button"
                onClick={() => setModal("air")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                  modal === "air"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-400"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400"
                }`}
              >
                <Plane className="h-5 w-5" />
                Aéreo
              </button>
            </div>
            {modal === "sea" && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSeaType("fcl")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    seaType === "fcl"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  FCL (Container cheio)
                </button>
                <button
                  type="button"
                  onClick={() => setSeaType("lcl")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    seaType === "lcl"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  LCL (Carga fracionada)
                </button>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              {modal === "air"
                ? "Frete aéreo: geralmente mais caro, menor transit time"
                : seaType === "fcl"
                  ? "FCL: container exclusivo, custo fixo por container"
                  : "LCL: carga compartilhada, custo por m³/ton"}
            </p>
          </div>

          {/* Values */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              <Calculator className="h-5 w-5 text-blue-600" /> Valores (USD)
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumInput label={i18n.calculator.productValue} value={fob} onChange={setFob} />
              <NumInput
                label={modal === "air" ? "Frete Aéreo (USD)" : `Frete Marítimo ${seaType.toUpperCase()} (USD)`}
                value={freight}
                onChange={setFreight}
              />
              <NumInput label={i18n.calculator.insurance} value={insurance} onChange={setInsurance} />
              <NumInput label={i18n.calculator.exchangeRate} value={exchangeRate} onChange={setExchangeRate} step="0.01" />
            </div>
            <div className="mt-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-blue-700 dark:text-blue-400">{i18n.calculator.cifValue} (USD)</span>
                <span className="text-lg font-bold font-mono text-blue-700 dark:text-blue-400">$ {fmt(cif)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="font-medium text-blue-700 dark:text-blue-400">{i18n.calculator.cifValue} (BRL)</span>
                <span className="text-lg font-bold font-mono text-blue-700 dark:text-blue-400">R$ {fmt(cifBrl)}</span>
              </div>
            </div>
          </div>

          {/* Tax Rates */}
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
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:sticky lg:top-6 lg:self-start">
          <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">{i18n.calculator.results}</h2>

          {/* Transport badge */}
          <div className="mb-4 flex items-center gap-2">
            {modal === "air" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                <Plane className="h-3 w-3" /> Aéreo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                <Ship className="h-3 w-3" /> Marítimo {seaType.toUpperCase()}
              </span>
            )}
            {ncm && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium font-mono text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                NCM {ncm}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <TaxRow label={i18n.calculator.ii} rate={`${iiRate}%`} value={ii} />
            <TaxRow label={i18n.calculator.ipi} rate={`${ipiRate}%`} value={ipi} />
            <TaxRow label={i18n.calculator.pis} rate={`${pisRate}%`} value={pis} />
            <TaxRow label={i18n.calculator.cofins} rate={`${cofinsRate}%`} value={cofins} />
            <TaxRow label={i18n.calculator.icms} rate={`${icmsRate}%`} value={icms} />
            <div className="my-4 border-t border-gray-200 dark:border-gray-700" />
            <div className="flex items-center justify-between rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
              <span className="font-semibold text-orange-700 dark:text-orange-400">{i18n.calculator.totalTaxes}</span>
              <span className="text-lg font-bold font-mono text-orange-700 dark:text-orange-400">R$ {fmt(totalTaxes)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <span className="text-lg font-semibold text-green-700 dark:text-green-400">{i18n.calculator.totalCost}</span>
              <span className="text-2xl font-bold font-mono text-green-700 dark:text-green-400">R$ {fmt(totalCost)}</span>
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
        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
    </div>
  );
}

function TaxRow({ label, rate, value }: { label: string; rate: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label} <span className="text-gray-400">({rate})</span></span>
      <span className="font-medium font-mono text-gray-900 dark:text-gray-100">R$ {fmt(value)}</span>
    </div>
  );
}
