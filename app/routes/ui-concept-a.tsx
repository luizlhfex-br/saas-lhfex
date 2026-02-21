import { Link } from "react-router";

export const meta = () => [
  { title: "UI Concept A — LHFEX" },
  { name: "description", content: "Conceito A de interface premium corporativa" },
];

const kpis = [
  { label: "Receita mes", value: "R$ 2,84M", delta: "+12%" },
  { label: "Processos ativos", value: "184", delta: "+7%" },
  { label: "Tempo medio", value: "3,2 dias", delta: "-9%" },
];

const tasks = [
  { title: "Revisar DI 4841-AX", owner: "Equipe Import", status: "Hoje" },
  { title: "Fechar cotacao Europa", owner: "Comex", status: "Amanhã" },
  { title: "Ajustar timeline licenca", owner: "Operacoes", status: "3 dias" },
];

export default function UiConceptA() {
  return (
    <div className="ui-preview theme-aurora">
      <div className="ui-shell">
        <aside className="ui-sidebar text-slate-100">
          <div className="px-6 py-6">
            <div className="text-sm uppercase tracking-[0.4em] text-emerald-300">LHFEX</div>
            <div className="mt-2 text-2xl font-semibold">Atlas Control</div>
          </div>
          <div className="px-4">
            {[
              "Dashboard",
              "CRM",
              "Processos",
              "Financeiro",
              "Automacoes",
              "Agentes",
              "Auditoria",
            ].map((item, index) => (
              <div
                key={item}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
                  index === 0
                    ? "bg-emerald-500/20 text-white"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <span>{item}</span>
                {index === 0 && (
                  <span className="ui-pill rounded-full px-2 py-0.5 text-[11px]">live</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-auto px-6 pb-6 pt-8 text-xs text-slate-400">
            Proxima revisao: 18h30
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between px-10 py-6">
            <div>
              <div className="text-xs uppercase tracking-[0.4em] text-slate-500">
                Conceito A
              </div>
              <h1 className="mt-2 text-3xl font-semibold">Visao estrategica, limpa e calma</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="ui-pill rounded-full px-3 py-1 text-xs">Ultima sync 5 min</div>
              <Link className="ui-button rounded-full px-4 py-2 text-sm" to="/ui-concept-b">
                Ver B
              </Link>
              <Link className="ui-button-outline rounded-full px-4 py-2 text-sm" to="/ui-concept-c">
                Ver C
              </Link>
            </div>
          </header>

          <main className="flex-1 px-10 pb-10">
            <section className="ui-card ui-fade-up rounded-3xl p-8">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <p className="text-sm text-slate-500">Resumo executivo</p>
                  <h2 className="mt-2 text-4xl font-semibold">
                    Crescimento continuo em operacoes premium
                  </h2>
                  <p className="mt-3 max-w-xl text-sm text-slate-500">
                    Uma camada de inteligencia reunindo CRM, processos e financeiro em um painel de decisao.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button className="ui-button rounded-full px-5 py-2 text-sm">Nova operacao</button>
                  <button className="ui-button-outline rounded-full px-5 py-2 text-sm">Exportar</button>
                </div>
              </div>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-3">
              {kpis.map((kpi, index) => (
                <div key={kpi.label} className={`ui-card ui-fade-up ui-delay-${index + 1} rounded-2xl p-6`}>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{kpi.label}</p>
                  <div className="mt-4 flex items-end justify-between">
                    <span className="text-3xl font-semibold">{kpi.value}</span>
                    <span className="ui-highlight text-sm font-semibold">{kpi.delta}</span>
                  </div>
                  <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100">
                    <div className="h-1.5 w-2/3 rounded-full bg-emerald-400" />
                  </div>
                </div>
              ))}
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-[2fr,1fr]">
              <div className="ui-card ui-fade-up rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Pipeline de processos</h3>
                  <span className="ui-pill rounded-full px-3 py-1 text-xs">Atualizado agora</span>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {["Analise", "Em execucao", "Entrega"].map((stage, index) => (
                    <div key={stage} className="rounded-2xl border border-slate-100/70 bg-white/70 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{stage}</p>
                      <p className="mt-4 text-2xl font-semibold">{42 + index * 19}</p>
                      <p className="mt-2 text-xs text-slate-500">+{4 + index}% esta semana</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ui-card ui-fade-up ui-delay-2 rounded-2xl p-6">
                <h3 className="text-lg font-semibold">Agenda critica</h3>
                <div className="mt-4 space-y-3">
                  {tasks.map((task) => (
                    <div key={task.title} className="rounded-xl border border-slate-100/70 bg-white/70 p-3">
                      <p className="text-sm font-semibold">{task.title}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>{task.owner}</span>
                        <span className="ui-pill rounded-full px-2 py-0.5">{task.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-8 ui-card ui-fade-up rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Fluxo financeiro</h3>
                <div className="flex items-center gap-2">
                  <span className="ui-pill rounded-full px-3 py-1 text-xs">Trimestre</span>
                  <span className="ui-pill rounded-full px-3 py-1 text-xs">Ano</span>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-4">
                {["Jan", "Fev", "Mar", "Abr"].map((month, index) => (
                  <div key={month} className="rounded-2xl bg-slate-100/70 p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{month}</p>
                    <p className="mt-3 text-xl font-semibold">R$ {1.2 + index * 0.4}M</p>
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
