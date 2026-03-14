import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/other-business.apps";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { data } from "react-router";
import { readFile, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Lightbulb, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";

const IDEAS_PATH = resolve(process.cwd(), "docs", "IDEAS.md");

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  try {
    const content = await readFile(IDEAS_PATH, "utf-8");
    const lines = content.split(/\r?\n/);
    const recent = lines.slice(Math.max(0, lines.length - 40));
    return { recentIdeasLines: recent, readError: null as string | null };
  } catch {
    return { recentIdeasLines: [] as string[], readError: "Nao foi possivel ler docs/IDEAS.md." };
  }
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent !== "add_idea") {
    return data({ error: "Intent invalido" }, { status: 400 });
  }

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!title) {
    return data({ error: "Titulo obrigatorio" }, { status: 400 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const entry = `\n### [${stamp}] ${title}\n- ${description || "Sem descricao"}\n- Origem: Outros > Criar/Publicar Apps\n`;

  try {
    await appendFile(IDEAS_PATH, entry, "utf-8");
    return data({ success: true });
  } catch {
    return data({ error: "Falha ao salvar no docs/IDEAS.md" }, { status: 500 });
  }
}

export default function OtherBusinessAppsPage({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const actionError = actionData && "error" in actionData ? actionData.error : undefined;
  const actionSuccess = Boolean(actionData && "success" in actionData && actionData.success);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Criar/Publicar Apps</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Area inicial para ideias de novos apps e produtos.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Nova Ideia (salva em docs/IDEAS.md)</h2>
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="add_idea" />
          <input
            name="title"
            placeholder="Titulo da ideia"
            required
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <textarea
            name="description"
            rows={3}
            placeholder="Descricao curta"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          {actionError && <p className="text-sm text-red-500">{actionError}</p>}
          {actionSuccess && <p className="text-sm text-green-600 dark:text-green-400">Ideia salva com sucesso no docs/IDEAS.md.</p>}
          <Button type="submit" disabled={isSubmitting}>
            <Plus className="h-4 w-4" /> Salvar Ideia
          </Button>
        </Form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Trecho recente de docs/IDEAS.md
        </h2>
        {loaderData.readError ? (
          <p className="text-sm text-red-500">{loaderData.readError}</p>
        ) : (
          <pre className="max-h-96 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {loaderData.recentIdeasLines.join("\n")}
          </pre>
        )}
      </div>
    </div>
  );
}
