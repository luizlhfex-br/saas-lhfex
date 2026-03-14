type SubscriptionLike = {
  dueDate: string | null;
  dueDay: number | null;
  recurrence: string | null;
  status: string | null;
  valueAmount?: string | number | null;
  valueCurrency?: string | null;
};

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function buildMonthlyDueDate(referenceDate: Date, dueDay: number) {
  const currentMonthDay = Math.min(dueDay, daysInMonth(referenceDate.getFullYear(), referenceDate.getMonth()));
  const currentMonthDue = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), currentMonthDay);

  if (currentMonthDue >= new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())) {
    return currentMonthDue;
  }

  const nextMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  const nextMonthDay = Math.min(dueDay, daysInMonth(nextMonth.getFullYear(), nextMonth.getMonth()));
  return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextMonthDay);
}

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveSubscriptionNextDueDate(
  subscription: SubscriptionLike,
  referenceDate = new Date(),
): string | null {
  if (subscription.dueDate) {
    return subscription.dueDate;
  }

  if (subscription.recurrence === "monthly" && subscription.dueDay) {
    return toDateOnly(buildMonthlyDueDate(referenceDate, subscription.dueDay));
  }

  return null;
}

export function getSubscriptionHealth(
  subscription: SubscriptionLike,
  referenceDate = new Date(),
): {
  emoji: string;
  label: string;
  level: "ok" | "warning" | "overdue" | "paused" | "cancelled" | "unknown";
  nextDueDate: string | null;
  daysUntil: number | null;
} {
  if (subscription.status === "cancelled") {
    return {
      emoji: "⚪",
      label: "Cancelado",
      level: "cancelled",
      nextDueDate: resolveSubscriptionNextDueDate(subscription, referenceDate),
      daysUntil: null,
    };
  }

  if (subscription.status === "paused") {
    return {
      emoji: "⏸️",
      label: "Pausado",
      level: "paused",
      nextDueDate: resolveSubscriptionNextDueDate(subscription, referenceDate),
      daysUntil: null,
    };
  }

  const nextDueDate = resolveSubscriptionNextDueDate(subscription, referenceDate);
  if (!nextDueDate) {
    return {
      emoji: "⚪",
      label: "Sem vencimento definido",
      level: "unknown",
      nextDueDate: null,
      daysUntil: null,
    };
  }

  const baseDate = new Date(`${nextDueDate}T00:00:00`);
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const daysUntil = Math.round((baseDate.getTime() - today.getTime()) / 86400000);

  if (daysUntil < 0) {
    return {
      emoji: "🔴",
      label: "Vencido",
      level: "overdue",
      nextDueDate,
      daysUntil,
    };
  }

  if (daysUntil <= 7) {
    return {
      emoji: "🟡",
      label: "Vence em ate 7 dias",
      level: "warning",
      nextDueDate,
      daysUntil,
    };
  }

  return {
    emoji: "🟢",
    label: "OK",
    level: "ok",
    nextDueDate,
    daysUntil,
  };
}

export function summarizeSubscriptionTotals(subscriptions: SubscriptionLike[]) {
  return subscriptions.reduce(
    (acc, subscription) => {
      if (subscription.status !== "active") return acc;

      const currency = (subscription.valueCurrency || "BRL").toUpperCase();
      const amount = Number(subscription.valueAmount || 0);

      if (currency === "USD") {
        acc.usd += amount;
      } else {
        acc.brl += amount;
      }

      return acc;
    },
    { brl: 0, usd: 0 },
  );
}
