import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Camera,
  Flame,
  HeartPulse,
  ImageIcon,
  LineChart as LineChartIcon,
  Loader2,
  Pencil,
  Ruler,
  Save,
  Scale,
} from "lucide-react";
import { data, Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import type { Route } from "./+types/personal-life.health";
import { BodyMeasurementGuide, BodyPoseIllustration } from "~/components/personal-life/health-visuals";
import { OperationalHero, OperationalPanel, OperationalStat } from "~/components/ui/operational-page";
import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/auth.server";
import { logAudit } from "~/lib/audit.server";
import { getCSRFFormState, requireValidCSRF } from "~/lib/csrf.server";
import { db } from "~/lib/db.server";
import {
  ACTIVITY_LEVELS,
  calculateDelta,
  calculateHealthMetrics,
  formatMetricValue,
  HEALTH_MEASUREMENT_FIELDS,
  PHOTO_POSES,
  toNumber,
  type ActivityLevel,
  type CalculationProfile,
  type HealthMeasurementFieldKey,
  type PhotoPose,
} from "~/lib/personal-health";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { uploadFile } from "~/lib/storage.server";
import { cn } from "~/lib/utils";
import { personalHealthAssessments, personalHealthPhotos } from "../../drizzle/schema/personal-life";

const TONE_CLASSES = {
  sky: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200",
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200",
  orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200",
} as const;

const MEASUREMENT_KEYS = HEALTH_MEASUREMENT_FIELDS.map((field) => field.key);

const TREND_DEFINITIONS = [
  { key: "weightKg", label: "Peso", unit: "kg", decimals: 2, color: "#0891b2" },
  { key: "bodyFatPercent", label: "Gordura corporal", unit: "%", decimals: 2, color: "#dc2626" },
  { key: "leanMassKg", label: "Massa magra", unit: "kg", decimals: 2, color: "#0f766e" },
  { key: "bmi", label: "IMC", unit: "", decimals: 2, color: "#7c3aed" },
  { key: "bmrKcal", label: "Taxa metabolica basal", unit: "kcal", decimals: 0, color: "#2563eb" },
  { key: "dailyCalories", label: "Necessidade diaria", unit: "kcal", decimals: 0, color: "#14b8a6" },
  { key: "neckCm", label: "Pescoco", unit: "cm", decimals: 2, color: "#0ea5e9" },
  { key: "leftArmCm", label: "Braco esquerdo", unit: "cm", decimals: 2, color: "#1d4ed8" },
  { key: "rightArmCm", label: "Braco direito", unit: "cm", decimals: 2, color: "#2563eb" },
  { key: "chestCm", label: "Torax", unit: "cm", decimals: 2, color: "#f97316" },
  { key: "waistCm", label: "Cintura", unit: "cm", decimals: 2, color: "#ea580c" },
  { key: "hipCm", label: "Quadril", unit: "cm", decimals: 2, color: "#f59e0b" },
  { key: "leftThighCm", label: "Coxa esquerda", unit: "cm", decimals: 2, color: "#7c3aed" },
  { key: "rightThighCm", label: "Coxa direita", unit: "cm", decimals: 2, color: "#8b5cf6" },
  { key: "leftCalfCm", label: "Panturrilha esquerda", unit: "cm", decimals: 2, color: "#16a34a" },
  { key: "rightCalfCm", label: "Panturrilha direita", unit: "cm", decimals: 2, color: "#22c55e" },
] as const;

type HealthFormValues = Record<HealthMeasurementFieldKey, string> & {
  entryDate: string;
  calculationProfile: CalculationProfile;
  activityLevel: ActivityLevel;
  customActivityFactor: string;
  notes: string;
};

type PhotoAsset = {
  id: string;
  fileUrl: string;
  takenAt: string | null;
};

type ActionPayload = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: HealthFormValues;
};

type HistoryPoint = {
  dateLabel: string;
  fullDate: string;
  heightCm: number | null;
  weightKg: number | null;
  neckCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  leftArmCm: number | null;
  rightArmCm: number | null;
  leftThighCm: number | null;
  rightThighCm: number | null;
  leftCalfCm: number | null;
  rightCalfCm: number | null;
  bodyFatPercent: number | null;
  bmi: number | null;
  leanMassKg: number | null;
  bmrKcal: number | null;
  dailyCalories: number | null;
};

type AssessmentSnapshot = {
  id: string;
  entryDate: string;
  calculationProfile: CalculationProfile;
  activityLevel: ActivityLevel;
  customActivityFactor: number | null;
  heightCm: number | null;
  weightKg: number | null;
  neckCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  leftArmCm: number | null;
  rightArmCm: number | null;
  leftThighCm: number | null;
  rightThighCm: number | null;
  leftCalfCm: number | null;
  rightCalfCm: number | null;
  bodyFatPercent: number | null;
  notes: string | null;
  metrics: ReturnType<typeof calculateHealthMetrics>;
  photos: Partial<Record<PhotoPose, PhotoAsset>>;
};

function todayBr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function formatDatePt(dateString: string) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString("pt-BR");
}

function formatShortDate(dateString: string) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatNumberForInput(value: number | null, decimals = 2) {
  if (value === null) return "";
  return value.toFixed(decimals).replace(".", ",");
}

function emptyFormValues(entryDate = todayBr()): HealthFormValues {
  return {
    entryDate,
    calculationProfile: "male",
    activityLevel: "moderate",
    customActivityFactor: "",
    notes: "",
    heightCm: "",
    weightKg: "",
    neckCm: "",
    chestCm: "",
    waistCm: "",
    hipCm: "",
    leftArmCm: "",
    rightArmCm: "",
    leftThighCm: "",
    rightThighCm: "",
    leftCalfCm: "",
    rightCalfCm: "",
    bodyFatPercent: "",
  };
}

function buildFormValues(source: AssessmentSnapshot | null, entryDate: string): HealthFormValues {
  const base = emptyFormValues(entryDate);
  if (!source) return base;

  return {
    ...base,
    entryDate,
    calculationProfile: source.calculationProfile,
    activityLevel: source.activityLevel,
    customActivityFactor: formatNumberForInput(source.customActivityFactor, 3),
    notes: source.notes ?? "",
    heightCm: formatNumberForInput(source.heightCm),
    weightKg: formatNumberForInput(source.weightKg),
    neckCm: formatNumberForInput(source.neckCm),
    chestCm: formatNumberForInput(source.chestCm),
    waistCm: formatNumberForInput(source.waistCm),
    hipCm: formatNumberForInput(source.hipCm),
    leftArmCm: formatNumberForInput(source.leftArmCm),
    rightArmCm: formatNumberForInput(source.rightArmCm),
    leftThighCm: formatNumberForInput(source.leftThighCm),
    rightThighCm: formatNumberForInput(source.rightThighCm),
    leftCalfCm: formatNumberForInput(source.leftCalfCm),
    rightCalfCm: formatNumberForInput(source.rightCalfCm),
    bodyFatPercent: formatNumberForInput(source.bodyFatPercent),
  };
}

function collectSubmittedValues(formData: FormData): HealthFormValues {
  const values = emptyFormValues(
    typeof formData.get("entryDate") === "string" && formData.get("entryDate")
      ? String(formData.get("entryDate"))
      : todayBr(),
  );

  for (const key of [...MEASUREMENT_KEYS, "entryDate", "customActivityFactor", "notes"] as const) {
    const raw = formData.get(key);
    if (typeof raw === "string") values[key] = raw;
  }

  values.calculationProfile = formData.get("calculationProfile") === "female" ? "female" : "male";
  values.activityLevel = ACTIVITY_LEVELS.some((item) => item.value === formData.get("activityLevel"))
    ? (formData.get("activityLevel") as ActivityLevel)
    : "moderate";

  return values;
}

function parseOptionalDecimal(
  rawValue: FormDataEntryValue | null,
  label: string,
  { min = 0.01, max = 999.99, decimals = 2 }: { min?: number; max?: number; decimals?: number } = {},
) {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return { value: null as string | null, error: null as string | null };
  }

  const parsed = Number(rawValue.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return { value: null as string | null, error: `Informe ${label.toLowerCase()} valida.` };
  }

  return { value: parsed.toFixed(decimals), error: null as string | null };
}

function parseCalculationProfile(rawValue: unknown): CalculationProfile {
  return rawValue === "female" ? "female" : "male";
}

function parseActivityLevel(rawValue: unknown): ActivityLevel {
  return ACTIVITY_LEVELS.some((item) => item.value === rawValue) ? (rawValue as ActivityLevel) : "moderate";
}

function deltaLabel(value: number | null, unit: string, decimals = 2) {
  if (value === null) return "Sem base para comparar";
  const formatted = `${Math.abs(value).toFixed(decimals).replace(".", ",")} ${unit}`.trim();
  if (value > 0) return `+${formatted} desde a primeira medicao`;
  if (value < 0) return `-${formatted} desde a primeira medicao`;
  return `Sem variacao desde a primeira medicao`;
}

function getDeltaTone(value: number | null, inverted = false) {
  if (value === null || value === 0) return "text-[var(--app-muted)]";
  const positiveClass = inverted ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";
  const negativeClass = inverted ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300";
  return value > 0 ? positiveClass : negativeClass;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const requestedEntry = url.searchParams.get("entry");
  const saved = url.searchParams.get("saved") === "1";
  const { csrfToken, csrfCookieHeader } = await getCSRFFormState(request);

  const assessmentsRows = await db
    .select()
    .from(personalHealthAssessments)
    .where(and(eq(personalHealthAssessments.userId, user.id), isNull(personalHealthAssessments.deletedAt)))
    .orderBy(desc(personalHealthAssessments.entryDate), desc(personalHealthAssessments.createdAt));

  const photosRows = assessmentsRows.length
    ? await db
        .select()
        .from(personalHealthPhotos)
        .where(
          and(
            eq(personalHealthPhotos.userId, user.id),
            isNull(personalHealthPhotos.deletedAt),
            inArray(personalHealthPhotos.assessmentId, assessmentsRows.map((row) => row.id)),
          ),
        )
        .orderBy(desc(personalHealthPhotos.takenAt), desc(personalHealthPhotos.createdAt))
    : [];

  const photosByAssessment = new Map<string, Partial<Record<PhotoPose, PhotoAsset>>>();
  for (const row of photosRows) {
    const current = photosByAssessment.get(row.assessmentId) ?? {};
    current[row.pose as PhotoPose] = {
      id: row.id,
      fileUrl: row.fileUrl,
      takenAt: row.takenAt,
    };
    photosByAssessment.set(row.assessmentId, current);
  }

  const assessmentsDesc: AssessmentSnapshot[] = assessmentsRows.map((row) => {
    const snapshotBase = {
      calculationProfile: parseCalculationProfile(row.calculationProfile),
      activityLevel: parseActivityLevel(row.activityLevel),
      customActivityFactor: toNumber(row.customActivityFactor),
      heightCm: toNumber(row.heightCm),
      weightKg: toNumber(row.weightKg),
      neckCm: toNumber(row.neckCm),
      chestCm: toNumber(row.chestCm),
      waistCm: toNumber(row.waistCm),
      hipCm: toNumber(row.hipCm),
      leftArmCm: toNumber(row.leftArmCm),
      rightArmCm: toNumber(row.rightArmCm),
      leftThighCm: toNumber(row.leftThighCm),
      rightThighCm: toNumber(row.rightThighCm),
      leftCalfCm: toNumber(row.leftCalfCm),
      rightCalfCm: toNumber(row.rightCalfCm),
      bodyFatPercent: toNumber(row.bodyFatPercent),
    };

    return {
      id: row.id,
      entryDate: row.entryDate,
      notes: row.notes,
      ...snapshotBase,
      metrics: calculateHealthMetrics(snapshotBase),
      photos: photosByAssessment.get(row.id) ?? {},
    };
  });

  const assessmentsAsc = [...assessmentsDesc].reverse();
  const firstAssessment = assessmentsAsc[0] ?? null;
  const latestAssessment = assessmentsDesc[0] ?? null;
  const selectedAssessment = requestedEntry
    ? assessmentsDesc.find((assessment) => assessment.entryDate === requestedEntry) ?? null
    : null;
  const formSource = selectedAssessment ?? latestAssessment ?? null;
  const formDate = selectedAssessment?.entryDate ?? todayBr();
  const formDefaults = buildFormValues(formSource, formDate);

  const historySeries: HistoryPoint[] = assessmentsAsc.map((assessment) => ({
    dateLabel: formatShortDate(assessment.entryDate),
    fullDate: formatDatePt(assessment.entryDate),
    heightCm: assessment.heightCm,
    weightKg: assessment.weightKg,
    neckCm: assessment.neckCm,
    chestCm: assessment.chestCm,
    waistCm: assessment.waistCm,
    hipCm: assessment.hipCm,
    leftArmCm: assessment.leftArmCm,
    rightArmCm: assessment.rightArmCm,
    leftThighCm: assessment.leftThighCm,
    rightThighCm: assessment.rightThighCm,
    leftCalfCm: assessment.leftCalfCm,
    rightCalfCm: assessment.rightCalfCm,
    bodyFatPercent: assessment.metrics.bodyFatPercent,
    bmi: assessment.metrics.bmi,
    leanMassKg: assessment.metrics.leanMassKg,
    bmrKcal: assessment.metrics.bmrKcal,
    dailyCalories: assessment.metrics.dailyCalories,
  }));

  const photoGroups = PHOTO_POSES.map((pose) => ({
    ...pose,
    items: assessmentsDesc
      .map((assessment) => {
        const photo = assessment.photos[pose.key];
        if (!photo) return null;
        return {
          assessmentId: assessment.id,
          entryDate: assessment.entryDate,
          fileUrl: photo.fileUrl,
        };
      })
      .filter(Boolean) as { assessmentId: string; entryDate: string; fileUrl: string }[],
  }));

  return data(
    {
      csrfToken,
      saved,
      assessments: assessmentsDesc,
      firstAssessment,
      latestAssessment,
      selectedAssessment,
      formDefaults,
      historySeries,
      photoGroups,
    },
    {
      headers: {
        "Set-Cookie": csrfCookieHeader,
      },
    },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const values = collectSubmittedValues(formData);

  try {
    await requireValidCSRF(request, formData);
  } catch {
    return data<ActionPayload>(
      { error: "Sessao do formulario expirou. Atualize a pagina e tente novamente.", values },
      { status: 403 },
    );
  }

  const entryDate = typeof formData.get("entryDate") === "string" ? String(formData.get("entryDate")) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return data<ActionPayload>(
      { error: "Informe uma data valida para a medicao.", values, fieldErrors: { entryDate: "Data invalida." } },
      { status: 400 },
    );
  }

  const fieldErrors: Record<string, string> = {};
  const parsedFields = {
    weightKg: parseOptionalDecimal(formData.get("weightKg"), "peso", { max: 500 }),
    heightCm: parseOptionalDecimal(formData.get("heightCm"), "altura", { max: 260 }),
    neckCm: parseOptionalDecimal(formData.get("neckCm"), "pescoco", { max: 100 }),
    chestCm: parseOptionalDecimal(formData.get("chestCm"), "torax", { max: 250 }),
    waistCm: parseOptionalDecimal(formData.get("waistCm"), "cintura", { max: 250 }),
    hipCm: parseOptionalDecimal(formData.get("hipCm"), "quadril", { max: 250 }),
    leftArmCm: parseOptionalDecimal(formData.get("leftArmCm"), "braco esquerdo", { max: 100 }),
    rightArmCm: parseOptionalDecimal(formData.get("rightArmCm"), "braco direito", { max: 100 }),
    leftThighCm: parseOptionalDecimal(formData.get("leftThighCm"), "coxa esquerda", { max: 150 }),
    rightThighCm: parseOptionalDecimal(formData.get("rightThighCm"), "coxa direita", { max: 150 }),
    leftCalfCm: parseOptionalDecimal(formData.get("leftCalfCm"), "panturrilha esquerda", { max: 100 }),
    rightCalfCm: parseOptionalDecimal(formData.get("rightCalfCm"), "panturrilha direita", { max: 100 }),
    bodyFatPercent: parseOptionalDecimal(formData.get("bodyFatPercent"), "gordura corporal", { max: 75 }),
    customActivityFactor: parseOptionalDecimal(formData.get("customActivityFactor"), "fator de atividade", {
      min: 1,
      max: 3,
      decimals: 3,
    }),
  };

  for (const [key, result] of Object.entries(parsedFields)) {
    if (result.error) fieldErrors[key] = result.error;
  }

  if (!parsedFields.weightKg.value) fieldErrors.weightKg = "Peso e obrigatorio.";
  if (!parsedFields.heightCm.value) fieldErrors.heightCm = "Altura e obrigatoria.";

  if (Object.keys(fieldErrors).length > 0) {
    return data<ActionPayload>({ error: "Revise os campos destacados.", fieldErrors, values }, { status: 400 });
  }

  const calculationProfile = parseCalculationProfile(formData.get("calculationProfile"));
  const activityLevel = parseActivityLevel(formData.get("activityLevel"));
  const notes = typeof formData.get("notes") === "string" ? String(formData.get("notes")).trim() : "";

  const [existingAssessment] = await db
    .select({ id: personalHealthAssessments.id })
    .from(personalHealthAssessments)
    .where(
      and(
        eq(personalHealthAssessments.userId, user.id),
        eq(personalHealthAssessments.entryDate, entryDate),
        isNull(personalHealthAssessments.deletedAt),
      ),
    )
    .limit(1);

  const assessmentPayload = {
    userId: user.id,
    entryDate,
    calculationProfile,
    activityLevel,
    customActivityFactor: parsedFields.customActivityFactor.value,
    heightCm: parsedFields.heightCm.value,
    weightKg: parsedFields.weightKg.value,
    neckCm: parsedFields.neckCm.value,
    chestCm: parsedFields.chestCm.value,
    waistCm: parsedFields.waistCm.value,
    hipCm: parsedFields.hipCm.value,
    leftArmCm: parsedFields.leftArmCm.value,
    rightArmCm: parsedFields.rightArmCm.value,
    leftThighCm: parsedFields.leftThighCm.value,
    rightThighCm: parsedFields.rightThighCm.value,
    leftCalfCm: parsedFields.leftCalfCm.value,
    rightCalfCm: parsedFields.rightCalfCm.value,
    bodyFatPercent: parsedFields.bodyFatPercent.value,
    notes: notes || null,
    updatedAt: new Date(),
  };

  let assessmentId = existingAssessment?.id;
  if (assessmentId) {
    await db.update(personalHealthAssessments).set(assessmentPayload).where(eq(personalHealthAssessments.id, assessmentId));
  } else {
    const [createdAssessment] = await db
      .insert(personalHealthAssessments)
      .values(assessmentPayload)
      .returning({ id: personalHealthAssessments.id });
    assessmentId = createdAssessment.id;
  }

  const uploadedPoses: PhotoPose[] = [];
  for (const pose of PHOTO_POSES) {
    const maybeFile = formData.get(`photo-${pose.key}`);
    if (!(maybeFile instanceof File) || maybeFile.size === 0) continue;

    try {
      const { url, size } = await uploadFile(maybeFile, `personal-life/health/${user.id}/${entryDate}`);
      const [existingPhoto] = await db
        .select({ id: personalHealthPhotos.id })
        .from(personalHealthPhotos)
        .where(
          and(
            eq(personalHealthPhotos.assessmentId, assessmentId),
            eq(personalHealthPhotos.pose, pose.key),
            isNull(personalHealthPhotos.deletedAt),
          ),
        )
        .limit(1);

      if (existingPhoto) {
        await db
          .update(personalHealthPhotos)
          .set({ fileUrl: url, fileSize: size, takenAt: entryDate, updatedAt: new Date() })
          .where(eq(personalHealthPhotos.id, existingPhoto.id));
      } else {
        await db.insert(personalHealthPhotos).values({
          assessmentId,
          userId: user.id,
          pose: pose.key,
          fileUrl: url,
          fileSize: size,
          takenAt: entryDate,
        });
      }

      uploadedPoses.push(pose.key);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar a foto.";
      return data<ActionPayload>({ error: message, values }, { status: 400 });
    }
  }

  await logAudit({
    userId: user.id,
    action: existingAssessment ? "update" : "create",
    entity: "user",
    entityId: assessmentId,
    changes: { module: "personal_health", entryDate, uploadedPoses, calculationProfile, activityLevel },
    request,
  });

  return redirect(`/personal-life/health?entry=${entryDate}&saved=1#formulario`);
}

function TonePill({ label, tone }: { label: string; tone: keyof typeof TONE_CLASSES }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", TONE_CLASSES[tone])}>
      {label}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  delta,
  deltaTone,
  helper,
}: {
  title: string;
  value: string;
  delta: string;
  deltaTone?: string;
  helper: string;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] p-5 shadow-[var(--app-card-shadow)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-muted)]">{title}</p>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-[var(--app-text)]">{value}</div>
      <p className={cn("mt-2 text-sm font-medium", deltaTone ?? "text-[var(--app-muted)]")}>{delta}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--app-muted)]">{helper}</p>
    </div>
  );
}

function TrendCard({
  title,
  unit,
  decimals,
  color,
  dataKey,
  series,
}: {
  title: string;
  unit: string;
  decimals: number;
  color: string;
  dataKey: keyof HistoryPoint;
  series: HistoryPoint[];
}) {
  const filtered = series.filter((point) => typeof point[dataKey] === "number");
  if (filtered.length === 0) return null;

  const first = filtered[0][dataKey] as number;
  const latest = filtered[filtered.length - 1][dataKey] as number;
  const delta = calculateDelta(latest, first, decimals);
  const helper = filtered.length > 1
    ? deltaLabel(delta, unit, decimals)
    : `Primeira medicao registrada em ${filtered[0].fullDate}`;

  return (
    <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-card-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--app-text)]">{title}</h3>
          <p className="mt-1 text-2xl font-semibold text-[var(--app-text)]">
            {unit ? formatMetricValue(latest, unit, decimals) : latest.toFixed(decimals).replace(".", ",")}
          </p>
        </div>
        <div className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--app-muted)]">
          {filtered.length} registro{filtered.length > 1 ? "s" : ""}
        </div>
      </div>

      <p className={cn("mt-2 text-xs font-medium", getDeltaTone(delta))}>{helper}</p>

      <div className="mt-4 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filtered} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "var(--app-muted)" }} axisLine={false} tickLine={false} />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              formatter={(value) => [
                unit ? formatMetricValue(toNumber(value), unit, decimals) : (toNumber(value) ?? 0).toFixed(decimals).replace(".", ","),
                title,
              ]}
              labelFormatter={(_, payload) => ((payload?.[0]?.payload as HistoryPoint | undefined)?.fullDate ?? "")}
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.96)",
                border: "1px solid rgba(148, 163, 184, 0.28)",
                borderRadius: 16,
                color: "#e2e8f0",
                fontSize: 12,
              }}
              labelStyle={{ color: "#f8fafc" }}
            />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={{ r: 4, fill: color }} activeDot={{ r: 6, fill: color }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FieldWrapper({
  label,
  helper,
  unit,
  error,
  children,
}: {
  label: string;
  helper: string;
  unit: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--app-text)]">{label}</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--app-muted)]">{helper}</p>
      </div>
      <div className="space-y-2">
        {children}
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--app-muted)]">{unit}</p>
        {error ? <p className="text-sm font-medium text-red-600 dark:text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}

function SingleMeasurementField({
  name,
  label,
  helper,
  unit,
  value,
  error,
  placeholder = "0,00",
}: {
  name: string;
  label: string;
  helper: string;
  unit: string;
  value: string;
  error?: string;
  placeholder?: string;
}) {
  return (
    <FieldWrapper label={label} helper={helper} unit={unit} error={error}>
      <input
        type="text"
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-2xl border bg-[var(--app-surface-2)] px-4 py-3 text-center text-lg font-medium text-[var(--app-text)] shadow-sm outline-none transition",
          error ? "border-red-400 focus:border-red-500" : "border-[var(--app-border-strong)] focus:border-cyan-500",
        )}
      />
    </FieldWrapper>
  );
}

function DualMeasurementField({
  title,
  helper,
  leftName,
  leftValue,
  leftError,
  rightName,
  rightValue,
  rightError,
  unit,
}: {
  title: string;
  helper: string;
  leftName: string;
  leftValue: string;
  leftError?: string;
  rightName: string;
  rightValue: string;
  rightError?: string;
  unit: string;
}) {
  return (
    <div className="space-y-3 rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--app-text)]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--app-muted)]">{helper}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">Esquerdo</label>
          <input
            type="text"
            name={leftName}
            defaultValue={leftValue}
            placeholder="0,00"
            className={cn(
              "w-full rounded-2xl border bg-[var(--app-surface-2)] px-4 py-3 text-center text-lg font-medium text-[var(--app-text)] shadow-sm outline-none transition",
              leftError ? "border-red-400 focus:border-red-500" : "border-[var(--app-border-strong)] focus:border-cyan-500",
            )}
          />
          {leftError ? <p className="text-sm font-medium text-red-600 dark:text-red-300">{leftError}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">Direito</label>
          <input
            type="text"
            name={rightName}
            defaultValue={rightValue}
            placeholder="0,00"
            className={cn(
              "w-full rounded-2xl border bg-[var(--app-surface-2)] px-4 py-3 text-center text-lg font-medium text-[var(--app-text)] shadow-sm outline-none transition",
              rightError ? "border-red-400 focus:border-red-500" : "border-[var(--app-border-strong)] focus:border-cyan-500",
            )}
          />
          {rightError ? <p className="text-sm font-medium text-red-600 dark:text-red-300">{rightError}</p> : null}
        </div>
      </div>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--app-muted)]">{unit}</p>
    </div>
  );
}

export default function PersonalLifeHealthPage() {
  const {
    csrfToken,
    saved,
    assessments,
    firstAssessment,
    latestAssessment,
    selectedAssessment,
    formDefaults,
    historySeries,
    photoGroups,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionPayload | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const formValues = actionData?.values ?? formDefaults;
  const fieldErrors = actionData?.fieldErrors ?? {};
  const latestMetrics = latestAssessment?.metrics ?? null;
  const latestEntryDate = latestAssessment?.entryDate ?? null;
  const firstWeight = firstAssessment?.weightKg ?? null;
  const firstBodyFat = firstAssessment?.metrics.bodyFatPercent ?? null;
  const firstLeanMass = firstAssessment?.metrics.leanMassKg ?? null;
  const firstBmi = firstAssessment?.metrics.bmi ?? null;
  const firstBmr = firstAssessment?.metrics.bmrKcal ?? null;
  const firstDailyCalories = firstAssessment?.metrics.dailyCalories ?? null;

  const summaryCards = latestAssessment
    ? [
        {
          title: "Peso",
          value: formatMetricValue(latestAssessment.weightKg, "kg"),
          delta: deltaLabel(calculateDelta(latestAssessment.weightKg, firstWeight), "kg"),
          deltaTone: getDeltaTone(calculateDelta(latestAssessment.weightKg, firstWeight)),
          helper: latestEntryDate ? `Ultima medicao em ${formatDatePt(latestEntryDate)}` : "Sem data registrada",
        },
        {
          title: "IMC",
          value: latestMetrics?.bmi ? latestMetrics.bmi.toFixed(2).replace(".", ",") : "N/D",
          delta: deltaLabel(calculateDelta(latestMetrics?.bmi ?? null, firstBmi), "", 2),
          deltaTone: getDeltaTone(calculateDelta(latestMetrics?.bmi ?? null, firstBmi), true),
          helper: latestMetrics?.bmiCategory?.label ?? "Categoria indisponivel",
        },
        {
          title: "Gordura corporal",
          value: formatMetricValue(latestMetrics?.bodyFatPercent ?? null, "%"),
          delta: deltaLabel(calculateDelta(latestMetrics?.bodyFatPercent ?? null, firstBodyFat), "%"),
          deltaTone: getDeltaTone(calculateDelta(latestMetrics?.bodyFatPercent ?? null, firstBodyFat)),
          helper: latestMetrics?.bodyFatCategory?.label ?? "Estimativa indisponivel",
        },
        {
          title: "Massa magra",
          value: formatMetricValue(latestMetrics?.leanMassKg ?? null, "kg"),
          delta: deltaLabel(calculateDelta(latestMetrics?.leanMassKg ?? null, firstLeanMass), "kg"),
          deltaTone: getDeltaTone(calculateDelta(latestMetrics?.leanMassKg ?? null, firstLeanMass), true),
          helper: "Estimativa baseada no peso e no percentual de gordura informado ou calculado.",
        },
        {
          title: "Taxa metabolica basal",
          value: formatMetricValue(latestMetrics?.bmrKcal ?? null, "kcal", 0),
          delta: deltaLabel(calculateDelta(latestMetrics?.bmrKcal ?? null, firstBmr, 0), "kcal", 0),
          deltaTone: getDeltaTone(calculateDelta(latestMetrics?.bmrKcal ?? null, firstBmr, 0), true),
          helper: "Referencia minima de energia diaria para manter funcoes vitais em repouso.",
        },
        {
          title: "Necessidade diaria",
          value: formatMetricValue(latestMetrics?.dailyCalories ?? null, "kcal", 0),
          delta: deltaLabel(calculateDelta(latestMetrics?.dailyCalories ?? null, firstDailyCalories, 0), "kcal", 0),
          deltaTone: getDeltaTone(calculateDelta(latestMetrics?.dailyCalories ?? null, firstDailyCalories, 0), true),
          helper: "Estimativa de gasto diario considerando seu nivel de atividade atual.",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-4 lg:px-8 lg:py-8">
      <OperationalHero
        eyebrow="Vida pessoal | Saude"
        title="Medidas e fotos corporais"
        description="Acompanhe peso, medidas, fotos por pose e metricas estimadas de composicao corporal em snapshots por data. Os calculos sao informativos e servem como referencia de acompanhamento pessoal."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/personal-life">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <Button asChild>
              <a href="#formulario">
                <Pencil className="h-4 w-4" />
                Adicionar ou alterar medicao
              </a>
            </Button>
          </>
        }
        aside={
          <>
            <OperationalStat
              label="Ultimo registro"
              value={latestEntryDate ? formatDatePt(latestEntryDate) : "Sem medicao"}
              description={
                latestAssessment
                  ? `${assessments.length} snapshot${assessments.length > 1 ? "s" : ""} armazenado${assessments.length > 1 ? "s" : ""}`
                  : "Cadastre a primeira medicao completa para liberar as analises."
              }
            />
            <OperationalStat
              label="Fotos corporais"
              value={photoGroups.reduce((sum, group) => sum + group.items.length, 0)}
              description="Frente, lado e costas ficam agrupados por data para comparar postura e evolucao."
            />
            <OperationalStat
              label="Faixa ativa"
              value={
                latestMetrics?.bodyFatCategory ? (
                  <TonePill label={latestMetrics.bodyFatCategory.label} tone={latestMetrics.bodyFatCategory.tone} />
                ) : (
                  "Aguardando medidas"
                )
              }
              description="Se a gordura corporal nao for informada, o modulo tenta estimar pelos demais dados."
            />
          </>
        }
      />

      {saved ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
          Medicao corporal salva com sucesso.
        </div>
      ) : null}

      {actionData?.error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
          {actionData.error}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        {summaryCards.length > 0 ? (
          summaryCards.map((card) => (
            <SummaryCard key={card.title} title={card.title} value={card.value} delta={card.delta} deltaTone={card.deltaTone} helper={card.helper} />
          ))
        ) : (
          <div className="xl:col-span-3 rounded-[28px] border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface)] px-6 py-10 text-center text-sm text-[var(--app-muted)]">
            Nenhuma avaliacao corporal registrada ainda. Use o formulario abaixo para salvar sua primeira medicao completa.
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <OperationalPanel
          title="Composicao corporal e gasto estimado"
          description="Os numeros abaixo sao calculados a partir da ultima medicao salva. Se o percentual de gordura nao for informado, a tela tenta estimar com base em pescoco, cintura, altura e, quando aplicavel, quadril."
          icon={<HeartPulse className="h-5 w-5" />}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface-2)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-muted)]">IMC</p>
              <div className="mt-3 flex items-center gap-3">
                <Scale className="h-8 w-8 text-cyan-500" />
                <div>
                  <p className="text-3xl font-semibold text-[var(--app-text)]">
                    {latestMetrics?.bmi ? latestMetrics.bmi.toFixed(2).replace(".", ",") : "N/D"}
                  </p>
                  {latestMetrics?.bmiCategory ? <div className="mt-2"><TonePill label={latestMetrics.bmiCategory.label} tone={latestMetrics.bmiCategory.tone} /></div> : null}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface-2)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-muted)]">Gordura corporal estimada</p>
              <div className="mt-3 flex items-center gap-3">
                <Flame className="h-8 w-8 text-rose-500" />
                <div>
                  <p className="text-3xl font-semibold text-[var(--app-text)]">{formatMetricValue(latestMetrics?.bodyFatPercent ?? null, "%")}</p>
                  {latestMetrics?.bodyFatCategory ? <div className="mt-2"><TonePill label={latestMetrics.bodyFatCategory.label} tone={latestMetrics.bodyFatCategory.tone} /></div> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface-2)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-muted)]">Massa magra</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--app-text)]">{formatMetricValue(latestMetrics?.leanMassKg ?? null, "kg")}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">Soma estimada de musculos, ossos, orgaos e liquidos corporais.</p>
            </div>

            <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface-2)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-muted)]">Taxa metabolica basal</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--app-text)]">{formatMetricValue(latestMetrics?.bmrKcal ?? null, "kcal", 0)}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">Referencia minima de energia diaria para manter o corpo em repouso.</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,#0f8ea7,#1166cc)] p-6 text-white shadow-[0_18px_40px_rgba(14,165,233,0.18)]">
            <div className="flex items-start gap-3">
              <Activity className="mt-1 h-6 w-6 text-cyan-100" />
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">Necessidade diaria de calorias</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight">{formatMetricValue(latestMetrics?.dailyCalories ?? null, "kcal", 0)}</p>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-cyan-50/90">
                  Esta e uma estimativa de manutencao com base no seu nivel de atividade atual. Use como referencia pessoal, nao como prescricao clinica.
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Para perder peso</p>
                    <p className="mt-2 text-xl font-semibold">{formatMetricValue(latestMetrics?.cutCalories ?? null, "kcal", 0)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Para manter</p>
                    <p className="mt-2 text-xl font-semibold">{formatMetricValue(latestMetrics?.maintainCalories ?? null, "kcal", 0)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Para ganhar</p>
                    <p className="mt-2 text-xl font-semibold">{formatMetricValue(latestMetrics?.gainCalories ?? null, "kcal", 0)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </OperationalPanel>

        <OperationalPanel
          title="Fotos corporais"
          description="As fotos ficam separadas por pose para comparar postura, distribuicao corporal e evolucao ao longo do tempo."
          icon={<ImageIcon className="h-5 w-5" />}
          actions={
            <Button asChild variant="outline" size="sm">
              <a href="#formulario">
                <Camera className="h-4 w-4" />
                Atualizar fotos
              </a>
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface-2)] p-5">
              <h3 className="text-xl font-semibold text-[var(--app-text)]">Fotos corporais</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--app-muted)]">
                <li>- Faça a postura da ilustração.</li>
                <li>- Tire a foto na posição retratada e com o corpo relaxado.</li>
                <li>- Prefira fundo simples e iluminação constante.</li>
                <li>- Não precisa mostrar o rosto se não quiser.</li>
              </ul>
            </div>

            {photoGroups.map((group) => (
              <div key={group.key} className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-[var(--app-text)]">
                    {group.title} {group.items.length > 0 ? `(${group.items.length})` : ""}
                  </h3>
                  <p className="text-sm text-[var(--app-muted)]">{group.hint}</p>
                </div>

                {group.items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-4 py-8 text-center text-sm text-[var(--app-muted)]">
                    Nenhuma foto salva nesta pose ainda.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {group.items.map((item) => (
                      <Link
                        key={`${group.key}-${item.assessmentId}`}
                        to={`/personal-life/health?entry=${item.entryDate}#formulario`}
                        className="group rounded-[20px] border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 transition hover:border-cyan-400/40 hover:shadow-[var(--app-card-shadow)]"
                      >
                        <div className="overflow-hidden rounded-[18px] bg-white">
                          <img
                            src={item.fileUrl}
                            alt={`${group.title} em ${formatDatePt(item.entryDate)}`}
                            className="h-48 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--app-text)]">{formatDatePt(item.entryDate)}</p>
                            <p className="text-xs text-[var(--app-muted)]">Abrir medicao</p>
                          </div>
                          <Pencil className="h-4 w-4 text-[var(--app-muted)]" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </OperationalPanel>
      </div>

      <OperationalPanel
        title="Historico de metricas"
        description="Cada grafico usa a primeira e a ultima medicao registradas para mostrar a variacao acumulada."
        icon={<LineChartIcon className="h-5 w-5" />}
      >
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {TREND_DEFINITIONS.map((definition) => (
            <TrendCard
              key={definition.key}
              title={definition.label}
              unit={definition.unit}
              decimals={definition.decimals}
              color={definition.color}
              dataKey={definition.key}
              series={historySeries}
            />
          ))}
        </div>
      </OperationalPanel>

      <OperationalPanel
        title="Adicionar ou alterar medicao"
        description="Cada envio cria ou atualiza um snapshot por data. Se a data ja existir, o registro daquele dia sera atualizado."
        icon={<Ruler className="h-5 w-5" />}
        className="scroll-mt-24"
      >
        <Form id="formulario" method="post" encType="multipart/form-data" className="space-y-6">
          <input type="hidden" name="csrf" value={csrfToken} />

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface-2)] p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">Data da medicao</label>
                    <input type="date" name="entryDate" defaultValue={formValues.entryDate} className={cn("w-full rounded-2xl border bg-[var(--app-surface)] px-4 py-3 text-sm font-medium text-[var(--app-text)] shadow-sm outline-none transition", fieldErrors.entryDate ? "border-red-400 focus:border-red-500" : "border-[var(--app-border-strong)] focus:border-cyan-500")} />
                    {fieldErrors.entryDate ? <p className="text-sm font-medium text-red-600 dark:text-red-300">{fieldErrors.entryDate}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">Perfil de calculo</label>
                    <select name="calculationProfile" defaultValue={formValues.calculationProfile} className="w-full rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-4 py-3 text-sm font-medium text-[var(--app-text)] shadow-sm outline-none transition focus:border-cyan-500">
                      <option value="male">Masculino</option>
                      <option value="female">Feminino</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.8fr]">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">Nivel de atividade</label>
                    <select name="activityLevel" defaultValue={formValues.activityLevel} className="w-full rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-4 py-3 text-sm font-medium text-[var(--app-text)] shadow-sm outline-none transition focus:border-cyan-500">
                      {ACTIVITY_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>{level.label} - {level.factor}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">Fator personalizado</label>
                    <input type="text" name="customActivityFactor" defaultValue={formValues.customActivityFactor} placeholder="Opcional" className={cn("w-full rounded-2xl border bg-[var(--app-surface)] px-4 py-3 text-sm font-medium text-[var(--app-text)] shadow-sm outline-none transition", fieldErrors.customActivityFactor ? "border-red-400 focus:border-red-500" : "border-[var(--app-border-strong)] focus:border-cyan-500")} />
                    {fieldErrors.customActivityFactor ? <p className="text-sm font-medium text-red-600 dark:text-red-300">{fieldErrors.customActivityFactor}</p> : <p className="text-xs text-[var(--app-muted)]">Opcional. Use se quiser sobrescrever o fator do nivel de atividade.</p>}
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                  Este modulo gera estimativas de acompanhamento pessoal. Ele nao substitui avaliacao medica, nutricional ou exame de bioimpedancia clinica.
                </div>
              </div>

              <BodyMeasurementGuide className="h-[430px]" />
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <SingleMeasurementField name="weightKg" label="Peso" helper="Informe o peso corporal medido no dia. Use o mesmo horario e a mesma balanca sempre que possivel." unit="kg" value={formValues.weightKg} error={fieldErrors.weightKg} />
                <SingleMeasurementField name="heightCm" label="Altura" helper="Altura corporal atual em centimetros. Ela serve de base para IMC e estimativas de gordura corporal." unit="cm" value={formValues.heightCm} error={fieldErrors.heightCm} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <SingleMeasurementField name="neckCm" label="Pescoco" helper="Meça a circunferencia logo abaixo da laringe, sem encolher o pescoco." unit="cm" value={formValues.neckCm} error={fieldErrors.neckCm} />
                <SingleMeasurementField name="chestCm" label="Torax (peito)" helper="Respire normalmente e meça o torax apos a expiracao, mantendo a fita reta." unit="cm" value={formValues.chestCm} error={fieldErrors.chestCm} />
              </div>

              <DualMeasurementField title="Braco (biceps)" helper="Com o cotovelo a 90 graus e o biceps contraido, meça a parte mais alta do braco." leftName="leftArmCm" leftValue={formValues.leftArmCm} leftError={fieldErrors.leftArmCm} rightName="rightArmCm" rightValue={formValues.rightArmCm} rightError={fieldErrors.rightArmCm} unit="cm" />

              <div className="grid gap-4 lg:grid-cols-2">
                <SingleMeasurementField name="waistCm" label="Cintura" helper="Meça a menor circunferencia entre a ultima costela e o quadril, sem prender a respiracao." unit="cm" value={formValues.waistCm} error={fieldErrors.waistCm} />
                <SingleMeasurementField name="hipCm" label="Quadril" helper="Com os pes afastados na largura dos ombros, meça a parte mais saliente dos gluteos." unit="cm" value={formValues.hipCm} error={fieldErrors.hipCm} />
              </div>

              <DualMeasurementField title="Coxa" helper="Com o peso distribuido igualmente entre as pernas, meça logo abaixo do gluteo." leftName="leftThighCm" leftValue={formValues.leftThighCm} leftError={fieldErrors.leftThighCm} rightName="rightThighCm" rightValue={formValues.rightThighCm} rightError={fieldErrors.rightThighCm} unit="cm" />
              <DualMeasurementField title="Panturrilha" helper="Meça a maior circunferencia entre tornozelo e joelho, com o corpo relaxado." leftName="leftCalfCm" leftValue={formValues.leftCalfCm} leftError={fieldErrors.leftCalfCm} rightName="rightCalfCm" rightValue={formValues.rightCalfCm} rightError={fieldErrors.rightCalfCm} unit="cm" />
              <SingleMeasurementField name="bodyFatPercent" label="Gordura corporal" helper="Se voce souber o percentual, informe manualmente. Se deixar em branco, o sistema tenta estimar com base nas medidas." unit="%" value={formValues.bodyFatPercent} error={fieldErrors.bodyFatPercent} />

              <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">Observacoes</label>
                <textarea name="notes" defaultValue={formValues.notes} rows={4} placeholder="Ex.: medicao em jejum, inicio de dieta, mudanca de treino, observacoes sobre postura." className="mt-3 w-full rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-4 py-3 text-sm text-[var(--app-text)] shadow-sm outline-none transition focus:border-cyan-500" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {PHOTO_POSES.map((pose) => {
              const preview = selectedAssessment?.photos[pose.key];
              return (
                <div key={pose.key} className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-card-shadow)]">
                  <div className="mb-4">
                    <div className="inline-flex items-center rounded-full border border-cyan-400/18 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">{pose.shortLabel}</div>
                    <h3 className="mt-3 text-xl font-semibold text-[var(--app-text)]">{pose.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--app-muted)]">{pose.hint}</p>
                  </div>

                  <div className="overflow-hidden rounded-[26px] border border-[var(--app-border)] bg-white">
                    {preview ? (
                      <img src={preview.fileUrl} alt={`${pose.title} em ${formatDatePt(selectedAssessment?.entryDate ?? formValues.entryDate)}`} className="h-[360px] w-full object-cover" />
                    ) : (
                      <BodyPoseIllustration pose={pose.key} className="h-[360px] rounded-none border-0" />
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-sm text-[var(--app-muted)]">{preview ? `Foto atual de ${formatDatePt(selectedAssessment?.entryDate ?? formValues.entryDate)}` : "Envie uma nova foto para esta pose"}</div>
                    <label htmlFor={`photo-${pose.key}`} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-cyan-400/18 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-400/15 dark:text-cyan-200">
                      <Camera className="h-4 w-4" />
                      Escolher foto
                    </label>
                  </div>

                  <input id={`photo-${pose.key}`} name={`photo-${pose.key}`} type="file" accept="image/*" className="sr-only" />
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-4">
            <div className="flex items-center gap-3 text-sm text-[var(--app-muted)]">
              <CalendarDays className="h-4 w-4" />
              {selectedAssessment ? <span>Editando o snapshot de {formatDatePt(selectedAssessment.entryDate)}.</span> : latestAssessment ? <span>Novo snapshot pre-preenchido com base no ultimo registro salvo.</span> : <span>Primeira medicao corporal da base.</span>}
            </div>

            <Button type="submit" size="lg" loading={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar medicao corporal
            </Button>
          </div>
        </Form>
      </OperationalPanel>
    </div>
  );
}
