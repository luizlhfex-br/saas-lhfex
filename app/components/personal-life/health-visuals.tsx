import { cn } from "~/lib/utils";

type Pose = "front" | "side" | "back";

function FigureFront() {
  return (
    <svg viewBox="0 0 220 360" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="skin-front" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f7d4b0" />
          <stop offset="100%" stopColor="#f2c08d" />
        </linearGradient>
      </defs>
      <rect width="220" height="360" fill="#f8fafc" />
      <circle cx="110" cy="44" r="24" fill="#6b3f1f" />
      <circle cx="110" cy="58" r="22" fill="url(#skin-front)" />
      <rect x="91" y="80" width="38" height="26" rx="16" fill="url(#skin-front)" />
      <path d="M78 108c7-18 57-18 64 0l10 88c2 17-7 29-22 29h-40c-15 0-24-12-22-29l10-88Z" fill="url(#skin-front)" />
      <path d="M65 118c-10 8-22 32-18 55l8 42c2 9 12 12 18 6l6-6-7-45 12-26-19-26Z" fill="url(#skin-front)" />
      <path d="M155 118c10 8 22 32 18 55l-8 42c-2 9-12 12-18 6l-6-6 7-45-12-26 19-26Z" fill="url(#skin-front)" />
      <path d="M87 224h46l7 63c2 17-10 31-27 31h-6c-17 0-29-14-27-31l7-63Z" fill="#111827" />
      <path d="M93 287c-11 8-18 34-17 57l1 12c1 6 8 8 13 4l6-6 5-57-8-10Z" fill="url(#skin-front)" />
      <path d="M127 287c11 8 18 34 17 57l-1 12c-1 6-8 8-13 4l-6-6-5-57 8-10Z" fill="url(#skin-front)" />
      <ellipse cx="77" cy="215" rx="10" ry="8" fill="url(#skin-front)" />
      <ellipse cx="143" cy="215" rx="10" ry="8" fill="url(#skin-front)" />
      <ellipse cx="94" cy="355" rx="12" ry="6" fill="#f2c08d" />
      <ellipse cx="126" cy="355" rx="12" ry="6" fill="#f2c08d" />
    </svg>
  );
}

function FigureSide() {
  return (
    <svg viewBox="0 0 220 360" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="skin-side" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f7d4b0" />
          <stop offset="100%" stopColor="#f2c08d" />
        </linearGradient>
      </defs>
      <rect width="220" height="360" fill="#f8fafc" />
      <path d="M99 44c3-16 33-16 43 0l6 16-16 10-28-6-5-20Z" fill="#6b3f1f" />
      <ellipse cx="124" cy="61" rx="22" ry="24" fill="url(#skin-side)" />
      <path d="M112 88c14-1 27 6 30 17l5 90c1 17-7 30-23 30h-18c-7 0-12-5-11-12l6-91c1-20 5-33 11-34Z" fill="url(#skin-side)" />
      <path d="M118 214h33l4 70c1 15-9 27-23 27h-10c-13 0-23-11-22-24l3-73Z" fill="#111827" />
      <path d="M116 287c-6 11-9 37-7 62l1 8c1 5 7 7 11 4l6-4 4-64-15-6Z" fill="url(#skin-side)" />
      <path d="M144 287c6 11 9 37 7 62l-1 8c-1 5-7 7-11 4l-6-4-4-64 15-6Z" fill="url(#skin-side)" />
      <path d="M100 140c-7 12-11 31-8 51l7 32c2 7 11 10 16 4l4-4-6-34 5-22-18-27Z" fill="url(#skin-side)" />
      <ellipse cx="115" cy="358" rx="11" ry="6" fill="#f2c08d" />
      <ellipse cx="143" cy="358" rx="11" ry="6" fill="#f2c08d" />
    </svg>
  );
}

function FigureBack() {
  return (
    <svg viewBox="0 0 220 360" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="skin-back" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f7d4b0" />
          <stop offset="100%" stopColor="#f2c08d" />
        </linearGradient>
      </defs>
      <rect width="220" height="360" fill="#f8fafc" />
      <ellipse cx="110" cy="52" rx="26" ry="28" fill="#6b3f1f" />
      <rect x="92" y="79" width="36" height="28" rx="15" fill="url(#skin-back)" />
      <path d="M76 109c7-18 61-18 68 0l12 91c2 16-8 28-23 28H87c-15 0-25-12-23-28l12-91Z" fill="url(#skin-back)" />
      <path d="M65 124c-9 10-17 32-14 53l8 39c2 9 12 12 18 6l7-7-8-43 8-27-19-21Z" fill="url(#skin-back)" />
      <path d="M155 124c9 10 17 32 14 53l-8 39c-2 9-12 12-18 6l-7-7 8-43-8-27 19-21Z" fill="url(#skin-back)" />
      <path d="M86 225h48l7 66c1 15-11 28-27 28h-8c-16 0-28-13-27-28l7-66Z" fill="#111827" />
      <path d="M91 289c-11 8-18 36-17 60v9c1 5 7 7 11 5l7-4 8-65-9-5Z" fill="url(#skin-back)" />
      <path d="M129 289c11 8 18 36 17 60v9c-1 5-7 7-11 5l-7-4-8-65 9-5Z" fill="url(#skin-back)" />
      <ellipse cx="76" cy="214" rx="10" ry="8" fill="url(#skin-back)" />
      <ellipse cx="144" cy="214" rx="10" ry="8" fill="url(#skin-back)" />
      <ellipse cx="94" cy="356" rx="12" ry="6" fill="#f2c08d" />
      <ellipse cx="126" cy="356" rx="12" ry="6" fill="#f2c08d" />
    </svg>
  );
}

export function BodyPoseIllustration({ pose, className }: { pose: Pose; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[28px] border border-[var(--app-border)] bg-white", className)}>
      {pose === "front" ? <FigureFront /> : pose === "side" ? <FigureSide /> : <FigureBack />}
    </div>
  );
}

export function BodyMeasurementGuide({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[28px] border border-[var(--app-border)] bg-white p-4", className)}>
      <svg viewBox="0 0 360 520" className="h-full w-full" aria-hidden="true">
        <rect width="360" height="520" fill="#f8fafc" />
        <ellipse cx="180" cy="72" rx="34" ry="38" fill="#d1d5db" />
        <rect x="154" y="107" width="52" height="32" rx="16" fill="#d1d5db" />
        <path d="M128 140c10-24 94-24 104 0l16 138c3 26-11 44-36 44h-64c-25 0-39-18-36-44l16-138Z" fill="#d1d5db" />
        <path d="M112 162c-16 12-29 44-24 74l10 54c2 11 15 16 23 8l8-7-10-58 11-36-18-35Z" fill="#d1d5db" />
        <path d="M248 162c16 12 29 44 24 74l-10 54c-2 11-15 16-23 8l-8-7 10-58-11-36 18-35Z" fill="#d1d5db" />
        <path d="M142 323h76l12 104c2 25-15 46-40 46h-20c-25 0-42-21-40-46l12-104Z" fill="#d1d5db" />
        <path d="M146 426c-16 15-23 39-20 71l1 13c1 8 10 11 16 7l8-5 12-81-17-5Z" fill="#d1d5db" />
        <path d="M214 426c16 15 23 39 20 71l-1 13c-1 8-10 11-16 7l-8-5-12-81 17-5Z" fill="#d1d5db" />

        <ellipse cx="180" cy="122" rx="58" ry="10" fill="none" stroke="#ef4444" strokeWidth="4" />
        <ellipse cx="180" cy="194" rx="78" ry="12" fill="none" stroke="#ef4444" strokeWidth="4" />
        <ellipse cx="180" cy="262" rx="66" ry="12" fill="none" stroke="#ef4444" strokeWidth="4" />
        <ellipse cx="180" cy="304" rx="78" ry="12" fill="none" stroke="#ef4444" strokeWidth="4" />
        <ellipse cx="105" cy="184" rx="18" ry="48" fill="none" stroke="#ef4444" strokeWidth="4" transform="rotate(64 105 184)" />
        <ellipse cx="240" cy="360" rx="44" ry="12" fill="none" stroke="#ef4444" strokeWidth="4" />
        <ellipse cx="238" cy="455" rx="38" ry="10" fill="none" stroke="#ef4444" strokeWidth="4" />

        <g fill="#111827" fontSize="17" fontWeight="700">
          <text x="264" y="127">Pescoco</text>
          <text x="274" y="197">Torax</text>
          <text x="276" y="267">Cintura</text>
          <text x="272" y="309">Quadril</text>
          <text x="287" y="365">Coxa</text>
          <text x="284" y="460">Panturrilha</text>
          <text x="28" y="185">Biceps</text>
        </g>
      </svg>
    </div>
  );
}
