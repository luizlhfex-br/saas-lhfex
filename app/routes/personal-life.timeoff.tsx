/**
 * GET /personal-life/timeoff
 * Módulo de Férias & Descanso (Onda 8.x)
 */

import type { Route } from "./+types/personal-life.timeoff";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  return { user };
}

export default function PersonalLifeTimeoffPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/personal-life">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          🏖️ Férias & Descanso
        </h1>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">
          Este módulo será desenvolvido em breve. Você poderá planejar:
        </p>
        <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>✓ Viagens e roteiros</li>
          <li>✓ Férias agendadas</li>
          <li>✓ Orçamento de lazer</li>
          <li>✓ Categorias de descanso (praia, montanha, cidade, etc)</li>
        </ul>
      </div>
    </div>
  );
}
