import type { Route } from "./+types/ex-tarifarios";
import { requireAuth } from "~/lib/auth.server";
import { Link } from "react-router";
import { ExternalLink, FileText, RefreshCw } from "lucide-react";

const SOURCE_URL = "https://www.gov.br/mdic/pt-br/assuntos/sdic/ex-tarifario/estatisticas/ex-tarifarios-vigentes";

type SourceItem = {
  title: string;
  url: string;
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  try {
    const res = await fetch(SOURCE_URL, {
      headers: { "User-Agent": "LHFEX-SaaS/1.0" },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return {
        sourceUrl: SOURCE_URL,
        loadedAt: new Date().toISOString(),
        items: [] as SourceItem[],
        error: "Nao foi possivel consultar a pagina oficial no momento.",
      };
    }

    const html = await res.text();
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    const items: SourceItem[] = [];
    let match: RegExpExecArray | null = null;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1] || "";
      const rawText = match[2] || "";
      const title = rawText.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (!title) continue;
      if (!/ex-tarif|ex tarif|estatistica|planilha|vigente/i.test(title)) continue;

      const url = href.startsWith("http") ? href : new URL(href, SOURCE_URL).toString();
      if (!items.some((it) => it.url === url)) {
        items.push({ title, url });
      }
      if (items.length >= 15) break;
    }

    return {
      sourceUrl: SOURCE_URL,
      loadedAt: new Date().toISOString(),
      items,
      error: null as string | null,
    };
  } catch {
    return {
      sourceUrl: SOURCE_URL,
      loadedAt: new Date().toISOString(),
      items: [] as SourceItem[],
      error: "Falha ao consultar a fonte oficial de Ex-Tarifarios.",
    };
  }
}

export default function ExTarifariosPage({ loaderData }: Route.ComponentProps) {
  const { sourceUrl, loadedAt, items, error } = loaderData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ex-Tarifarios</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Fonte oficial MDIC com atalhos para dados vigentes.
          </p>
        </div>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Abrir fonte oficial
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizado em {new Date(loadedAt).toLocaleString("pt-BR")}
        </p>
        {error && (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Links Encontrados</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nenhum link relevante foi identificado automaticamente. Use o botao "Abrir fonte oficial".
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <span>{item.title}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="text-sm">
        <Link to="/ncm" className="text-indigo-600 hover:underline dark:text-indigo-400">
          Ir para Classificador NCM
        </Link>
      </div>
    </div>
  );
}
