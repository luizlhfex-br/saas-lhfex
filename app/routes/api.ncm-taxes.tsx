import type { Route } from "./+types/api.ncm-taxes";
import { requireAuth } from "~/lib/auth.server";

// Common NCM tax rates (TEC - Tarifa Externa Comum)
// Format: [II%, IPI%, PIS%, COFINS%]
// Source: TEC/TIPI tables. These are the most common rates.
const NCM_TAX_TABLE: Record<string, { ii: number; ipi: number; pis: number; cofins: number; description?: string }> = {
  // Electronics
  "8471": { ii: 0, ipi: 0, pis: 2.10, cofins: 9.65, description: "Computadores e periféricos" },
  "8473": { ii: 12, ipi: 0, pis: 2.10, cofins: 9.65, description: "Partes de computadores" },
  "8517": { ii: 0, ipi: 0, pis: 2.10, cofins: 9.65, description: "Celulares e equipamentos de telecomunicações" },
  "8528": { ii: 20, ipi: 15, pis: 2.10, cofins: 9.65, description: "Monitores e projetores" },
  "8443": { ii: 0, ipi: 0, pis: 2.10, cofins: 9.65, description: "Impressoras" },
  // Auto parts
  "8708": { ii: 14, ipi: 5, pis: 2.10, cofins: 9.65, description: "Partes de veículos" },
  "8409": { ii: 14, ipi: 5, pis: 2.10, cofins: 9.65, description: "Partes de motores" },
  "4011": { ii: 16, ipi: 5, pis: 2.10, cofins: 9.65, description: "Pneus novos" },
  // Textiles
  "6109": { ii: 35, ipi: 0, pis: 2.10, cofins: 9.65, description: "Camisetas de malha" },
  "6110": { ii: 35, ipi: 0, pis: 2.10, cofins: 9.65, description: "Suéteres e pulôveres" },
  "6203": { ii: 35, ipi: 0, pis: 2.10, cofins: 9.65, description: "Ternos e calças masculinos" },
  // Food
  "0901": { ii: 10, ipi: 0, pis: 1.65, cofins: 7.60, description: "Café" },
  "2204": { ii: 27, ipi: 10, pis: 2.10, cofins: 9.65, description: "Vinhos" },
  "2208": { ii: 20, ipi: 30, pis: 2.10, cofins: 9.65, description: "Bebidas destiladas" },
  // Machinery
  "8421": { ii: 14, ipi: 0, pis: 2.10, cofins: 9.65, description: "Centrifugadoras e filtros" },
  "8422": { ii: 14, ipi: 5, pis: 2.10, cofins: 9.65, description: "Máquinas de lavar louça" },
  "8450": { ii: 20, ipi: 10, pis: 2.10, cofins: 9.65, description: "Máquinas de lavar roupa" },
  "8418": { ii: 20, ipi: 15, pis: 2.10, cofins: 9.65, description: "Refrigeradores e freezers" },
  // Chemicals
  "3004": { ii: 0, ipi: 0, pis: 2.10, cofins: 9.65, description: "Medicamentos" },
  "3304": { ii: 18, ipi: 22, pis: 2.10, cofins: 9.65, description: "Cosméticos" },
  "3808": { ii: 14, ipi: 5, pis: 2.10, cofins: 9.65, description: "Inseticidas e herbicidas" },
  // Plastics
  "3923": { ii: 16, ipi: 5, pis: 2.10, cofins: 9.65, description: "Embalagens plásticas" },
  "3926": { ii: 18, ipi: 5, pis: 2.10, cofins: 9.65, description: "Artigos de plástico" },
  // Metals
  "7210": { ii: 12, ipi: 5, pis: 2.10, cofins: 9.65, description: "Chapas de aço" },
  "7304": { ii: 14, ipi: 5, pis: 2.10, cofins: 9.65, description: "Tubos de aço" },
  "7606": { ii: 12, ipi: 5, pis: 2.10, cofins: 9.65, description: "Chapas de alumínio" },
  // Paper
  "4802": { ii: 12, ipi: 5, pis: 2.10, cofins: 9.65, description: "Papel não revestido" },
  "4819": { ii: 16, ipi: 5, pis: 2.10, cofins: 9.65, description: "Caixas de papel/cartão" },
};

// Cache for BrasilAPI NCM descriptions
const descriptionCache = new Map<string, { description: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function fetchNCMDescription(code: string): Promise<string | null> {
  const cached = descriptionCache.get(code);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.description;
  }

  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/ncm/v1?search=${encodeURIComponent(code)}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data && data.length > 0) {
      const desc = data[0].descricao || data[0].description || "";
      descriptionCache.set(code, { description: desc, timestamp: Date.now() });
      return desc;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.replace(/[.\s-]/g, "") || "";

  if (!code || code.length < 4) {
    return Response.json({ error: "NCM deve ter pelo menos 4 dígitos" }, { status: 400 });
  }

  // Try exact match first (4, 6, or 8 digits), then try prefix matches
  const prefixes = [code.slice(0, 8), code.slice(0, 6), code.slice(0, 4)];
  let taxes = null;

  for (const prefix of prefixes) {
    if (NCM_TAX_TABLE[prefix]) {
      taxes = NCM_TAX_TABLE[prefix];
      break;
    }
  }

  // Fetch description from BrasilAPI
  const ncmDescription = await fetchNCMDescription(code);

  if (taxes) {
    return Response.json({
      code,
      ...taxes,
      ncmDescription: ncmDescription || taxes.description || null,
      source: "tec_table",
    }, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  }

  // No match — return defaults with description if available
  return Response.json({
    code,
    ii: 14,
    ipi: 0,
    pis: 2.10,
    cofins: 9.65,
    ncmDescription: ncmDescription || null,
    description: "Alíquotas padrão — verifique na TEC/TIPI",
    source: "default",
  }, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
