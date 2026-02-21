import { Link } from "react-router";
import type { Route } from "./+types/knowledge.prompting";

export const meta: Route.MetaFunction = () => [
  { title: "Guia de Prompting — LHFEX" },
  { name: "description", content: "Boas praticas de engenharia de prompt para uso profissional" },
];

const principles = [
  "Tarefa: descreva o resultado exato (nao o tema).",
  "Contexto: publico, objetivo, restricoes e diferencial.",
  "Referencias: exemplos reais do seu estilo.",
  "Avaliacao: valide se atingiu o objetivo.",
  "Iteracao: ajuste sistematicamente.",
];

const structure = [
  "Prompt dividido em topicos numerados.",
  "Persona + formato de saida (tabela, lista, codigo).",
  "Restricoes claras (tamanho, tom, tempo).",
  "Tarefas analogas quando travar.",
  "Multimodal quando houver imagem/print/audio.",
];

const workflows = [
  "Prompt chaining: etapas pequenas e sequenciais.",
  "Chain of thought: pedir raciocinio e depois resposta final.",
  "Arvore de pensamentos: caminhos alternativos + riscos.",
];

const safety = [
  "Humano no controle: verifique fatos criticos.",
  "Evite dados sensiveis sem necessidade.",
  "Peça fontes quando for decisao importante.",
  "Meta-prompting: pergunte o que esta faltando.",
];

const quickTemplate = `Persona: Atue como especialista em comercio exterior.
Tarefa: Gere um resumo executivo de 7 bullets.
Contexto: Empresa B2B, foco em previsibilidade e margem.
Formato: Lista numerada + 1 recomendacao final.
Restricoes: ate 120 palavras.
Referencias: Linguagem objetiva e sem jargoes.
`;

export default function KnowledgePromptingPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Guia</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--app-text)]">
            Engenharia de Prompt
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--app-muted)]">
            Estruture pedidos para obter respostas precisas, acionaveis e consistentes.
          </p>
        </div>
        <Link
          to="/agents"
          className="hidden rounded-full border border-[var(--app-border-strong)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition-colors hover:bg-black/5 lg:inline-flex"
        >
          Ir para agentes
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-card-shadow)]">
          <h2 className="text-lg font-semibold">5 principios fundamentais</h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--app-muted)]">
            {principles.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--app-accent)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-card-shadow)]">
          <h2 className="text-lg font-semibold">Estruturacao avancada</h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--app-muted)]">
            {structure.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--app-accent-2)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-card-shadow)]">
          <h2 className="text-lg font-semibold">Fluxos de trabalho</h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--app-muted)]">
            {workflows.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--app-accent)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-card-shadow)]">
          <h2 className="text-lg font-semibold">Seguranca e controle</h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--app-muted)]">
            {safety.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--app-accent-2)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-card-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Template rapido</h2>
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              Copie e ajuste para seus casos de uso.
            </p>
          </div>
          <Link
            to="/agents"
            className="rounded-full bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-[var(--app-on-accent)]"
          >
            Usar com agentes
          </Link>
        </div>
        <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-4 text-xs text-[var(--app-text)]">
          {quickTemplate}
        </pre>
      </section>
    </div>
  );
}
