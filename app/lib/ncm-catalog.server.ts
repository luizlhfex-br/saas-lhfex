import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

type RawNcmEntry = {
  Codigo: string;
  Descricao: string;
  Data_Inicio: string;
  Data_Fim: string;
  Tipo_Ato_Ini: string;
  Numero_Ato_Ini: string;
  Ano_Ato_Ini: string;
};

type RawNcmCatalog = {
  Data_Ultima_Atualizacao_NCM: string;
  Ato: string;
  Nomenclaturas: RawNcmEntry[];
};

export type NcmCatalogEntry = {
  code: string;
  codeDigits: string;
  description: string;
  startDate: string;
  endDate: string;
  initialActType: string;
  initialActNumber: string;
  initialActYear: string;
};

export type NcmCatalogLookupResult = {
  entry: NcmCatalogEntry;
  matchType: "exact" | "parent";
  sourceFile: string;
  updatedAt: string;
  act: string;
};

type LoadedCatalog = {
  sourceFile: string;
  sourceMtimeMs: number;
  updatedAt: string;
  act: string;
  entries: NcmCatalogEntry[];
  entriesByDigits: Map<string, NcmCatalogEntry>;
};

const NCM_DATA_DIR = path.join(process.cwd(), "data", "ncm");

let cachedCatalog: LoadedCatalog | null = null;

function normalizeNcmCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

async function resolveLatestCatalogFile() {
  let files: string[];

  try {
    files = await readdir(NCM_DATA_DIR);
  } catch {
    return null;
  }

  const candidates = await Promise.all(
    files
      .filter((fileName) => fileName.toLowerCase().endsWith(".json"))
      .map(async (fileName) => {
        const fullPath = path.join(NCM_DATA_DIR, fileName);
        const fileStat = await stat(fullPath);

        return {
          fileName,
          fullPath,
          mtimeMs: fileStat.mtimeMs,
        };
      })
  );

  candidates.sort((left, right) => {
    if (right.mtimeMs !== left.mtimeMs) {
      return right.mtimeMs - left.mtimeMs;
    }

    return right.fileName.localeCompare(left.fileName, "pt-BR");
  });

  return candidates[0] ?? null;
}

async function loadCatalog(): Promise<LoadedCatalog | null> {
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

  let parsed: RawNcmCatalog;

  try {
    const rawContent = await readFile(latestFile.fullPath, "utf-8");
    parsed = JSON.parse(rawContent) as RawNcmCatalog;
  } catch {
    return null;
  }

  const entries = parsed.Nomenclaturas.map((item) => ({
    code: item.Codigo,
    codeDigits: normalizeNcmCode(item.Codigo),
    description: item.Descricao,
    startDate: item.Data_Inicio,
    endDate: item.Data_Fim,
    initialActType: item.Tipo_Ato_Ini,
    initialActNumber: item.Numero_Ato_Ini,
    initialActYear: item.Ano_Ato_Ini,
  })).filter((item) => item.codeDigits.length > 0);

  const entriesByDigits = new Map(entries.map((entry) => [entry.codeDigits, entry]));

  cachedCatalog = {
    sourceFile: latestFile.fullPath,
    sourceMtimeMs: latestFile.mtimeMs,
    updatedAt: parsed.Data_Ultima_Atualizacao_NCM,
    act: parsed.Ato,
    entries,
    entriesByDigits,
  };

  return cachedCatalog;
}

export async function findNcmCatalogEntry(code: string): Promise<NcmCatalogLookupResult | null> {
  const cleanCode = normalizeNcmCode(code);
  if (cleanCode.length === 0) {
    return null;
  }

  const catalog = await loadCatalog();
  if (!catalog) {
    return null;
  }

  const exactEntry = catalog.entriesByDigits.get(cleanCode);
  if (exactEntry) {
    return {
      entry: exactEntry,
      matchType: "exact",
      sourceFile: catalog.sourceFile,
      updatedAt: catalog.updatedAt,
      act: catalog.act,
    };
  }

  for (let length = cleanCode.length - 1; length >= 2; length -= 1) {
    const parentEntry = catalog.entriesByDigits.get(cleanCode.slice(0, length));
    if (parentEntry) {
      return {
        entry: parentEntry,
        matchType: "parent",
        sourceFile: catalog.sourceFile,
        updatedAt: catalog.updatedAt,
        act: catalog.act,
      };
    }
  }

  return null;
}
