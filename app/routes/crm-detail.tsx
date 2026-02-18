import { useState } from "react";
import { Link, Form, redirect, useNavigation, useSubmit } from "react-router";
import type { Route } from "./+types/crm-detail";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { clients, contacts, auditLogs } from "../../drizzle/schema";
import { eq, isNull, and } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { Breadcrumb } from "~/components/ui/breadcrumb";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { formatCNPJ } from "~/lib/utils";
import { data } from "react-router";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Building2,
  Mail,
  Phone,
  MapPin,
  User,
  Star,
  Plus,
} from "lucide-react";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, params.id), isNull(clients.deletedAt)))
    .limit(1);

  if (!client) {
    throw new Response("Not Found", { status: 404 });
  }

  const clientContacts = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.clientId, params.id), isNull(contacts.deletedAt)))
    .orderBy(contacts.name);

  return { client, contacts: clientContacts, locale };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    // Soft delete
    await db
      .update(clients)
      .set({ deletedAt: new Date() })
      .where(eq(clients.id, params.id));

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
  const { client, contacts: clientContacts, locale } = loaderData;
  const navigation = useNavigation();
  const submit = useSubmit();
  const i18n = t(locale);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  const typeBadge = (type: string) => {
    const labels: Record<string, string> = {
      importer: i18n.crm.importer,
      exporter: i18n.crm.exporter,
      both: i18n.crm.both,
    };
    return (
      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
        {labels[type] || type}
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

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/crm"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {client.razaoSocial}
            </h1>
            {client.nomeFantasia && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {client.nomeFantasia}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/crm/${client.id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4" />
              {i18n.common.edit}
            </Button>
          </Link>
          <Button
            variant="danger"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4" />
            {i18n.common.delete}
          </Button>
        </div>
      </div>

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Client info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              <Building2 className="h-5 w-5 text-gray-400" />
              Dados da Empresa
            </h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoItem label={i18n.crm.cnpj} value={formatCNPJ(client.cnpj)} />
              <InfoItem label={i18n.crm.clientType} value={typeBadge(client.clientType)} isNode />
              <InfoItem label={i18n.common.status} value={statusBadge(client.status)} isNode />
              {client.ramoAtividade && (
                <InfoItem label={i18n.crm.ramoAtividade} value={client.ramoAtividade} />
              )}
              {client.monthlyVolume && (
                <InfoItem label={i18n.crm.monthlyVolume} value={client.monthlyVolume} />
              )}
              {client.preferredCurrency && (
                <InfoItem label={i18n.crm.preferredCurrency} value={client.preferredCurrency} />
              )}
              {client.preferredIncoterm && (
                <InfoItem label={i18n.crm.preferredIncoterm} value={client.preferredIncoterm} />
              )}
            </dl>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              <MapPin className="h-5 w-5 text-gray-400" />
              Contato e Endereco
            </h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {client.email && (
                <InfoItem
                  label={i18n.crm.email}
                  value={
                    <a
                      href={`mailto:${client.email}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {client.email}
                    </a>
                  }
                  isNode
                />
              )}
              {client.phone && (
                <InfoItem label={i18n.crm.phone} value={client.phone} />
              )}
              {client.address && (
                <InfoItem label={i18n.crm.address} value={client.address} />
              )}
              {(client.city || client.state) && (
                <InfoItem
                  label={i18n.crm.city}
                  value={[client.city, client.state].filter(Boolean).join(" - ")}
                />
              )}
              {client.zipCode && (
                <InfoItem label={i18n.crm.zipCode} value={client.zipCode} />
              )}
            </dl>
          </div>

          {client.notes && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {i18n.crm.notes}
              </h2>
              <p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">
                {client.notes}
              </p>
            </div>
          )}
        </div>

        {/* Contacts sidebar */}
        <div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                <User className="h-5 w-5 text-gray-400" />
                {i18n.crm.contacts}
              </h2>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  {clientContacts.length}
                </span>
                <Link
                  to={`/crm/${client.id}/contacts/new`}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {i18n.crm.newContact}
                </Link>
              </div>
            </div>

            {clientContacts.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Nenhum contato cadastrado.
              </p>
            ) : (
              <div className="space-y-3">
                {clientContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="rounded-lg border border-gray-100 p-3 dark:border-gray-800"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {contact.name}
                          </p>
                          {contact.isPrimary && (
                            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          )}
                        </div>
                        {contact.role && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {contact.role}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {contact.email && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  isNode,
}: {
  label: string;
  value: React.ReactNode;
  isNode?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
        {value}
      </dd>
    </div>
  );
}
