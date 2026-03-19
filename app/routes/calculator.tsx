import { useState, useCallback, useEffect } from "react";
import type { Route } from "./+types/calculator";
import { requireAuth } from "~/lib/auth.server";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import { db } from "~/lib/db.server";
import { processes, clients } from "../../drizzle/schema";
import { and, eq, isNull } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import {
  Calculator,
  RotateCcw,
  Copy,
  Search,
  Ship,
  Plane,
  Loader2,
  Package,
  Truck,
  Plus,
  X,
  RefreshCw,
  BadgeInfo,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Link } from "react-router";

type ModalType = "air_formal" | "courier" | "sea_lcl" | "sea_fcl";

type ProcessCalculatorContext = {
  id: string;
  reference: string;
  clientName: string;
  processType: "import" | "export" | "services";
  hsCode: string | null;
  incoterm: string | null;
  totalValue: string | null;
  currency: string | null;
};

type CalculatorLoaderData = {
  locale: Locale;
  processContext: ProcessCalculatorContext | null;
  initialModal: ModalType;
  initialValues: {
    fob: number;
    exchangeRate: number;
    ncm: string;
  };
};

const modalIds = ["air_formal", "courier", "sea_lcl", "sea_fcl"] as const;
const DEFAULT_MODAL: ModalType = "sea_fcl";

function isModalType(value: string | null): value is ModalType {
  return Boolean(value && modalIds.includes(value as ModalType));
}

function toNumber(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildInitialValues(processContext: ProcessCalculatorContext | null) {
  const currency = processContext?.currency?.toUpperCase() || "USD";
  return {
    fob: toNumber(processContext?.totalValue),
    exchangeRate: currency === "BRL" ? 1 : 5.75,
    ncm: processContext?.hsCode ? formatNcmCode(processContext.hsCode) : "",
  };
}

export async function loader({ request }: Route.LoaderArgs): Promise<CalculatorLoaderData> {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const url = new URL(request.url);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;
  const modalParam = url.searchParams.get("modal");
  const processId = url.searchParams.get("processId");
  const initialModal = isModalType(modalParam) ? modalParam : DEFAULT_MODAL;

  let processContext: ProcessCalculatorContext | null = null;

  if (processId) {
    const [process] = await db
      .select({
        id: processes.id,
        reference: processes.reference,
        processType: processes.processType,
        hsCode: processes.hsCode,
        incoterm: processes.incoterm,
        totalValue: processes.totalValue,
        currency: processes.currency,
        clientName: clients.nomeFantasia,
        clientRazao: clients.razaoSocial,
      })
      .from(processes)
      .innerJoin(clients, eq(processes.clientId, clients.id))
      .where(
        and(
          eq(processes.id, processId),
          eq(processes.companyId, companyId),
          isNull(processes.deletedAt),
          isNull(clients.deletedAt),
        ),
      )
      .limit(1);

    if (process) {
      processContext = {
        id: process.id,
        reference: process.reference,
        clientName: process.clientName || process.clientRazao,
        processType: process.processType,
        hsCode: process.hsCode,
        incoterm: process.incoterm,
        totalValue: process.totalValue ? String(process.totalValue) : null,
        currency: process.currency || null,
      };
    }
  }

  return {
    locale,
    processContext,
    initialModal,
    initialValues: buildInitialValues(processContext),
  };
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type NcmAllocation = {
  id: number;
  code: string;
  merchandiseValueUsd: number;
  iiRate: number;
  ipiRate: number;
  pisRate: number;
  cofinsRate: number;
  icmsRate: number;
  description?: string;
  source?: string;
  matchedCode?: string;
  matchType?: string;
  catalogUpdatedAt?: string;
  catalogAct?: string;
};

type NcmTaxLookupResponse = {
  code: string;
  ii: number;
  ipi: number;
  pis: number;
  cofins: number;
  icms?: number;
  ncmDescription?: string | null;
  description?: string | null;
  source?: string;
  catalogMatchType?: string | null;
  catalogMatchedCode?: string | null;
  catalogUpdatedAt?: string | null;
  catalogAct?: string | null;
};

function normalizeNcmCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

function formatNcmCode(value: string): string {
  const digits = normalizeNcmCode(value);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

function getNcmSourceLabel(source?: string): string {
  if (source === "catalog_tec_table") return "Catalogo NCM local + tabela estimada";
  if (source === "catalog_default") return "Catalogo NCM local + padrao estimado";
  if (source === "tec_table") return "Tabela estimada";
  if (source === "default") return "Padrao estimado";
  return "";
}

function getNcmMatchLabel(matchType?: string | null): string {
  if (matchType === "exact") return "Match exato";
  if (matchType === "parent") return "Match por prefixo pai";
  return "";
}

// ─── Tipos de Modalidade ────────────────────────────────────────────────────
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

const invoiceCurrencyOptions = [
  "USD",
  "BRL",
  "EUR",
  "CNY",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "MXN",
  "SGD",
  "HKD",
] as const;

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
  const { locale, processContext, initialModal, initialValues } = loaderData;
  const i18n = t(locale);

  // NCM
  const [ncm, setNcm] = useState(initialValues.ncm);
  const [ncmDescription, setNcmDescription] = useState("");
  const [ncmLoading, setNcmLoading] = useState(false);
  const [ncmSource, setNcmSource] = useState("");
  const [ncmMatchedCode, setNcmMatchedCode] = useState("");
  const [ncmMatchType, setNcmMatchType] = useState("");
  const [ncmCatalogUpdatedAt, setNcmCatalogUpdatedAt] = useState("");
  const [ncmCatalogAct, setNcmCatalogAct] = useState("");

  // Modal
  const [modal, setModal] = useState<ModalType>(initialModal);
  const currentModal = modals.find((m) => m.id === modal)!;

  // PTAX — dólar comercial BCB
  const [ptaxRate, setPtaxRate] = useState<number | null>(null);
  const [ptaxLoading, setPtaxLoading] = useState(false);
  const [ptaxSource, setPtaxSource] = useState<string>("");
  const [ptaxTimestamp, setPtaxTimestamp] = useState<number | null>(null);

  const fetchPtax = useCallback(async () => {
    setPtaxLoading(true);
    try {
      const res = await fetch("/api/exchange-rate");
      if (res.ok) {
        const data = await res.json();
        const rate = data.ptax ?? data.rate ?? data.bid;
        if (rate) {
          setExchangeRate(rate);
          setPtaxRate(data.ptax ?? null);
          setPtaxSource(data.source ?? "");
          setPtaxTimestamp(data.timestamp ?? Date.now());
        }
      }
    } catch {
      // Silencioso
    } finally {
      setPtaxLoading(false);
    }
  }, []);

  // Common values
  const [fob, setFob] = useState(initialValues.fob);
  const [insurance, setInsurance] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(initialValues.exchangeRate);
  const [invoiceCurrency, setInvoiceCurrency] = useState(processContext?.currency?.toUpperCase() || "USD");
  const [invoiceAmount, setInvoiceAmount] = useState(toNumber(processContext?.totalValue));
  const [invoiceConvertedUsd, setInvoiceConvertedUsd] = useState<number | null>(null);
  const [invoiceRate, setInvoiceRate] = useState<number | null>(null);
  const [invoiceSource, setInvoiceSource] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  type SiscomexFeeResponse = {
    additions: number;
    rowLabel: string;
    registrationFee: number;
    additionalFee: number;
    totalFee: number;
    sourceFile: string;
    updatedAt: string;
    source: string;
    capped: boolean;
  };
  const [siscomexFee, setSiscomexFee] = useState<SiscomexFeeResponse | null>(null);
  const [siscomexLoading, setSiscomexLoading] = useState(false);
  const [siscomexError, setSiscomexError] = useState("");

  // Tax rates
  const [iiRate, setIiRate] = useState(14);
  const [ipiRate, setIpiRate] = useState(0);
  const [pisRate, setPisRate] = useState(2.10);
  const [cofinsRate, setCofinsRate] = useState(9.65);
  const [icmsRate, setIcmsRate] = useState(currentModal.icmsRate);
  const [ncmAllocations, setNcmAllocations] = useState<NcmAllocation[]>([]);
  const [nextNcmAllocationId, setNextNcmAllocationId] = useState(1);
  const [ncmAllocationLoadingIds, setNcmAllocationLoadingIds] = useState<number[]>([]);
  const [resolvedNcmAllocationCodes, setResolvedNcmAllocationCodes] = useState<Record<number, string>>({});

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
  const [copyFeedback, setCopyFeedback] = useState(false);

  const addExtraCost = () => {
    setExtraCosts((prev) => [...prev, { id: nextExtraId, label: "", value: 0 }]);
    setNextExtraId((n) => n + 1);
  };
  const removeExtraCost = (id: number) => setExtraCosts((prev) => prev.filter((e) => e.id !== id));
  const updateExtraCost = (id: number, field: "label" | "value", val: string | number) =>
    setExtraCosts((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: val } : e)));

  const addNcmAllocation = () => {
    const seededValue = ncmAllocations.length === 0 ? (invoiceConvertedUsd ?? fob) : 0;
    setNcmAllocations((prev) => [
      ...prev,
      {
        id: nextNcmAllocationId,
        code: ncm || "",
        merchandiseValueUsd: seededValue,
        iiRate,
        ipiRate,
        pisRate,
        cofinsRate,
        icmsRate,
      },
    ]);
    setNextNcmAllocationId((v) => v + 1);
  };

  const removeNcmAllocation = (id: number) => {
    setResolvedNcmAllocationCodes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setNcmAllocations((prev) => prev.filter((row) => row.id !== id));
  };

  const updateNcmAllocation = (id: number, patch: Partial<NcmAllocation>) => {
    setNcmAllocations((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const convertInvoiceToUsd = useCallback(async () => {
    const sourceCurrency = invoiceCurrency.trim().toUpperCase();
    const amount = Number(invoiceAmount);

    if (!sourceCurrency || sourceCurrency.length !== 3 || !Number.isFinite(amount) || amount <= 0) {
      setInvoiceError("Informe uma moeda e um valor validos.");
      return;
    }

    setInvoiceLoading(true);
    setInvoiceError("");

    try {
      const res = await fetch(
        `/api/currency-convert?from=${encodeURIComponent(sourceCurrency)}&to=USD&amount=${encodeURIComponent(String(amount))}`,
      );

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error((payload as { error?: string } | null)?.error || "Falha na conversao.");
      }

      const data = (await res.json()) as {
        convertedAmount: number;
        rate: number;
        source?: string;
      };

      setInvoiceConvertedUsd(data.convertedAmount);
      setInvoiceRate(data.rate);
      setInvoiceSource(data.source ?? "");
      setFob(data.convertedAmount);
      if (sourceCurrency === "BRL") {
        setExchangeRate(1 / data.rate);
      }
    } catch (error) {
      setInvoiceConvertedUsd(null);
      setInvoiceRate(null);
      setInvoiceSource("");
      setInvoiceError(error instanceof Error ? error.message : "Nao foi possivel converter a invoice.");
    } finally {
      setInvoiceLoading(false);
    }
  }, [invoiceAmount, invoiceCurrency]);

  const fetchNcmTaxes = useCallback(async (code: string): Promise<NcmTaxLookupResponse | null> => {
    const clean = normalizeNcmCode(code);
    if (clean.length < 4) return null;

    const res = await fetch(`/api/ncm-taxes?code=${encodeURIComponent(clean)}`);
    if (!res.ok) return null;

    return res.json() as Promise<NcmTaxLookupResponse>;
  }, []);

  const validNcmAllocations = ncmAllocations.filter((row) => row.merchandiseValueUsd > 0);
  const ncmAllocationTotalUsd = validNcmAllocations.reduce((sum, row) => sum + (Number(row.merchandiseValueUsd) || 0), 0);
  const hasNcmAllocations = validNcmAllocations.length > 0;
  const fobBase = hasNcmAllocations ? ncmAllocationTotalUsd : fob;
  const ncmAllocationDeltaUsd = hasNcmAllocations ? ncmAllocationTotalUsd - fob : 0;
  const siscomexAdditions = Math.max(1, hasNcmAllocations ? validNcmAllocations.length : normalizeNcmCode(ncm).length >= 4 ? 1 : 0);

  // ─── Cálculos por modalidade ─────────────────────────────────────────────
  const calcResult = (() => {
    let freight = 0;
    let custosBrasileiros = 0;
    let extraDetails: { label: string; value: number }[] = [];
    const siscomexTotal = siscomexFee?.totalFee ?? 115.67;
    const siscomexLabel = siscomexFee
      ? siscomexFee.rowLabel + " (" + siscomexFee.additions + " adicoes)"
      : "Taxa Siscomex";

    if (modal === "air_formal") {
      freight = freightAir;
      custosBrasileiros = despachangeAir + siscomexTotal;
      extraDetails = [
        { label: "Honorario Despachante", value: despachangeAir },
        { label: siscomexLabel, value: siscomexTotal },
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
      custosBrasileiros = portCosts + despachangeLCL + siscomexTotal;
      extraDetails = [
        { label: "THC Santos", value: thcLCL },
        { label: "Armazenagem Santos", value: armazenagemLCL },
        { label: "Taxa Santos", value: taxaSantosLCL },
        { label: "Remocao Santos -> Destino", value: remocaoLCL },
        { label: "Honorario Despachante", value: despachangeLCL },
        { label: siscomexLabel, value: siscomexTotal },
      ];
    } else if (modal === "sea_fcl") {
      const freightFCL = freightFCLPerContainer * containerCount;
      freight = freightFCL;
      const demurrage = demurragePerDay * demurrageDays * containerCount;
      const thcTotal = thcFCL * containerCount;
      custosBrasileiros = thcTotal + demurrage + despachangeFCL + siscomexTotal;
      extraDetails = [
        { label: "THC (" + containerCount + "x container)", value: thcTotal },
        { label: "Demurrage apos " + demurrageDays + " dias de free time (" + containerCount + " ctns)", value: demurrage },
        { label: "Honorario Despachante", value: despachangeFCL },
        { label: siscomexLabel, value: siscomexTotal },
      ];
    }

    // Custos nacionais comuns (todos os modais)
    const commonNational = armazenagem + honorarios + freteRodoviario;
    const extraTotal = extraCosts.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
    custosBrasileiros += commonNational + extraTotal;

    if (armazenagem > 0) extraDetails.push({ label: "Armazenagem", value: armazenagem });
    if (honorarios > 0) extraDetails.push({ label: "Honorarios", value: honorarios });
    if (freteRodoviario > 0) extraDetails.push({ label: "Frete Rodoviario", value: freteRodoviario });
    for (const ec of extraCosts) {
      if (ec.value > 0) extraDetails.push({ label: ec.label || "Despesa extra", value: Number(ec.value) });
    }

    const cif = fobBase + freight + insurance;
    const cifBrl = cif * exchangeRate;

    const validAllocations = validNcmAllocations;
    const totalAllocationUsd = ncmAllocationTotalUsd;

    let ii = cifBrl * (iiRate / 100);
    let ipi = (cifBrl + ii) * (ipiRate / 100);
    let pis = cifBrl * (pisRate / 100);
    let cofins = cifBrl * (cofinsRate / 100);
    let icms = 0;

    if (hasNcmAllocations && totalAllocationUsd > 0) {
      let iiAcc = 0;
      let ipiAcc = 0;
      let pisAcc = 0;
      let cofinsAcc = 0;
      let icmsAcc = 0;

      for (const row of validAllocations) {
        const share = row.merchandiseValueUsd / totalAllocationUsd;
        const baseShare = cifBrl * share;
        const iiShare = baseShare * (row.iiRate / 100);
        const ipiShare = (baseShare + iiShare) * (row.ipiRate / 100);
        const pisShare = baseShare * (row.pisRate / 100);
        const cofinsShare = baseShare * (row.cofinsRate / 100);
        const icmsBase = baseShare + iiShare + ipiShare + pisShare + cofinsShare;
        const icmsShare = row.icmsRate < 100 ? icmsBase * (row.icmsRate / (1 - row.icmsRate / 100)) : 0;

        iiAcc += iiShare;
        ipiAcc += ipiShare;
        pisAcc += pisShare;
        cofinsAcc += cofinsShare;
        icmsAcc += icmsShare;
      }

      ii = iiAcc;
      ipi = ipiAcc;
      pis = pisAcc;
      cofins = cofinsAcc;
      icms = icmsAcc;
    } else {
      // ICMS MG por dentro
      const icmsSomaTributos = cifBrl + ii + ipi + pis + cofins;
      const baseIcms = icmsRate < 100 ? icmsSomaTributos / (1 - icmsRate / 100) : 0;
      icms = baseIcms * (icmsRate / 100);
    }

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
      hasNcmAllocation: hasNcmAllocations,
      fobBase,
      ncmAllocationTotalUsd,
      ncmAllocationDeltaUsd,
      ncmAllocationCount: validAllocations.length,
      siscomex: siscomexTotal,
      siscomexAdditions,
      siscomexLabel,
    };
  })();

  const reset = () => {
    setFob(initialValues.fob);
    setInsurance(0);
    setExchangeRate(initialValues.exchangeRate);
    setInvoiceCurrency(processContext?.currency?.toUpperCase() || "USD");
    setInvoiceAmount(toNumber(processContext?.totalValue));
    setInvoiceConvertedUsd(null);
    setInvoiceRate(null);
    setInvoiceSource("");
    setInvoiceError("");
    setPtaxRate(null);
    setPtaxSource("");
    setPtaxTimestamp(null);
    setSiscomexFee(null);
    setSiscomexError("");
    setIiRate(14);
    setIpiRate(0);
    setPisRate(2.10);
    setCofinsRate(9.65);
    setNcmAllocations([]);
    setNextNcmAllocationId(1);
    setIcmsRate(currentModal.icmsRate);
    setNcm("");
    setNcmDescription("");
    setNcmSource("");
    setNcmMatchedCode("");
    setNcmMatchType("");
    setNcmCatalogUpdatedAt("");
    setNcmCatalogAct("");
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
    setNcm(initialValues.ncm);
  };

  const handleModalChange = (m: ModalType) => {
    setModal(m);
    const cfg = modals.find((x) => x.id === m)!;
    setIcmsRate(cfg.icmsRate);
  };

  // NCM lookup
  const lookupNCM = useCallback(async (code: string) => {
    const clean = normalizeNcmCode(code);
    if (clean.length < 4) return;
    setNcmLoading(true);
    try {
      const data = await fetchNcmTaxes(clean);
      if (!data) return;
      setNcm(formatNcmCode(clean));
      setIiRate(data.ii);
      setIpiRate(data.ipi);
      setPisRate(data.pis);
      setCofinsRate(data.cofins);
      setNcmDescription(data.ncmDescription || data.description || "");
      setNcmSource(getNcmSourceLabel(data.source));
      setNcmMatchedCode(data.catalogMatchedCode || "");
      setNcmMatchType(getNcmMatchLabel(data.catalogMatchType));
      setNcmCatalogUpdatedAt(data.catalogUpdatedAt || "");
      setNcmCatalogAct(data.catalogAct || "");
    } catch {
      // Ignore
    } finally {
      setNcmLoading(false);
    }
  }, [fetchNcmTaxes]);

  const lookupNcmAllocation = useCallback(async (id: number, code: string) => {
    const clean = normalizeNcmCode(code);
    if (clean.length < 4) return;

    setNcmAllocationLoadingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    try {
      const data = await fetchNcmTaxes(clean);
      if (!data) return;

      setResolvedNcmAllocationCodes((prev) => ({ ...prev, [id]: clean }));
      updateNcmAllocation(id, {
        code: formatNcmCode(clean),
        iiRate: data.ii,
        ipiRate: data.ipi,
        pisRate: data.pis,
        cofinsRate: data.cofins,
        description: data.ncmDescription || data.description || "",
        source: getNcmSourceLabel(data.source),
        matchedCode: data.catalogMatchedCode || "",
        matchType: getNcmMatchLabel(data.catalogMatchType),
        catalogUpdatedAt: data.catalogUpdatedAt || "",
        catalogAct: data.catalogAct || "",
      });
    } catch {
      // Ignore
    } finally {
      setNcmAllocationLoadingIds((prev) => prev.filter((itemId) => itemId !== id));
    }
  }, [fetchNcmTaxes]);

  const handleNcmChange = (value: string) => {
    setNcm(formatNcmCode(value));
    setNcmDescription("");
    setNcmSource("");
    setNcmMatchedCode("");
    setNcmMatchType("");
    setNcmCatalogUpdatedAt("");
    setNcmCatalogAct("");
  };

  useEffect(() => {
    const clean = normalizeNcmCode(ncm);
    if (clean.length < 4) {
      if (clean.length === 0) {
        setNcmDescription("");
        setNcmSource("");
        setNcmMatchedCode("");
        setNcmMatchType("");
        setNcmCatalogUpdatedAt("");
        setNcmCatalogAct("");
      }
      return;
    }

    const timer = window.setTimeout(() => {
      void lookupNCM(clean);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [ncm, lookupNCM]);

  useEffect(() => {
    const timers: number[] = [];

    for (const row of ncmAllocations) {
      const clean = normalizeNcmCode(row.code);
      if (clean.length < 4) {
        if (resolvedNcmAllocationCodes[row.id]) {
          setResolvedNcmAllocationCodes((prev) => {
            const next = { ...prev };
            delete next[row.id];
            return next;
          });
        }
        continue;
      }

      if (resolvedNcmAllocationCodes[row.id] === clean && (row.description || row.source)) {
        continue;
      }

      const timer = window.setTimeout(() => {
        void lookupNcmAllocation(row.id, clean);
      }, 450);
      timers.push(timer);
    }

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [ncmAllocations, lookupNcmAllocation, resolvedNcmAllocationCodes]);

  useEffect(() => {
    let ignore = false;

    const loadSiscomex = async () => {
      setSiscomexLoading(true);
      setSiscomexError("");
      try {
        const res = await fetch(`/api/siscomex?additions=${siscomexAdditions}`);
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error((payload as { error?: string } | null)?.error || "Falha ao carregar Siscomex.");
        }

        const data = (await res.json()) as SiscomexFeeResponse;
        if (!ignore) {
          setSiscomexFee(data);
        }
      } catch (error) {
        if (!ignore) {
          setSiscomexFee(null);
          setSiscomexError(error instanceof Error ? error.message : "Nao foi possivel carregar a taxa Siscomex.");
        }
      } finally {
        if (!ignore) {
          setSiscomexLoading(false);
        }
      }
    };

    void loadSiscomex();

    return () => {
      ignore = true;
    };
  }, [siscomexAdditions]);

  const colors = colorClasses[currentModal.color as keyof typeof colorClasses];

  const simulationSummary = [
    "Simulacao Comex",
    processContext ? `Processo: ${processContext.reference} | ${processContext.clientName}` : null,
    `Modalidade: ${currentModal.label}`,
    `NCM: ${ncm || "nao informado"}`,
    `Cambio (BRL/USD): ${exchangeRate.toFixed(4)}`,
    `CIF USD: ${fmt(calcResult.cif)}`,
    `CIF BRL: ${fmt(calcResult.cifBrl)}`,
    `II: ${fmt(calcResult.ii)}`,
    `IPI: ${fmt(calcResult.ipi)}`,
    `PIS: ${fmt(calcResult.pis)}`,
    `COFINS: ${fmt(calcResult.cofins)}`,
    `ICMS: ${fmt(calcResult.icms)}`,
    `Impostos Totais: ${fmt(calcResult.totalTaxes)}`,
    `Custos Nacionais: ${fmt(calcResult.custosBrasileiros)}`,
    `Custo Total: ${fmt(calcResult.totalCost)}`,
  ].filter(Boolean).join("\n");

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(simulationSummary);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    } catch {
      setCopyFeedback(false);
    }
  };

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

      {processContext ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm dark:border-indigo-900/40 dark:bg-indigo-900/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Contexto do processo
              </p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {processContext.reference}
              </h2>
              <p className="text-sm text-gray-700 dark:text-gray-300">{processContext.clientName}</p>
              <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
                Use este contexto para simular o custo do embarque sem sair do processo.
              </p>
            </div>
            <Link
              to={`/processes/${processContext.id}`}
              className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-900/60 dark:bg-gray-900 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
            >
              Voltar ao processo
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-white/80 px-3 py-2 dark:bg-gray-950/40">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Tipo</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {processContext.processType === "import"
                  ? "Importação"
                  : processContext.processType === "export"
                    ? "Exportação"
                    : "Serviços"}
              </p>
            </div>
            <div className="rounded-lg bg-white/80 px-3 py-2 dark:bg-gray-950/40">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">HS / NCM</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {processContext.hsCode || "Nao informado"}
              </p>
            </div>
            <div className="rounded-lg bg-white/80 px-3 py-2 dark:bg-gray-950/40">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Incoterm</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {processContext.incoterm || "Nao informado"}
              </p>
            </div>
            <div className="rounded-lg bg-white/80 px-3 py-2 dark:bg-gray-950/40">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Valor do processo</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {processContext.currency || "USD"} {processContext.totalValue ? Number(processContext.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}
              </p>
            </div>
          </div>
          {processContext.currency && processContext.currency !== "USD" ? (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
              A calculadora trabalha em base USD. Como este processo está em {processContext.currency}, revise o câmbio antes de fechar a estimativa.
            </p>
          ) : null}
        </div>
      ) : null}

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
          <div className="rounded-xl border border-gray-200 bg-white p-7 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Distribuicao por NCM</h2>
              <Button type="button" variant="outline" size="sm" onClick={addNcmAllocation}>
                <Plus className="h-4 w-4" />
                Adicionar NCM
              </Button>
            </div>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Use quando houver embarque com varios NCMs. Informe o valor de mercadoria por NCM e as taxas II/IPI/PIS/COFINS/ICMS de cada item.
            </p>
            {ncmAllocations.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">Sem distribuicao ativa. O calculo usa a taxa ativa do NCM principal.</p>
            ) : (
              <div className="space-y-2">
                {ncmAllocations.map((row) => {
                  const isLoading = ncmAllocationLoadingIds.includes(row.id);

                  return (
                    <div key={row.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <input
                          type="text"
                          value={row.code}
                          onChange={(e) =>
                            updateNcmAllocation(row.id, {
                              code: formatNcmCode(e.target.value),
                              description: "",
                              source: "",
                              matchedCode: "",
                              matchType: "",
                              catalogUpdatedAt: "",
                              catalogAct: "",
                            })
                          }
                          onBlur={() => void lookupNcmAllocation(row.id, row.code)}
                          placeholder="NCM"
                          className="rounded-lg border border-gray-300 px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.merchandiseValueUsd || ""}
                          onChange={(e) => updateNcmAllocation(row.id, { merchandiseValueUsd: parseFloat(e.target.value) || 0 })}
                          placeholder="Valor USD"
                          className="rounded-lg border border-gray-300 px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.iiRate || ""}
                          onChange={(e) => updateNcmAllocation(row.id, { iiRate: parseFloat(e.target.value) || 0 })}
                          placeholder="II %"
                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.ipiRate || ""}
                          onChange={(e) => updateNcmAllocation(row.id, { ipiRate: parseFloat(e.target.value) || 0 })}
                          placeholder="IPI %"
                          className="rounded-lg border border-gray-300 px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.pisRate || ""}
                          onChange={(e) => updateNcmAllocation(row.id, { pisRate: parseFloat(e.target.value) || 0 })}
                          placeholder="PIS %"
                          className="rounded-lg border border-gray-300 px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.cofinsRate || ""}
                          onChange={(e) => updateNcmAllocation(row.id, { cofinsRate: parseFloat(e.target.value) || 0 })}
                          placeholder="COFINS %"
                          className="rounded-lg border border-gray-300 px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.icmsRate || ""}
                          onChange={(e) => updateNcmAllocation(row.id, { icmsRate: parseFloat(e.target.value) || 0 })}
                          placeholder="ICMS %"
                          className="rounded-lg border border-gray-300 px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => removeNcmAllocation(row.id)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                          title="Remover NCM"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {(isLoading || row.description || row.source || row.matchedCode || row.catalogUpdatedAt) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                          {isLoading && (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Buscando aliquotas estimadas...</span>
                            </>
                          )}
                          {!isLoading && row.description && <span>{row.description}</span>}
                          {!isLoading && row.source && <span>Fonte: {row.source}</span>}
                          {!isLoading && row.matchType && <span>{row.matchType}</span>}
                          {!isLoading && row.matchedCode && <span>Codigo casado: {row.matchedCode}</span>}
                          {!isLoading && row.catalogUpdatedAt && <span>Base: {row.catalogUpdatedAt}</span>}
                          {!isLoading && row.catalogAct && <span>Ato: {row.catalogAct}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-blue-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">Total FOB distribuido</span>
                    <span className="font-mono">USD {fmt(ncmAllocationTotalUsd)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span>FOB principal usado</span>
                    <span className="font-mono">USD {fmt(fobBase)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span>Diferenca vs FOB original</span>
                    <span className={`font-mono ${Math.abs(ncmAllocationDeltaUsd) < 0.01 ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"}`}>
                      USD {fmt(ncmAllocationDeltaUsd)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

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
            {(ncmDescription || ncmMatchedCode || ncmCatalogUpdatedAt) && (
              <div className="mt-3 rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
                {ncmDescription && (
                  <p className="text-xs font-medium text-purple-700 dark:text-purple-400">
                    {ncmDescription}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-purple-600 dark:text-purple-300">
                  {ncmSource && <span>Fonte: {ncmSource}</span>}
                  {ncmMatchType && <span>{ncmMatchType}</span>}
                  {ncmMatchedCode && <span>Código casado: {ncmMatchedCode}</span>}
                  {ncmCatalogUpdatedAt && <span>Base: {ncmCatalogUpdatedAt}</span>}
                  {ncmCatalogAct && <span>Ato: {ncmCatalogAct}</span>}
                </div>
                {ncmSource && (
                  <p className="mt-2 text-xs text-purple-500">
                    Alíquotas preenchidas automaticamente para simulação e continuam editáveis.
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
              <div className="sm:col-span-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-900/10">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Conversao de invoice para USD
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Padronize valores em USD antes de seguir para o custo do embarque.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={convertInvoiceToUsd}
                    disabled={invoiceLoading}
                  >
                    {invoiceLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {invoiceLoading ? "Convertendo..." : "Converter para USD"}
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Moeda da invoice
                    </label>
                    <select
                      value={invoiceCurrency}
                      onChange={(e) => setInvoiceCurrency(e.target.value.toUpperCase())}
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {invoiceCurrencyOptions.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </div>
                  <NumInput
                    label="Valor da invoice"
                    value={invoiceAmount}
                    onChange={setInvoiceAmount}
                    step="0.01"
                  />
                  <NumInput
                    label="Invoice convertida (USD)"
                    value={invoiceConvertedUsd ?? 0}
                    onChange={setInvoiceConvertedUsd}
                    step="0.01"
                    readOnly
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-blue-700 dark:text-blue-300">
                  {invoiceRate ? <span>Taxa aplicada: {invoiceRate.toFixed(4)}</span> : null}
                  {invoiceSource ? <span>Fonte: {invoiceSource}</span> : null}
                  {invoiceError ? <span className="text-red-600 dark:text-red-300">{invoiceError}</span> : null}
                </div>
              </div>
              <NumInput label="Valores Base FOB (USD)" value={fobBase} onChange={setFob} readOnly={hasNcmAllocations} />
              <NumInput
                label="Seguro Internacional (USD)"
                value={insurance}
                onChange={setInsurance}
                step="0.01"
              />
              {/* Taxa de Câmbio com botão PTAX */}
              <div className="sm:col-span-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {i18n.calculator.exchangeRate}
                    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      PTAX BCB
                    </span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchPtax}
                    disabled={ptaxLoading}
                    className="h-7 gap-1.5 text-xs"
                  >
                    {ptaxLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    {ptaxLoading ? "Buscando..." : "Buscar PTAX"}
                  </Button>
                </div>
                <input
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                {ptaxRate && ptaxTimestamp ? (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <BadgeInfo className="h-3 w-3" />
                    PTAX Banco Central: R$ {ptaxRate.toFixed(4)} — usado em cálculos aduaneiros
                    {ptaxSource === "bcb_ptax" && (
                      <span className="ml-1 rounded bg-green-100 px-1 py-0.5 text-[10px] font-semibold dark:bg-green-900/30">
                        BCB oficial
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                    Clique em "Buscar PTAX" para obter a taxa oficial do Banco Central (dólar comercial)
                  </p>
                )}
              </div>
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
                  label="Honorario Despachante (BRL)"
                  value={despachangeAir}
                  onChange={setDespachangeAir}
                />
                <NumInput
                  label="Taxa Siscomex (BRL)"
                  value={siscomexFee?.totalFee ?? siscomexAir}
                  onChange={setSiscomexAir}
                  step="0.01"
                  readOnly
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
                  label="Honorario Despachante (BRL)"
                  value={despachangeLCL}
                  onChange={setDespachangeLCL}
                />
                <NumInput
                  label="Taxa Siscomex (BRL)"
                  value={siscomexFee?.totalFee ?? siscomexLCL}
                  onChange={setSiscomexLCL}
                  step="0.01"
                  readOnly
                />
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
                  label="Dias de Free Time"
                  value={demurrageDays}
                  onChange={setDemurrageDays}
                  step="1"
                />
                <NumInput
                  label="Honorario Despachante (BRL)"
                  value={despachangeFCL}
                  onChange={setDespachangeFCL}
                />
                <NumInput
                  label="Taxa Siscomex (BRL)"
                  value={siscomexFee?.totalFee ?? siscomexFCL}
                  onChange={setSiscomexFCL}
                  step="0.01"
                  readOnly
                />
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

          <div className="flex justify-start">
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              {i18n.calculator.reset}
            </Button>
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
            {calcResult.hasNcmAllocation && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                Multi-NCM ativo
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

          <div className="mt-3">
            <Button type="button" variant="outline" size="sm" onClick={handleCopySummary}>
              <Copy className="h-4 w-4" />
              {copyFeedback ? "Resumo copiado" : "Copiar resumo"}
            </Button>
          </div>
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
  readOnly = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  readOnly?: boolean;
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
        readOnly={readOnly}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 ${
          readOnly ? "cursor-not-allowed bg-gray-50 text-gray-500 dark:bg-gray-900/50 dark:text-gray-400" : ""
        }`}
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
