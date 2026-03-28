import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

type OperationalHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function OperationalHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
  className,
}: OperationalHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[30px] border border-[var(--app-border-strong)] bg-[linear-gradient(135deg,#081222_0%,#13263d_55%,#231833_100%)] px-6 py-6 text-slate-100 shadow-[0_28px_70px_rgba(15,23,42,0.18)] lg:px-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.14),transparent_28%)]" />
      <div className={cn("relative z-10 grid gap-6", aside ? "xl:grid-cols-[1.55fr_1fr]" : "")}>
        <div>
          {eyebrow ? (
            <span className="rounded-full border border-cyan-400/16 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white lg:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
          ) : null}
          {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">{aside}</div> : null}
      </div>
    </section>
  );
}

type OperationalStatProps = {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  className?: string;
};

export function OperationalStat({
  label,
  value,
  description,
  className,
}: OperationalStatProps) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] p-5 shadow-[var(--app-card-shadow)]",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-muted)]">{label}</p>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-[var(--app-text)]">{value}</div>
      {description ? <div className="mt-2 text-sm text-[var(--app-muted)]">{description}</div> : null}
    </div>
  );
}

type OperationalPanelProps = {
  title: string;
  icon?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function OperationalPanel({
  title,
  icon,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: OperationalPanelProps) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] p-6 shadow-[var(--app-card-shadow)]",
        className,
      )}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {icon ? (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/16 bg-cyan-400/10 text-cyan-700 dark:text-cyan-200">
              {icon}
            </div>
          ) : null}
          <div>
            <h2 className="text-lg font-semibold text-[var(--app-text)]">{title}</h2>
            {description ? <p className="mt-1 text-sm text-[var(--app-muted)]">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className={cn("space-y-4", bodyClassName)}>{children}</div>
    </section>
  );
}
