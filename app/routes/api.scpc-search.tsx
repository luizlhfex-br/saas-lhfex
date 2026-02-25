/**
 * SCPC Search Proxy
 *
 * Proxy server-side para a API pública do SCPC (SERPRO):
 * Sistema de Controle de Promoções Comerciais do governo federal brasileiro.
 *
 * Evita CORS e faz o mapeamento para o formato local de promoções.
 *
 * GET /api/scpc-search?ano=2026&uf=MG&modalidade=Sorteio&nome=promo
 */

import { data } from "react-router";
import type { Route } from "./+types/api.scpc-search";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { promotions } from "../../drizzle/schema/personal-life";
import { eq, isNull, and, inArray } from "drizzle-orm";

const SCPC_BASE = "https://api.scpc.estaleiro.serpro.gov.br/v1/promocao-comercial/export/json";

// Mapeamento de modalidade SCPC → tipo local
function mapModalidade(modalidade: string): string {
  const m = modalidade.toLowerCase();
  if (m.includes("sorteio")) return "raffle";
  if (m.includes("concurso")) return "contest";
  if (m.includes("vale-brinde") || m.includes("vale brinde")) return "giveaway";
  return "other";
}

// Converte ISO timestamp para YYYY-MM-DD
function isoToDate(iso: string | null): string {
  if (!iso) return new Date().toISOString().slice(0, 10);
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Monta descrição do prêmio a partir dos dados SCPC
function buildPrize(item: ScpcItem): string {
  try {
    const premios = item.apuracoes?.[0]?.premios;
    if (premios && premios.length > 0) {
      const top = premios[0];
      const qtd = top.quantidade > 1 ? `${top.quantidade}x ` : "";
      const val = item.valorTotal ? ` — R$${Number(item.valorTotal).toLocaleString("pt-BR")}` : "";
      return `${qtd}${top.descricao}${val}`;
    }
    if (item.valorTotal) {
      return `R$${Number(item.valorTotal).toLocaleString("pt-BR")} em prêmios`;
    }
  } catch { /* fallback */ }
  return "";
}

interface ScpcPremio {
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface ScpcApuracao {
  premios?: ScpcPremio[];
}

interface ScpcMandatario {
  cnpj: string;
  nomeFantasia?: string;
  razaoSocial?: string;
}

interface ScpcItem {
  numeroPromocao: string;
  nome: string;
  modalidade: string;
  numeroCA: string;
  situacao: string;
  dataInicio: string;
  dataFim: string;
  valorTotal: number;
  abrangencia: string;
  mandatario: ScpcMandatario;
  apuracoes?: ScpcApuracao[];
}

export interface ScpcPromoMapeada {
  externalId: string;
  name: string;
  company: string;
  type: string;
  startDate: string;
  endDate: string;
  prize: string;
  situacao: string;
  abrangencia: string;
  valorTotal: number;
  alreadyImported: boolean;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const url = new URL(request.url);

  const ano = url.searchParams.get("ano") || String(new Date().getFullYear());
  const uf = url.searchParams.get("uf") || "";
  const modalidade = url.searchParams.get("modalidade") || "";
  const nome = url.searchParams.get("nome") || "";

  // Monta URL da API SCPC
  const scpcUrl = new URL(SCPC_BASE);
  scpcUrl.searchParams.set("anoPromocao", ano);
  if (uf) scpcUrl.searchParams.set("uf", uf);
  if (modalidade) scpcUrl.searchParams.set("modalidade", modalidade);
  if (nome) scpcUrl.searchParams.set("nomePromocao", nome);

  try {
    const res = await fetch(scpcUrl.toString(), {
      signal: AbortSignal.timeout(15000),
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      return data({ error: `SCPC API retornou status ${res.status}` }, { status: 502 });
    }

    const items: ScpcItem[] = await res.json();

    // Limita a 50 resultados para não sobrecarregar a UI
    const limited = items.slice(0, 50);

    // Verifica quais já foram importados pelo usuário
    const externalIds = limited.map((i) => i.numeroCA).filter(Boolean);
    let importedIds = new Set<string>();

    if (externalIds.length > 0) {
      const existentes = await db
        .select({ externalId: promotions.externalId })
        .from(promotions)
        .where(
          and(
            eq(promotions.userId, user.id),
            isNull(promotions.deletedAt),
            inArray(promotions.externalId, externalIds)
          )
        );
      importedIds = new Set(existentes.map((e) => e.externalId ?? ""));
    }

    // Mapeia para formato local
    const mapeadas: ScpcPromoMapeada[] = limited.map((item) => ({
      externalId: item.numeroCA,
      name: item.nome,
      company:
        item.mandatario?.nomeFantasia ||
        item.mandatario?.razaoSocial ||
        "Empresa não informada",
      type: mapModalidade(item.modalidade),
      startDate: isoToDate(item.dataInicio),
      endDate: isoToDate(item.dataFim),
      prize: buildPrize(item),
      situacao: item.situacao || "",
      abrangencia: item.abrangencia || "",
      valorTotal: item.valorTotal || 0,
      alreadyImported: importedIds.has(item.numeroCA),
    }));

    return data({
      results: mapeadas,
      total: items.length,
      showing: limited.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[SCPC] Fetch error:", msg);
    return data({ error: `Falha ao consultar SCPC: ${msg}` }, { status: 502 });
  }
}
