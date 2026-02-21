/**
 * GET/POST /public-procurement-new
 * Criar novo edital
 */

import { useState } from "react";
import type { Route } from "./+types/public-procurement-new";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { useNavigate, useFetcher } from "react-router";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAuth(request);

  if (request.method === "POST") {
    const formData = await request.formData();
    // Implementar lógica de criação
    return { success: true, noticeId: "new-id" };
  }

  return { error: "Method not allowed" };
}

const modalidades = [
  { code: "LICITACAO_ABERTA", label: "Licitação Aberta (Lei 14.133/21)" },
  { code: "PREGAO_ELETRONICO", label: "Pregão Eletrônico" },
  { code: "RDC", label: "Regime Diferenciado de Contratações (RDC)" },
  { code: "CONTRATACAO_DIRETA", label: "Contratação Direta" },
];

export default function PublicProcurementNewPage() {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const [formData, setFormData] = useState({
    title: "",
    organizationName: "UPA-CS",
    modalityCode: "LICITACAO_ABERTA",
    modalityLabel: "Licitação Aberta (Lei 14.133/21)",
    budgetEstimate: "",
    closureDate: "",
    description: "",
  });

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "modalityCode" && {
        modalityLabel:
          modalidades.find((m) => m.code === value)?.label ||
          "Selecione uma modalidade",
      }),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.closureDate) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/public-procurement")}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Novo Edital
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Crie um novo processo de compra pública
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Informações Básicas
          </h2>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Título do Edital *
              </label>
              <Input
                placeholder="Ex: Aquisição de Equipamentos de TI para 2026"
                value={formData.title}
                onChange={(e) =>
                  handleFieldChange("title", e.target.value)
                }
                required
                className="mt-1"
              />
            </div>

            {/* Organization */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Órgão/Instituição
              </label>
              <Input
                value={formData.organizationName}
                onChange={(e) =>
                  handleFieldChange("organizationName", e.target.value)
                }
                className="mt-1"
              />
            </div>

            {/* Modality */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Modalidade de Licitação
              </label>
              <select
                value={formData.modalityCode}
                onChange={(e) =>
                  handleFieldChange("modalityCode", e.target.value)
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                {modalidades.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Valor Orçado (R$)
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={formData.budgetEstimate}
                onChange={(e) =>
                  handleFieldChange("budgetEstimate", e.target.value)
                }
                step="0.01"
                className="mt-1"
              />
            </div>

            {/* Closure Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Data de Encerramento de Propostas *
              </label>
              <Input
                type="date"
                value={formData.closureDate}
                onChange={(e) =>
                  handleFieldChange("closureDate", e.target.value)
                }
                required
                className="mt-1"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Descrição Detalhada
              </label>
              <textarea
                placeholder="Descreva o escopo, objetivos e contexto do edital..."
                value={formData.description}
                onChange={(e) =>
                  handleFieldChange("description", e.target.value)
                }
                rows={4}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="rounded-lg border border-indigo-300 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-900/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
            <div className="text-sm text-indigo-900 dark:text-indigo-200">
              <p className="font-medium">Lei 14.133/21</p>
              <p className="mt-1 text-xs">
                Este edital está em conformidade com a Lei 14.133/21. Você
                poderá adicionar itens, checklists de conformidade e modelos
                de Termo de Referência após a criação.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="submit"
            loading={fetcher.state === "submitting"}
            className="flex gap-2"
          >
            <Save className="h-4 w-4" />
            Criar Edital
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/public-procurement")}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
