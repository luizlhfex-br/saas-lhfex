import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { Bell, Check, CheckCheck, X } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // silent fail
    }
  };

  // Poll every 60s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const markAsRead = async (id: string) => {
    const formData = new FormData();
    formData.set("intent", "mark_read");
    formData.set("id", id);
    await fetch("/api/notifications", { method: "POST", body: formData });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.set("intent", "mark_all_read");
    await fetch("/api/notifications", { method: "POST", body: formData });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    setLoading(false);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const typeIcon: Record<string, string> = {
    process_status: "📦",
    invoice_due: "💰",
    eta_approaching: "🚢",
    automation: "⚡",
    system: "🔔",
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Notificações {unreadCount > 0 && <span className="text-gray-400">({unreadCount})</span>}
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={loading}
                  className="rounded-md p-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-700" />
                <p className="text-sm text-gray-400">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const content = (
                  <div
                    key={notif.id}
                    className={`flex gap-3 border-b border-gray-100 px-4 py-3 transition-colors dark:border-gray-800 ${
                      notif.read
                        ? "bg-white dark:bg-gray-900"
                        : "bg-blue-50/50 dark:bg-blue-900/10"
                    } hover:bg-gray-50 dark:hover:bg-gray-800`}
                  >
                    <span className="mt-0.5 text-lg">{typeIcon[notif.type] || "🔔"}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${notif.read ? "text-gray-700 dark:text-gray-300" : "font-medium text-gray-900 dark:text-gray-100"}`}>
                        {notif.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                        {notif.message}
                      </p>
                      <p className="mt-1 text-[10px] text-gray-400">{timeAgo(notif.createdAt)}</p>
                    </div>
                    {!notif.read && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          markAsRead(notif.id);
                        }}
                        className="shrink-0 self-start rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-blue-600 dark:hover:bg-gray-700"
                        title="Marcar como lida"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );

                return notif.link ? (
                  <Link key={notif.id} to={notif.link} onClick={() => { markAsRead(notif.id); setOpen(false); }}>
                    {content}
                  </Link>
                ) : (
                  content
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
