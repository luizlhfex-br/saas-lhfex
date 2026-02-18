import { Link, Form, useNavigation, useFetcher } from "react-router";
import type { Route } from "./+types/processes-detail";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { processes, clients, processTimeline, processDocuments } from "../../drizzle/schema";
import { t, type Locale } from "~/i18n";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Edit, Clock, FileText, Ship, DollarSign, Upload, Download, Trash2, File, Image, FileSpreadsheet, Sparkles, CheckCircle, XCircle, ShieldAlert, LoaderCircle } from "lucide-react";
import { eq, desc, and, isNull } from "drizzle-orm";
import { uploadFile } from "~/lib/storage.server";
import { logAudit } from "~/lib/audit.server";
import { redirect, data } from "react-router";
import { toast } from "sonner";
import { useState, useRef } from "react";

const statusColors: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  draft: "default", in_progress: "info", awaiting_docs: "warning", customs_clearance: "warning",
  in_transit: "info", delivered: "success", completed: "success", cancelled: "danger",
  pending_approval: "warning",
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const [process] = await db.select().from(processes)
    .where(and(eq(processes.id, params.id), isNull(processes.deletedAt)))
    .limit(1);
  if (!process) throw new Response("Not found", { status: 404 });

  const [[client], timeline, docs] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, process.clientId)).limit(1),
    db.select().from(processTimeline).where(eq(processTimeline.processId, params.id)).orderBy(desc(processTimeline.createdAt)),
    db.select().from(processDocuments).where(eq(processDocuments.processId, params.id)).orderBy(desc(processDocuments.createdAt)),
  ]);

  return { locale, process, client, timeline, documents: docs, userId: user.id };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "upload") {
    const file = formData.get("file") as File;
    const docType = formData.get("docType") as string || "other";

    if (!file || file.size === 0) {
      return data({ error: "No file selected" }, { status: 400 });
    }

    try {
      const { key, url, size } = await uploadFile(file, `processes/${params.id}`);

      await db.insert(processDocuments).values({
        processId: params.id,
        name: file.name,
        type: docType,
        fileUrl: url,
        fileSize: size,
        uploadedBy: user.id,
      });

      await logAudit({
        userId: user.id,
        action: "upload",
        entity: "document",
        entityId: params.id,
        changes: { fileName: file.name, type: docType, size },
        request,
      });

      return redirect(`/processes/${params.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      return data({ error: message }, { status: 400 });
    }
  }

  if (intent === "delete-doc") {
    const docId = formData.get("docId") as string;

    await db.delete(processDocuments).where(eq(processDocuments.id, docId));

    await logAudit({
      userId: user.id,
      action: "delete",
      entity: "document",
      entityId: docId,
      changes: { processId: params.id },
      request,
    });

    return redirect(`/processes/${params.id}`);
  }

  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return <Image className="h-5 w-5 text-purple-500" />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  if (ext === "pdf") return <FileText className="h-5 w-5 text-red-500" />;
  return <File className="h-5 w-5 text-gray-500" />;
}

export default function ProcessesDetailPage({ loaderData, actionData }: Route.ComponentProps) {
  const { locale, process: proc, client, timeline, documents } = loaderData;
  const i18n = t(locale);
  const navigation = useNavigation();
  const isUploading = navigation.state === "submitting" && navigation.formData?.get("intent") === "upload";
  const error = (actionData as { error?: string })?.error;
  const approvalFetcher = useFetcher();
  const ocrFetcher = useFetcher<{ fields?: Record<string, string>; preview?: string; error?: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isApproving = approvalFetcher.state === "submitting";
  const isExtracting = ocrFetcher.state === "submitting";

  // Show OCR result as toast when done
  const ocrData = ocrFetcher.data;
  if (ocrData?.fields && Object.keys(ocrData.fields).length > 0) {
    const fieldNames = Object.keys(ocrData.fields).join(", ");
    toast.success(`IA extraiu: ${fieldNames}`);
  }
  if (ocrData?.error) {
    toast.error(`Erro OCR: ${ocrData.error}`);
  }

  const handleOCR = () => {
    if (!selectedFile) return;
    const fd = new FormData();
    fd.append("file", selectedFile);
    ocrFetcher.submit(fd, { method: "post", action: "/api/ocr-extract", encType: "multipart/form-data" });
  };

  const statusLabels: Record<string, string> = {
    draft: i18n.processes.draft, in_progress: i18n.processes.inProgress,
    awaiting_docs: i18n.processes.awaitingDocs, customs_clearance: i18n.processes.customsClearance,
    in_transit: i18n.processes.inTransit, delivered: i18n.processes.delivered,
    completed: i18n.processes.completed, cancelled: i18n.processes.cancelled,
    pending_approval: "Aguardando Aprovação",
  };

  const processTypeLabel =
    proc.processType === "import" ? i18n.processes.import
    : proc.processType === "export" ? i18n.processes.export
    : i18n.processes.services;

  const processTypeBadgeVariant =
    proc.processType === "import" ? "info"
    : proc.processType === "export" ? "success"
    : ("default" as const);

  const docTypeLabels: Record<string, string> = {
    invoice: i18n.documents.invoice,
    packing_list: i18n.documents.packingList,
    bl: i18n.documents.bl,
    di: i18n.documents.di,
    certificate: i18n.documents.certificate,
    other: i18n.documents.other,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/processes" className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{proc.reference}</h1>
              <Badge variant={statusColors[proc.status]}>{statusLabels[proc.status]}</Badge>
              <Badge variant={processTypeBadgeVariant}>{processTypeLabel}</Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{client?.razaoSocial}</p>
          </div>
        </div>
        <Link to={`/processes/${proc.id}/edit`}>
          <Button variant="outline"><Edit className="h-4 w-4" />{i18n.common.edit}</Button>
        </Link>
      </div>

      {/* Banner de Aprovação */}
      {proc.status === "pending_approval" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">Processo aguardando aprovação</p>
                <p className="text-sm text-amber-700 dark:text-amber-400">Aprove ou rejeite para que o processo prossiga.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <approvalFetcher.Form method="post" action="/api/approve-process">
                <input type="hidden" name="processId" value={proc.id} />
                <input type="hidden" name="action" value="approve" />
                <button
                  type="submit"
                  disabled={isApproving}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-60"
                >
                  {isApproving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Aprovar
                </button>
              </approvalFetcher.Form>
              <approvalFetcher.Form method="post" action="/api/approve-process">
                <input type="hidden" name="processId" value={proc.id} />
                <input type="hidden" name="action" value="reject" />
                <button
                  type="submit"
                  disabled={isApproving}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:bg-transparent dark:text-red-400"
                >
                  {isApproving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Rejeitar
                </button>
              </approvalFetcher.Form>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* General Info */}
        <Card title="Informações Gerais" icon={<FileText className="h-5 w-5" />}>
          <InfoRow label={i18n.processes.client} value={client?.nomeFantasia || client?.razaoSocial || "-"} />
          <InfoRow label={i18n.processes.description} value={proc.description || "-"} />
          <InfoRow label={i18n.processes.hsCode} value={proc.hsCode || "-"} />
          <InfoRow label={i18n.processes.incoterm} value={proc.incoterm || "-"} />
          <InfoRow label={i18n.processes.customsBroker} value={proc.customsBroker || "-"} />
          <InfoRow label={i18n.processes.diNumber} value={proc.diNumber || "-"} />
        </Card>

        {/* Logistics */}
        <Card title="Logística" icon={<Ship className="h-5 w-5" />}>
          <InfoRow label={i18n.processes.originCountry} value={proc.originCountry || "-"} />
          <InfoRow label={i18n.processes.destinationCountry} value={proc.destinationCountry || "-"} />
          <InfoRow label={i18n.processes.portOfOrigin} value={proc.portOfOrigin || "-"} />
          <InfoRow label={i18n.processes.portOfDestination} value={proc.portOfDestination || "-"} />
          <InfoRow label={i18n.processes.vessel} value={proc.vessel || "-"} />
          <InfoRow label={i18n.processes.bl} value={proc.bl || "-"} />
          <InfoRow label={i18n.processes.containerType} value={proc.containerType ? `${proc.containerCount || 1}x ${proc.containerType}` : "-"} />
        </Card>

        {/* Values */}
        <Card title="Valores" icon={<DollarSign className="h-5 w-5" />}>
          <InfoRow label={i18n.processes.totalValue} value={proc.totalValue ? `${proc.currency} ${Number(proc.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"} />
          <InfoRow label={i18n.processes.totalWeight} value={proc.totalWeight ? `${Number(proc.totalWeight).toLocaleString("pt-BR")} kg` : "-"} />
          <InfoRow label={i18n.processes.etd} value={proc.etd ? new Date(proc.etd).toLocaleDateString("pt-BR") : "-"} />
          <InfoRow label={i18n.processes.eta} value={proc.eta ? new Date(proc.eta).toLocaleDateString("pt-BR") : "-"} />
          <InfoRow label={i18n.processes.actualDeparture} value={proc.actualDeparture ? new Date(proc.actualDeparture).toLocaleDateString("pt-BR") : "-"} />
          <InfoRow label={i18n.processes.actualArrival} value={proc.actualArrival ? new Date(proc.actualArrival).toLocaleDateString("pt-BR") : "-"} />
        </Card>

        {/* Timeline */}
        <Card title={i18n.processes.timeline} icon={<Clock className="h-5 w-5" />}>
          {timeline.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum evento registrado</p>
          ) : (
            <div className="space-y-4">
              {timeline.map((entry) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.title}</p>
                    {entry.description && <p className="text-xs text-gray-500 dark:text-gray-400">{entry.description}</p>}
                    <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(entry.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Documents Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{i18n.processes.documents}</h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">{documents.length}</span>
          </div>
        </div>

        {/* Upload Form */}
        <Form method="post" encType="multipart/form-data" className="mb-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <input type="hidden" name="intent" value="upload" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.documents.upload}</label>
              <input
                ref={fileInputRef}
                type="file"
                name="file"
                required
                accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc,.csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-gray-400 dark:file:bg-blue-900/30 dark:file:text-blue-400"
              />
              <p className="mt-1 text-xs text-gray-400">{i18n.documents.maxSize} • {i18n.documents.allowedTypes}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.documents.type}</label>
              <select name="docType" className="block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                <option value="invoice">{i18n.documents.invoice}</option>
                <option value="packing_list">{i18n.documents.packingList}</option>
                <option value="bl">{i18n.documents.bl}</option>
                <option value="di">{i18n.documents.di}</option>
                <option value="certificate">{i18n.documents.certificate}</option>
                <option value="other">{i18n.documents.other}</option>
              </select>
            </div>
            {/* Botão OCR — só habilitado para PDF */}
            <button
              type="button"
              onClick={handleOCR}
              disabled={!selectedFile || !selectedFile.name.endsWith(".pdf") || isExtracting}
              title={selectedFile?.name.endsWith(".pdf") ? "Extrair dados do PDF com IA" : "Selecione um arquivo PDF para extrair"}
              className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
            >
              {isExtracting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isExtracting ? "Extraindo..." : "Extrair com IA"}
            </button>
            <Button type="submit" disabled={isUploading}>
              <Upload className="h-4 w-4" />
              {isUploading ? i18n.documents.uploading : i18n.documents.upload}
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </Form>

        {/* Document List */}
        {documents.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-4">{i18n.documents.noDocuments}</p>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {getFileIcon(doc.name)}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{doc.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {docTypeLabels[doc.type || "other"] || doc.type} • {formatFileSize(doc.fileSize || 0)} • {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`/api/document/${doc.id}/download`} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20">
                    <Download className="h-4 w-4" />
                  </a>
                  <Form method="post" onSubmit={(e) => { if (!confirm(i18n.documents.deleteConfirm)) e.preventDefault(); }}>
                    <input type="hidden" name="intent" value="delete-doc" />
                    <input type="hidden" name="docId" value={doc.id} />
                    <button type="submit" className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {proc.notes && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Observações</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{proc.notes}</p>
        </div>
      )}
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center gap-2 text-gray-500"><span>{icon}</span><h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3></div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}
