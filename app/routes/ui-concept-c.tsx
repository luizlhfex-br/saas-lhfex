import { Link } from "react-router";

export const meta = () => [
  { title: "UI Concept C — LHFEX" },
  { name: "description", content: "Conceito C de interface premium corporativa" },
];

const signals = [
  { label: "Tracking em tempo real", value: "124 eventos" },
  { label: "Alertas criticos", value: "3 ativos" },
  { label: "Tempo de ciclo", value: "2,6 dias" },
];

const timeline = [
  { title: "Documentacao liberada", time: "10:32" },
  { title: "COFINS ajustado", time: "09:18" },
  { title: "SLA fornecedor renovado", time: "Ontem" },
];

export default function UiConceptC() {
  return (
    <div className="ui-preview theme-forge">
      <div className="ui-shell">
        <aside className="ui-sidebar text-slate-100">
          <div className="px-6 py-6">
            <div className="text-xs uppercase tracking-[0.4em] text-teal-200">LHFEX</div>
            <div className="mt-2 text-2xl font-semibold">Forge Ops</div>
          </div>
          <div className="space-y-2 px-4 text-sm">
            {[
              "Pulse",
              "Operacoes",
              "Financeiro",
              "Riscos",
              "Auditoria",
              "Inteligencia",
              "Relatorios",
            ].map((item, index) => (
              <div
                key={item}
                className={`rounded-xl px-4 py-3 ${
                  index === 0 ? "bg-teal-500/20 text-white" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="mt-auto px-6 pb-6 pt-8 text-xs text-slate-400">
            Proxima revisao: 22h
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between px-10 py-6">
            <div>
              <div className="text-xs uppercase tracking-[0.4em] text-slate-500">Conceito C</div>
              <h1 className="mt-2 text-3xl font-semibold">Energia operacional com foco em velocidade</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link className="ui-button-outline rounded-full px-4 py-2 text-sm" to="/ui-concept-a">
                Ver A
              </Link>
              <Link className="ui-button-outline rounded-full px-4 py-2 text-sm" to="/ui-concept-b">
                Ver B
              </Link>
            </div>
          </header>

          <main className="flex-1 px-10 pb-10">
            <section className="ui-card ui-fade-up rounded-3xl p-8">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <p className="text-sm text-slate-500">Painel em tempo real</p>
                  <h2 className="mt-2 text-4xl font-semibold">
                    Executar rapido sem perder precisao
                  </h2>
                  <p className="mt-3 max-w-xl text-sm text-slate-500">
                    Interface energica para monitorar eventos, alertas e performance operacional.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button className="ui-button rounded-full px-5 py-2 text-sm">Criar alerta</button>
                  <button className="ui-button-outline rounded-full px-5 py-2 text-sm">Gerar relatorio</button>
                </div>
              </div>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-3">
              {signals.map((signal, index) => (
                <div key={signal.label} className={`ui-card ui-fade-up ui-delay-${index + 1} rounded-2xl p-6`}>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{signal.label}</p>
                  <p className="mt-4 text-3xl font-semibold">{signal.value}</p>
                  <div className="mt-4 h-2 rounded-full bg-slate-100">
                    <div className="h-2 w-1/2 rounded-full bg-teal-500" />
                  </div>
                </div>
              ))}
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-[1fr,1fr]">
              <div className="ui-card ui-fade-up rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Eventos recentes</h3>
                  <span className="ui-pill rounded-full px-3 py-1 text-xs">Live</span>
                </div>
                <div className="mt-6 space-y-4">
                  {timeline.map((event) => (
                    <div key={event.title} className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">{event.title}</p>
                        <p className="text-xs text-slate-500">Equipe operacoes</p>
                      </div>
                      <span className="text-xs text-slate-500">{event.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ui-card ui-fade-up ui-delay-2 rounded-2xl p-6">
                <h3 className="text-lg font-semibold">Mapa de calor</h3>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <div
                      key={`cell-${index}`}
                      className={`h-16 rounded-2xl ${index % 2 === 0 ? "bg-teal-500/20" : "bg-orange-400/20"}`}
                    />
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
                  <span>Baixo</span>
                  <span className="ui-highlight">Critico</span>
                </div>
              </div>
            </section>

            <section className="mt-8 ui-card ui-fade-up rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Fluxo financeiro</h3>
                <div className="flex items-center gap-2">
                  <span className="ui-pill rounded-full px-3 py-1 text-xs">Semana</span>
                  <span className="ui-pill rounded-full px-3 py-1 text-xs">Mes</span>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-4">
                {["Seg", "Ter", "Qua", "Qui"].map((day, index) => (
                  <div key={day} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{day}</p>
                    <p className="mt-3 text-xl font-semibold">R$ {0.42 + index * 0.12}M</p>
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
