import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

type RawSiscomexRow = {
  upToAdditions: number;
  totalFee: number;
};

type RawSiscomexCatalog = {
  updatedAt: string;
  source: string;
  rows: RawSiscomexRow[];
};

type SiscomexCatalogRow = {
  upToAdditions: number;
  totalFee: number;
};

type LoadedSiscomexCatalog = {
  sourceFile: string;
  sourceMtimeMs: number;
  updatedAt: string;
  source: string;
  rows: SiscomexCatalogRow[];
};

export type SiscomexFeeResult = {
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

const SISCOMEX_DATA_DIR = path.join(process.cwd(), "data", "siscomex");

let cachedCatalog: LoadedSiscomexCatalog | null = null;

async function resolveLatestCatalogFile() {
  let files: string[];

  try {
    files = await readdir(SISCOMEX_DATA_DIR);
  } catch {
    return null;
  }

  const candidates = await Promise.all(
    files
      .filter((fileName) => fileName.toLowerCase().endsWith(".json"))
      .map(async (fileName) => {
        const fullPath = path.join(SISCOMEX_DATA_DIR, fileName);
        const fileStat = await stat(fullPath);
        return {
          fileName,
          fullPath,
          mtimeMs: fileStat.mtimeMs,
        };
      }),
  );

  candidates.sort((left, right) => {
    if (right.mtimeMs !== left.mtimeMs) {
      return right.mtimeMs - left.mtimeMs;
    }

    return right.fileName.localeCompare(left.fileName, "pt-BR");
  });

  return candidates[0] ?? null;
}

async function loadCatalog(): Promise<LoadedSiscomexCatalog | null> {
  const latestFile = await resolveLatestCatalogFile();
  if (!latestFile) {
    return null;
  }

  if (
    cachedCatalog &&
    cachedCatalog.sourceFile === latestFile.fullPath &&
    cachedCatalog.sourceMtimeMs === latestFile.mtimeMs
  ) {
    return cachedCatalog;
  }

  let parsed: RawSiscomexCatalog;

  try {
    const rawContent = await readFile(latestFile.fullPath, "utf-8");
    parsed = JSON.parse(rawContent) as RawSiscomexCatalog;
  } catch {
    return null;
  }

  const rows = parsed.rows
    .map((row) => ({
      upToAdditions: Math.max(0, Math.floor(Number(row.upToAdditions) || 0)),
      totalFee: Number(row.totalFee) || 0,
    }))
    .filter((row) => Number.isFinite(row.totalFee))
    .sort((left, right) => left.upToAdditions - right.upToAdditions);

  if (rows.length === 0) {
    return null;
  }

  cachedCatalog = {
    sourceFile: latestFile.fullPath,
    sourceMtimeMs: latestFile.mtimeMs,
    updatedAt: parsed.updatedAt,
    source: parsed.source,
    rows,
  };

  return cachedCatalog;
}

export async function resolveSiscomexFee(additions: number): Promise<SiscomexFeeResult | null> {
  const normalized = Math.max(0, Math.floor(Number(additions) || 0));
  const catalog = await loadCatalog();
  if (!catalog) {
    return null;
  }

  const capped = normalized > catalog.rows[catalog.rows.length - 1].upToAdditions;
  const matchedRow =
    catalog.rows.find((row) => row.upToAdditions >= normalized) ?? catalog.rows[catalog.rows.length - 1];
  const matchedIndex = catalog.rows.findIndex((row) => row.upToAdditions === matchedRow.upToAdditions);
  const previousTotal =
    matchedIndex > 0 ? catalog.rows[matchedIndex - 1]?.totalFee ?? 0 : 0;
  const additionalFee = matchedRow.upToAdditions === 0 ? 0 : Math.max(0, matchedRow.totalFee - previousTotal);

  return {
    additions: normalized,
    rowLabel:
      matchedRow.upToAdditions === 0
        ? "Taxa de registro DI"
        : capped
          ? `Tabela limite (${catalog.rows[catalog.rows.length - 1].upToAdditions}+ adicoes)`
          : `Ate ${String(matchedRow.upToAdditions).padStart(3, "0")} adicao(oes)`,
    registrationFee: catalog.rows[0]?.totalFee ?? 115.67,
    additionalFee,
    totalFee: matchedRow.totalFee,
    sourceFile: catalog.sourceFile,
    updatedAt: catalog.updatedAt,
    source: catalog.source,
    capped,
  };
}
