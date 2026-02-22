/**
 * Notifications Page
 * Display all notifications with mark as read functionality
 */

import { redirect } from "react-router";
import { Link, useLoaderData, useSubmit } from "react-router";
import { Bell, Check, CheckCheck, ArrowLeft } from "lucide-react";
import { db } from "~/lib/db.server";
import { notifications } from "../../drizzle/schema";
import { requireAuth } from "~/lib/auth.server";
import { eq, desc, and } from "drizzle-orm";

export async function loader({ request }: { request: Request }) {
  const { user } = await requireAuth(request);

  const allNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return {
    notifications: allNotifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function action({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "mark_read") {
    const notificationId = Number(formData.get("notificationId"));
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)));
  } else if (intent === "mark_all_read") {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, user.id));
  }

  return redirect("/notifications");
}

const typeIcon: Record<string, string> = {
  info: "ℹ️",
  success: "✅",
  warning: "⚠️",
  error: "❌",
  invoice: "💰",
  process: "📦",
  changelog: "🔔",
};

export default function NotificationsPage() {
  const { notifications: notificationsList } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const unreadCount = notificationsList.filter((n: any) => !n.read).length;

  const handleMarkRead = (notificationId: number) => {
    const formData = new FormData();
    formData.set("intent", "mark_read");
    formData.set("notificationId", String(notificationId));
    submit(formData, { method: "post" });
  };

  const handleMarkAllRead = () => {
    const formData = new FormData();
    formData.set("intent", "mark_all_read");
    submit(formData, { method: "post" });
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-gray-400" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Notificações</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {unreadCount > 0
                  ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}`
                  : "Todas as notificações lidas"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <CheckCheck className="h-4 w-4" />
              Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      {/* Notifications list */}
      <div className="space-y-3">
        {notificationsList.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
            <Bell className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              Nenhuma notificação
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Você receberá notificações sobre processos, vencimentos e atualizações do sistema.
            </p>
          </div>
        ) : (
          notificationsList.map((notif: any) => {
            return (
              <div
                key={notif.id}
                className={`group rounded-xl border bg-white p-4 shadow-sm transition-all dark:bg-gray-900 ${
                  !notif.read
                    ? "border-blue-200 bg-blue-50/30 dark:border-blue-900/50 dark:bg-blue-900/10"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 text-2xl">{typeIcon[notif.type] || "🔔"}</div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    {notif.link ? (
                      <Link to={notif.link} className="block transition-opacity hover:opacity-80">
                        <h3
                          className={`text-base font-semibold ${
                            notif.read
                              ? "text-gray-700 dark:text-gray-300"
                              : "text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          {notif.title}
                        </h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">
                          {notif.message}
                        </p>
                        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                          {new Date(notif.createdAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </Link>
                    ) : (
                      <div>
                        <h3
                          className={`text-base font-semibold ${
                            notif.read
                              ? "text-gray-700 dark:text-gray-300"
                              : "text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          {notif.title}
                        </h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">
                          {notif.message}
                        </p>
                        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                          {new Date(notif.createdAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Mark as read button */}
                  {!notif.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(notif.id);
                      }}
                      className="flex-shrink-0 rounded-lg p-2 text-gray-400 opacity-0 transition-all hover:bg-gray-100 hover:text-blue-600 group-hover:opacity-100 dark:hover:bg-gray-800 dark:hover:text-blue-400"
                      title="Marcar como lida"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
