import { useState, type ReactNode } from "react";
import { Form, Link, redirect, useActionData, useNavigation, useSubmit } from "react-router";
import type { Route } from "./+types/crm-detail";
import { requireAuth } from "~/lib/auth.server";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import { db } from "~/lib/db.server";
import { clients, contacts, auditLogs } from "../../drizzle/schema";
import { eq, isNull, and } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { Breadcrumb } from "~/components/ui/breadcrumb";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { OperationalHero, OperationalPanel, OperationalStat } from "~/components/ui/operational-page";
import { formatCNPJ } from "~/lib/utils";
import { data } from "react-router";
import { enrichClientById } from "~/lib/client-enrichment.server";
import {
  ArrowLeft,
  Bot,
  Edit,
  Trash2,
  Building2,
  FileText,
  Loader2,
  Mail,
  Phone,
  MapPin,
  User,
  Star,
  Plus,
} from "lucide-react";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, params.id), eq(clients.companyId, companyId), isNull(clients.deletedAt)))
    .limit(1);

  if (!client) {
    throw new Response("Not Found", { status: 404 });
  }

  const clientContactsRows = await db
    .select({ contact: contacts })
    .from(contacts)
    .innerJoin(clients, eq(contacts.clientId, clients.id))
    .where(
      and(
        eq(contacts.clientId, params.id),
        eq(clients.companyId, companyId),
        isNull(contacts.deletedAt),
        isNull(clients.deletedAt),
      ),
    )
    .orderBy(contacts.name);

  const url = new URL(request.url);
  return {
    client,
    contacts: clientContactsRows.map(({ contact }) => contact),
    locale,
    enriched: url.searchParams.get("enriched") === "1",
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "enrich_cnpj") {
    try {
      await enrichClientById({
        clientId: params.id,
        companyId,
        userId: user.id,
        overwriteExisting: true,
        requestMeta: {
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
        },
      });
      return redirect(`/crm/${params.id}?enriched=1`);
    } catch (error) {
      if (error instanceof Response) throw error;
      return data(
        {
          enrichError: error instanceof Error ? error.message : "Nao foi possivel enriquecer este CNPJ agora.",
        },
        { status: 400 },
      );
    }
  }

  if (intent === "delete") {
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, params.id), eq(clients.companyId, companyId), isNull(clients.deletedAt)))
      .limit(1);

    if (!client) {
      throw new Response("Not Found", { status: 404 });
    }

    // Soft delete
    await db
      .update(clients)
      .set({ deletedAt: new Date() })
      .where(and(eq(clients.id, params.id), eq(clients.companyId, companyId)));

    await db.insert(auditLogs).values({
      userId: user.id,
      action: "delete",
      entity: "client",
      entityId: params.id,
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    throw redirect("/crm");
  }

  return data({ error: "Unknown action" }, { status: 400 });
}

export default function CrmDetailPage({ loaderData }: Route.ComponentProps) {
  const { client, contacts: clientContacts, locale, enriched } = loaderData;
  const actionData = (useActionData<typeof action>() ?? {}) as {
    enrichError?: string;
  };
  const navigation = useNavigation();
  const submit = useSubmit();
  const i18n = t(locale);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isEnriching = navigation.state === "submitting" && navigation.formData?.get("intent") === "enrich_cnpj";

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
      inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
      prospect: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
    };
    const labels: Record<string, string> = {
      active: i18n.common.active,
      inactive: i18n.common.inactive,
      prospect: i18n.crm.prospect,
    };
    return (
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.active}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: i18n.nav.crm, to: "/crm" },
          { label: client.razaoSocial },
        ]}
      />

      <OperationalHero
        eyebrow="Relacionamento"
        title={client.razaoSocial}
        description={
          client.nomeFantasia
            ? `${client.nomeFantasia} · carteira ativa com leitura central de empresa, contato e contexto operacional.`
            : "Carteira ativa com leitura central de empresa, contato e contexto operacional."
        }
        actions={
          <>
            <Link
              to="/crm"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para CRM
            </Link>
            <Link to={`/crm/${client.id}/edit`}>
              <Button variant="outline" className="border-white/12 bg-white/6 text-white hover:bg-white/10">
                <Edit className="h-4 w-4" />
                {i18n.common.edit}
              </Button>
            </Link>
            <Form method="post">
              <input type="hidden" name="intent" value="enrich_cnpj" />
              <Button type="submit" variant="outline" className="border-white/12 bg-white/6 text-white hover:bg-white/10" loading={isEnriching}>
                {isEnriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                Enriquecer com IA
              </Button>
            </Form>
            <Button variant="danger" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4" />
              {i18n.common.delete}
            </Button>
          </>
        }
        aside={
          <>
            <OperationalStat
              label={i18n.crm.cnpj}
              value={formatCNPJ(client.cnpj)}
              description="Documento principal da empresa."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label={i18n.crm.contacts}
              value={String(clientContacts.length)}
              description="Contatos operacionais registrados."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label={i18n.common.status}
              value={statusBadge(client.status)}
              description="Status comercial atual."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label="Base"
              value={[client.city, client.state].filter(Boolean).join(" / ") || "Nao informado"}
              description="Local usado como contexto rapido."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
          </>
        }
      />

      {enriched ? (
        <div className="rounded-[22px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
          Dados cadastrais atualizados pelo enriquecimento de CNPJ.
        </div>
      ) : null}
      {actionData.enrichError ? (
        <div className="rounded-[22px] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {actionData.enrichError}
        </div>
      ) : null}

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={i18n.common.delete}
        description={i18n.crm.deleteConfirm}
        confirmLabel={i18n.common.delete}
        cancelLabel={i18n.common.cancel}
        onConfirm={() => {
          const formData = new FormData();
          formData.set("intent", "delete");
          submit(formData, { method: "post" });
        }}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-6">
          <OperationalPanel
            title="Dados da empresa"
            icon={<Building2 className="h-5 w-5" />}
            description="Leitura central de documento, CNAE e status comercial."
            bodyClassName="grid gap-4 sm:grid-cols-2"
          >
            <InfoItem label={i18n.crm.cnpj} value={formatCNPJ(client.cnpj)} />
            <InfoItem label={i18n.common.status} value={statusBadge(client.status)} />
            <InfoItem label={i18n.crm.cnaeCode} value={client.cnaeCode || "Nao informado"} />
            <InfoItem label={i18n.crm.cnaeDescription} value={client.cnaeDescription || "Nao informado"} />
          </OperationalPanel>

          <OperationalPanel
            title="Endereco e base operacional"
            icon={<MapPin className="h-5 w-5" />}
            description="Localizacao de referencia para prospeccao, atendimento e operacao."
            bodyClassName="grid gap-4 sm:grid-cols-2"
          >
            <InfoItem label={i18n.crm.address} value={client.address || "Nao informado"} />
            <InfoItem label={i18n.crm.city} value={[client.city, client.state].filter(Boolean).join(" / ") || "Nao informado"} />
            <InfoItem label={i18n.crm.zipCode} value={client.zipCode || "Nao informado"} />
            <InfoItem label="Perfil" value={client.clientType || "importer"} />
          </OperationalPanel>

          <OperationalPanel
            title="Anotacoes"
            icon={<FileText className="h-5 w-5" />}
            description="Contexto livre salvo junto ao cliente."
          >
            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--app-muted)]">
              {client.notes || "Nenhuma observacao registrada para este cliente."}
            </p>
          </OperationalPanel>
        </div>

        <OperationalPanel
          title={i18n.crm.contacts}
          icon={<User className="h-5 w-5" />}
          description="Quem aciona, responde e concentra a relacao com a empresa."
          actions={
            <Link to={`/crm/${client.id}/contacts/new`}>
              <Button variant="outline">
                <Plus className="h-4 w-4" />
                {i18n.crm.newContact}
              </Button>
            </Link>
          }
        >
          {clientContacts.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-5 py-10 text-center text-sm text-[var(--app-muted)]">
              Nenhum contato cadastrado.
            </div>
          ) : (
            <div className="space-y-3">
              {clientContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="rounded-[22px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--app-text)]">{contact.name}</p>
                        {contact.isPrimary ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-400/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">
                            <Star className="h-3 w-3 fill-current" />
                            Principal
                          </span>
                        ) : null}
                      </div>
                      {contact.role ? (
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">{contact.role}</p>
                      ) : null}
                    </div>
                    <Link
                      to={`/crm/${client.id}/contacts/${contact.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-2)]"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Editar
                    </Link>
                  </div>

                  <div className="mt-4 space-y-2">
                    {contact.email ? (
                      <div className="flex items-center gap-2 text-sm text-[var(--app-muted)]">
                        <Mail className="h-4 w-4" />
                        {contact.email}
                      </div>
                    ) : null}
                    {contact.phone ? (
                      <div className="flex items-center gap-2 text-sm text-[var(--app-muted)]">
                        <Phone className="h-4 w-4" />
                        {contact.phone}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </OperationalPanel>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">
        {label}
      </dt>
      <dd className="mt-2 text-sm text-[var(--app-text)]">
        {value}
      </dd>
    </div>
  );
}
