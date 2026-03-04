/**
 * GET/POST /personal-life/productivity
 * Productivity Module — 3-3-3, Pomodoro, Eisenhower, Seinfeld, Time Blocking
 */

import { useState, useEffect, useRef } from "react";
import { useLoaderData, useFetcher, Link } from "react-router";
import { data } from "react-router";
import type { Route } from "./+types/personal-life.productivity";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { daily333, seinfeldHabits, seinfeldLogs } from "../../drizzle/schema/productivity";
import { eq, and, gte, desc } from "drizzle-orm";
import {
  ArrowLeft,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Flame,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTodayBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function getLast30Days(): string[] {
  const today = getTodayBR();
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function calcStreak(logs: Array<{ date: string; done: boolean }>, today: string): number {
  const doneSet = new Set(logs.filter(l => l.done).map(l => l.date));
  let streak = 0;
  const d = new Date(today);
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (doneSet.has(key)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const today = getTodayBR();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().slice(0, 10);

  const [plan333Rows, habitsRows, logsRows] = await Promise.all([
    db.select().from(daily333)
      .where(and(eq(daily333.userId, user.id), eq(daily333.date, today)))
      .limit(1),
    db.select().from(seinfeldHabits)
      .where(and(eq(seinfeldHabits.userId, user.id), eq(seinfeldHabits.active, true)))
      .orderBy(desc(seinfeldHabits.createdAt)),
    db.select().from(seinfeldLogs)
      .where(and(eq(seinfeldLogs.userId, user.id), gte(seinfeldLogs.date, startDate)))
      .orderBy(desc(seinfeldLogs.date)),
  ]);

  return {
    today,
    plan333: plan333Rows[0] ?? null,
    habits: habitsRows,
    logs: logsRows,
  };
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  // ── Create 3-3-3 plan
  if (intent === "create_333") {
    const today = getTodayBR();
    const deepWork = String(form.get("deepWork") ?? "");
    const quickTasks = JSON.stringify([
      String(form.get("qt0") ?? ""),
      String(form.get("qt1") ?? ""),
      String(form.get("qt2") ?? ""),
    ]);
    const maintenance = JSON.stringify([
      String(form.get("mt0") ?? ""),
      String(form.get("mt1") ?? ""),
      String(form.get("mt2") ?? ""),
    ]);
    const existing = await db.select({ id: daily333.id })
      .from(daily333)
      .where(and(eq(daily333.userId, user.id), eq(daily333.date, today)))
      .limit(1);
    if (existing.length > 0) {
      await db.update(daily333).set({ deepWork, quickTasks, maintenance, updatedAt: new Date() })
        .where(and(eq(daily333.userId, user.id), eq(daily333.date, today)));
    } else {
      await db.insert(daily333).values({ userId: user.id, date: today, deepWork, quickTasks, maintenance });
    }
    return data({ ok: true });
  }

  // ── Update checkbox state for 3-3-3
  if (intent === "update_333_check") {
    const today = getTodayBR();
    const field = String(form.get("field") ?? "");
    const value = form.get("value");
    const parsed = value !== null ? JSON.parse(String(value)) : null;
    if (field === "completedDeepWork") {
      await db.update(daily333).set({ completedDeepWork: Boolean(parsed), updatedAt: new Date() })
        .where(and(eq(daily333.userId, user.id), eq(daily333.date, today)));
    } else if (field === "completedQuickTasks" || field === "completedMaintenance") {
      await db.update(daily333).set({ [field]: JSON.stringify(parsed), updatedAt: new Date() })
        .where(and(eq(daily333.userId, user.id), eq(daily333.date, today)));
    }
    return data({ ok: true });
  }

  // ── Create habit
  if (intent === "create_habit") {
    const name = String(form.get("name") ?? "").trim();
    const emoji = String(form.get("emoji") ?? "✅");
    const color = String(form.get("color") ?? "green");
    if (!name) return data({ error: "Name required" }, { status: 400 });
    await db.insert(seinfeldHabits).values({ userId: user.id, name, emoji, color });
    return data({ ok: true });
  }

  // ── Log habit (toggle today)
  if (intent === "log_habit") {
    const habitId = String(form.get("habitId") ?? "");
    const today = getTodayBR();
    const existing = await db.select({ id: seinfeldLogs.id, done: seinfeldLogs.done })
      .from(seinfeldLogs)
      .where(and(eq(seinfeldLogs.habitId, habitId), eq(seinfeldLogs.userId, user.id), eq(seinfeldLogs.date, today)))
      .limit(1);
    if (existing.length > 0) {
      await db.update(seinfeldLogs).set({ done: !existing[0].done })
        .where(eq(seinfeldLogs.id, existing[0].id));
    } else {
      await db.insert(seinfeldLogs).values({ habitId, userId: user.id, date: today, done: true });
    }
    return data({ ok: true });
  }

  return data({ error: "Invalid intent" }, { status: 400 });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type LoaderData = Awaited<ReturnType<typeof loader>>;

type EisenhowerTask = { id: string; text: string; quadrant: "q1" | "q2" | "q3" | "q4" };

type TimeBlock = { label: string; category: string };

const TABS = [
  { id: "333", label: "3-3-3" },
  { id: "pomodoro", label: "Pomodoro" },
  { id: "eisenhower", label: "Eisenhower" },
  { id: "seinfeld", label: "Seinfeld" },
  { id: "timeblocking", label: "Time Blocking" },
] as const;

type TabId = typeof TABS[number]["id"];


export default function ProductivityPage() {
  const { today, plan333, habits, logs } = useLoaderData<LoaderData>();
  const [activeTab, setActiveTab] = useState<TabId>("333");
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
      <div className="flex items-center gap-3">
        <Link to="/personal-life" className="text-[var(--app-muted)] hover:text-[var(--app-text)]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[var(--app-text)]">
            <Timer className="inline h-5 w-5 mr-2 text-indigo-500" />
            Produtividade
          </h1>
          <p className="text-sm text-[var(--app-muted)]">Pomodoro · 3-3-3 · Eisenhower · Seinfeld · Time Blocking</p>
        </div>
      </div>
      <div className="flex gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn("flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all",
              activeTab === tab.id ? "bg-indigo-600 text-white shadow-sm" : "text-[var(--app-muted)] hover:text-[var(--app-text)]"
            )}
          >{tab.label}</button>
        ))}
      </div>
      {activeTab === "333" && <Tab333 today={today} plan333={plan333} />}
      {activeTab === "pomodoro" && <TabPomodoro />}
      {activeTab === "eisenhower" && <TabEisenhower />}
      {activeTab === "seinfeld" && <TabSeinfeld today={today} habits={habits} logs={logs} />}
      {activeTab === "timeblocking" && <TabTimeBlocking today={today} />}
    </div>
  );
}

// ── Tab333 ───────────────────────────────────────────────────────────────────
type Tab333Props = { today: string; plan333: LoaderData["plan333"] };
function Tab333({ today, plan333 }: Tab333Props) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";
  const qt: string[] = plan333?.quickTasks ? JSON.parse(plan333.quickTasks) : ["","",""];
  const mt: string[] = plan333?.maintenance ? JSON.parse(plan333.maintenance) : ["","",""];
  const cqt: boolean[] = plan333?.completedQuickTasks ? JSON.parse(plan333.completedQuickTasks) : [false,false,false];
  const cmt: boolean[] = plan333?.completedMaintenance ? JSON.parse(plan333.completedMaintenance) : [false,false,false];
  function toggleDeepWork() { fetcher.submit({intent:"update_333_check",field:"completedDeepWork",value:JSON.stringify(!plan333?.completedDeepWork)},{method:"post"}); }
  function toggleQuick(i:number){const next=[...cqt];next[i]=!next[i];fetcher.submit({intent:"update_333_check",field:"completedQuickTasks",value:JSON.stringify(next)},{method:"post"});}
  function toggleMaint(i:number){const next=[...cmt];next[i]=!next[i];fetcher.submit({intent:"update_333_check",field:"completedMaintenance",value:JSON.stringify(next)},{method:"post"});}
  if (!plan333) {
    return (
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-card-shadow)]">
        <h2 className="mb-1 text-base font-semibold text-[var(--app-text)]">Plano 3-3-3 de Hoje</h2>
        <p className="mb-4 text-sm text-[var(--app-muted)]">Defina 1 foco profundo + 3 tarefas rapidas + 3 manutencoes</p>
        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="create_333" />
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--app-text)]">3h Foco Profundo — 1 projeto principal</label>
            <input name="deepWork" type="text" placeholder="Ex: Implementar modulo de relatorios" className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--app-text)]">3 Tarefas Rapidas (menos de 30min cada)</label>
            <div className="space-y-2">
              {[0,1,2].map(i => (<input key={i} name={"qt"+i} type="text" placeholder={"Tarefa rapida "+(i+1)} className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--app-text)]">3 Manutencoes (rotinas, emails, etc.)</label>
            <div className="space-y-2">
              {[0,1,2].map(i => (<input key={i} name={"mt"+i} type="text" placeholder={"Manutencao "+(i+1)} className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />))}
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Salvando..." : "Criar Plano do Dia"}
          </Button>
        </fetcher.Form>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-card-shadow)]">
        <h2 className="mb-3 text-base font-semibold text-[var(--app-text)]">Plano 3-3-3 — {today}</h2>
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-medium text-indigo-500">3h Foco Profundo</p>
            <button onClick={toggleDeepWork} className={cn("flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors",plan333.completedDeepWork?"border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20":"border-[var(--app-border)] bg-[var(--app-surface-2)]")}
            >
              <span>{plan333.completedDeepWork ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-[var(--app-muted)]" />}</span>
              <span className={cn("text-[var(--app-text)]",plan333.completedDeepWork&&"line-through opacity-60")}>{plan333.deepWork}</span>
            </button>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-blue-500">3 Tarefas Rapidas</p>
            <div className="space-y-2">
              {qt.map((task, i) => (
                <button key={i} onClick={() => toggleQuick(i)} className={cn("flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-sm transition-colors",cqt[i]?"border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20":"border-[var(--app-border)] bg-[var(--app-surface-2)]")}
                >
                  <span>{cqt[i] ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-[var(--app-muted)]" />}</span>
                  <span className={cn("text-[var(--app-text)]",cqt[i]&&"line-through opacity-60")}>{task}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-orange-500">3 Manutencoes</p>
            <div className="space-y-2">
              {mt.map((task, i) => (
                <button key={i} onClick={() => toggleMaint(i)} className={cn("flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-sm transition-colors",cmt[i]?"border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20":"border-[var(--app-border)] bg-[var(--app-surface-2)]")}
                >
                  <span>{cmt[i] ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-[var(--app-muted)]" />}</span>
                  <span className={cn("text-[var(--app-text)]",cmt[i]&&"line-through opacity-60")}>{task}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// TabPomodoro
function TabPomodoro() {
  const WORK=25*60, SHORT=5*60, LONG=15*60;
  const [phase, setPhase] = useState("work" as "work"|"short"|"long");
  const [seconds, setSeconds] = useState(WORK);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const intervalRef = useRef(null as any);
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            setCycles(c => {
              const nc = c + 1;
              if (phase === "work") {
                if (nc % 4 === 0) { setPhase("long"); setSeconds(LONG); }
                else { setPhase("short"); setSeconds(SHORT); }
              } else { setPhase("work"); setSeconds(WORK); }
              return nc;
            });
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, phase]);
  function reset() { setRunning(false); setPhase("work"); setSeconds(WORK); setCycles(0); }
  const total = phase==="work"?WORK:phase==="short"?SHORT:LONG;
  const pct = Math.round(((total-seconds)/total)*100);
  const mm = String(Math.floor(seconds/60)).padStart(2,"0");
  const ss2 = String(seconds%60).padStart(2,"0");
  const phaseLabel = phase==="work"?"Foco Profundo":phase==="short"?"Pausa Curta":"Pausa Longa";
  const phaseColor = phase==="work"?"text-indigo-500":phase==="short"?"text-emerald-500":"text-blue-500";
  const circumference = 2*Math.PI*45;
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-[var(--app-card-shadow)] text-center">
      <p className={"text-sm font-semibold uppercase tracking-widest mb-4 "+phaseColor}>{phaseLabel}</p>
      <div className="relative mx-auto mb-6 h-40 w-40">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--app-border)" strokeWidth="8" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" className={phaseColor} strokeDasharray={circumference} strokeDashoffset={circumference*(1-pct/100)} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold tabular-nums text-[var(--app-text)]">{mm}:{ss2}</span>
        </div>
      </div>
      <p className="mb-6 text-xs text-[var(--app-muted)]">Ciclos: {cycles} — A cada 4 ciclos, pausa longa</p>
      <div className="flex justify-center gap-3">
        <Button onClick={() => setRunning(r => !r)} className="w-28">
          {running ? <span className="flex items-center gap-2"><Pause className="h-4 w-4" />Pausar</span> : <span className="flex items-center gap-2"><Play className="h-4 w-4" />Iniciar</span>}
        </Button>
        <Button variant="outline" onClick={reset}><RotateCcw className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

// TabEisenhower
const QUADRANTS = [
  { id: "q1" as const, label: "Q1 Urgente + Importante", color: "border-red-300 dark:border-red-800", bg: "bg-red-50 dark:bg-red-900/10", dot: "bg-red-500" },
  { id: "q2" as const, label: "Q2 Nao Urgente + Importante", color: "border-emerald-300 dark:border-emerald-800", bg: "bg-emerald-50 dark:bg-emerald-900/10", dot: "bg-emerald-500" },
  { id: "q3" as const, label: "Q3 Urgente + Nao Importante", color: "border-yellow-300 dark:border-yellow-800", bg: "bg-yellow-50 dark:bg-yellow-900/10", dot: "bg-yellow-500" },
  { id: "q4" as const, label: "Q4 Nao Urgente + Nao Importante", color: "border-gray-300 dark:border-gray-700", bg: "bg-gray-50 dark:bg-gray-800/20", dot: "bg-gray-400" },
];
function TabEisenhower() {
  const [tasks, setTasks] = useState(() => {
    if (typeof window === "undefined") return [] as EisenhowerTask[];
    try { return JSON.parse(localStorage.getItem("eisenhower_tasks") || "[]") as EisenhowerTask[]; }
    catch { return [] as EisenhowerTask[]; }
  });
  const [newText, setNewText] = useState("");
  const [newQ, setNewQ] = useState("q1" as EisenhowerTask["quadrant"]);
  function save(t: EisenhowerTask[]) { setTasks(t); localStorage.setItem("eisenhower_tasks", JSON.stringify(t)); }
  function addTask() {
    if (!newText.trim()) return;
    save([...tasks, { id: Date.now().toString(), text: newText.trim(), quadrant: newQ }]);
    setNewText("");
  }
  function delTask(id: string) { save(tasks.filter(t => t.id !== id)); }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-card-shadow)]">
        <h2 className="mb-3 text-base font-semibold text-[var(--app-text)]">Matriz Eisenhower</h2>
        <div className="flex gap-2 mb-3">
          <input value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => e.key==="Enter" && addTask()} placeholder="Nova tarefa..." className="flex-1 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          <select value={newQ} onChange={e => setNewQ(e.target.value as any)} className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-2 py-2 text-xs text-[var(--app-text)] focus:outline-none">
            {QUADRANTS.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
          <Button onClick={addTask}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUADRANTS.map(q => (
            <div key={q.id} className={"rounded-lg border p-3 "+q.color+" "+q.bg}>
              <div className="flex items-center gap-2 mb-2">
                <span className={"h-2.5 w-2.5 rounded-full flex-shrink-0 "+q.dot}></span>
                <p className="text-xs font-semibold text-[var(--app-text)]">{q.label}</p>
              </div>
              <div className="space-y-1">
                {tasks.filter(t => t.quadrant === q.id).map(t => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="flex-1 text-xs text-[var(--app-text)]">{t.text}</span>
                    <button onClick={() => delTask(t.id)} className="text-[var(--app-muted)] hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {tasks.filter(t => t.quadrant === q.id).length === 0 && (
                  <p className="text-xs text-[var(--app-muted)] italic">Vazio</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// TabSeinfeld
type SeinfeldProps = { today: string; habits: LoaderData["habits"]; logs: LoaderData["logs"] };
function TabSeinfeld({ today, habits, logs }: SeinfeldProps) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✅");
  const days30 = getLast30Days();
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-card-shadow)]">
        <h2 className="mb-3 text-base font-semibold text-[var(--app-text)]">Adicionar Habito</h2>
        <fetcher.Form method="post" className="flex gap-2">
          <input type="hidden" name="intent" value="create_habit" />
          <input name="emoji" value={emoji} onChange={e=>setEmoji(e.target.value)} className="w-12 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-2 py-2 text-center text-sm" />
          <input name="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do habito" required className="flex-1 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          <input type="hidden" name="color" value="green" />
          <Button type="submit" disabled={isSubmitting}><Plus className="h-4 w-4" /></Button>
        </fetcher.Form>
      </div>
      {habits.map(habit => {
        const habitLogs = logs.filter(l => l.habitId === habit.id);
        const todayLog = habitLogs.find(l => l.date === today);
        const streak = calcStreak(habitLogs.map(l => ({ date: l.date, done: l.done })), today);
        return (
          <div key={habit.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-card-shadow)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{habit.emoji}</span>
                <span className="font-medium text-[var(--app-text)]">{habit.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-sm text-orange-500"><Flame className="h-4 w-4" />{streak}</span>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="log_habit" />
                  <input type="hidden" name="habitId" value={habit.id} />
                  <Button type="submit" variant={todayLog?.done ? "default" : "outline"} className="text-xs h-7 px-2" disabled={isSubmitting}>
                    {todayLog?.done ? "✅ Feito" : "Marcar hoje"}
                  </Button>
                </fetcher.Form>
              </div>
            </div>
            <div className="flex gap-1 flex-wrap">
              {days30.map(d => {
                const log = habitLogs.find(l => l.date === d);
                const isDone = log?.done;
                return (
                  <div key={d} title={d} className={cn("h-5 w-5 rounded-sm",isDone?"bg-emerald-500 dark:bg-emerald-400":"bg-[var(--app-border)] dark:bg-white/10")} />
                );
              })}
            </div>
          </div>
        );
      })}
      {habits.length === 0 && (
        <p className="text-center text-sm text-[var(--app-muted)] py-8">Adicione seu primeiro habito acima</p>
      )}
    </div>
  );
}

// TabTimeBlocking
const TIME_CATEGORIES = [{"id":"trabalho","label":"Trabalho","color":"bg-blue-500","light":"bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"},{"id":"email","label":"Email","color":"bg-yellow-500","light":"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"},{"id":"almoco","label":"Almoco","color":"bg-orange-500","light":"bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"},{"id":"academia","label":"Academia","color":"bg-emerald-500","light":"bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"},{"id":"estudos","label":"Estudos","color":"bg-purple-500","light":"bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"},{"id":"descanso","label":"Descanso","color":"bg-gray-400","light":"bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}];

const HOURS = Array.from({length:17},(_,i)=>{
  const h=6+i;
  return String(h).padStart(2,"0")+":00";
});

type TimeBlockingData = Record<string, TimeBlock>;

function TabTimeBlocking({ today }: { today: string }) {
  const storageKey = "time_blocking_"+today;
  const [blocks, setBlocks] = useState(() => {
    if (typeof window === "undefined") return {} as TimeBlockingData;
    try { return JSON.parse(localStorage.getItem(storageKey)||"{}" ) as TimeBlockingData; }
    catch { return {} as TimeBlockingData; }
  });
  const [editing, setEditing] = useState(null as string|null);
  const [editLabel, setEditLabel] = useState("");
  const [editCat, setEditCat] = useState("trabalho");

  function save(b: TimeBlockingData) { setBlocks(b); localStorage.setItem(storageKey, JSON.stringify(b)); }
  function openEdit(hour: string) {
    const existing = blocks[hour];
    setEditLabel(existing?.label||"")
    setEditCat(existing?.category||"trabalho");
    setEditing(hour);
  }
  function saveEdit() {
    if (!editing) return;
    if (!editLabel.trim()) {
      const next = {...blocks}; delete next[editing]; save(next);
    } else {
      save({...blocks,[editing]:{label:editLabel.trim(),category:editCat}});
    }
    setEditing(null);
  }

  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-card-shadow)]">
      <h2 className="mb-1 text-base font-semibold text-[var(--app-text)]">Time Blocking — {today}</h2>
      <p className="mb-3 text-xs text-[var(--app-muted)]">Clique em um horario para adicionar um bloco</p>
      <div className="flex gap-2 mb-3 flex-wrap">
        {TIME_CATEGORIES.map(cat => (
          <span key={cat.id} className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs "+cat.light}>
            <span className={"h-2 w-2 rounded-full "+cat.color}></span>
            {cat.label}
          </span>
        ))}
      </div>
      <div className="space-y-1">
        {HOURS.map(hour => {
          const block = blocks[hour];
          const cat = TIME_CATEGORIES.find(c => c.id === block?.category);
          return (
            <button key={hour} onClick={() => openEdit(hour)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--app-surface-2)]">
              <span className="w-14 flex-shrink-0 text-xs font-mono text-[var(--app-muted)]">{hour}</span>
              {block ? (
                <span className={"flex-1 rounded px-2 py-0.5 text-xs "+( cat?.light||"bg-gray-100")}>{block.label}</span>
              ) : (
                <span className="flex-1 border-t border-dashed border-[var(--app-border)] opacity-40"></span>
              )}
            </button>
          );
        })}
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-xl w-80">
            <h3 className="mb-3 font-semibold text-[var(--app-text)]">Bloco {editing}</h3>
            <input value={editLabel} onChange={e=>setEditLabel(e.target.value)} placeholder="Ex: Reuniao de planning" className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2 text-sm text-[var(--app-text)] mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            <select value={editCat} onChange={e=>setEditCat(e.target.value)} className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2 text-sm text-[var(--app-text)] mb-4 focus:outline-none">
              {TIME_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <div className="flex gap-2">
              <Button onClick={saveEdit} className="flex-1">Salvar</Button>
              <Button variant="outline" onClick={()=>setEditing(null)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
