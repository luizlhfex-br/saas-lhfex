import { useState, useCallback } from "react";
import type { Route } from "./+types/calculator";
import { requireAuth } from "~/lib/auth.server";
import { t, type Locale } from "~/i18n";
import {
  Calculator,
  RotateCcw,
  Search,
  Ship,
  Plane,
  Loader2,
  Package,
  Truck,
  Plus,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;
  return { locale };
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Tipos de Modalidade ────────────────────────────────────────────────────
type ModalType = "air_formal" | "courier" | "sea_lcl" | "sea_fcl";

interface ModalConfig {
  id: ModalType;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  icmsRate: number;
  showFreightInternacional: boolean;
  showCourier: boolean;
  showSeaLCL: boolean;
  showSeaFCL: boolean;
  showDespachante: boolean;
  showSiscomex: boolean;
}

const modals: ModalConfig[] = [
  {
    id: "air_formal",
    label: "Aéreo Formal",
    sublabel: "Declaração de Importação (DI) completa",
    icon: Plane,
    color: "orange",
    icmsRate: 18,
    showFreightInternacional: true,
    showCourier: false,
    showSeaLCL: false,
    showSeaFCL: false,
    showDespachante: true,
    showSiscomex: true,
  },
  {
    id: "courier",
    label: "Courier",
    sublabel: "DHL / FedEx / UPS — Simplificado",
    icon: Package,
    color: "purple",
    icmsRate: 20,
    showFreightInternacional: true,
    showCourier: true,
    showSeaLCL: false,
    showSeaFCL: false,
    showDespachante: false,
    showSiscomex: false,
  },
  {
    id: "sea_lcl",
    label: "Marítimo LCL",
    sublabel: "Carga fracionada — custo por m³/ton",
    icon: Ship,
    color: "blue",
    icmsRate: 18,
    showFreightInternacional: true,
    showCourier: false,
    showSeaLCL: true,
    showSeaFCL: false,
    showDespachante: true,
    showSiscomex: true,
  },
  {
    id: "sea_fcl",
    label: "Marítimo FCL",
    sublabel: "Container exclusivo — custo fixo",
    icon: Truck,
    color: "teal",
    icmsRate: 18,
    showFreightInternacional: false,
    showCourier: false,
    showSeaLCL: false,
    showSeaFCL: true,
    showDespachante: true,
    showSiscomex: true,
  },
];

const colorClasses = {
  orange: {
    active: "border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-900/20 dark:text-orange-400",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  },
  purple: {
    active: "border-purple-500 bg-purple-50 text-purple-700 dark:border-purple-400 dark:bg-purple-900/20 dark:text-purple-400",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  },
  blue: {
    active: "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  },
  teal: {
    active: "border-teal-500 bg-teal-50 text-teal-700 dark:border-teal-400 dark:bg-teal-900/20 dark:text-teal-400",
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400",
  },
};

// ─── Container types ─────────────────────────────────────────────────────────
const containerTypes = ["20'DC", "40'DC", "40'HC", "20'Reefer", "40'Reefer"];

// ─── Componente toggle Prepaid / Collect ────────────────────────────────────
function FreightToggle({
  value,
  onChange,
}: {
  value: "prepaid" | "collect";
  onChange: (v: "prepaid" | "collect") => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        onClick={() => onChange("prepaid")}
        className={`rounded-md px-3 py-1 font-medium transition-colors ${
          value === "prepaid"
            ? "bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-300"
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
      >
        Prepaid
      </button>
      <button
        type="button"
        onClick={() => onChange("collect")}
        className={`rounded-md px-3 py-1 font-medium transition-colors ${
          value === "collect"
            ? "bg-white text-orange-600 shadow-sm dark:bg-gray-700 dark:text-orange-400"
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
      >
        Collect
      </button>
    </div>
  );
}

export default function CalculatorPage({ loaderData }: Route.ComponentProps) {
  const { locale } = loaderData;
  const i18n = t(locale);

  // NCM
  const [ncm, setNcm] = useState("");
  const [ncmDescription, setNcmDescription] = useState("");
  const [ncmLoading, setNcmLoading] = useState(false);
  const [ncmSource, setNcmSource] = useState("");

  // Modal
  const [modal, setModal] = useState<ModalType>("sea_fcl");
  const currentModal = modals.find((m) => m.id === modal)!;

  // Common values
  const [fob, setFob] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(5.75);

  // Tax rates
  const [iiRate, setIiRate] = useState(14);
  const [ipiRate, setIpiRate] = useState(0);
  const [pisRate, setPisRate] = useState(2.10);
  const [cofinsRate, setCofinsRate] = useState(9.65);
  const [icmsRate, setIcmsRate] = useState(currentModal.icmsRate);

  // Modal-specific values
  // Aéreo Formal
  const [freightAir, setFreightAir] = useState(0);
  const [despachangeAir, setDespachangeAir] = useState(2500);
  const [siscomexAir, setSiscomexAir] = useState(214.5);

  // Courier
  const [freightCourier, setFreightCourier] = useState(0);
  const [taxaAdmCourier, setTaxaAdmCourier] = useState(0);

  // LCL
  const [freightLCL, setFreightLCL] = useState(0);
  const [thcLCL, setThcLCL] = useState(0);
  const [armazenagemLCL, setArmazenagemLCL] = useState(0);
  const [taxaSantosLCL, setTaxaSantosLCL] = useState(0);
  const [remocaoLCL, setRemocaoLCL] = useState(0);
  const [despachangeLCL, setDespachangeLCL] = useState(2500);
  const [siscomexLCL, setSiscomexLCL] = useState(214.5);

  // FCL
  const [containerType, setContainerType] = useState("40'HC");
  const [containerCount, setContainerCount] = useState(1);
  const [freightFCLPerContainer, setFreightFCLPerContainer] = useState(0);
  const [thcFCL, setThcFCL] = useState(0);
  const [demurragePerDay, setDemurragePerDay] = useState(0);
  const [demurrageDays, setDemurrageDays] = useState(0);
  const [despachangeFCL, setDespachangeFCL] = useState(3500);
  const [siscomexFCL, setSiscomexFCL] = useState(214.5);

  // Frete Prepaid / Collect
  const [freightPrepaid, setFreightPrepaid] = useState<"prepaid" | "collect">("prepaid");

  // Custos Nacionais comuns (todos os modais)
  const [armazenagem, setArmazenagem] = useState(0);
  const [honorarios, setHonorarios] = useState(0);
  const [freteRodoviario, setFreteRodoviario] = useState(0);

  // Despesas extras dinâmicas
  type ExtraCost = { id: number; label: string; value: number };
  const [extraCosts, setExtraCosts] = useState<ExtraCost[]>([]);
  const [nextExtraId, setNextExtraId] = useState(1);

  const addExtraCost = () => {
    setExtraCosts((prev) => [...prev, { id: nextExtraId, label: "", value: 0 }]);
    setNextExtraId((n) => n + 1);
  };
  const removeExtraCost = (id: number) => setExtraCosts((prev) => prev.filter((e) => e.id !== id));
  const updateExtraCost = (id: number, field: "label" | "value", val: string | number) =>
    setExtraCosts((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: val } : e)));

  // ─── Cálculos por modalidade ─────────────────────────────────────────────
  const calcResult = (() => {
    let freight = 0;
    let custosBrasileiros = 0;
    let extraDetails: { label: string; value: number }[] = [];

    if (modal === "air_formal") {
      freight = freightAir;
      custosBrasileiros = despachangeAir + siscomexAir;
      extraDetails = [
        { label: "Despachante Aduaneiro", value: despachangeAir },
        { label: "SISCOMEX", value: siscomexAir },
      ];
    } else if (modal === "courier") {
      freight = freightCourier;
      custosBrasileiros = taxaAdmCourier;
      extraDetails = [
        { label: "Taxa Adm. Carrier (DHL/FedEx/UPS)", value: taxaAdmCourier },
      ];
    } else if (modal === "sea_lcl") {
      freight = freightLCL;
      const portCosts = thcLCL + armazenagemLCL + taxaSantosLCL + remocaoLCL;
      custosBrasileiros = portCosts + despachangeLCL + siscomexLCL;
      extraDetails = [
        { label: "THC Santos", value: thcLCL },
        { label: "Armazenagem Santos", value: armazenagemLCL },
        { label: "Taxa Santos", value: taxaSantosLCL },
        { label: "Remoção Santos → Destino", value: remocaoLCL },
        { label: "Despachante Aduaneiro", value: despachangeLCL },
        { label: "SISCOMEX", value: siscomexLCL },
      ];
    } else if (modal === "sea_fcl") {
      const freightFCL = freightFCLPerContainer * containerCount;
      freight = freightFCL;
      const demurrage = demurragePerDay * demurrageDays * containerCount;
      const thcTotal = thcFCL * containerCount;
      custosBrasileiros = thcTotal + demurrage + despachangeFCL + siscomexFCL;
      extraDetails = [
        { label: `THC (${containerCount}x container)`, value: thcTotal },
        { label: `Demurrage (${demurrageDays} dias × ${containerCount} ctns)`, value: demurrage },
        { label: "Despachante Aduaneiro", value: despachangeFCL },
        { label: "SISCOMEX", value: siscomexFCL },
      ];
    }

    // Custos nacionais comuns (todos os modais)
    const commonNational = armazenagem + honorarios + freteRodoviario;
    const extraTotal = extraCosts.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
    custosBrasileiros += commonNational + extraTotal;

    if (armazenagem > 0) extraDetails.push({ label: "Armazenagem", value: armazenagem });
    if (honorarios > 0) extraDetails.push({ label: "Honorários", value: honorarios });
    if (freteRodoviario > 0) extraDetails.push({ label: "Frete Rodoviário", value: freteRodoviario });
    for (const ec of extraCosts) {
      if (ec.value > 0) extraDetails.push({ label: ec.label || "Despesa extra", value: Number(ec.value) });
    }

    const cif = fob + freight + insurance;
    const cifBrl = cif * exchangeRate;

    const ii = cifBrl * (iiRate / 100);
    const ipi = (cifBrl + ii) * (ipiRate / 100);
    const pis = cifBrl * (pisRate / 100);
    const cofins = cifBrl * (cofinsRate / 100);

    // ICMS MG por dentro
    const icmsSomaTributos = cifBrl + ii + ipi + pis + cofins;
    const baseIcms = icmsRate < 100 ? icmsSomaTributos / (1 - icmsRate / 100) : 0;
    const icms = baseIcms * (icmsRate / 100);

    const totalTaxes = ii + ipi + pis + cofins + icms;
    const totalCost = cifBrl + totalTaxes + custosBrasileiros;

    return {
      cif,
      cifBrl,
      ii,
      ipi,
      pis,
      cofins,
      icms,
      totalTaxes,
      custosBrasileiros,
      totalCost,
      freight,
      extraDetails,
    };
  })();

  const reset = () => {
    setFob(0);
    setInsurance(0);
    setExchangeRate(5.75);
    setIiRate(14);
    setIpiRate(0);
    setPisRate(2.10);
    setCofinsRate(9.65);
    setIcmsRate(currentModal.icmsRate);
    setNcm("");
    setNcmDescription("");
    setNcmSource("");
    setFreightAir(0);
    setDespachangeAir(2500);
    setSiscomexAir(214.5);
    setFreightCourier(0);
    setTaxaAdmCourier(0);
    setFreightLCL(0);
    setThcLCL(0);
    setArmazenagemLCL(0);
    setTaxaSantosLCL(0);
    setRemocaoLCL(0);
    setDespachangeLCL(2500);
    setSiscomexLCL(214.5);
    setFreightFCLPerContainer(0);
    setThcFCL(0);
    setDemurragePerDay(0);
    setDemurrageDays(0);
    setDespachangeFCL(3500);
    setSiscomexFCL(214.5);
    setContainerCount(1);
    setFreightPrepaid("prepaid");
    setArmazenagem(0);
    setHonorarios(0);
    setFreteRodoviario(0);
    setExtraCosts([]);
    setNextExtraId(1);
  };

  const handleModalChange = (m: ModalType) => {
    setModal(m);
    const cfg = modals.find((x) => x.id === m)!;
    setIcmsRate(cfg.icmsRate);
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

  const handleNcmChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + "." + digits.slice(4);
    if (digits.length > 6)
      formatted = digits.slice(0, 4) + "." + digits.slice(4, 6) + "." + digits.slice(6);
    setNcm(formatted);
  };

  const colors = colorClasses[currentModal.color as keyof typeof colorClasses];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {i18n.calculator.title}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {i18n.calculator.subtitle}
        </p>
      </div>

      {/* ── Seletor de Modalidade ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {modals.map((m) => {
          const Icon = m.icon;
          const c = colorClasses[m.color as keyof typeof colorClasses];
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => handleModalChange(m.id)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
                modal === m.id
                  ? c.active
                  : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400"
              }`}
            >
              <Icon className="h-6 w-6" />
              <div>
                <p className="text-sm font-semibold leading-tight">{m.label}</p>
                <p className="mt-0.5 text-xs opacity-75">{m.sublabel}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Coluna Esquerda: Inputs ── */}
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
                {ncmLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </Button>
            </div>
            {ncmDescription && (
              <div className="mt-3 rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
                <p className="text-xs font-medium text-purple-700 dark:text-purple-400">
                  {ncmDescription}
                </p>
                {ncmSource && (
                  <p className="mt-1 text-xs text-purple-500">
                    Fonte: {ncmSource} — alíquotas preenchidas automaticamente (editáveis)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Valores Base */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              <Calculator className="h-5 w-5 text-blue-600" /> Valores Base (USD)
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumInput label={i18n.calculator.productValue} value={fob} onChange={setFob} />
              <NumInput
                label="Seguro Internacional (USD)"
                value={insurance}
                onChange={setInsurance}
                step="0.01"
              />
              <NumInput
                label={i18n.calculator.exchangeRate}
                value={exchangeRate}
                onChange={setExchangeRate}
                step="0.01"
              />
            </div>
          </div>

          {/* Frete — Aéreo Formal */}
          {currentModal.showFreightInternacional && modal === "air_formal" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  <Plane className="h-5 w-5 text-orange-500" /> Frete & Custos Aéreos
                </h2>
                <FreightToggle value={freightPrepaid} onChange={setFreightPrepaid} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumInput label="Frete Aéreo (USD)" value={freightAir} onChange={setFreightAir} />
                <NumInput
                  label="Despachante Aduaneiro (BRL)"
                  value={despachangeAir}
                  onChange={setDespachangeAir}
                />
                <NumInput
                  label="SISCOMEX (BRL)"
                  value={siscomexAir}
                  onChange={setSiscomexAir}
                  step="0.01"
                />
              </div>
            </div>
          )}

          {/* Frete — Courier */}
          {modal === "courier" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  <Package className="h-5 w-5 text-purple-500" /> Courier (DHL / FedEx / UPS)
                </h2>
                <FreightToggle value={freightPrepaid} onChange={setFreightPrepaid} />
              </div>
              <div className="mb-3 rounded-lg bg-purple-50 p-3 text-xs text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                ICMS MG: <strong>20% por dentro</strong> (vigente desde abril/2025)
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumInput label="Frete Courier (USD)" value={freightCourier} onChange={setFreightCourier} />
                <NumInput
                  label="Taxa Adm. Carrier (BRL)"
                  value={taxaAdmCourier}
                  onChange={setTaxaAdmCourier}
                />
              </div>
            </div>
          )}

          {/* Frete — LCL */}
          {modal === "sea_lcl" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  <Ship className="h-5 w-5 text-blue-500" /> Frete & Custos Marítimo LCL
                </h2>
                <FreightToggle value={freightPrepaid} onChange={setFreightPrepaid} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumInput label="Frete LCL (USD)" value={freightLCL} onChange={setFreightLCL} />
                <NumInput label="THC Santos (BRL)" value={thcLCL} onChange={setThcLCL} />
                <NumInput
                  label="Armazenagem Santos (BRL)"
                  value={armazenagemLCL}
                  onChange={setArmazenagemLCL}
                />
                <NumInput
                  label="Taxa Santos (BRL)"
                  value={taxaSantosLCL}
                  onChange={setTaxaSantosLCL}
                />
                <NumInput
                  label="Remoção Santos → Betim (BRL)"
                  value={remocaoLCL}
                  onChange={setRemocaoLCL}
                />
                <NumInput
                  label="Despachante Aduaneiro (BRL)"
                  value={despachangeLCL}
                  onChange={setDespachangeLCL}
                />
                <NumInput label="SISCOMEX (BRL)" value={siscomexLCL} onChange={setSiscomexLCL} step="0.01" />
              </div>
            </div>
          )}

          {/* Frete — FCL */}
          {modal === "sea_fcl" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  <Truck className="h-5 w-5 text-teal-500" /> Frete & Custos Marítimo FCL
                </h2>
                <FreightToggle value={freightPrepaid} onChange={setFreightPrepaid} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Container type + qty */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tipo de Container
                  </label>
                  <select
                    value={containerType}
                    onChange={(e) => setContainerType(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    {containerTypes.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <NumInput
                  label="Qtd. Containers"
                  value={containerCount}
                  onChange={(v) => setContainerCount(Math.max(1, Math.round(v)))}
                  step="1"
                />
                <NumInput
                  label="Frete por Container (USD)"
                  value={freightFCLPerContainer}
                  onChange={setFreightFCLPerContainer}
                />
                <NumInput
                  label="THC por Container (BRL)"
                  value={thcFCL}
                  onChange={setThcFCL}
                />
                <NumInput
                  label="Demurrage por Dia/Container (BRL)"
                  value={demurragePerDay}
                  onChange={setDemurragePerDay}
                />
                <NumInput
                  label="Dias de Demurrage"
                  value={demurrageDays}
                  onChange={setDemurrageDays}
                  step="1"
                />
                <NumInput
                  label="Despachante Aduaneiro (BRL)"
                  value={despachangeFCL}
                  onChange={setDespachangeFCL}
                />
                <NumInput label="SISCOMEX (BRL)" value={siscomexFCL} onChange={setSiscomexFCL} step="0.01" />
              </div>
            </div>
          )}

          {/* Custos Nacionais Comuns */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Custos Nacionais (BRL)
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumInput label="Armazenagem (BRL)" value={armazenagem} onChange={setArmazenagem} />
              <NumInput label="Honorários (BRL)" value={honorarios} onChange={setHonorarios} />
              <NumInput label="Frete Rodoviário (BRL)" value={freteRodoviario} onChange={setFreteRodoviario} />
            </div>

            {/* Despesas extras dinâmicas */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Outras Despesas</p>
                <button
                  type="button"
                  onClick={addExtraCost}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-indigo-400 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-600 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar despesa
                </button>
              </div>
              {extraCosts.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">Nenhuma despesa extra adicionada.</p>
              )}
              <div className="space-y-2">
                {extraCosts.map((ec) => (
                  <div key={ec.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Nome da despesa"
                      value={ec.label}
                      onChange={(e) => updateExtraCost(ec.id, "label", e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <input
                      type="number"
                      placeholder="0,00"
                      min="0"
                      step="0.01"
                      value={ec.value || ""}
                      onChange={(e) => updateExtraCost(ec.id, "value", parseFloat(e.target.value) || 0)}
                      className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => removeExtraCost(ec.id)}
                      className="flex-shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Alíquotas */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Alíquotas (%)
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <NumInput label={i18n.calculator.iiRate} value={iiRate} onChange={setIiRate} step="0.01" />
              <NumInput label={i18n.calculator.ipiRate} value={ipiRate} onChange={setIpiRate} step="0.01" />
              <NumInput label={i18n.calculator.pisRate} value={pisRate} onChange={setPisRate} step="0.01" />
              <NumInput
                label={i18n.calculator.cofinsRate}
                value={cofinsRate}
                onChange={setCofinsRate}
                step="0.01"
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {i18n.calculator.icmsRate}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={icmsRate || ""}
                  onChange={(e) => setIcmsRate(parseFloat(e.target.value) || 0)}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {modal === "courier" ? "20% desde abr/2025" : "18% ICMS MG por dentro"}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="h-4 w-4" />
                {i18n.calculator.reset}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Coluna Direita: Resultado (sticky) ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:sticky lg:top-6 lg:self-start">
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {i18n.calculator.results}
          </h2>

          {/* Badges de modalidade */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${colors.badge}`}
            >
              {(() => {
                const Icon = currentModal.icon;
                return <Icon className="h-3 w-3" />;
              })()}
              {currentModal.label}
            </span>
            {ncm && (
              <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-medium font-mono text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                NCM {ncm}
              </span>
            )}
            {modal === "sea_fcl" && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {containerCount}× {containerType}
              </span>
            )}
          </div>

          {/* CIF */}
          <div className="mb-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                CIF
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                freightPrepaid === "prepaid"
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
              }`}>
                Frete {freightPrepaid === "prepaid" ? "Prepaid" : "Collect"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-blue-700 dark:text-blue-400">
                {i18n.calculator.cifValue} (USD)
              </span>
              <span className="font-bold font-mono text-blue-700 dark:text-blue-400">
                $ {fmt(calcResult.cif)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="font-medium text-blue-700 dark:text-blue-400">
                {i18n.calculator.cifValue} (BRL)
              </span>
              <span className="font-bold font-mono text-blue-700 dark:text-blue-400">
                R$ {fmt(calcResult.cifBrl)}
              </span>
            </div>
          </div>

          {/* Impostos */}
          <div className="space-y-2">
            <TaxRow label={i18n.calculator.ii} rate={`${iiRate}%`} value={calcResult.ii} />
            <TaxRow label={i18n.calculator.ipi} rate={`${ipiRate}%`} value={calcResult.ipi} />
            <TaxRow label={i18n.calculator.pis} rate={`${pisRate}%`} value={calcResult.pis} />
            <TaxRow label={i18n.calculator.cofins} rate={`${cofinsRate}%`} value={calcResult.cofins} />
            <TaxRow
              label={`${i18n.calculator.icms} (por dentro)`}
              rate={`${icmsRate}%`}
              value={calcResult.icms}
            />
          </div>

          <div className="my-3 border-t border-gray-200 dark:border-gray-700" />

          {/* Total Impostos */}
          <div className="mb-3 flex items-center justify-between rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
            <span className="font-semibold text-orange-700 dark:text-orange-400">
              {i18n.calculator.totalTaxes}
            </span>
            <span className="font-bold font-mono text-orange-700 dark:text-orange-400">
              R$ {fmt(calcResult.totalTaxes)}
            </span>
          </div>

          {/* Custos Brasileiros */}
          {calcResult.extraDetails.length > 0 && (
            <div className="mb-3 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Custos Nacionais (BRL)
              </p>
              {calcResult.extraDetails.map((d) =>
                d.value > 0 ? (
                  <div key={d.label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{d.label}</span>
                    <span className="font-medium font-mono text-gray-900 dark:text-gray-100">
                      R$ {fmt(d.value)}
                    </span>
                  </div>
                ) : null
              )}
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-2 text-sm dark:bg-gray-800">
                <span className="font-medium text-gray-700 dark:text-gray-300">Subtotal Nacional</span>
                <span className="font-bold font-mono text-gray-900 dark:text-gray-100">
                  R$ {fmt(calcResult.custosBrasileiros)}
                </span>
              </div>
            </div>
          )}

          {/* Total Final */}
          <div className="flex items-center justify-between rounded-xl bg-green-50 p-4 dark:bg-green-900/20">
            <div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                {i18n.calculator.totalCost}
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">Impostos + Custos nacionais</p>
            </div>
            <span className="text-2xl font-bold font-mono text-green-700 dark:text-green-400">
              R$ {fmt(calcResult.totalCost)}
            </span>
          </div>

          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            * Simulação estimada. ICMS calculado por dentro (MG). Consulte um despachante para valores
            oficiais.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────
function NumInput({
  label,
  value,
  onChange,
  step = "any",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <input
        type="number"
        step={step}
        value={value || ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />
    </div>
  );
}

function TaxRow({
  label,
  rate,
  value,
}: {
  label: string;
  rate: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600 dark:text-gray-400">
        {label} <span className="text-gray-400">({rate})</span>
      </span>
      <span className="font-medium font-mono text-gray-900 dark:text-gray-100">
        R$ {fmt(value)}
      </span>
    </div>
  );
}
