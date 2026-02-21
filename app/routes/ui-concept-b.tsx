import { Link } from "react-router";

export const meta = () => [
  { title: "UI Concept B — LHFEX" },
  { name: "description", content: "Conceito B de interface premium corporativa" },
];

const highlights = [
  { label: "Compliance", value: "99,2%", note: "SLA regulatorio" },
  { label: "Margem media", value: "18,4%", note: "Portfolio premium" },
  { label: "Risk score", value: "Baixo", note: "12 sinais" },
];

const deals = [
  { title: "Projeto Triton", value: "R$ 680k", stage: "Negociacao" },
  { title: "Exportacao Azure", value: "R$ 1,24M", stage: "Contrato" },
  { title: "Operacao Atlas", value: "R$ 420k", stage: "Compliance" },
];

export default function UiConceptB() {
  return (
    <div className="ui-preview theme-meridian">
      <div className="ui-shell">
        <aside className="ui-sidebar text-amber-50">
          <div className="px-6 py-6">
            <div className="text-xs uppercase tracking-[0.4em] text-amber-200">LHFEX</div>
            <div className="mt-2 text-2xl">Meridian Desk</div>
          </div>
          <div className="space-y-2 px-4 text-sm">
            {[
              "Executive",
              "Pipeline",
              "Clientes",
              "Processos",
              "Financeiro",
              "Risco",
              "Auditoria",
            ].map((item, index) => (
              <div
                key={item}
                className={`rounded-xl px-4 py-3 ${
                  index === 0 ? "bg-amber-600/20 text-white" : "text-amber-100/80 hover:bg-white/10"
                }`}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="mt-auto px-6 pb-6 pt-8 text-xs text-amber-200/70">
            Ultima auditoria: 14 fev
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between px-10 py-6">
            <div>
              <div className="text-xs uppercase tracking-[0.4em] text-slate-500">Conceito B</div>
              <h1 className="mt-2 text-3xl font-semibold">Elegancia editorial, foco em decisao</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link className="ui-button-outline rounded-full px-4 py-2 text-sm" to="/ui-concept-a">
                Ver A
              </Link>
              <Link className="ui-button rounded-full px-4 py-2 text-sm" to="/ui-concept-c">
                Ver C
              </Link>
            </div>
          </header>

          <main className="flex-1 px-10 pb-10">
            <section className="ui-card ui-fade-up rounded-[32px] p-8">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <p className="text-sm text-slate-500">Resumo</p>
                  <h2 className="mt-2 text-4xl font-semibold">
                    Performance premium com governanca refinada
                  </h2>
                  <p className="mt-3 max-w-xl text-sm text-slate-500">
                    Uma narrativa visual que valoriza compliance, risco controlado e margem crescente.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button className="ui-button rounded-full px-5 py-2 text-sm">Revisar carteira</button>
                  <button className="ui-button-outline rounded-full px-5 py-2 text-sm">Baixar report</button>
                </div>
              </div>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-3">
              {highlights.map((item, index) => (
                <div key={item.label} className={`ui-card ui-fade-up ui-delay-${index + 1} rounded-2xl p-6`}>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{item.label}</p>
                  <p className="mt-4 text-3xl font-semibold">{item.value}</p>
                  <p className="mt-3 text-xs text-slate-500">{item.note}</p>
                </div>
              ))}
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr,1fr]">
              <div className="ui-card ui-fade-up rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Pipeline estrategico</h3>
                  <span className="ui-pill rounded-full px-3 py-1 text-xs">12 oportunidades</span>
                </div>
                <div className="mt-6 space-y-4">
                  {deals.map((deal) => (
                    <div key={deal.title} className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">{deal.title}</p>
                        <p className="text-xs text-slate-500">{deal.stage}</p>
                      </div>
                      <span className="text-sm font-semibold">{deal.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ui-card ui-fade-up ui-delay-2 rounded-2xl p-6">
                <h3 className="text-lg font-semibold">Mapa de risco</h3>
                <div className="mt-6 space-y-3">
                  {[
                    { label: "Licencas", level: "Baixo" },
                    { label: "Compliance", level: "Medio" },
                    { label: "Financeiro", level: "Baixo" },
                  ].map((risk) => (
                    <div key={risk.label} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span>{risk.label}</span>
                        <span className="ui-highlight font-semibold">{risk.level}</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-amber-100">
                        <div className="h-2 w-2/3 rounded-full bg-amber-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-8 ui-card ui-fade-up rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Relatorios de compliance</h3>
                <button className="ui-button-outline rounded-full px-4 py-2 text-sm">Abrir painel</button>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {["Operacoes", "Fornecedores", "Contratos"].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                    <p className="text-sm font-semibold">{item}</p>
                    <p className="mt-2 text-xs text-slate-500">Ultima auditoria hoje</p>
                    <p className="mt-4 text-2xl font-semibold">98%</p>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
