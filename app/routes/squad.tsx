import type { Route } from "./+types/squad";
import { requireAuth } from "~/lib/auth.server";

const squadAgents = [
  {
    id: "openclaw",
    name: "Hermes Agent",
    emoji: "🤖",
    role: "Chief of Staff",
    description: "Coordena a operação, carrega contexto do SaaS e distribui a tarefa para o agente certo.",
    tone: "from-cyan-400/30 to-sky-500/10 border-cyan-400/40 shadow-cyan-500/20",
  },
  {
    id: "airton",
    name: "AIrton",
    emoji: "💻",
    role: "Dev Lead",
    description: "Código, arquitetura, testes, refactor, typecheck e qualidade técnica do produto.",
    tone: "from-blue-400/30 to-indigo-500/10 border-blue-400/40 shadow-blue-500/20",
  },
  {
    id: "iara",
    name: "IAra",
    emoji: "🎨",
    role: "Marketing + Design",
    description: "Copy, visual, landing pages, SEO, CRO e direção criativa para a marca.",
    tone: "from-fuchsia-400/30 to-pink-500/10 border-fuchsia-400/40 shadow-fuchsia-500/20",
  },
  {
    id: "maria",
    name: "marIA",
    emoji: "💰",
    role: "Financeiro + Câmbio",
    description: "PTAX, DRE, fluxo de caixa, custos e impacto financeiro das operações.",
    tone: "from-amber-300/30 to-orange-500/10 border-amber-300/40 shadow-amber-500/20",
  },
  {
    id: "iana",
    name: "IAna",
    emoji: "📦",
    role: "Comex Specialist",
    description: "NCM, RGI 1 e 6, DI, DUIMP, impostos, Incoterms e compliance aduaneiro.",
    tone: "from-emerald-300/30 to-green-500/10 border-emerald-300/40 shadow-emerald-500/20",
  },
  {
    id: "mai",
    name: "mAI",
    emoji: "🏛️",
    role: "Licitações",
    description: "PNCP, leitura de edital, checklist de habilitação e proposta técnica.",
    tone: "from-yellow-200/30 to-lime-500/10 border-yellow-200/40 shadow-yellow-500/20",
  },
  {
    id: "iago",
    name: "IAgo",
    emoji: "🔧",
    role: "Infra + Deploy",
    description: "Hostinger, Docker, Coolify, SSH, logs e estabilidade operacional.",
    tone: "from-violet-300/30 to-purple-500/10 border-violet-300/40 shadow-violet-500/20",
  },
  {
    id: "sofia",
    name: "SofIA",
    emoji: "🤝",
    role: "CRM + Atendimento",
    description: "Onboarding, propostas, follow-up comercial e relacionamento com clientes.",
    tone: "from-rose-300/30 to-red-500/10 border-rose-300/40 shadow-rose-500/20",
  },
  {
    id: "julia",
    name: "JULia",
    emoji: "🎁",
    role: "Promoções + Monitor",
    description: "Oportunidades, vigência, alertas de encerramento e relatórios de promoções.",
    tone: "from-teal-300/30 to-cyan-500/10 border-teal-300/40 shadow-teal-500/20",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  return { user };
}

export default function SquadPage() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-[#050816] p-6 text-slate-100 shadow-[0_30px_80px_rgba(2,6,23,0.55)] md:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.14),transparent_28%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="absolute inset-x-6 top-24 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />

      <div className="relative space-y-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200">
            Pixel Room
          </div>
          <div className="space-y-3">
            <h1 className="font-mono text-3xl font-bold uppercase tracking-[0.18em] text-white md:text-4xl">
              /squad
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
              Sala de guerra da LHFEX. Cada card representa um agente fixo do ecossistema, com função clara e especialidade definida.
            </p>
          </div>
          <pre className="overflow-x-auto rounded-2xl border border-slate-800 bg-black/30 p-4 font-mono text-[11px] leading-5 text-cyan-200 md:text-xs">
{`[ HERMES CORE ]
  |-- AIrton  | codigo
  |-- IAna    | comex
  |-- marIA   | financeiro
  |-- IAgo    | infra
  |-- IAra    | design
  |-- SofIA   | atendimento
  |-- mAI     | licitacoes
  '-- JULia   | promocoes`}
          </pre>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {squadAgents.map((agent, index) => (
            <article
              key={agent.id}
              className={`group relative overflow-hidden rounded-[1.75rem] border bg-gradient-to-br ${agent.tone} p-5 shadow-[0_18px_45px_rgba(15,23,42,0.45)] transition-transform duration-200 hover:-translate-y-1`}
            >
              <div className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:14px_14px]" />
              <div className="relative space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-300">
                      Slot {String(index + 1).padStart(2, "0")}
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      {agent.name} <span className="align-middle text-xl">{agent.emoji}</span>
                    </h2>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-200">
                    online
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                    Função
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{agent.role}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{agent.description}</p>
                </div>

                <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  <span>lhfex.squad</span>
                  <span>ready</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
