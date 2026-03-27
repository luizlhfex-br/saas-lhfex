export type PersonalNewsTopic = "ai" | "bh" | "world" | "comex";

export type NewsSourceSeed = {
  topic: PersonalNewsTopic;
  name: string;
  query: string;
  sourceUrl?: string;
  maxItems?: number;
  priority?: number;
};

export const PERSONAL_NEWS_TOPIC_META: Record<
  PersonalNewsTopic,
  { label: string; emoji: string; description: string }
> = {
  ai: {
    label: "IA / LLM / AI",
    emoji: "AI",
    description: "Modelos, produtos, releases e movimentos que realmente importam.",
  },
  bh: {
    label: "BH e agenda local",
    emoji: "BH",
    description: "Exposicoes, corridas, teatro, cinema, feiras e eventos gratuitos em Belo Horizonte.",
  },
  world: {
    label: "Mundo essencial",
    emoji: "GL",
    description: "Poucas noticias globais, filtradas pelo impacto real.",
  },
  comex: {
    label: "Comercio exterior",
    emoji: "CX",
    description: "Tributacao, NCM, licencas, importacao, exportacao, frete e medidas do governo.",
  },
};

export const DEFAULT_PERSONAL_NEWS_SOURCES: NewsSourceSeed[] = [
  {
    topic: "ai",
    name: "Radar IA e LLM",
    query: "inteligencia artificial OR LLM OR OpenAI OR Gemini OR Anthropic",
    sourceUrl: "https://news.google.com",
    maxItems: 4,
    priority: 1,
  },
  {
    topic: "ai",
    name: "Produtos e releases de IA",
    query: "AI release OR modelo novo OR copiloto OR agente de IA",
    sourceUrl: "https://news.google.com",
    maxItems: 3,
    priority: 2,
  },
  {
    topic: "bh",
    name: "Agenda cultural BH",
    query: "\"Belo Horizonte\" exposicao OR teatro OR cinema OR feira OR evento gratuito",
    sourceUrl: "https://news.google.com",
    maxItems: 4,
    priority: 1,
  },
  {
    topic: "bh",
    name: "Corridas e eventos em BH",
    query: "\"Belo Horizonte\" corrida OR caminhada OR festival OR agenda",
    sourceUrl: "https://news.google.com",
    maxItems: 3,
    priority: 2,
  },
  {
    topic: "world",
    name: "Mundo relevante",
    query: "economia global OR geopolitica OR tecnologia OR mercado internacional",
    sourceUrl: "https://news.google.com",
    maxItems: 4,
    priority: 1,
  },
  {
    topic: "comex",
    name: "Radar Comex",
    query: "\"comercio exterior\" OR importacao OR exportacao OR NCM OR aliquota OR extarifario",
    sourceUrl: "https://news.google.com",
    maxItems: 5,
    priority: 1,
  },
  {
    topic: "comex",
    name: "Tributacao e DUIMP",
    query: "DUIMP OR Siscomex OR Receita Federal importacao OR CAMEX OR MDIC",
    sourceUrl: "https://news.google.com",
    maxItems: 4,
    priority: 2,
  },
];
