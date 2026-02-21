import { useEffect, useState } from "react";
import type { Route } from "./+types/automations-health";
import { requireAuth } from "~/lib/auth.server";
import { RotateCw, Activity } from "lucide-react";
import { Button } from "~/components/ui/button";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return {};
}

export default function AutomationsHealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/automations-cron-health");
      const data = await res.json();
      setHealth(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch health:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-indigo-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Health de Cron Jobs</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchHealth}
          disabled={loading}
          className="gap-2"
        >
          <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Atualizando..." : "Atualizar"}
        </Button>
      </div>

      {health && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Status geral</p>
              <p className={`text-lg font-semibold ${
                health.healthStatus === "healthy"
                  ? "text-green-600 dark:text-green-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}>
                {health.healthStatus === "healthy" ? "✓ Saudável" : "⚠️ Degradado"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Jobs ativos</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {health.activeJobs} / {health.totalJobs}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Última atualização</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {new Date(lastRefresh).toLocaleTimeString("pt-BR")}
              </p>
            </div>
          </div>
        </div>
      )}

      {health?.jobs && (
        <div className="space-y-3">
          {health.jobs.map((job: any) => (
            <div
              key={job.name}
              className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 dark:border-gray-800"
            >
              <div className="flex items-center gap-3">
                <Activity className={`h-5 w-5 ${
                  job.status === "active" ? "text-green-500" : "text-gray-300"
                }`} />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{job.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{job.expression}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {job.status === "active" && (
                  <div className="text-right">
                    <p className="text-xs text-green-600 dark:text-green-400">Ativo</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {job.lastRunMinutesAgo}m atrás
                    </p>
                  </div>
                )}
                {job.status === "idle" && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Aguardando</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Carregando health...
        </div>
      )}
    </div>
  );
}
