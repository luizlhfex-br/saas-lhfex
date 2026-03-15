import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

type ModelConfig = {
  primary?: string;
  fallbacks?: string[];
};

type OpenClawConfig = {
  agents?: {
    defaults?: {
      model?: ModelConfig;
    };
    list?: Array<{
      id: string;
      workspace?: string;
      model?: ModelConfig;
    }>;
  };
  skills?: {
    entries?: Record<string, { enabled?: boolean }>;
  };
};

type SkillMeta = {
  label: string;
  description: string;
  type: "built-in" | "local";
  alignedAgents: string[];
};

export type OpenClawSkillOverview = SkillMeta & {
  id: string;
  enabled: boolean;
};

export type OpenClawAgentOverview = {
  id: string;
  name: string;
  emoji: string;
  role: string;
  primaryModel: string;
  fallbacks: string[];
  alignedSkills: string[];
};

export type OpenClawOverview = {
  primaryModel: string;
  fallbackModels: string[];
  agents: OpenClawAgentOverview[];
  skills: OpenClawSkillOverview[];
};

const OPENCLAW_ROOT = path.join(process.cwd(), "openclaw-gateway");
const CONFIG_PATH = path.join(OPENCLAW_ROOT, "openclaw.json");
const AGENTS_DIR = path.join(OPENCLAW_ROOT, "prompts", "agents");
const SKILLS_DIR = path.join(OPENCLAW_ROOT, "prompts", "skills");

const builtInSkillMeta: Record<string, SkillMeta> = {
  "web-search": {
    label: "Web Search",
    description: "Busca e leitura da web para pesquisa operacional e tecnica.",
    type: "built-in",
    alignedAgents: ["airton", "iana", "mai", "iara", "julia"],
  },
  "file-ops": {
    label: "File Ops",
    description: "Leitura e escrita de arquivos no workspace do gateway.",
    type: "built-in",
    alignedAgents: ["airton", "iago", "maria", "sofia"],
  },
  reminders: {
    label: "Reminders",
    description: "Lembretes e agendamentos de acompanhamento.",
    type: "built-in",
    alignedAgents: ["sofia", "julia", "maria", "mai"],
  },
  qmd: {
    label: "QMD",
    description: "Compactacao de contexto e memoria com menor consumo de tokens.",
    type: "built-in",
    alignedAgents: ["airton", "iago", "iana", "maria", "iara", "sofia", "mai", "julia"],
  },
};

const localSkillMeta: Record<string, SkillMeta> = {
  SAAS: {
    label: "SAAS",
    description: "Leitura e operacao dos dados do SaaS via tools autenticadas.",
    type: "local",
    alignedAgents: ["airton", "iana", "maria", "iago", "sofia", "mai", "julia"],
  },
  diagnostico: {
    label: "Diagnostico",
    description: "Protocolo de debug para runtime, deploy e incidentes do gateway.",
    type: "local",
    alignedAgents: ["iago", "airton"],
  },
  "lhfex-comex-expert": {
    label: "LHFEX Comex Expert",
    description: "NCM, RGI, DI, DUIMP, Incoterms e tributos com base normativa.",
    type: "local",
    alignedAgents: ["iana", "airton"],
  },
  "lhfex-licitacoes": {
    label: "LHFEX Licitacoes",
    description: "PNCP, Lei 14.133/2021, edital e checklist de habilitacao.",
    type: "local",
    alignedAgents: ["mai", "airton", "sofia"],
  },
  "lhfex-promocoes": {
    label: "LHFEX Promocoes",
    description: "Leitura de promocoes, prazos, participacoes e alertas de vencimento.",
    type: "local",
    alignedAgents: ["julia", "sofia", "iara"],
  },
};

const fallbackAgentMeta: Record<string, Pick<OpenClawAgentOverview, "name" | "emoji" | "role">> = {
  airton: { name: "AIrton", emoji: "💻", role: "Dev Lead da LHFEX" },
  iana: { name: "IAna", emoji: "📦", role: "Especialista em Comercio Exterior" },
  maria: { name: "marIA", emoji: "💰", role: "Gestora Financeira" },
  iago: { name: "IAgo", emoji: "🔧", role: "Engenheiro de Infra" },
  iara: { name: "IAra", emoji: "🎨", role: "Especialista em Marketing e Design" },
  sofia: { name: "SofIA", emoji: "🤝", role: "Gerente de Relacionamento" },
  mai: { name: "mAI", emoji: "🏛️", role: "Especialista em Compras Publicas" },
  julia: { name: "JULia", emoji: "🎁", role: "Especialista em Promocoes e Monitoramento" },
};

function parseIdentityField(source: string, label: string) {
  const regex = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, "i");
  return source.match(regex)?.[1]?.trim() ?? null;
}

async function readOpenClawConfig(): Promise<OpenClawConfig> {
  const raw = await readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as OpenClawConfig;
}

async function readLocalSkillIds() {
  const files = await readdir(SKILLS_DIR, { withFileTypes: true });
  return files
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name.replace(/\.md$/i, ""));
}

async function readAgentIdentity(agentId: string) {
  const fallback = fallbackAgentMeta[agentId] ?? {
    name: agentId,
    emoji: "🤖",
    role: "Especialista OpenClaw",
  };

  try {
    const content = await readFile(path.join(AGENTS_DIR, agentId, "IDENTITY.md"), "utf-8");
    return {
      name: parseIdentityField(content, "Nome") ?? fallback.name,
      emoji: parseIdentityField(content, "Emoji") ?? fallback.emoji,
      role: parseIdentityField(content, "Funcao") ?? fallback.role,
    };
  } catch {
    return fallback;
  }
}

export async function getOpenClawOverview(): Promise<OpenClawOverview> {
  const config = await readOpenClawConfig();
  const defaultModel = config.agents?.defaults?.model ?? {};

  const builtInSkills = Object.entries(config.skills?.entries ?? {})
    .filter(([, entry]) => entry?.enabled)
    .map(([id]) => {
      const meta = builtInSkillMeta[id] ?? {
        label: id,
        description: "Skill built-in ativa no runtime do OpenClaw.",
        type: "built-in" as const,
        alignedAgents: [],
      };

      return {
        id,
        enabled: true,
        ...meta,
      };
    });

  const localSkills = (await readLocalSkillIds()).map((id) => {
    const meta = localSkillMeta[id] ?? {
      label: id,
      description: "Skill local carregada do workspace do OpenClaw.",
      type: "local" as const,
      alignedAgents: [],
    };

    return {
      id,
      enabled: true,
      ...meta,
    };
  });

  const skills = [...builtInSkills, ...localSkills].sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
  const configuredAgents = config.agents?.list ?? [];

  const agents = await Promise.all(
    configuredAgents.map(async (agent) => {
      const identity = await readAgentIdentity(agent.id);
      const model = agent.model ?? defaultModel;

      return {
        id: agent.id,
        name: identity.name,
        emoji: identity.emoji,
        role: identity.role,
        primaryModel: model.primary ?? defaultModel.primary ?? "vertex/gemini-2.0-flash",
        fallbacks: model.fallbacks ?? defaultModel.fallbacks ?? [],
        alignedSkills: skills
          .filter((skill) => skill.alignedAgents.includes(agent.id))
          .map((skill) => skill.id),
      };
    })
  );

  return {
    primaryModel: defaultModel.primary ?? "vertex/gemini-2.0-flash",
    fallbackModels: defaultModel.fallbacks ?? [],
    agents,
    skills,
  };
}
